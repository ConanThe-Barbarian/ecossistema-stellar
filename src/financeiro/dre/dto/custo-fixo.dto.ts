import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsNumber,
  IsPositive,
  IsEnum,
  Matches,
  MaxLength,
} from 'class-validator';

export enum StatusCusto {
  ATIVO = 'ATIVO',
  INATIVO = 'INATIVO',
}

const MES_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

export class CreateCustoFixoDto {
  // NULL/ausente = custo geral da operação (rateado entre os clientes ativos)
  @IsOptional()
  @IsUUID()
  empresa_id?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  descricao!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  valor_mensal!: number;

  @IsOptional()
  @Matches(MES_REGEX, { message: 'mes_inicio deve estar no formato YYYY-MM' })
  mes_inicio?: string;

  @IsOptional()
  @Matches(MES_REGEX, { message: 'mes_fim deve estar no formato YYYY-MM' })
  mes_fim?: string;
}

export class UpdateCustoFixoDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  descricao?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  valor_mensal?: number;

  @IsOptional()
  @Matches(MES_REGEX, { message: 'mes_inicio deve estar no formato YYYY-MM' })
  mes_inicio?: string;

  @IsOptional()
  @Matches(MES_REGEX, { message: 'mes_fim deve estar no formato YYYY-MM' })
  mes_fim?: string;

  @IsOptional()
  @IsEnum(StatusCusto)
  status?: StatusCusto;
}
