# app.py - Agno Platform Backend MELHORADO E CORRIGIDO
# Versão: 4.5.1 - Correções de importação e routers

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
from fastapi import FastAPI, HTTPException, Depends, WebSocket, WebSocketDisconnect, Query, Request, Response, Body, \
    BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from pydantic import BaseModel, Field

# Database imports
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy import text as sa_text
import sqlalchemy as sa

# Environment
from dotenv import load_dotenv

load_dotenv()


# =============================================
# CONFIGURAÇÃO DE LOGGING MELHORADA
# =============================================

class ColoredFormatter(logging.Formatter):
    """Formatter com cores para melhor visualização"""

    COLORS = {
        'DEBUG': '\033[96m',  # Cyan
        'INFO': '\033[92m',  # Green
        'WARNING': '\033[93m',  # Yellow
        'ERROR': '\033[91m',  # Red
        'CRITICAL': '\033[95m'  # Purple
    }

    EMOJIS = {
        'DEBUG': '🔍',
        'INFO': '💡',
        'WARNING': '⚠️',
        'ERROR': '❌',
        'CRITICAL': '💥'
    }

    RESET = '\033[0m'

    def format(self, record):
        color = self.COLORS.get(record.levelname, self.RESET)
        emoji = self.EMOJIS.get(record.levelname, '📝')

        # Formatação mais limpa
        timestamp = self.formatTime(record, '%H:%M:%S')
        level = f"{color}{record.levelname:8}{self.RESET}"

        return f"{timestamp} {emoji} {level} | {record.getMessage()}"


# Configurar logging
log_dir = Path("logs")
log_dir.mkdir(exist_ok=True)

# Console handler com cores
console_handler = logging.StreamHandler(sys.stdout)
console_handler.setFormatter(ColoredFormatter())

# File handler para logs
file_handler = logging.FileHandler(log_dir / 'agno.log', mode='a', encoding='utf-8')
file_handler.setFormatter(logging.Formatter(
    '%(asctime)s - %(name)s - [%(levelname)s] - %(message)s'
))

# Configurar logger principal
logging.basicConfig(
    level=logging.INFO,
    handlers=[console_handler, file_handler],
    force=True
)

logger = logging.getLogger(__name__)

# =============================================
# DATABASE SETUP MELHORADO
# =============================================

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://agno_user:agno_password@localhost:5432/agno_db")

# Converter para async se necessário
if DATABASE_URL.startswith("postgresql://"):
    ASYNC_DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
else:
    ASYNC_DATABASE_URL = DATABASE_URL

logger.info(f"🗄️ Conectando ao banco: {ASYNC_DATABASE_URL.split('@')[1] if '@' in ASYNC_DATABASE_URL else 'local'}")

# Engine otimizado
engine = create_async_engine(
    ASYNC_DATABASE_URL,
    echo=False,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
    pool_recycle=3600,
    connect_args={
        "command_timeout": 10,
    } if "postgresql" in ASYNC_DATABASE_URL else {}
)

async_session = async_sessionmaker(engine, expire_on_commit=False)
Base = declarative_base()


async def get_db() -> AsyncSession:
    """Dependência melhorada para obter sessão do banco"""
    async with async_session() as session:
        try:
            yield session
        except Exception as e:
            await session.rollback()
            logger.error(f"Erro na sessão do banco: {e}")
            raise
        finally:
            await session.close()


# =============================================
# VERIFICAÇÃO DE AGNO FRAMEWORK
# =============================================

AGNO_AVAILABLE = False
real_agno_router = None

try:
    from routers.agno_services import get_real_agno_service, AGNO_AVAILABLE as agno_check

    AGNO_AVAILABLE = agno_check

    if AGNO_AVAILABLE:
        logger.info("✅ Agno framework disponível")

        # Tentar importar rotas
        try:
            from routers.agno_routes import router as real_agno_router

            logger.info("✅ Rotas do Agno importadas")
        except ImportError as e:
            logger.warning(f"⚠️ Rotas do Agno não encontradas: {e}")
            real_agno_router = None
    else:
        logger.warning("⚠️ Agno framework encontrado mas não configurado")

except ImportError as e:
    logger.warning(f"⚠️ Agno framework não disponível: {e}")
    AGNO_AVAILABLE = False


# =============================================
# MODELOS PYDANTIC MELHORADOS
# =============================================

class BaseResponse(BaseModel):
    """Resposta padrão da API"""
    success: bool = True
    message: str = "OK"
    data: Optional[Any] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class HealthResponse(BaseModel):
    """Resposta do health check"""
    status: str
    timestamp: str
    version: str
    environment: str
    services: Dict[str, Any]
    agno_available: bool


class CreateAgentRequest(BaseModel):
    """Modelo para criar agente"""
    name: str = Field(..., min_length=2, max_length=100)
    role: str = Field(..., max_length=100)
    model_provider: str = Field(default="openai")
    model_id: str = Field(default="gpt-4")
    instructions: List[str] = Field(default=["Você é um assistente útil."])
    tools: List[str] = Field(default_factory=list)
    memory_enabled: bool = True
    rag_enabled: bool = False
    description: Optional[str] = Field(None, max_length=500)


class ChatRequest(BaseModel):
    """Modelo para chat"""
    prompt: str = Field(..., min_length=1, max_length=10000)
    stream: bool = True

class TeamCreateRequest(BaseModel):
    """Modelo para criar team"""
    name: str = Field(..., min_length=2, max_length=100)
    description: str = Field(default="", max_length=500)
    team_type: str = Field(default="collaborative", pattern="^(collaborative|hierarchical|sequential)$")
    agents: List[Dict[str, Any]] = Field(default_factory=list)
    supervisor_agent_id: Optional[int] = None
    team_configuration: Dict[str, Any] = Field(default_factory=dict)

class TeamExecuteRequest(BaseModel):
    """Modelo para executar team"""
    message: str = Field(..., min_length=1, max_length=10000)
    context: Dict[str, Any] = Field(default_factory=dict)
# =============================================
# GERENCIADOR DE WEBSOCKET SIMPLES
# =============================================

