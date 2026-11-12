'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Aviso, Botao, Carregando, Painel, SeloStatus, Titulo } from '@/components/ui';
import { api, ErroApi, mensagemDe } from '@/lib/api';
import { CRITERIO_PRESIDENTE, CRITERIO_VICE, Status } from '@/lib/formato';

interface Candidato {
  posicao: number;
  votos: number;
  candidaturaId: number;
  membroId: number;
  nome: string;
  apelido: string | null;
  cidade: string;
  uf: string;
}

interface Resultado {
  eleicaoId: number;
  titulo: string;
  status: Status;
  ranking: Candidato[];
  totalVotos: number;
  totalPresencas: number;
  presidente: Candidato | null;
  criterioPresidente: string | null;
  vice: Candidato | null;
  criterioVice: string | null;
  empatadosVice: Candidato[];
  meuPapel: 'admin' | 'presidente' | 'mesario';
}

interface Basico {
  id: number;
  titulo: string;
  status: Status;
  meuPapel: 'admin' | 'presidente' | 'mesario';
}

export default function PaginaResultado() {
  const { id } = useParams<{ id: string }>();
  const [eleicao, setEleicao] = useState<Basico | null>(null);
  const [r, setR] = useState<Resultado | null>(null);
  const [erro, setErro] = useState<string[]>([]);
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async () => {
    const e = await api<Basico>(`/eleicoes/${id}`);
    setEleicao(e);
    if (e.status === 'apurada' || e.status === 'aguardando_vice') {
      setR(await api<Resultado>(`/eleicoes/${id}/resultado`));
    }
  }, [id]);

  useEffect(() => {
    carregar().catch((err) => setErro(mensagemDe(err)));
  }, [carregar]);

  async function executar(fn: () => Promise<Resultado>) {
    setErro([]);
    setOcupado(true);
    try {
      setR(await fn());
      await carregar();
    } catch (err) {
      setErro(err instanceof ErroApi ? err.mensagens : mensagemDe(err));
    } finally {
      setOcupado(false);
    }
  }

  if (!eleicao) return erro.length ? <Aviso mensagens={erro} /> : <Carregando />;
  const preside = eleicao.meuPapel === 'presidente';
  const podePdf = preside || eleicao.meuPapel === 'admin';

  return (
    <>
      <Titulo
        descricao={eleicao.titulo}
        acoes={
          <Link href={`/eleicoes/${eleicao.id}`} className="inline-flex min-h-10 items-center rounded-md bg-white px-4 font-medium text-couro ring-1 ring-inset ring-asfalto-linha">
            Voltar à eleição
          </Link>
        }
      >
        {eleicao.status === 'encerrada' ? 'Apuração' : 'Resultado'}
      </Titulo>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <SeloStatus status={eleicao.status} />
      </div>
      <div className="mb-6">
        <Aviso mensagens={erro} />
      </div>

      {eleicao.status === 'encerrada' && (
        <Painel className="max-w-2xl">
          <h2 className="text-2xl font-semibold">Votação encerrada</h2>
          <p className="mt-2 text-tinta/75">
            Ao apurar, o sistema conta os votos e aplica as regras: o mais votado é presidente (empate: o mais velho); o vice é o mais votado de cidade diferente da do presidente (empate: o presidente eleito escolhe).
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {preside ? (
              <Botao carregando={ocupado} onClick={() => executar(() => api<Resultado>(`/eleicoes/${id}/apurar`, { metodo: 'POST' }))}>
                Apurar votos
              </Botao>
            ) : (
              <p className="text-sm text-tinta/70">Somente o moderador de eleição pode apurar.</p>
            )}
            {podePdf && (
              <a href={`/api/eleicoes/${id}/presenca.pdf`} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center rounded-md bg-white px-4 font-medium text-couro ring-1 ring-inset ring-asfalto-linha">
                Baixar lista de presença
              </a>
            )}
          </div>
        </Painel>
      )}

      {r && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <CartaoEleito cargo="Presidente" pessoa={r.presidente} criterio={CRITERIO_PRESIDENTE[r.criterioPresidente ?? '']} />
            {r.status === 'aguardando_vice' ? (
              <div className="rounded-lg border-2 border-dashed border-bordado bg-white p-6">
                <p className="font-titulo text-xl text-bordado-escuro">Vice-presidente</p>
                <p className="mt-1 text-tinta/75">
                  Empate entre candidatos de outra cidade. Registre quem o presidente eleito, {r.presidente?.nome}, escolheu:
                </p>
                <div className="mt-4 space-y-2">
                  {r.empatadosVice.map((c) => (
                    <div key={c.candidaturaId} className="flex flex-wrap items-center justify-between gap-2 rounded border border-asfalto-linha px-3 py-2">
                      <span>
                        <span className="font-medium">{c.nome}</span>
                        <span className="text-tinta/60">
                          {' '}
                          · {c.cidade}/{c.uf} · {c.votos} voto(s)
                        </span>
                      </span>
                      {preside && (
                        <Botao
                          carregando={ocupado}
                          onClick={() =>
                            confirm(`Confirmar ${c.nome} como vice-presidente, por escolha de ${r.presidente?.nome}?`) &&
                            executar(() => api<Resultado>(`/eleicoes/${id}/escolher-vice`, { corpo: { candidaturaId: c.candidaturaId } }))
                          }
                        >
                          Registrar escolha
                        </Botao>
                      )}
                    </div>
                  ))}
                </div>
                {!preside && <p className="mt-3 text-sm text-tinta/70">Somente o moderador de eleição registra a escolha.</p>}
              </div>
            ) : (
              <CartaoEleito cargo="Vice-presidente" pessoa={r.vice} criterio={CRITERIO_VICE[r.criterioVice ?? '']} />
            )}
          </div>

          <Painel className="overflow-x-auto">
            <h2 className="text-2xl font-semibold">Contagem</h2>
            <table className="mt-3 w-full min-w-[32rem] text-left">
              <thead className="border-b border-asfalto-linha font-titulo text-base text-couro">
                <tr>
                  <th className="py-2 pr-3 font-semibold">Posição</th>
                  <th className="py-2 pr-3 font-semibold">Candidato</th>
                  <th className="py-2 pr-3 font-semibold">Cidade</th>
                  <th className="py-2 pr-3 text-right font-semibold">Votos</th>
                  <th className="py-2 font-semibold">Resultado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-asfalto-linha">
                {r.ranking.map((c) => {
                  const cargo = c.membroId === r.presidente?.membroId ? 'Presidente' : c.membroId === r.vice?.membroId ? 'Vice-presidente' : '';
                  return (
                    <tr key={c.candidaturaId} className={cargo ? 'font-semibold' : ''}>
                      <td className="py-2 pr-3 tabular-nums">{c.posicao}º</td>
                      <td className="py-2 pr-3">{c.nome}</td>
                      <td className="py-2 pr-3">
                        {c.cidade}/{c.uf}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">{c.votos}</td>
                      <td className="py-2 text-bordado-escuro">{cargo}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-4 text-sm text-tinta/70">
              {r.totalVotos} voto(s) e {r.totalPresencas} presença(s)
              {r.totalVotos === r.totalPresencas ? ': números conferem.' : ': ATENÇÃO, os números não conferem.'}
            </p>
          </Painel>

          {podePdf && (
            <div className="flex flex-wrap gap-2">
              <a href={`/api/eleicoes/${id}/presenca.pdf`} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center rounded-md bg-couro px-4 font-medium text-asfalto-claro">
                Baixar lista de presença (PDF)
              </a>
              {r.status === 'apurada' && (
                <a href={`/api/eleicoes/${id}/ata.pdf`} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center rounded-md bg-white px-4 font-medium text-couro ring-1 ring-inset ring-asfalto-linha">
                  Baixar ata da apuração (PDF)
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}

function CartaoEleito({ cargo, pessoa, criterio }: { cargo: string; pessoa: Candidato | null; criterio?: string }) {
  return (
    <div className="rounded-lg bg-couro p-[5px]">
      <div className="h-full rounded-md border-2 border-dashed border-bordado/70 px-6 py-5 text-asfalto-claro">
        <p className="font-titulo text-xl text-bordado-claro">{cargo}</p>
        {pessoa ? (
          <>
            <p className="mt-1 font-titulo text-4xl font-bold leading-tight">{pessoa.nome}</p>
            <p className="text-asfalto-claro/75">
              {pessoa.cidade}/{pessoa.uf} · {pessoa.votos} voto(s)
            </p>
          </>
        ) : (
          <p className="mt-1 font-titulo text-4xl font-bold">Vago</p>
        )}
        {criterio && <p className="mt-3 text-sm text-asfalto-claro/60">{criterio}</p>}
      </div>
    </div>
  );
}
