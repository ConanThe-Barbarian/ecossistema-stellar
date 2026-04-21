import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaMssql } from '@prisma/adapter-mssql';
import 'dotenv/config';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    const url = process.env.DATABASE_URL;
    
    if (!url) {
      throw new Error('❌ DATABASE_URL não encontrada no seu arquivo .env!');
    }

    // Criamos o adaptador MSSQL exigido pela v7
    const adapter = new PrismaMssql(url);

    // Passamos o adaptador para o motor do Prisma
    super({ adapter });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      console.log('🚀 [Stellar Syntec] Conexão SQL Server estabelecida via Adapter!');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('❌ Erro de conexão no serviço:', msg);
    }
  }
}