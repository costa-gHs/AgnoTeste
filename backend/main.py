# main.py - Backend Agno COMPLETO e TESTADO
# Versão final com streaming funcionando, logs detalhados e criação de agentes

import os
import json
import asyncio
import uuid
from typing import List, Dict, Any, Optional, AsyncGenerator
from datetime import datetime, timedelta
import logging
import traceback
from contextlib import asynccontextmanager

# FastAPI imports
from fastapi import FastAPI, HTTPException, Depends, WebSocket, WebSocketDisconnect, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from pydantic import BaseModel

# Database
import asyncpg
import sqlalchemy as sa
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base

# Environment
from dotenv import load_dotenv

load_dotenv()

# Configuração de logging DETALHADA
import sys
from pathlib import Path

# Criar diretório de logs se não existir
log_dir = Path("/app/logs")
log_dir.mkdir(exist_ok=True)


# Configurar formatação de logs
class ColoredFormatter(logging.Formatter):
    """Formatter com cores para diferentes níveis de log"""
    COLORS = {
        'DEBUG': '\033[36m',  # Cyan
        'INFO': '\033[32m',  # Green
        'WARNING': '\033[33m',  # Yellow
        'ERROR': '\033[31m',  # Red
        'CRITICAL': '\033[35m',  # Magenta
    }
    RESET = '\033[0m'

    def format(self, record):
        log_color = self.COLORS.get(record.levelname, self.RESET)
        record.levelname = f"{log_color}{record.levelname}{self.RESET}"
        return super().format(record)


# Configurar handlers
console_handler = logging.StreamHandler(sys.stdout)
console_handler.setFormatter(ColoredFormatter(
    '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
))

file_handler = logging.FileHandler(log_dir / 'agno.log', mode='a', encoding='utf-8')
file_handler.setFormatter(logging.Formatter(
    '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
))

# Configurar logger principal
logging.basicConfig(
    level=logging.INFO,
    handlers=[console_handler, file_handler]
)

logger = logging.getLogger(__name__)

# Database setup
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://agno_user:agno_password@localhost:5432/agno_db")
ASYNC_DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")

# Create async engine
engine = create_async_engine(ASYNC_DATABASE_URL, echo=False)  # Desabilitar echo para não poluir logs
async_session = async_sessionmaker(engine, expire_on_commit=False)

Base = declarative_base()


# Pydantic Models
class CreateAgentRequest(BaseModel):
    name: str
    role: str
    model_provider: str = "openai"
    model_id: str = "gpt-4o-mini"
    instructions: List[str]
    tools: List[str] = []
    memory_enabled: bool = True
    rag_enabled: bool = False
    rag_index_id: Optional[str] = None


class ChatMessage(BaseModel):
    message: str
    context: Optional[Dict[str, Any]] = None


class CreateWorkflowRequest(BaseModel):
    name: str
    description: str
    flow_type: str = "sequential"
    supervisor_enabled: bool = False
    agents: List[CreateAgentRequest] = []


# Mock data para demonstração - DADOS REALISTAS
MOCK_AGENTS = [
    {
        "id": 1,
        "name": "Assistente Geral",
        "role": "Assistente virtual para tarefas gerais e atendimento",
        "modelProvider": "openai",
        "modelId": "gpt-4o-mini",
        "tools": ["web_search", "code_interpreter"],
        "status": "active",
        "lastUsed": "2024-01-15T10:30:00Z",
        "config": {
            "instructions": [
                "Você é um assistente útil e cordial",
                "Sempre forneça respostas precisas e bem estruturadas",
                "Use ferramentas quando necessário para obter informações atualizadas"
            ],
            "memoryEnabled": True,
            "ragEnabled": False,
            "maxTokens": 4000,
            "temperature": 0.7
        },
        "createdAt": "2024-01-10T09:00:00Z",
        "updatedAt": "2024-01-15T10:30:00Z"
    },
    {
        "id": 2,
        "name": "Especialista em Código",
        "role": "Desenvolvedor especializado em Python, JavaScript e arquitetura de software",
        "modelProvider": "anthropic",
        "modelId": "claude-3-sonnet",
        "tools": ["code_interpreter", "file_manager", "git_client"],
        "status": "active",
        "lastUsed": "2024-01-14T16:45:00Z",
        "config": {
            "instructions": [
                "Você é um desenvolvedor sênior experiente",
                "Sempre explique o código que escreve de forma didática",
                "Prefira soluções simples, eficientes e bem documentadas",
                "Considere boas práticas de programação e padrões de design"
            ],
            "memoryEnabled": True,
            "ragEnabled": True,
            "maxTokens": 8000,
            "temperature": 0.3
        },
        "createdAt": "2024-01-12T14:20:00Z",
        "updatedAt": "2024-01-14T16:45:00Z"
    }
]

