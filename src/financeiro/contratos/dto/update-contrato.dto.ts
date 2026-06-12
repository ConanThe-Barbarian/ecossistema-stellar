import {
  IsUUID,
  IsNumber,
  IsInt,
  Min,
  Max,
  IsPositive,
  IsOptional,
  IsEnum,
} from 'class-validator';

export enum StatusContrato {
  ATIVO = 'ATIVO',
  SUSPENSO = 'SUSPENSO',
  CANCELADO = 'CANCELADO',
}

export class UpdateContratoDto {
  @IsOptional()
  @IsUUID()
  plano_id?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  valor_mensalidade?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(28)
  dia_vencimento?: number;

  @IsOptional()
  @IsEnum(StatusContrato)
  status?: StatusContrato;
}
