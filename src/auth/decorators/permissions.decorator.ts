import { SetMetadata } from '@nestjs/common';

// Chave única para identificar esse metadado no sistema
export const REQUIRE_PERMISSION_KEY = 'require_permission';

// O decorador que vamos usar em cima das rotas
export const RequirePermission = (permission: string) => 
  SetMetadata(REQUIRE_PERMISSION_KEY, permission);