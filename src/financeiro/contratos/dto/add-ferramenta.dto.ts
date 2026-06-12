import { IsUUID, IsOptional, IsString, IsEnum } from 'class-validator';

export enum StatusAcesso {
  LIBERADO = 'LIBERADO',
  BLOQUEADO = 'BLOQUEADO',
}

// Vincula um serviço do catálogo (ex: GalaxIA) a um contrato,
// com o token SSO que o Portal do Cliente usa para acesso direto.
export class AddFerramentaDto {
  @IsUUID()
  servico_id!: string;

  @IsOptional()
  @IsString()
  token_sso_cliente?: string;

  @IsOptional()
  @IsString()
  url_acesso?: string;

  @IsOptional()
  @IsEnum(StatusAcesso)
  status_acesso?: StatusAcesso;
}
