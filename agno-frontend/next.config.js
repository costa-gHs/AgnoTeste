/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configurações essenciais
  reactStrictMode: true,
  swcMinify: true,

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
    unoptimized: true, // Simplificar para desenvolvimento
  },

  // Variables de ambiente públicas
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  },

  // Redirects e rewrites para API
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/:path*`,
      },
    ];
  },

  // Configurações do Webpack (se necessário)
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Configurações adicionais do webpack se necessário
    return config;
  },
};

module.exports = nextConfig;