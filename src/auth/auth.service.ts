import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  // 1. Validar se o usuário existe e se a senha bate com o hash
  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.prisma.usuarios.findUnique({
      where: { email }, // Usando o campo email único do seu schema
    });

    // Compara a senha enviada com o campo senha_hash do banco
    if (user && (await bcrypt.compare(pass, user.senha_hash))) {
      const { senha_hash, ...result } = user; // Remove o hash por segurança
      return result;
    }
    return null;
  }

  // 2. Gerar o passaporte (Token JWT)
  async login(user: any) {
    const payload = { 
      email: user.email, 
      sub: user.id,
      nome: user.nome // Incluindo o nome que está no seu schema
    };
    
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  // Adicione este método dentro da classe AuthService
async register(data: any) {
  // 1. Gera o "tempero" (salt) e o hash da senha
  const salt = await bcrypt.genSalt(10);
  const hashedPass = await bcrypt.hash(data.password, salt);

  // 2. Salva no banco usando os nomes exatos do seu schema
  return this.prisma.usuarios.create({
    data: {
      nome: data.nome,
      email: data.email,
      senha_hash: hashedPass, // Salvando no campo correto [cite: 56]
      empresa_id: data.empresa_id, // UUID da empresa [cite: 54]
      perfil_id: data.perfil_id,   // UUID do perfil [cite: 54]
      status: 'ATIVO',
    },
  });
}
}