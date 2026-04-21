import { IsString, IsNotEmpty, IsEnum, IsUUID } from 'class-validator';

export enum PrioridadeChamado {
  BAIXA = 'BAIXA',
  MEDIA = 'MEDIA',
  ALTA = 'ALTA',
  URGENTE = 'URGENTE',
}

export class CreateChamadoDto {
  @IsString({ message: 'O título deve ser um texto.' })
  @IsNotEmpty({ message: 'O título é obrigatório.' })
  titulo!: string; // <-- Olha o '!' aqui

  @IsString()
  @IsNotEmpty({ message: 'A descrição do problema é obrigatória.' })
  descricao!: string; // <-- Olha o '!' aqui

  @IsEnum(PrioridadeChamado, { message: 'A prioridade deve ser BAIXA, MEDIA, ALTA ou URGENTE.' })
  @IsNotEmpty()
  prioridade!: PrioridadeChamado; // <-- Olha o '!' aqui

  @IsString()
  @IsNotEmpty({ message: 'A categoria é obrigatória (Ex: SISTEMA, REDE, SUPORTE).' })
  categoria!: string; // <-- Olha o '!' aqui

  @IsUUID('4', { message: 'O ID da empresa responsável deve ser um UUID válido.' })
  @IsNotEmpty()
  empresa_responsavel_id!: string; // <-- Olha o '!' aqui
}