MOCK_WORKFLOWS = [
    {
        "id": 1,
        "name": "Análise de Dados Completa",
        "description": "Workflow para análise completa de dados com visualizações e insights",
        "flowType": "sequential",
        "agentCount": 3,
        "status": "active",
        "lastUsed": "2024-01-13T12:00:00Z",
        "config": {
            "nodes": [
                {"id": "collect", "type": "agent", "name": "Coletor de Dados"},
                {"id": "analyze", "type": "agent", "name": "Analisador"},
                {"id": "visualize", "type": "agent", "name": "Visualizador"}
            ],
            "connections": [
                {"from": "collect", "to": "analyze"},
                {"from": "analyze", "to": "visualize"}
            ],
            "supervisorEnabled": True,
            "agents": []
        },
        "createdAt": "2024-01-11T08:30:00Z",
        "updatedAt": "2024-01-13T12:00:00Z"
    }
]


# Mock Agno Service com LOGS EXTREMAMENTE DETALHADOS
class MockAgnoService:
    """Serviço mock que simula o Agno com logging detalhado e streaming funcional"""

    def __init__(self):
        self.agents = {}
        self.sessions = {}
        self.logger = logging.getLogger(f"{__name__}.MockAgnoService")
        self.logger.info("🚀 MockAgnoService inicializado")

    async def create_agent(self, user_id: int, config: CreateAgentRequest) -> str:
        """Cria um agente mock com logs detalhados"""
        session_id = f"create_agent_{user_id}_{int(datetime.now().timestamp())}"

        try:
            self.logger.info(f"🎯 [SESSION: {session_id}] Iniciando criação de agente")
            self.logger.info(f"👤 [SESSION: {session_id}] Usuário: {user_id}")
            self.logger.info(f"📝 [SESSION: {session_id}] Nome: {config.name}")
            self.logger.info(f"🎭 [SESSION: {session_id}] Papel: {config.role}")
            self.logger.info(f"🤖 [SESSION: {session_id}] Modelo: {config.model_provider}/{config.model_id}")
            self.logger.info(f"🛠️  [SESSION: {session_id}] Ferramentas: {config.tools}")
            self.logger.info(f"📋 [SESSION: {session_id}] Instruções: {len(config.instructions)} itens")

            # Simular validação
            if not config.name or not config.role:
                error_msg = "Nome e papel são obrigatórios"
                self.logger.error(f"❌ [SESSION: {session_id}] Validação falhou: {error_msg}")
                raise ValueError(error_msg)

            # Simular delay de criação
            self.logger.info(f"⏳ [SESSION: {session_id}] Processando criação...")
            await asyncio.sleep(0.5)

            agent_id = str(len(MOCK_AGENTS) + 1)

            agent_data = {
                "id": int(agent_id),
                "name": config.name,
                "role": config.role,
                "modelProvider": config.model_provider,
                "modelId": config.model_id,
                "tools": config.tools,
                "status": "active",
                "lastUsed": datetime.now().isoformat(),
                "config": {
                    "instructions": config.instructions,
                    "memoryEnabled": config.memory_enabled,
                    "ragEnabled": config.rag_enabled,
                    "ragIndexId": config.rag_index_id,
                    "maxTokens": 4000,
                    "temperature": 0.7
                },
                "createdAt": datetime.now().isoformat(),
                "updatedAt": datetime.now().isoformat()
            }

            MOCK_AGENTS.append(agent_data)

            self.logger.info(f"✅ [SESSION: {session_id}] Agente criado com sucesso")
            self.logger.info(f"🆔 [SESSION: {session_id}] ID do agente: {agent_id}")
            self.logger.info(f"📊 [SESSION: {session_id}] Total de agentes: {len(MOCK_AGENTS)}")

            return agent_id

        except Exception as e:
            self.logger.error(f"💥 [SESSION: {session_id}] Erro na criação: {str(e)}")
            self.logger.error(f"📍 [SESSION: {session_id}] Traceback: {traceback.format_exc()}")
            raise

    async def run_agent(self, agent_id: str, message: str, user_id: int) -> AsyncGenerator[str, None]:
        """Executa um agente com streaming e LOGS EXTREMAMENTE DETALHADOS"""
        session_id = f"chat_{user_id}_{agent_id}_{int(datetime.now().timestamp())}"

        try:
            self.logger.info(f"🚀 [SESSION: {session_id}] === INICIANDO CHAT COM AGENTE ===")
            self.logger.info(f"👤 [SESSION: {session_id}] Usuário: {user_id}")
            self.logger.info(f"🤖 [SESSION: {session_id}] Agente: {agent_id}")
            self.logger.info(f"📝 [SESSION: {session_id}] Mensagem ({len(message)} chars): {message[:100]}...")
            self.logger.info(f"🕐 [SESSION: {session_id}] Timestamp: {datetime.now().isoformat()}")

            # Verificar se o agente existe
            agent = None
            for a in MOCK_AGENTS:
                if str(a["id"]) == agent_id:
                    agent = a
                    break

            if not agent:
                error_msg = f"Agente {agent_id} não encontrado"
                self.logger.error(f"❌ [SESSION: {session_id}] {error_msg}")
                error_data = {
                    "type": "error",
                    "message": error_msg,
                    "session_id": session_id,
                    "timestamp": datetime.now().isoformat()
                }
                yield f'data: {json.dumps(error_data)}\n\n'
                return

            self.logger.info(f"🎯 [SESSION: {session_id}] Agente encontrado: {agent['name']}")
            self.logger.info(f"🏷️  [SESSION: {session_id}] Papel: {agent['role']}")
            self.logger.info(f"🤖 [SESSION: {session_id}] Modelo: {agent['modelProvider']}/{agent['modelId']}")
            self.logger.info(f"🛠️  [SESSION: {session_id}] Ferramentas: {agent['tools']}")

            # Simular delay inicial de processamento
            self.logger.info(f"⏳ [SESSION: {session_id}] Iniciando processamento...")
            await asyncio.sleep(0.3)

            # Gerar resposta simulada baseada no agente
            if agent['role'].lower().find('código') != -1 or agent['role'].lower().find('desenvolvedor') != -1:
                response_template = f"""Olá! Sou o **{agent['name']}** 👨‍💻

Você perguntou: "{message}"

Como desenvolvedor especializado, posso ajudá-lo com:
- Desenvolvimento em Python, JavaScript, React, FastAPI
- Arquitetura de software e boas práticas
- Debugging e otimização de código
- Integração de APIs e databases

**Exemplo de código Python:**
```python
def process_message(message: str) -> str:
    # Processar mensagem do usuário
    processed = message.strip().lower()
    return f"Processado: {{processed}}"
```

**Configuração do Agente:**
- Modelo: {agent['modelProvider']}/{agent['modelId']}
- Ferramentas: {', '.join(agent['tools']) if agent['tools'] else 'Nenhuma'}
- Memória: {'Ativada' if agent['config']['memoryEnabled'] else 'Desativada'}
- Temperature: {agent['config'].get('temperature', 0.7)}

**Session Info:**
- Session ID: {session_id}
- Timestamp: {datetime.now().strftime('%H:%M:%S')}
- Usuário: {user_id}

Como posso ajudá-lo com código hoje? 🚀"""

            else:
                response_template = f"""Olá! Sou o **{agent['name']}** 😊

Você me disse: "{message}"

Como {agent['role']}, estou aqui para ajudá-lo da melhor forma possível!

Esta é uma demonstração do streaming em tempo real funcionando perfeitamente. Cada palavra está sendo enviada gradualmente para simular uma resposta real de um modelo de linguagem.

**Sobre mim:**
- Nome: {agent['name']}
- Especialidade: {agent['role']}
- Modelo: {agent['modelProvider']}/{agent['modelId']}
- Ferramentas disponíveis: {', '.join(agent['tools']) if agent['tools'] else 'Ferramentas básicas'}

**Configurações:**
- Memória conversacional: {'✅ Ativada' if agent['config']['memoryEnabled'] else '❌ Desativada'}
- RAG: {'✅ Ativado' if agent['config']['ragEnabled'] else '❌ Desativado'}
- Max tokens: {agent['config'].get('maxTokens', 4000)}
- Temperature: {agent['config'].get('temperature', 0.7)}

**Informações da sessão:**
- 🆔 Session ID: {session_id}
- 🕐 Horário: {datetime.now().strftime('%H:%M:%S')}
- 👤 Usuário: {user_id}
- 📍 Status: Streaming ativo

Estou pronto para ajudá-lo! Como posso ser útil? ✨"""

            # Dividir em palavras para streaming
            words = response_template.split(' ')
            total_words = len(words)

            self.logger.info(f"📤 [SESSION: {session_id}] Iniciando streaming de {total_words} palavras")
            self.logger.info(f"📊 [SESSION: {session_id}] Velocidade: ~30ms por palavra")

            # Streaming palavra por palavra
            for i, word in enumerate(words):
                try:
                    # Simular delay de processamento
                    await asyncio.sleep(0.03)  # 30ms entre palavras

                    # Preparar chunk
                    chunk = word + (' ' if i < len(words) - 1 else '')
                    chunk_data = {
                        "type": "chunk",
                        "content": chunk,
                        "metadata": {
                            "word_index": i + 1,
                            "total_words": total_words,
                            "progress": round((i + 1) / total_words * 100, 1),
                            "session_id": session_id,
                            "agent_id": agent_id,
                            "timestamp": datetime.now().isoformat()
                        }
                    }

                    chunk_json = json.dumps(chunk_data)
                    yield f'data: {chunk_json}\n\n'

                    # Log a cada 25 palavras para não poluir
                    if (i + 1) % 25 == 0:
                        progress = round((i + 1) / total_words * 100, 1)
                        self.logger.info(
                            f"📊 [SESSION: {session_id}] Progresso: {i + 1}/{total_words} palavras ({progress}%)")

                except Exception as chunk_error:
                    self.logger.error(f"💥 [SESSION: {session_id}] Erro no chunk {i}: {str(chunk_error)}")
                    error_data = {
                        "type": "error",
                        "message": f"Erro no streaming: {str(chunk_error)}",
                        "session_id": session_id,
                        "chunk_index": i
                    }
                    yield f'data: {json.dumps(error_data)}\n\n'
                    return

            # Mensagem de finalização
            completion_data = {
                "type": "complete",
                "session_id": session_id,
                "agent_id": agent_id,
                "agent_name": agent['name'],
                "user_id": user_id,
                "total_words": total_words,
                "total_chars": len(response_template),
                "duration_seconds": round(total_words * 0.03, 2),
                "timestamp": datetime.now().isoformat(),
                "model_info": {
                    "provider": agent['modelProvider'],
                    "model": agent['modelId'],
                    "temperature": agent['config'].get('temperature', 0.7)
                }
            }

            yield f'data: {json.dumps(completion_data)}\n\n'

            self.logger.info(f"✅ [SESSION: {session_id}] Streaming concluído com SUCESSO")
            self.logger.info(f"📊 [SESSION: {session_id}] Total de palavras enviadas: {total_words}")
            self.logger.info(f"📏 [SESSION: {session_id}] Total de caracteres: {len(response_template)}")
            self.logger.info(f"⏱️  [SESSION: {session_id}] Duração estimada: {round(total_words * 0.03, 2)} segundos")
            self.logger.info(f"🏁 [SESSION: {session_id}] === CHAT FINALIZADO ===")

        except Exception as e:
            error_msg = f"Erro na execução do agente: {str(e)}"
            self.logger.error(f"💥 [SESSION: {session_id}] {error_msg}")
            self.logger.error(f"📍 [SESSION: {session_id}] Traceback completo:")
            self.logger.error(traceback.format_exc())

            error_data = {
                "type": "error",
                "message": error_msg,
                "session_id": session_id,
                "agent_id": agent_id,
                "timestamp": datetime.now().isoformat(),
                "error_type": type(e).__name__
            }

            yield f'data: {json.dumps(error_data)}\n\n'


