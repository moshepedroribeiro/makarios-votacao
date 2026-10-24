/** Cliente HTTP da API. Todas as rotas passam pelo /api do próprio Next. */

export class ErroApi extends Error {
  constructor(
    public status: number,
    public mensagens: string[],
  ) {
    super(mensagens.join(' '));
  }
}

export async function api<T = any>(
  caminho: string,
  opcoes: { metodo?: string; corpo?: unknown; cabecalhos?: Record<string, string> } = {},
): Promise<T> {
  const resp = await fetch(`/api${caminho}`, {
    method: opcoes.metodo ?? (opcoes.corpo !== undefined ? 'POST' : 'GET'),
    headers: { 'Content-Type': 'application/json', ...(opcoes.cabecalhos ?? {}) },
    body: opcoes.corpo !== undefined ? JSON.stringify(opcoes.corpo) : undefined,
    credentials: 'same-origin',
    cache: 'no-store',
  });
  const texto = await resp.text();
  const dados = texto ? safeJson(texto) : null;
  if (!resp.ok) {
    // Erro 5xx sem JSON: o Next não conseguiu falar com a API (fora do ar).
    if (resp.status >= 500 && !resp.headers.get('content-type')?.includes('application/json')) {
      throw new ErroApi(resp.status, ['Servidor da API indisponível. Verifique se a API está rodando.']);
    }
    const msg = dados?.message ?? 'Não foi possível concluir a operação.';
    throw new ErroApi(resp.status, Array.isArray(msg) ? msg : [String(msg)]);
  }
  return dados as T;
}

function safeJson(t: string) {
  try {
    return JSON.parse(t);
  } catch {
    return { message: t };
  }
}

export function mensagemDe(e: unknown): string[] {
  if (e instanceof ErroApi) return e.mensagens;
  if (e instanceof Error) return [e.message];
  return ['Erro inesperado.'];
}
