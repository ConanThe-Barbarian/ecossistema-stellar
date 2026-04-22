// src/relatorios/api-key.guard.ts
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    // A chave mestra que o n8n vai usar (O ideal é depois colocar no seu arquivo .env)
    const CHAVE_SECRETA = process.env.API_KEY_N8N || 'Stellar-SecretasdihnwlaikdnlaXvL6STXeYTpxHYSthAmZBnqWqB8gwUeZlF0fKBkc55BEjVc2G3IUUnCGbViVNPXUsdinlawidnasldknliwandlias';

    // Verifica se o n8n mandou o cabeçalho 'Authorization: Bearer Stellar-Secret-Key-2026'
    if (authHeader === `Bearer ${CHAVE_SECRETA}`) {
      return true; // Passagem liberada!
    }

    throw new UnauthorizedException('Acesso negado! Cadê a chave do Ecossistema Stellar?');
  }
}