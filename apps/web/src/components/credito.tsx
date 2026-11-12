export const TEXTO_CREDITO = 'Sistema Eleitoral desenvolvido por Moisés Pedro Weizemann Ribeiro';

/** Linha de crédito exibida no rodapé de todas as telas. */
export function Credito({ className = '' }: { className?: string }) {
  return <p className={`text-xs ${className}`}>{TEXTO_CREDITO}</p>;
}
