# main.py - Agno Platform Backend CONSOLIDADO
# Versão: 4.2.0 - Corrigida e Consolidada

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

# Database imports
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy import text as sa_text
import sqlalchemy as sa

# Environment
from dotenv import load_dotenv

load_dotenv()

# =============================================
# CONFIGURAÇÃO DE LOGGING
# =============================================

log_dir = Path("/app/logs")
log_dir.mkdir(exist_ok=True)


class AdvancedFormatter(logging.Formatter):
    """Formatter com cores e emojis"""

    COLORS = {
        'DEBUG': '\033[96m', 'INFO': '\033[92m', 'WARNING': '\033[93m',
        'ERROR': '\033[91m', 'CRITICAL': '\033[95m'
    }

    EMOJIS = {
        'DEBUG': '🔍', 'INFO': '💡', 'WARNING': '⚠️',
        'ERROR': '❌', 'CRITICAL': '💥'
    }

    RESET = '\033[0m'
    BOLD = '\033[1m'

    def format(self, record):
        level_color = self.COLORS.get(record.levelname, self.RESET)
        emoji = self.EMOJIS.get(record.levelname, '📝')

        logger_name = record.name
        if len(logger_name) > 15:
            logger_name = f"...{logger_name[-12:]}"

        timestamp = self.formatTime(record, self.datefmt)
        colored_level = f"{level_color}{self.BOLD}{record.levelname:8}{self.RESET}"
        colored_name = f"{level_color}{logger_name:15}{self.RESET}"

        return f"{timestamp} {emoji} {colored_level} {colored_name} | {record.getMessage()}"


# Configurar logging
console_handler = logging.StreamHandler(sys.stdout)
console_handler.setFormatter(AdvancedFormatter(datefmt='%H:%M:%S'))

file_handler = logging.FileHandler(log_dir / 'agno.log', mode='a', encoding='utf-8')
file_handler.setFormatter(logging.Formatter(
    '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
))

logging.basicConfig(
    level=logging.INFO,
    handlers=[console_handler, file_handler],
    force=True
)

logger = logging.getLogger(__name__)
logger.info("🎯 Sistema de logging configurado")

# =============================================
# DATABASE SETUP
# =============================================

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://agno_user:agno_password@postgres:5432/agno_db")
ASYNC_DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")

logger.info(f"🗄️ Configurando banco: {DATABASE_URL.split('@')[1] if '@' in DATABASE_URL else 'localhost'}")

engine = create_async_engine(
    ASYNC_DATABASE_URL,
    echo=False,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
    pool_recycle=3600
)

async_session = async_sessionmaker(engine, expire_on_commit=False)
Base = declarative_base()

# =============================================
# TENTAR IMPORTAR AGNO REAL
# =============================================

AGNO_AVAILABLE = False
USING_REAL_AGNO = False

try:
    from services.agno_services import get_real_agno_service, AGNO_AVAILABLE

    if AGNO_AVAILABLE:
        logger.info("✅ Agno framework detectado e disponível")
        USING_REAL_AGNO = True
    else:
        logger.warning("⚠️ Agno framework encontrado mas não configurado")
except ImportError as e:
    logger.warning(f"⚠️ Agno framework não disponível: {e}")
    AGNO_AVAILABLE = False

# Importar rotas do Agno (corrigir nome do arquivo)
real_agno_router = None
try:
    from routers.agno_routes import router as real_agno_router

    logger.info("✅ Rotas do Agno importadas com sucesso")
except ImportError as e:
    logger.error(f"❌ Erro ao importar rotas do Agno: {e}")
    real_agno_router = None


# =============================================
# PYDANTIC MODELS
# =============================================

class HealthResponse(BaseModel):
    status: str
    timestamp: str
    version: str
    agno_framework: str
    agno_available: bool
    database_connected: bool
    configured_keys: int
    total_tools: Optional[int] = None


class CreateAgentRequest(BaseModel):
    name: str
    role: str
    model_provider: str = "openai"
    model_id: str = "gpt-4o"
    instructions: List[str] = ["Você é um assistente útil."]
    tools: List[str] = []
    memory_enabled: bool = True
    rag_enabled: bool = False


# =============================================
# DEPENDENCIES
# =============================================