class WebSocketManager:
    """Gerenciador simples de conexões WebSocket"""

    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket
        logger.info(f"🔌 WebSocket conectado: {client_id}")

    def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]
            logger.info(f"🔌 WebSocket desconectado: {client_id}")

    async def send_personal_message(self, message: str, client_id: str):
        if client_id in self.active_connections:
            try:
                await self.active_connections[client_id].send_text(message)
                return True
            except Exception as e:
                logger.error(f"Erro ao enviar mensagem WebSocket: {e}")
                self.disconnect(client_id)
                return False
        return False


ws_manager = WebSocketManager()


# =============================================
# LIFESPAN MANAGER MELHORADO
# =============================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Gerenciar ciclo de vida da aplicação com verificações robustas"""
    startup_time = datetime.now()

    logger.info("🚀" + "=" * 60)
    logger.info("🚀 INICIANDO AGNO PLATFORM v4.5.1")
    logger.info("🚀" + "=" * 60)

    # Verificar variáveis de ambiente importantes
    env_vars = {
        "DATABASE_URL": DATABASE_URL != "postgresql://agno_user:agno_password@localhost:5432/agno_db",
        "OPENAI_API_KEY": bool(os.getenv("OPENAI_API_KEY")),
        "ANTHROPIC_API_KEY": bool(os.getenv("ANTHROPIC_API_KEY"))
    }

    configured_keys = sum(env_vars.values())
    logger.info(f"🔑 Variáveis configuradas: {configured_keys}/3")

    # Testar conexão com banco
    db_connected = False
    db_error = None
    try:
        async with async_session() as session:
            await session.execute(sa_text("SELECT 1"))
            db_connected = True
        logger.info("✅ Banco de dados conectado")
    except Exception as e:
        db_error = str(e)
        logger.error(f"❌ Falha ao conectar banco: {e}")

    # Status do sistema
    if AGNO_AVAILABLE and db_connected and configured_keys >= 1:
        system_status = "fully_operational"
        logger.info("🎉 Sistema totalmente operacional!")
    elif db_connected:
        system_status = "partial"
        logger.info("⚡ Sistema parcialmente operacional")
    else:
        system_status = "degraded"
        logger.warning("⚠️ Sistema com limitações")

    # Tempo de startup
    startup_duration = (datetime.now() - startup_time).total_seconds()
    logger.info(f"⏱️ Inicialização completada em {startup_duration:.2f}s")

    # Armazenar informações no app state
    app.state.startup_status = system_status
    app.state.agno_available = AGNO_AVAILABLE
    app.state.db_connected = db_connected
    app.state.db_error = db_error
    app.state.startup_time = startup_time

    logger.info("🚀" + "=" * 60)

    yield

    # Shutdown
    logger.info("🛑 Encerrando Agno Platform...")
    try:
        await engine.dispose()
        logger.info("✅ Conexões fechadas com sucesso")
    except Exception as e:
        logger.error(f"❌ Erro no shutdown: {e}")


# =============================================
# FASTAPI APP
# =============================================

app = FastAPI(
    title="🚀 Agno Platform API",
    description="Sistema avançado de agentes IA com interface moderna",
    version="4.5.1",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# =============================================
# MIDDLEWARE OTIMIZADO
# =============================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://frontend:3000",
        "*"  # Para desenvolvimento - remover em produção
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"]
)

app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["localhost", "127.0.0.1", "*.localhost", "*"]
)


# Middleware para logging de requests
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = datetime.now()

    response = await call_next(request)

    duration = (datetime.now() - start_time).total_seconds()

    # Log apenas se demorar mais que 1 segundo ou se for erro
    if duration > 1.0 or response.status_code >= 400:
        logger.warning(
            f"🐌 {request.method} {request.url.path} - "
            f"{response.status_code} - {duration:.3f}s"
        )

    return response


# =============================================
# ROTAS PRINCIPAIS
# =============================================

@app.get("/", response_model=BaseResponse)
async def root():
    """🏠 Endpoint principal melhorado"""
    return BaseResponse(
        message="🚀 Agno Platform v4.5.1 - Sistema Operacional",
        data={
            "version": "4.5.1",
            "status": getattr(app.state, 'startup_status', 'unknown'),
            "agno_available": AGNO_AVAILABLE,
            "features": [
                "🤖 Sistema Multi-Agent",
                "🔄 Workflows Avançados",
                "👥 Colaboração em Equipe",
                "⚡ Chat em Tempo Real",
                "📊 Monitoramento Integrado"
            ],
            "endpoints": {
                "health": "/api/health",
                "agents": "/api/agents",
                "workflows": "/api/workflows",
                "chat": "/api/agents/{agent_id}/chat",
                "websocket": "/ws/{client_id}",
                "docs": "/docs"
            }
        }
    )


@app.get("/api/health", response_model=HealthResponse)
async def health_check(db: AsyncSession = Depends(get_db)):
    """🏥 Health check completo e detalhado"""

    # Testar banco de dados
    db_status = {"status": "unknown", "latency_ms": 0}
    try:
        start_time = datetime.now()
        await db.execute(sa_text("SELECT 1"))
        latency = (datetime.now() - start_time).total_seconds() * 1000

        db_status = {
            "status": "healthy",
            "latency_ms": round(latency, 2)
        }
    except Exception as e:
        db_status = {
            "status": "unhealthy",
            "error": str(e)
        }

    # Status do Agno framework
    agno_status = {"status": "disabled", "tools": 0}
    if AGNO_AVAILABLE:
        try:
            from routers.agno_services import get_real_agno_service
            agno_service = get_real_agno_service()
            health_data = agno_service.get_system_health()
            agno_status = {
                "status": "healthy",
                "tools": health_data.get("available_tools", 0),
                "framework": health_data.get("overall_status", "unknown")
            }
        except Exception as e:
            agno_status = {
                "status": "error",
                "error": str(e)
            }

    # WebSocket status
    ws_status = {
        "status": "healthy",
        "active_connections": len(ws_manager.active_connections)
    }

    # Status geral
    services = {
        "database": db_status,
        "agno_framework": agno_status,
        "websocket": ws_status
    }

    # Determinar status geral
    if db_status["status"] == "healthy":
        overall_status = "healthy"
    else:
        overall_status = "unhealthy"

    return HealthResponse(
        status=overall_status,
        timestamp=datetime.utcnow().isoformat(),
        version="4.5.1",
        environment=os.getenv("ENVIRONMENT", "development"),
        services=services,
        agno_available=AGNO_AVAILABLE
    )


