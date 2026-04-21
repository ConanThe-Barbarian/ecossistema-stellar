import { config } from 'dotenv';
config();
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js'; // Adicione o .js aqui!
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Ativando a validação global
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, // Segurança pesada: Remove qualquer campo do JSON que não esteja definido no DTO!
    forbidNonWhitelisted: true, // Retorna erro se o usuário tentar mandar campos extras "secretos"
    transform: true, // Transforma os dados do JSON no tipo correto da classe
  }));

  await app.listen(3000);
}
bootstrap();