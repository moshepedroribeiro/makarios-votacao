'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Emblema } from '@/components/emblema';
import { useSessao } from '@/components/sessao';
import { Carregando } from '@/components/ui';

export default function LayoutPainel({ children }: { children: React.ReactNode }) {
  const { usuario, carregando, sair } = useSessao();
  const router = useRouter();
  const caminho = usePathname();

  useEffect(() => {
    if (!carregando && !usuario) router.replace('/login');
  }, [carregando, usuario, router]);

  if (carregando || !usuario) return <Carregando />;

  const links = [
    { href: '/eleicoes', nome: 'Eleições' },
    ...(usuario.perfil === 'ADMIN'
      ? [
          { href: '/membros', nome: 'Membros' },
          { href: '/usuarios', nome: 'Usuários' },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen">
      <header className="nao-imprimir bg-couro text-asfalto-claro">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-2 px-4 py-3 sm:px-6">
          <Link href="/eleicoes" className="flex items-center gap-3">
            <Emblema tamanho={34} />
            <span className="font-titulo text-2xl font-semibold tracking-wide">Makários</span>
          </Link>
          <nav className="flex gap-1" aria-label="Principal">
            {links.map((l) => {
              const ativo = caminho.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={ativo ? 'page' : undefined}
                  className={`rounded px-3 py-1.5 font-medium ${ativo ? 'bg-couro-claro text-bordado-claro' : 'text-asfalto-claro/80 hover:text-asfalto-claro'}`}
                >
                  {l.nome}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-4 text-sm">
            <span className="text-asfalto-claro/70">
              {usuario.nome}
              {usuario.perfil === 'ADMIN' ? ' (administrador)' : ''}
            </span>
            <button
              onClick={async () => {
                await sair();
                router.replace('/login');
              }}
              className="underline-offset-4 hover:underline"
            >
              Sair
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