# =============================================
# ROTAS DE AGENTES MELHORADAS
# =============================================

@app.get("/api/agents", response_model=BaseResponse)
async def list_agents(
        user_id: int = Query(1, description="ID do usuário"),
        limit: int = Query(50, ge=1, le=100, description="Limite de resultados"),
        offset: int = Query(0, ge=0, description="Offset para paginação"),
        search: Optional[str] = Query(None, description="Buscar por nome ou descrição"),
        db: AsyncSession = Depends(get_db)
):
    """📋 Listar agentes com paginação e busca melhorada"""

    try:
        # Query base
        where_conditions = ["user_id = :user_id", "is_active = true"]
        params = {"user_id": user_id, "limit": limit, "offset": offset}

        # Adicionar busca se fornecida
        if search:
            where_conditions.append(
                "(name ILIKE :search OR description ILIKE :search OR role ILIKE :search)"
            )
            params["search"] = f"%{search}%"

        where_clause = " AND ".join(where_conditions)

        # Buscar agentes
        query = sa_text(f"""
            SELECT id, name, description, role, model_provider, model_id, 
                   instructions, tools, memory_enabled, rag_enabled, 
                   is_active, created_at, updated_at
            FROM agno_agents 
            WHERE {where_clause}
            ORDER BY updated_at DESC
            LIMIT :limit OFFSET :offset
        """)

        result = await db.execute(query, params)
        rows = result.fetchall()

        # Formatar dados
        agents = []
        for row in rows:
            agent_data = {
                "id": row.id,
                "name": row.name,
                "description": row.description or "",
                "role": row.role,
                "model_provider": row.model_provider,
                "model_id": row.model_id,
                "instructions": row.instructions or [],
                "tools": row.tools or [],
                "memory_enabled": row.memory_enabled,
                "rag_enabled": row.rag_enabled,
                "is_active": row.is_active,
                "created_at": row.created_at.isoformat() if row.created_at else None,
                "updated_at": row.updated_at.isoformat() if row.updated_at else None
            }
            agents.append(agent_data)

        # Buscar total para paginação
        count_query = sa_text(f"SELECT COUNT(*) FROM agno_agents WHERE {where_clause}")
        count_params = {k: v for k, v in params.items() if k not in ["limit", "offset"]}
        total_result = await db.execute(count_query, count_params)
        total = total_result.scalar()

        logger.info(f"📋 Listados {len(agents)} agentes (total: {total}) para usuário {user_id}")

        return BaseResponse(
            message=f"{len(agents)} agentes encontrados",
            data={
                "agents": agents,
                "pagination": {
                    "total": total,
                    "limit": limit,
                    "offset": offset,
                    "has_more": offset + limit < total
                }
            }
        )

    except Exception as e:
        logger.error(f"❌ Erro ao listar agentes: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao listar agentes: {str(e)}")


