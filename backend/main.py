# main.py - Backend Agno USANDO AGNO SERVICE REAL
# VERSÃO CORRIGIDA - SEM MockAgnoService

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
engine = create_async_engine(ASYNC_DATABASE_URL, echo=False)  # Reduzir verbosidade do DB
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
# FALLBACK MOCK SERVICE (caso Agno real falhe)
# =============================================

class FallbackMockService:
    """Serviço de fallback caso o Agno real não funcione"""

    def __init__(self):
        self.agents = {}
        self.sessions = {}
        self.logger = logging.getLogger(f"{__name__}.FallbackMockService")
        self.logger.warning("⚠️ Usando FallbackMockService - Agno real não disponível")

    async def create_single_agent(self, user_id: int, config) -> str:
        agent_id = str(uuid.uuid4())
        self.agents[agent_id] = {
            "name": config.name if hasattr(config, 'name') else config["name"],
            "role": config.role if hasattr(config, 'role') else config["role"],
        }
        return agent_id

    async def run_agent(self, agent_id: str, message: str, user_id: int) -> AsyncGenerator[str, None]:
        session_id = f"fallback_{agent_id}_{int(datetime.now().timestamp())}"

        self.logger.warning(f"⚠️ [FALLBACK: {session_id}] Usando serviço de fallback")

        response = f"[FALLBACK MODE] Esta é uma resposta de fallback para: '{message}'. O AgnoService real não está disponível."

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
    if USING_REAL_AGNO:
        logger.info("🚀 =====================================")
        logger.info("🚀 INICIANDO COM AGNO REAL!")
        logger.info("🚀 =====================================")
        logger.info("✅ AgnoService real carregado")
        logger.info("🔑 Verificando API keys...")

        # Verificar variáveis de ambiente
        openai_key = os.getenv("OPENAI_API_KEY")
        anthropic_key = os.getenv("ANTHROPIC_API_KEY")

        if openai_key:
            logger.info("✅ OPENAI_API_KEY encontrada")
        else:
            logger.warning("⚠️ OPENAI_API_KEY não encontrada")

        if anthropic_key:
            logger.info("✅ ANTHROPIC_API_KEY encontrada")
        else:
            logger.warning("⚠️ ANTHROPIC_API_KEY não encontrada")
    else:
        logger.warning("⚠️ Iniciando com serviço de fallback")

    # Test database connection
    try:
        async with engine.begin() as conn:
            await conn.execute(sa.text("SELECT 1"))
        logger.info("✅ Database connection successful")
    except Exception as e:
        logger.error(f"❌ Database connection failed: {e}")

    logger.info("✅ Sistema pronto!")

    yield

    logger.info("🛑 Encerrando sistema...")
    await engine.dispose()


# =============================================
# FASTAPI APP
# =============================================

app = FastAPI(
    title="Agno Platform API - REAL VERSION",
    description="Agno Platform API usando Agno Framework REAL",
    version="4.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://frontend:3000",
        "*"  # Para desenvolvimento
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Trusted hosts
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["localhost", "127.0.0.1", "*.localhost", "*"]
)


# Middleware de logging
@app.middleware("http")
async def log_requests(request: Request, call_next):
    request_id = f"req_{int(datetime.now().timestamp())}_{hash(str(request.url)) % 10000}"
    start_time = datetime.now()

    client_ip = request.client.host if request.client else "unknown"

    logger.info(f"📥 [REQ: {request_id}] {request.method} {request.url}")
    logger.info(f"🌐 [REQ: {request_id}] IP: {client_ip}")

    try:
        response = await call_next(request)
        process_time = (datetime.now() - start_time).total_seconds()

        # Determinar emoji baseado no status
        if response.status_code >= 500:
            emoji = "💥"
            log_level = logging.ERROR
        elif response.status_code >= 400:
            emoji = "⚠️"
            log_level = logging.WARNING
        else:
            emoji = "✅"
            log_level = logging.INFO

        logger.log(log_level,
                   f"{emoji} [REQ: {request_id}] {response.status_code} - {process_time:.3f}s - {request.method} {request.url}")

        return response

    except Exception as e:
        process_time = (datetime.now() - start_time).total_seconds()
        logger.error(f"💥 [REQ: {request_id}] Erro: {str(e)} - {process_time:.3f}s")
        raise


