import { describe, beforeEach, it, afterAll } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
// Removemos o import de 'App' que costuma bugar no NodeNext
import { AppModule } from './../src/app.module.js'; // Adicionamos .js para o NodeNext

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      // O teste agora espera um OBJETO, não mais a string "Hello World!"
      .expect((res) => {
        if (!res.body.message.includes('Ecossistema Stellar')) {
          throw new Error('A mensagem do banco não apareceu no teste!');
        }
      });
  });

  afterAll(async () => {
    await app.close();
  });
});