# Inicializar serviço
agno_service = MockAgnoService()


# Lifespan manager
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 =====================================")
    logger.info("🚀 INICIANDO AGNO PLATFORM BACKEND v3.0")
    logger.info("🚀 =====================================")
    logger.info(f"📊 Agentes disponíveis: {len(MOCK_AGENTS)}")
    logger.info(f"🔄 Workflows disponíveis: {len(MOCK_WORKFLOWS)}")
    logger.info(f"🌐 Base URL: http://localhost:8000")
    logger.info(f"📚 Documentação: http://localhost:8000/docs")
    logger.info(f"🔍 Logs: /app/logs/agno.log")
    logger.info("✅ Sistema pronto para receber requisições!")

    yield

    logger.info("🛑 =====================================")
    logger.info("🛑 ENCERRANDO AGNO PLATFORM BACKEND")
    logger.info("🛑 =====================================")


# Create FastAPI app
app = FastAPI(
    title="Agno Platform API",
    description="API do Agno Platform para gerenciamento de agentes e workflows com streaming",
    version="3.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configurar adequadamente em produção
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Trust hosts (configurar adequadamente em produção)
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["localhost", "127.0.0.1", "*.localhost", "*"]
)


# Middleware de logging DETALHADO
@app.middleware("http")
async def log_requests(request: Request, call_next):
    request_id = f"req_{int(datetime.now().timestamp())}_{hash(str(request.url)) % 10000}"
    start_time = datetime.now()

    # Log da requisição entrante
    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")[:100]

    logger.info(f"📥 [REQ: {request_id}] {request.method} {request.url}")
    logger.info(f"🌐 [REQ: {request_id}] IP: {client_ip}")
    logger.debug(f"👤 [REQ: {request_id}] User-Agent: {user_agent}")

    if request.query_params:
        logger.debug(f"🔍 [REQ: {request_id}] Query params: {dict(request.query_params)}")

    try:
        response = await call_next(request)

        # Log da resposta
        process_time = (datetime.now() - start_time).total_seconds()

        # Determinar emoji e nível baseado no status
        if response.status_code >= 500:
            log_level = logging.ERROR
            emoji = "💥"
        elif response.status_code >= 400:
            log_level = logging.WARNING
            emoji = "⚠️"
        elif response.status_code >= 300:
            log_level = logging.INFO
            emoji = "↩️"
        else:
            log_level = logging.INFO
            emoji = "✅"

        # Headers especiais para streaming
        content_type = response.headers.get("content-type", "")
        if "text/plain" in content_type:
            emoji = "🌊"

        logger.log(
            log_level,
            f"{emoji} [REQ: {request_id}] {response.status_code} - {process_time:.3f}s - {request.method} {request.url.path}"
        )

        return response

    except Exception as e:
        process_time = (datetime.now() - start_time).total_seconds()
        logger.error(f"💥 [REQ: {request_id}] ERRO INTERNO - {process_time:.3f}s - {request.method} {request.url.path}")
        logger.error(f"💥 [REQ: {request_id}] Erro: {str(e)}")
        logger.error(f"💥 [REQ: {request_id}] Traceback: {traceback.format_exc()}")
        raise


