import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { UsuarioLogado } from '../auth/auth';
import { aptidao, dataHoraLocal, mascararCpf } from '../common/regras';
import { DatabaseService } from '../db/database.service';
import { MembroRow } from '../membros/membros.service';
import { ApuracaoService } from './apuracao.service';
import { EleicaoRow, EleicoesService } from './eleicoes.service';

type Coluna = { titulo: string; largura: number; alinhar?: 'left' | 'center' | 'right' };

const CRITERIO_PRESIDENTE: Record<string, string> = {
  votos: 'mais votado',
  idade: 'empate em votos; eleito o candidato mais velho, conforme o estatuto',
};
const CRITERIO_VICE: Record<string, string> = {
  votos: 'mais votado entre os candidatos de cidade diferente da do presidente',
  escolha_presidente: 'empate em votos; escolhido pelo presidente eleito, por prerrogativa do cargo',
  vago: 'cargo vago: nenhum candidato de cidade diferente da do presidente',
};

@Injectable()
export class RelatoriosService {
  constructor(
    private readonly db: DatabaseService,
    private readonly eleicoes: EleicoesService,
    private readonly apuracao: ApuracaoService,
  ) {}

  private permitir(e: EleicaoRow, u: UsuarioLogado) {
    const p = this.eleicoes.papel(e, u);
    if (p !== 'admin' && p !== 'presidente') {
      throw new ForbiddenException('Apenas o moderador de eleição ou o administrador podem emitir os PDFs.');
    }
  }

  private novoDoc(): PDFKit.PDFDocument {
    return new PDFDocument({ size: 'A4', margin: 48, bufferPages: true, info: { Producer: 'Makários Votação' } });
  }

  private cabecalho(doc: PDFKit.PDFDocument, e: EleicaoRow, subtitulo: string) {
    const ps = e.presidente_sessao_id ? this.db.get<any>('SELECT nome FROM membro WHERE id = ?', e.presidente_sessao_id) : null;
    const mesarios = this.db
      .all<any>(
        `SELECT m.nome FROM eleicao_mesario em JOIN membro m ON m.id = em.membro_id WHERE em.eleicao_id = ? ORDER BY m.nome`,
        e.id,
      )
      .map((m) => m.nome);
    doc.font('Helvetica-Bold').fontSize(16).text('MOTOCLUBE MAKÁRIOS', { align: 'center' });
    doc.fontSize(12).text(subtitulo, { align: 'center' });
    doc.moveDown(0.6);
    doc.font('Helvetica').fontSize(10);
    doc.text(`Eleição: ${e.titulo}`);
    doc.text(`Votação online de ${dataHoraLocal(e.inicio)} até ${dataHoraLocal(e.termino)}`);
    doc.text(`Moderador de eleição: ${ps?.nome ?? '—'}`);
    doc.text(`Mesários: ${mesarios.length ? mesarios.join(', ') : 'nenhum'}`);
    doc.moveDown(0.8);
    return { ps: ps?.nome as string | undefined, mesarios };
  }

