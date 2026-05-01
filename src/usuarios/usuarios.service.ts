import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { UserScope } from '../auth/types/auth.types';

@Injectable()
export class UsuariosService {
  constructor(private prisma: PrismaService) {}

  async listarUsuarios(empresaId: string, scope: UserScope) {
    // 🛡️ Visão de Águia: Se for Super Admin da Stellar, vê tudo
    if (scope === 'global') {
      return this.prisma.usuarios.findMany({
        include: { 
          empresas: { select: { razao_social: true } }, 
          perfis_acesso: { select: { nome: true } } 
        }
      });
    }

    // 🔒 Visão de Silo: Se for cliente, vê apenas os colegas da mesma empresa
    return this.prisma.usuarios.findMany({
      where: { 
        empresa_id: empresaId,
        deleted_at: null 
      },
      include: { 
        perfis_acesso: { select: { nome: true } } 
      }
    });
  }
}