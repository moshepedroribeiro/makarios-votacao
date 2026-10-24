'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { FormEleicao, MembroSimples } from '@/components/form-eleicao';
import { Aviso, Botao, Campo, Carregando, Entrada, Painel, SeloStatus, Selecao, Titulo } from '@/components/ui';
import { api, mensagemDe } from '@/lib/api';
import { dataHora, Status } from '@/lib/formato';

interface Detalhe {
  id: number;
  titulo: string;
  inicio: string;
  termino: string;
  status: Status;
  presidenteSessao: { id: number; nome: string; cidade: string; uf: string } | null;
  mesarios: { id: number; nome: string; cidade: string; uf: string }[];
  candidaturas: { id: number; membroId: number; nome: string; apelido: string | null; cidade: string; uf: string; situacao: string; motivo: string | null }[];
  aptosNaLista: number;
  meuPapel: 'admin' | 'presidente' | 'mesario';
}

const linkBotao = 'inline-flex min-h-10 items-center rounded-md px-4 font-medium';

export default function DetalheEleicao() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [e, setE] = useState<Detalhe | null>(null);
  const [erro, setErro] = useState<string[]>([]);
  const [ok, setOk] = useState('');
  const [editando, setEditando] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setE(await api<Detalhe>(`/eleicoes/${id}`));
    } catch (err) {
      setErro(mensagemDe(err));
    }
  }, [id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function acao(fn: () => Promise<unknown>, sucesso?: string) {
    setErro([]);
    setOk('');
    setOcupado(true);
    try {
      await fn();
      if (sucesso) setOk(sucesso);
      await carregar();
    } catch (err) {
      setErro(mensagemDe(err));
    } finally {
      setOcupado(false);
    }
  }

  if (!e) return erro.length ? <Aviso mensagens={erro} /> : <Carregando />;

  const admin = e.meuPapel === 'admin';
  const presideOuAdmin = e.meuPapel === 'presidente' || admin;
  const editavel = e.status === 'rascunho' || e.status === 'agendada';
  const deferidas = e.candidaturas.filter((c) => c.situacao === 'deferida');

  return (
    <>
      <Titulo
        descricao={
          <>
            Votação de {dataHora(e.inicio)} até {dataHora(e.termino)}
          </>
        }
        acoes={
          <>
            {(e.status === 'agendada' || e.status === 'aberta' || e.status === 'encerrada') && (
              <Link href={`/eleicoes/${e.id}/mesa`} className={`${linkBotao} bg-couro text-asfalto-claro hover:bg-couro-claro`}>
                Painel da mesa
              </Link>
            )}
            {(e.status === 'encerrada' || e.status === 'aguardando_vice' || e.status === 'apurada') && (
              <Link href={`/eleicoes/${e.id}/resultado`} className={`${linkBotao} bg-bordado text-couro hover:bg-bordado-claro`}>
                {e.status === 'encerrada' ? 'Apuração' : 'Resultado'}
              </Link>
            )}
          </>
        }
      >
        {e.titulo}
      </Titulo>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <SeloStatus status={e.status} />
        {e.status === 'agendada' && <span className="text-sm text-tinta/70">Abre sozinha no horário de início. {e.aptosNaLista} membro(s) na lista de aptos.</span>}
      </div>

      <div className="mb-6 space-y-3">
        <Aviso mensagens={erro} />
        {ok && <Aviso tipo="ok" mensagens={[ok]} />}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <Candidaturas e={e} podeEditar={presideOuAdmin && editavel} aoMudar={carregar} />
        </div>

        <div className="space-y-6">
          <Painel>
            <h2 className="text-2xl font-semibold">Mesa</h2>
            <dl className="mt-3 space-y-3 text-sm">
              <div>
                <dt className="text-tinta/60">Presidente de sessão</dt>
                <dd className="font-medium">{e.presidenteSessao ? `${e.presidenteSessao.nome} (${e.presidenteSessao.cidade}/${e.presidenteSessao.uf})` : 'A definir'}</dd>
              </div>
              <div>
                <dt className="text-tinta/60">Mesários</dt>
                <dd className="font-medium">{e.mesarios.length ? e.mesarios.map((m) => m.nome).join(', ') : 'Nenhum'}</dd>
              </div>
            </dl>
          </Painel>

          {admin && (
            <Painel>
              <h2 className="text-2xl font-semibold">Administração</h2>
              <div className="mt-3 flex flex-col gap-2">
                {e.status === 'rascunho' && (
                  <>
                    <p className="text-sm text-tinta/70">
                      Agendar confirma a eleição e fecha a lista de aptos. Na abertura, cada membro apto vota com o próprio CPF.
                      {!e.presidenteSessao && ' Defina o presidente de sessão antes.'}
                      {deferidas.length === 0 && ' Registre ao menos um candidato deferido antes.'}
                    </p>
                    <Botao
                      carregando={ocupado}
                      disabled={!e.presidenteSessao || deferidas.length === 0}
                      onClick={() =>
                        acao(async () => {
                          const r = await api<{ aptos: number }>(`/eleicoes/${e.id}/agendar`, { metodo: 'POST' });
                          setOk(`Eleição agendada com ${r.aptos} membro(s) aptos.`);
                        })
                      }
                    >
                      Agendar eleição
                    </Botao>
                  </>
                )}
                {e.status === 'agendada' && (
                  <Botao
                    variante="secundario"
                    carregando={ocupado}
                    onClick={() =>
                      confirm('Voltar para Rascunho reabre a lista de aptos. Continuar?') &&
                      acao(() => api(`/eleicoes/${e.id}/rascunho`, { metodo: 'POST' }), 'Eleição voltou para Rascunho.')
                    }
                  >
                    Voltar para rascunho
                  </Botao>
                )}
                {editavel && (
                  <Botao variante="secundario" onClick={() => setEditando(!editando)}>
                    {editando ? 'Fechar edição' : 'Editar dados e mesa'}
                  </Botao>
                )}
                {e.status === 'rascunho' && (
                  <Botao
                    variante="perigo"
                    onClick={() =>
                      confirm('Excluir esta eleição?') &&
                      acao(async () => {
                        await api(`/eleicoes/${e.id}`, { metodo: 'DELETE' });
                        router.push('/eleicoes');
                      })
                    }
                  >
                    Excluir eleição
                  </Botao>
                )}
                {!editavel && <p className="text-sm text-tinta/70">Dados, mesa e candidatos ficam travados depois que a votação abre.</p>}
              </div>
            </Painel>
          )}
        </div>
      </div>

      {editando && admin && editavel && (
        <Painel className="mt-6">
          <h2 className="mb-4 text-2xl font-semibold">Editar eleição</h2>
          <FormEleicao
            rotuloBotao="Salvar alterações"
            bloquearInicio={e.status === 'agendada'}
            inicial={{
              titulo: e.titulo,
              inicio: e.inicio,
              termino: e.termino,
              presidenteSessaoId: e.presidenteSessao?.id ?? null,
              mesarioIds: e.mesarios.map((m) => m.id),
            }}
            aoSalvar={async (d) => {
              await api(`/eleicoes/${e.id}`, { metodo: 'PUT', corpo: d });
              setEditando(false);
              setOk('Eleição atualizada. As candidaturas foram reavaliadas.');
              await carregar();
            }}
          />
        </Painel>
      )}

    </>
  );
}

