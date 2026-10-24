import { aptidao, apurar, CandidatoApuracao, cpfValido, mascararCpf, normalizarData, temTempoDeColete } from '../src/common/regras';

const c = (id: number, nome: string, cidade: string, votos: number, nasc = '1980-01-01'): CandidatoApuracao => ({
  candidaturaId: id,
  membroId: id,
  nome,
  cidade,
  votos,
  dataNascimento: nasc,
});

describe('Apuração', () => {
  it('exemplo do clube: dois de Toledo no topo, vice é o 3º (Cascavel)', () => {
    const r = apurar([c(1, 'A', 'Toledo', 18), c(2, 'B', 'Toledo', 12), c(3, 'C', 'Cascavel', 9), c(4, 'D', 'Vilhena', 4)]);
    expect(r.tipo).toBe('concluida');
    if (r.tipo !== 'concluida') return;
    expect(r.presidente.nome).toBe('A');
    expect(r.criterioPresidente).toBe('votos');
    expect(r.vice?.nome).toBe('C');
    expect(r.criterioVice).toBe('votos');
  });

  it('empate para presidente: vence o mais velho; o outro, de outra cidade, vira vice', () => {
    const r = apurar([c(1, 'A', 'Toledo', 15, '1975-05-10'), c(2, 'B', 'Cascavel', 15, '1980-02-01'), c(3, 'C', 'Vilhena', 3)]);
    expect(r.tipo).toBe('concluida');
    if (r.tipo !== 'concluida') return;
    expect(r.presidente.nome).toBe('A');
    expect(r.criterioPresidente).toBe('idade');
    expect(r.vice?.nome).toBe('B');
  });

  it('empate para vice: aguarda a escolha do presidente eleito', () => {
    const r = apurar([c(1, 'A', 'Toledo', 18), c(2, 'B', 'Toledo', 12), c(3, 'C', 'Cascavel', 9), c(4, 'D', 'Vilhena', 9)]);
    expect(r.tipo).toBe('aguardando_vice');
    if (r.tipo !== 'aguardando_vice') return;
    expect(r.presidente.nome).toBe('A');
    expect(r.empatadosVice.map((x) => x.nome).sort()).toEqual(['C', 'D']);
  });

  it('vice vago quando todos são da mesma cidade', () => {
    const r = apurar([c(1, 'A', 'Toledo', 5), c(2, 'B', 'Toledo', 3)]);
    expect(r.tipo).toBe('concluida');
    if (r.tipo !== 'concluida') return;
    expect(r.vice).toBeNull();
    expect(r.criterioVice).toBe('vago');
  });

  it('candidato único: presidente e vice vago', () => {
    const r = apurar([c(1, 'A', 'Toledo', 5)]);
    expect(r.tipo === 'concluida' && r.vice === null).toBe(true);
  });

  it('empate absoluto (mesmos votos e mesma data de nascimento): não decide', () => {
    const r = apurar([c(1, 'A', 'Toledo', 7, '1970-01-01'), c(2, 'B', 'Cascavel', 7, '1970-01-01')]);
    expect(r.tipo).toBe('empate_absoluto');
  });

  it('sem votos', () => {
    expect(apurar([c(1, 'A', 'Toledo', 0)]).tipo).toBe('sem_votos');
  });
});

describe('Tempo de colete', () => {
  it('3 anos completos até a data de início', () => {
    expect(temTempoDeColete('2024-03-20', '2027-03-20T12:00:00-03:00')).toBe(true);
    expect(temTempoDeColete('2024-03-20', '2027-03-19T12:00:00-03:00')).toBe(false);
  });
  it('usa a data no fuso do clube (23h do dia 19 em SP ainda é dia 19)', () => {
    expect(temTempoDeColete('2024-03-20', '2027-03-20T02:00:00Z')).toBe(false);
  });
  it('29/02 conta a partir de 01/03 em ano não bissexto', () => {
    expect(temTempoDeColete('2024-02-29', '2027-02-28T12:00:00-03:00')).toBe(false);
    expect(temTempoDeColete('2024-02-29', '2027-03-01T12:00:00-03:00')).toBe(true);
  });
  it('sem fechamento nunca tem tempo', () => {
    expect(temTempoDeColete(null, '2030-01-01')).toBe(false);
  });
});

describe('Aptidão para votar', () => {
  const base = { ativo: 1, habilitado: 1, data_coleteamento: '2020-01-01', data_fechamento: '2021-01-01' };
  it('apto com fechamento e habilitado', () => expect(aptidao(base).apto).toBe(true));
  it('sem datas de colete: inapto', () =>
    expect(aptidao({ ...base, data_coleteamento: null, data_fechamento: null }).motivo).toBe('Sem colete fechado'));
  it('só coleteamento: inapto', () => expect(aptidao({ ...base, data_fechamento: null }).apto).toBe(false));
  it('desabilitado: inapto', () => expect(aptidao({ ...base, habilitado: 0 }).apto).toBe(false));
});

describe('CPF e datas', () => {
  it('valida dígitos verificadores', () => {
    expect(cpfValido('529.982.247-25')).toBe(true);
    expect(cpfValido('529.982.247-26')).toBe(false);
    expect(cpfValido('111.111.111-11')).toBe(false);
  });
  it('mascara', () => expect(mascararCpf('52998224725')).toBe('529.***.***-25'));
  it('normaliza datas', () => {
    expect(normalizarData('20/03/2024')).toBe('2024-03-20');
    expect(normalizarData('2024-03-20')).toBe('2024-03-20');
    expect(normalizarData('')).toBeNull();
    expect(normalizarData('31/02/2024')).toBeUndefined();
  });
});
