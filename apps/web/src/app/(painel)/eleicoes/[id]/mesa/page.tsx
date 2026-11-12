'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Aviso, Botao, Carregando, Painel, SeloStatus, Selecao, Titulo } from '@/components/ui';
import { api, mensagemDe } from '@/lib/api';
import { contagemRegressiva, dataHora, hora, Status } from '@/lib/formato';

interface PainelMesa {
  id: number;
  titulo: string;
  status: Status;
  inicio: string;
  termino: string;
  agora: string;
  totalAptos: number;
  votaram: number;
  faltam: { id: number; nome: string; cidade: string; uf: string }[];
  meuPapel: 'admin' | 'presidente' | 'mesario';
}

export default function Mesa() {
  const { id } = useParams<{ id: string }>();
  const [p, setP] = useState<PainelMesa | null>(null);
  const [erro, setErro] = useState<string[]>([]);
  const [agora, setAgora] = useState(Date.now());
  const desvio = useRef(0); // diferença entre o relógio do servidor e o do aparelho
  const [incluir, setIncluir] = useState('');
  const [aptosForaDaLista, setAptosForaDaLista] = useState<{ id: number; nome: string; cidade: string; uf: string }[]>([]);

  const carregar = useCallback(async () => {
    try {
      const d = await api<PainelMesa>(`/eleicoes/${id}/painel`);
      desvio.current = new Date(d.agora).getTime() - Date.now();
      setP(d);
    } catch (err) {
      setErro(mensagemDe(err));
    }
  }, [id]);

  useEffect(() => {
    carregar();
    const t = setInterval(carregar, 5000);
    const r = setInterval(() => setAgora(Date.now()), 1000);
    return () => {
      clearInterval(t);
      clearInterval(r);
    };
  }, [carregar]);

  useEffect(() => {
    if (p?.status !== 'agendada') return;
    const naLista = new Set(p.faltam.map((f) => f.id));
    api<any[]>('/membros?apto=true').then((ms) => setAptosForaDaLista(ms.filter((m) => !naLista.has(m.id))));
  }, [p?.status, p?.faltam]);

  async function incluirNaLista(membroId: number) {
    setErro([]);
    try {
      await api(`/eleicoes/${id}/aptos/${membroId}`, { metodo: 'POST' });
      carregar();
    } catch (err) {
      setErro(mensagemDe(err));
    }
  }

  async function mudarStatus(acao: 'abrir' | 'encerrar') {
    setErro([]);
    if (acao === 'encerrar' && !confirm('Encerrar a votação agora? Nenhum voto será aceito depois.')) return;
    try {
      await api(`/eleicoes/${id}/${acao}`, { metodo: 'POST' });
      carregar();
    } catch (err) {
      setErro(mensagemDe(err));
    }
  }

  if (!p) return erro.length ? <Aviso mensagens={erro} /> : <Carregando />;

  const agoraServidor = agora + desvio.current;
  const restante = new Date(p.termino).getTime() - agoraServidor;
  const paraAbrir = new Date(p.inicio).getTime() - agoraServidor;
  const pct = p.totalAptos ? Math.round((p.votaram / p.totalAptos) * 100) : 0;
  const preside = p.meuPapel === 'presidente';

  return (
    <>
      <Titulo
        descricao={`Votação de ${dataHora(p.inicio)} até ${dataHora(p.termino)}`}
        acoes={
          <Link href={`/eleicoes/${p.id}`} className="inline-flex min-h-10 items-center rounded-md bg-white px-4 font-medium text-couro ring-1 ring-inset ring-asfalto-linha">
            Voltar à eleição
          </Link>
        }
      >
        Painel da mesa
      </Titulo>

      <div className="mb-6">
        <Aviso mensagens={erro} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <section className="rounded-lg bg-couro p-5 text-asfalto-claro sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-3xl font-semibold text-asfalto-claro">{p.titulo}</h2>
            <SeloStatus status={p.status} />
          </div>

          {p.status === 'aberta' && (
            <div className="mt-6">
              <p className="text-asfalto-claro/70">Tempo restante</p>
              <p className="font-titulo text-7xl font-bold tabular-nums text-bordado-claro sm:text-8xl" aria-live="off">
                {contagemRegressiva(restante)}
              </p>
              <p className="text-asfalto-claro/70">Encerra sozinha às {hora(p.termino)}.</p>
            </div>
          )}
          {p.status === 'agendada' && (
            <div className="mt-6">
              <p className="text-asfalto-claro/70">Abre em</p>
              <p className="font-titulo text-7xl font-bold tabular-nums text-bordado-claro">{contagemRegressiva(paraAbrir)}</p>
            </div>
          )}
          {(p.status === 'encerrada' || p.status === 'aguardando_vice' || p.status === 'apurada') && (
            <p className="mt-6 text-xl">Votação encerrada.</p>
          )}

          <div className="mt-8">
            <div className="flex items-baseline justify-between">
              <p>
                <span className="font-titulo text-4xl font-semibold">{p.votaram}</span>
                <span className="text-asfalto-claro/70"> de {p.totalAptos} aptos já votaram</span>
              </p>
              <span className="font-titulo text-2xl text-bordado-claro">{pct}%</span>
            </div>
            <div className="mt-2 h-3 overflow-hidden rounded-full bg-couro-claro" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full bg-bordado transition-[width] duration-500" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-3 text-sm text-asfalto-claro/60">A mesa vê apenas quem votou. Nenhum total por candidato aparece antes da apuração.</p>
          </div>

          {preside && (
            <div className="mt-8 flex flex-wrap gap-2">
              {p.status === 'agendada' && paraAbrir <= 0 && <Botao onClick={() => mudarStatus('abrir')}>Abrir votação</Botao>}
              {p.status === 'aberta' && (
                <Botao
                  variante="destaque"
                  disabled={p.faltam.length > 0}
                  title={p.faltam.length > 0 ? 'Só é possível encerrar antes do horário quando todos os aptos votaram.' : undefined}
                  onClick={() => mudarStatus('encerrar')}
                >
                  Encerrar votação
                </Botao>
              )}
              {p.status === 'encerrada' && (
                <Link href={`/eleicoes/${p.id}/resultado`} className="inline-flex min-h-10 items-center rounded-md bg-bordado px-4 font-medium text-couro">
                  Ir para a apuração
                </Link>
              )}
            </div>
          )}
        </section>

        <Painel>
          <h2 className="text-2xl font-semibold">Ainda não votaram</h2>
          <p className="mt-1 text-sm text-tinta/70">
            {p.status === 'aberta' || p.status === 'agendada'
              ? 'Cobre quem falta. Cada um entra com o próprio CPF.'
              : 'Membros aptos que não compareceram.'}
          </p>
          {p.faltam.length === 0 ? (
            <p className="mt-4 font-semibold text-apto">Todos os aptos já votaram.</p>
          ) : (
            <ul className="mt-3 max-h-[28rem] divide-y divide-asfalto-linha overflow-y-auto">
              {p.faltam.map((f) => (
                <li key={f.id} className="py-2 text-sm">
                  {f.nome}
                  <span className="block text-xs text-tinta/60">
                    {f.cidade}/{f.uf}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {p.status === 'agendada' && aptosForaDaLista.length > 0 && (
            <div className="mt-5 border-t border-asfalto-linha pt-4">
              <h3 className="text-lg font-semibold">Incluir na lista</h3>
              <p className="text-sm text-tinta/70">Membros que ficaram aptos depois do agendamento. Possível até a abertura.</p>
              <div className="mt-2 flex gap-2">
                <Selecao value={incluir} onChange={(e) => setIncluir(e.target.value)} aria-label="Membro a incluir">
                  <option value="">Escolher</option>
                  {aptosForaDaLista.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nome}
                    </option>
                  ))}
                </Selecao>
                <Botao
                  variante="secundario"
                  disabled={!incluir}
                  onClick={() => {
                    setIncluir('');
                    incluirNaLista(Number(incluir));
                  }}
                >
                  Incluir
                </Botao>
              </div>
            </div>
          )}
        </Painel>
      </div>
    </>
  );
}
