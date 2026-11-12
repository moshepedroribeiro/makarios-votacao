'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { MembroSimples } from '@/components/form-eleicao';
import { Aviso, Botao, Campo, Carregando, Entrada, Painel, Selecao, Titulo } from '@/components/ui';
import { api, mensagemDe } from '@/lib/api';

interface Usuario {
  id: number;
  login: string;
  perfil: 'ADMIN' | 'MESA';
  membroId: number | null;
  membroNome: string | null;
  ativo: number;
}

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[] | null>(null);
  const [membros, setMembros] = useState<MembroSimples[]>([]);
  const [form, setForm] = useState({ login: '', senha: '', perfil: 'MESA', membroId: '' });
  const [erros, setErros] = useState<string[]>([]);
  const [ok, setOk] = useState('');

  const carregar = useCallback(async () => setUsuarios(await api<Usuario[]>('/usuarios')), []);
  useEffect(() => {
    carregar();
    api<MembroSimples[]>('/membros').then(setMembros);
  }, [carregar]);

  async function criar(e: FormEvent) {
    e.preventDefault();
    setErros([]);
    setOk('');
    try {
      await api('/usuarios', { corpo: { ...form, membroId: form.membroId ? Number(form.membroId) : undefined } });
      setOk(`Usuário ${form.login} criado.`);
      setForm({ login: '', senha: '', perfil: 'MESA', membroId: '' });
      carregar();
    } catch (err) {
      setErros(mensagemDe(err));
    }
  }

  async function desativar(u: Usuario) {
    if (!confirm(`Desativar o acesso de ${u.login}?`)) return;
    try {
      await api(`/usuarios/${u.id}`, { metodo: 'DELETE' });
      carregar();
    } catch (err) {
      setErros(mensagemDe(err));
    }
  }

  return (
    <>
      <Titulo descricao="Acessos da administração e da mesa. O moderador de eleição e os mesários precisam de um usuário vinculado ao seu cadastro de membro; ele só vale nas eleições em que foram designados.">
        Usuários
      </Titulo>
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        {!usuarios ? (
          <Carregando />
        ) : (
          <Painel className="overflow-x-auto">
            <table className="w-full min-w-[30rem] text-left text-sm">
              <thead className="border-b border-asfalto-linha font-titulo text-base text-couro">
                <tr>
                  <th className="py-2 pr-3 font-semibold">Login</th>
                  <th className="py-2 pr-3 font-semibold">Perfil</th>
                  <th className="py-2 pr-3 font-semibold">Membro</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-asfalto-linha">
                {usuarios.map((u) => (
                  <tr key={u.id} className={u.ativo ? '' : 'text-tinta/40'}>
                    <td className="py-2 pr-3 font-medium">{u.login}</td>
                    <td className="py-2 pr-3">{u.perfil === 'ADMIN' ? 'Administrador' : 'Mesa'}</td>
                    <td className="py-2 pr-3">{u.membroNome ?? '—'}</td>
                    <td className="py-2 text-right">
                      {u.ativo ? (
                        <Botao variante="discreto" onClick={() => desativar(u)}>
                          Desativar
                        </Botao>
                      ) : (
                        'Desativado'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Painel>
        )}
        <Painel>
          <h2 className="text-2xl font-semibold">Criar usuário</h2>
          <form onSubmit={criar} className="mt-4 space-y-4">
            <Campo rotulo="Login">
              <Entrada value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} required />
            </Campo>
            <Campo rotulo="Senha" ajuda="Mínimo de 6 caracteres.">
              <Entrada type="password" value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} required minLength={6} autoComplete="new-password" />
            </Campo>
            <Campo rotulo="Perfil">
              <Selecao value={form.perfil} onChange={(e) => setForm({ ...form, perfil: e.target.value })}>
                <option value="MESA">Mesa (moderador de eleição ou mesário)</option>
                <option value="ADMIN">Administrador</option>
              </Selecao>
            </Campo>
            <Campo rotulo="Membro vinculado" ajuda={form.perfil === 'MESA' ? 'Obrigatório para a mesa.' : 'Opcional.'}>
              <Selecao value={form.membroId} onChange={(e) => setForm({ ...form, membroId: e.target.value })} required={form.perfil === 'MESA'}>
                <option value="">Nenhum</option>
                {membros.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome}
                  </option>
                ))}
              </Selecao>
            </Campo>
            <Aviso mensagens={erros} />
            {ok && <Aviso tipo="ok" mensagens={[ok]} />}
            <Botao type="submit" className="w-full">
              Criar usuário
            </Botao>
          </form>
        </Painel>
      </div>
    </>
  );
}
