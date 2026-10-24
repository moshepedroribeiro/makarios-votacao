'use client';

import { useRouter } from 'next/navigation';
import { FormEleicao } from '@/components/form-eleicao';
import { Painel, Titulo } from '@/components/ui';
import { api } from '@/lib/api';

export default function NovaEleicao() {
  const router = useRouter();
  return (
    <>
      <Titulo descricao="Depois de criar, registre os candidatos e agende a eleição para fechar a lista de aptos.">
        Criar eleição
      </Titulo>
      <Painel className="max-w-3xl">
        <FormEleicao
          rotuloBotao="Criar eleição"
          aoSalvar={async (d) => {
            const r = await api<{ id: number }>('/eleicoes', { corpo: d });
            router.push(`/eleicoes/${r.id}`);
          }}
        />
      </Painel>
    </>
  );
}
