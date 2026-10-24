import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { randomBytes, randomUUID } from 'crypto';
import { limparCpf } from '../common/regras';
import { DatabaseService } from '../db/database.service';
import { EleicoesService, EleicaoRow } from '../eleicoes/eleicoes.service';

/**
 * Votação online.
 *
 * Sigilo: a sessão de votação (que sabe qual membro está votando) vive só em
 * memória e é descartada ao votar. No banco, a presença e o voto são gravados
 * na mesma transação, em tabelas sem horário e sem ligação entre si.
 */

interface SessaoVotacao {
  eleicaoId: number;
  membroId: number;
  expiraEm: number;
}

const VALIDADE_SESSAO_MS = 10 * 60 * 1000;

@Injectable()
export class VotacaoService {
  private readonly sessoes = new Map<string, SessaoVotacao>();

  constructor(
    private readonly db: DatabaseService,
    private readonly eleicoes: EleicoesService,
  ) {}

  private eleicaoAberta(): EleicaoRow {
    this.eleicoes.atualizarStatusPorHorario();
    const e = this.db.get<EleicaoRow>(`SELECT * FROM eleicao WHERE status = 'aberta'`);
    if (!e) throw new BadRequestException('Não há votação aberta no momento.');
    return e;
  }

  /** Informações públicas para a tela de entrada. */
  situacao() {
    this.eleicoes.atualizarStatusPorHorario();
    const aberta = this.db.get<EleicaoRow>(`SELECT * FROM eleicao WHERE status = 'aberta'`);
    if (aberta) return { aberta: true, titulo: aberta.titulo, inicio: aberta.inicio, termino: aberta.termino, agora: new Date().toISOString() };
    const proxima = this.db.get<EleicaoRow>(`SELECT * FROM eleicao WHERE status = 'agendada' ORDER BY inicio LIMIT 1`);
    return {
      aberta: false,
      proxima: proxima ? { titulo: proxima.titulo, inicio: proxima.inicio, termino: proxima.termino } : null,
      agora: new Date().toISOString(),
    };
  }

  entrar(cpfDigitado: string) {
    const e = this.eleicaoAberta();
    const cpf = limparCpf(cpfDigitado);
    if (cpf.length !== 11) throw new BadRequestException('Informe o CPF completo, com 11 dígitos.');
    const cred = this.db.get<any>(
      `SELECT a.membro_id, m.nome, m.habilitado, m.ativo FROM apto_eleicao a JOIN membro m ON m.id = a.membro_id
        WHERE a.eleicao_id = ? AND m.cpf = ?`,
      e.id,
      cpf,
    );
    if (!cred) throw new UnauthorizedException('CPF não encontrado na lista de aptos desta eleição. Procure a mesa.');

    if (!cred.ativo || !cred.habilitado) {
      throw new BadRequestException('Seu cadastro está desabilitado para votar. Procure a mesa.');
    }
    if (this.db.get('SELECT 1 FROM presenca WHERE eleicao_id = ? AND membro_id = ?', e.id, cred.membro_id)) {
      throw new BadRequestException('Você já votou nesta eleição.');
    }

    this.limparExpiradas();
    // Uma sessão por membro: entrar de novo descarta a anterior.
    for (const [t, s] of this.sessoes) if (s.membroId === cred.membro_id && s.eleicaoId === e.id) this.sessoes.delete(t);
    const token = randomBytes(32).toString('base64url');
    this.sessoes.set(token, { eleicaoId: e.id, membroId: cred.membro_id, expiraEm: Date.now() + VALIDADE_SESSAO_MS });
    return { token, nome: cred.nome.split(' ')[0], validoAte: new Date(Date.now() + VALIDADE_SESSAO_MS).toISOString() };
  }

  private sessao(token: string | undefined): SessaoVotacao {
    const s = token ? this.sessoes.get(token) : undefined;
    if (!s || s.expiraEm < Date.now()) {
      if (token) this.sessoes.delete(token);
      throw new UnauthorizedException('Sua sessão de votação expirou. Entre de novo com o seu CPF.');
    }
    return s;
  }

  cedula(token: string | undefined) {
    const s = this.sessao(token);
    const e = this.eleicaoAberta();
    if (e.id !== s.eleicaoId) throw new BadRequestException('Esta eleição não está mais aberta.');
    const candidatos = this.db.all<any>(
      `SELECT c.id, m.nome, c.apelido, m.cidade, m.uf FROM candidatura c JOIN membro m ON m.id = c.membro_id
        WHERE c.eleicao_id = ? AND c.situacao = 'deferida' ORDER BY m.nome COLLATE NOCASE`,
      e.id,
    );
    return { titulo: e.titulo, termino: e.termino, candidatos };
  }

  votar(token: string | undefined, candidaturaId: number) {
    const s = this.sessao(token);
    const e = this.eleicaoAberta();
    if (e.id !== s.eleicaoId || new Date() >= new Date(e.termino)) {
      throw new BadRequestException('A votação foi encerrada.');
    }
    const cand = this.db.get(
      `SELECT 1 FROM candidatura WHERE id = ? AND eleicao_id = ? AND situacao = 'deferida'`,
      candidaturaId,
      e.id,
    );
    if (!cand) throw new BadRequestException('Candidato inválido.');
    const membro = this.db.get<any>('SELECT habilitado, ativo FROM membro WHERE id = ?', s.membroId);
    if (!membro?.habilitado || !membro?.ativo) {
      throw new BadRequestException('Seu cadastro foi desabilitado para votar. Procure a mesa.');
    }

    try {
      this.db.tx(() => {
        // Presença e voto na mesma transação; nenhum dos dois tem horário.
        this.db.run('INSERT INTO presenca (eleicao_id, membro_id) VALUES (?, ?)', e.id, s.membroId);
        this.db.run('INSERT INTO voto (id, eleicao_id, candidatura_id) VALUES (?, ?, ?)', randomUUID(), e.id, candidaturaId);
      });
    } catch (err: any) {
      if (String(err?.code).startsWith('SQLITE_CONSTRAINT')) {
        throw new BadRequestException('Você já votou nesta eleição.');
      }
      throw err;
    } finally {
      this.sessoes.delete(token!);
    }
    return { ok: true };
  }

  private limparExpiradas() {
    const agora = Date.now();
    for (const [t, s] of this.sessoes) if (s.expiraEm < agora) this.sessoes.delete(t);
  }
}
