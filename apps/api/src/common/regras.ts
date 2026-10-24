/**
 * Regras de negócio puras (sem banco), para serem testadas isoladamente.
 */

export const CIDADES: Record<string, 'PR' | 'RO'> = {
  Cascavel: 'PR',
  Toledo: 'PR',
  'Nova Santa Rosa': 'PR',
  'Marechal Cândido Rondon': 'PR',
  Vilhena: 'RO',
};

export const FUSO = process.env.APP_TZ ?? 'America/Sao_Paulo';

// ---------------------------------------------------------------- CPF

export function limparCpf(cpf: string): string {
  return (cpf ?? '').replace(/\D/g, '');
}

export function cpfValido(cpf: string): boolean {
  const c = limparCpf(cpf);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  const dv = (base: string, pesoInicial: number) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (pesoInicial - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return dv(c.slice(0, 9), 10) === Number(c[9]) && dv(c.slice(0, 10), 11) === Number(c[10]);
}

/** 12345678909 → 123.***.***-09 */
export function mascararCpf(cpf: string): string {
  const c = limparCpf(cpf);
  return c.length === 11 ? `${c.slice(0, 3)}.***.***-${c.slice(9)}` : '***';
}

export function formatarCpf(cpf: string): string {
  const c = limparCpf(cpf);
  return c.length === 11 ? `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}` : cpf;
}

// ---------------------------------------------------------------- Datas

/**
 * Aceita AAAA-MM-DD ou DD/MM/AAAA. Retorna AAAA-MM-DD, `null` se vazio,
 * ou `undefined` se o texto não for uma data válida.
 */
export function normalizarData(valor?: string | null): string | null | undefined {
  if (valor === undefined || valor === null || String(valor).trim() === '') return null;
  const v = String(valor).trim();
  let a: number, m: number, d: number;
  let r = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (r) [a, m, d] = [Number(r[1]), Number(r[2]), Number(r[3])];
  else if ((r = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v))) [d, m, a] = [Number(r[1]), Number(r[2]), Number(r[3])];
  else return undefined;
  const dt = new Date(Date.UTC(a, m - 1, d));
  if (dt.getUTCFullYear() !== a || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return undefined;
  return `${String(a).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Data (AAAA-MM-DD) no fuso do clube para um instante. */
export function dataLocal(instante: Date | string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(instante));
}

export function dataHoraLocal(instante: Date | string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO,
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(instante));
}

export function dataBr(iso?: string | null): string {
  if (!iso) return '—';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

/** Soma anos a uma data AAAA-MM-DD. 29/02 em ano não bissexto vira 01/03. */
export function somarAnos(iso: string, anos: number): string {
  const [a, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(a + anos, m - 1, d));
  return dt.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------- Membros

export interface MembroBase {
  ativo: number | boolean;
  habilitado: number | boolean;
  data_coleteamento: string | null;
  data_fechamento: string | null;
}

export interface Aptidao {
  apto: boolean;
  motivo: string | null;
}

/** Apto a votar = ativo, com colete fechado e habilitado pela mesa. */
export function aptidao(m: MembroBase): Aptidao {
  if (!m.ativo) return { apto: false, motivo: 'Membro inativo' };
  if (!m.data_fechamento) return { apto: false, motivo: 'Sem colete fechado' };
  if (!m.habilitado) return { apto: false, motivo: 'Desabilitado pela mesa (inadimplente)' };
  return { apto: true, motivo: null };
}

export const ANOS_MINIMOS_COLETE = 3;

/** Verdadeiro se o colete completa 3 anos fechado até a data de início da eleição. */
export function temTempoDeColete(dataFechamento: string | null, inicioEleicao: Date | string): boolean {
  if (!dataFechamento) return false;
  return somarAnos(dataFechamento, ANOS_MINIMOS_COLETE) <= dataLocal(inicioEleicao);
}

// ---------------------------------------------------------------- Apuração

export interface CandidatoApuracao {
  candidaturaId: number;
  membroId: number;
  nome: string;
  cidade: string;
  dataNascimento: string; // AAAA-MM-DD
  votos: number;
}

export type ResultadoApuracao =
  | {
      tipo: 'concluida' | 'aguardando_vice';
      ranking: (CandidatoApuracao & { posicao: number })[];
      presidente: CandidatoApuracao;
      criterioPresidente: 'votos' | 'idade';
      vice: CandidatoApuracao | null;
      criterioVice: 'votos' | 'vago' | null;
      empatadosVice: CandidatoApuracao[];
    }
  | { tipo: 'empate_absoluto'; empatados: CandidatoApuracao[]; mensagem: string }
  | { tipo: 'sem_votos'; mensagem: string };

/**
 * Regra do Makários:
 *  - Presidente = mais votado. Empate: o mais velho (estatuto).
 *  - Vice = mais votado entre os de cidade diferente da do presidente.
 *    Empate: o presidente eleito escolhe (fica "aguardando_vice").
 *  - Ninguém de outra cidade: vice vago.
 */
export function apurar(candidatos: CandidatoApuracao[]): ResultadoApuracao {
  const total = candidatos.reduce((s, c) => s + c.votos, 0);
  if (candidatos.length === 0 || total === 0) {
    return { tipo: 'sem_votos', mensagem: 'Nenhum voto registrado nesta eleição.' };
  }

  // Ranking: votos desc; desempate de exibição pelo mais velho e depois pelo nome.
  const ordenados = [...candidatos].sort(
    (a, b) => b.votos - a.votos || a.dataNascimento.localeCompare(b.dataNascimento) || a.nome.localeCompare(b.nome),
  );
  const ranking = ordenados.map((c, i) => ({ ...c, posicao: i + 1 }));

  // ---- Presidente
  const maxVotos = ordenados[0].votos;
  const empatadosTopo = ordenados.filter((c) => c.votos === maxVotos);
  let criterioPresidente: 'votos' | 'idade' = 'votos';
  let presidente = empatadosTopo[0];
  if (empatadosTopo.length > 1) {
    criterioPresidente = 'idade';
    const maisVelhaData = empatadosTopo.reduce((min, c) => (c.dataNascimento < min ? c.dataNascimento : min), '9999');
    const maisVelhos = empatadosTopo.filter((c) => c.dataNascimento === maisVelhaData);
    if (maisVelhos.length > 1) {
      return {
        tipo: 'empate_absoluto',
        empatados: maisVelhos,
        mensagem:
          'Empate em votos e na data de nascimento entre os mais votados. O sistema não decide: realize nova votação entre os empatados.',
      };
    }
    presidente = maisVelhos[0];
  }

  // ---- Vice
  const outrasCidades = ordenados.filter((c) => c.candidaturaId !== presidente.candidaturaId && c.cidade !== presidente.cidade);
  if (outrasCidades.length === 0) {
    return { tipo: 'concluida', ranking, presidente, criterioPresidente, vice: null, criterioVice: 'vago', empatadosVice: [] };
  }
  const maxVice = outrasCidades[0].votos;
  const empatadosVice = outrasCidades.filter((c) => c.votos === maxVice);
  if (empatadosVice.length > 1) {
    return { tipo: 'aguardando_vice', ranking, presidente, criterioPresidente, vice: null, criterioVice: null, empatadosVice };
  }
  return {
    tipo: 'concluida',
    ranking,
    presidente,
    criterioPresidente,
    vice: empatadosVice[0],
    criterioVice: 'votos',
    empatadosVice: [],
  };
}
