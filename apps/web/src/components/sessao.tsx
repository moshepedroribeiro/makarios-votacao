'use client';

import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '@/lib/api';

export interface Usuario {
  id: number;
  login: string;
  perfil: 'ADMIN' | 'MESA';
  membroId: number | null;
  nome: string;
}

interface Contexto {
  usuario: Usuario | null;
  carregando: boolean;
  recarregar: () => Promise<void>;
  sair: () => Promise<void>;
}

const Ctx = createContext<Contexto>({ usuario: null, carregando: true, recarregar: async () => {}, sair: async () => {} });

export function ProvedorSessao({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);

  const recarregar = useCallback(async () => {
    try {
      setUsuario(await api<Usuario>('/auth/eu'));
    } catch {
      setUsuario(null);
    } finally {
      setCarregando(false);
    }
  }, []);

  const sair = useCallback(async () => {
    await api('/auth/logout', { metodo: 'POST' }).catch(() => {});
    setUsuario(null);
  }, []);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  return <Ctx.Provider value={{ usuario, carregando, recarregar, sair }}>{children}</Ctx.Provider>;
}

export const useSessao = () => useContext(Ctx);