@app.post("/api/agents", response_model=BaseResponse)
async def create_agent(
        request: CreateAgentRequest,
        background_tasks: BackgroundTasks,
        user_id: int = Query(1, description="ID do usuário"),
        db: AsyncSession = Depends(get_db)
):
    """🎯 Criar novo agente com validações melhoradas"""

    try:
        # Verificar se já existe agente com mesmo nome
        check_query = sa_text("""
            SELECT id FROM agno_agents 
            WHERE user_id = :user_id AND name = :name AND is_active = true
        """)

        existing = await db.execute(check_query, {
            "user_id": user_id,
            "name": request.name
        })

        if existing.fetchone():
            raise HTTPException(
                status_code=400,
                detail=f"Já existe um agente ativo com o nome '{request.name}'"
            )

        # Inserir novo agente
        insert_query = sa_text("""
            INSERT INTO agno_agents (
                user_id, name, description, role, model_provider, model_id,
                instructions, tools, memory_enabled, rag_enabled, 
                is_active, created_at, updated_at
            ) VALUES (
                :user_id, :name, :description, :role, :model_provider, :model_id,
                :instructions, :tools, :memory_enabled, :rag_enabled,
                true, :now, :now
            ) RETURNING id, name, role, model_provider, model_id
        """)

        now = datetime.utcnow()
        result = await db.execute(insert_query, {
            "user_id": user_id,
            "name": request.name,
            "description": request.description,
            "role": request.role,
            "model_provider": request.model_provider,
            "model_id": request.model_id,
            "instructions": request.instructions,
            "tools": request.tools,
            "memory_enabled": request.memory_enabled,
            "rag_enabled": request.rag_enabled,
            "now": now
        })

        agent_row = result.fetchone()
        agent_id = agent_row.id
        await db.commit()

        # Task em background para otimizações pós-criação
        def post_creation_tasks():
            logger.info(f"🤖 Executando tarefas pós-criação para agente {agent_id}")
            # Aqui você pode adicionar: indexação, cache, notificações, etc.

        background_tasks.add_task(post_creation_tasks)

        logger.info(f"✅ Agente criado: {request.name} (ID: {agent_id}) por usuário {user_id}")

        return BaseResponse(
            message="Agente criado com sucesso",
            data={
                "id": agent_id,
                "name": agent_row.name,
                "role": agent_row.role,
                "model_provider": agent_row.model_provider,
                "model_id": agent_row.model_id,
                "created_at": now.isoformat()
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"❌ Erro ao criar agente: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao criar agente: {str(e)}")


@app.post("/api/agents/{agent_id}/chat")
async def chat_with_agent(
        agent_id: int,
        request: ChatRequest,
        user_id: int = Query(1, description="ID do usuário"),
        db: AsyncSession = Depends(get_db)
):
    """💬 Chat melhorado com agente específico"""

    chat_id = f"chat_{agent_id}_{int(datetime.now().timestamp())}"

    try:
        # Buscar agente com validação de acesso
        agent_query = sa_text("""
            SELECT id, name, role, model_provider, model_id, instructions, tools,
                   memory_enabled, rag_enabled
            FROM agno_agents 
            WHERE id = :agent_id AND user_id = :user_id AND is_active = true
        """)

        result = await db.execute(agent_query, {
            "agent_id": agent_id,
            "user_id": user_id
        })

        agent = result.fetchone()
        if not agent:
            raise HTTPException(
                status_code=404,
                detail=f"Agente {agent_id} não encontrado ou sem permissão de acesso"
            )

        logger.info(f"💬 Chat iniciado: {chat_id} - Agente: {agent.name} - User: {user_id}")

        # Se Agno não disponível, usar resposta simulada
        if not AGNO_AVAILABLE:
            return await simulate_agent_response(chat_id, agent, request)

        # Usar Agno real
        return await execute_real_agno_chat(chat_id, agent, request)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Erro no chat {chat_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Erro no chat: {str(e)}")


async def simulate_agent_response(chat_id: str, agent, request: ChatRequest):
    """Simular resposta do agente quando Agno não disponível"""

    async def generate_response():
        try:
            # Headers do streaming
            yield f"data: {json.dumps({'type': 'start', 'chat_id': chat_id, 'agent': agent.name})}\n\n"

            # Simular processamento
            response_parts = [
                f"🤖 Olá! Eu sou o **{agent.name}**, especialista em {agent.role}.\n\n",
                f"Recebi sua mensagem: *\"{request.prompt[:100]}{'...' if len(request.prompt) > 100 else ''}\"*\n\n",
                "💭 Analisando sua solicitação...\n\n",
                "Esta é uma **resposta simulada** do sistema Agno Platform. ",
                "Em um ambiente real, eu processaria sua solicitação usando IA avançada.\n\n",
                f"🔧 **Configuração atual:**\n",
                f"- Modelo: {agent.model_provider}/{agent.model_id}\n",
                f"- Ferramentas: {len(agent.tools or [])} disponíveis\n",
                f"- Memória: {'✅ Habilitada' if agent.memory_enabled else '❌ Desabilitada'}\n\n",
                "✅ **Sistema funcionando perfeitamente!**"
            ]

            for i, part in enumerate(response_parts):
                # Delay realístico
                await asyncio.sleep(0.3)

                chunk_data = {
                    "type": "content",
                    "content": part,
                    "chunk_id": i,
                    "timestamp": datetime.utcnow().isoformat()
                }

                yield f"data: {json.dumps(chunk_data)}\n\n"

            # Mensagem final
            final_data = {
                "type": "complete",
                "chat_id": chat_id,
                "agent_id": agent.id,
                "total_chunks": len(response_parts),
                "duration_ms": len(response_parts) * 300
            }

            yield f"data: {json.dumps(final_data)}\n\n"
            yield "data: [DONE]\n\n"

            logger.info(f"✅ Chat simulado concluído: {chat_id}")

        except Exception as e:
            error_data = {
                "type": "error",
                "error": str(e),
                "chat_id": chat_id
            }
            yield f"data: {json.dumps(error_data)}\n\n"
            logger.error(f"❌ Erro no chat simulado: {e}")

    return StreamingResponse(
        generate_response(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Chat-ID": chat_id,
            "X-Agent-ID": str(agent.id),
            "X-Agent-Name": agent.name,
            "X-Simulation": "true"
        }
    )


async def execute_real_agno_chat(chat_id: str, agent, request: ChatRequest):
    """Executar chat real usando framework Agno"""

    try:
        from routers.agno_services import get_real_agno_service
        agno_service = get_real_agno_service()

        # Configurar agente
        agent_config = {
            "name": agent.name,
            "role": agent.role,
            "model_provider": agent.model_provider,
            "model_id": agent.model_id,
            "instructions": agent.instructions or ["Você é um assistente útil."],
        }

        # Mapear tools do banco para Agno
        tools_mapping = {
            "web_search": "duckduckgo",
            "financial": "yfinance",
            "calculations": "calculator",
            "reasoning": "reasoning",
            "image_generation": "dalle"
        }

        tools_to_use = [
            tools_mapping.get(tool, tool)
            for tool in (agent.tools or [])
        ]

        # Executar via Agno
        stream_info = agno_service.execute_agent_task(
            agent_config=agent_config,
            prompt=request.prompt,
            tools_list=tools_to_use,
            stream=True
        )

        if stream_info.get("status") != "ready_for_stream":
            raise HTTPException(
                status_code=500,
                detail=f"Erro ao preparar streaming: {stream_info}"
            )

        agent_instance = stream_info["agent"]
        prompt_val = stream_info["prompt"]

        # Gerar streaming
        async def generate_real_response():
            try:
                for chunk_data in agno_service.create_streaming_generator(agent_instance, prompt_val):
                    yield f"data: {json.dumps(chunk_data)}\n\n"

                logger.info(f"✅ Chat Agno real concluído: {chat_id}")

            except Exception as e:
                error_data = {
                    "type": "error",
                    "error": str(e),
                    "chat_id": chat_id
                }
                yield f"data: {json.dumps(error_data)}\n\n"
                logger.error(f"❌ Erro no Agno real: {e}")

        return StreamingResponse(
            generate_real_response(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Chat-ID": chat_id,
                "X-Agent-ID": str(agent.id),
                "X-Agent-Name": agent.name,
                "X-Agno-Real": "true"
            }
        )

    except Exception as e:
        logger.error(f"❌ Erro no Agno real: {e}")
        # Fallback para simulação
        return await simulate_agent_response(chat_id, agent, request)


@app.get("/api/teams", response_model=BaseResponse)
async def list_teams(
        user_id: int = Query(1, description="ID do usuário"),
        limit: int = Query(50, ge=1, le=100),
        offset: int = Query(0, ge=0),
        db: AsyncSession = Depends(get_db)
):
    """📋 Listar teams do usuário"""
    try:
        query = sa_text("""
            SELECT t.id, t.name, t.description, t.team_type, t.is_active,
                   t.created_at, t.updated_at, t.team_configuration,
                   COUNT(ta.agent_id) as agent_count,
                   s.name as supervisor_name
            FROM agno_teams t
            LEFT JOIN agno_team_agents ta ON t.id = ta.team_id AND ta.is_active = true
            LEFT JOIN agno_agents s ON t.supervisor_agent_id = s.id
            WHERE t.user_id = :user_id AND t.is_active = true
            GROUP BY t.id, s.name
            ORDER BY t.updated_at DESC
            LIMIT :limit OFFSET :offset
        """)

        result = await db.execute(query, {
            "user_id": user_id, "limit": limit, "offset": offset
        })
        rows = result.fetchall()

        teams = []
        for row in rows:
            # Buscar agentes do team
            agents_query = sa_text("""
                SELECT a.id, a.name, a.role, ta.role_in_team, ta.priority
                FROM agno_team_agents ta
                JOIN agno_agents a ON ta.agent_id = a.id
                WHERE ta.team_id = :team_id AND ta.is_active = true
                ORDER BY ta.priority
            """)

            agents_result = await db.execute(agents_query, {"team_id": row.id})
            agents = [
                {
                    "id": a.id, "name": a.name, "role": a.role,
                    "role_in_team": a.role_in_team, "priority": a.priority
                }
                for a in agents_result.fetchall()
            ]

            team_data = {
                "id": row.id,
                "name": row.name,
                "description": row.description or "",
                "team_type": row.team_type,
                "is_active": row.is_active,
                "agent_count": row.agent_count,
                "agents": agents,
                "supervisor": {"name": row.supervisor_name} if row.supervisor_name else None,
                "created_at": row.created_at.isoformat() if row.created_at else None,
                "updated_at": row.updated_at.isoformat() if row.updated_at else None,
                "execution_count": 0  # TODO: buscar do agno_team_executions
            }
            teams.append(team_data)

        logger.info(f"📋 Listados {len(teams)} teams para usuário {user_id}")

        return BaseResponse(
            message=f"{len(teams)} teams encontrados",
            data={"teams": teams, "pagination": {"total": len(teams), "limit": limit, "offset": offset}}
        )

    except Exception as e:
        logger.error(f"❌ Erro ao listar teams: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao listar teams: {str(e)}")


@app.post("/api/teams", response_model=BaseResponse)
async def create_team(
        request: TeamCreateRequest,
        user_id: int = Query(1, description="ID do usuário"),
        db: AsyncSession = Depends(get_db)
):
    """🎯 Criar novo team"""
    try:
        # Verificar se agentes existem
        if request.agents:
            agent_ids = [a.get("agent_id") for a in request.agents if a.get("agent_id")]
            if agent_ids:
                check_agents = sa_text("""
                    SELECT id FROM agno_agents 
                    WHERE id = ANY(:agent_ids) AND user_id = :user_id AND is_active = true
                """)
                result = await db.execute(check_agents, {
                    "agent_ids": agent_ids, "user_id": user_id
                })
                existing_ids = [row.id for row in result.fetchall()]
                missing_ids = set(agent_ids) - set(existing_ids)

                if missing_ids:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Agentes não encontrados: {list(missing_ids)}"
                    )

        # Inserir team
        insert_team = sa_text("""
            INSERT INTO agno_teams (user_id, name, description, team_type, team_configuration, supervisor_agent_id)
            VALUES (:user_id, :name, :description, :team_type, :config, :supervisor_id)
            RETURNING id, name, team_type, created_at
        """)

        result = await db.execute(insert_team, {
            "user_id": user_id,
            "name": request.name,
            "description": request.description,
            "team_type": request.team_type,
            "config": request.team_configuration,
            "supervisor_id": request.supervisor_agent_id
        })

        team_row = result.fetchone()
        team_id = team_row.id

        # Adicionar agentes ao team
        if request.agents:
            for i, agent_data in enumerate(request.agents):
                if agent_data.get("agent_id"):
                    insert_agent = sa_text("""
                        INSERT INTO agno_team_agents (team_id, agent_id, role_in_team, priority)
                        VALUES (:team_id, :agent_id, :role_in_team, :priority)
                    """)

                    await db.execute(insert_agent, {
                        "team_id": team_id,
                        "agent_id": agent_data["agent_id"],
                        "role_in_team": agent_data.get("role_in_team", "member"),
                        "priority": agent_data.get("priority", i + 1)
                    })

        await db.commit()

        logger.info(f"✅ Team criado: {request.name} (ID: {team_id}) por usuário {user_id}")

        return BaseResponse(
            message="Team criado com sucesso",
            data={
                "team_id": team_id,
                "name": team_row.name,
                "team_type": team_row.team_type,
                "created_at": team_row.created_at.isoformat()
            }
        )

    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"❌ Erro ao criar team: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao criar team: {str(e)}")


