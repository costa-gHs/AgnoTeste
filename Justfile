# Agno Platform - Justfile
# Comandos simplificados para desenvolvimento e deploy

# Variáveis
project_name := "agno-platform"
version := env_var_or_default("VERSION", "latest")
environment := env_var_or_default("ENVIRONMENT", "development")

# Cores para output
blue := "\033[0;34m"
green := "\033[0;32m"
yellow := "\033[1;33m"
red := "\033[0;31m"
purple := "\033[0;35m"
nc := "\033[0m"

# Comando padrão
default: help

# 📚 Mostrar ajuda com descrições
help:
    @echo "{{blue}}🚀 Agno Platform - Just Commands{{nc}}"
    @echo ""
    @echo "{{green}}📋 Comandos Disponíveis:{{nc}}"
    @just --list --unsorted
    @echo ""
    @echo "{{yellow}}💡 Exemplos:{{nc}}"
    @echo "  just setup     # Configuração inicial completa"
    @echo "  just dev       # Iniciar ambiente de desenvolvimento"
    @echo "  just logs      # Ver logs de todos os serviços"
    @echo "  just test      # Executar testes"
    @echo ""
    @echo "{{blue}}🔧 Variáveis de Ambiente:{{nc}}"
    @echo "  PROJECT_NAME: {{project_name}}"
    @echo "  VERSION: {{version}}"
    @echo "  ENVIRONMENT: {{environment}}"

# 🏗️ Instalação e Setup
# Instalar dependências
install:
    @echo "{{blue}}🔧 Instalando dependências...{{nc}}"
    @chmod +x setup.sh deploy.sh
    @./setup.sh --quick

# Configuração inicial completa
setup:
    @echo "{{blue}}🚀 Configuração inicial da Agno Platform...{{nc}}"
    @chmod +x setup.sh deploy.sh
    @./setup.sh

# Verificar dependências do sistema
check-deps:
    @echo "{{blue}}🔍 Verificando dependências...{{nc}}"
    @command -v docker >/dev/null 2>&1 || (echo "{{red}}❌ Docker não encontrado{{nc}}" && exit 1)
    @command -v docker-compose >/dev/null 2>&1 || (echo "{{red}}❌ Docker Compose não encontrado{{nc}}" && exit 1)
    @echo "{{green}}✅ Dependências OK{{nc}}"

# 💻 Desenvolvimento
# Iniciar ambiente de desenvolvimento
dev:
    @echo "{{blue}}🔧 Iniciando ambiente de desenvolvimento...{{nc}}"
    @./deploy.sh dev

# Ver logs do ambiente de desenvolvimento
dev-logs:
    @docker-compose logs -f

# Rebuild completo do ambiente de desenvolvimento
dev-rebuild:
    @echo "{{blue}}🔄 Rebuild completo...{{nc}}"
    @docker-compose down
    @docker-compose build --no-cache
    @docker-compose up -d

# Iniciar com hot reload (modo watch)
dev-watch:
    @echo "{{blue}}🔄 Iniciando com hot reload...{{nc}}"
    @docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build

# 🏗️ Build
# Construir todas as imagens Docker
build:
    @echo "{{blue}}🏗️ Construindo imagens...{{nc}}"
    @./deploy.sh build

# Construir apenas backend
build-backend:
    @echo "{{blue}}🏗️ Construindo backend...{{nc}}"
    @docker build -t {{project_name}}-backend:{{version}} ./backend

# Construir apenas frontend
build-frontend:
    @echo "{{blue}}🏗️ Construindo frontend...{{nc}}"
    @docker build -t {{project_name}}-frontend:{{version}} ./frontend

# Build para produção com otimizações
build-prod:
    @echo "{{blue}}🏗️ Build para produção...{{nc}}"
    @ENVIRONMENT=production docker-compose -f docker-compose.yml -f docker-compose.prod.yml build

# 🚀 Deploy
# Deploy para staging
staging:
    @echo "{{blue}}🚀 Deploy para staging...{{nc}}"
    @./deploy.sh staging

# Deploy para produção
prod:
    @echo "{{blue}}🚀 Deploy para produção...{{nc}}"
    @./deploy.sh prod

# Fazer rollback
rollback:
    @echo "{{yellow}}⚠️ Fazendo rollback...{{nc}}"
    @./deploy.sh rollback

# Deploy com versão específica
deploy-version version:
    @echo "{{blue}}🚀 Deploy versão {{version}}...{{nc}}"
    @VERSION={{version}} ./deploy.sh prod

# 📊 Monitoramento
# Ver logs de todos os serviços
logs:
    @docker-compose logs -f

# Ver logs apenas do backend
logs-backend:
    @docker-compose logs -f backend

# Ver logs apenas do frontend
logs-frontend:
    @docker-compose logs -f frontend

