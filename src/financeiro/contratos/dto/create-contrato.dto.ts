import {
  IsUUID,
  IsNumber,
  IsInt,
  IsOptional,
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

  // Teto mensal de consumo de IA em R$ (opcional). Acima disso, o excedente
  // entra no Consumo Variável do cliente.
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  teto_ia_reais?: number;
}