@app.get("/api/teams/{team_id}", response_model=BaseResponse)
async def get_team(
        team_id: int,
        user_id: int = Query(1, description="ID do usuário"),
        db: AsyncSession = Depends(get_db)
):
    """🔍 Buscar team específico"""
    try:
        query = sa_text("""
            SELECT t.*, s.name as supervisor_name
            FROM agno_teams t
            LEFT JOIN agno_agents s ON t.supervisor_agent_id = s.id
            WHERE t.id = :team_id AND t.user_id = :user_id AND t.is_active = true
        """)

        result = await db.execute(query, {"team_id": team_id, "user_id": user_id})
        team = result.fetchone()

        if not team:
            raise HTTPException(status_code=404, detail="Team não encontrado")

        # Buscar agentes
        agents_query = sa_text("""
            SELECT a.id, a.name, a.role, a.model_provider, a.model_id,
                   ta.role_in_team, ta.priority
            FROM agno_team_agents ta
            JOIN agno_agents a ON ta.agent_id = a.id
            WHERE ta.team_id = :team_id AND ta.is_active = true
            ORDER BY ta.priority
        """)

        agents_result = await db.execute(agents_query, {"team_id": team_id})
        agents = [
            {
                "id": a.id, "name": a.name, "role": a.role,
                "model_provider": a.model_provider, "model_id": a.model_id,
                "role_in_team": a.role_in_team, "priority": a.priority
            }
            for a in agents_result.fetchall()
        ]

        team_data = {
            "id": team.id,
            "name": team.name,
            "description": team.description or "",
            "team_type": team.team_type,
            "team_configuration": team.team_configuration or {},
            "agents": agents,
            "supervisor": {"name": team.supervisor_name} if team.supervisor_name else None,
            "created_at": team.created_at.isoformat() if team.created_at else None
        }

        return BaseResponse(
            message="Team encontrado",
            data=team_data
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Erro ao buscar team: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao buscar team: {str(e)}")


@app.post("/api/teams/{team_id}/execute", response_model=BaseResponse)
async def execute_team(
        team_id: int,
        request: TeamExecuteRequest,
        user_id: int = Query(1, description="ID do usuário"),
        db: AsyncSession = Depends(get_db)
):
    """🚀 Executar team com mensagem"""
    execution_id = f"exec_{team_id}_{int(datetime.utcnow().timestamp())}"

    try:
        # Verificar se team existe e buscar dados
        team_query = sa_text("""
            SELECT t.id, t.name, t.team_type, COUNT(ta.agent_id) as agent_count
            FROM agno_teams t
            LEFT JOIN agno_team_agents ta ON t.id = ta.team_id AND ta.is_active = true
            WHERE t.id = :team_id AND t.user_id = :user_id AND t.is_active = true
            GROUP BY t.id, t.name, t.team_type
        """)

        result = await db.execute(team_query, {"team_id": team_id, "user_id": user_id})
        team = result.fetchone()

        if not team:
            raise HTTPException(status_code=404, detail="Team não encontrado")

        if team.agent_count == 0:
            raise HTTPException(status_code=400, detail="Team não possui agentes ativos")

        # Registrar execução
        insert_execution = sa_text("""
            INSERT INTO agno_team_executions (team_id, input_message, status, agents_involved, metadata)
            VALUES (:team_id, :message, 'running', :agent_count, :metadata)
            RETURNING id
        """)

        exec_result = await db.execute(insert_execution, {
            "team_id": team_id,
            "message": request.message,
            "agent_count": team.agent_count,
            "metadata": {"context": request.context, "execution_id": execution_id}
        })

        db_execution_id = exec_result.scalar()

        # Simular execução (substituir por lógica real)
        await asyncio.sleep(1.5)  # Simular processamento

        response_text = f"""🤖 **Team '{team.name}' Executado com Sucesso!**

**Tipo:** {team.team_type}
**Mensagem:** {request.message}
**Agentes Envolvidos:** {team.agent_count}

**Resultado da Execução:**
Esta é uma execução simulada do sistema integrado. O team processou sua solicitação usando colaboração {team.team_type}.

**Status:** ✅ Concluído com sucesso
**ID da Execução:** {execution_id}
"""

        # Atualizar execução como concluída
        update_execution = sa_text("""
            UPDATE agno_team_executions 
            SET output_response = :response, status = 'completed', 
                completed_at = CURRENT_TIMESTAMP, execution_time_ms = :time_ms
            WHERE id = :exec_id
        """)

        await db.execute(update_execution, {
            "response": response_text,
            "time_ms": 1500,
            "exec_id": db_execution_id
        })

        await db.commit()

        logger.info(f"🚀 Team executado: {team.name} (ID: {team_id}) - Execução: {execution_id}")

        return BaseResponse(
            message="Team executado com sucesso",
            data={
                "execution_id": execution_id,
                "team_name": team.name,
                "team_type": team.team_type,
                "agents_used": team.agent_count,
                "execution_time_ms": 1500,
                "status": "completed",
                "response": response_text
            }
        )

    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"❌ Erro na execução do team: {e}")
        raise HTTPException(status_code=500, detail=f"Erro na execução: {str(e)}")


