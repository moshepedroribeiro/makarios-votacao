'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSessao } from '@/components/sessao';
import { Carregando, Painel, SeloStatus, Titulo } from '@/components/ui';
import { api } from '@/lib/api';
import { dataHora, Status } from '@/lib/formato';

interface Item {
  id: number;
  titulo: string;
  inicio: string;
  termino: string;
  status: Status;
  presidenteSessao: string | null;
  candidatos: number;
  meuPapel: string | null;
}

const PAPEL: Record<string, string> = { presidente: 'Você preside a sessão', mesario: 'Você é mesário' };

export default function Eleicoes() {
  const { usuario } = useSessao();
  const [itens, setItens] = useState<Item[] | null>(null);
  useEffect(() => {
    api<Item[]>('/eleicoes').then(setItens);
  }, []);

  return (
    <>
      <Titulo
        acoes={
          usuario?.perfil === 'ADMIN' && (
            <Link href="/eleicoes/nova" className="inline-flex min-h-10 items-center rounded-md bg-couro px-4 font-medium text-asfalto-claro hover:bg-couro-claro">
              Criar eleição
            </Link>
          )
        }
      >
        Eleições
      </Titulo>
      {!itens ? (
        <Carregando />
      ) : itens.length === 0 ? (
        <Painel>
          <p className="text-tinta/70">
            {usuario?.perfil === 'ADMIN'
              ? 'Nenhuma eleição cadastrada. Crie a próxima eleição para definir a mesa e registrar os candidatos.'
              : 'Você ainda não foi designado para a mesa de nenhuma eleição.'}
          </p>
        </Painel>
      ) : (
        <ul className="space-y-3">
          {itens.map((e) => (
            <li key={e.id}>
              <Link
                href={`/eleicoes/${e.id}`}
                className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-asfalto-linha bg-white px-5 py-4 hover:border-bordado"
              >
                <div className="min-w-0 flex-1">
                  <h2 className="text-2xl font-semibold">{e.titulo}</h2>
                  <p className="text-sm text-tinta/70">
                    {dataHora(e.inicio)} até {dataHora(e.termino)} · presidente de sessão: {e.presidenteSessao ?? 'a definir'} ·{' '}
                    {e.candidatos} candidato(s) deferido(s)
                  </p>
                  {e.meuPapel && PAPEL[e.meuPapel] && <p className="mt-1 text-sm font-semibold text-bordado-escuro">{PAPEL[e.meuPapel]}</p>}
                </div>
                <SeloStatus status={e.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
