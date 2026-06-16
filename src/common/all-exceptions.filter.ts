import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

/**
 * Filtro global de exceções: padroniza a resposta de erro (JSON limpo),
 * nunca vaza stack trace para o cliente e registra os erros 5xx no log.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<any>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message: any = 'Erro interno do servidor.';
    if (exception instanceof HttpException) {
      const resp = exception.getResponse();
      message = typeof resp === 'string' ? resp : (resp as any).message ?? resp;
    }

    // Só logamos detalhes técnicos de erros do servidor (5xx)
    if (status >= 500) {
      const detalhe = exception instanceof Error ? exception.stack : String(exception);
      this.logger.error(`${req.method} ${req.url} -> ${status}`);
      this.logger.error(detalhe);
    }

    res.status(status).json({
      statusCode: status,
      message,
      path: req.url,
      timestamp: new Date().toISOString(),
    });
  }
}
