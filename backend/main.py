# main.py - Agno Platform Backend COMPLETO
# Versão: 4.1.0 - Sistema de Logging Avançado

import os
import json
import asyncio
import uuid
import traceback
import sys
from typing import List, Dict, Any, Optional, AsyncGenerator
from datetime import datetime, timedelta
import logging
from contextlib import asynccontextmanager
from pathlib import Path

# FastAPI imports
from fastapi import FastAPI, HTTPException, Depends, WebSocket, WebSocketDisconnect, Query, Request, Response
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

# ============================================
# IMPORTAR O AGNO SERVICE REAL
# ============================================
try:
    from agno_service import AgnoService, AgentConfig, WorkflowConfig, ModelProvider

    USING_REAL_AGNO = True
    print("✅ AgnoService REAL importado com sucesso!")
except ImportError as e:
    print(f"❌ Erro ao importar AgnoService real: {e}")
    print("⚠️ Fallback para MockAgnoService...")
    USING_REAL_AGNO = False

load_dotenv()

# =============================================
# CONFIGURAÇÃO DE LOGGING AVANÇADA
# =============================================

# Criar diretório de logs se não existir
log_dir = Path("/app/logs")
log_dir.mkdir(exist_ok=True)


class AdvancedFormatter(logging.Formatter):
    """Formatter avançado com cores, emojis e formatação melhorada"""

    # Cores ANSI
    COLORS = {
        'DEBUG': '\033[96m',  # Ciano claro
        'INFO': '\033[92m',  # Verde claro
        'WARNING': '\033[93m',  # Amarelo
        'ERROR': '\033[91m',  # Vermelho claro
        'CRITICAL': '\033[95m',  # Magenta
    }

    # Emojis por nível
    EMOJIS = {
        'DEBUG': '🔍',
        'INFO': '💡',
        'WARNING': '⚠️',
        'ERROR': '❌',
        'CRITICAL': '💥',
    }

    RESET = '\033[0m'
    BOLD = '\033[1m'

    def format(self, record):
        # Aplicar cor baseada no nível
        level_color = self.COLORS.get(record.levelname, self.RESET)
        emoji = self.EMOJIS.get(record.levelname, '📝')

        # Formatar nome do logger (encurtar se muito longo)
        logger_name = record.name
        if len(logger_name) > 15:
            logger_name = f"...{logger_name[-12:]}"

        # Criar timestamp colorido
        timestamp = self.formatTime(record, self.datefmt)

        # Montar mensagem com cores
        colored_level = f"{level_color}{self.BOLD}{record.levelname:8}{self.RESET}"
        colored_name = f"{level_color}{logger_name:15}{self.RESET}"

        # Formatação final
        formatted = f"{timestamp} {emoji} {colored_level} {colored_name} | {record.getMessage()}"

        # Adicionar stack trace se for exception
        if record.exc_info:
            formatted += f"\n{self.formatException(record.exc_info)}"

        return formatted


class RequestFormatter(logging.Formatter):
    """Formatter específico para logs de requests"""

    def format(self, record):
        # Detectar tipo de log baseado na mensagem
        msg = record.getMessage()

        if '📥' in msg:  # Request incoming
            emoji = '📥'
            color = '\033[94m'  # Azul
        elif '✅' in msg:  # Success
            emoji = '✅'
            color = '\033[92m'  # Verde
        elif '⚠️' in msg:  # Warning
            emoji = '⚠️'
            color = '\033[93m'  # Amarelo
        elif '❌' in msg or '💥' in msg:  # Error
            emoji = '💥'
            color = '\033[91m'  # Vermelho
        else:
            emoji = '🌐'
            color = '\033[96m'  # Ciano

        timestamp = self.formatTime(record, self.datefmt)
        colored_msg = f"{color}{msg}\033[0m"

        return f"{timestamp} {emoji} {colored_msg}"


# Configurar handlers
console_handler = logging.StreamHandler(sys.stdout)
console_handler.setFormatter(AdvancedFormatter(
    fmt='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%H:%M:%S'
))

# Handler para arquivo (sem cores)
file_handler = logging.FileHandler(log_dir / 'agno.log', mode='a', encoding='utf-8')
file_handler.setFormatter(logging.Formatter(
    '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
))

# Handler específico para requests
request_handler = logging.FileHandler(log_dir / 'requests.log', mode='a', encoding='utf-8')
request_handler.setFormatter(RequestFormatter(
    datefmt='%H:%M:%S'
))

# Configurar logger principal
logging.basicConfig(
    level=logging.INFO,
    handlers=[console_handler, file_handler],
    force=True
)

# Logger específico para requests
request_logger = logging.getLogger('requests')
request_logger.addHandler(request_handler)
request_logger.setLevel(logging.INFO)

# Logger principal da aplicação
logger = logging.getLogger(__name__)

# Suprimir logs verbosos do SQLAlchemy
logging.getLogger('sqlalchemy.engine').setLevel(logging.WARNING)
logging.getLogger('sqlalchemy.pool').setLevel(logging.WARNING)

logger.info("🎯 Sistema de logging avançado configurado com sucesso")

# =============================================
# DATABASE SETUP
# =============================================

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://agno_user:agno_password@postgres:5432/agno_db")
ASYNC_DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")

logger.info(f"🗄️ Configurando conexão com banco: {DATABASE_URL.split('@')[1] if '@' in DATABASE_URL else 'localhost'}")

# Create async engine com configuração otimizada
engine = create_async_engine(
    ASYNC_DATABASE_URL,
    echo=False,  # Desabilitar logs SQL verbosos
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
    pool_recycle=3600
)
async_session = async_sessionmaker(engine, expire_on_commit=False)

Base = declarative_base()


