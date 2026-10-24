/**
 * Teste de ponta a ponta: cadastro → eleição → candidaturas → votação online → apuração → PDFs.
 * Usa banco em memória.
 */
process.env.DATABASE_FILE = ':memory:';
process.env.ADMIN_SENHA = 'senha-admin';

import { BadRequestException, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/db/database.service';
import { EleicoesService } from '../src/eleicoes/eleicoes.service';
import { garantirAdmin } from '../src/seed';

/** Gera CPF válido a partir de 9 dígitos. */
function cpf(base9: string): string {
  const dv = (s: string, p: number) => {
    let t = 0;
    for (let i = 0; i < s.length; i++) t += Number(s[i]) * (p - i);
    const r = (t * 10) % 11;
    return r === 10 ? 0 : r;
  };
  const d1 = dv(base9, 10);
  const d2 = dv(base9 + d1, 11);
  return base9 + d1 + d2;
}

describe('Fluxo completo da eleição', () => {
  let app: INestApplication;
  let admin: ReturnType<typeof request.agent>;
  let presidenteSessao: ReturnType<typeof request.agent>;
  const ids: Record<string, number> = {};
  let eleicaoId: number;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        exceptionFactory: (e) => new BadRequestException(e.flatMap((x) => Object.values(x.constraints ?? {}))),
      }),
    );
    garantirAdmin(app);
    await app.init();
    app.get(EleicoesService).onModuleDestroy(); // desliga o relógio automático no teste
    admin = request.agent(app.getHttpServer());
    await admin.post('/api/auth/login').send({ login: 'admin', senha: 'senha-admin' }).expect(200);
  });

  afterAll(async () => app.close());

  const membros = [
    // chave, nome, cidade, nasc, coleteamento, fechamento
    ['a', 'Alberto Toledo', 'Toledo', '1975-05-10', '2015-01-01', '2016-01-01'],
    ['b', 'Bruno Toledo', 'Toledo', '1982-02-01', '2015-01-01', '2016-01-01'],
    ['c', 'Carlos Cascavel', 'Cascavel', '1979-07-07', '2015-01-01', '2016-01-01'],
    ['d', 'Diego Vilhena', 'Vilhena', '1985-03-03', '2015-01-01', '2016-01-01'],
    ['novo', 'Novato Rondon', 'Marechal Cândido Rondon', '1990-01-01', '2024-01-01', '2025-06-01'],
    ['semColete', 'Sem Colete', 'Nova Santa Rosa', '1990-01-01', null, null],
    ['ps', 'Paulo Sessão', 'Cascavel', '1970-01-01', '2010-01-01', '2011-01-01'],
    ['caloteiro', 'Caio Devedor', 'Toledo', '1988-01-01', '2015-01-01', '2016-01-01'],
  ] as const;

  it('cadastra membros com as regras de datas e UF', async () => {
    let n = 100000000;
    for (const [k, nome, cidade, nasc, col, fec] of membros) {
      const r = await admin
        .post('/api/membros')
        .send({ nome, cpf: cpf(String(n++)), cidade, dataNascimento: nasc, dataEntrada: '2009-01-01', dataColeteamento: col, dataFechamento: fec })
        .expect(201);
      ids[k] = r.body.id;
      expect(r.body.uf).toBe(cidade === 'Vilhena' ? 'RO' : 'PR');
    }
    // Fechamento sem coleteamento é recusado
    const r = await admin
      .post('/api/membros')
      .send({ nome: 'Errado', cpf: cpf('200000000'), cidade: 'Toledo', dataNascimento: '1990-01-01', dataEntrada: '2010-01-01', dataFechamento: '2012-01-01' })
      .expect(400);
    expect(r.body.message.join(' ')).toContain('sem data de coleteamento');

    const lista = (await admin.get('/api/membros').expect(200)).body;
    expect(lista.find((m: any) => m.id === ids.semColete).apto).toBe(false);
    expect(lista[0].cpf).toMatch(/\*\*\*/); // mascarado na listagem
  });

  it('desabilita inadimplente com histórico', async () => {
    await admin.patch(`/api/membros/${ids.caloteiro}/habilitacao`).send({ habilitado: false, motivo: 'Mensalidade em atraso' }).expect(200);
    const h = (await admin.get(`/api/membros/${ids.caloteiro}/historico`).expect(200)).body;
    expect(h[0].motivo).toBe('Mensalidade em atraso');
  });

  it('cria eleição, usuário do presidente de sessão e candidaturas', async () => {
    const agora = Date.now();
    const r = await admin
      .post('/api/eleicoes')
      .send({
        titulo: 'Eleição 2027–2029',
        inicio: new Date(agora - 60_000).toISOString(),
        termino: new Date(agora + 30 * 60_000).toISOString(),
        presidenteSessaoId: ids.ps,
      })
      .expect(201);
    eleicaoId = r.body.id;

    await admin.post('/api/usuarios').send({ login: 'paulo', senha: 'senha-paulo', perfil: 'MESA', membroId: ids.ps }).expect(201);
    presidenteSessao = request.agent(app.getHttpServer());
    await presidenteSessao.post('/api/auth/login').send({ login: 'paulo', senha: 'senha-paulo' }).expect(200);

    for (const k of ['a', 'b', 'c', 'd']) {
      const c = (await presidenteSessao.post(`/api/eleicoes/${eleicaoId}/candidaturas`).send({ membroId: ids[k] }).expect(201)).body;
      expect(c.situacao).toBe('deferida');
    }
    const novo = (await presidenteSessao.post(`/api/eleicoes/${eleicaoId}/candidaturas`).send({ membroId: ids.novo }).expect(201)).body;
    expect(novo.situacao).toBe('indeferida');
    expect(novo.motivo).toContain('3 anos');
    const ps = (await presidenteSessao.post(`/api/eleicoes/${eleicaoId}/candidaturas`).send({ membroId: ids.ps }).expect(201)).body;
    expect(ps.motivo).toContain('presidente de sessão');
    const cal = (await presidenteSessao.post(`/api/eleicoes/${eleicaoId}/candidaturas`).send({ membroId: ids.caloteiro }).expect(201)).body;
    expect(cal.motivo).toContain('desabilitado');
    await presidenteSessao.post(`/api/eleicoes/${eleicaoId}/candidaturas`).send({ membroId: ids.a }).expect(409);

    // Candidato deferido não pode entrar na mesa
    const e = (await admin.get(`/api/eleicoes/${eleicaoId}`)).body;
    await admin
      .put(`/api/eleicoes/${eleicaoId}`)
      .send({ titulo: e.titulo, inicio: e.inicio, termino: e.termino, presidenteSessaoId: ids.ps, mesarioIds: [ids.a] })
      .expect(400);
  });

  it('agenda (lista só os aptos) e abre pelo horário', async () => {
    const r = await admin.post(`/api/eleicoes/${eleicaoId}/agendar`).expect(201);
    expect(r.body.aptos).toBe(6); // a, b, c, d, novo, ps
    const db = app.get(DatabaseService);
    const naLista = db.all<any>('SELECT membro_id FROM apto_eleicao WHERE eleicao_id = ?', eleicaoId).map((x) => x.membro_id);
    expect(naLista).not.toContain(ids.semColete);
    expect(naLista).not.toContain(ids.caloteiro);
    app.get(EleicoesService).atualizarStatusPorHorario();
    expect((await admin.get(`/api/eleicoes/${eleicaoId}`)).body.status).toBe('aberta');
    // Resultado bloqueado com a eleição aberta
    await presidenteSessao.get(`/api/eleicoes/${eleicaoId}/resultado`).expect(400);
  });

  async function votar(membro: string, candidato: string) {
    const db = app.get(DatabaseService);
    const m = db.get<any>('SELECT cpf FROM membro WHERE id = ?', ids[membro]);
    const v = request(app.getHttpServer());
    const s = (await v.post('/api/votacao/entrar').send({ cpf: m.cpf }).expect(200)).body;
    const cedula = (await request(app.getHttpServer()).get('/api/votacao/cedula').set('x-sessao-votacao', s.token).expect(200)).body;
    const alvo = cedula.candidatos.find((c: any) => c.nome.startsWith(candidato));
    await request(app.getHttpServer())
      .post('/api/votacao/votar')
      .set('x-sessao-votacao', s.token)
      .send({ candidaturaId: alvo.id })
      .expect(200);
    return s.token;
  }

  it('vota online só com o CPF; não vota duas vezes; CPF fora da lista é recusado', async () => {
    const db = app.get(DatabaseService);
    const cpfA = db.get<any>('SELECT cpf FROM membro WHERE id = ?', ids.a).cpf;
    const cpfSemColete = db.get<any>('SELECT cpf FROM membro WHERE id = ?', ids.semColete).cpf;
    await request(app.getHttpServer()).post('/api/votacao/entrar').send({ cpf: cpfSemColete }).expect(401);
    await request(app.getHttpServer()).post('/api/votacao/entrar').send({ cpf: '123' }).expect(400);

    const tokenA = await votar('a', 'Alberto');
    // Sessão descartada após votar
    await request(app.getHttpServer()).get('/api/votacao/cedula').set('x-sessao-votacao', tokenA).expect(401);
    // Entrar de novo: já votou
    const r = await request(app.getHttpServer()).post('/api/votacao/entrar').send({ cpf: cpfA }).expect(400);
    expect(r.body.message).toContain('já votou');

    // Encerramento antecipado bloqueado enquanto faltam aptos
    await presidenteSessao.post(`/api/eleicoes/${eleicaoId}/encerrar`).expect(400);

    await votar('b', 'Alberto');
    await votar('c', 'Bruno');
    await votar('d', 'Carlos');
    await votar('novo', 'Diego');
    await votar('ps', 'Carlos');
    // Placar: Alberto 2 (Toledo), Bruno 1 (Toledo), Carlos 2 (Cascavel), Diego 1 (Vilhena)
  });

  it('o banco não liga voto a membro nem guarda horário', () => {
    const db = app.get(DatabaseService);
    const colsVoto = db.all<any>(`PRAGMA table_info(voto)`).map((c) => c.name);
    const colsPres = db.all<any>(`PRAGMA table_info(presenca)`).map((c) => c.name);
    expect(colsVoto.sort()).toEqual(['candidatura_id', 'eleicao_id', 'id']);
    expect(colsPres.sort()).toEqual(['eleicao_id', 'membro_id']);
    const sqlVoto = db.get<any>(`SELECT sql FROM sqlite_master WHERE name = 'voto'`).sql;
    expect(sqlVoto).toContain('WITHOUT ROWID');
    expect(() => db.get('SELECT rowid FROM voto')).toThrow();
  });

  it('painel da mesa mostra contagem sem votos', async () => {
    const p = (await presidenteSessao.get(`/api/eleicoes/${eleicaoId}/painel`).expect(200)).body;
    expect(p.votaram).toBe(6);
    expect(p.faltam).toHaveLength(0);
    expect(JSON.stringify(p)).not.toMatch(/votos|candidat/i);
  });

  it('encerra, apura (empate presidente por idade) e emite PDFs', async () => {
    await presidenteSessao.post(`/api/eleicoes/${eleicaoId}/encerrar`).expect(201);
    const r = (await presidenteSessao.post(`/api/eleicoes/${eleicaoId}/apurar`).expect(201)).body;
    // Alberto (1975) e Carlos (1979) empatam com 2: Alberto é mais velho → presidente.
    expect(r.presidente.nome).toBe('Alberto Toledo');
    expect(r.criterioPresidente).toBe('idade');
    // Vice: mais votado de outra cidade = Carlos (Cascavel, 2 votos)
    expect(r.vice.nome).toBe('Carlos Cascavel');
    expect(r.status).toBe('apurada');
    expect(r.totalVotos).toBe(6);
    expect(r.totalPresencas).toBe(6);

    const pdf = await presidenteSessao.get(`/api/eleicoes/${eleicaoId}/presenca.pdf`).buffer(true).expect(200);
    expect(pdf.headers['content-type']).toBe('application/pdf');
    expect(pdf.body.slice(0, 4).toString()).toBe('%PDF');
    await presidenteSessao.get(`/api/eleicoes/${eleicaoId}/ata.pdf`).expect(200);
  });

  it('empate na vaga de vice: aguarda e o presidente de sessão registra a escolha', async () => {
    const db = app.get(DatabaseService);
    const svc = app.get(EleicoesService);
    // Nova eleição: placar A 3 (Toledo), C 1 (Cascavel), D 1 (Vilhena) → C e D empatam para vice.
    const agora = Date.now();
    const e2 = (
      await admin.post('/api/eleicoes').send({
        titulo: 'Eleição de teste 2',
        inicio: new Date(agora - 60_000).toISOString(),
        termino: new Date(agora + 30 * 60_000).toISOString(),
        presidenteSessaoId: ids.ps,
      })
    ).body.id;
    for (const k of ['a', 'c', 'd']) await presidenteSessao.post(`/api/eleicoes/${e2}/candidaturas`).send({ membroId: ids[k] }).expect(201);
    await admin.post(`/api/eleicoes/${e2}/agendar`).expect(201);
    svc.atualizarStatusPorHorario();
    eleicaoId = e2;
    await votar('a', 'Alberto');
    await votar('b', 'Alberto');
    await votar('novo', 'Alberto');
    await votar('c', 'Carlos');
    await votar('d', 'Diego');
    // Simula o fim do horário
    db.run(`UPDATE eleicao SET termino = ? WHERE id = ?`, new Date(Date.now() - 1000).toISOString(), e2);
    svc.atualizarStatusPorHorario();
    const res = (await presidenteSessao.post(`/api/eleicoes/${e2}/apurar`).expect(201)).body;
    expect(res.status).toBe('aguardando_vice');
    expect(res.empatadosVice.map((c: any) => c.nome).sort()).toEqual(['Carlos Cascavel', 'Diego Vilhena']);
    await presidenteSessao.get(`/api/eleicoes/${e2}/ata.pdf`).expect(400);
    const diego = res.empatadosVice.find((c: any) => c.nome.startsWith('Diego'));
    const fim = (await presidenteSessao.post(`/api/eleicoes/${e2}/escolher-vice`).send({ candidaturaId: diego.candidaturaId }).expect(201)).body;
    expect(fim.status).toBe('apurada');
    expect(fim.vice.nome).toBe('Diego Vilhena');
    expect(fim.criterioVice).toBe('escolha_presidente');
    await presidenteSessao.get(`/api/eleicoes/${e2}/ata.pdf`).expect(200);
  });
});
