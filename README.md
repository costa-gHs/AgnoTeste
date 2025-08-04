# 🤖 Agno Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![React 18+](https://img.shields.io/badge/react-18+-61dafb.svg)](https://reactjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-00a393.svg)](https://fastapi.tiangolo.com/)
[![Docker](https://img.shields.io/badge/docker-%230db7ed.svg)](https://www.docker.com/)

Uma plataforma moderna e escalável para criação, gerenciamento e execução de agentes de IA multi-modelo, construída com FastAPI e React.

## 📋 Índice

- [🎯 Visão Geral](#-visão-geral)
- [🏗️ Arquitetura](#️-arquitetura)
- [🚀 Funcionalidades](#-funcionalidades)
- [📊 Diagramas](#-diagramas)
- [🛠️ Stack Tecnológica](#️-stack-tecnológica)
- [⚡ Quick Start](#-quick-start)
- [🔧 Instalação e Configuração](#-instalação-e-configuração)
- [🐳 Docker e Containers](#-docker-e-containers)
- [📡 API Endpoints](#-api-endpoints)
- [🧪 Testes](#-testes)
- [🚀 Deploy](#-deploy)
- [🔒 Segurança](#-segurança)
- [📊 Monitoramento](#-monitoramento)
- [🤝 Contribuição](#-contribuição)
- [📄 Licença](#-licença)

## 🎯 Visão Geral

A **Agno Platform** é uma solução completa para desenvolvimento e deployment de agentes de IA inteligentes, oferecendo:

- 🧠 **Multi-LLM Support**: Integração com OpenAI, Anthropic, Groq e outros
- 🔄 **Workflows Complexos**: Orquestração de agentes sequenciais e paralelos
- 🛠️ **Rich Toolset**: Mais de 50 ferramentas integradas (web search, APIs, databases, etc.)
- 📊 **Real-time Dashboard**: Interface moderna para monitoramento e gestão
- 🔄 **Streaming Responses**: Respostas em tempo real com WebSockets
- 🎛️ **Enterprise Ready**: Autenticação, auditoria e escalabilidade horizontal

## 🏗️ Arquitetura

### Visão Geral da Arquitetura

```mermaid
graph TB
    subgraph "Frontend Layer"
        UI[React/Next.js UI]
        WS[WebSocket Client]
    end
    
    subgraph "Load Balancer"
        NGINX[Nginx Reverse Proxy]
    end
    
    subgraph "Backend Services"
        API[FastAPI Backend]
        AUTH[Authentication Service]
        AGENT[Agent Orchestrator]
    end
    
    subgraph "Data Layer"
        PG[(PostgreSQL)]
        REDIS[(Redis Cache)]
    end
    
    subgraph "External Services"
        OPENAI[OpenAI API]
        ANTHROPIC[Anthropic API]
        GROQ[Groq API]
        WEB[Web Search]
    end
    
    UI --> NGINX
    WS --> NGINX
    NGINX --> API
    API --> AUTH
    API --> AGENT
    API --> PG
    API --> REDIS
    AGENT --> OPENAI
    AGENT --> ANTHROPIC
    AGENT --> GROQ
    AGENT --> WEB
```

### Fluxo de Dados

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant N as Nginx
    participant B as Backend
    participant A as Agent
    participant L as LLM API
    participant D as Database
    
    U->>F: Create Agent Request
    F->>N: HTTP Request
    N->>B: Forward Request
    B->>D: Validate & Store
    B->>A: Initialize Agent
    A->>L: LLM Request
    L->>A: Response
    A->>B: Process Result
    B->>F: WebSocket Stream
    F->>U: Real-time Updates
```

## 🚀 Funcionalidades

### Core Features

- ✅ **Agent Management**: Criação, edição e versionamento de agentes
- ✅ **Multi-Model Support**: OpenAI GPT-4, Anthropic Claude, Groq Llama
- ✅ **Tool Integration**: 50+ ferramentas pré-configuradas
- ✅ **Workflow Engine**: Orquestração complexa de múltiplos agentes
- ✅ **Real-time Streaming**: Respostas em tempo real via WebSockets
- ✅ **RAG Support**: Retrieval-Augmented Generation com vector search
- ✅ **Memory Management**: Contexto persistente entre conversas

### Advanced Features

- 🔄 **Auto-scaling**: Scaling horizontal automático baseado em carga
- 📊 **Analytics Dashboard**: Métricas detalhadas de performance e uso
- 🔐 **Enterprise Auth**: RBAC, SSO, auditoria completa
- 🌐 **API Gateway**: Rate limiting, caching, load balancing
- 📱 **Multi-platform**: Web, mobile, API integrations
- 🔍 **Advanced Search**: Busca semântica em conversas e conhecimento

## 📊 Diagramas

### Arquitetura de Containers

```mermaid
graph LR
    subgraph "Docker Network"
        subgraph "Frontend"
            FE[Next.js:3000]
        end
        
        subgraph "Backend"
            BE[FastAPI:8000]
            WK[Celery Workers]
        end
        
        subgraph "Data"
            DB[(PostgreSQL:5432)]
            RD[(Redis:6379)]
        end
        
        subgraph "Proxy"
            NG[Nginx:80]
        end
        
        NG --> FE
        NG --> BE
        BE --> DB
        BE --> RD
        WK --> RD
        WK --> DB
    end
```

### Data Model

```mermaid
erDiagram
    USER ||--o{ AGENT : creates
    USER ||--o{ WORKFLOW : owns
    AGENT ||--o{ CONVERSATION : participates
    AGENT ||--o{ TOOL : uses
    WORKFLOW ||--o{ AGENT : contains
    CONVERSATION ||--o{ MESSAGE : contains
    
    USER {
        uuid id PK
        string name
        string email
        string role
        timestamp created_at
        timestamp last_login
    }
    
    AGENT {
        uuid id PK
        string name
        string role
        string model_provider
        string model_id
        json instructions
        json tools
        boolean memory_enabled
        boolean rag_enabled
        uuid user_id FK
        timestamp created_at
    }
    
    WORKFLOW {
        uuid id PK
        string name
        string description
        string flow_type
        json configuration
        boolean supervisor_enabled
        uuid user_id FK
        timestamp created_at
    }
    
    CONVERSATION {
        uuid id PK
        string title
        uuid agent_id FK
        uuid user_id FK
        json metadata
        timestamp created_at
        timestamp updated_at
    }
    
    MESSAGE {
        uuid id PK
        string content
        string role
        json metadata
        uuid conversation_id FK
        timestamp created_at
    }
    
    TOOL {
        uuid id PK
        string name
        string category
        string description
        json configuration
        boolean enabled
        timestamp created_at
    }
```

## 🛠️ Stack Tecnológica

### Backend
- **Framework**: FastAPI 0.100+ (Python 3.11+)
- **Database**: PostgreSQL 15 com SQLAlchemy ORM
- **Cache**: Redis 7 para sessões e cache
- **Task Queue**: Celery para processamento assíncrono
- **Authentication**: JWT com bcrypt
- **WebSockets**: Native FastAPI WebSocket support
- **Migrations**: Alembic para controle de versão do DB

### Frontend
- **Framework**: Next.js 14 com React 18
- **Language**: TypeScript 5+
- **Styling**: Tailwind CSS + Headless UI
- **State Management**: React Query + Zustand
- **Real-time**: WebSocket client com reconnection
- **Icons**: Lucide React
- **Charts**: Recharts para visualizações

### Infrastructure & DevOps
- **Containerization**: Docker + Docker Compose
- **Reverse Proxy**: Nginx com SSL/TLS
- **Process Management**: Uvicorn + Gunicorn
- **Monitoring**: Prometheus + Grafana (opcional)
- **Logging**: Structured logging com Loguru
- **CI/CD**: GitHub Actions ready
- **Security**: CORS, CSRF, Rate limiting

### AI & ML Integration
- **LLM Providers**: OpenAI, Anthropic, Groq
- **Framework**: Agno framework para agent orchestration
- **Tools**: Web search, file processing, APIs, databases
- **Vector DB**: Suporte para RAG com embeddings
- **Streaming**: Server-sent events para respostas em tempo real

## ⚡ Quick Start

### Pré-requisitos

- 🐳 Docker & Docker Compose
- 🔧 Just (task runner) - opcional mas recomendado
- 🌐 Node.js 18+ (apenas para desenvolvimento local)
- 🐍 Python 3.11+ (apenas para desenvolvimento local)

### 1. Clone e Configure

```bash
# Clone o repositório
git clone https://github.com/your-org/agno-platform.git
cd agno-platform

# Copie e configure as variáveis de ambiente
cp .env.example .env
# Edite o .env com suas chaves de API
```

### 2. Inicie com Docker (Recomendado)

```bash
# Com Just (recomendado)
just dev

# Ou com Docker Compose diretamente
docker-compose up -d --build
```

### 3. Acesse a Aplicação

- 🌐 **Frontend**: http://localhost:3000
- 🔧 **Backend API**: http://localhost:8000
- 📚 **API Docs**: http://localhost:8000/docs
- ❤️ **Health Check**: http://localhost:8000/api/health

## 🔧 Instalação e Configuração

### Configuração de Ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
# API Keys
OPENAI_API_KEY=sk-your-openai-key
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
GROQ_API_KEY=gsk_your-groq-key

# Database
DATABASE_URL=postgresql://agno_user:agno_password@postgres:5432/agno_db
REDIS_URL=redis://redis:6379/0

# JWT & Security
SECRET_KEY=your-super-secret-jwt-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# Environment
ENVIRONMENT=development
DEBUG=true
LOG_LEVEL=INFO

# External Services
ENABLE_WEB_SEARCH=true
ENABLE_FILE_UPLOAD=true
MAX_FILE_SIZE_MB=50

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_TELEMETRY_DISABLED=1
```

### Instalação Local (Desenvolvimento)

#### Backend

```bash
cd backend

# Criar ambiente virtual
python -m venv venv
source venv/bin/activate  # Linux/Mac
# ou
venv\Scripts\activate     # Windows

# Instalar dependências
pip install -r requirements.txt

# Executar migrações
alembic upgrade head

# Iniciar servidor
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

#### Frontend

```bash
cd agno-frontend

# Instalar dependências
npm install

# Iniciar em modo de desenvolvimento
npm run dev

# Build para produção
npm run build
npm start
```

## 🐳 Docker e Containers

### Estrutura de Containers

```yaml
services:
  frontend:     # Next.js React App
  backend:      # FastAPI Python App  
  postgres:     # PostgreSQL Database
  redis:        # Redis Cache (opcional)
  nginx:        # Reverse Proxy (produção)
```

### Comandos Docker Úteis

```bash
# Desenvolvimento
just dev                    # Iniciar tudo
just dev-logs              # Ver logs
just dev-rebuild           # Rebuild completo

# Build e Deploy
just build                 # Build imagens
just staging               # Deploy staging
just prod                  # Deploy produção

# Manutenção
just logs backend          # Logs específicos
just shell-backend         # Shell no container
just db-shell             # PostgreSQL shell
just clean                # Limpar containers/volumes
```

### Ambientes

| Ambiente | Comando | Descrição |
|----------|---------|-----------|
| **Development** | `just dev` | Hot reload, debug habilitado |
| **Staging** | `just staging` | Ambiente de testes |
| **Production** | `just prod` | Otimizado, SSL, monitoring |

## 📡 API Endpoints

### Core API Routes

#### Authentication
```http
POST   /api/auth/login           # Login usuário
POST   /api/auth/register        # Registro usuário
POST   /api/auth/refresh         # Refresh token
POST   /api/auth/logout          # Logout
GET    /api/auth/me              # Profile atual
```

#### Agents
```http
GET    /api/agents               # Listar agentes
POST   /api/agents               # Criar agente
GET    /api/agents/{id}          # Obter agente
PUT    /api/agents/{id}          # Atualizar agente
DELETE /api/agents/{id}          # Deletar agente
POST   /api/agents/{id}/run      # Executar agente
```

#### Conversations
```http
GET    /api/conversations        # Listar conversas
POST   /api/conversations        # Criar conversa
GET    /api/conversations/{id}   # Obter conversa
DELETE /api/conversations/{id}   # Deletar conversa
```

#### Workflows
```http
GET    /api/workflows            # Listar workflows
POST   /api/workflows            # Criar workflow
GET    /api/workflows/{id}       # Obter workflow
PUT    /api/workflows/{id}       # Atualizar workflow
POST   /api/workflows/{id}/run   # Executar workflow
```

### Agno Framework Routes

#### Tools & Capabilities
```http
GET    /api/agno/tools           # Listar ferramentas
GET    /api/agno/health          # Health check framework
POST   /api/agno/tools/test      # Testar ferramenta
GET    /api/agno/agents/{id}/tools # Ferramentas do agente
```

### WebSocket Endpoints

```http
WS     /ws/agents/{id}/chat      # Chat em tempo real
WS     /ws/workflows/{id}/run    # Execução de workflow
WS     /ws/notifications         # Notificações sistema
```

### Example API Usage

#### Criar um Agente

```bash
curl -X POST "http://localhost:8000/api/agents" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Assistente de Pesquisa",
    "role": "Especialista em pesquisa e análise de dados",
    "model_provider": "openai",
    "model_id": "gpt-4-turbo-preview",
    "instructions": [
      "Você é um assistente especializado em pesquisa",
      "Sempre cite fontes quando possível",
      "Seja preciso e objetivo nas respostas"
    ],
    "tools": ["web_search", "calculator", "file_reader"],
    "memory_enabled": true,
    "rag_enabled": false
  }'
```

#### Executar Agente com Streaming

```bash
curl -X POST "http://localhost:8000/api/agents/123/run" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "message": "Pesquise sobre tendências de IA em 2024",
    "stream": true
  }'
```

## 🧪 Testes

### Executar Testes

```bash
# Todos os testes
just test

# Apenas backend
just test-backend

# Apenas frontend  
just test-frontend

# Com cobertura
just test-coverage

# Testes E2E
just test-e2e

# Smoke tests
just smoke
```

### Estrutura de Testes

```
backend/tests/
├── unit/           # Testes unitários
├── integration/    # Testes de integração
├── api/           # Testes de API
└── performance/   # Testes de performance

agno-frontend/tests/
├── components/    # Testes de componentes
├── pages/        # Testes de páginas
├── utils/        # Testes de utilities
└── e2e/          # Testes end-to-end
```

## 🚀 Deploy

### Ambientes de Deploy

#### Development (Local)
```bash
just dev
# Acesse: http://localhost:3000
```

#### Staging
```bash
just staging
# Deploy automático para ambiente de teste
```

#### Production
```bash
# Deploy com versão específica
VERSION=v1.2.3 just prod

# Deploy com latest
just prod
```

### CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy Pipeline
on:
  push:
    branches: [main, staging]
  
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Run Tests
        run: just test
        
  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Build Images
        run: just build
        
  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Production
        run: just prod
```

### Rollback

```bash
# Rollback para versão anterior
just rollback

# Ou manualmente
VERSION=v1.1.0 just prod
```

## 🔒 Segurança

### Medidas Implementadas

- 🔐 **JWT Authentication**: Tokens seguros com expiração
- 🛡️ **CORS Protection**: Configuração restritiva de CORS
- 🔒 **Rate Limiting**: Proteção contra abuse de API
- 🔑 **API Key Management**: Rotação segura de chaves
- 📋 **Input Validation**: Validação rigorosa com Pydantic
- 🔍 **SQL Injection Protection**: ORM com prepared statements
- 🛡️ **XSS Protection**: Headers de segurança
- 📊 **Audit Logging**: Log completo de ações sensitivas

### Configurações de Segurança

```python
# backend/config.py
SECURITY_SETTINGS = {
    "jwt_secret_rotation": "monthly",
    "password_complexity": "high",
    "session_timeout": "24h",
    "max_login_attempts": 5,
    "require_2fa": False,  # Opcional
    "allowed_origins": ["https://yourdomain.com"],
    "rate_limits": {
        "auth": "5/minute",
        "api": "100/minute",
        "upload": "10/hour"
    }
}
```

## 📊 Monitoramento

### Métricas Disponíveis

- 🚀 **Performance**: Response time, throughput, error rates
- 📈 **Usage**: API calls, active users, agent executions
- 💾 **Resources**: CPU, Memory, Disk, Network
- 🤖 **AI Metrics**: Token usage, model performance, costs
- 🔄 **Business**: Conversions, retention, feature adoption

### Health Checks

```http
GET /api/health
{
  "status": "healthy",
  "version": "1.2.3",
  "uptime": "2d 14h 32m",
  "services": {
    "database": "healthy",
    "redis": "healthy", 
    "agno_framework": "healthy"
  },
  "metrics": {
    "active_users": 42,
    "total_agents": 156,
    "avg_response_time": "1.2s"
  }
}
```

### Logs Estruturados

```python
# Exemplo de log estruturado
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "INFO",
  "service": "agent_orchestrator",
  "user_id": "user_123",
  "agent_id": "agent_456", 
  "action": "agent_execution",
  "duration_ms": 1250,
  "tokens_used": 850,
  "model": "gpt-4-turbo",
  "success": true
}
```

## 🔧 Troubleshooting

### Problemas Comuns

#### Backend não inicia
```bash
# Verificar logs
just logs-backend

# Verificar dependências
docker-compose exec backend pip check

# Rebuild
just dev-rebuild
```

#### Frontend não carrega
```bash
# Verificar Node.js
node --version  # Deve ser 18+

# Limpar cache
rm -rf agno-frontend/.next
just restart-frontend
```

#### Database connection error
```bash
# Verificar PostgreSQL
just db-shell

# Executar migrações
just db-migrate

# Reset completo (⚠️ apaga dados)
just db-reset
```

#### Performance Issues
```bash
# Verificar recursos
just stats

# Análise de performance
just test-perf

# Limpar containers antigos
just clean
```

## 🤝 Contribuição

### Como Contribuir

1. **Fork** o repositório
2. **Clone** seu fork: `git clone https://github.com/seu-usuario/agno-platform.git`
3. **Branch**: `git checkout -b feature/nova-funcionalidade`
4. **Desenvolva** sua funcionalidade
5. **Teste**: `just test`
6. **Commit**: `git commit -m "feat: adiciona nova funcionalidade"`
7. **Push**: `git push origin feature/nova-funcionalidade`
8. **Pull Request** para a branch `main`

### Padrões de Código

#### Backend (Python)
```bash
# Formatação
black backend/
isort backend/

# Linting
flake8 backend/

# Type checking
mypy backend/
```

#### Frontend (TypeScript)
```bash
# Formatação
npm run format

# Linting
npm run lint

# Type checking
npm run type-check
```

### Convenções de Commit

```
feat: nova funcionalidade
fix: correção de bug
docs: documentação
style: formatação
refactor: refatoração
test: testes
chore: manutenção
```

## 📈 Roadmap

### Q1 2024
- [ ] 🔄 **Multi-Agent Workflows**: Orchestração complexa
- [ ] 📱 **Mobile App**: React Native
- [ ] 🔍 **Advanced Search**: Vector search semântico
- [ ] 📊 **Analytics Dashboard**: Métricas avançadas

### Q2 2024
- [ ] 🌐 **Plugin System**: Marketplace de plugins
- [ ] 🔒 **Enterprise SSO**: SAML, OIDC
- [ ] 📈 **Auto-scaling**: Kubernetes support
- [ ] 🤖 **Custom Models**: Fine-tuning support

### Q3 2024
- [ ] 🎯 **A/B Testing**: Framework de experimentação
- [ ] 🔄 **Workflow Templates**: Templates pré-construídos
- [ ] 📊 **Business Intelligence**: Dashboards executivos
- [ ] 🌍 **Multi-tenancy**: Isolamento completo

## 📞 Suporte

- 📧 **Email**: support@agno-platform.com
- 💬 **Discord**: [Agno Community](https://discord.gg/agno)
- 📚 **Docs**: [docs.agno-platform.com](https://docs.agno-platform.com)
- 🐛 **Issues**: [GitHub Issues](https://github.com/your-org/agno-platform/issues)
- 📖 **Wiki**: [GitHub Wiki](https://github.com/your-org/agno-platform/wiki)

## 📄 Licença

Este projeto está licenciado sob a **MIT License** - veja o arquivo [LICENSE](LICENSE) para detalhes.

---

<div align="center">

**🤖 Construído com ❤️ pela equipe Agno Platform**

[⭐ Star no GitHub](https://github.com/your-org/agno-platform) • [🍴 Fork](https://github.com/your-org/agno-platform/fork) • [🐛 Report Issue](https://github.com/your-org/agno-platform/issues)

</div>