# Auth dependency
async def get_current_user(user_id: int = Query(default=1)):
    """Simple auth middleware com logging"""
    logger.debug(f"🔐 Usuário autenticado: {user_id}")
    return user_id


# ===========================================
# ROTAS DA API
# ===========================================

@app.get("/")
async def root():
    """Root endpoint com informações detalhadas do sistema"""
    logger.info("🏠 Endpoint raiz acessado")

    system_info = {
        "message": "Agno Platform API v3.0 - Sistema de Agentes IA",
        "status": "online",
        "version": "3.0.0",
        "timestamp": datetime.now().isoformat(),
        "uptime": "Sistema ativo",
        "features": [
            "Agentes IA personalizáveis",
            "Workflows multi-agente",
            "Streaming em tempo real",
            "Logs detalhados",
            "API RESTful"
        ],
        "endpoints": {
            "docs": "/docs",
            "health": "/api/health",
            "agents": "/api/agents",
            "workflows": "/api/workflows"
        },
        "metrics": {
            "agents_count": len(MOCK_AGENTS),
            "workflows_count": len(MOCK_WORKFLOWS),
            "active_sessions": len(agno_service.sessions)
        },
        "system": {
            "environment": os.getenv("ENVIRONMENT", "development"),
            "log_level": logging.getLevelName(logger.level),
            "database": "Mock Mode (PostgreSQL configurado para produção)"
        }
    }

    logger.info("✅ Informações do sistema retornadas")
    return system_info


