'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Emblema } from '@/components/emblema';
import { api } from '@/lib/api';
import { dataHora } from '@/lib/formato';

interface Situacao {
  aberta: boolean;
  titulo?: string;
  termino?: string;
  proxima?: { titulo: string; inicio: string; termino: string } | null;
}

export default function Inicio() {
  const [s, setS] = useState<Situacao | null>(null);
  useEffect(() => {
    api<Situacao>('/votacao/situacao').then(setS).catch(() => setS({ aberta: false }));
  }, []);

  return (
    <main className="flex min-h-screen flex-col bg-couro text-asfalto-claro">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 py-16">
        <Emblema tamanho={72} />
        <h1 className="mt-6 font-titulo text-6xl font-bold leading-[0.95] text-asfalto-claro sm:text-7xl">
          Eleição do
          <br />
          Motoclube Makários
        </h1>
        <p className="mt-5 max-w-lg text-lg text-asfalto-claro/75">
          Presidente e vice-presidente, a cada dois anos. Cada membro full patch apto vota uma vez, em sigilo, de onde
          estiver.
        </p>

        <div className="mt-10 rounded-xl border border-bordado/40 p-5">
          {s === null ? (
            <p className="text-asfalto-claro/60">Verificando a votação…</p>
          ) : s.aberta ? (
            <>
              <p className="font-titulo text-2xl text-bordado-claro">{s.titulo}: votação aberta</p>
              <p className="mt-1 text-asfalto-claro/70">Encerra às {s.termino && dataHora(s.termino)}.</p>
              <Link
                href="/votar"
                className="mt-4 inline-flex min-h-12 items-center rounded-md bg-bordado px-6 font-semibold text-couro hover:bg-bordado-claro"
              >
                Votar agora
              </Link>
            </>
          ) : s.proxima ? (
            <>
              <p className="font-titulo text-2xl text-bordado-claro">{s.proxima.titulo}</p>
              <p className="mt-1 text-asfalto-claro/70">
                A votação abre em {dataHora(s.proxima.inicio)} e fecha em {dataHora(s.proxima.termino)}. Para votar, basta
                o seu CPF.
              </p>
            </>
          ) : (
            <p className="text-asfalto-claro/70">Nenhuma votação aberta ou agendada no momento.</p>
          )}
        </div>
      </div>
      <footer className="mx-auto w-full max-w-3xl px-6 pb-8">
        <Link href="/login" className="text-asfalto-claro/70 underline-offset-4 hover:text-asfalto-claro hover:underline">
          Acesso da mesa e da administração
        </Link>
      </footer>
    </main>
  );
}
