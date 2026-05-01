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
  // 🛡️ Blindagem Vortex: Verificamos se o objeto existe antes de ler as propriedades
  const payload = { 
    sub: user.id, 
    email: user.email,
    nome: user.nome,
    // Usamos ?. para não quebrar o código se o perfil ou empresa vierem nulos
    perfil: user.perfis_acesso?.nome || 'PERFIL_NAO_DEFINIDO',
    empresa_id: user.empresa_id,
    empresa_nome: user.empresas?.razao_social || 'EMPRESA_NAO_DEFINIDA'
  };

  return {
    access_token: this.jwtService.sign(payload),
    user: {
      id: user.id,
      nome: user.nome,
      email: user.email,
      perfil: user.perfis_acesso?.nome,
      empresa: user.empresas?.razao_social
    }
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