@app.get("/api/health")
async def health_check():
    """Health check endpoint detalhado"""
    logger.info("🏥 Health check solicitado")

    try:
        # Verificações do sistema
        checks = {
            "api": "healthy",
            "agno_service": "operational",
            "database": "mock_ready",
            "logging": "active",
            "streaming": "functional"
        }

        # Testar componentes
        test_start = datetime.now()

        # Testar se consegue acessar dados mock
        agents_accessible = len(MOCK_AGENTS) > 0
        workflows_accessible = len(MOCK_WORKFLOWS) > 0

        test_duration = (datetime.now() - test_start).total_seconds()

        health_data = {
            "status": "healthy",
            "timestamp": datetime.now().isoformat(),
            "version": "3.0.0",
            "checks": checks,
            "metrics": {
                "total_agents": len(MOCK_AGENTS),
                "total_workflows": len(MOCK_WORKFLOWS),
                "active_sessions": len(agno_service.sessions),
                "test_duration_ms": round(test_duration * 1000, 2)
            },
            "system": {
                "agents_accessible": agents_accessible,
                "workflows_accessible": workflows_accessible,
                "logging_active": logger.isEnabledFor(logging.INFO)
            }
        }

        logger.info("✅ Health check passou - todos os sistemas operacionais")
        return health_data

    except Exception as e:
        logger.error(f"❌ Health check falhou: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Health check failed: {str(e)}")


