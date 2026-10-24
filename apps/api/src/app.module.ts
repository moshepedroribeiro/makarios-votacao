import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthGuard } from './auth/auth';
import { AuthController } from './auth/auth.controller';
import { DatabaseModule } from './db/database.module';
import { ApuracaoService } from './eleicoes/apuracao.service';
import { EleicoesController } from './eleicoes/eleicoes.controller';
import { EleicoesService } from './eleicoes/eleicoes.service';
import { RelatoriosService } from './eleicoes/relatorios.service';
import { MembrosController } from './membros/membros.controller';
import { MembrosService } from './membros/membros.service';
import { UsuariosController } from './usuarios/usuarios.controller';
import { VotacaoController } from './votacao/votacao.controller';
import { VotacaoService } from './votacao/votacao.service';

function segredoJwt(): string {
  const s = process.env.JWT_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Defina JWT_SECRET (16+ caracteres) no ambiente de produção.');
  }
  return 'desenvolvimento-makarios-troque-em-producao';
}

@Module({
  imports: [
    DatabaseModule,
    JwtModule.register({ secret: segredoJwt(), signOptions: { expiresIn: '12h' } }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
  ],
  controllers: [AuthController, UsuariosController, MembrosController, EleicoesController, VotacaoController],
  providers: [
    MembrosService,
    EleicoesService,
    ApuracaoService,
    RelatoriosService,
    VotacaoService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
