import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UsuarioLogado } from '../auth/auth';
import { DatabaseService } from '../db/database.service';
import { aptidao, CIDADES, cpfValido, limparCpf, mascararCpf, normalizarData } from '../common/regras';

export interface DadosMembro {
  nome: string;
  cpf: string;
  dataNascimento: string;
  dataEntrada: string;
  dataColeteamento?: string | null;
  dataFechamento?: string | null;
  cidade: string;
}

export interface MembroRow {
  id: number;
  nome: string;
  cpf: string;
  data_nascimento: string;
  data_entrada: string;
  data_coleteamento: string | null;
  data_fechamento: string | null;
  cidade: string;
  uf: string;
  habilitado: number;
  ativo: number;
}

@Injectable()
export class MembrosService {
  constructor(private readonly db: DatabaseService) {}

  /** Converte a linha do banco para o formato da API. */
  paraApi(m: MembroRow, cpfCompleto = false) {
    const a = aptidao(m);
    return {
      id: m.id,
      nome: m.nome,
      cpf: cpfCompleto ? m.cpf : mascararCpf(m.cpf),
      dataNascimento: m.data_nascimento,
      dataEntrada: m.data_entrada,
      dataColeteamento: m.data_coleteamento,
      dataFechamento: m.data_fechamento,
      cidade: m.cidade,
      uf: m.uf,
      habilitado: !!m.habilitado,
      ativo: !!m.ativo,
      apto: a.apto,
      motivoInapto: a.motivo,
    };
  }

  listar(filtros: { busca?: string; cidade?: string; apto?: string; inativos?: string }) {
    const membros = this.db.all<MembroRow>('SELECT * FROM membro ORDER BY nome COLLATE NOCASE');
    const busca = (filtros.busca ?? '').trim().toLowerCase();
    const buscaCpf = limparCpf(busca);
    return membros
      .filter((m) => filtros.inativos === 'true' || m.ativo)
      .filter((m) => !filtros.cidade || m.cidade === filtros.cidade)
      .filter((m) => !busca || m.nome.toLowerCase().includes(busca) || (buscaCpf.length >= 3 && m.cpf.includes(buscaCpf)))
      .map((m) => this.paraApi(m))
      .filter((m) => !filtros.apto || String(m.apto) === filtros.apto);
  }

  buscar(id: number): MembroRow {
    const m = this.db.get<MembroRow>('SELECT * FROM membro WHERE id = ?', id);
    if (!m) throw new NotFoundException('Membro não encontrado.');
    return m;
  }

  /** Valida e normaliza os dados. Lança BadRequest com mensagens em português. */
  validar(d: DadosMembro, idAtual?: number) {
    const erros: string[] = [];
    const nome = (d.nome ?? '').trim().replace(/\s+/g, ' ');
    if (nome.length < 3) erros.push('Nome é obrigatório.');

    const cpf = limparCpf(d.cpf);
    if (!cpfValido(cpf)) erros.push('CPF inválido.');
    else {
      const outro = this.db.get<{ id: number }>('SELECT id FROM membro WHERE cpf = ?', cpf);
      if (outro && outro.id !== idAtual) erros.push('Já existe um membro com esse CPF.');
    }

    const datas: Record<string, string | null | undefined> = {
      dataNascimento: normalizarData(d.dataNascimento),
      dataEntrada: normalizarData(d.dataEntrada),
      dataColeteamento: normalizarData(d.dataColeteamento),
      dataFechamento: normalizarData(d.dataFechamento),
    };
    const rotulos: Record<string, string> = {
      dataNascimento: 'Data de nascimento',
      dataEntrada: 'Data de entrada',
      dataColeteamento: 'Data de coleteamento',
      dataFechamento: 'Data de fechamento',
    };
    for (const [k, v] of Object.entries(datas)) if (v === undefined) erros.push(`${rotulos[k]} inválida.`);
    if (datas.dataNascimento === null) erros.push('Data de nascimento é obrigatória.');
    if (datas.dataEntrada === null) erros.push('Data de entrada é obrigatória.');

    const { dataEntrada: ent, dataColeteamento: col, dataFechamento: fec, dataNascimento: nasc } = datas;
    if (fec && !col) erros.push('Não é possível ter data de fechamento sem data de coleteamento.');
    if (col && ent && col < ent) erros.push('O coleteamento não pode ser anterior à entrada.');
    if (fec && col && fec < col) erros.push('O fechamento não pode ser anterior ao coleteamento.');
    if (nasc && ent && ent < nasc) erros.push('A entrada não pode ser anterior ao nascimento.');
    const hoje = new Date().toISOString().slice(0, 10);
    for (const [k, v] of Object.entries(datas)) if (v && v > hoje) erros.push(`${rotulos[k]} não pode ser futura.`);

    const uf = CIDADES[d.cidade];
    if (!uf) erros.push('Cidade inválida. Use Cascavel, Toledo, Nova Santa Rosa, Marechal Cândido Rondon ou Vilhena.');

    if (erros.length) throw new BadRequestException(erros);
    return {
      nome,
      cpf,
      dataNascimento: nasc!,
      dataEntrada: ent!,
      dataColeteamento: col ?? null,
      dataFechamento: fec ?? null,
      cidade: d.cidade,
      uf: uf!, // UF sempre derivada da cidade, em maiúsculo
    };
  }

