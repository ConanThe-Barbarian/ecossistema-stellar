import { IsString, IsNumber, IsEnum, IsNotEmpty } from 'class-validator';

// Baseado no seu Schema Prisma (tipo_preco: FIXO ou VARIAVEL)
export enum TipoPreco {
  FIXO = 'FIXO',
  VARIAVEL = 'VARIAVEL',
}

export class CreatePlanoDto {
  @IsString()
  @IsNotEmpty()
  nome!: string;

  @IsEnum(TipoPreco)
  tipo_preco!: TipoPreco;

  @IsNumber()
  valor_base!: number;
}