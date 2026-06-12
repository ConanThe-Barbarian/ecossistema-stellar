import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsUUID,
  IsOptional,
  MinLength,
  MaxLength,
} from 'class-validator';

export class CreateUsuarioDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  nome!: string;

  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(8, { message: 'A senha deve ter no mínimo 8 caracteres' })
  senha!: string;

  @IsUUID()
  empresa_id!: string;

  @IsUUID()
  perfil_id!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefone_whatsapp?: string;
}
