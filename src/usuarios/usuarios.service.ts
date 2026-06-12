import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import type { UserScope } from '../auth/types/auth.types';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto, ResetarSenhaDto } from './dto/update-usuario.dto';
import { CreatePerfilAcessoDto } from './dto/perfil-acesso.dto';

// Campos seguros para retornar (NUNCA expor senha_hash)
const CAMPOS_SEGUROS = {
  id: true,
  nome: true,
  email: true,
  telefone_whatsapp: true,
  status: true,
  mfa_enabled: true,
  empresa_id: true,
  created_at: true,
  updated_at: true,
  empresas: { select: { razao_social: true } },
  perfis_acesso: { select: { id: true, nome: true } },
};

@Injectable()
export class UsuariosService {
  constructor(private prisma: PrismaService) {}

  async listarUsuarios(empresaId: string, scope: UserScope) {
    // 🛡️ Visão de Águia: Se for Super Admin da Stellar, vê tudo
    if (scope === 'global') {
      return this.prisma.usuarios.findMany({
        where: { deleted_at: null },
        select: CAMPOS_SEGUROS,
        orderBy: { nome: 'asc' },
      });
    }

    // 🔒 Visão de Silo: Se for cliente, vê apenas os colegas da mesma empresa
    return this.prisma.usuarios.findMany({
      where: { empresa_id: empresaId, deleted_at: null },
      select: CAMPOS_SEGUROS,
      orderBy: { nome: 'asc' },
    });
  }

  async buscarPorId(id: string, empresaId: string, scope: UserScope) {
    const usuario = await this.prisma.usuarios.findFirst({
      where: { id, deleted_at: null },
      select: CAMPOS_SEGUROS,
    });

    if (!usuario) {
      throw new NotFoundException('Usuário não encontrado na base estelar.');
    }

    // Cliente só enxerga usuários da própria empresa
    if (scope === 'local' && usuario.empresa_id !== empresaId) {
      throw new ForbiddenException('Acesso negado a usuários de outra empresa.');
    }

    return usuario;
  }

  async criar(dto: CreateUsuarioDto, empresaIdSolicitante: string, scope: UserScope) {
    // Cliente só cria usuários dentro da própria empresa
    if (scope === 'local' && dto.empresa_id !== empresaIdSolicitante) {
      throw new ForbiddenException('Você só pode criar usuários na sua própria empresa.');
    }

    const emailExistente = await this.prisma.usuarios.findUnique({
      where: { email: dto.email },
    });
    if (emailExistente) {
      throw new ConflictException(`O e-mail ${dto.email} já está cadastrado.`);
    }

    const empresa = await this.prisma.empresas.findFirst({
      where: { id: dto.empresa_id, deleted_at: null },
    });
    if (!empresa) {
      throw new NotFoundException('Empresa não encontrada na base estelar.');
    }

    const perfil = await this.prisma.perfis_acesso.findFirst({
      where: { id: dto.perfil_id, deleted_at: null },
    });
    if (!perfil) {
      throw new NotFoundException('Perfil de acesso não encontrado.');
    }

    const salt = await bcrypt.genSalt(10);
    const senhaHash = await bcrypt.hash(dto.senha, salt);

    return this.prisma.usuarios.create({
      data: {
        nome: dto.nome,
        email: dto.email,
        senha_hash: senhaHash,
        empresa_id: dto.empresa_id,
        perfil_id: dto.perfil_id,
        telefone_whatsapp: dto.telefone_whatsapp,
        status: 'ATIVO',
      },
      select: CAMPOS_SEGUROS,
    });
  }

  async atualizar(id: string, dto: UpdateUsuarioDto, empresaId: string, scope: UserScope) {
    await this.buscarPorId(id, empresaId, scope); // valida existência e escopo

    if (dto.perfil_id) {
      const perfil = await this.prisma.perfis_acesso.findFirst({
        where: { id: dto.perfil_id, deleted_at: null },
      });
      if (!perfil) {
        throw new NotFoundException('Perfil de acesso não encontrado.');
      }
    }

    return this.prisma.usuarios.update({
      where: { id },
      data: { ...dto, updated_at: new Date() },
      select: CAMPOS_SEGUROS,
    });
  }

  async resetarSenha(id: string, dto: ResetarSenhaDto, empresaId: string, scope: UserScope) {
    await this.buscarPorId(id, empresaId, scope);

    const salt = await bcrypt.genSalt(10);
    const senhaHash = await bcrypt.hash(dto.nova_senha, salt);

    await this.prisma.usuarios.update({
      where: { id },
      data: { senha_hash: senhaHash, updated_at: new Date() },
    });

    return { mensagem: 'Senha redefinida com sucesso.' };
  }

  async remover(id: string, solicitanteId: string, empresaId: string, scope: UserScope) {
    if (id === solicitanteId) {
      throw new ForbiddenException('Você não pode remover o seu próprio usuário.');
    }

    await this.buscarPorId(id, empresaId, scope);

    return this.prisma.usuarios.update({
      where: { id },
      data: { deleted_at: new Date(), status: 'INATIVO', updated_at: new Date() },
      select: CAMPOS_SEGUROS,
    });
  }

  // ─── Perfis de Acesso ───

  async listarPerfis() {
    return this.prisma.perfis_acesso.findMany({
      where: { deleted_at: null },
      orderBy: { nome: 'asc' },
      include: { _count: { select: { usuarios: true } } },
    });
  }

  async criarPerfil(dto: CreatePerfilAcessoDto, scope: UserScope) {
    // Apenas fundadores (escopo global) criam perfis de acesso
    if (scope !== 'global') {
      throw new ForbiddenException('Apenas a Stellar Syntec pode criar perfis de acesso.');
    }
    return this.prisma.perfis_acesso.create({ data: dto });
  }
}
