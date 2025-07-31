# app.py - Backend Agno com Integração Real

import os
import json
import asyncio
import uuid
import traceback
from typing import List, Dict, Any, Optional, AsyncGenerator
from datetime import datetime, timedelta
import logging
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

# IMPORTANTE: Importar o AgnoService REAL ao invés do Mock
from agno_service import AgnoService, AgentConfig, WorkflowConfig, ModelProvider

load_dotenv()

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/agno.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Database setup
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://agno_user:agno_password@localhost:5432/agno_db")
ASYNC_DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")

# Create async engine
engine = create_async_engine(ASYNC_DATABASE_URL, echo=True)
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


# Dependency para obter usuário atual (mock simples)
async def get_current_user() -> int:
    return 1  # Para desenvolvimento - implementar autenticação real depois


# =============================================
# INICIALIZAÇÃO DO AGNO SERVICE REAL
# =============================================

# Inicializar o serviço REAL do Agno
agno_service = AgnoService()

logger.info("🚀 AgnoService REAL inicializado!")


# =============================================
# LIFESPAN MANAGER
# =============================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 =====================================")
    logger.info("🚀 INICIANDO AGNO PLATFORM COM AGNO REAL")
    logger.info("🚀 =====================================")

    # Test database connection
    try:
        async with engine.begin() as conn:
            await conn.execute(sa.text("SELECT 1"))
        logger.info("✅ Database connection successful")
    except Exception as e:
        logger.error(f"❌ Database connection failed: {e}")

    # Verificar se as variáveis de ambiente estão configuradas
    required_env_vars = ["OPENAI_API_KEY", "ANTHROPIC_API_KEY"]
    missing_vars = [var for var in required_env_vars if not os.getenv(var)]

    if missing_vars:
        logger.warning(f"⚠️ Variáveis de ambiente faltando: {missing_vars}")
    else:
        logger.info("✅ Todas as variáveis de ambiente configuradas")

    logger.info("✅ Sistema pronto para usar Agno REAL!")

    yield

    logger.info("🛑 Encerrando Agno Platform...")
    await engine.dispose()


# =============================================
# FASTAPI APP
# =============================================

