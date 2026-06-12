import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  MaxLength,
} from 'class-validator';

export class CreatePerfilAcessoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nome!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  descricao?: string;

  @IsOptional()
  @IsBoolean()
  can_open_internal_ticket?: boolean;

  @IsOptional()
  @IsBoolean()
  can_open_stellar_ticket?: boolean;

  @IsOptional()
  @IsBoolean()
  can_manage_users?: boolean;

  @IsOptional()
  @IsBoolean()
  can_generate_invoices?: boolean;
}
