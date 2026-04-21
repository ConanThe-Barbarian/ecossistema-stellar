import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    // 1. Intercepta a requisição HTTP atual
    const request = ctx.switchToHttp().getRequest();
    
    // 2. Pega o usuário que foi injetado pelo nosso JwtStrategy
    const user = request.user;

    // 3. Pulo do gato: se você pedir um dado específico (ex: @CurrentUser('empresa_id')), 
    // ele retorna só o ID. Se não pedir nada, retorna o objeto do usuário inteiro.
    return data ? user?.[data] : user;
  },
);