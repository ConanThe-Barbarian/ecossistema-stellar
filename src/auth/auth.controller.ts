import { Controller, Post, Get, Body, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { RegisterDto } from './dto/register.dto';

@Controller('auth') // A rota principal será http://localhost:3000/auth
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('login')
  async login(@Body() body: any) {
    const { email, password } = body;

    // 1. Chama o serviço para validar as credenciais no banco
    const user = await this.authService.validateUser(email, password);

    // 2. Se não encontrar ou a senha estiver errada, barra o acesso
    if (!user) {
      throw new UnauthorizedException('E-mail ou senha inválidos!');
    }

    // 3. Tudo certo: se o usuário tem MFA, isto retorna o desafio (mfaRequired);
    //    senão, retorna o access_token direto.
    return this.authService.login(user);
  }

  // 2ª etapa do login quando o MFA está ativo: valida o código enviado por e-mail
  @Public()
  @Post('mfa/verificar')
  async verificarMfa(@Body() body: { mfaToken: string; codigo: string }) {
    return this.authService.verificarMfa(body?.mfaToken, body?.codigo);
  }

  // Ativa o MFA para o próprio usuário logado
  @Post('mfa/ativar')
  async ativarMfa(@CurrentUser('id') userId: string) {
    return this.authService.definirMfa(userId, true);
  }

  // Desativa o MFA para o próprio usuário logado
  @Post('mfa/desativar')
  async desativarMfa(@CurrentUser('id') userId: string) {
    return this.authService.definirMfa(userId, false);
  }

  @Get('mfa/status')
  async statusMfa(@CurrentUser('id') userId: string) {
    return this.authService.statusMfa(userId);
  }

  // Adicione esta rota no seu AuthController
  @Public()
  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    // 🛡️ Blindado: O NestJS barra automaticamente qualquer campo não listado no RegisterDto
    return this.authService.register(registerDto);
  }
}
