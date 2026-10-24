import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { UsuarioLogado } from '../auth/auth';
import { apurar, CandidatoApuracao } from '../common/regras';
import { DatabaseService } from '../db/database.service';
import { EleicoesService } from './eleicoes.service';

@Injectable()
export class ApuracaoService {
  constructor(
    private readonly db: DatabaseService,
    private readonly eleicoes: EleicoesService,
  ) {}

  /** Conta os votos por candidatura deferida (inclui quem teve zero votos). */
  private contarVotos(eleicaoId: number): CandidatoApuracao[] {
    return this.db
      .all<any>(
        `SELECT c.id AS candidaturaId, m.id AS membroId, m.nome, m.cidade, m.data_nascimento AS dataNascimento,
                (SELECT COUNT(*) FROM voto v WHERE v.eleicao_id = c.eleicao_id AND v.candidatura_id = c.id) AS votos
           FROM candidatura c JOIN membro m ON m.id = c.membro_id
          WHERE c.eleicao_id = ? AND c.situacao = 'deferida'`,
        eleicaoId,
      )
      .map((r) => ({ ...r, votos: Number(r.votos) }));
  }

  apurar(eleicaoId: number, u: UsuarioLogado) {
    const e = this.eleicoes.buscarRow(eleicaoId);
    this.eleicoes.exigirPresidente(e, u);
    if (e.status !== 'encerrada') {
      throw new BadRequestException(
        e.status === 'aberta' ? 'A votação ainda está aberta.' : 'Só é possível apurar uma eleição Encerrada.',
      );
    }
    const totalVotos = this.db.get<{ n: number }>('SELECT COUNT(*) n FROM voto WHERE eleicao_id = ?', eleicaoId)!.n;
    const totalPresencas = this.db.get<{ n: number }>('SELECT COUNT(*) n FROM presenca WHERE eleicao_id = ?', eleicaoId)!.n;
    if (totalVotos !== totalPresencas) {
      throw new BadRequestException(
        `Inconsistência: ${totalVotos} votos e ${totalPresencas} presenças. A apuração foi bloqueada.`,
      );
    }

    const r = apurar(this.contarVotos(eleicaoId));
    if (r.tipo === 'sem_votos') throw new BadRequestException(r.mensagem);
    if (r.tipo === 'empate_absoluto') {
      throw new BadRequestException(`${r.mensagem} Empatados: ${r.empatados.map((c) => c.nome).join(', ')}.`);
    }

    this.db.tx(() => {
      this.db.run('DELETE FROM resultado_candidato WHERE eleicao_id = ?', eleicaoId);
      for (const c of r.ranking) {
        this.db.run(
          'INSERT INTO resultado_candidato (eleicao_id, candidatura_id, total_votos, posicao) VALUES (?, ?, ?, ?)',
          eleicaoId,
          c.candidaturaId,
          c.votos,
          c.posicao,
        );
      }
      this.db.run(
        `UPDATE eleicao SET status = ?, presidente_eleito_id = ?, vice_eleito_id = ?, criterio_presidente = ?,
                criterio_vice = ?, apurada_em = ? WHERE id = ?`,
        r.tipo === 'aguardando_vice' ? 'aguardando_vice' : 'apurada',
        r.presidente.membroId,
        r.vice?.membroId ?? null,
        r.criterioPresidente,
        r.criterioVice,
        r.tipo === 'aguardando_vice' ? null : new Date().toISOString(),
        eleicaoId,
      );
    });
    return this.resultado(eleicaoId, u);
  }

  /** Empate na vaga de vice: o presidente de sessão registra a escolha do presidente eleito. */
  escolherVice(eleicaoId: number, candidaturaId: number, u: UsuarioLogado) {
    const e = this.eleicoes.buscarRow(eleicaoId);
    this.eleicoes.exigirPresidente(e, u);
    if (e.status !== 'aguardando_vice') throw new BadRequestException('Esta eleição não está aguardando a escolha do vice.');
    const r = apurar(this.contarVotos(eleicaoId));
    if (r.tipo !== 'aguardando_vice') throw new BadRequestException('Não há empate na vaga de vice.');
    const escolhido = r.empatadosVice.find((c) => c.candidaturaId === candidaturaId);
    if (!escolhido) throw new BadRequestException('O escolhido precisa ser um dos candidatos empatados.');
    this.db.run(
      `UPDATE eleicao SET status = 'apurada', vice_eleito_id = ?, criterio_vice = 'escolha_presidente', apurada_em = ?
        WHERE id = ?`,
      escolhido.membroId,
      new Date().toISOString(),
      eleicaoId,
    );
    return this.resultado(eleicaoId, u);
  }

  resultado(eleicaoId: number, u: UsuarioLogado) {
    const e = this.eleicoes.buscarRow(eleicaoId);
    if (!this.eleicoes.papel(e, u)) throw new ForbiddenException('Você não participa da mesa desta eleição.');
    if (!['aguardando_vice', 'apurada'].includes(e.status)) {
      // Nenhum total é exibido antes da apuração.
      throw new BadRequestException('O resultado só fica disponível depois da apuração.');
    }
    const ranking = this.db.all<any>(
      `SELECT r.posicao, r.total_votos AS votos, c.id AS candidaturaId, m.id AS membroId, m.nome, c.apelido,
              m.cidade, m.uf, m.data_nascimento AS dataNascimento
         FROM resultado_candidato r JOIN candidatura c ON c.id = r.candidatura_id JOIN membro m ON m.id = c.membro_id
        WHERE r.eleicao_id = ? ORDER BY r.posicao`,
      eleicaoId,
    );
    const pessoa = (id: number | null) => ranking.find((c) => c.membroId === id) ?? null;
    let empatadosVice: any[] = [];
    if (e.status === 'aguardando_vice') {
      const r = apurar(this.contarVotos(eleicaoId));
      if (r.tipo === 'aguardando_vice') {
        const ids = new Set(r.empatadosVice.map((c) => c.candidaturaId));
        empatadosVice = ranking.filter((c) => ids.has(c.candidaturaId));
      }
    }
    const totalVotos = ranking.reduce((s, c) => s + c.votos, 0);
    const totalPresencas = this.db.get<{ n: number }>('SELECT COUNT(*) n FROM presenca WHERE eleicao_id = ?', eleicaoId)!.n;
    return {
      eleicaoId,
      titulo: e.titulo,
      status: e.status,
      ranking,
      totalVotos,
      totalPresencas,
      presidente: pessoa(e.presidente_eleito_id),
      criterioPresidente: e.criterio_presidente,
      vice: pessoa(e.vice_eleito_id),
      criterioVice: e.criterio_vice,
      empatadosVice,
      apuradaEm: e.apurada_em,
      meuPapel: this.eleicoes.papel(e, u),
    };
  }
}
