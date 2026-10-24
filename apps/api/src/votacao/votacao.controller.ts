import { Body, Controller, Get, Headers, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsInt, IsString } from 'class-validator';
import { Publico } from '../auth/auth';
import { VotacaoService } from './votacao.service';

class EntrarDto {
  @IsString() cpf!: string;
}

class VotoDto {
  @IsInt() candidaturaId!: number;
}

/** Rotas do votante: sem login; usam o CPF e depois a sessão de uso único. */
@Publico()
@Controller('votacao')
export class VotacaoController {
  constructor(private readonly votacao: VotacaoService) {}

  @Get('situacao')
  situacao() {
    return this.votacao.situacao();
  }

  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  @Post('entrar')
  @HttpCode(200)
  entrar(@Body() dto: EntrarDto) {
    return this.votacao.entrar(dto.cpf);
  }

  @Get('cedula')
  cedula(@Headers('x-sessao-votacao') token?: string) {
    return this.votacao.cedula(token);
  }

  @Post('votar')
  @HttpCode(200)
  votar(@Body() dto: VotoDto, @Headers('x-sessao-votacao') token?: string) {
    return this.votacao.votar(token, dto.candidaturaId);
  }
}
