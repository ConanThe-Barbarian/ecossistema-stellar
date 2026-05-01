import { IsEmail, IsNotEmpty, IsString, IsOptional, IsUUID } from 'class-validator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  nome!: string;

  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;

  @IsUUID()
  @IsOptional()
  empresa_id?: string;
}