# =============================================
# PYDANTIC MODELS
# =============================================

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


# =============================================
# FALLBACK MOCK SERVICE
# =============================================

class FallbackMockService:
    """Serviço de fallback caso o Agno real não funcione"""

    def __init__(self):
        self.agents = {}
        self.sessions = {}
        self.logger = logging.getLogger(f"{__name__}.MockService")
        self.logger.warning("🔄 Usando FallbackMockService - AgnoService real não disponível")

    async def create_single_agent(self, user_id: int, config) -> str:
        agent_id = str(uuid.uuid4())
        self.agents[agent_id] = {
            "name": config.name if hasattr(config, 'name') else config["name"],
            "role": config.role if hasattr(config, 'role') else config["role"],
        }
        self.logger.info(f"🤖 Mock agent criado: {agent_id}")
        return agent_id

    async def run_agent(self, agent_id: str, message: str, user_id: int) -> AsyncGenerator[str, None]:
        session_id = f"mock_{agent_id}_{int(datetime.now().timestamp())}"

        self.logger.warning(f"🔄 Executando em modo fallback: {session_id}")

        response = f"[MODO FALLBACK] Resposta simulada para: '{message}'. O AgnoService real não está disponível."

        # Simular streaming
        words = response.split(' ')
        for word in words:
            chunk_data = {
                "type": "text",
                "content": word + " ",
                "session_id": session_id
            }
            yield f'data: {json.dumps(chunk_data)}\n\n'
            await asyncio.sleep(0.05)

        final_data = {"type": "done", "session_id": session_id}
        yield f'data: {json.dumps(final_data)}\n\n'

    async def list_agents(self, user_id: int) -> List[Dict]:
        return [
            {
                "id": agent_id,
                "name": agent_data["name"],
                "role": agent_data["role"],
                "type": "fallback_agent"
            }
            for agent_id, agent_data in self.agents.items()
        ]


# =============================================
# INICIALIZAR SERVIÇO
# =============================================

if USING_REAL_AGNO:
    try:
        agno_service = AgnoService()
        logger.info("🚀 ===== AGNO SERVICE REAL INICIALIZADO =====")
        logger.info("✅ Usando biblioteca Agno VERDADEIRA")
    except Exception as e:
        logger.error(f"❌ Erro ao inicializar AgnoService real: {e}")
        logger.error(f"📍 Traceback: {traceback.format_exc()}")
        agno_service = FallbackMockService()
        USING_REAL_AGNO = False
else:
    agno_service = FallbackMockService()


# Dependency para obter usuário atual
async def get_current_user() -> int:
    return 1  # Para desenvolvimento


# =============================================
# LIFESPAN MANAGER
# =============================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Gerenciar ciclo de vida da aplicação"""
    startup_time = datetime.now()

    logger.info("🚀" + "=" * 50)
    logger.info("🚀 INICIANDO AGNO PLATFORM")
    logger.info("🚀" + "=" * 50)

    if USING_REAL_AGNO:
        logger.info("✅ Modo: AgnoService REAL")
    else:
        logger.warning("⚠️ Modo: Serviço de Fallback")

    # Test database connection
    db_connected = False
    try:
        async with engine.begin() as conn:
            result = await conn.execute(sa.text("SELECT version()"))
            db_version = result.scalar()
            logger.info(f"✅ Database conectado: PostgreSQL")
            logger.debug(f"🔍 Versão do banco: {db_version}")
            db_connected = True
    except Exception as e:
        logger.error(f"❌ Falha na conexão com banco: {e}")
        db_connected = False

    # Verificar variáveis de ambiente
    env_vars = {
        "OPENAI_API_KEY": "🤖 OpenAI",
        "ANTHROPIC_API_KEY": "🧠 Anthropic",
        "SUPABASE_URL": "📊 Supabase URL",
        "SUPABASE_KEY": "🔑 Supabase Key"
    }

    missing_vars = []
    for var, desc in env_vars.items():
        if os.getenv(var):
            logger.info(f"✅ {desc}: configurado")
        else:
            logger.warning(f"⚠️ {desc}: não configurado")
            missing_vars.append(var)

    startup_duration = (datetime.now() - startup_time).total_seconds()

    if db_connected and not missing_vars:
        logger.info("🎉 Sistema totalmente operacional!")
    elif db_connected:
        logger.info("⚡ Sistema parcialmente operacional (API keys faltando)")
    else:
        logger.warning("⚠️ Sistema iniciado com limitações")

    logger.info(f"⏱️ Tempo de inicialização: {startup_duration:.2f}s")
    logger.info("🚀" + "=" * 50)

    yield

    # Shutdown
    logger.info("🛑 Encerrando Agno Platform...")
    try:
        await engine.dispose()
        logger.info("✅ Conexões de banco fechadas")
    except Exception as e:
        logger.error(f"❌ Erro ao fechar banco: {e}")

    shutdown_time = (datetime.now() - startup_time).total_seconds()
    logger.info(f"⏱️ Tempo total de execução: {shutdown_time:.2f}s")
    logger.info("👋 Agno Platform encerrado")


# =============================================
# FASTAPI APP
# =============================================

app = FastAPI(
    title="🚀 Agno Platform API",
    description="""
    ## Agno Platform API - Sistema Inteligente de Agentes IA

    ### Recursos:
    - 🤖 Criação e gerenciamento de agentes inteligentes
    - 🔄 Workflows automatizados
    - 💬 Chat em tempo real com streaming
    - 📊 Monitoramento e analytics
    - 🔌 Integração com múltiplos modelos de IA

    ### Tecnologias:
    - **Backend**: FastAPI + PostgreSQL
    - **Frontend**: Next.js + React
    - **IA**: OpenAI, Anthropic, e outros
    - **Deploy**: Docker + Docker Compose
    """,
    version="4.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
    contact={
        "name": "Agno Platform Team",
        "email": "support@agnoplatform.com",
    },
    license_info={
        "name": "MIT",
    },
)