@app.delete("/api/teams/{team_id}")
async def delete_team(
        team_id: int,
        user_id: int = Query(1, description="ID do usuário"),
        db: AsyncSession = Depends(get_db)
):
    """🗑️ Deletar team (soft delete)"""
    try:
        update_query = sa_text("""
            UPDATE agno_teams 
            SET is_active = false, updated_at = CURRENT_TIMESTAMP
            WHERE id = :team_id AND user_id = :user_id AND is_active = true
            RETURNING name
        """)

        result = await db.execute(update_query, {"team_id": team_id, "user_id": user_id})
        team = result.fetchone()

        if not team:
            raise HTTPException(status_code=404, detail="Team não encontrado")

        # Desativar associações de agentes
        await db.execute(sa_text("""
            UPDATE agno_team_agents 
            SET is_active = false 
            WHERE team_id = :team_id
        """), {"team_id": team_id})

        await db.commit()

        logger.info(f"🗑️ Team deletado: {team.name} (ID: {team_id})")

        return BaseResponse(
            message=f"Team '{team.name}' removido com sucesso"
        )

    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"❌ Erro ao deletar team: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao deletar team: {str(e)}")


@app.get("/api/teams/{team_id}/analytics", response_model=BaseResponse)
async def get_team_analytics(
        team_id: int,
        user_id: int = Query(1, description="ID do usuário"),
        db: AsyncSession = Depends(get_db)
):
    """📊 Analytics do team"""
    try:
        analytics_query = sa_text("""
            SELECT 
                t.name,
                t.team_type,
                COUNT(ta.agent_id) as agent_count,
                COUNT(te.id) as total_executions,
                COUNT(CASE WHEN te.status = 'completed' THEN 1 END) as successful_executions,
                AVG(te.execution_time_ms) as avg_execution_time,
                MAX(te.started_at) as last_execution
            FROM agno_teams t
            LEFT JOIN agno_team_agents ta ON t.id = ta.team_id AND ta.is_active = true
            LEFT JOIN agno_team_executions te ON t.id = te.team_id
            WHERE t.id = :team_id AND t.user_id = :user_id AND t.is_active = true
            GROUP BY t.id, t.name, t.team_type
        """)

        result = await db.execute(analytics_query, {"team_id": team_id, "user_id": user_id})
        analytics = result.fetchone()

        if not analytics:
            raise HTTPException(status_code=404, detail="Team não encontrado")

        success_rate = 0
        if analytics.total_executions > 0:
            success_rate = (analytics.successful_executions / analytics.total_executions) * 100

        analytics_data = {
            "team_id": team_id,
            "team_name": analytics.name,
            "team_type": analytics.team_type,
            "agent_count": analytics.agent_count,
            "total_executions": analytics.total_executions,
            "successful_executions": analytics.successful_executions,
            "success_rate": round(success_rate, 2),
            "avg_response_time_ms": round(analytics.avg_execution_time or 0, 2),
            "last_execution": analytics.last_execution.isoformat() if analytics.last_execution else None
        }

        return BaseResponse(
            message="Analytics do team",
            data=analytics_data
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Erro ao buscar analytics: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao buscar analytics: {str(e)}")



# =============================================
# WEBSOCKET MELHORADO
# =============================================

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str, user_id: int = Query(1)):
    """⚡ WebSocket melhorado para comunicação real-time"""

    await ws_manager.connect(websocket, client_id)

    try:
        while True:
            # Receber dados do cliente
            data = await websocket.receive_text()

            try:
                message = json.loads(data)
                msg_type = message.get("type")

                if msg_type == "ping":
                    # Responder ping
                    pong_data = {
                        "type": "pong",
                        "timestamp": datetime.utcnow().isoformat(),
                        "server_time": datetime.utcnow().isoformat()
                    }
                    await ws_manager.send_personal_message(
                        json.dumps(pong_data), client_id
                    )

                elif msg_type == "agent_status":
                    # Notificar mudança de status de agente
                    status_data = {
                        "type": "agent_status_update",
                        "agent_id": message.get("agent_id"),
                        "status": message.get("status"),
                        "user_id": user_id,
                        "timestamp": datetime.utcnow().isoformat()
                    }

                    # Broadcast para todas as conexões do usuário
                    for conn_id, conn_ws in ws_manager.active_connections.items():
                        if conn_id != client_id:  # Não enviar de volta para o remetente
                            await ws_manager.send_personal_message(
                                json.dumps(status_data), conn_id
                            )

                elif msg_type == "chat_notification":
                    # Notificação de novo chat
                    chat_data = {
                        "type": "new_chat",
                        "chat_id": message.get("chat_id"),
                        "agent_name": message.get("agent_name"),
                        "user_id": user_id,
                        "timestamp": datetime.utcnow().isoformat()
                    }

                    # Enviar confirmação
                    await ws_manager.send_personal_message(
                        json.dumps(chat_data), client_id
                    )

                else:
                    # Tipo de mensagem desconhecido
                    error_data = {
                        "type": "error",
                        "message": f"Tipo de mensagem desconhecido: {msg_type}",
                        "timestamp": datetime.utcnow().isoformat()
                    }
                    await ws_manager.send_personal_message(
                        json.dumps(error_data), client_id
                    )

            except json.JSONDecodeError:
                logger.warning(f"⚠️ Mensagem WebSocket inválida de {client_id}: {data[:100]}")

                error_data = {
                    "type": "error",
                    "message": "Formato de mensagem inválido. Use JSON.",
                    "timestamp": datetime.utcnow().isoformat()
                }
                await ws_manager.send_personal_message(
                    json.dumps(error_data), client_id
                )

    except WebSocketDisconnect:
        logger.info(f"🔌 WebSocket {client_id} desconectado normalmente")
    except Exception as e:
        logger.error(f"❌ Erro no WebSocket {client_id}: {e}")
    finally:
        ws_manager.disconnect(client_id)