# =============================================
# ROTAS DA API
# =============================================

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    logger.info("🏥 Health check solicitado")

    try:
        health_data = {
            "status": "healthy",
            "timestamp": datetime.now().isoformat(),
            "version": "4.0.0",
            "agno_service": "real" if USING_REAL_AGNO else "fallback",
            "environment": os.getenv("ENVIRONMENT", "development"),
            "api_keys": {
                "openai": bool(os.getenv("OPENAI_API_KEY")),
                "anthropic": bool(os.getenv("ANTHROPIC_API_KEY"))
            }
        }

        status_msg = "operacional com Agno REAL" if USING_REAL_AGNO else "operacional com fallback"
        logger.info(f"✅ Health check passou - sistema {status_msg}")

        return health_data

    except Exception as e:
        logger.error(f"❌ Health check falhou: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Health check failed: {str(e)}")


@app.get("/api/agents")
async def list_agents(user_id: int = Depends(get_current_user)):
    """Lista todos os agentes do usuário"""
    request_id = f"list_agents_{int(datetime.now().timestamp())}"

    try:
        logger.info(f"📋 [LIST: {request_id}] Listando agentes para usuário {user_id}")
        logger.info(f"🔧 [LIST: {request_id}] Usando {'Agno REAL' if USING_REAL_AGNO else 'Fallback Service'}")

        agents = await agno_service.list_agents(user_id)

        logger.info(f"✅ [LIST: {request_id}] {len(agents)} agentes encontrados")
        return agents

    except Exception as e:
        logger.error(f"❌ [LIST: {request_id}] Erro ao listar agentes: {str(e)}")
        logger.error(f"📍 [LIST: {request_id}] Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/agents/create")
async def create_agent(
        request: CreateAgentRequest,
        user_id: int = Depends(get_current_user)
):
    """Cria novo agente"""
    request_id = f"create_agent_{int(datetime.now().timestamp())}"

    try:
        logger.info(f"🎯 [CREATE: {request_id}] Criando agente '{request.name}' para usuário {user_id}")
        logger.info(f"🔧 [CREATE: {request_id}] Usando {'Agno REAL' if USING_REAL_AGNO else 'Fallback Service'}")
        logger.info(f"🤖 [CREATE: {request_id}] Modelo: {request.model_provider}/{request.model_id}")
        logger.info(f"🛠️ [CREATE: {request_id}] Ferramentas: {request.tools}")

        if USING_REAL_AGNO:
            # Converter para AgentConfig do Agno real
            config = AgentConfig(
                name=request.name,
                role=request.role,
                model_provider=ModelProvider(request.model_provider.lower()),
                model_id=request.model_id,
                instructions=request.instructions,
                tools=request.tools,
                memory_enabled=request.memory_enabled,
                rag_enabled=request.rag_enabled,
                rag_index_id=request.rag_index_id
            )
            agent_id = await agno_service.create_single_agent(user_id, config)
        else:
            # Usar fallback
            agent_id = await agno_service.create_single_agent(user_id, request)

        logger.info(f"✅ [CREATE: {request_id}] Agente criado com ID: {agent_id}")

        return {
            "agent_id": agent_id,
            "name": request.name,
            "status": "created",
            "model": f"{request.model_provider}/{request.model_id}",
            "service": "real_agno" if USING_REAL_AGNO else "fallback",
            "created_at": datetime.now().isoformat()
        }

    except Exception as e:
        logger.error(f"❌ [CREATE: {request_id}] Erro: {str(e)}")
        logger.error(f"📍 [CREATE: {request_id}] Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/agents/{agent_id}/chat")
