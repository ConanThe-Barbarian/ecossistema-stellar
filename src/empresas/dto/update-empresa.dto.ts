import {
  IsString,
  IsOptional,
  IsEnum,
  IsEmail,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { TipoEmpresa } from './create-empresa.dto';

export enum StatusEmpresa {
  ATIVO = 'ATIVO',
  INATIVO = 'INATIVO',
  SUSPENSO = 'SUSPENSO',
}

// Versão com todos os campos opcionais (PATCH) + controle de status
export class UpdateEmpresaDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  razao_social?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  nome_fantasia?: string;

  @IsOptional()
  @IsString()
  @Matches(/^(\d{11}|\d{14}|\d{3}\.\d{3}\.\d{3}-\d{2}|\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})$/, {
    message: 'cnpj_cpf deve ser um CPF (11 dígitos) ou CNPJ (14 dígitos) válido',
  })
  cnpj_cpf?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  inscricao_estadual?: string;

  @IsOptional()
  @IsEnum(TipoEmpresa)
  tipo_empresa?: TipoEmpresa;

  @IsOptional()
  @IsEnum(StatusEmpresa)
  status?: StatusEmpresa;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email_financeiro?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefone_principal?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  endereco_cep?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  endereco_logradouro?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  endereco_numero?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  endereco_cidade?: string;

  @IsOptional()
  @IsString()
  @Length(2, 2)
  endereco_estado?: string;

  @IsOptional()
  @IsString()
  ui_customizacao?: string;
}