function Candidaturas({ e, podeEditar, aoMudar }: { e: Detalhe; podeEditar: boolean; aoMudar: () => void }) {
  const [membros, setMembros] = useState<MembroSimples[]>([]);
  const [membroId, setMembroId] = useState('');
  const [apelido, setApelido] = useState('');
  const [retorno, setRetorno] = useState<{ tipo: 'ok' | 'erro'; msgs: string[] } | null>(null);

  useEffect(() => {
    if (podeEditar) api<MembroSimples[]>('/membros').then(setMembros);
  }, [podeEditar]);

  const jaInscritos = new Set(e.candidaturas.map((c) => c.membroId));

  async function registrar(ev: FormEvent) {
    ev.preventDefault();
    setRetorno(null);
    try {
      const r = await api<{ nome: string; situacao: string; motivo: string | null }>(`/eleicoes/${e.id}/candidaturas`, {
        corpo: { membroId: Number(membroId), apelido: apelido || undefined },
      });
      setRetorno(
        r.situacao === 'deferida'
          ? { tipo: 'ok', msgs: [`Candidatura de ${r.nome} deferida.`] }
          : { tipo: 'erro', msgs: [`Candidatura de ${r.nome} indeferida: ${r.motivo}`] },
      );
      setMembroId('');
      setApelido('');
      aoMudar();
    } catch (err) {
      setRetorno({ tipo: 'erro', msgs: mensagemDe(err) });
    }
  }

  async function remover(id: number, nome: string) {
    if (!confirm(`Retirar a candidatura de ${nome}?`)) return;
    await api(`/eleicoes/${e.id}/candidaturas/${id}`, { metodo: 'DELETE' });
    aoMudar();
  }

  return (
    <Painel>
      <h2 className="text-2xl font-semibold">Candidaturas</h2>
      <p className="mt-1 text-sm text-tinta/70">
        É deferido quem tem 3 anos de colete fechado até o início da eleição, está habilitado e não compõe a mesa. Todos concorrem a presidente; o vice sai da apuração.
      </p>

      {e.candidaturas.length === 0 ? (
        <p className="mt-4 text-tinta/70">Nenhum candidato registrado.</p>
      ) : (
        <ul className="mt-4 divide-y divide-asfalto-linha">
          {e.candidaturas.map((c) => (
            <li key={c.id} className="flex flex-wrap items-start gap-x-4 gap-y-1 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {c.nome}
                  {c.apelido && <span className="text-tinta/60"> “{c.apelido}”</span>}
                  <span className="text-tinta/60">
                    {' '}
                    · {c.cidade}/{c.uf}
                  </span>
                </p>
                {c.situacao === 'deferida' ? (
                  <p className="text-sm font-semibold text-apto">Deferida</p>
                ) : (
                  <p className="text-sm text-alerta">
                    <span className="font-semibold">Indeferida:</span> {c.motivo}
                  </p>
                )}
              </div>
              {podeEditar && (
                <Botao variante="discreto" onClick={() => remover(c.id, c.nome)}>
                  Retirar
                </Botao>
              )}
            </li>
          ))}
        </ul>
      )}

      {podeEditar && (
        <form onSubmit={registrar} className="mt-5 grid gap-3 border-t border-asfalto-linha pt-5 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
          <Campo rotulo="Registrar candidato">
            <Selecao value={membroId} onChange={(ev) => setMembroId(ev.target.value)} required>
              <option value="">Escolher membro</option>
              {membros
                .filter((m) => !jaInscritos.has(m.id))
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome} ({m.cidade}/{m.uf})
                  </option>
                ))}
            </Selecao>
          </Campo>
          <Campo rotulo="Apelido na cédula">
            <Entrada value={apelido} onChange={(ev) => setApelido(ev.target.value)} placeholder="Opcional" maxLength={30} />
          </Campo>
          <Botao type="submit">Registrar</Botao>
          {retorno && (
            <div className="sm:col-span-3">
              <Aviso tipo={retorno.tipo} mensagens={retorno.msgs} />
            </div>
          )}
        </form>
      )}
    </Painel>
  );
}
