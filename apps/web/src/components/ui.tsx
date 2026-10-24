'use client';

import { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, useEffect, useRef } from 'react';
import { NOME_STATUS, Status } from '@/lib/formato';

type Variante = 'primario' | 'destaque' | 'secundario' | 'perigo' | 'discreto';

const estilosBotao: Record<Variante, string> = {
  primario: 'bg-couro text-asfalto-claro hover:bg-couro-claro',
  destaque: 'bg-bordado text-couro hover:bg-bordado-claro',
  secundario: 'bg-white text-couro ring-1 ring-inset ring-asfalto-linha hover:bg-asfalto-claro',
  perigo: 'bg-alerta text-white hover:bg-[#8a1f22]',
  discreto: 'text-couro underline-offset-4 hover:underline px-1',
};

export function Botao({
  variante = 'primario',
  carregando,
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; carregando?: boolean }) {
  return (
    <button
      {...props}
      disabled={props.disabled || carregando}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 py-2 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${estilosBotao[variante]} ${className}`}
    >
      {carregando ? 'Aguarde…' : children}
    </button>
  );
}

export function Campo({ rotulo, ajuda, erro, children }: { rotulo: string; ajuda?: ReactNode; erro?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-couro">{rotulo}</span>
      {children}
      {ajuda && !erro && <span className="mt-1 block text-sm text-tinta/60">{ajuda}</span>}
      {erro && <span className="mt-1 block text-sm text-alerta">{erro}</span>}
    </label>
  );
}

const estiloEntrada =
  'block w-full rounded-md border border-asfalto-linha bg-white px-3 py-2 text-tinta placeholder:text-tinta/40 focus:border-bordado focus:outline-none focus:ring-2 focus:ring-bordado/40 disabled:bg-asfalto-claro disabled:text-tinta/50';

export function Entrada(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${estiloEntrada} ${props.className ?? ''}`} />;
}

export function Selecao(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${estiloEntrada} ${props.className ?? ''}`} />;
}

export function Painel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-lg border border-asfalto-linha bg-white p-5 sm:p-6 ${className}`}>{children}</section>;
}

export function Aviso({ tipo = 'erro', mensagens, children }: { tipo?: 'erro' | 'ok' | 'info'; mensagens?: string[]; children?: ReactNode }) {
  if (!children && (!mensagens || mensagens.length === 0)) return null;
  const cores = {
    erro: 'border-alerta/40 bg-alerta-fundo text-alerta',
    ok: 'border-apto/40 bg-apto-fundo text-apto',
    info: 'border-bordado/50 bg-[#FBF3E1] text-couro',
  }[tipo];
  return (
    <div role={tipo === 'erro' ? 'alert' : 'status'} className={`rounded-md border px-4 py-3 text-sm ${cores}`}>
      {mensagens && mensagens.length > 1 ? (
        <ul className="list-disc space-y-0.5 pl-5">
          {mensagens.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      ) : (
        mensagens?.[0]
      )}
      {children}
    </div>
  );
}

export function SeloStatus({ status }: { status: Status }) {
  const cores: Record<Status, string> = {
    rascunho: 'bg-white text-tinta/70 ring-1 ring-inset ring-asfalto-linha',
    agendada: 'bg-[#FBF3E1] text-bordado-escuro',
    aberta: 'bg-apto text-white',
    encerrada: 'bg-couro-claro text-asfalto-claro',
    aguardando_vice: 'bg-bordado text-couro',
    apurada: 'bg-couro text-bordado-claro',
  };
  return <span className={`inline-block whitespace-nowrap rounded px-2 py-0.5 text-sm font-semibold ${cores[status]}`}>{NOME_STATUS[status]}</span>;
}

export function SeloAptidao({ apto, motivo }: { apto: boolean; motivo?: string | null }) {
  return apto ? (
    <span className="whitespace-nowrap text-sm font-semibold text-apto">Apto</span>
  ) : (
    <span className="text-sm text-alerta" title={motivo ?? undefined}>
      <span className="font-semibold">Inapto</span>
      {motivo && <span className="text-alerta/80"> · {motivo}</span>}
    </span>
  );
}

export function Modal({ aberto, aoFechar, titulo, children }: { aberto: boolean; aoFechar: () => void; titulo: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (aberto && !d.open) d.showModal();
    if (!aberto && d.open) d.close();
  }, [aberto]);
  return (
    <dialog
      ref={ref}
      onClose={aoFechar}
      className="w-[min(36rem,calc(100vw-2rem))] rounded-lg p-0 backdrop:bg-couro-escuro/60"
    >
      <div className="border-b border-asfalto-linha px-6 py-4">
        <h2 className="text-2xl font-semibold">{titulo}</h2>
      </div>
      <div className="px-6 py-5">{children}</div>
    </dialog>
  );
}

export function Titulo({ children, acoes, descricao }: { children: ReactNode; acoes?: ReactNode; descricao?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">{children}</h1>
        {descricao && <p className="mt-1 max-w-2xl text-tinta/70">{descricao}</p>}
      </div>
      {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
    </div>
  );
}

export function Carregando() {
  return <p className="py-10 text-center text-tinta/60">Carregando…</p>;
}
