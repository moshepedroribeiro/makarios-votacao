'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Aviso, Botao, Campo, Entrada, Selecao } from '@/components/ui';
import { api, mensagemDe } from '@/lib/api';
import { paraInputLocal } from '@/lib/formato';

export interface MembroSimples {
  id: number;
  nome: string;
  cidade: string;
  uf: string;
  ativo: boolean;
}

export interface DadosFormEleicao {
  titulo: string;
  inicio: string; // ISO
  termino: string; // ISO
  presidenteSessaoId: number | null;
  mesarioIds: number[];
}

const DURACAO_PADRAO_MIN = 30;

export function FormEleicao({
  inicial,
  bloquearInicio,
  aoSalvar,
  rotuloBotao,
}: {
  inicial?: DadosFormEleicao;
  bloquearInicio?: boolean;
  aoSalvar: (d: DadosFormEleicao) => Promise<void>;
  rotuloBotao: string;
}) {
  const [membros, setMembros] = useState<MembroSimples[]>([]);
  const [titulo, setTitulo] = useState(inicial?.titulo ?? '');
  const [inicio, setInicio] = useState(inicial ? paraInputLocal(inicial.inicio) : '');
  const [termino, setTermino] = useState(inicial ? paraInputLocal(inicial.termino) : '');
  const [terminoTocado, setTerminoTocado] = useState(!!inicial);
  const [ps, setPs] = useState<string>(inicial?.presidenteSessaoId ? String(inicial.presidenteSessaoId) : '');
  const [mesarios, setMesarios] = useState<number[]>(inicial?.mesarioIds ?? []);
  const [novoMesario, setNovoMesario] = useState('');
  const [erros, setErros] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    api<MembroSimples[]>('/membros').then(setMembros);
  }, []);

  function mudarInicio(v: string) {
    setInicio(v);
    // Sugere o término 30 minutos depois, enquanto o usuário não mexer nele.
    if (v && !terminoTocado) {
      const d = new Date(new Date(v).getTime() + DURACAO_PADRAO_MIN * 60_000);
      setTermino(paraInputLocal(d.toISOString()));
    }
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErros([]);
    if (!inicio || !termino) return setErros(['Informe início e término.']);
    setSalvando(true);
    try {
      await aoSalvar({
        titulo,
        inicio: new Date(inicio).toISOString(),
        termino: new Date(termino).toISOString(),
        presidenteSessaoId: ps ? Number(ps) : null,
        mesarioIds: mesarios,
      });
    } catch (err) {
      setErros(mensagemDe(err));
    } finally {
      setSalvando(false);
    }
  }

  const nome = (id: number) => membros.find((m) => m.id === id);
  const duracao = inicio && termino ? Math.round((new Date(termino).getTime() - new Date(inicio).getTime()) / 60000) : null;
  const disponiveis = membros.filter((m) => String(m.id) !== ps && !mesarios.includes(m.id));

  return (
    <form onSubmit={salvar} className="grid gap-5 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Campo rotulo="Título">
          <Entrada value={titulo} onChange={(e) => setTitulo(e.target.value)} required placeholder="Eleição 2027–2029" />
        </Campo>
      </div>
      <Campo rotulo="Início da votação" ajuda={bloquearInicio ? 'Para mudar o início, volte a eleição para Rascunho.' : undefined}>
        <Entrada type="datetime-local" value={inicio} onChange={(e) => mudarInicio(e.target.value)} required disabled={bloquearInicio} />
      </Campo>
      <Campo
        rotulo="Término da votação"
        ajuda={duracao !== null ? (duracao > 0 ? `Votação aberta por ${duracao} minutos.` : 'O término precisa ser depois do início.') : 'Sugerido 30 minutos após o início.'}
      >
        <Entrada
          type="datetime-local"
          value={termino}
          onChange={(e) => {
            setTerminoTocado(true);
            setTermino(e.target.value);
          }}
          required
        />
      </Campo>
      <div className="sm:col-span-2">
        <Campo rotulo="Moderador de eleição" ajuda="Não pode ser candidato nesta eleição.">
          <Selecao value={ps} onChange={(e) => setPs(e.target.value)}>
            <option value="">A definir</option>
            {membros
              .filter((m) => !mesarios.includes(m.id))
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome} ({m.cidade}/{m.uf})
                </option>
              ))}
          </Selecao>
        </Campo>
      </div>
      <div className="sm:col-span-2">
        <span className="mb-1 block text-sm font-semibold text-couro">Mesários (opcional)</span>
        {mesarios.length > 0 && (
          <ul className="mb-2 flex flex-wrap gap-2">
            {mesarios.map((id) => (
              <li key={id} className="flex items-center gap-2 rounded bg-asfalto px-3 py-1 text-sm">
                {nome(id)?.nome ?? `Membro ${id}`}
                <button type="button" onClick={() => setMesarios(mesarios.filter((x) => x !== id))} aria-label={`Retirar ${nome(id)?.nome}`} className="text-alerta">
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <Selecao value={novoMesario} onChange={(e) => setNovoMesario(e.target.value)} aria-label="Escolher mesário">
            <option value="">Escolher membro</option>
            {disponiveis.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome} ({m.cidade}/{m.uf})
              </option>
            ))}
          </Selecao>
          <Botao
            type="button"
            variante="secundario"
            disabled={!novoMesario}
            onClick={() => {
              setMesarios([...mesarios, Number(novoMesario)]);
              setNovoMesario('');
            }}
          >
            Adicionar
          </Botao>
        </div>
      </div>
      <div className="sm:col-span-2">
        <Aviso mensagens={erros} />
      </div>
      <div className="sm:col-span-2">
        <Botao type="submit" carregando={salvando}>
          {rotuloBotao}
        </Botao>
      </div>
    </form>
  );
}