# Ver logs apenas do banco
logs-db:
    @docker-compose logs -f postgres

# Ver logs com filtro por tempo
logs-since time:
    @docker-compose logs --since {{time}} -f

# Ver logs de um serviço específico
logs-service service:
    @docker-compose logs -f {{service}}

# Mostrar status dos serviços
status:
    @echo "{{blue}}📊 Status dos serviços:{{nc}}"
    @docker-compose ps

# Verificar saúde dos serviços
health:
    @echo "{{blue}}🏥 Verificando saúde...{{nc}}"
    @./deploy.sh health

# Mostrar estatísticas de recursos
stats:
    @echo "{{blue}}📊 Estatísticas de recursos:{{nc}}"
    @docker stats --no-stream

# Mostrar processos dos containers
top:
    @docker-compose top

# 🧪 Testes
# Executar todos os testes
test:
    @echo "{{blue}}🧪 Executando testes...{{nc}}"
    @just test-backend
    @just test-frontend

# Executar testes do backend
test-backend:
    @echo "{{blue}}🧪 Testando backend...{{nc}}"
    @docker-compose exec backend python -m pytest tests/ -v

# Executar testes do frontend
test-frontend:
    @echo "{{blue}}🧪 Testando frontend...{{nc}}"
    @docker-compose exec frontend npm test

# Executar testes end-to-end
test-e2e:
    @echo "{{blue}}🧪 Executando testes E2E...{{nc}}"
    @docker-compose exec frontend npm run test:e2e

# Executar smoke tests
smoke:
    @echo "{{blue}}💨 Executando smoke tests...{{nc}}"
    @./deploy.sh smoke

# Executar testes com cobertura
test-coverage:
    @echo "{{blue}}🧪 Executando testes com cobertura...{{nc}}"
    @docker-compose exec backend python -m pytest tests/ --cov=. --cov-report=html
    @docker-compose exec frontend npm run test:coverage

# Executar testes de performance
test-perf:
    @echo "{{blue}}⚡ Executando testes de performance...{{nc}}"
    @docker-compose exec backend python -m pytest tests/performance/ -v

# 🗄️ Database
# Conectar ao shell do PostgreSQL
db-shell:
    @echo "{{blue}}🗄️ Conectando ao PostgreSQL...{{nc}}"
    @docker-compose exec postgres psql -U agno_user -d agno_db

# Fazer backup do banco
db-backup:
    @echo "{{blue}}💾 Fazendo backup do banco...{{nc}}"
    @mkdir -p backups
    @docker-compose exec -T postgres pg_dump -U agno_user agno_db > backups/backup_$(date +%Y%m%d_%H%M%S).sql
    @echo "{{green}}✅ Backup salvo em backups/{{nc}}"

# Restaurar backup do banco
db-restore backup_file:
    @echo "{{blue}}🔄 Restaurando backup: {{backup_file}}{{nc}}"
    @test -f {{backup_file}} || (echo "{{red}}❌ Arquivo não encontrado: {{backup_file}}{{nc}}" && exit 1)
    @docker-compose exec -T postgres psql -U agno_user -d agno_db < {{backup_file}}
    @echo "{{green}}✅ Backup restaurado{{nc}}"

# Executar migrações do banco
db-migrate:
    @echo "{{blue}}🔄 Executando migrações...{{nc}}"
    @docker-compose exec backend alembic upgrade head

# Reset completo do banco (⚠️ CUIDADO)
db-reset:
    @echo "{{red}}⚠️ ATENÇÃO: Isso irá apagar todos os dados!{{nc}}"
    @echo "Digite 'yes' para confirmar:"
    @read confirm && [ "$$confirm" = "yes" ] || (echo "Cancelado." && exit 1)
    @docker-compose down
    @docker volume rm agno_postgres_data || true
    @docker-compose up -d postgres
    @sleep 10
    @just db-migrate

# Criar nova migração
db-migration name:
    @echo "{{blue}}📝 Criando migração: {{name}}{{nc}}"
    @docker-compose exec backend alembic revision --autogenerate -m "{{name}}"

# Ver status das migrações
db-status:
    @echo "{{blue}}📊 Status das migrações:{{nc}}"
    @docker-compose exec backend alembic current
    @docker-compose exec backend alembic history

# 🐚 Desenvolvimento
# Shell do container backend
shell-backend:
    @docker-compose exec backend bash

# Shell do container frontend
shell-frontend:
    @docker-compose exec frontend sh

# Shell do container PostgreSQL
shell-db:
    @docker-compose exec postgres bash

# Acessar Redis CLI
redis-cli:
    @docker-compose exec redis redis-cli

# Instalar dependência no backend
backend-install package:
    @echo "{{blue}}📦 Instalando {{package}} no backend...{{nc}}"
    @docker-compose exec backend pip install {{package}}
    @docker-compose exec backend pip freeze > requirements.txt

