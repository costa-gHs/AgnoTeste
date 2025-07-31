# syntax=docker/dockerfile:1

# Imagem base Python
FROM python:3.11-slim

# Variáveis de ambiente para melhorar performance
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive

# Definir diretório de trabalho dentro do contêiner
WORKDIR /app

# Instalar dependências de sistema
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        postgresql-client \
        curl \
        gcc \
        g++ \
        git \
        build-essential \
        libpq-dev && \
    rm -rf /var/lib/apt/lists/*

# Copiar requirements do backend
COPY requirements.txt .

# Instalar dependências Python
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copiar todo o código da aplicação para dentro da imagem
# Como o contexto de build é o diretório backend/, isso inclui *.py, api/, etc.
COPY . .

# Criar diretório de logs
RUN mkdir -p logs

# Criar usuário não-root
RUN adduser --disabled-password --gecos '' appuser && \
    chown -R appuser:appuser /app

# Healthcheck opcional – ajusta a rota conforme a sua API
HEALTHCHECK --interval=30s --timeout=30s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8000/api/health || exit 1

# Expor a porta usada pela aplicação
EXPOSE 8000

# Executar como usuário não-root
USER appuser

# Comando para iniciar o FastAPI
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
