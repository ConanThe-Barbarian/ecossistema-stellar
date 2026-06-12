import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  MaxLength,
} from 'class-validator';

export enum StatusServico {
  ATIVO = 'ATIVO',
  INATIVO = 'INATIVO',
}

// Catálogo de ferramentas/serviços da Stellar (ex: GalaxIA)
export class CreateServicoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nome!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  descricao?: string;

  @IsOptional()
  @IsString()
  icone_url?: string;
}

export class UpdateServicoDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nome?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  descricao?: string;

  @IsOptional()
  @IsString()
  icone_url?: string;

  @IsOptional()
  @IsEnum(StatusServico)
  status?: StatusServico;
}