# =============================================
# ROTAS DE DEBUG E MONITORAMENTO
# =============================================

@app.get("/api/debug/info", response_model=BaseResponse)
async def debug_info():
    """🔧 Informações de debug do sistema"""

    import platform
    import psutil

    return BaseResponse(
        message="Informações de debug",
        data={
            "system": {
                "platform": platform.platform(),
                "python_version": platform.python_version(),
                "cpu_count": psutil.cpu_count(),
                "memory_total": f"{psutil.virtual_memory().total / (1024 ** 3):.2f} GB"
            },
            "application": {
                "version": "4.5.1",
                "startup_status": getattr(app.state, 'startup_status', 'unknown'),
                "agno_available": AGNO_AVAILABLE,
                "db_connected": getattr(app.state, 'db_connected', False),
                "uptime": str(datetime.now() - getattr(app.state, 'startup_time', datetime.now()))
            },
            "websocket": {
                "active_connections": len(ws_manager.active_connections),
                "connection_ids": list(ws_manager.active_connections.keys())
            },
            "routes": {
                "total": len(app.routes),
                "teams_available": any("/teams" in getattr(route, 'path', '') for route in app.routes),
                "endpoints": [
                    {"path": route.path, "methods": list(getattr(route, 'methods', []))}
                    for route in app.routes
                    if hasattr(route, 'path') and hasattr(route, 'methods')
                ][:10]  # Apenas primeiros 10 para não poluir
            }
        }
    )


# =============================================
# EXCEPTION HANDLERS MELHORADOS
# =============================================

@app.exception_handler(404)
async def not_found_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=404,
        content={
            "success": False,
            "message": "Endpoint não encontrado",
            "error": {
                "type": "not_found",
                "path": str(request.url.path),
                "method": request.method,
                "timestamp": datetime.utcnow().isoformat()
            },
            "suggestions": [
                "Verifique a URL e método HTTP",
                "Consulte a documentação em /docs",
                "Endpoints principais: /, /api/health, /api/agents"
            ]
        }
    )


@app.exception_handler(500)
async def internal_error_handler(request: Request, exc: Exception):
    error_id = str(uuid.uuid4())

    logger.error(f"❌ Erro interno [{error_id}]: {str(exc)}")
    logger.error(f"❌ Path: {request.method} {request.url.path}")
    logger.error(f"❌ Traceback: {traceback.format_exc()}")

    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "message": "Erro interno do servidor",
            "error": {
                "type": "internal_error",
                "error_id": error_id,
                "timestamp": datetime.utcnow().isoformat()
            }
        }
    )


# =============================================
# IMPORTAR E INCLUIR ROUTERS COM VERIFICAÇÕES
# =============================================

# Variáveis para armazenar routers
agents_router = None
workflows_router = None

# 1. AGENTS ROUTER
try:
    from routers.agents import router as agents_router

    logger.info("✅ Router de agents importado")
except ImportError as e:
    logger.error(f"❌ Erro ao importar router de agents: {e}")
    agents_router = None

# 2. WORKFLOWS ROUTER
try:
    from routers.workflow_team_router import router as workflows_router

    logger.info("✅ Router de workflows importado")
except ImportError as e:
    logger.error(f"❌ Erro ao importar router de workflows: {e}")
    workflows_router = None

# =============================================
# INCLUIR ROUTERS NO APP COM VERIFICAÇÕES
# =============================================

# Incluir router de agents se disponível
if agents_router is not None:
    try:
        app.include_router(
            agents_router,
            prefix="/api/agents",
            tags=["Agents"]
        )
        logger.info("✅ Rotas de agents incluídas em /api/agents")
    except Exception as e:
        logger.error(f"❌ Erro ao incluir router de agents: {e}")
        agents_router = None

