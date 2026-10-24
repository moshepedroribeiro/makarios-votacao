'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Aviso, Botao, Campo, Carregando, Entrada, Modal, Painel, SeloAptidao, Selecao, Titulo } from '@/components/ui';
import { api, mensagemDe } from '@/lib/api';
import { CIDADES, dataBr, mascaraCpf, ufDaCidade } from '@/lib/formato';

interface Membro {
  id: number;
  nome: string;
  cpf: string;
  dataNascimento: string;
  dataEntrada: string;
  dataColeteamento: string | null;
  dataFechamento: string | null;
  cidade: string;
  uf: string;
  habilitado: boolean;
  ativo: boolean;
  apto: boolean;
  motivoInapto: string | null;
}

const VAZIO = { nome: '', cpf: '', dataNascimento: '', dataEntrada: '', dataColeteamento: '', dataFechamento: '', cidade: '' };

export default function Membros() {
  const [membros, setMembros] = useState<Membro[] | null>(null);
  const [busca, setBusca] = useState('');
  const [cidade, setCidade] = useState('');
  const [apto, setApto] = useState('');
  const [inativos, setInativos] = useState(false);
  const [editando, setEditando] = useState<{ id?: number; dados: typeof VAZIO } | null>(null);
  const [habilitando, setHabilitando] = useState<Membro | null>(null);
  const [importando, setImportando] = useState(false);
  const [aviso, setAviso] = useState('');

  const carregar = useCallback(async () => {
    const q = new URLSearchParams({ busca, cidade, apto, inativos: String(inativos) });
    setMembros(await api<Membro[]>(`/membros?${q}`));
  }, [busca, cidade, apto, inativos]);

  useEffect(() => {
    const t = setTimeout(carregar, 200);
    return () => clearTimeout(t);
  }, [carregar]);

  async function abrirEdicao(id: number) {
    const m = await api<Membro>(`/membros/${id}`);
    setEditando({
      id,
      dados: {
        nome: m.nome,
        cpf: mascaraCpf(m.cpf),
        dataNascimento: m.dataNascimento,
        dataEntrada: m.dataEntrada,
        dataColeteamento: m.dataColeteamento ?? '',
        dataFechamento: m.dataFechamento ?? '',
        cidade: m.cidade,
      },
    });
  }

  async function remover(m: Membro) {
    if (!confirm(`Remover ${m.nome}? Se ele já participou de alguma eleição, será apenas inativado.`)) return;
    const r = await api<{ acao: string }>(`/membros/${m.id}`, { metodo: 'DELETE' });
    setAviso(`${m.nome} ${r.acao === 'apagado' ? 'foi removido' : 'foi inativado (já participou de eleição)'}.`);
    carregar();
  }

  async function reativar(m: Membro) {
    await api(`/membros/${m.id}/reativar`, { metodo: 'POST' });
    carregar();
  }

  const totalAptos = membros?.filter((m) => m.apto).length ?? 0;

  return (
    <>
      <Titulo
        descricao="Membros full patch. Só vota quem tem colete fechado e está habilitado."
        acoes={
          <>
            <Botao variante="secundario" onClick={() => setImportando(true)}>
              Importar planilha
            </Botao>
            <Botao onClick={() => setEditando({ dados: { ...VAZIO } })}>Cadastrar membro</Botao>
          </>
        }
      >
        Membros
      </Titulo>

      {aviso && (
        <div className="mb-4">
          <Aviso tipo="ok" mensagens={[aviso]} />
        </div>
      )}

      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
        <Campo rotulo="Buscar por nome ou CPF">
          <Entrada value={busca} onChange={(e) => setBusca(e.target.value)} type="search" />
        </Campo>
        <Campo rotulo="Cidade">
          <Selecao value={cidade} onChange={(e) => setCidade(e.target.value)}>
            <option value="">Todas</option>
            {CIDADES.map((c) => (
              <option key={c.cidade} value={c.cidade}>
                {c.cidade}
              </option>
            ))}
          </Selecao>
        </Campo>
        <Campo rotulo="Situação">
          <Selecao value={apto} onChange={(e) => setApto(e.target.value)}>
            <option value="">Todos</option>
            <option value="true">Aptos</option>
            <option value="false">Inaptos</option>
          </Selecao>
        </Campo>
        <label className="flex min-h-10 items-center gap-2 text-sm">
          <input type="checkbox" checked={inativos} onChange={(e) => setInativos(e.target.checked)} className="h-4 w-4 accent-couro" />
          Mostrar inativos
        </label>
      </div>

      {!membros ? (
        <Carregando />
      ) : membros.length === 0 ? (
        <Painel>
          <p className="text-tinta/70">Nenhum membro encontrado. Cadastre o primeiro ou importe a planilha do clube.</p>
        </Painel>
      ) : (
        <Painel className="overflow-x-auto p-0 sm:p-0">
          <table className="w-full min-w-[56rem] text-left text-sm">
            <caption className="px-5 py-3 text-left text-tinta/70">
              {membros.length} membro(s) · {totalAptos} apto(s) a votar
            </caption>
            <thead className="border-y border-asfalto-linha bg-asfalto-claro font-titulo text-base text-couro">
              <tr>
                <th className="px-5 py-2 font-semibold">Nome</th>
                <th className="px-3 py-2 font-semibold">CPF</th>
                <th className="px-3 py-2 font-semibold">Cidade</th>
                <th className="px-3 py-2 font-semibold">Coleteamento</th>
                <th className="px-3 py-2 font-semibold">Fechamento</th>
                <th className="px-3 py-2 font-semibold">Voto</th>
                <th className="px-5 py-2 text-right font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-asfalto-linha">
              {membros.map((m) => (
                <tr key={m.id} className={m.ativo ? '' : 'text-tinta/45'}>
                  <td className="px-5 py-2.5 font-medium">
                    {m.nome}
                    {!m.ativo && <span className="ml-2 text-xs">(inativo)</span>}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">{m.cpf}</td>
                  <td className="px-3 py-2.5">
                    {m.cidade}/{m.uf}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">{dataBr(m.dataColeteamento)}</td>
                  <td className="px-3 py-2.5 tabular-nums">{dataBr(m.dataFechamento)}</td>
                  <td className="px-3 py-2.5">
                    <SeloAptidao apto={m.apto} motivo={m.motivoInapto} />
                  </td>
                  <td className="whitespace-nowrap px-5 py-2.5 text-right">
                    {m.ativo ? (
                      <>
                        <Botao variante="discreto" onClick={() => abrirEdicao(m.id)}>
                          Editar
                        </Botao>
                        <Botao variante="discreto" onClick={() => setHabilitando(m)}>
                          {m.habilitado ? 'Desabilitar' : 'Habilitar'}
                        </Botao>
                        <Botao variante="discreto" onClick={() => remover(m)}>
                          Remover
                        </Botao>
                      </>
                    ) : (
                      <Botao variante="discreto" onClick={() => reativar(m)}>
                        Reativar
                      </Botao>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Painel>
      )}

      {editando && (
        <FormMembro
          inicial={editando}
          aoFechar={() => setEditando(null)}
          aoSalvar={(nome) => {
            setEditando(null);
            setAviso(`${nome} salvo.`);
            carregar();
          }}
        />
      )}
      {habilitando && (
        <FormHabilitacao
          membro={habilitando}
          aoFechar={() => setHabilitando(null)}
          aoSalvar={() => {
            setHabilitando(null);
            carregar();
          }}
        />
      )}
      {importando && (
        <FormImportacao
          aoFechar={() => {
            setImportando(false);
            carregar();
          }}
        />
      )}
    </>
  );
}

function FormMembro({
  inicial,
  aoFechar,
  aoSalvar,
}: {
  inicial: { id?: number; dados: typeof VAZIO };
  aoFechar: () => void;
  aoSalvar: (nome: string) => void;
}) {
  const [d, setD] = useState(inicial.dados);
  const [erros, setErros] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const muda = (k: keyof typeof VAZIO) => (e: { target: { value: string } }) => setD({ ...d, [k]: e.target.value });

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErros([]);
    setSalvando(true);
    try {
      const corpo = { ...d, dataColeteamento: d.dataColeteamento || null, dataFechamento: d.dataFechamento || null };
      if (inicial.id) await api(`/membros/${inicial.id}`, { metodo: 'PUT', corpo });
      else await api('/membros', { corpo });
      aoSalvar(d.nome);
    } catch (err) {
      setErros(mensagemDe(err));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal aberto aoFechar={aoFechar} titulo={inicial.id ? 'Editar membro' : 'Cadastrar membro'}>
      <form onSubmit={salvar} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Campo rotulo="Nome completo">
            <Entrada value={d.nome} onChange={muda('nome')} required autoFocus />
          </Campo>
        </div>
        <Campo rotulo="CPF">
          <Entrada value={d.cpf} onChange={(e) => setD({ ...d, cpf: mascaraCpf(e.target.value) })} inputMode="numeric" required />
        </Campo>
        <Campo rotulo="Data de nascimento" ajuda="Usada no desempate para presidente.">
          <Entrada type="date" value={d.dataNascimento} onChange={muda('dataNascimento')} required />
        </Campo>
        <Campo rotulo="Data de entrada">
          <Entrada type="date" value={d.dataEntrada} onChange={muda('dataEntrada')} required />
        </Campo>
        <Campo rotulo="Data de coleteamento" ajuda="Opcional.">
          <Entrada
            type="date"
            value={d.dataColeteamento}
            onChange={(e) => setD({ ...d, dataColeteamento: e.target.value, dataFechamento: e.target.value ? d.dataFechamento : '' })}
          />
        </Campo>
        <Campo
          rotulo="Data de fechamento"
          ajuda={d.dataColeteamento ? 'Opcional. Sem fechamento, o membro não vota.' : 'Informe o coleteamento primeiro.'}
        >
          <Entrada type="date" value={d.dataFechamento} onChange={muda('dataFechamento')} disabled={!d.dataColeteamento} />
        </Campo>
        <Campo rotulo="Cidade">
          <Selecao value={d.cidade} onChange={muda('cidade')} required>
            <option value="">Selecione</option>
            {CIDADES.map((c) => (
              <option key={c.cidade} value={c.cidade}>
                {c.cidade}
              </option>
            ))}
          </Selecao>
        </Campo>
        <Campo rotulo="Estado">
          <Entrada value={ufDaCidade(d.cidade)} readOnly disabled placeholder="Definido pela cidade" />
        </Campo>
        <div className="sm:col-span-2">
          <Aviso mensagens={erros} />
        </div>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Botao type="button" variante="secundario" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao type="submit" carregando={salvando}>
            Salvar membro
          </Botao>
        </div>
      </form>
    </Modal>
  );
}

function FormHabilitacao({ membro, aoFechar, aoSalvar }: { membro: Membro; aoFechar: () => void; aoSalvar: () => void }) {
  const [motivo, setMotivo] = useState('');
  const [erros, setErros] = useState<string[]>([]);
  const [historico, setHistorico] = useState<any[]>([]);
  const novo = !membro.habilitado;

  useEffect(() => {
    api<any[]>(`/membros/${membro.id}/historico`).then(setHistorico).catch(() => {});
  }, [membro.id]);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    try {
      await api(`/membros/${membro.id}/habilitacao`, { metodo: 'PATCH', corpo: { habilitado: novo, motivo } });
      aoSalvar();
    } catch (err) {
      setErros(mensagemDe(err));
    }
  }

  return (
    <Modal aberto aoFechar={aoFechar} titulo={`${novo ? 'Habilitar' : 'Desabilitar'} ${membro.nome}`}>
      <form onSubmit={salvar} className="space-y-4">
        <p className="text-sm text-tinta/70">
          {novo
            ? 'O membro volta a poder votar (se tiver colete fechado).'
            : 'Use para inadimplentes. O membro não poderá votar nem ter candidatura deferida.'}
        </p>
        <Campo rotulo="Motivo">
          <Entrada value={motivo} onChange={(e) => setMotivo(e.target.value)} required autoFocus placeholder={novo ? 'Ex.: mensalidades quitadas' : 'Ex.: mensalidades em atraso'} />
        </Campo>
        <Aviso mensagens={erros} />
        {historico.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold">Histórico</h3>
            <ul className="mt-1 space-y-1 text-sm text-tinta/75">
              {historico.map((h, i) => (
                <li key={i}>
                  {new Date(h.alteradoEm).toLocaleString('pt-BR')}: {h.habilitado ? 'habilitado' : 'desabilitado'} por {h.alteradoPor} — {h.motivo}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Botao type="button" variante="secundario" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao type="submit" variante={novo ? 'primario' : 'perigo'}>
            {novo ? 'Habilitar' : 'Desabilitar'}
          </Botao>
        </div>
      </form>
    </Modal>
  );
}

function FormImportacao({ aoFechar }: { aoFechar: () => void }) {
  const [resultado, setResultado] = useState<{ criados: number; erros: { linha: number; erros: string[] }[] } | null>(null);
  const [erros, setErros] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);

  async function enviar(arquivo: File) {
    setEnviando(true);
    setErros([]);
    try {
      setResultado(await api('/membros/importar', { corpo: { csv: await arquivo.text() } }));
    } catch (err) {
      setErros(mensagemDe(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal aberto aoFechar={aoFechar} titulo="Importar membros">
      <div className="space-y-4 text-sm">
        <p>Envie um arquivo CSV (separado por ponto e vírgula) com este cabeçalho:</p>
        <pre className="overflow-x-auto rounded bg-asfalto-claro p-3 text-xs">
          nome;cpf;data_nascimento;data_entrada;data_coleteamento;data_fechamento;cidade
          {'\n'}João da Silva;529.982.247-25;10/05/1980;01/02/2015;01/03/2016;20/03/2017;Cascavel
        </pre>
        <p className="text-tinta/70">Datas em DD/MM/AAAA. Coleteamento e fechamento podem ficar em branco.</p>
        <input
          type="file"
          accept=".csv,text/csv"
          disabled={enviando}
          onChange={(e) => e.target.files?.[0] && enviar(e.target.files[0])}
          className="block w-full text-sm file:mr-3 file:rounded file:border-0 file:bg-couro file:px-3 file:py-2 file:text-asfalto-claro"
        />
        <Aviso mensagens={erros} />
        {resultado && (
          <Aviso tipo={resultado.erros.length ? 'info' : 'ok'}>
            <p className="font-semibold">{resultado.criados} membro(s) importado(s).</p>
            {resultado.erros.length > 0 && (
              <ul className="mt-2 list-disc pl-5">
                {resultado.erros.map((e) => (
                  <li key={e.linha}>
                    Linha {e.linha}: {e.erros.join(' ')}
                  </li>
                ))}
              </ul>
            )}
          </Aviso>
        )}
        <div className="flex justify-end">
          <Botao variante="secundario" onClick={aoFechar}>
            Fechar
          </Botao>
        </div>
      </div>
    </Modal>
  );
}
