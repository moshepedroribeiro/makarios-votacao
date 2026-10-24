'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { Emblema } from '@/components/emblema';
import { useSessao } from '@/components/sessao';
import { Aviso, Botao, Campo, Entrada } from '@/components/ui';
import { api, mensagemDe } from '@/lib/api';

export default function Login() {
  const router = useRouter();
  const { usuario, recarregar } = useSessao();
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (usuario) router.replace('/eleicoes');
  }, [usuario, router]);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setErro([]);
    setEnviando(true);
    try {
      await api('/auth/login', { corpo: { login, senha } });
      await recarregar();
      router.replace('/eleicoes');
    } catch (err) {
      setErro(mensagemDe(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="inline-block">
          <Emblema tamanho={52} />
        </Link>
        <h1 className="mt-4 text-4xl font-semibold">Mesa e administração</h1>
        <p className="mt-1 text-tinta/70">Para votar não é preciso login: use o seu CPF na tela de votação.</p>
        <form onSubmit={entrar} className="mt-8 space-y-4">
          <Campo rotulo="Login">
            <Entrada value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username" required autoFocus />
          </Campo>
          <Campo rotulo="Senha">
            <Entrada type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" required />
          </Campo>
          <Aviso mensagens={erro} />
          <Botao type="submit" carregando={enviando} className="w-full">
            Entrar
          </Botao>
        </form>
      </div>
    </main>
  );
}