async def get_db() -> AsyncSession:
    async with async_session() as session:
        yield session


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
    logger.info(f"✅ Modo: {'AgnoService REAL' if USING_REAL_AGNO else 'Fallback'}")

    # Verificar banco
    db_connected = False
    try:
        async with async_session() as session:
            await session.execute(sa_text("SELECT 1"))
        logger.info("✅ Database conectado: PostgreSQL")
        db_connected = True
    except Exception as e:
        logger.error(f"❌ Falha na conexão com banco: {e}")

    # Verificar API keys
    api_keys = [
        ("OPENAI_API_KEY", "🤖 OpenAI"),
        ("ANTHROPIC_API_KEY", "🧠 Anthropic"),
        ("SUPABASE_URL", "📊 Supabase URL"),
        ("SUPABASE_KEY", "🔑 Supabase Key")
    ]

    configured_keys = 0
    for key, desc in api_keys:
        if os.getenv(key):
            logger.info(f"✅ {desc}: configurado")
            configured_keys += 1

    # Status final
    if USING_REAL_AGNO and db_connected and configured_keys >= 1:
        logger.info("🎉 Sistema totalmente operacional!")
        status = "fully_operational"
    elif db_connected:
        logger.info("⚡ Sistema parcialmente operacional")
        status = "partial"
    else:
        logger.warning("⚠️ Sistema com limitações")
        status = "degraded"

    startup_duration = (datetime.now() - startup_time).total_seconds()
    logger.info(f"⏱️ Tempo de inicialização: {startup_duration:.2f}s")
    logger.info("🚀" + "=" * 50)

    # Armazenar status
    app.state.startup_status = status
    app.state.agno_available = AGNO_AVAILABLE
    app.state.configured_keys = configured_keys

    yield

    # Shutdown
    logger.info("🛑 Encerrando Agno Platform...")
    try:
        await engine.dispose()
        logger.info("✅ Conexões de banco fechadas")
    except Exception as e:
        logger.error(f"❌ Erro ao fechar banco: {e}")


# =============================================
# FASTAPI APP
# =============================================

