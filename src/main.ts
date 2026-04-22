import { config } from 'dotenv';
config();
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js'; 
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  // Cast para NestExpressApplication para habilitar métodos do Express como useStaticAssets
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  
  // Ativando a validação global
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, 
    forbidNonWhitelisted: true, 
    transform: true, 
  }));

  await app.listen(3000,'0.0.0.0');
}
bootstrap();