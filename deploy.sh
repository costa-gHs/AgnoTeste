#!/bin/bash

# Agno Platform - Deployment Script
# Script para deploy em desenvolvimento, staging e produção

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Configurações
PROJECT_NAME="agno-platform"
REGISTRY="${DOCKER_REGISTRY:-localhost:5000}"
VERSION="${VERSION:-latest}"
ENVIRONMENT="${ENVIRONMENT:-development}"

# Funções helper
print_header() {
    echo -e "\n${PURPLE}========================================${NC}"
    echo -e "${PURPLE} $1${NC}"
    echo -e "${PURPLE}========================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Verificar dependências
check_dependencies() {
    print_info "Verificando dependências..."

    if ! command -v docker &> /dev/null; then
        print_error "Docker não encontrado"
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose não encontrado"
        exit 1
    fi

    print_success "Dependências OK"
}

# Verificar arquivos necessários
check_files() {
    print_info "Verificando arquivos necessários..."

    required_files=(
        "docker-compose.yml"
        "backend/Dockerfile"
        "frontend/Dockerfile"
        ".env"
    )

    for file in "${required_files[@]}"; do
        if [ ! -f "$file" ]; then
            print_error "Arquivo necessário não encontrado: $file"
            exit 1
        fi
    done

    print_success "Arquivos necessários encontrados"
}

# Build das imagens
build_images() {
    print_header "Construindo Imagens Docker"

    # Backend
    print_info "Construindo imagem do backend..."
    docker build -t "${PROJECT_NAME}-backend:${VERSION}" \
                 -t "${PROJECT_NAME}-backend:latest" \
                 ./backend
    print_success "Imagem do backend construída"

    # Frontend
    print_info "Construindo imagem do frontend..."
    docker build -t "${PROJECT_NAME}-frontend:${VERSION}" \
                 -t "${PROJECT_NAME}-frontend:latest" \
                 ./frontend
    print_success "Imagem do frontend construída"
}

# Push para registry
push_images() {
    if [ "$REGISTRY" != "localhost:5000" ]; then
        print_header "Enviando Imagens para Registry"

        # Tag com registry
        docker tag "${PROJECT_NAME}-backend:${VERSION}" "${REGISTRY}/${PROJECT_NAME}-backend:${VERSION}"
        docker tag "${PROJECT_NAME}-frontend:${VERSION}" "${REGISTRY}/${PROJECT_NAME}-frontend:${VERSION}"

        # Push
        print_info "Enviando backend..."
        docker push "${REGISTRY}/${PROJECT_NAME}-backend:${VERSION}"

        print_info "Enviando frontend..."
        docker push "${REGISTRY}/${PROJECT_NAME}-frontend:${VERSION}"

        print_success "Imagens enviadas para registry"
    else
        print_info "Registry local - pulando push"
    fi
}

# Deploy local
deploy_local() {
    print_header "Deploy Local (Desenvolvimento)"

    # Parar serviços existentes
    print_info "Parando serviços existentes..."
    docker-compose down --remove-orphans || true

    # Iniciar serviços
    print_info "Iniciando serviços..."
    docker-compose up -d --build

    # Aguardar serviços
    print_info "Aguardando serviços ficarem prontos..."
    sleep 15

    # Verificar status
    check_health

    print_success "Deploy local concluído!"
    show_access_info
}

# Deploy staging
deploy_staging() {
    print_header "Deploy Staging"

    print_info "Configurando para staging..."
    export ENVIRONMENT=staging

    # Build e push
    build_images
    push_images

    # Deploy usando docker-compose para staging
    print_info "Fazendo deploy em staging..."
    docker-compose -f docker-compose.yml -f docker-compose.staging.yml up -d

    # Verificar health
    sleep 20
    check_health

    print_success "Deploy em staging concluído!"
}

# Deploy produção
deploy_production() {
    print_header "Deploy Produção"

    print_warning "DEPLOY EM PRODUÇÃO - Esta ação afetará usuários reais!"
    read -p "Tem certeza que deseja continuar? (yes/NO): " confirm

    if [ "$confirm" != "yes" ]; then
        print_info "Deploy cancelado"
        exit 0
    fi

    print_info "Configurando para produção..."
    export ENVIRONMENT=production

    # Verificações de segurança
    security_checks

    # Build e push
    build_images
    push_images

    # Backup antes do deploy
    backup_production

    # Deploy zero-downtime
    print_info "Fazendo deploy zero-downtime..."
    docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

    # Verificar health
    sleep 30
    check_health

    # Smoke tests
    run_smoke_tests

    print_success "Deploy em produção concluído!"
}

# Verificações de segurança
security_checks() {
    print_info "Executando verificações de segurança..."

    # Verificar se há secrets no código
    if grep -r "sk-" backend/ frontend/ 2>/dev/null | grep -v ".git" | grep -v "example"; then
        print_error "Possíveis secrets encontrados no código!"
        exit 1
    fi

    # Verificar .env para produção
    if [ "$ENVIRONMENT" = "production" ]; then
        if grep -q "example" .env || grep -q "changeme" .env; then
            print_error "Configurações de exemplo encontradas no .env para produção!"
            exit 1
        fi
    fi

    print_success "Verificações de segurança OK"
}

# Backup produção
backup_production() {
    print_info "Criando backup antes do deploy..."

    # Backup do banco
    docker-compose exec -T postgres pg_dump -U agno_user agno_db > "backups/pre-deploy-$(date +%Y%m%d_%H%M%S).sql" || true

    print_success "Backup criado"
}

# Verificar saúde dos serviços
check_health() {
    print_info "Verificando saúde dos serviços..."

    max_attempts=30
    attempt=1

    while [ $attempt -le $max_attempts ]; do
        # Backend
        if curl -f -s http://localhost:8000/api/health > /dev/null 2>&1; then
            print_success "Backend saudável"
            backend_healthy=true
        else
            backend_healthy=false
        fi

        # Frontend
        if curl -f -s http://localhost:3000 > /dev/null 2>&1; then
            print_success "Frontend saudável"
            frontend_healthy=true
        else
            frontend_healthy=false
        fi

        if [ "$backend_healthy" = true ] && [ "$frontend_healthy" = true ]; then
            print_success "Todos os serviços estão saudáveis!"
            return 0
        fi

        print_info "Tentativa $attempt/$max_attempts - Aguardando serviços..."
        sleep 5
        ((attempt++))
    done

    print_warning "Alguns serviços podem estar com problemas"
    docker-compose ps
    return 1
}

# Smoke tests
run_smoke_tests() {
    print_info "Executando smoke tests..."

    # Test 1: API Health
    if curl -f -s http://localhost:8000/api/health | grep -q "healthy"; then
        print_success "✓ API health check"
    else
        print_error "✗ API health check"
        return 1
    fi

    # Test 2: Frontend loading
    if curl -f -s http://localhost:3000 | grep -q "Agno Platform"; then
        print_success "✓ Frontend loading"
    else
        print_error "✗ Frontend loading"
        return 1
    fi

    # Test 3: Database connection
    if docker-compose exec -T postgres pg_isready -U agno_user > /dev/null 2>&1; then
        print_success "✓ Database connection"
    else
        print_error "✗ Database connection"
        return 1
    fi

    print_success "Smoke tests aprovados!"
}

# Rollback
rollback() {
    print_header "Executando Rollback"

    print_warning "Fazendo rollback para versão anterior..."

    # Parar serviços atuais
    docker-compose down

    # Restaurar backup se disponível
    latest_backup=$(ls -t backups/*.sql 2>/dev/null | head -1)
    if [ -n "$latest_backup" ]; then
        print_info "Restaurando backup: $latest_backup"
        docker-compose up -d postgres
        sleep 10
        docker-compose exec -T postgres psql -U agno_user -d agno_db < "$latest_backup"
    fi

    # Voltar para imagens anteriores
    docker-compose up -d

    print_success "Rollback concluído"
}

# Mostrar informações de acesso
show_access_info() {
    print_header "Informações de Acesso"

    echo -e "${GREEN}🌐 URLs de Acesso:${NC}"
    echo "  Frontend: http://localhost:3000"
    echo "  Backend API: http://localhost:8000"
    echo "  API Docs: http://localhost:8000/docs"
    echo "  Health Check: http://localhost:8000/api/health"

    echo -e "\n${BLUE}🔧 Comandos Úteis:${NC}"
    echo "  Logs: docker-compose logs -f"
    echo "  Status: docker-compose ps"
    echo "  Parar: docker-compose down"
    echo "  Restart: docker-compose restart"
}

# Logs em tempo real
show_logs() {
    print_header "Logs em Tempo Real"

    if [ -n "$1" ]; then
        docker-compose logs -f "$1"
    else
        docker-compose logs -f
    fi
}

# Status dos serviços
show_status() {
    print_header "Status dos Serviços"

    docker-compose ps
    echo ""

    # Resource usage
    print_info "Uso de recursos:"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"
}

# Menu de ajuda
show_help() {
    echo -e "${BLUE}Agno Platform - Deploy Script${NC}"
    echo ""
    echo "Uso: $0 [comando] [opções]"
    echo ""
    echo "Comandos:"
    echo "  dev              Deploy local para desenvolvimento"
    echo "  staging          Deploy para ambiente de staging"
    echo "  prod             Deploy para produção"
    echo "  build            Apenas construir imagens"
    echo "  push             Enviar imagens para registry"
    echo "  rollback         Fazer rollback"
    echo "  logs [service]   Mostrar logs"
    echo "  status           Mostrar status dos serviços"
    echo "  health           Verificar saúde dos serviços"
    echo "  smoke            Executar smoke tests"
    echo "  stop             Parar todos os serviços"
    echo "  clean            Limpar imagens e volumes"
    echo ""
    echo "Variáveis de Ambiente:"
    echo "  VERSION          Versão da imagem (padrão: latest)"
    echo "  REGISTRY         Registry Docker (padrão: localhost:5000)"
    echo "  ENVIRONMENT      Ambiente (development/staging/production)"
    echo ""
    echo "Exemplos:"
    echo "  $0 dev                    # Deploy local"
    echo "  VERSION=v1.2.3 $0 prod   # Deploy produção com versão específica"
    echo "  $0 logs backend           # Ver logs do backend"
}

# Main
main() {
    case "$1" in
        "dev"|"development")
            check_dependencies
            check_files
            deploy_local
            ;;
        "staging")
            check_dependencies
            check_files
            deploy_staging
            ;;
        "prod"|"production")
            check_dependencies
            check_files
            deploy_production
            ;;
        "build")
            check_dependencies
            build_images
            ;;
        "push")
            check_dependencies
            push_images
            ;;
        "rollback")
            rollback
            ;;
        "logs")
            show_logs "$2"
            ;;
        "status")
            show_status
            ;;
        "health")
            check_health
            ;;
        "smoke")
            run_smoke_tests
            ;;
        "stop")
            docker-compose down
            print_success "Serviços parados"
            ;;
        "clean")
            print_warning "Limpando imagens e volumes..."
            docker-compose down -v --remove-orphans
            docker system prune -f
            print_success "Limpeza concluída"
            ;;
        "help"|"--help"|"-h")
            show_help
            ;;
        "")
            show_help
            ;;
        *)
            print_error "Comando desconhecido: $1"
            show_help
            exit 1
            ;;
    esac
}

# Executar
main "$@"