# Incluir router de workflows se disponível
if workflows_router is not None:
    try:
        app.include_router(
            workflows_router,
            prefix="/api",
            tags=["Workflows", "Teams"]
        )
        logger.info("✅ Rotas de workflows incluídas em /api")
    except Exception as e:
        logger.error(f"❌ Erro ao incluir router de workflows: {e}")
        workflows_router = None

# =============================================
# ROTAS DE FALLBACK PARA ROUTERS FALTANTES
# =============================================

# Fallback para agents se não disponível
if agents_router is None:
    from fastapi import APIRouter

    agents_fallback = APIRouter(prefix="/api/agents", tags=["Agents Fallback"])


    @agents_fallback.get("/")
    async def agents_fallback_list():
        """Fallback para listar agents"""
        logger.warning("⚠️ Usando fallback para agents - router não disponível")
        return BaseResponse(
            message="Router de agents não disponível - usando fallback",
            data={
                "agents": [],
                "pagination": {"total": 0, "limit": 50, "offset": 0, "has_more": False},
                "warning": "Sistema em modo de desenvolvimento - router de agents não carregado"
            }
        )


    @agents_fallback.post("/")
    async def agents_fallback_create(request: CreateAgentRequest):
        """Fallback para criar agent"""
        logger.warning("⚠️ Tentativa de criar agent com fallback")
        raise HTTPException(
            status_code=503,
            detail="Funcionalidade temporariamente indisponível - router de agents não carregado"
        )


    @agents_fallback.post("/{agent_id}/chat")
    async def agents_fallback_chat(agent_id: int, request: ChatRequest):
        """Fallback para chat"""
        logger.warning(f"⚠️ Tentativa de chat com agent {agent_id} usando fallback")
        raise HTTPException(
            status_code=503,
            detail="Chat temporariamente indisponível - router de agents não carregado"
        )


    app.include_router(agents_fallback)
    logger.warning("⚠️ Router fallback de agents incluído")

# Fallback para workflows se não disponível
if workflows_router is None:
    workflows_fallback = APIRouter(prefix="/api", tags=["Workflows Fallback"])


    @workflows_fallback.get("/workflows")
    async def workflows_fallback_list():
        """Fallback para listar workflows"""
        logger.warning("⚠️ Usando fallback para workflows - router não disponível")
        return []  # Lista vazia para não quebrar o frontend


    @workflows_fallback.get("/teams")
    async def teams_fallback_list():
        """Fallback para listar teams"""
        logger.warning("⚠️ Usando fallback para teams - router não disponível")
        return []  # Lista vazia para não quebrar o frontend


    @workflows_fallback.post("/workflows")
    async def workflows_fallback_create():
        """Fallback para criar workflow"""
        logger.warning("⚠️ Tentativa de criar workflow com fallback")
        raise HTTPException(
            status_code=503,
            detail="Funcionalidade temporariamente indisponível - router de workflows não carregado"
        )


    app.include_router(workflows_fallback)
    logger.warning("⚠️ Router fallback de workflows incluído")

# =============================================
# ROTAS PARA AGNO FRAMEWORK
# =============================================

if AGNO_AVAILABLE and real_agno_router is not None:
    try:
        app.include_router(real_agno_router, tags=["Agno Framework"])
        logger.info("✅ Rotas do Agno Framework incluídas")
    except Exception as e:
        logger.error(f"❌ Erro ao incluir router do Agno: {e}")
        real_agno_router = None

# Fallback do Agno se não disponível
if not AGNO_AVAILABLE or real_agno_router is None:
    agno_fallback = APIRouter(prefix="/api/agno", tags=["Agno Fallback"])


    @agno_fallback.get("/health")
    async def agno_health_fallback():
        return {
            "status": "unavailable",
            "framework": "none",
            "agno_available": False,
            "message": "Framework Agno não disponível",
            "help": "Configure as dependências do Agno para funcionalidades avançadas"
        }


    @agno_fallback.get("/tools")
    async def agno_tools_fallback():
        return {
            "status": "unavailable",
            "message": "Framework Agno não disponível",
            "total_tools": 0,
            "tools": [],
            "help": "Execute: pip install agno openai anthropic"
        }


    app.include_router(agno_fallback)
    logger.warning("⚠️ Router fallback do Agno incluído")


# =============================================
# STARTUP EVENT PARA LISTAR ROTAS
# =============================================

@app.on_event("startup")
async def startup_routes_debug():
    """Log das rotas registradas para debug no startup"""
    logger.info("🔍 Verificando rotas registradas...")

    routes_info = []
    critical_routes = {
        "/": False,
        "/api/health": False,
        "/api/agents": False,
        "/api/workflows": False,
        "api/teams": False,
    }

    for route in app.routes:
        if hasattr(route, 'path') and hasattr(route, 'methods'):
            path = getattr(route, 'path', '')
            methods = list(getattr(route, 'methods', []))
            routes_info.append(f"{methods} {path}")

            # Verificar rotas críticas
            for critical_path in critical_routes:
                if path == critical_path or (critical_path != "/" and critical_path in path):
                    critical_routes[critical_path] = True

    # Log das rotas
    logger.info("📋 Rotas registradas:")
    for route_info in sorted(routes_info):
        logger.info(f"  📍 {route_info}")

    # Verificar rotas críticas
    logger.info("🔍 Status das rotas críticas:")
    for critical_path, found in critical_routes.items():
        status = "✅" if found else "❌"
        logger.info(f"  {status} {critical_path}")

    # Status dos routers
    router_status = {
        "agents": agents_router is not None,
        "workflows": workflows_router is not None,
        "agno": real_agno_router is not None
    }

    logger.info("🔍 Status dos routers:")
    for router_name, available in router_status.items():
        status = "✅" if available else "❌"
        logger.info(f"  {status} {router_name}_router")


# =============================================
# INICIALIZAÇÃO
# =============================================

if __name__ == "__main__":
    import uvicorn

    logger.info("🚀 Iniciando servidor Agno Platform...")

    uvicorn.run(
        "app:app",  # Correto para o arquivo app.py
        host="0.0.0.0",
        port=8000,
        reload=True,
        access_log=True,
        log_level="info"
    )