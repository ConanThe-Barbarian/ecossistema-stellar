import { IsString, IsNotEmpty, IsBoolean, IsOptional } from 'class-validator';

export class CreateInteracaoDto {
  @IsString({ message: 'A mensagem deve ser um texto válido.' })
  @IsNotEmpty({ message: 'A mensagem não pode ser enviada em branco.' })
  mensagem!: string;

  @IsBoolean({ message: 'O campo de nota interna deve ser verdadeiro ou falso (boolean).' })
  @IsOptional()
  is_nota_interna?: boolean;
}