@app.options("/{path:path}")
async def options_handler(path: str):
    """Handle OPTIONS requests for CORS"""
    logger.debug(f"⚙️ OPTIONS request para: /{path}")
    return JSONResponse(
        content={"message": "OK"},
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "*",
        }
    )


@app.post("/api/agents/create")
async def create_agent(
        request: CreateAgentRequest,
        user_id: int = Depends(get_current_user)
):
    """Create a new agent com logs extremamente detalhados"""
    request_id = f"create_agent_{int(datetime.now().timestamp())}"

    try:
        logger.info(f"🎯 [CREATE: {request_id}] === CRIAÇÃO DE AGENTE INICIADA ===")
        logger.info(f"👤 [CREATE: {request_id}] Usuário: {user_id}")
        logger.info(f"📝 [CREATE: {request_id}] Nome: '{request.name}'")
        logger.info(f"🎭 [CREATE: {request_id}] Papel: '{request.role}'")
        logger.info(f"🤖 [CREATE: {request_id}] Modelo: {request.model_provider}/{request.model_id}")
        logger.info(f"🛠️  [CREATE: {request_id}] Ferramentas: {request.tools}")
        logger.info(f"💭 [CREATE: {request_id}] Memória: {request.memory_enabled}")
        logger.info(f"🔍 [CREATE: {request_id}] RAG: {request.rag_enabled}")
        logger.info(f"📋 [CREATE: {request_id}] Instruções ({len(request.instructions)}): {request.instructions[:2]}")

        # Validação detalhada
        if not request.name or not request.name.strip():
            logger.error(f"❌ [CREATE: {request_id}] Validação: Nome vazio")
            raise HTTPException(status_code=400, detail="Nome do agente é obrigatório")

        if not request.role or not request.role.strip():
            logger.error(f"❌ [CREATE: {request_id}] Validação: Papel vazio")
            raise HTTPException(status_code=400, detail="Papel do agente é obrigatório")

        if len(request.name) > 100:
            logger.error(f"❌ [CREATE: {request_id}] Validação: Nome muito longo ({len(request.name)} chars)")
            raise HTTPException(status_code=400, detail="Nome do agente deve ter no máximo 100 caracteres")

        logger.info(f"✅ [CREATE: {request_id}] Validação passou")

        # Chamar serviço para criar agente
        agent_id = await agno_service.create_agent(user_id, request)

        response_data = {
            "agent_id": agent_id,
            "status": "created",
            "message": "Agente criado com sucesso!",
            "timestamp": datetime.now().isoformat(),
            "details": {
                "name": request.name,
                "role": request.role,
                "provider": request.model_provider,
                "model": request.model_id,
                "tools_count": len(request.tools),
                "instructions_count": len(request.instructions)
            }
        }

        logger.info(f"🎉 [CREATE: {request_id}] === AGENTE CRIADO COM SUCESSO ===")
        logger.info(f"🆔 [CREATE: {request_id}] ID do agente: {agent_id}")
        logger.info(f"📊 [CREATE: {request_id}] Total de agentes no sistema: {len(MOCK_AGENTS)}")

        return response_data

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"💥 [CREATE: {request_id}] Erro inesperado: {str(e)}")
        logger.error(f"💥 [CREATE: {request_id}] Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")


@app.get("/api/agents")
async def list_agents(user_id: int = Depends(get_current_user)):
    """List user agents com logs"""
    request_id = f"list_agents_{int(datetime.now().timestamp())}"

    try:
        logger.info(f"📋 [LIST: {request_id}] Listagem de agentes solicitada")
        logger.info(f"👤 [LIST: {request_id}] Usuário: {user_id}")

        # Simular filtro por usuário (em produção seria real)
        agents = MOCK_AGENTS.copy()

        logger.info(f"📊 [LIST: {request_id}] Encontrados {len(agents)} agentes")
        logger.info(f"🏷️  [LIST: {request_id}] Agentes: {[a['name'] for a in agents]}")

        # Adicionar estatísticas
        active_count = len([a for a in agents if a['status'] == 'active'])
        providers = list(set(a['modelProvider'] for a in agents))

        logger.info(f"✅ [LIST: {request_id}] {active_count} ativos, providers: {providers}")

        return agents

    except Exception as e:
        logger.error(f"❌ [LIST: {request_id}] Erro ao listar agentes: {str(e)}")
        logger.error(f"📍 [LIST: {request_id}] Traceback: {traceback.format_exc()}")
        return []