  private tabela(doc: PDFKit.PDFDocument, colunas: Coluna[], linhas: string[][]) {
    const x0 = doc.page.margins.left;
    const altura = 18;
    const desenharCabecalho = () => {
      let x = x0;
      const y = doc.y;
      doc.rect(x0, y, colunas.reduce((s, c) => s + c.largura, 0), altura).fill('#1f1f1f');
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9);
      for (const c of colunas) {
        doc.text(c.titulo, x + 4, y + 5, { width: c.largura - 8, align: c.alinhar ?? 'left' });
        x += c.largura;
      }
      doc.fillColor('#000000').font('Helvetica').fontSize(9);
      doc.y = y + altura;
    };
    desenharCabecalho();
    linhas.forEach((l, i) => {
      if (doc.y + altura > doc.page.height - doc.page.margins.bottom - 20) {
        doc.addPage();
        desenharCabecalho();
      }
      const y = doc.y;
      if (i % 2 === 1) doc.rect(x0, y, colunas.reduce((s, c) => s + c.largura, 0), altura).fill('#f1f1f1').fillColor('#000');
      let x = x0;
      colunas.forEach((c, j) => {
        doc.text(l[j] ?? '', x + 4, y + 5, { width: c.largura - 8, align: c.alinhar ?? 'left', lineBreak: false, ellipsis: true });
        x += c.largura;
      });
      doc.y = y + altura;
    });
    doc.x = x0;
    doc.moveDown(0.8);
  }

  private assinaturas(doc: PDFKit.PDFDocument, nomes: { nome: string; funcao: string }[]) {
    doc.moveDown(1.5);
    const x0 = doc.page.margins.left;
    const larg = 230;
    nomes.forEach((n, i) => {
      if (doc.y + 60 > doc.page.height - doc.page.margins.bottom) doc.addPage();
      const col = i % 2;
      const x = x0 + col * (larg + 35);
      const y = doc.y + 30;
      doc.moveTo(x, y).lineTo(x + larg, y).stroke();
      doc.fontSize(9).text(n.nome, x, y + 4, { width: larg, align: 'center' });
      doc.fillColor('#555').text(n.funcao, x, y + 16, { width: larg, align: 'center' }).fillColor('#000');
      if (col === 1 || i === nomes.length - 1) doc.y = y + 30;
      else doc.y = y - 30;
    });
    doc.x = x0;
  }

  private rodapePaginas(doc: PDFKit.PDFDocument) {
    const faixa = doc.bufferedPageRange();
    for (let i = 0; i < faixa.count; i++) {
      doc.switchToPage(faixa.start + i);
      // Zera a margem inferior enquanto escreve o rodapé, senão o PDFKit cria uma página nova.
      const margemInferior = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      const y = doc.page.height - margemInferior + 16;
      doc.fontSize(8).fillColor('#777').text(
        `Emitido em ${dataHoraLocal(new Date())} — página ${i + 1} de ${faixa.count}`,
        doc.page.margins.left,
        y,
        { width: doc.page.width - doc.page.margins.left - doc.page.margins.right, align: 'center', lineBreak: false },
      );
      doc.text(
        'Sistema Eleitoral desenvolvido por Moisés Pedro Weizemann Ribeiro',
        doc.page.margins.left,
        y + 11,
        { width: doc.page.width - doc.page.margins.left - doc.page.margins.right, align: 'center', lineBreak: false },
      );
      doc.fillColor('#000');
      doc.page.margins.bottom = margemInferior;
    }
  }

  private finalizar(doc: PDFKit.PDFDocument): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const partes: Buffer[] = [];
      doc.on('data', (p) => partes.push(p));
      doc.on('end', () => resolve(Buffer.concat(partes)));
      doc.on('error', reject);
      this.rodapePaginas(doc);
      doc.end();
    });
  }

  /** Lista de presença: só quem votou, em ordem alfabética, sem horário e sem voto. */
  async presenca(eleicaoId: number, u: UsuarioLogado): Promise<Buffer> {
    const e = this.eleicoes.buscarRow(eleicaoId);
    this.permitir(e, u);
    if (!['encerrada', 'aguardando_vice', 'apurada'].includes(e.status)) {
      throw new BadRequestException('A lista de presença só é emitida depois de encerrada a votação.');
    }
    const votantes = this.db.all<any>(
      `SELECT m.nome, m.cpf, m.cidade, m.uf FROM presenca p JOIN membro m ON m.id = p.membro_id
        WHERE p.eleicao_id = ? ORDER BY m.nome COLLATE NOCASE`,
      eleicaoId,
    );
    const naLista = new Set(
      this.db.all<any>('SELECT membro_id FROM apto_eleicao WHERE eleicao_id = ?', eleicaoId).map((r) => r.membro_id),
    );
    const membrosAtivos = this.db.all<MembroRow>('SELECT * FROM membro WHERE ativo = 1');
    const inaptos = { semColete: 0, desabilitado: 0, foraDaLista: 0 };
    for (const m of membrosAtivos) {
      if (naLista.has(m.id)) {
        if (!m.habilitado) inaptos.desabilitado++;
        continue;
      }
      const a = aptidao(m);
      if (!m.data_fechamento) inaptos.semColete++;
      else if (!m.habilitado) inaptos.desabilitado++;
      else if (a.apto) inaptos.foraDaLista++;
    }

    const doc = this.novoDoc();
    const { ps, mesarios } = this.cabecalho(doc, e, 'LISTA DE PRESENÇA NA VOTAÇÃO');
    this.tabela(
      doc,
      [
        { titulo: 'Nº', largura: 32, alinhar: 'right' },
        { titulo: 'Nome', largura: 222 },
        { titulo: 'CPF', largura: 95 },
        { titulo: 'Cidade/UF', largura: 150 },
      ],
      votantes.map((v, i) => [String(i + 1), v.nome, mascararCpf(v.cpf), `${v.cidade}/${v.uf}`]),
    );
    doc.font('Helvetica-Bold').fontSize(10).text(`Total de presenças: ${votantes.length}`);
    doc.font('Helvetica').text(`Total de aptos na lista da eleição: ${naLista.size}`);
    const totalInaptos = inaptos.semColete + inaptos.desabilitado + inaptos.foraDaLista;
    doc.text(
      `Total de inaptos: ${totalInaptos} (sem colete fechado: ${inaptos.semColete}; desabilitados pela mesa: ${inaptos.desabilitado}` +
        (inaptos.foraDaLista ? `; cadastro regularizado após o fechamento da lista: ${inaptos.foraDaLista}` : '') +
        ')',
    );
    doc.moveDown(0.5);
    doc.fontSize(8).fillColor('#555').text('Este documento registra apenas o comparecimento. O voto é secreto e não é vinculado a nenhum membro.').fillColor('#000');
    this.assinaturas(doc, [
      ...(ps ? [{ nome: ps, funcao: 'Moderador de eleição' }] : []),
      ...mesarios.map((nome) => ({ nome, funcao: 'Mesário' })),
    ]);
    return this.finalizar(doc);
  }

  /** Ata da apuração. */
  async ata(eleicaoId: number, u: UsuarioLogado): Promise<Buffer> {
    const e = this.eleicoes.buscarRow(eleicaoId);
    this.permitir(e, u);
    if (e.status !== 'apurada') throw new BadRequestException('A ata só é emitida depois da apuração concluída.');
    const r = this.apuracao.resultado(eleicaoId, u);
    const doc = this.novoDoc();
    const { ps, mesarios } = this.cabecalho(doc, e, 'ATA DA APURAÇÃO');
    this.tabela(
      doc,
      [
        { titulo: 'Pos.', largura: 38, alinhar: 'right' },
        { titulo: 'Candidato', largura: 170 },
        { titulo: 'Cidade/UF', largura: 150 },
        { titulo: 'Votos', largura: 50, alinhar: 'right' },
        { titulo: 'Resultado', largura: 91 },
      ],
      r.ranking.map((c: any) => [
        `${c.posicao}º`,
        c.apelido ? `${c.nome} (${c.apelido})` : c.nome,
        `${c.cidade}/${c.uf}`,
        String(c.votos),
        c.membroId === r.presidente?.membroId ? 'Presidente' : c.membroId === r.vice?.membroId ? 'Vice-presidente' : '—',
      ]),
    );
    doc.font('Helvetica').fontSize(10).text(`Total de votos: ${r.totalVotos}    Total de presenças: ${r.totalPresencas}`);
    doc.moveDown(0.8);
    doc.font('Helvetica-Bold').text(`Presidente eleito: ${r.presidente?.nome ?? '—'} (${r.presidente?.cidade ?? ''}/${r.presidente?.uf ?? ''})`);
    doc.font('Helvetica').text(`Critério: ${CRITERIO_PRESIDENTE[r.criterioPresidente ?? ''] ?? '—'}.`);
    doc.moveDown(0.4);
    doc.font('Helvetica-Bold').text(r.vice ? `Vice-presidente eleito: ${r.vice.nome} (${r.vice.cidade}/${r.vice.uf})` : 'Vice-presidente: vago');
    doc.font('Helvetica').text(`Critério: ${CRITERIO_VICE[r.criterioVice ?? ''] ?? '—'}.`);
    doc.moveDown(0.6);
    doc.fontSize(9).fillColor('#555').text(
      'Regra aplicada: o mais votado é eleito presidente; é eleito vice-presidente o candidato mais votado cuja cidade seja diferente da cidade do presidente.',
    ).fillColor('#000');
    doc.text(`Apuração concluída em ${r.apuradaEm ? dataHoraLocal(r.apuradaEm) : '—'}.`);
    this.assinaturas(doc, [
      ...(ps ? [{ nome: ps, funcao: 'Moderador de eleição' }] : []),
      ...mesarios.map((nome) => ({ nome, funcao: 'Mesário' })),
      ...(r.presidente ? [{ nome: r.presidente.nome, funcao: 'Presidente eleito' }] : []),
    ]);
    return this.finalizar(doc);
  }
}
