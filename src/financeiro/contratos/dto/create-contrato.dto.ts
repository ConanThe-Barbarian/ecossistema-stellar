import {
  IsUUID,
  IsNumber,
  IsInt,
  Min,
  Max,
  IsPositive,
} from 'class-validator';

export class CreateContratoDto {
  @IsUUID()
  empresa_id!: string;

  @IsUUID()
  plano_id!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  valor_mensalidade!: number;

  // Dia do mês em que a fatura vence (1 a 28 para não quebrar em fevereiro)
  @IsInt()
  @Min(1)
  @Max(28)
  dia_vencimento!: number;
}