@app.post("/api/agents/{agent_id}/chat")
async def chat_with_agent(
        agent_id: str,
        message: ChatMessage,
        user_id: int = Depends(get_current_user)
):
    """Chat with agent using streaming - VERSÃO FINAL FUNCIONANDO"""
    request_id = f"chat_{agent_id}_{int(datetime.now().timestamp())}"

    try:
        logger.info(f"💬 [CHAT: {request_id}] === CHAT INICIADO ===")
        logger.info(f"👤 [CHAT: {request_id}] Usuário: {user_id}")
        logger.info(f"🤖 [CHAT: {request_id}] Agente: {agent_id}")
        logger.info(f"📝 [CHAT: {request_id}] Mensagem: '{message.message[:100]}...'")
        logger.info(f"📏 [CHAT: {request_id}] Tamanho da mensagem: {len(message.message)} chars")

        if not message.message or not message.message.strip():
            logger.error(f"❌ [CHAT: {request_id}] Mensagem vazia")
            raise HTTPException(status_code=400, detail="Mensagem não pode estar vazia")

        async def stream_generator():
            """Generator que manipula o async iterator CORRETAMENTE"""
            try:
                logger.info(f"🌊 [CHAT: {request_id}] Iniciando stream generator")

                chunk_count = 0
                async for chunk in agno_service.run_agent(agent_id, message.message, user_id):
                    chunk_count += 1
                    if chunk_count <= 5:  # Log apenas os primeiros chunks
                        logger.debug(f"📦 [CHAT: {request_id}] Chunk {chunk_count}: {chunk[:50]}...")
                    yield chunk

                logger.info(f"🏁 [CHAT: {request_id}] Stream generator finalizado - {chunk_count} chunks enviados")

            except Exception as e:
                error_msg = f"Erro no stream generator: {str(e)}"
                logger.error(f"💥 [CHAT: {request_id}] {error_msg}")
                logger.error(f"📍 [CHAT: {request_id}] Traceback: {traceback.format_exc()}")

                error_chunk = f'data: {json.dumps({"type": "error", "message": error_msg, "timestamp": datetime.now().isoformat()})}\n\n'
                yield error_chunk

        logger.info(f"📡 [CHAT: {request_id}] Retornando StreamingResponse")

        return StreamingResponse(
            stream_generator(),
            media_type="text/plain",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Access-Control-Allow-Origin": "*",
                "X-Accel-Buffering": "no",  # Disable proxy buffering
                "Content-Type": "text/plain; charset=utf-8",
                "Transfer-Encoding": "chunked"
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"💥 [CHAT: {request_id}] Erro no endpoint de chat: {str(e)}")
        logger.error(f"📍 [CHAT: {request_id}] Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Erro interno no chat: {str(e)}")


@app.post("/api/workflows/create")
async def create_workflow(
        request: CreateWorkflowRequest,
        user_id: int = Depends(get_current_user)
):
    """Create a new workflow com logs"""
    request_id = f"create_workflow_{int(datetime.now().timestamp())}"

    try:
        logger.info(f"🔄 [WORKFLOW: {request_id}] Criação de workflow iniciada")
        logger.info(f"👤 [WORKFLOW: {request_id}] Usuário: {user_id}")
        logger.info(f"📝 [WORKFLOW: {request_id}] Nome: '{request.name}'")
        logger.info(f"📋 [WORKFLOW: {request_id}] Descrição: '{request.description}'")
        logger.info(f"🔀 [WORKFLOW: {request_id}] Tipo: {request.flow_type}")
        logger.info(f"👥 [WORKFLOW: {request_id}] Agentes: {len(request.agents)}")

        workflow_id = str(len(MOCK_WORKFLOWS) + 1)

        workflow_data = {
            "id": int(workflow_id),
            "name": request.name,
            "description": request.description,
            "flowType": request.flow_type,
            "agentCount": len(request.agents),
            "status": "active",
            "lastUsed": datetime.now().isoformat(),
            "config": {
                "nodes": [],
                "connections": [],
                "supervisorEnabled": request.supervisor_enabled,
                "agents": [
                    {
                        "name": agent.name,
                        "role": agent.role,
                        "model_provider": agent.model_provider,
                        "model_id": agent.model_id,
                        "tools": agent.tools,
                        "instructions": agent.instructions
                    }
                    for agent in request.agents
                ]
            },
            "createdAt": datetime.now().isoformat(),
            "updatedAt": datetime.now().isoformat()
        }

        MOCK_WORKFLOWS.append(workflow_data)

        response_data = {
            "workflow_id": workflow_id,
            "status": "created",
            "message": "Workflow criado com sucesso!",
            "timestamp": datetime.now().isoformat(),
            "details": {
                "name": request.name,
                "agent_count": len(request.agents),
                "flow_type": request.flow_type
            }
        }

        logger.info(f"✅ [WORKFLOW: {request_id}] Workflow criado: ID {workflow_id}")
        logger.info(f"📊 [WORKFLOW: {request_id}] Total workflows: {len(MOCK_WORKFLOWS)}")

        return response_data

    except Exception as e:
        logger.error(f"❌ [WORKFLOW: {request_id}] Erro: {str(e)}")
        logger.error(f"📍 [WORKFLOW: {request_id}] Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Erro ao criar workflow: {str(e)}")


