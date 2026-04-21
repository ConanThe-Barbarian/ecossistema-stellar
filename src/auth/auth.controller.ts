import { Controller, Post, Body, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth') // A rota principal será http://localhost:3000/auth
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login') // Rota: POST /auth/login
  async login(@Body() body: any) {
    const { email, password } = body;

    // 1. Chama o serviço para validar as credenciais no banco
    const user = await this.authService.validateUser(email, password);

    // 2. Se não encontrar ou a senha estiver errada, barra o acesso
    if (!user) {
      throw new UnauthorizedException('E-mail ou senha inválidos!');
    }

    // 3. Se estiver tudo certo, gera o token JWT
    return this.authService.login(user);
  }

  // Adicione esta rota no seu AuthController
@Post('register')
async register(@Body() body: any) {
  return this.authService.register(body);
}
}