import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { UsuarioLogado } from '../auth/auth';
import { aptidao, temTempoDeColete } from '../common/regras';
import { DatabaseService } from '../db/database.service';
import { MembroRow } from '../membros/membros.service';

export type StatusEleicao = 'rascunho' | 'agendada' | 'aberta' | 'encerrada' | 'aguardando_vice' | 'apurada';

export interface EleicaoRow {
  id: number;
  titulo: string;
  inicio: string;
  termino: string;
  status: StatusEleicao;
  presidente_sessao_id: number | null;
  presidente_eleito_id: number | null;
  vice_eleito_id: number | null;
  criterio_presidente: string | null;
  criterio_vice: string | null;
  apurada_em: string | null;
}

export interface DadosEleicao {
  titulo: string;
  inicio: string;
  termino: string;
  presidenteSessaoId?: number | null;
  mesarioIds?: number[];
}

export type Papel = 'admin' | 'presidente' | 'mesario';

const EDITAVEL: StatusEleicao[] = ['rascunho', 'agendada'];

@Injectable()
export class EleicoesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Eleições');
  private relogio?: NodeJS.Timeout;

  constructor(private readonly db: DatabaseService) {}

  // ------------------------------------------------------------ relógio
  // Abre e encerra eleições automaticamente nos horários cadastrados.

  onModuleInit() {
    this.atualizarStatusPorHorario();
    this.relogio = setInterval(() => this.atualizarStatusPorHorario(), 5_000);
  }

  onModuleDestroy() {
    if (this.relogio) clearInterval(this.relogio);
  }

  atualizarStatusPorHorario(agora = new Date()) {
    const iso = agora.toISOString();
    const fechar = this.db.all<EleicaoRow>(`SELECT * FROM eleicao WHERE status = 'aberta' AND termino <= ?`, iso);
    for (const e of fechar) {
      this.db.run(`UPDATE eleicao SET status = 'encerrada' WHERE id = ? AND status = 'aberta'`, e.id);
      this.logger.log(`Eleição ${e.id} encerrada pelo horário`);
    }
    const abrir = this.db.all<EleicaoRow>(
      `SELECT * FROM eleicao WHERE status = 'agendada' AND inicio <= ? AND termino > ? ORDER BY inicio`,
      iso,
      iso,
    );
    for (const e of abrir) {
      if (this.db.get(`SELECT 1 FROM eleicao WHERE status = 'aberta'`)) {
        this.logger.warn(`Eleição ${e.id} não abriu: já há outra eleição aberta`);
        continue;
      }
      this.db.run(`UPDATE eleicao SET status = 'aberta' WHERE id = ? AND status = 'agendada'`, e.id);
      this.logger.log(`Eleição ${e.id} aberta pelo horário`);
    }
  }

  // ------------------------------------------------------------ consultas

  buscarRow(id: number): EleicaoRow {
    this.atualizarStatusPorHorario();
    const e = this.db.get<EleicaoRow>('SELECT * FROM eleicao WHERE id = ?', id);
    if (!e) throw new NotFoundException('Eleição não encontrada.');
    return e;
  }

  mesarioIds(eleicaoId: number): number[] {
    return this.db
      .all<{ membro_id: number }>('SELECT membro_id FROM eleicao_mesario WHERE eleicao_id = ?', eleicaoId)
      .map((r) => r.membro_id);
  }

  papel(e: EleicaoRow, u: UsuarioLogado): Papel | null {
    if (u.perfil === 'ADMIN') return 'admin';
    if (!u.membroId) return null;
    if (e.presidente_sessao_id === u.membroId) return 'presidente';
    if (this.mesarioIds(e.id).includes(u.membroId)) return 'mesario';
    return null;
  }

  /** Exige que o usuário seja o presidente de sessão (ou, se `admin` true, também admin). */
  exigirPresidente(e: EleicaoRow, u: UsuarioLogado, aceitaAdmin = false) {
    const p = this.papel(e, u);
    if (p === 'presidente' || (aceitaAdmin && p === 'admin')) return;
    throw new ForbiddenException('Apenas o presidente de sessão desta eleição pode fazer isso.');
  }

  exigirMesa(e: EleicaoRow, u: UsuarioLogado) {
    const p = this.papel(e, u);
    if (p === 'presidente' || p === 'mesario' || p === 'admin') return;
    throw new ForbiddenException('Apenas a mesa desta eleição pode fazer isso.');
  }

  listar(u: UsuarioLogado) {
    this.atualizarStatusPorHorario();
    const todas = this.db.all<any>(
      `SELECT e.*, ps.nome AS presidente_sessao_nome,
              (SELECT COUNT(*) FROM candidatura c WHERE c.eleicao_id = e.id AND c.situacao = 'deferida') AS candidatos
         FROM eleicao e LEFT JOIN membro ps ON ps.id = e.presidente_sessao_id
        ORDER BY e.inicio DESC`,
    );
    return todas
      .filter((e) => u.perfil === 'ADMIN' || this.papel(e, u))
      .map((e) => ({
        id: e.id,
        titulo: e.titulo,
        inicio: e.inicio,
        termino: e.termino,
        status: e.status,
        presidenteSessao: e.presidente_sessao_nome,
        candidatos: e.candidatos,
        meuPapel: this.papel(e, u),
      }));
  }

  detalhe(id: number, u: UsuarioLogado) {
    const e = this.buscarRow(id);
    const papel = this.papel(e, u);
    if (!papel) throw new ForbiddenException('Você não participa da mesa desta eleição.');
    const membro = (mid: number | null) =>
      mid ? this.db.get<any>('SELECT id, nome, cidade, uf FROM membro WHERE id = ?', mid) ?? null : null;
    const mesarios = this.db.all<any>(
      `SELECT m.id, m.nome, m.cidade, m.uf FROM eleicao_mesario em JOIN membro m ON m.id = em.membro_id
        WHERE em.eleicao_id = ? ORDER BY m.nome`,
      id,
    );
    const candidaturas = this.db.all<any>(
      `SELECT c.id, c.membro_id AS membroId, m.nome, c.apelido, m.cidade, m.uf, c.situacao, c.motivo
         FROM candidatura c JOIN membro m ON m.id = c.membro_id WHERE c.eleicao_id = ?
        ORDER BY c.situacao, m.nome`,
      id,
    );
    const aptosNaLista = this.db.get<{ n: number }>('SELECT COUNT(*) n FROM apto_eleicao WHERE eleicao_id = ?', id)!.n;
    return {
      id: e.id,
      titulo: e.titulo,
      inicio: e.inicio,
      termino: e.termino,
      status: e.status,
      presidenteSessao: membro(e.presidente_sessao_id),
      mesarios,
      candidaturas,
      aptosNaLista,
      meuPapel: papel,
    };
  }

  // ------------------------------------------------------------ criação e edição

  private validarDados(d: DadosEleicao) {
    const erros: string[] = [];
    if (!d.titulo?.trim()) erros.push('Título é obrigatório.');
    const ini = new Date(d.inicio);
    const fim = new Date(d.termino);
    if (isNaN(ini.getTime())) erros.push('Data/hora de início inválida.');
    if (isNaN(fim.getTime())) erros.push('Data/hora de término inválida.');
    if (!isNaN(ini.getTime()) && !isNaN(fim.getTime()) && fim <= ini) erros.push('O término precisa ser depois do início.');
    if (erros.length) throw new BadRequestException(erros);
    return { titulo: d.titulo.trim(), inicio: ini.toISOString(), termino: fim.toISOString() };
  }

  /** Valida a mesa: membros ativos, sem repetição e sem candidatura deferida. */
  private validarMesa(eleicaoId: number | null, presidenteId: number | null | undefined, mesarioIds: number[]) {
    const ids = [...(presidenteId ? [presidenteId] : []), ...mesarioIds];
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('Um membro não pode ocupar duas funções na mesa.');
    }
    for (const mid of ids) {
      const m = this.db.get<MembroRow>('SELECT * FROM membro WHERE id = ?', mid);
      if (!m) throw new BadRequestException(`Membro ${mid} não encontrado.`);
      if (!m.ativo) throw new BadRequestException(`${m.nome} está inativo.`);
      if (eleicaoId) {
        const cand = this.db.get(
          `SELECT 1 FROM candidatura WHERE eleicao_id = ? AND membro_id = ? AND situacao = 'deferida'`,
          eleicaoId,
          mid,
        );
        if (cand) {
          throw new BadRequestException(
            `${m.nome} é candidato nesta eleição e por isso não pode compor a mesa. Remova a candidatura antes.`,
          );
        }
      }
    }
  }

  criar(d: DadosEleicao) {
    const v = this.validarDados(d);
    const mesarios = [...new Set(d.mesarioIds ?? [])];
    this.validarMesa(null, d.presidenteSessaoId, mesarios);
    return this.db.tx(() => {
      const r = this.db.run(
        'INSERT INTO eleicao (titulo, inicio, termino, presidente_sessao_id) VALUES (?, ?, ?, ?)',
        v.titulo,
        v.inicio,
        v.termino,
        d.presidenteSessaoId ?? null,
      );
      const id = Number(r.lastInsertRowid);
      for (const mid of mesarios) this.db.run('INSERT INTO eleicao_mesario VALUES (?, ?)', id, mid);
      return { id };
    });
  }

  atualizar(id: number, d: DadosEleicao) {
    const e = this.buscarRow(id);
    if (!EDITAVEL.includes(e.status)) {
      throw new BadRequestException('A eleição só pode ser editada em Rascunho ou Agendada.');
    }
    const v = this.validarDados(d);
    if (e.status === 'agendada' && v.inicio !== e.inicio) {
      throw new BadRequestException('Para mudar o horário de início, volte a eleição para Rascunho.');
    }
    const mesarios = [...new Set(d.mesarioIds ?? [])];
    this.validarMesa(id, d.presidenteSessaoId, mesarios);
    this.db.tx(() => {
      this.db.run(
        'UPDATE eleicao SET titulo = ?, inicio = ?, termino = ?, presidente_sessao_id = ? WHERE id = ?',
        v.titulo,
        v.inicio,
        v.termino,
        d.presidenteSessaoId ?? null,
        id,
      );
      this.db.run('DELETE FROM eleicao_mesario WHERE eleicao_id = ?', id);
      for (const mid of mesarios) this.db.run('INSERT INTO eleicao_mesario VALUES (?, ?)', id, mid);
      if (v.inicio !== e.inicio) this.reavaliarCandidaturas(id);
    });
    return { ok: true };
  }

  excluir(id: number) {
    const e = this.buscarRow(id);
    if (e.status !== 'rascunho') throw new BadRequestException('Só é possível excluir eleições em Rascunho.');
    this.db.run('DELETE FROM eleicao WHERE id = ?', id);
    return { ok: true };
  }

  // ------------------------------------------------------------ candidaturas

  /** Aplica as regras de deferimento. Retorna null se deferida, ou o motivo. */
  motivoIndeferimento(e: EleicaoRow, m: MembroRow): string | null {
    const motivos: string[] = [];
    if (!m.ativo) motivos.push('membro inativo');
    if (!m.data_fechamento) motivos.push('não tem colete fechado');
    else if (!temTempoDeColete(m.data_fechamento, e.inicio)) {
      motivos.push('não completa 3 anos de colete fechado até o início da eleição');
    }
    if (e.presidente_sessao_id === m.id) motivos.push('é o presidente de sessão');
    if (this.mesarioIds(e.id).includes(m.id)) motivos.push('é mesário desta eleição');
    if (!m.habilitado) motivos.push('está desabilitado (inadimplente)');
    if (!motivos.length) return null;
    const txt = motivos.join('; ');
    return txt.charAt(0).toUpperCase() + txt.slice(1) + '.';
  }

  registrarCandidatura(eleicaoId: number, membroId: number, apelido: string | undefined, u: UsuarioLogado) {
    const e = this.buscarRow(eleicaoId);
    this.exigirPresidente(e, u, true);
    if (!EDITAVEL.includes(e.status)) {
      throw new BadRequestException('Candidaturas só podem ser registradas com a eleição em Rascunho ou Agendada.');
    }
    const m = this.db.get<MembroRow>('SELECT * FROM membro WHERE id = ?', membroId);
    if (!m) throw new NotFoundException('Membro não encontrado.');
    if (this.db.get('SELECT 1 FROM candidatura WHERE eleicao_id = ? AND membro_id = ?', eleicaoId, membroId)) {
      throw new ConflictException(`${m.nome} já tem candidatura nesta eleição.`);
    }
    const motivo = this.motivoIndeferimento(e, m);
    const r = this.db.run(
      'INSERT INTO candidatura (eleicao_id, membro_id, apelido, situacao, motivo) VALUES (?, ?, ?, ?, ?)',
      eleicaoId,
      membroId,
      apelido?.trim() || null,
      motivo ? 'indeferida' : 'deferida',
      motivo,
    );
    return { id: Number(r.lastInsertRowid), nome: m.nome, situacao: motivo ? 'indeferida' : 'deferida', motivo };
  }

  removerCandidatura(eleicaoId: number, candidaturaId: number, u: UsuarioLogado) {
    const e = this.buscarRow(eleicaoId);
    this.exigirPresidente(e, u, true);
    if (!EDITAVEL.includes(e.status)) {
      throw new BadRequestException('Candidaturas ficam travadas depois que a eleição abre.');
    }
    this.db.run('DELETE FROM candidatura WHERE id = ? AND eleicao_id = ?', candidaturaId, eleicaoId);
    return { ok: true };
  }

  /** Recalcula deferimento de todas as candidaturas (ex.: após mudar a data de início). */
  reavaliarCandidaturas(eleicaoId: number) {
    const e = this.db.get<EleicaoRow>('SELECT * FROM eleicao WHERE id = ?', eleicaoId)!;
    const cands = this.db.all<any>('SELECT id, membro_id FROM candidatura WHERE eleicao_id = ?', eleicaoId);
    for (const c of cands) {
      const m = this.db.get<MembroRow>('SELECT * FROM membro WHERE id = ?', c.membro_id)!;
      const motivo = this.motivoIndeferimento(e, m);
      this.db.run(
        'UPDATE candidatura SET situacao = ?, motivo = ? WHERE id = ?',
        motivo ? 'indeferida' : 'deferida',
        motivo,
        c.id,
      );
    }
  }

  // ------------------------------------------------------------ ciclo de vida

  /** Rascunho → Agendada: fecha a lista de aptos. Na abertura, cada apto entra com o próprio CPF. */
  agendar(id: number) {
    const e = this.buscarRow(id);
    if (e.status !== 'rascunho') throw new BadRequestException('Só é possível agendar uma eleição em Rascunho.');
    this.reavaliarCandidaturas(id);
    const erros: string[] = [];
    if (!e.presidente_sessao_id) erros.push('Defina o presidente de sessão.');
    const deferidas = this.db.get<{ n: number }>(
      `SELECT COUNT(*) n FROM candidatura WHERE eleicao_id = ? AND situacao = 'deferida'`,
      id,
    )!.n;
    if (deferidas < 1) erros.push('Registre ao menos um candidato deferido.');
    if (new Date(e.termino) <= new Date()) erros.push('O horário de término já passou. Ajuste as datas.');
    const aptos = this.db.all<MembroRow>('SELECT * FROM membro ORDER BY nome COLLATE NOCASE').filter((m) => aptidao(m).apto);
    if (!aptos.length) erros.push('Não há membros aptos a votar.');
    if (erros.length) throw new BadRequestException(erros);

    this.db.tx(() => {
      this.db.run('DELETE FROM apto_eleicao WHERE eleicao_id = ?', id);
      for (const m of aptos) this.db.run('INSERT INTO apto_eleicao (eleicao_id, membro_id) VALUES (?, ?)', id, m.id);
      this.db.run(`UPDATE eleicao SET status = 'agendada' WHERE id = ?`, id);
    });
    this.atualizarStatusPorHorario();
    return { aptos: aptos.length };
  }

  /** Agendada → Rascunho: reabre a lista de aptos. */
  voltarParaRascunho(id: number) {
    const e = this.buscarRow(id);
    if (e.status !== 'agendada') throw new BadRequestException('Só é possível voltar para Rascunho uma eleição Agendada.');
    this.db.tx(() => {
      this.db.run('DELETE FROM apto_eleicao WHERE eleicao_id = ?', id);
      this.db.run(`UPDATE eleicao SET status = 'rascunho' WHERE id = ?`, id);
    });
    return { ok: true };
  }

  /** Inclui na lista um membro que ficou apto depois do agendamento. Só até a abertura. */
  incluirNaLista(id: number, membroId: number, u: UsuarioLogado) {
    const e = this.buscarRow(id);
    this.exigirMesa(e, u);
    if (e.status !== 'agendada') throw new BadRequestException('A lista de aptos só pode mudar com a eleição Agendada.');
    const m = this.db.get<MembroRow>('SELECT * FROM membro WHERE id = ?', membroId);
    if (!m) throw new NotFoundException('Membro não encontrado.');
    if (this.db.get('SELECT 1 FROM apto_eleicao WHERE eleicao_id = ? AND membro_id = ?', id, membroId)) {
      throw new BadRequestException(`${m.nome} já está na lista de aptos.`);
    }
    const a = aptidao(m);
    if (!a.apto) throw new BadRequestException(`${m.nome} não está apto: ${a.motivo}.`);
    this.db.run('INSERT INTO apto_eleicao (eleicao_id, membro_id) VALUES (?, ?)', id, membroId);
    return { membroId, nome: m.nome };
  }

  abrir(id: number, u: UsuarioLogado) {
    const e = this.buscarRow(id);
    this.exigirPresidente(e, u);
    if (e.status !== 'agendada') throw new BadRequestException('Só uma eleição Agendada pode ser aberta.');
    const agora = new Date();
    if (agora < new Date(e.inicio)) {
      throw new BadRequestException('Ainda não chegou a hora de início. A eleição abre sozinha no horário.');
    }
    if (agora >= new Date(e.termino)) throw new BadRequestException('O horário de término já passou.');
    if (this.db.get(`SELECT 1 FROM eleicao WHERE status = 'aberta'`)) {
      throw new BadRequestException('Já existe outra eleição aberta.');
    }
    this.db.run(`UPDATE eleicao SET status = 'aberta' WHERE id = ?`, id);
    return { ok: true };
  }

  encerrar(id: number, u: UsuarioLogado) {
    const e = this.buscarRow(id);
    this.exigirPresidente(e, u);
    if (e.status !== 'aberta') throw new BadRequestException('Só uma eleição Aberta pode ser encerrada.');
    const { faltam } = this.contagem(id);
    if (faltam.length > 0) {
      throw new BadRequestException(
        `Ainda faltam ${faltam.length} membro(s) aptos votarem. O encerramento antecipado só é permitido quando todos votaram; caso contrário, a eleição encerra sozinha no horário de término.`,
      );
    }
    this.db.run(`UPDATE eleicao SET status = 'encerrada' WHERE id = ?`, id);
    return { ok: true };
  }

  // ------------------------------------------------------------ painel da mesa

  contagem(id: number) {
    const aptos = this.db.all<any>(
      `SELECT m.id, m.nome, m.cidade, m.uf, m.habilitado, m.ativo,
              EXISTS (SELECT 1 FROM presenca p WHERE p.eleicao_id = c.eleicao_id AND p.membro_id = m.id) AS votou
         FROM apto_eleicao c JOIN membro m ON m.id = c.membro_id
        WHERE c.eleicao_id = ? ORDER BY m.nome COLLATE NOCASE`,
      id,
    );
    const votaram = this.db.get<{ n: number }>('SELECT COUNT(*) n FROM presenca WHERE eleicao_id = ?', id)!.n;
    // Desabilitados durante a eleição não contam como "faltando".
    const ativos = aptos.filter((a) => a.habilitado && a.ativo);
    const faltam = ativos.filter((a) => !a.votou).map(({ id, nome, cidade, uf }) => ({ id, nome, cidade, uf }));
    return { totalAptos: ativos.length + aptos.filter((a) => a.votou && !(a.habilitado && a.ativo)).length, votaram, faltam };
  }

  painel(id: number, u: UsuarioLogado) {
    const e = this.buscarRow(id);
    this.exigirMesa(e, u);
    const c = this.contagem(id);
    return {
      id: e.id,
      titulo: e.titulo,
      status: e.status,
      inicio: e.inicio,
      termino: e.termino,
      agora: new Date().toISOString(),
      totalAptos: c.totalAptos,
      votaram: c.votaram,
      faltam: c.faltam,
      presidenteSessao: e.presidente_sessao_id
        ? (this.db.get<{ nome: string }>('SELECT nome FROM membro WHERE id = ?', e.presidente_sessao_id)?.nome ?? null)
        : null,
      meuPapel: this.papel(e, u),
    };
  }
}