# =============================================
# MIDDLEWARE CONFIGURATION
# =============================================

# CORS com configuração detalhada
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://frontend:3000",
        "https://agno-platform.vercel.app",  # Para produção
        "*"  # Para desenvolvimento - remover em produção
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# Trusted hosts
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["localhost", "127.0.0.1", "*.localhost", "*", "agno-platform.com", "*.agno-platform.com"]
)


# =============================================
# MIDDLEWARE DE LOGGING AVANÇADO
# =============================================

@app.middleware("http")
async def advanced_logging_middleware(request: Request, call_next):
    """Middleware avançado de logging com métricas detalhadas"""

    # Gerar ID único para request
    request_id = f"req_{int(datetime.now().timestamp())}_{hash(str(request.url)) % 10000}"
    start_time = datetime.now()

    # Extrair informações do cliente
    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")

    # Log de entrada
    request_logger.info(f"📥 [REQ:{request_id}] {request.method} {request.url}")
    request_logger.info(f"🌐 [REQ:{request_id}] IP: {client_ip}")

    # Headers importantes (sem dados sensíveis)
    important_headers = {
        "content-type": request.headers.get("content-type"),
        "accept": request.headers.get("accept"),
        "origin": request.headers.get("origin"),
    }
    filtered_headers = {k: v for k, v in important_headers.items() if v}
    if filtered_headers:
        request_logger.debug(f"📋 [REQ:{request_id}] Headers: {filtered_headers}")

    try:
        # Processar request
        response = await call_next(request)
        process_time = (datetime.now() - start_time).total_seconds()

        # Determinar emoji e nível baseado no status
        if response.status_code >= 500:
            emoji = "💥"
            log_level = logging.ERROR
            status_desc = "SERVER_ERROR"
        elif response.status_code >= 400:
            emoji = "⚠️"
            log_level = logging.WARNING
            status_desc = "CLIENT_ERROR"
        elif response.status_code >= 300:
            emoji = "🔄"
            log_level = logging.INFO
            status_desc = "REDIRECT"
        else:
            emoji = "✅"
            log_level = logging.INFO
            status_desc = "SUCCESS"

        # Log de resposta com métricas
        request_logger.log(
            log_level,
            f"{emoji} [REQ:{request_id}] {response.status_code} {status_desc} - {process_time:.3f}s - {request.method} {request.url.path}"
        )

        # Adicionar headers de debug
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Process-Time"] = f"{process_time:.3f}s"

        # Log de performance se for lento
        if process_time > 1.0:
            logger.warning(
                f"🐌 [REQ:{request_id}] Resposta lenta: {process_time:.3f}s para {request.method} {request.url.path}")

        return response

    except Exception as e:
        process_time = (datetime.now() - start_time).total_seconds()
        error_id = str(uuid.uuid4())[:8]

        # Log do erro
        logger.error(f"💥 [REQ:{request_id}] [ERR:{error_id}] Erro: {str(e)} - {process_time:.3f}s")
        logger.error(f"📍 [REQ:{request_id}] [ERR:{error_id}] Traceback: {traceback.format_exc()}")

        # Retornar erro estruturado
        return JSONResponse(
            status_code=500,
            content={
                "error": "Internal Server Error",
                "message": str(e),
                "request_id": request_id,
                "error_id": error_id,
                "timestamp": datetime.now().isoformat()
            },
            headers={
                "X-Request-ID": request_id,
                "X-Error-ID": error_id,
                "X-Process-Time": f"{process_time:.3f}s"
            }
        )


# =============================================
# ROTAS DA API
# =============================================

@app.get("/", tags=["Sistema"])
async def root():
    """🏠 Rota raiz - Informações do sistema"""
    logger.info("🏠 Endpoint raiz acessado")

    # Verificar status do banco
    db_status = "disconnected"
    db_latency = None
    try:
        db_start = datetime.now()
        async with engine.begin() as conn:
            await conn.execute(sa.text("SELECT 1"))
        db_latency = (datetime.now() - db_start).total_seconds() * 1000
        db_status = "connected"
    except Exception as e:
        logger.warning(f"⚠️ Verificação de banco falhou: {e}")
        db_status = "disconnected"

    system_info = {
        "service": "Agno Platform API",
        "status": "online",
        "version": "4.1.0",
        "mode": "real" if USING_REAL_AGNO else "fallback",
        "timestamp": datetime.now().isoformat(),
        "uptime": "calculating...",  # TODO: implementar uptime real
        "database": {
            "status": db_status,
            "latency_ms": round(db_latency, 2) if db_latency else None
        },
        "services": {
            "agno_service": "operational" if USING_REAL_AGNO else "fallback",
            "database": db_status,
        },
        "endpoints": {
            "health": "/api/health",
            "docs": "/docs",
            "redoc": "/redoc",
            "agents": "/api/agents",
            "workflows": "/api/workflows"
        },
        "environment": {
            "python_version": sys.version.split()[0],
            "fastapi_version": "0.100+",
        }
    }

    logger.info("✅ Informações do sistema retornadas")
    return system_info