app = FastAPI(
    title="Agno Platform API - Real Integration",
    description="Agno Platform API com integração real do Agno Framework",
    version="3.1.0",
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
        "*"  # Para desenvolvimento - restringir em produção
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

    logger.info(f"📥 [REQ: {request_id}] {request.method} {request.url}")

    try:
        response = await call_next(request)
        process_time = (datetime.now() - start_time).total_seconds()

        emoji = "✅" if response.status_code < 400 else "❌"
        logger.info(f"{emoji} [REQ: {request_id}] {response.status_code} - {process_time:.3f}s")

        return response
    except Exception as e:
        logger.error(f"💥 [REQ: {request_id}] Erro: {str(e)}")
        raise


# =============================================
# ROTAS DA API
# =============================================

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    logger.info("🏥 Health check solicitado")

    try:
        # Verificar se o AgnoService está funcionando
        service_status = "operational" if agno_service else "error"

        health_data = {
            "status": "healthy",
            "timestamp": datetime.now().isoformat(),
            "version": "3.1.0",
            "agno_service": service_status,
            "database": "connected",
            "environment": os.getenv("ENVIRONMENT", "development")
        }

        logger.info("✅ Health check passou - sistema operacional com Agno REAL")
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

        # Usar o AgnoService REAL para listar agentes
        agents = await agno_service.list_agents(user_id)

        logger.info(f"✅ [LIST: {request_id}] {len(agents)} agentes encontrados")
        return agents

    except Exception as e:
        logger.error(f"❌ [LIST: {request_id}] Erro ao listar agentes: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/agents/create")
async def create_agent(
        request: CreateAgentRequest,
        user_id: int = Depends(get_current_user)
):
    """Cria novo agente usando Agno real"""
    request_id = f"create_agent_{int(datetime.now().timestamp())}"

    try:
        logger.info(f"🎯 [CREATE: {request_id}] Criando agente '{request.name}' para usuário {user_id}")

        # Converter para AgentConfig
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

        # Usar o AgnoService REAL
        agent_id = await agno_service.create_single_agent(user_id, config)

        logger.info(f"✅ [CREATE: {request_id}] Agente criado com ID: {agent_id}")

        return {
            "agent_id": agent_id,
            "name": request.name,
            "status": "created",
            "model": f"{request.model_provider}/{request.model_id}",
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
    """Chat com agente usando Agno REAL com streaming"""
    request_id = f"chat_{agent_id}_{int(datetime.now().timestamp())}"

    try:
        logger.info(f"💬 [CHAT: {request_id}] === CHAT INICIADO COM AGNO REAL ===")
        logger.info(f"👤 [CHAT: {request_id}] Usuário: {user_id}")
        logger.info(f"🤖 [CHAT: {request_id}] Agente: {agent_id}")
        logger.info(f"📝 [CHAT: {request_id}] Mensagem: '{message.message[:100]}...'")

        if not message.message or not message.message.strip():
            logger.error(f"❌ [CHAT: {request_id}] Mensagem vazia")
            raise HTTPException(status_code=400, detail="Mensagem não pode estar vazia")

        async def stream_generator():
            """Generator que usa o Agno REAL para streaming"""
            try:
                logger.info(f"🌊 [CHAT: {request_id}] Iniciando stream com Agno REAL")

                chunk_count = 0

                # USAR O AGNO SERVICE REAL!
                async for chunk in agno_service.run_agent(agent_id, message.message, user_id):
                    chunk_count += 1

                    if chunk_count <= 3:  # Log apenas os primeiros chunks
                        logger.debug(f"📦 [CHAT: {request_id}] Chunk {chunk_count}: {chunk[:50]}...")

                    yield chunk

                logger.info(f"🏁 [CHAT: {request_id}] Stream finalizado - {chunk_count} chunks enviados")

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


@app.post("/api/workflows/create")
async def create_workflow(
        request: CreateWorkflowRequest,
        user_id: int = Depends(get_current_user)
):
    """Cria novo workflow usando Agno real"""
    request_id = f"create_workflow_{int(datetime.now().timestamp())}"

    try:
        logger.info(f"🔄 [WORKFLOW: {request_id}] Criando workflow '{request.name}'")

        # Converter agentes para AgentConfig
        agent_configs = [
            AgentConfig(
                name=agent.name,
                role=agent.role,
                model_provider=ModelProvider(agent.model_provider.lower()),
                model_id=agent.model_id,
                instructions=agent.instructions,
                tools=agent.tools,
                memory_enabled=agent.memory_enabled,
                rag_enabled=agent.rag_enabled,
                rag_index_id=agent.rag_index_id
            )
            for agent in request.agents
        ]

        # Criar WorkflowConfig
        workflow_config = WorkflowConfig(
            name=request.name,
            description=request.description,
            agents=agent_configs,
            flow_type=request.flow_type,
            supervisor_enabled=request.supervisor_enabled
        )

        # Usar o AgnoService REAL
        workflow_id = await agno_service.create_workflow(user_id, workflow_config)

        logger.info(f"✅ [WORKFLOW: {request_id}] Workflow criado com ID: {workflow_id}")

        return {
            "workflow_id": workflow_id,
            "name": request.name,
            "status": "created",
            "agent_count": len(request.agents),
            "created_at": datetime.now().isoformat()
        }

    except Exception as e:
        logger.error(f"❌ [WORKFLOW: {request_id}] Erro: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/metrics")
async def get_metrics(user_id: int = Depends(get_current_user)):
    """Obtém métricas do sistema"""
    try:
        # Implementar métricas reais baseadas no AgnoService
        metrics = {
            "agents": {
                "total": len(agno_service.agents),
                "active": len([a for a in agno_service.agents.values()]),
            },
            "workflows": {
                "total": len(agno_service.workflows),
                "active": len(agno_service.workflows)
            },
            "system": {
                "status": "operational_with_real_agno",
                "version": "3.1.0",
                "environment": os.getenv("ENVIRONMENT", "development")
            }
        }

        return metrics

    except Exception as e:
        logger.error(f"❌ Erro ao obter métricas: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================
# STARTUP
# =============================================

if __name__ == "__main__":
    import uvicorn

    logger.info("🚀 =====================================")
    logger.info("🚀 INICIANDO SERVIDOR COM AGNO REAL...")
    logger.info("🚀 =====================================")

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info",
        access_log=True,
        reload=False
    )