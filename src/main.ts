import { config } from 'dotenv';
config();
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js'; // Adicione o .js aqui!

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
  console.log('✅ Servidor voando em http://localhost:3000');
}
bootstrap();