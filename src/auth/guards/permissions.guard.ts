import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_PERMISSION_KEY } from '../decorators/permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 1. Verifica qual permissão a rota exige (lendo o decorador lá de cima)
    const requiredPermission = this.reflector.getAllAndOverride<string>(
      REQUIRE_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Se a rota não tiver exigência, libera o acesso (assume que só o JWT basta)
    if (!requiredPermission) {
      return true;
    }

    // 2. Pega os dados do usuário que o JwtAuthGuard injetou na requisição
    const { user } = context.switchToHttp().getRequest();

    // 3. Valida se o usuário tem a permissão necessária dentro do objeto 'permissoes' do seu Token
    if (user.permissoes && user.permissoes[requiredPermission] === true) {
      return true;
    }

    // 4. Caso contrário, manda o "proibido" (403)
    throw new ForbiddenException('Acesso negado: Você não tem a permissão necessária na Stellar Syntec!');
  }
}