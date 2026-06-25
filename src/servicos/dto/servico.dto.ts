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

export enum TipoServico {
  ACESSO = 'ACESSO', // tem plataforma/login (SSO) — ex.: GalaxIA
  SERVICO = 'SERVICO', // serviço/projeto recorrente, sem login — ex.: Infra, Suporte
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

  @IsOptional()
  @IsEnum(TipoServico)
  tipo?: TipoServico;
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
  @IsEnum(TipoServico)
  tipo?: TipoServico;

  @IsOptional()
  @IsEnum(StatusServico)
  status?: StatusServico;
}
