import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @UseGuards(AuthGuard('jwt')) // ESTA LINHA É O BOUNCER! Bloqueia quem não tem o token.
  @Get()
  getHello() {
    return this.appService.getHello();
  }
}