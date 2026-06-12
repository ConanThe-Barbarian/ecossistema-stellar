import {
  IsUUID,
  IsInt,
  Min,
  IsNumber,
  Matches,
} from 'class-validator';

// Registro de consumo variável (tokens de IA, APIs) por empresa/mês.
// Pode ser chamado pelo n8n sempre que houver consumo no GalaxIA.
export class RegistrarConsumoDto {
  @IsUUID()
  empresa_id!: string;

  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'mes_referencia deve estar no formato YYYY-MM',
  })
  mes_referencia!: string;

  @IsInt()
  @Min(0)
  qtd_tokens!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  custo_gerado_reais!: number;
}