app = FastAPI(
    title="🚀 Agno Platform API",
    description="Sistema de Agentes IA com Framework Agno Real",
    version="4.2.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# =============================================
# MIDDLEWARE
# =============================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://frontend:3000",
        "*"  # Para desenvolvimento
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


# =============================================
# ROTAS PRINCIPAIS
# =============================================

@app.get("/")
async def root():
    """Endpoint raiz com informações do sistema"""
    agno_status = "✅ REAL" if AGNO_AVAILABLE else "❌ Indisponível"

    return {
        "message": "🚀 Agno Platform API - VERSÃO CONSOLIDADA",
        "version": "4.2.0",
        "status": "online",
        "framework": "agno_real" if AGNO_AVAILABLE else "fallback",
        "agno_available": AGNO_AVAILABLE,
        "agno_status": agno_status,
        "timestamp": datetime.utcnow().isoformat(),
        "endpoints": {
            "health": "/api/health",
            "agno_tools": "/api/agno/tools",
            "agno_health": "/api/agno/health",
            "docs": "/docs"
        }
    }


@app.get("/api/health", response_model=HealthResponse)
async def health_check(db: AsyncSession = Depends(get_db)):
    """Verificação completa de saúde do sistema"""

    # Testar banco
    db_connected = False
    try:
        await db.execute(sa_text("SELECT 1"))
        db_connected = True
    except Exception as e:
        logger.error(f"Database health check failed: {e}")

    # Status do Agno
    total_tools = None
    agno_framework_status = "unavailable"

    if AGNO_AVAILABLE:
        try:
            agno_service = get_real_agno_service()
            health = agno_service.get_system_health()
            total_tools = health["available_tools"]
            agno_framework_status = health["overall_status"]
        except Exception as e:
            logger.error(f"Agno health check failed: {e}")
            agno_framework_status = "error"

    # Status geral
    if AGNO_AVAILABLE and db_connected and total_tools and total_tools > 0:
        status = "fully_operational"
    elif db_connected:
        status = "partial"
    else:
        status = "degraded"

    return HealthResponse(
        status=status,
        timestamp=datetime.utcnow().isoformat(),
        version="4.2.0",
        agno_framework=agno_framework_status,
        agno_available=AGNO_AVAILABLE,
        database_connected=db_connected,
        configured_keys=getattr(app.state, 'configured_keys', 0),
        total_tools=total_tools
    )


# =============================================
# ROTAS DE AGENTES (EXISTENTES)
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


@app.get("/api/agents")
async def list_agents(user_id: int = Query(1), db: AsyncSession = Depends(get_db)):
    """Lista agentes do usuário"""
    try:
        logger.info(f"📋 [LIST:list_agents_{int(datetime.now().timestamp() * 1000)}] Listagem de agentes solicitada")
        logger.info(f"👤 [LIST:list_agents_{int(datetime.now().timestamp() * 1000)}] Usuário: {user_id}")

        # Buscar agentes no banco
        query = sa_text("""
            SELECT id, name, description, role, model_provider, model_id, 
                   instructions, tools, memory_enabled, rag_enabled, 
                   is_active, created_at
            FROM agno_agents 
            WHERE user_id = :user_id AND is_active = true
            ORDER BY created_at DESC
        """)

        result = await db.execute(query, {"user_id": user_id})
        rows = result.fetchall()

        agents = []
        model_providers = set()

        for row in rows:
            agent_data = {
                "id": row.id,
                "nome": row.name,  # Manter compatibilidade com frontend
                "name": row.name,
                "description": row.description,
                "role": row.role,
                "modelo": row.model_id,  # Manter compatibilidade
                "model_id": row.model_id,
                "empresa": row.model_provider,  # Manter compatibilidade
                "model_provider": row.model_provider,
                "instructions": row.instructions,
                "tools": row.tools,
                "memory_enabled": row.memory_enabled,
                "rag_enabled": row.rag_enabled,
                "is_active_agent": row.is_active,
                "created_at": row.created_at.isoformat() if row.created_at else None
            }
            agents.append(agent_data)
            model_providers.add(row.model_provider)

        logger.info(
            f"📊 [LIST:list_agents_{int(datetime.now().timestamp() * 1000)}] Encontrados {len(agents)} agentes no banco")
        logger.info(
            f"🏷️  [LIST:list_agents_{int(datetime.now().timestamp() * 1000)}] Agentes: {[a['name'] for a in agents]}")
        logger.info(
            f"✅ [LIST:list_agents_{int(datetime.now().timestamp() * 1000)}] {len(agents)} ativos, providers: {list(model_providers)}")

        return agents

    except Exception as e:
        logger.error(f"❌ Erro ao listar agentes: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao listar agentes: {str(e)}")


@app.post("/api/agents/create")
async def create_agent(request: CreateAgentRequest, user_id: int = Query(1), db: AsyncSession = Depends(get_db)):
    """Criar novo agente"""
    try:
        # Inserir no banco
        query = sa_text("""
            INSERT INTO agno_agents (
                user_id, name, description, role, model_provider, model_id,
                instructions, tools, memory_enabled, rag_enabled, is_active, created_at
            ) VALUES (
                :user_id, :name, :role, :role, :model_provider, :model_id,
                :instructions, :tools, :memory_enabled, :rag_enabled, true, NOW()
            ) RETURNING id
        """)

        result = await db.execute(query, {
            "user_id": user_id,
            "name": request.name,
            "role": request.role,
            "model_provider": request.model_provider,
            "model_id": request.model_id,
            "instructions": request.instructions,
            "tools": request.tools,
            "memory_enabled": request.memory_enabled,
            "rag_enabled": request.rag_enabled
        })

        agent_id = result.scalar()
        await db.commit()

        logger.info(f"✅ Agente criado: ID {agent_id}, Nome: {request.name}")

        return {
            "id": agent_id,
            "name": request.name,
            "role": request.role,
            "model_provider": request.model_provider,
            "model_id": request.model_id,
            "status": "created"
        }

    except Exception as e:
        await db.rollback()
        logger.error(f"❌ Erro ao criar agente: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao criar agente: {str(e)}")


# =============================================
# INCLUIR ROTAS DO AGNO
# =============================================

if AGNO_AVAILABLE and real_agno_router:
    app.include_router(real_agno_router)
    logger.info("✅ Rotas REAIS do Agno incluídas")
else:
    # Criar rotas de fallback completas
    from fastapi import APIRouter

    fallback_router = APIRouter(prefix="/api/agno", tags=["Agno Fallback"])


    @fallback_router.get("/tools")
    async def agno_tools_fallback():
        return {
            "status": "unavailable",
            "message": "Agno framework não disponível",
            "framework": "none",
            "total_tools": 0,
            "tools": [],
            "install_help": "Execute: pip install agno openai duckduckgo-search yfinance"
        }


    @fallback_router.get("/health")
    async def agno_health_fallback():
        return {
            "status": "unavailable",
            "framework": "none",
            "agno_available": False,
            "message": "Agno framework não instalado",
            "help": "Instale com: pip install agno openai"
        }


    @fallback_router.get("/agents/{agent_id}/tools")
    async def agno_agent_tools_fallback(agent_id: int):
        return {
            "status": "unavailable",
            "agent_id": agent_id,
            "tools": [],
            "message": "Agno framework não disponível"
        }


    @fallback_router.post("/tools/test")
    async def agno_test_tool_fallback():
        return {
            "status": "unavailable",
            "message": "Agno framework não disponível para testes"
        }


    app.include_router(fallback_router)
    logger.warning("⚠️ Rotas de fallback COMPLETAS do Agno criadas")


# =============================================
# ROUTE PARA DEBUG
# =============================================

@app.get("/api/debug/routes")
async def debug_routes():
    """Debug: listar todas as rotas registradas"""
    routes = []
    for route in app.routes:
        if hasattr(route, 'methods') and hasattr(route, 'path'):
            routes.append({
                "path": route.path,
                "methods": list(route.methods),
                "name": getattr(route, 'name', 'unnamed')
            })

    return {
        "total_routes": len(routes),
        "agno_available": AGNO_AVAILABLE,
        "router_included": real_agno_router is not None,
        "routes": routes
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)