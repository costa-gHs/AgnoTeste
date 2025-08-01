# Dockerfile para Frontend - COM CORREÇÃO DE PERMISSÕES
FROM node:18-alpine

# Instalar doas para sudo-like functionality
RUN apk add --no-cache doas

# Criar usuário não-root
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Criar diretório de trabalho
WORKDIR /app

# Copiar package.json e package-lock.json
COPY package*.json ./

# Instalar dependências como root
RUN npm ci && npm cache clean --force

# Copiar código fonte
COPY . .

# Criar diretórios necessários com permissões corretas
RUN mkdir -p .next/types .next/cache .turbo && \
    chown -R nextjs:nodejs /app && \
    chmod -R 755 /app && \
    chmod -R 777 .next .turbo

# Mudar para usuário não-root
USER nextjs

# Expor porta
EXPOSE 3000

# Variáveis de ambiente
ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1

# Comando de inicialização
CMD ["npm", "run", "dev"]