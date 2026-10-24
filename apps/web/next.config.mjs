/** @type {import('next').NextConfig} */
const API_URL = process.env.API_URL ?? 'http://localhost:8080';

const nextConfig = {
  reactStrictMode: true,
  // O navegador fala só com o Next; as chamadas /api são repassadas para a API NestJS.
  // Assim o cookie de login fica no mesmo domínio.
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_URL}/api/:path*` }];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
        ],
      },
    ];
  },
};

export default nextConfig;
