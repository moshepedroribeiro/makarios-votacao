export const CIDADES: { cidade: string; uf: string }[] = [
  { cidade: 'Cascavel', uf: 'PR' },
  { cidade: 'Toledo', uf: 'PR' },
  { cidade: 'Nova Santa Rosa', uf: 'PR' },
  { cidade: 'Marechal Cândido Rondon', uf: 'PR' },
  { cidade: 'Vilhena', uf: 'RO' },
];

export const ufDaCidade = (c: string) => CIDADES.find((x) => x.cidade === c)?.uf ?? '';

export type Status = 'rascunho' | 'agendada' | 'aberta' | 'encerrada' | 'aguardando_vice' | 'apurada';

export const NOME_STATUS: Record<Status, string> = {
  rascunho: 'Rascunho',
  agendada: 'Agendada',
  aberta: 'Votação aberta',
  encerrada: 'Encerrada',
  aguardando_vice: 'Aguardando escolha do vice',
  apurada: 'Apurada',
};

/** Data e hora no fuso de quem está vendo (Cascavel e Vilhena têm 1h de diferença). */
export function dataHora(iso: string): string {
  // dateStyle/timeStyle não podem ser combinados com timeZoneName.
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(iso));
}

export function hora(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { timeStyle: 'short' }).format(new Date(iso));
}

export function dataBr(iso?: string | null): string {
  if (!iso) return '—';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

/** ISO → valor de <input type="datetime-local"> no fuso do navegador. */
export function paraInputLocal(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function mascaraCpf(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
}

export function contagemRegressiva(ms: number): string {
  if (ms <= 0) return '00:00';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${p(m)}:${p(ss)}` : `${p(m)}:${p(ss)}`;
}

export const CRITERIO_PRESIDENTE: Record<string, string> = {
  votos: 'Mais votado',
  idade: 'Empate em votos — eleito o mais velho (estatuto)',
};
export const CRITERIO_VICE: Record<string, string> = {
  votos: 'Mais votado de cidade diferente da do presidente',
  escolha_presidente: 'Empate em votos — escolhido pelo presidente eleito',
  vago: 'Vago: nenhum candidato de outra cidade',
};
