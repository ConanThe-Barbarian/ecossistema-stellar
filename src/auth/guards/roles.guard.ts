import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector, private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>('permissions', [
      context.getHandler(),
      context.getClass(),
    ]);

    // Se a rota não tem o decorator @Permissions, ela é liberada (mas protegida pelo JWT)
    if (!requiredPermissions) return true;

    const request = context.switchToHttp().getRequest();
    const { user } = request;

    // Busca o usuário com o perfil e a empresa no SQL Server
    const userDb = await this.prisma.usuarios.findUnique({
      where: { id: user.id },
      include: { 
        perfis_acesso: true, 
        empresas: true 
      },
    });

    if (!userDb || !userDb.perfis_acesso) {
      throw new ForbiddenException('Usuário ou Perfil não encontrado.');
    }

    // 🛡️ REGRA DE OURO DA STELLAR SYNTEC
    // Verifica se é um dos fundadores (Conan, Gustavo ou Rômulo) 
    // identificando se a empresa é a Stellar Syntec
    const isStellarFounder = userDb.empresas.razao_social.toUpperCase().includes('STELLAR');

    // Verifica as permissões booleanas dinamicamente (ex: can_generate_invoices)
    const hasPermission = requiredPermissions.every(
      (perm) => (userDb.perfis_acesso as any)[perm] === true
    );

    if (!hasPermission) {
      throw new ForbiddenException('Seu perfil não permite realizar esta ação.');
    }

    // 🚀 Define o Escopo: Fundadores são 'global', clientes são 'local'
    request.userScope = isStellarFounder ? 'global' : 'local';

    return true;
  }
}