import { config } from 'dotenv';
config();
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module.js';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import * as express from 'express';
import { AllExceptionsFilter } from './common/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.use(helmet());

  // Validação global dos DTOs: remove campos não declarados e converte tipos
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Padroniza respostas de erro e evita vazar stack trace
  app.useGlobalFilters(new AllExceptionsFilter());

  // Limite de tamanho (Impede arquivos gigantes de travarem o servidor)
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ limit: '1mb', extended: true }));

  app.enableCors({
    origin: [process.env.FRONTEND_URL || 'http://localhost:5173'],
    methods: 'GET,POST,PATCH,DELETE',
    credentials: true,
  });

  await app.listen(3000, '0.0.0.0');
}
bootstrap();