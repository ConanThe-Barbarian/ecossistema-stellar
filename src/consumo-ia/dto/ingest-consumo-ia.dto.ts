import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  IsNumber,
  IsDateString,
  Min,
  MaxLength,
} from 'class-validator';

/**
 * Payload que o n8n envia após cada execução de um agente de IA.
 * É preciso identificar a empresa por UM destes: empresa_id, cnpj ou telefone.
 */
export class IngestConsumoIaDto {
  @IsOptional()
  @IsUUID()
  empresa_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  cnpj?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  agente?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  modelo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  origem?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  tokens_prompt?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  tokens_resposta?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  tokens_total?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  custo_reais?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  referencia?: string;

  @IsOptional()
  @IsDateString()
  ocorrido_em?: string;
}
