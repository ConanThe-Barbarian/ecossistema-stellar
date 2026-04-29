import { Test, TestingModule } from '@nestjs/testing';
import { FaturasController } from './faturas.controller';

describe('FaturasController', () => {
  let controller: FaturasController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FaturasController],
    }).compile();

    controller = module.get<FaturasController>(FaturasController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
