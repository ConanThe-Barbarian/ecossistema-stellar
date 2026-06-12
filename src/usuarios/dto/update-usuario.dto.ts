import {
  IsString,
  IsOptional,
  IsUUID,
  IsEnum,
  MaxLength,
  MinLength,
} from 'class-validator';

export enum StatusUsuario {
  ATIVO = 'ATIVO',
  INATIVO = 'INATIVO',
  BLOQUEADO = 'BLOQUEADO',
}

export class UpdateUsuarioDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  nome?: string;

  @IsOptional()
  @IsUUID()
  perfil_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefone_whatsapp?: string;

  @IsOptional()
  @IsEnum(StatusUsuario)
  status?: StatusUsuario;
}

export class ResetarSenhaDto {
  @IsString()
  @MinLength(8, { message: 'A nova senha deve ter no mínimo 8 caracteres' })
  nova_senha!: string;
}