@app.get("/api/health", tags=["Sistema"])
async def health_check():
    """🏥 Health check - Verificação de saúde do sistema"""
    logger.info("🏥 Health check solicitado")

    health_data = {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": "4.1.0",
        "checks": {}
    }

    # Verificar AgnoService
    try:
        if USING_REAL_AGNO and agno_service:
            health_data["checks"]["agno_service"] = {
                "status": "operational",
                "type": "real"
            }
        else:
            health_data["checks"]["agno_service"] = {
                "status": "fallback",
                "type": "mock"
            }
    except Exception as e:
        health_data["checks"]["agno_service"] = {
            "status": "error",
            "error": str(e)
        }

    # Verificar banco
    try:
        db_start = datetime.now()
        async with engine.begin() as conn:
            await conn.execute(sa.text("SELECT 1"))
        db_latency = (datetime.now() - db_start).total_seconds() * 1000

        health_data["checks"]["database"] = {
            "status": "connected",
            "latency_ms": round(db_latency, 2)
        }
    except Exception as e:
        health_data["checks"]["database"] = {
            "status": "error",
            "error": str(e)
        }
        health_data["status"] = "degraded"

    # Verificar variáveis de ambiente críticas
    env_checks = {}
    critical_env_vars = ["OPENAI_API_KEY", "ANTHROPIC_API_KEY"]
    for var in critical_env_vars:
        env_checks[var.lower()] = "configured" if os.getenv(var) else "missing"

    health_data["checks"]["environment"] = env_checks

    status_code = 200 if health_data["status"] == "healthy" else 503

    if health_data["status"] == "healthy":
        logger.info("✅ Health check passou - sistema operacional")
    else:
        logger.warning(f"⚠️ Health check com problemas: {health_data['status']}")

    return JSONResponse(content=health_data, status_code=status_code)


@app.get("/api/system/status", tags=["Sistema"])
async def system_status():
    """📊 Status detalhado do sistema com métricas"""
    logger.info("📊 Status detalhado solicitado")

    # TODO: Implementar métricas reais
    status = {
        "system": {
            "status": "operational",
            "uptime": "calculating...",
            "memory_usage": "calculating...",
            "cpu_usage": "calculating...",
        },
        "agno_service": {
            "type": "real" if USING_REAL_AGNO else "fallback",
            "status": "operational",
            "active_sessions": 0,  # TODO: contar sessões reais
        },
        "database": {
            "status": "connected",
            "pool_size": engine.pool.size(),
            "checked_in": engine.pool.checkedin(),
            "checked_out": engine.pool.checkedout(),
        },
        "metrics": {
            "requests_total": "calculating...",
            "requests_per_minute": "calculating...",
            "average_response_time": "calculating...",
            "error_rate": "calculating...",
        }
    }

    logger.info("✅ Status detalhado retornado")
    return status



@app.get("/api/agents", tags=["Agentes"])
async def list_agents(user_id: int = Query(1)):
    """📋 Listar agentes do banco PostgreSQL"""
    list_id = f"list_agents_{int(datetime.now().timestamp())}"

    logger.info(f"📋 [LIST:{list_id}] Listagem de agentes solicitada")
    logger.info(f"👤 [LIST:{list_id}] Usuário: {user_id}")

    try:
        async with async_session() as session:
            # Query SQL para buscar agentes ativos do usuário
            query = sa.text("""
                SELECT 
                    id,
                    name,
                    model_id,
                    model_provider,
                    role,
                    is_active,
                    created_at,
                    instructions,
                    tools,
                    memory_enabled,
                    rag_enabled,
                    configuration
                FROM agno_agents 
                WHERE user_id = :user_id 
                AND is_active = true
                ORDER BY created_at DESC
            """)

            result = await session.execute(query, {"user_id": user_id})
            rows = result.fetchall()

            # Converter para formato esperado pelo frontend
            agents = []
            for row in rows:
                # Garantir que tools e instructions sejam arrays
                tools = row.tools if isinstance(row.tools, list) else (row.tools or [])
                instructions = row.instructions if isinstance(row.instructions, list) else (row.instructions or [])

                agent = {
                    "id": row.id,
                    "name": row.name,  # ✅ Campo correto para frontend
                    "role": row.role or "Assistente",  # ✅ Campo correto para frontend
                    "model_provider": row.model_provider,
                    "model_id": row.model_id,
                    "is_active": row.is_active,
                    "created_at": row.created_at.isoformat() if row.created_at else datetime.now().isoformat(),
                    "tools": tools,
                    "instructions": instructions,
                    "memory_enabled": row.memory_enabled,
                    "rag_enabled": row.rag_enabled,
                    # Campos para compatibilidade com frontend antigo (se houver)
                    "nome": row.name,
                    "modelo": row.model_id,
                    "empresa": row.model_provider,
                    "agent_role": row.role or "Assistente",
                    "is_active_agent": row.is_active,
                    "langchain_config": json.dumps({
                        "tools": tools,
                        "memory_enabled": row.memory_enabled,
                        "rag_enabled": row.rag_enabled,
                        "model_provider": row.model_provider,
                        "model_id": row.model_id,
                        "instructions": instructions
                    })
                }
                agents.append(agent)

            # Logs detalhados
            logger.info(f"📊 [LIST:{list_id}] Encontrados {len(agents)} agentes no banco")

            if agents:
                agent_names = [agent["name"] for agent in agents]
                logger.info(f"🏷️  [LIST:{list_id}] Agentes: {agent_names}")

                # Contar providers
                providers = set(agent["model_provider"] for agent in agents)
                logger.info(f"✅ [LIST:{list_id}] {len(agents)} ativos, providers: {list(providers)}")
            else:
                logger.info(f"📋 [LIST:{list_id}] Nenhum agente encontrado - banco vazio")

            return agents

    except Exception as e:
        logger.error(f"❌ [LIST:{list_id}] Erro ao consultar banco: {e}")
        logger.error(f"📍 Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Erro ao consultar agentes: {str(e)}")


