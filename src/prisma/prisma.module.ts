import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma.service'; // Ajuste o caminho se o service estiver na raiz da src

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService], // Essencial para que outros módulos vejam o Prisma
})
export class PrismaModule {}