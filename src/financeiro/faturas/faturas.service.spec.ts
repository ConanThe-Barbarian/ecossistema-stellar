import { Test, TestingModule } from '@nestjs/testing';
import { FaturasService } from './faturas.service';

describe('FaturasService', () => {
  let service: FaturasService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FaturasService],
    }).compile();

    service = module.get<FaturasService>(FaturasService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
