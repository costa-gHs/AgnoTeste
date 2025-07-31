# Frontend Dockerfile para Agno Platform
FROM node:18-alpine AS base
RUN apk add --no-cache libc6-compat curl

WORKDIR /app

# Copy package files - check multiple possible locations
COPY package.json package-lock.json* ./
RUN ls -la /app/

# Install dependencies
RUN npm ci || npm install

# Copy all source files
COPY . .

# Environment variables
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=development

# Create next user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Change ownership
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Development command with hot reload
CMD ["npm", "run", "dev"]