# Instalar dependência no frontend
frontend-install package:
    @echo "{{blue}}📦 Instalando {{package}} no frontend...{{nc}}"
    @docker-compose exec frontend npm install {{package}}

# 🔧 Manutenção
# Iniciar todos os serviços
start:
    @echo "{{blue}}▶️ Iniciando serviços...{{nc}}"
    @docker-compose up -d

# Parar todos os serviços
stop:
    @echo "{{blue}}⏹️ Parando serviços...{{nc}}"
    @docker-compose down

# Reiniciar todos os serviços
restart:
    @echo "{{blue}}🔄 Reiniciando serviços...{{nc}}"
    @docker-compose restart

# Reiniciar apenas backend
restart-backend:
    @docker-compose restart backend

# Reiniciar apenas frontend
restart-frontend:
    @docker-compose restart frontend

# Reiniciar apenas banco
restart-db:
    @docker-compose restart postgres

# Parar e remover containers
down:
    @echo "{{blue}}⬇️ Parando e removendo containers...{{nc}}"
    @docker-compose down

# Parar, remover containers e volumes
down-volumes:
    @echo "{{yellow}}⚠️ Parando e removendo containers e volumes...{{nc}}"
    @docker-compose down -v

# 🧹 Limpeza
# Limpar containers, imagens e volumes
clean:
    @echo "{{yellow}}🧹 Limpando recursos Docker...{{nc}}"
    @docker-compose down -v --remove-orphans
    @docker system prune -f
    @echo "{{green}}✅ Limpeza concluída{{nc}}"

# Limpar apenas imagens
clean-images:
    @echo "{{yellow}}🧹 Limpando imagens...{{nc}}"
    @docker rmi {{project_name}}-backend:latest {{project_name}}-frontend:latest || true
    @docker image prune -f

# Limpar volumes
clean-volumes:
    @echo "{{yellow}}🧹 Limpando volumes...{{nc}}"
    @docker-compose down -v
    @docker volume prune -f

# Limpeza completa (tudo)
clean-all:
    @echo "{{red}}🧹 Limpeza COMPLETA - removendo tudo...{{nc}}"
    @echo "Digite 'yes' para confirmar:"
    @read confirm && [ "$$confirm" = "yes" ] || (echo "Cancelado." && exit 1)
    @docker-compose down -v --remove-orphans
    @docker system prune -af --volumes
    @echo "{{green}}✅ Limpeza completa concluída{{nc}}"

# Limpar cache do Docker
clean-cache:
    @echo "{{yellow}}🧹 Limpando cache do Docker...{{nc}}"
    @docker builder prune -f

# 🔍 Utilitários
# Verificar configuração do ambiente
env-check:
    @echo "{{blue}}🔍 Verificando configuração...{{nc}}"
    @test -f .env || (echo "{{red}}❌ Arquivo .env não encontrado{{nc}}" && exit 1)
    @grep -q "your_" .env && echo "{{yellow}}⚠️ Existem valores de exemplo no .env{{nc}}" || true
    @echo "{{green}}✅ Configuração básica OK{{nc}}"

# Validar docker-compose
validate-compose:
    @echo "{{blue}}🔍 Validando docker-compose...{{nc}}"
    @docker-compose config >/dev/null && echo "{{green}}✅ Docker Compose válido{{nc}}" || echo "{{red}}❌ Docker Compose inválido{{nc}}"

# Abrir documentação da API
docs:
    @echo "{{blue}}📚 Abrindo documentação...{{nc}}"
    @command -v open >/dev/null && open http://localhost:8000/docs || \
     command -v xdg-open >/dev/null && xdg-open http://localhost:8000/docs || \
     echo "Acesse: http://localhost:8000/docs"

# Abrir aplicação no navegador
open:
    @echo "{{blue}}🌐 Abrindo aplicação...{{nc}}"
    @command -v open >/dev/null && open http://localhost:3000 || \
     command -v xdg-open >/dev/null && xdg-open http://localhost:3000 || \
     echo "Acesse: http://localhost:3000"

# 📈 Atualização
# Atualizar imagens e dependências
update:
    @echo "{{blue}}🔄 Atualizando...{{nc}}"
    @docker-compose pull
    @docker-compose up -d

# Atualizar dependências do backend
update-backend:
    @echo "{{blue}}🔄 Atualizando backend...{{nc}}"
    @docker-compose exec backend pip install --upgrade -r requirements.txt

# Atualizar dependências do frontend
update-frontend:
    @echo "{{blue}}🔄 Atualizando frontend...{{nc}}"
    @docker-compose exec frontend npm update

