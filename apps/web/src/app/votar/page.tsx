'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { Emblema } from '@/components/emblema';
import { Aviso, Botao, Campo, Entrada } from '@/components/ui';
import { api, mensagemDe } from '@/lib/api';
import { dataHora, hora, mascaraCpf } from '@/lib/formato';

interface Candidato {
  id: number;
  nome: string;
  apelido: string | null;
  cidade: string;
  uf: string;
}

type Etapa =
  | { tipo: 'entrada' }
  | { tipo: 'cedula'; token: string; nome: string; titulo: string; termino: string; candidatos: Candidato[] }
  | { tipo: 'confirmacao'; token: string; nome: string; titulo: string; termino: string; candidatos: Candidato[]; escolhido: Candidato }
  | { tipo: 'registrado' };

export default function Votar() {
  const [situacao, setSituacao] = useState<any>(null);
  const [etapa, setEtapa] = useState<Etapa>({ tipo: 'entrada' });
  const [cpf, setCpf] = useState('');
  const [selecionado, setSelecionado] = useState<number | null>(null);
  const [erro, setErro] = useState<string[]>([]);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    api('/votacao/situacao').then(setSituacao).catch(() => setSituacao({ aberta: false }));
  }, []);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setErro([]);
    setOcupado(true);
    try {
      const s = await api<{ token: string; nome: string }>('/votacao/entrar', { corpo: { cpf } });
      const c = await api<{ titulo: string; termino: string; candidatos: Candidato[] }>('/votacao/cedula', {
        cabecalhos: { 'x-sessao-votacao': s.token },
      });
      setCpf('');
      setSelecionado(null);
      setEtapa({ tipo: 'cedula', token: s.token, nome: s.nome, ...c });
    } catch (err) {
      setErro(mensagemDe(err));
    } finally {
      setOcupado(false);
    }
  }

  async function confirmar() {
    if (etapa.tipo !== 'confirmacao') return;
    setErro([]);
    setOcupado(true);
    try {
      await api('/votacao/votar', { corpo: { candidaturaId: etapa.escolhido.id }, cabecalhos: { 'x-sessao-votacao': etapa.token } });
      setEtapa({ tipo: 'registrado' });
    } catch (err) {
      const msgs = mensagemDe(err);
      setErro(msgs);
      if (msgs.some((m) => /expirou|encerrada|já votou/i.test(m))) setEtapa({ tipo: 'entrada' });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <main className="min-h-screen bg-couro text-asfalto-claro">
      <div className="mx-auto max-w-xl px-5 pb-16 pt-8">
        <Link href="/" className="flex items-center gap-3">
          <Emblema tamanho={40} />
          <span className="font-titulo text-2xl font-semibold">Makários</span>
        </Link>

        {etapa.tipo === 'entrada' && (
          <>
            <h1 className="mt-10 font-titulo text-5xl font-bold leading-none text-asfalto-claro">Votar</h1>
            {situacao && !situacao.aberta ? (
              <div className="mt-6 rounded-lg border border-bordado/40 p-5 text-asfalto-claro/80">
                {situacao.proxima ? (
                  <p>
                    A votação de <strong className="text-asfalto-claro">{situacao.proxima.titulo}</strong> abre em {dataHora(situacao.proxima.inicio)}.
                  </p>
                ) : (
                  <p>Não há votação aberta no momento.</p>
                )}
              </div>
            ) : (
              <>
                <p className="mt-3 text-asfalto-claro/75">
                  {situacao?.titulo}
                  {situacao?.termino && ` · aberta até ${hora(situacao.termino)}`}. Entre com o seu CPF.
                </p>
                <form onSubmit={entrar} className="mt-8 space-y-4 rounded-xl bg-asfalto-claro p-5 text-tinta">
                  <Campo rotulo="CPF">
                    <Entrada value={cpf} onChange={(e) => setCpf(mascaraCpf(e.target.value))} inputMode="numeric" autoComplete="off" placeholder="000.000.000-00" required className="text-lg" />
                  </Campo>
                  <Aviso mensagens={erro} />
                  <Botao type="submit" carregando={ocupado} className="min-h-12 w-full text-lg">
                    Entrar
                  </Botao>
                </form>
                <p className="mt-6 text-sm text-asfalto-claro/60">
                  Seu voto é secreto: o sistema registra que você votou, mas não em quem. Problemas para entrar? Fale com a mesa.
                </p>
              </>
            )}
          </>
        )}

        {etapa.tipo === 'cedula' && (
          <>
            <h1 className="mt-10 font-titulo text-4xl font-bold leading-tight text-asfalto-claro">{etapa.nome}, escolha seu candidato a presidente</h1>
            <p className="mt-2 text-asfalto-claro/70">
              O mais votado será presidente. O vice será o mais votado de outra cidade. Votação aberta até {hora(etapa.termino)}.
            </p>
            <div className="mt-8 space-y-4" role="radiogroup" aria-label="Candidatos">
              {etapa.candidatos.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={selecionado === c.id}
                  data-selecionado={selecionado === c.id}
                  onClick={() => setSelecionado(c.id)}
                  className="patch"
                >
                  <span className="patch-miolo flex items-center justify-between gap-4">
                    <span>
                      <span className="block font-titulo text-3xl font-bold leading-tight text-asfalto-claro">{c.nome}</span>
                      {c.apelido && <span className="block font-titulo text-xl text-bordado-claro">“{c.apelido}”</span>}
                      <span className="mt-1 block text-asfalto-claro/70">
                        {c.cidade}/{c.uf}
                      </span>
                    </span>
                    <span
                      aria-hidden="true"
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${selecionado === c.id ? 'border-bordado bg-bordado' : 'border-bordado/60'}`}
                    >
                      {selecionado === c.id && <span className="h-3 w-3 rounded-full bg-couro" />}
                    </span>
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-8">
              <Botao
                disabled={selecionado === null}
                onClick={() => setEtapa({ ...etapa, tipo: 'confirmacao', escolhido: etapa.candidatos.find((c) => c.id === selecionado)! })}
                variante="destaque"
                className="min-h-12 w-full text-lg"
              >
                Continuar
              </Botao>
            </div>
          </>
        )}

        {etapa.tipo === 'confirmacao' && (
          <>
            <h1 className="mt-10 font-titulo text-4xl font-bold text-asfalto-claro">Confirme seu voto</h1>
            <div className="patch mt-8" data-selecionado="true">
              <span className="patch-miolo block">
                <span className="block font-titulo text-4xl font-bold text-asfalto-claro">{etapa.escolhido.nome}</span>
                <span className="block text-asfalto-claro/70">
                  {etapa.escolhido.cidade}/{etapa.escolhido.uf}
                </span>
              </span>
            </div>
            <p className="mt-6 text-asfalto-claro/75">Depois de confirmar, o voto não pode ser alterado.</p>
            <div className="mt-4">
              <Aviso mensagens={erro} />
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Botao variante="secundario" onClick={() => setEtapa({ ...etapa, tipo: 'cedula' })} disabled={ocupado} className="min-h-12">
                Voltar e trocar
              </Botao>
              <Botao onClick={confirmar} carregando={ocupado} variante="destaque" className="min-h-12 text-lg">
                Confirmar voto
              </Botao>
            </div>
          </>
        )}

        {etapa.tipo === 'registrado' && (
          <div className="mt-16 text-center">
            <div className="mx-auto w-fit">
              <Emblema tamanho={96} />
            </div>
            <h1 className="mt-6 font-titulo text-5xl font-bold text-bordado-claro">Voto registrado</h1>
            <p className="mx-auto mt-3 max-w-sm text-asfalto-claro/75">
              Obrigado por votar. Sua presença foi anotada; em quem você votou, ninguém sabe.
            </p>
            <Link href="/" className="mt-8 inline-block text-asfalto-claro/70 underline underline-offset-4">
              Sair
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