@app.get("/api/workflows", tags=["Workflows"])
async def list_workflows(user_id: int = Query(1)):
    """📋 Listar workflows do banco PostgreSQL"""
    list_id = f"list_workflows_{int(datetime.now().timestamp())}"

    logger.info(f"📋 [WORKFLOWS:{list_id}] Listagem solicitada por usuário {user_id}")

    try:
        async with async_session() as session:
            # Query SQL para buscar workflows ativos
            query = sa.text("""
                SELECT 
                    w.id,
                    w.name,
                    w.description,
                    w.flow_type,
                    w.is_active,
                    w.created_at,
                    w.workflow_definition,
                    COUNT(wa.agent_id) as total_agents
                FROM agno_workflows w
                LEFT JOIN agno_workflow_agents wa ON w.id = wa.workflow_id
                WHERE w.user_id = :user_id 
                AND w.is_active = true
                GROUP BY w.id, w.name, w.description, w.flow_type, w.is_active, w.created_at, w.workflow_definition
                ORDER BY w.created_at DESC
            """)

            result = await session.execute(query, {"user_id": user_id})
            rows = result.fetchall()

            # Converter para formato esperado pelo frontend
            workflows = []
            for row in rows:
                workflow = {
                    "id": row.id,
                    "name": row.name,  # ✅ Campo correto para frontend
                    "description": row.description or "Workflow sem descrição",  # ✅ Campo correto
                    "flow_type": row.flow_type,
                    "is_active": row.is_active,
                    "created_at": row.created_at.isoformat() if row.created_at else datetime.now().isoformat(),
                    "total_agents": row.total_agents,
                    "workflow_definition": row.workflow_definition or {},
                    # Campos para compatibilidade (se houver frontend antigo)
                    "nome": row.name,
                    "descricao": row.description or "Workflow sem descrição"
                }
                workflows.append(workflow)

            # Logs detalhados
            logger.info(f"📊 [WORKFLOWS:{list_id}] Encontrados {len(workflows)} workflows no banco")

            if workflows:
                workflow_names = [wf["name"] for wf in workflows]
                logger.info(f"🏷️  [WORKFLOWS:{list_id}] Workflows: {workflow_names}")
            else:
                logger.info(f"📋 [WORKFLOWS:{list_id}] Nenhum workflow encontrado - banco vazio")

            return workflows

    except Exception as e:
        logger.error(f"❌ [WORKFLOWS:{list_id}] Erro ao consultar banco: {e}")
        logger.error(f"📍 Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Erro ao consultar workflows: {str(e)}")


# =============================================
# 💬 ADICIONAR ROTA DE CHAT NO main.py
# Logo após as outras rotas
# =============================================