  criar(d: DadosMembro) {
    const v = this.validar(d);
    const r = this.db.run(
      `INSERT INTO membro (nome, cpf, data_nascimento, data_entrada, data_coleteamento, data_fechamento, cidade, uf)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      v.nome, v.cpf, v.dataNascimento, v.dataEntrada, v.dataColeteamento, v.dataFechamento, v.cidade, v.uf,
    );
    return this.paraApi(this.buscar(Number(r.lastInsertRowid)), true);
  }

  atualizar(id: number, d: DadosMembro) {
    this.buscar(id);
    const v = this.validar(d, id);
    this.db.run(
      `UPDATE membro SET nome=?, cpf=?, data_nascimento=?, data_entrada=?, data_coleteamento=?, data_fechamento=?,
              cidade=?, uf=?, atualizado_em=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?`,
      v.nome, v.cpf, v.dataNascimento, v.dataEntrada, v.dataColeteamento, v.dataFechamento, v.cidade, v.uf, id,
    );
    return this.paraApi(this.buscar(id), true);
  }

  /** Admin, ou moderador de eleição de uma eleição ainda não encerrada. */
  podeAlterarHabilitacao(u: UsuarioLogado): boolean {
    if (u.perfil === 'ADMIN') return true;
    if (!u.membroId) return false;
    return !!this.db.get(
      `SELECT 1 FROM eleicao WHERE presidente_sessao_id = ? AND status IN ('rascunho','agendada','aberta')`,
      u.membroId,
    );
  }

  alterarHabilitacao(id: number, habilitado: boolean, motivo: string, u: UsuarioLogado) {
    if (!this.podeAlterarHabilitacao(u)) {
      throw new ForbiddenException('Apenas o administrador ou o moderador de eleição podem alterar a habilitação.');
    }
    if (!motivo?.trim()) throw new BadRequestException('Informe o motivo.');
    const m = this.buscar(id);
    if (!!m.habilitado === habilitado) return this.paraApi(m);
    this.db.tx(() => {
      this.db.run('UPDATE membro SET habilitado = ? WHERE id = ?', habilitado ? 1 : 0, id);
      this.db.run(
        'INSERT INTO historico_habilitacao (membro_id, habilitado, motivo, alterado_por) VALUES (?, ?, ?, ?)',
        id, habilitado ? 1 : 0, motivo.trim(), u.nome,
      );
    });
    return this.paraApi(this.buscar(id));
  }

  historico(id: number) {
    return this.db.all(
      `SELECT habilitado, motivo, alterado_por AS alteradoPor, alterado_em AS alteradoEm
         FROM historico_habilitacao WHERE membro_id = ? ORDER BY alterado_em DESC, id DESC`,
      id,
    ).map((h: any) => ({ ...h, habilitado: !!h.habilitado }));
  }

  /** Apaga se nunca participou de eleição; caso contrário, inativa. */
  remover(id: number) {
    this.buscar(id);
    const participou = this.db.get(
      `SELECT 1 FROM presenca WHERE membro_id = ?1 UNION SELECT 1 FROM candidatura WHERE membro_id = ?1
       UNION SELECT 1 FROM eleicao_mesario WHERE membro_id = ?1 UNION SELECT 1 FROM apto_eleicao WHERE membro_id = ?1
       UNION SELECT 1 FROM eleicao WHERE presidente_sessao_id = ?1 UNION SELECT 1 FROM usuario WHERE membro_id = ?1
       UNION SELECT 1 FROM historico_habilitacao WHERE membro_id = ?1`,
      id,
    );
    if (participou) {
      this.db.run('UPDATE membro SET ativo = 0 WHERE id = ?', id);
      return { acao: 'inativado' };
    }
    this.db.run('DELETE FROM membro WHERE id = ?', id);
    return { acao: 'apagado' };
  }

  reativar(id: number) {
    this.buscar(id);
    this.db.run('UPDATE membro SET ativo = 1 WHERE id = ?', id);
    return this.paraApi(this.buscar(id));
  }

  /**
   * Importa CSV com cabeçalho:
   * nome;cpf;data_nascimento;data_entrada;data_coleteamento;data_fechamento;cidade
   * Separador ";" ou ","; datas DD/MM/AAAA ou AAAA-MM-DD.
   */
  importarCsv(texto: string) {
    const linhas = (texto ?? '').replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
    if (linhas.length < 2) throw new BadRequestException('O arquivo precisa de cabeçalho e ao menos uma linha.');
    const sep = linhas[0].includes(';') ? ';' : ',';
    const cab = linhas[0].split(sep).map((c) => c.trim().toLowerCase());
    const col = (nome: string) => cab.indexOf(nome);
    const obrig = ['nome', 'cpf', 'data_nascimento', 'data_entrada', 'cidade'];
    const faltando = obrig.filter((c) => col(c) < 0);
    if (faltando.length) throw new BadRequestException(`Colunas obrigatórias ausentes: ${faltando.join(', ')}`);

    const resultado = { criados: 0, erros: [] as { linha: number; erros: string[] }[] };
    linhas.slice(1).forEach((linha, i) => {
      const c = linha.split(sep).map((x) => x.trim().replace(/^"|"$/g, ''));
      const pega = (n: string) => (col(n) >= 0 ? c[col(n)] : '');
      try {
        this.criar({
          nome: pega('nome'),
          cpf: pega('cpf'),
          dataNascimento: pega('data_nascimento'),
          dataEntrada: pega('data_entrada'),
          dataColeteamento: pega('data_coleteamento'),
          dataFechamento: pega('data_fechamento'),
          cidade: pega('cidade'),
        });
        resultado.criados++;
      } catch (e: any) {
        const msg = e?.response?.message ?? e.message;
        resultado.erros.push({ linha: i + 2, erros: Array.isArray(msg) ? msg : [msg] });
      }
    });
    return resultado;
  }
}
