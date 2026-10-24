import type { Config } from 'tailwindcss';

// Vernáculo de motoclube: couro, asfalto e a linha dourada do bordado dos patches.
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        couro: { DEFAULT: '#2B1D17', claro: '#4A352B', escuro: '#1C130F' },
        asfalto: { DEFAULT: '#E4E5E0', claro: '#F3F3F0', linha: '#C9CAC3' },
        bordado: { DEFAULT: '#C8962E', claro: '#E9C46A', escuro: '#9A7020' },
        tinta: '#22201E',
        apto: { DEFAULT: '#2F6B45', fundo: '#E3EFE6' },
        alerta: { DEFAULT: '#A3262A', fundo: '#F6E3E2' },
      },
      fontFamily: {
        titulo: ['"Barlow Condensed"', 'Arial Narrow', 'sans-serif'],
        corpo: ['Barlow', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