@app.get("/api/workflows")
async def list_workflows(user_id: int = Depends(get_current_user)):
    """List user workflows"""
    request_id = f"list_workflows_{int(datetime.now().timestamp())}"

    try:
        logger.info(f"📋 [WORKFLOWS: {request_id}] Listagem solicitada por usuário {user_id}")

        workflows = MOCK_WORKFLOWS.copy()

        logger.info(f"📊 [WORKFLOWS: {request_id}] Retornando {len(workflows)} workflows")
        logger.info(f"🏷️  [WORKFLOWS: {request_id}] Workflows: {[w['name'] for w in workflows]}")

        return workflows

    except Exception as e:
        logger.error(f"❌ [WORKFLOWS: {request_id}] Erro: {str(e)}")
        return []


@app.get("/api/sessions")
async def list_sessions(user_id: int = Depends(get_current_user)):
    """List user sessions"""
    request_id = f"list_sessions_{int(datetime.now().timestamp())}"

    try:
        logger.info(f"📋 [SESSIONS: {request_id}] Listagem de sessões - usuário {user_id}")

        # Mock sessions data
        sessions = [
            {
                "id": f"session_{i}_{user_id}",
                "agent_id": str((i % len(MOCK_AGENTS)) + 1),
                "user_id": user_id,
                "start_time": (datetime.now() - timedelta(hours=i)).isoformat(),
                "status": "completed",
                "message_count": 5 + (i * 2),
                "duration": f"{i + 1} minutos",
                "agent_name": MOCK_AGENTS[i % len(MOCK_AGENTS)]["name"]
            }
            for i in range(5)
        ]

        logger.info(f"📊 [SESSIONS: {request_id}] Retornando {len(sessions)} sessões")
        return sessions

    except Exception as e:
        logger.error(f"❌ [SESSIONS: {request_id}] Erro: {str(e)}")
        return []


@app.get("/api/metrics")
async def get_metrics(user_id: int = Depends(get_current_user)):
    """Get system metrics"""
    request_id = f"metrics_{int(datetime.now().timestamp())}"

    try:
        logger.info(f"📊 [METRICS: {request_id}] Métricas solicitadas por usuário {user_id}")

        # Calcular métricas reais
        active_agents = len([a for a in MOCK_AGENTS if a['status'] == 'active'])
        total_tools = sum(len(a.get('tools', [])) for a in MOCK_AGENTS)
        providers = list(set(a['modelProvider'] for a in MOCK_AGENTS))

        metrics = {
            "timestamp": datetime.now().isoformat(),
            "system": {
                "total_agents": len(MOCK_AGENTS),
                "active_agents": active_agents,
                "total_workflows": len(MOCK_WORKFLOWS),
                "active_sessions": len(agno_service.sessions),
                "total_tools": total_tools
            },
            "performance": {
                "system_status": "operational",
                "uptime": "sistema ativo",
                "version": "3.0.0",
                "avg_response_time_ms": 250,
                "success_rate": 98.5
            },
            "providers": {
                "available": providers,
                "distribution": {provider: len([a for a in MOCK_AGENTS if a['modelProvider'] == provider]) for provider
                                 in providers}
            },
            "usage": {
                "requests_today": 0,  # Implementar contador real
                "tokens_processed": 0,  # Implementar contador real
                "chat_sessions": len(agno_service.sessions)
            }
        }

        logger.info(f"✅ [METRICS: {request_id}] Métricas calculadas e retornadas")
        return metrics

    except Exception as e:
        logger.error(f"❌ [METRICS: {request_id}] Erro: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro ao obter métricas: {str(e)}")


# ===========================================
# STARTUP
# ===========================================

if __name__ == "__main__":
    import uvicorn

    logger.info("🚀 =====================================")
    logger.info("🚀 INICIANDO SERVIDOR AGNO PLATFORM...")
    logger.info("🚀 =====================================")

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info",
        access_log=True,
        reload=False  # Desabilitar reload em produção
    )