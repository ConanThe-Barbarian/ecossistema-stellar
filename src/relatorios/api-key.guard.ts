import {  CanActivate, ExecutionContext, Injectable, UnauthorizedException, InternalServerErrorException } from '@nestjs/common';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'] || request.query['apiKey'];

    const CHAVE_SECRETA = process.env.API_KEY_N8N;

    if (!CHAVE_SECRETA) {
      throw new InternalServerErrorException('Configuração de segurança ausente no servidor (API_KEY_N8N).');
    }

    if (apiKey !== CHAVE_SECRETA) {
      throw new UnauthorizedException('Chave de API inválida ou ausente.');
    }

    return true;
  }
}