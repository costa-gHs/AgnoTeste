import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Configurações de build mais permissivas
  eslint: {
    // Permitir warnings durante o build de produção
    ignoreDuringBuilds: false,
    // Diretórios para ignorar durante lint
    dirs: ['src', 'components', 'pages', 'app']
  },

  typescript: {
    // Não falhar o build por erros de TypeScript em development
    ignoreBuildErrors: process.env.SKIP_BUILD_CHECKS === 'true',
  },

  // Configurações experimentais
  experimental: {
    // Habilitar bundling otimizado
    optimizePackageImports: ['lucide-react', 'recharts'],
  },

  // Output configuration
  output: process.env.BUILD_STANDALONE === 'true' ? 'standalone' : undefined,

  // Headers para CORS durante desenvolvimento
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,OPTIONS,PATCH,DELETE,POST,PUT' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version' },
        ],
      },
    ];
  },

  // Configurações de imagem
  images: {
    domains: [],
    unoptimized: true, // Simplificar para desenvolvimento
  },

  // Configurações de build
  poweredByHeader: false,
  compress: true,

  // Variables de ambiente públicas
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  },

  // Redirects e rewrites
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;