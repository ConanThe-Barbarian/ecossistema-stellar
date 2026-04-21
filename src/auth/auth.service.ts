import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  // 1. Valida usuário, mas agora traz os "poderes" junto!
  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.prisma.usuarios.findUnique({
      where: { email },
      include: { 
        perfis_acesso: true, // Puxa os dados da tabela perfis_acesso
        empresas: true       // Aproveitamos para trazer a empresa, será útil nos chamados!
      }
    });

    if (user && (await bcrypt.compare(pass, user.senha_hash))) {
      const { senha_hash, ...result } = user;
      return result;
    }
    return null;
  }

  // 2. Gera o Token com as permissões embutidas
  async login(user: any) {
    const payload = { 
      email: user.email, 
      sub: user.id,
      nome: user.nome,
      empresa_id: user.empresa_id,
      perfil: user.perfis_acesso.nome, // Ex: "Admin", "Cliente"
      permissoes: {
        can_manage_users: user.perfis_acesso.can_manage_users,
        can_open_internal_ticket: user.perfis_acesso.can_open_internal_ticket,
        can_open_stellar_ticket: user.perfis_acesso.can_open_stellar_ticket
      }
    };
    
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  // Mantemos o registro igualzinho
  async register(data: any) {
    const salt = await bcrypt.genSalt(10);
    const hashedPass = await bcrypt.hash(data.password, salt);

    return this.prisma.usuarios.create({
      data: {
        nome: data.nome,
        email: data.email,
        senha_hash: hashedPass,
        empresa_id: data.empresa_id,
        perfil_id: data.perfil_id,
        status: 'ATIVO',
      },
    });
  }
}