@app.post("/api/agents/{agent_id}/chat", tags=["Chat"])
async def chat_with_agent(
        agent_id: int,
        message: ChatMessage,
        user_id: int = Query(1)
):
    """💬 Conversar com um agente específico usando AgnoService REAL"""
    chat_id = f"chat_{agent_id}_{int(datetime.now().timestamp())}"

    logger.info(f"💬 [CHAT:{chat_id}] Chat iniciado com agente {agent_id}")
    logger.info(f"👤 [CHAT:{chat_id}] Usuário: {user_id}")
    logger.info(f"💭 [CHAT:{chat_id}] Mensagem: '{message.message}'")

    if not USING_REAL_AGNO or not agno_service:
        logger.error(f"❌ [CHAT:{chat_id}] AgnoService não disponível")
        raise HTTPException(status_code=503, detail="AgnoService não disponível")

    try:
        # Buscar dados do agente no banco PostgreSQL
        async with async_session() as session:
            agent_query = sa.text("""
                SELECT id, name, role, model_provider, model_id, instructions, tools, memory_enabled, rag_enabled
                FROM agno_agents 
                WHERE id = :agent_id AND user_id = :user_id AND is_active = true
            """)

            result = await session.execute(agent_query, {
                "agent_id": agent_id,
                "user_id": user_id
            })
            agent_row = result.fetchone()

            if not agent_row:
                logger.warning(f"⚠️ [CHAT:{chat_id}] Agente {agent_id} não encontrado no banco")
                raise HTTPException(status_code=404, detail=f"Agente {agent_id} não encontrado")

            logger.info(f"🤖 [CHAT:{chat_id}] Agente encontrado: '{agent_row.name}'")
            logger.info(f"🧠 [CHAT:{chat_id}] Modelo: {agent_row.model_provider}/{agent_row.model_id}")

        # Criar/sincronizar agente no AgnoService
        logger.info(f"🔄 [CHAT:{chat_id}] Sincronizando agente com AgnoService...")

        try:
            # Preparar configuração do agente
            instructions = agent_row.instructions if isinstance(agent_row.instructions, list) else [
                agent_row.instructions or "Você é um assistente útil."]
            tools = agent_row.tools if isinstance(agent_row.tools, list) else []

            agent_config = AgentConfig(
                name=agent_row.name,
                role=agent_row.role or "Assistente",
                model_provider=ModelProvider(agent_row.model_provider),
                model_id=agent_row.model_id,
                instructions=instructions,
                tools=tools,
                memory_enabled=agent_row.memory_enabled or True,
                rag_enabled=agent_row.rag_enabled or False
            )

            # Criar agente no AgnoService
            agno_agent_id = await agno_service.create_single_agent(user_id, agent_config)
            logger.info(f"✅ [CHAT:{chat_id}] Agente sincronizado - AgnoService ID: {agno_agent_id}")

        except Exception as sync_error:
            logger.error(f"❌ [CHAT:{chat_id}] Erro ao sincronizar agente: {sync_error}")
            # Tentar usar ID original como string
            agno_agent_id = str(agent_id)
            logger.info(f"🔄 [CHAT:{chat_id}] Usando ID original: {agno_agent_id}")

        # Executar chat com AgnoService
        logger.info(f"🚀 [CHAT:{chat_id}] Iniciando execução com AgnoService...")

        async def stream_agno_response():
            try:
                chunk_count = 0
                logger.info(f"🎯 [CHAT:{chat_id}] Executando agente ID: {agno_agent_id}")

                async for chunk in agno_service.run_agent(
                        agent_id=agno_agent_id,
                        message=message.message,
                        user_id=user_id
                ):
                    chunk_count += 1
                    if chunk_count <= 3:  # Log apenas primeiros chunks para não spammar
                        logger.debug(f"📦 [CHAT:{chat_id}] Chunk {chunk_count}: {chunk[:100]}...")
                    yield chunk

                logger.info(f"✅ [CHAT:{chat_id}] AgnoService concluído - {chunk_count} chunks enviados")

            except Exception as exec_error:
                logger.error(f"❌ [CHAT:{chat_id}] Erro na execução: {exec_error}")
                logger.error(f"📍 [CHAT:{chat_id}] Traceback: {traceback.format_exc()}")

                # Enviar erro estruturado para o frontend
                error_response = {
                    "type": "error",
                    "error": str(exec_error),
                    "agent_id": agent_id,
                    "agent_name": agent_row.name,
                    "timestamp": datetime.now().isoformat()
                }
                yield f'data: {json.dumps(error_response)}\n\n'

        # Retornar streaming response
        return StreamingResponse(
            stream_agno_response(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Content-Type": "text/event-stream",
                "X-Agent-ID": str(agent_id),
                "X-Agent-Name": agent_row.name,
                "X-Chat-ID": chat_id
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ [CHAT:{chat_id}] Erro geral: {e}")
        logger.error(f"📍 [CHAT:{chat_id}] Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Erro no chat: {str(e)}")






# =============================================
# 📋 ROTA ADICIONAL: Listar sessões de chat
# =============================================

@app.get("/api/agents/{agent_id}/sessions", tags=["Chat"])
async def list_agent_sessions(
        agent_id: int,
        user_id: int = Query(1),
        limit: int = Query(10, ge=1, le=100)
):
    """📋 Listar sessões de chat de um agente"""
    logger.info(f"📋 Listando sessões do agente {agent_id} para usuário {user_id}")

    try:
        async with async_session() as session:
            # Verificar se agente existe
            agent_check = sa.text("""
                SELECT name FROM agno_agents 
                WHERE id = :agent_id AND user_id = :user_id AND is_active = true
            """)

            result = await session.execute(agent_check, {
                "agent_id": agent_id,
                "user_id": user_id
            })
            agent = result.fetchone()

            if not agent:
                raise HTTPException(status_code=404, detail=f"Agente {agent_id} não encontrado")

            # Buscar sessões (se tabela existir)
            try:
                sessions_query = sa.text("""
                    SELECT id, session_name, status, started_at, ended_at
                    FROM agno_chat_sessions
                    WHERE agent_id = :agent_id AND user_id = :user_id
                    ORDER BY started_at DESC
                    LIMIT :limit
                """)

                sessions_result = await session.execute(sessions_query, {
                    "agent_id": agent_id,
                    "user_id": user_id,
                    "limit": limit
                })
                sessions = [
                    {
                        "id": str(row.id),
                        "name": row.session_name or f"Chat com {agent.name}",
                        "status": row.status,
                        "started_at": row.started_at.isoformat() if row.started_at else None,
                        "ended_at": row.ended_at.isoformat() if row.ended_at else None
                    }
                    for row in sessions_result.fetchall()
                ]

            except Exception:
                # Tabela não existe - retornar lista vazia
                sessions = []

            logger.info(f"✅ Encontradas {len(sessions)} sessões para agente {agent_id}")

            return {
                "agent_id": agent_id,
                "agent_name": agent.name,
                "sessions": sessions,
                "total": len(sessions)
            }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Erro ao listar sessões: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao listar sessões: {str(e)}")



@app.post("/api/agents/create", tags=["Agentes"])
async def create_agent(request: CreateAgentRequest, user_id: int = Query(1)):
    """🤖 Criar novo agente no banco PostgreSQL"""
    create_id = f"create_agent_{int(datetime.now().timestamp())}"

    logger.info(f"🤖 [CREATE:{create_id}] Criação de agente solicitada")
    logger.info(f"👤 [CREATE:{create_id}] Usuário: {user_id}")
    logger.info(f"🏷️  [CREATE:{create_id}] Nome: '{request.name}'")
    logger.info(f"🎭 [CREATE:{create_id}] Papel: '{request.role}'")
    logger.info(f"🧠 [CREATE:{create_id}] Modelo: {request.model_provider}/{request.model_id}")

    try:
        async with async_session() as session:
            # Inserir novo agente no banco
            insert_query = sa.text("""
                INSERT INTO agno_agents (
                    user_id, name, description, role, model_provider, model_id,
                    instructions, tools, memory_enabled, rag_enabled, rag_index_id,
                    is_active, created_at, updated_at
                ) VALUES (
                    :user_id, :name, :description, :role, :model_provider, :model_id,
                    :instructions, :tools, :memory_enabled, :rag_enabled, :rag_index_id,
                    true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                ) RETURNING id, created_at
            """)

            result = await session.execute(insert_query, {
                "user_id": user_id,
                "name": request.name,
                "description": f"Agente {request.role}",
                "role": request.role,
                "model_provider": request.model_provider,
                "model_id": request.model_id,
                "instructions": json.dumps(request.instructions),
                "tools": json.dumps(request.tools),
                "memory_enabled": request.memory_enabled,
                "rag_enabled": request.rag_enabled,
                "rag_index_id": request.rag_index_id
            })

            row = result.fetchone()
            await session.commit()

            agent_id = row.id
            created_at = row.created_at

            logger.info(f"✅ [CREATE:{create_id}] Agente salvo no banco com ID: {agent_id}")

            # Retornar agente criado no formato esperado
            new_agent = {
                "id": agent_id,
                "nome": request.name,
                "modelo": request.model_id,
                "empresa": request.model_provider,
                "agent_role": request.role,
                "is_active_agent": True,
                "created_at": created_at.isoformat(),
                "langchain_config": json.dumps({
                    "tools": request.tools,
                    "memory_enabled": request.memory_enabled,
                    "rag_enabled": request.rag_enabled,
                    "model_provider": request.model_provider,
                    "model_id": request.model_id,
                    "instructions": request.instructions
                })
            }

            return new_agent

    except Exception as e:
        logger.error(f"❌ [CREATE:{create_id}] Erro ao salvar no banco: {e}")
        logger.error(f"📍 Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Erro ao criar agente: {str(e)}")


@app.post("/api/workflows/create", tags=["Workflows"])
async def create_workflow(request: CreateWorkflowRequest, user_id: int = Query(1)):
    """🔄 Criar novo workflow no banco PostgreSQL"""
    create_id = f"create_workflow_{int(datetime.now().timestamp())}"

    logger.info(f"🔄 [CREATE:{create_id}] Criação de workflow solicitada")
    logger.info(f"👤 [CREATE:{create_id}] Usuário: {user_id}")
    logger.info(f"🏷️  [CREATE:{create_id}] Nome: '{request.name}'")
    logger.info(f"📝 [CREATE:{create_id}] Descrição: '{request.description}'")
    logger.info(f"🔀 [CREATE:{create_id}] Tipo: {request.flow_type}")
    logger.info(f"👥 [CREATE:{create_id}] Agentes: {len(request.agents)}")

    try:
        async with async_session() as session:
            # Inserir workflow no banco
            insert_query = sa.text("""
                INSERT INTO agno_workflows (
                    user_id, name, description, flow_type, workflow_definition,
                    is_active, created_at, updated_at
                ) VALUES (
                    :user_id, :name, :description, :flow_type, :workflow_definition,
                    true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                ) RETURNING id, created_at
            """)

            # Montar definição do workflow
            workflow_definition = {
                "supervisor_enabled": request.supervisor_enabled,
                "agents": [
                    {
                        "name": agent.name,
                        "role": agent.role,
                        "model_provider": agent.model_provider,
                        "model_id": agent.model_id,
                        "tools": agent.tools
                    }
                    for agent in request.agents
                ]
            }

            result = await session.execute(insert_query, {
                "user_id": user_id,
                "name": request.name,
                "description": request.description,
                "flow_type": request.flow_type,
                "workflow_definition": json.dumps(workflow_definition)
            })

            row = result.fetchone()
            await session.commit()

            workflow_id = row.id
            created_at = row.created_at

            logger.info(f"✅ [CREATE:{create_id}] Workflow salvo no banco com ID: {workflow_id}")

            # Retornar workflow criado
            new_workflow = {
                "id": workflow_id,
                "nome": request.name,
                "descricao": request.description,
                "flow_type": request.flow_type,
                "is_active": True,
                "created_at": created_at.isoformat(),
                "total_agents": len(request.agents),
                "workflow_definition": workflow_definition
            }

            return new_workflow

    except Exception as e:
        logger.error(f"❌ [CREATE:{create_id}] Erro ao salvar workflow: {e}")
        logger.error(f"📍 Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Erro ao criar workflow: {str(e)}")


@app.get("/api/database/status", tags=["Sistema"])
async def database_status():
    """🗄️ Status detalhado do banco de dados"""
    logger.info("🗄️ Verificação de status do banco solicitada")

    try:
        async with async_session() as session:
            # Contar registros nas principais tabelas
            queries = {
                "users": "SELECT COUNT(*) as total FROM agno_users",
                "agents": "SELECT COUNT(*) as total FROM agno_agents WHERE is_active = true",
                "workflows": "SELECT COUNT(*) as total FROM agno_workflows WHERE is_active = true",
                "sessions": "SELECT COUNT(*) as total FROM agno_chat_sessions",
            }

            counts = {}
            for table, query in queries.items():
                result = await session.execute(sa.text(query))
                counts[table] = result.scalar()

            # Verificar conectividade
            version_result = await session.execute(sa.text("SELECT version()"))
            db_version = version_result.scalar()

            status = {
                "database": {
                    "status": "connected",
                    "version": db_version.split()[1] if db_version else "unknown",  # Extrair só versão
                    "counts": counts
                },
                "tables": {
                    "agno_users": f"{counts['users']} usuários",
                    "agno_agents": f"{counts['agents']} agentes ativos",
                    "agno_workflows": f"{counts['workflows']} workflows ativos",
                    "agno_chat_sessions": f"{counts['sessions']} sessões"
                },
                "timestamp": datetime.now().isoformat()
            }

            logger.info(f"✅ Status do banco: {counts}")
            return status

    except Exception as e:
        logger.error(f"❌ Erro ao verificar status do banco: {e}")
        return {
            "database": {
                "status": "error",
                "error": str(e)
            },
            "timestamp": datetime.now().isoformat()
        }


# =============================================
# ROTA PARA POPULAR BANCO COM DADOS DE TESTE
# =============================================

@app.post("/api/database/seed", tags=["Sistema"])
async def seed_database():
    """🌱 Popular banco com dados de teste"""
    logger.info("🌱 Populando banco com dados de teste...")

    try:
        async with async_session() as session:
            # Verificar se usuário padrão existe
            user_check = await session.execute(
                sa.text("SELECT id FROM agno_users WHERE email = 'demo@agno.ai' LIMIT 1")
            )
            user_row = user_check.fetchone()

            if not user_row:
                # Criar usuário demo
                await session.execute(sa.text("""
                    INSERT INTO agno_users (username, email, full_name, is_active)
                    VALUES ('demo', 'demo@agno.ai', 'Demo User', true)
                """))
                logger.info("✅ Usuário demo criado")

            # Buscar ID do usuário
            user_result = await session.execute(
                sa.text("SELECT id FROM agno_users WHERE email = 'demo@agno.ai' LIMIT 1")
            )
            user_id = user_result.scalar()

            # Criar agentes de exemplo se não existirem
            agent_check = await session.execute(
                sa.text("SELECT COUNT(*) FROM agno_agents WHERE user_id = :user_id"),
                {"user_id": user_id}
            )
            agent_count = agent_check.scalar()

            if agent_count == 0:
                sample_agents = [
                    {
                        "name": "Assistente Geral",
                        "role": "Assistente geral para diversas tarefas",
                        "model_provider": "openai",
                        "model_id": "gpt-4o-mini",
                        "tools": ["reasoning", "web_search"],
                        "instructions": ["Você é um assistente útil e prestativo."]
                    },
                    {
                        "name": "Especialista em Código",
                        "role": "Especialista em programação e desenvolvimento",
                        "model_provider": "anthropic",
                        "model_id": "claude-3-5-sonnet-20241022",
                        "tools": ["code_interpreter", "reasoning"],
                        "instructions": ["Você é especialista em programação.", "Use melhores práticas de código."]
                    },
                    {
                        "name": "Analista Financeiro",
                        "role": "Especialista em análise financeira",
                        "model_provider": "openai",
                        "model_id": "gpt-4o",
                        "tools": ["calculations", "web_search"],
                        "instructions": ["Forneça análises financeiras precisas.", "Sempre inclua disclaimers."]
                    }
                ]

                for agent in sample_agents:
                    await session.execute(sa.text("""
                        INSERT INTO agno_agents (
                            user_id, name, role, model_provider, model_id,
                            instructions, tools, memory_enabled, is_active
                        ) VALUES (
                            :user_id, :name, :role, :model_provider, :model_id,
                            :instructions, :tools, true, true
                        )
                    """), {
                        "user_id": user_id,
                        "name": agent["name"],
                        "role": agent["role"],
                        "model_provider": agent["model_provider"],
                        "model_id": agent["model_id"],
                        "instructions": json.dumps(agent["instructions"]),
                        "tools": json.dumps(agent["tools"])
                    })

                logger.info(f"✅ {len(sample_agents)} agentes de exemplo criados")

            # Criar workflow de exemplo se não existir
            workflow_check = await session.execute(
                sa.text("SELECT COUNT(*) FROM agno_workflows WHERE user_id = :user_id"),
                {"user_id": user_id}
            )
            workflow_count = workflow_check.scalar()

            if workflow_count == 0:
                await session.execute(sa.text("""
                    INSERT INTO agno_workflows (
                        user_id, name, description, flow_type, workflow_definition, is_active
                    ) VALUES (
                        :user_id, 'Análise de Dados Completa', 
                        'Workflow para análise completa de dados com múltiplos agentes',
                        'sequential', :workflow_definition, true
                    )
                """), {
                    "user_id": user_id,
                    "workflow_definition": json.dumps({
                        "steps": [
                            {"step": 1, "agent": "Assistente Geral", "description": "Preparação dos dados"},
                            {"step": 2, "agent": "Analista Financeiro", "description": "Análise financeira"},
                            {"step": 3, "agent": "Especialista em Código", "description": "Visualizações"}
                        ]
                    })
                })

                logger.info("✅ Workflow de exemplo criado")

            await session.commit()

            # Verificar contagens finais
            final_counts = {}
            for table in ["agno_users", "agno_agents", "agno_workflows"]:
                result = await session.execute(sa.text(f"SELECT COUNT(*) FROM {table}"))
                final_counts[table] = result.scalar()

            logger.info("🎉 Banco populado com sucesso!")
            return {
                "message": "Banco populado com dados de teste",
                "counts": final_counts,
                "timestamp": datetime.now().isoformat()
            }

    except Exception as e:
        logger.error(f"❌ Erro ao popular banco: {e}")
        logger.error(f"📍 Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Erro ao popular banco: {str(e)}")

# =============================================
# EXCEPTION HANDLERS
# =============================================

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handler customizado para HTTPExceptions"""
    error_id = str(uuid.uuid4())[:8]

    logger.warning(f"⚠️ HTTP {exc.status_code}: {exc.detail} [ERR:{error_id}]")

    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail,
            "status_code": exc.status_code,
            "error_id": error_id,
            "timestamp": datetime.now().isoformat(),
            "path": str(request.url)
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handler para exceções gerais não tratadas"""
    error_id = str(uuid.uuid4())[:8]

    logger.error(f"💥 Erro não tratado [ERR:{error_id}]: {str(exc)}")
    logger.error(f"📍 Traceback [ERR:{error_id}]: {traceback.format_exc()}")

    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal Server Error",
            "message": "Um erro inesperado ocorreu",
            "error_id": error_id,
            "timestamp": datetime.now().isoformat(),
            "path": str(request.url)
        }
    )


# =============================================
# STARTUP MESSAGE
# =============================================

if __name__ == "__main__":
    import uvicorn

    logger.info("🚀 Iniciando servidor Uvicorn...")
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )