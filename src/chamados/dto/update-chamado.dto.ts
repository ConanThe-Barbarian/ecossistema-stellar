import { IsString, IsOptional, IsEnum, IsUUID } from 'class-validator';
import { PrioridadeChamado } from './create-chamado.dto';

// Agora o Enum fala a língua do seu SQL Server!
export enum StatusChamado {
  NOVO = 'NOVO',
  EM_ATENDIMENTO = 'EM_ATENDIMENTO',
  PENDENTE_CLIENTE = 'PENDENTE_CLIENTE',
  RESOLVIDO = 'RESOLVIDO',
  FECHADO = 'FECHADO',
}

export class UpdateChamadoDto {
  @IsEnum(StatusChamado, { message: 'O status fornecido não é aceito pelo banco de dados.' })
  @IsOptional()
  status?: StatusChamado;

  @IsEnum(PrioridadeChamado, { message: 'A prioridade deve ser BAIXA, MEDIA, ALTA ou URGENTE.' })
  @IsOptional()
  prioridade?: PrioridadeChamado;

  @IsString()
  @IsOptional()
  categoria?: string;

  @IsUUID('4', { message: 'O ID do técnico deve ser um UUID válido.' })
  @IsOptional()
  tecnico_atribuido_id?: string;
}