# 📊 Análise
# Analisar bundle do frontend
analyze-bundle:
    @echo "{{blue}}📊 Analisando bundle...{{nc}}"
    @docker-compose exec frontend npm run analyze

# Ver uso de espaço em disco
disk-usage:
    @echo "{{blue}}💾 Uso de disco pelo Docker:{{nc}}"
    @docker system df

# Análise de segurança
security-scan:
    @echo "{{blue}}🔒 Análise de segurança...{{nc}}"
    @docker run --rm -v $(pwd):/app -w /app securecodewarrior/docker-image-scanner:latest

# 🎛️ Configuração
# Gerar certificados SSL para desenvolvimento
ssl-certs:
    @echo "{{blue}}🔐 Gerando certificados SSL...{{nc}}"
    @mkdir -p nginx/ssl
    @openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout nginx/ssl/key.pem \
        -out nginx/ssl/cert.pem \
        -subj "/C=BR/ST=SP/L=Campinas/O=Agno Platform/OU=Development/CN=localhost"
    @echo "{{green}}✅ Certificados SSL gerados{{nc}}"

# Configurar hooks do Git
git-hooks:
    @echo "{{blue}}🔗 Configurando hooks do Git...{{nc}}"
    @cp scripts/pre-commit .git/hooks/
    @chmod +x .git/hooks/pre-commit
    @echo "{{green}}✅ Hooks configurados{{nc}}"

# 📋 Informações
# Mostrar informações do projeto
info:
    @echo "{{blue}}ℹ️ Informações do Projeto:{{nc}}"
    @echo "  Nome: {{project_name}}"
    @echo "  Versão: {{version}}"
    @echo "  Ambiente: {{environment}}"
    @echo ""
    @echo "{{blue}}🌐 URLs:{{nc}}"
    @echo "  Frontend: http://localhost:3000"
    @echo "  Backend: http://localhost:8000"
    @echo "  API Docs: http://localhost:8000/docs"
    @echo "  Health: http://localhost:8000/api/health"
    @echo ""
    @echo "{{blue}}📊 Status:{{nc}}"
    @docker-compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"

# Ver versões das dependências
versions:
    @echo "{{blue}}📦 Versões das Dependências:{{nc}}"
    @echo "Docker: $(docker --version)"
    @echo "Docker Compose: $(docker-compose --version)"
    @echo "Node.js (container): $(docker-compose exec frontend node --version 2>/dev/null || echo 'N/A')"
    @echo "Python (container): $(docker-compose exec backend python --version 2>/dev/null || echo 'N/A')"

# Mostrar configuração atual
show-config:
    @echo "{{blue}}⚙️ Configuração Atual:{{nc}}"
    @echo "PROJECT_NAME: {{project_name}}"
    @echo "VERSION: {{version}}"
    @echo "ENVIRONMENT: {{environment}}"
    @echo ""
    @echo "{{blue}}🐳 Docker Compose Config:{{nc}}"
    @docker-compose config --services

# 🚨 Emergência
# Parada de emergência (força parar tudo)
emergency-stop:
    @echo "{{red}}🚨 PARADA DE EMERGÊNCIA{{nc}}"
    @docker stop $(docker ps -q) 2>/dev/null || true
    @docker-compose down --remove-orphans

# Diagnóstico completo
diagnose:
    @echo "{{blue}}🔍 Diagnóstico Completo:{{nc}}"
    @echo "\n{{blue}}=== Sistema ==={{nc}}"
    @just versions
    @echo "\n{{blue}}=== Configuração ==={{nc}}"
    @just env-check
    @echo "\n{{blue}}=== Serviços ==={{nc}}"
    @just status
    @echo "\n{{blue}}=== Saúde ==={{nc}}"
    @just health
    @echo "\n{{blue}}=== Recursos ==={{nc}}"
    @just stats

# Atalhos convenientes
alias up := start
alias down := stop
alias rebuild := dev-rebuild
alias l := logs
alias s := status
alias t := test
alias h := health

# Comandos compostos
# Setup completo para novo desenvolvedor
onboard:
    @echo "{{green}}🎉 Bem-vindo à Agno Platform!{{nc}}"
    @just check-deps
    @just setup
    @just dev
    @echo "{{green}}✅ Setup completo! Acesse http://localhost:3000{{nc}}"

# Pipeline de CI/CD local
ci:
    @echo "{{blue}}🔄 Pipeline CI/CD Local{{nc}}"
    @just check-deps
    @just env-check
    @just build
    @just test
    @just smoke
    @echo "{{green}}✅ Pipeline concluído com sucesso!{{nc}}"

# Release completo
release version:
    @echo "{{blue}}🚀 Release {{version}}{{nc}}"
    @just test
    @VERSION={{version}} just build
    @git tag v{{version}}
    @echo "{{green}}✅ Release {{version}} criado!{{nc}}"