async def chat_with_agent(
        agent_id: str,
        message: ChatMessage,
        user_id: int = Depends(get_current_user)
):
    """Chat com agente usando streaming"""
    request_id = f"chat_{agent_id}_{int(datetime.now().timestamp())}"

    try:
        logger.info(f"💬 [CHAT: {request_id}] === CHAT INICIADO ===")
        logger.info(f"👤 [CHAT: {request_id}] Usuário: {user_id}")
        logger.info(f"🤖 [CHAT: {request_id}] Agente: {agent_id}")
        logger.info(f"📝 [CHAT: {request_id}] Mensagem: '{message.message[:100]}...'")
        logger.info(f"🔧 [CHAT: {request_id}] Serviço: {'AGNO REAL' if USING_REAL_AGNO else 'FALLBACK'}")

        if not message.message or not message.message.strip():
            logger.error(f"❌ [CHAT: {request_id}] Mensagem vazia")
            raise HTTPException(status_code=400, detail="Mensagem não pode estar vazia")

        async def stream_generator():
            """Generator que usa o serviço apropriado para streaming"""
            try:
                if USING_REAL_AGNO:
                    logger.info(f"🌊 [CHAT: {request_id}] Iniciando stream com AGNO REAL")
                else:
                    logger.info(f"🌊 [CHAT: {request_id}] Iniciando stream com FALLBACK")

                chunk_count = 0

                # Usar o serviço apropriado
                async for chunk in agno_service.run_agent(agent_id, message.message, user_id):
                    chunk_count += 1

                    if chunk_count <= 3:  # Log apenas os primeiros chunks
                        logger.debug(f"📦 [CHAT: {request_id}] Chunk {chunk_count}: {chunk[:50]}...")

                    yield chunk

                service_type = "AGNO REAL" if USING_REAL_AGNO else "FALLBACK"
                logger.info(
                    f"🏁 [CHAT: {request_id}] Stream finalizado com {service_type} - {chunk_count} chunks enviados")

            except Exception as e:
                error_msg = f"Erro no streaming: {str(e)}"
                logger.error(f"💥 [CHAT: {request_id}] {error_msg}")
                logger.error(f"📍 [CHAT: {request_id}] Traceback: {traceback.format_exc()}")

                error_chunk = f"data: {json.dumps({'type': 'error', 'message': error_msg})}\n\n"
                yield error_chunk

        return StreamingResponse(
            stream_generator(),
            media_type="text/plain",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Access-Control-Allow-Origin": "*",
                "X-Accel-Buffering": "no",
            }
        )

    except Exception as e:
        logger.error(f"❌ [CHAT: {request_id}] Erro na rota de chat: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/metrics")
async def get_metrics(user_id: int = Depends(get_current_user)):
    """Obtém métricas do sistema"""
    request_id = f"metrics_{int(datetime.now().timestamp())}"

    try:
        logger.info(f"📊 [METRICS: {request_id}] Coletando métricas do sistema")

        if USING_REAL_AGNO:
            agents_count = len(agno_service.agents) if hasattr(agno_service, 'agents') else 0
            workflows_count = len(agno_service.workflows) if hasattr(agno_service, 'workflows') else 0
        else:
            agents_count = len(agno_service.agents)
            workflows_count = 0

        metrics = {
            "system": {
                "status": "operational",
                "service_type": "real_agno" if USING_REAL_AGNO else "fallback",
                "version": "4.0.0",
                "environment": os.getenv("ENVIRONMENT", "development")
            },
            "agents": {
                "total": agents_count,
                "active": agents_count  # Simplificado
            },
            "workflows": {
                "total": workflows_count,
                "active": workflows_count
            },
            "api_keys": {
                "openai_configured": bool(os.getenv("OPENAI_API_KEY")),
                "anthropic_configured": bool(os.getenv("ANTHROPIC_API_KEY"))
            }
        }

        logger.info(
            f"✅ [METRICS: {request_id}] Métricas coletadas - Serviço: {'REAL' if USING_REAL_AGNO else 'FALLBACK'}")
        return metrics

    except Exception as e:
        logger.error(f"❌ [METRICS: {request_id}] Erro ao obter métricas: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro ao obter métricas: {str(e)}")


# =============================================
# STARTUP
# =============================================

if __name__ == "__main__":
    import uvicorn

    service_type = "AGNO REAL" if USING_REAL_AGNO else "FALLBACK"
    logger.info("🚀 =====================================")
    logger.info(f"🚀 INICIANDO SERVIDOR COM {service_type}")
    logger.info("🚀 =====================================")

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info",
        access_log=True,
        reload=False
    )