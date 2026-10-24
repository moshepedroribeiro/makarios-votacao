/** Emblema original do sistema: um escudo com "M" em linha de bordado. */
export function Emblema({ tamanho = 40 }: { tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 48 48" aria-hidden="true">
      <path d="M24 3 L43 10 V24 C43 35 34 42 24 45 C14 42 5 35 5 24 V10 Z" fill="#2B1D17" stroke="#C8962E" strokeWidth="2" />
      <path
        d="M24 7 L39.5 12.8 V24 C39.5 33 32 39 24 41.6 C16 39 8.5 33 8.5 24 V12.8 Z"
        fill="none"
        stroke="#C8962E"
        strokeWidth="1"
        strokeDasharray="2.2 1.6"
      />
      <path d="M15 32 V17 L24 27 L33 17 V32" fill="none" stroke="#E9C46A" strokeWidth="3.2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
