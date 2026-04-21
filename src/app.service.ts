import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class AppService {
  constructor(private prisma: PrismaService) {}

  async getHello() {
    // Buscando a primeira empresa (Stellar Syntec) no SQL Server
    const empresa = await this.prisma.empresas.findFirst();
    
    return {
      message: 'Ecossistema Stellar Online!',
      database: 'SQL Server via Radmin',
      empresa_detectada: empresa?.nome_fantasia || 'Sem dados',
      tecnologia: 'NestJS + Prisma v7'
    };
  }
}