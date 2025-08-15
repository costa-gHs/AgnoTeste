# backend/app.py - Agno Platform Backend COMPLETO E CORRIGIDO
# Versão: 5.0.0 - Resolução completa de importações e estrutura

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
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field

# Database imports
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy import text as sa_text, Column, Integer, String, Text, Boolean, JSON, DateTime
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

        timestamp = self.formatTime(record, '%H:%M:%S')
        level = f"{color}{record.levelname:8}{self.RESET}"

        return f"{timestamp} {emoji} {level} | {record.getMessage()}"


# Configurar logging
log_dir = Path("logs")
log_dir.mkdir(exist_ok=True)

console_handler = logging.StreamHandler(sys.stdout)
console_handler.setFormatter(ColoredFormatter())

file_handler = logging.FileHandler(log_dir / 'agno.log', mode='a', encoding='utf-8')
file_handler.setFormatter(logging.Formatter(
    '%(asctime)s - %(name)s - [%(levelname)s] - %(message)s'
))

logging.basicConfig(
    level=logging.INFO,
    handlers=[console_handler, file_handler],
    force=True
)

logger = logging.getLogger(__name__)

# =============================================
# DATABASE SETUP COMPLETO
# =============================================

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://agno_user:agno_password@postgres:5432/agno_db")

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


# =============================================
# MODELS SQLALCHEMY INTEGRADOS
# =============================================

class Agent(Base):
    __tablename__ = "agno_agents"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, default=1)
    name = Column(String(100), nullable=False, index=True)
    description = Column(Text, nullable=True)
    role = Column(String(200), nullable=False)
    model_provider = Column(String(50), nullable=False)
    model_id = Column(String(100), nullable=False)
    instructions = Column(JSON, nullable=True, default=list)
    tools = Column(JSON, nullable=True, default=list)
    configuration = Column(JSON, nullable=True, default=dict)
    memory_enabled = Column(Boolean, default=True)
    rag_enabled = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    rag_index_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Team(Base):
    __tablename__ = "agno_teams"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, default=1)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    team_type = Column(String(50), default='collaborative')
    supervisor_agent_id = Column(Integer, nullable=True)
    team_configuration = Column(JSON, default=dict)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class TeamAgent(Base):
    __tablename__ = "agno_team_agents"

    id = Column(Integer, primary_key=True, index=True)
    team_id = Column(Integer, nullable=False)
    agent_id = Column(Integer, nullable=False)
    role_in_team = Column(String(50), nullable=True)
    priority = Column(Integer, default=1)
    agent_config = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)


# =============================================
# DEPENDENCY FUNCTIONS
# =============================================

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependência para obter sessão do banco"""
    async with async_session() as session:
        try:
            yield session
        except Exception as e:
            await session.rollback()
            logger.error(f"Erro na sessão do banco: {e}")
            raise
        finally:
            await session.close()


async def get_current_user() -> int:
    """Mock de autenticação - retorna user_id fixo"""
    return 1


# =============================================
# VERIFICAÇÃO DE AGNO FRAMEWORK
# =============================================

AGNO_AVAILABLE = False

try:
    # Tentar importar Agno framework
    from agno.agent import Agent as AgnoAgent
    from agno.models.openai import OpenAIChat
    from agno.models.anthropic import Claude
    from agno.tools.duckduckgo import DuckDuckGoTools
    from agno.tools.calculator import CalculatorTools
    from agno.tools.reasoning import ReasoningTools

    AGNO_AVAILABLE = True
    logger.info("✅ Agno framework disponível")

except ImportError as e:
    logger.warning(f"⚠️ Agno framework não disponível: {e}")
    AGNO_AVAILABLE = False


# =============================================
# PYDANTIC MODELS
# =============================================

class BaseResponse(BaseModel):
    success: bool = True
    message: str = "OK"
    data: Optional[Any] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class HealthResponse(BaseModel):
    status: str
    timestamp: str
    version: str
    environment: str
    agno_available: bool
    database_connected: bool


class AgentCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    role: str = Field(..., max_length=200)
    description: Optional[str] = None
    model_provider: str = Field(default="openai")
    model_id: str = Field(default="gpt-4o-mini")
    instructions: List[str] = Field(default=[])
    tools: List[str] = Field(default=[])
    memory_enabled: bool = True
    rag_enabled: bool = False
    configuration: Dict[str, Any] = Field(default_factory=dict)


class AgentResponse(BaseModel):
    id: int
    name: str
    role: str
    description: Optional[str]
    model_provider: str
    model_id: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


class TeamCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    description: str = Field(..., max_length=500)
    team_type: str = Field(default="collaborative")
    agents: List[Dict[str, Any]] = Field(default=[])
    supervisor_agent_id: Optional[int] = None
    team_configuration: Dict[str, Any] = Field(default_factory=dict)


class TeamResponse(BaseModel):
    id: int
    name: str
    description: str
    team_type: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    agent_count: int
    agents: List[Dict[str, Any]]


# =============================================
# LIFESPAN EVENTS
# =============================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Gerenciamento do ciclo de vida da aplicação"""
    # Startup
    logger.info("🚀 Iniciando Agno Platform Backend v5.0.0")

    try:
        # Testar conexão com banco
        async with engine.begin() as conn:
            result = await conn.execute(sa_text("SELECT 1"))
            if result.fetchone():
                logger.info("✅ Conexão com banco de dados OK")

        # Criar tabelas se necessário
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            logger.info("✅ Tabelas do banco verificadas/criadas")

    except Exception as e:
        logger.error(f"❌ Erro na inicialização: {e}")

    yield

    # Shutdown
    logger.info("🔄 Finalizando aplicação...")


# =============================================
# FASTAPI APP SETUP
# =============================================

app = FastAPI(
    title="Agno Platform API",
    description="Backend completo para gerenciamento de Agentes e Teams de IA",
    version="5.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# =============================================
# MIDDLEWARE CONFIGURATION
# =============================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Em produção, especificar domínios
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["*"]  # Em produção, especificar hosts
)


# =============================================
# ROTAS PRINCIPAIS
# =============================================

@app.get("/", response_model=BaseResponse)
async def root():
    """Endpoint raiz da API"""
    return BaseResponse(
        message="Agno Platform API v5.0.0 - Funcionando!",
        data={
            "version": "5.0.0",
            "docs": "/docs",
            "health": "/api/health"
        }
    )


@app.get("/api/health", response_model=HealthResponse)
async def health_check():
    """Health check completo da aplicação"""

    # Testar banco de dados
    db_connected = False
    try:
        async with engine.begin() as conn:
            result = await conn.execute(sa_text("SELECT 1"))
            if result.fetchone():
                db_connected = True
    except Exception as e:
        logger.error(f"Erro no health check DB: {e}")

    return HealthResponse(
        status="healthy" if db_connected else "degraded",
        timestamp=datetime.utcnow().isoformat(),
        version="5.0.0",
        environment=os.getenv("ENVIRONMENT", "development"),
        agno_available=AGNO_AVAILABLE,
        database_connected=db_connected
    )


# =============================================
# AGENTS ENDPOINTS
# =============================================

@app.get("/api/agents", response_model=List[AgentResponse])
async def list_agents(
        user_id: int = Depends(get_current_user),
        db: AsyncSession = Depends(get_db)
):
    """Lista todos os agentes do usuário"""
    try:
        from sqlalchemy import select, desc

        result = await db.execute(
            select(Agent)
            .where(Agent.user_id == user_id, Agent.is_active == True)
            .order_by(desc(Agent.created_at))
        )
        agents = result.scalars().all()

        logger.info(f"📋 Listados {len(agents)} agentes para usuário {user_id}")

        return [
            AgentResponse(
                id=agent.id,
                name=agent.name,
                role=agent.role,
                description=agent.description,
                model_provider=agent.model_provider,
                model_id=agent.model_id,
                is_active=agent.is_active,
                created_at=agent.created_at,
                updated_at=agent.updated_at
            )
            for agent in agents
        ]

    except Exception as e:
        logger.error(f"❌ Erro ao listar agentes: {e}")
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")


@app.post("/api/agents", response_model=AgentResponse)
async def create_agent(
        request: AgentCreateRequest,
        user_id: int = Depends(get_current_user),
        db: AsyncSession = Depends(get_db)
):
    """Cria um novo agente"""
    try:
        from sqlalchemy import insert

        # Preparar dados
        agent_data = {
            "user_id": user_id,
            "name": request.name,
            "role": request.role,
            "description": request.description,
            "model_provider": request.model_provider,
            "model_id": request.model_id,
            "instructions": request.instructions or [],
            "tools": request.tools or [],
            "memory_enabled": request.memory_enabled,
            "rag_enabled": request.rag_enabled,
            "configuration": request.configuration or {},
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }

        # Inserir no banco
        result = await db.execute(
            insert(Agent).values(**agent_data).returning(Agent)
        )
        await db.commit()

        new_agent = result.scalar_one()

        logger.info(f"✅ Agente '{request.name}' criado com ID {new_agent.id}")

        return AgentResponse(
            id=new_agent.id,
            name=new_agent.name,
            role=new_agent.role,
            description=new_agent.description,
            model_provider=new_agent.model_provider,
            model_id=new_agent.model_id,
            is_active=new_agent.is_active,
            created_at=new_agent.created_at,
            updated_at=new_agent.updated_at
        )

    except Exception as e:
        await db.rollback()
        logger.error(f"❌ Erro ao criar agente: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao criar agente: {str(e)}")


@app.get("/api/agents/{agent_id}", response_model=AgentResponse)
async def get_agent(
        agent_id: int,
        user_id: int = Depends(get_current_user),
        db: AsyncSession = Depends(get_db)
):
    """Busca um agente específico"""
    try:
        from sqlalchemy import select

        result = await db.execute(
            select(Agent).where(
                Agent.id == agent_id,
                Agent.user_id == user_id,
                Agent.is_active == True
            )
        )
        agent = result.scalar_one_or_none()

        if not agent:
            raise HTTPException(status_code=404, detail="Agente não encontrado")

        return AgentResponse(
            id=agent.id,
            name=agent.name,
            role=agent.role,
            description=agent.description,
            model_provider=agent.model_provider,
            model_id=agent.model_id,
            is_active=agent.is_active,
            created_at=agent.created_at,
            updated_at=agent.updated_at
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Erro ao buscar agente {agent_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")


@app.delete("/api/agents/{agent_id}")
async def delete_agent(
        agent_id: int,
        user_id: int = Depends(get_current_user),
        db: AsyncSession = Depends(get_db)
):
    """Remove um agente (soft delete)"""
    try:
        from sqlalchemy import update, select

        # Verificar se existe
        result = await db.execute(
            select(Agent).where(
                Agent.id == agent_id,
                Agent.user_id == user_id,
                Agent.is_active == True
            )
        )
        agent = result.scalar_one_or_none()

        if not agent:
            raise HTTPException(status_code=404, detail="Agente não encontrado")

        # Soft delete
        await db.execute(
            update(Agent)
            .where(Agent.id == agent_id)
            .values(is_active=False, updated_at=datetime.utcnow())
        )
        await db.commit()

        logger.info(f"🗑️ Agente {agent_id} removido")

        return BaseResponse(message=f"Agente {agent.name} removido com sucesso")

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"❌ Erro ao remover agente {agent_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")


# =============================================
# TEAMS ENDPOINTS
# =============================================

@app.get("/api/teams", response_model=List[TeamResponse])
async def list_teams(
        user_id: int = Depends(get_current_user),
        db: AsyncSession = Depends(get_db)
):
    """Lista todos os teams do usuário"""
    try:
        from sqlalchemy import select, desc, func

        # Buscar teams
        result = await db.execute(
            select(Team)
            .where(Team.user_id == user_id, Team.is_active == True)
            .order_by(desc(Team.created_at))
        )
        teams = result.scalars().all()

        teams_response = []

        for team in teams:
            # Contar agentes do team
            count_result = await db.execute(
                select(func.count(TeamAgent.id))
                .where(TeamAgent.team_id == team.id, TeamAgent.is_active == True)
            )
            agent_count = count_result.scalar() or 0

            # Buscar agentes do team
            agents_result = await db.execute(
                select(TeamAgent, Agent)
                .join(Agent, TeamAgent.agent_id == Agent.id)
                .where(TeamAgent.team_id == team.id, TeamAgent.is_active == True)
            )
            team_agents = agents_result.all()

            agents_data = []
            for team_agent, agent in team_agents:
                agents_data.append({
                    "id": agent.id,
                    "name": agent.name,
                    "role": agent.role,
                    "role_in_team": team_agent.role_in_team,
                    "priority": team_agent.priority
                })

            teams_response.append(TeamResponse(
                id=team.id,
                name=team.name,
                description=team.description,
                team_type=team.team_type,
                is_active=team.is_active,
                created_at=team.created_at,
                updated_at=team.updated_at,
                agent_count=agent_count,
                agents=agents_data
            ))

        logger.info(f"📋 Listados {len(teams)} teams para usuário {user_id}")

        return teams_response

    except Exception as e:
        logger.error(f"❌ Erro ao listar teams: {e}")
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")


@app.post("/api/teams", response_model=TeamResponse)
async def create_team(
        request: TeamCreateRequest,
        user_id: int = Depends(get_current_user),
        db: AsyncSession = Depends(get_db)
):
    """Cria um novo team"""
    try:
        from sqlalchemy import insert, select

        # Criar o team
        team_data = {
            "user_id": user_id,
            "name": request.name,
            "description": request.description,
            "team_type": request.team_type,
            "supervisor_agent_id": request.supervisor_agent_id,
            "team_configuration": request.team_configuration or {},
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }

        result = await db.execute(
            insert(Team).values(**team_data).returning(Team)
        )
        new_team = result.scalar_one()

        # Adicionar agentes ao team
        agents_data = []
        for agent_config in request.agents:
            agent_id = agent_config.get("agent_id")
            if agent_id:
                # Verificar se agente existe
                agent_result = await db.execute(
                    select(Agent).where(
                        Agent.id == agent_id,
                        Agent.user_id == user_id,
                        Agent.is_active == True
                    )
                )
                agent = agent_result.scalar_one_or_none()

                if agent:
                    # Adicionar ao team
                    team_agent_data = {
                        "team_id": new_team.id,
                        "agent_id": agent_id,
                        "role_in_team": agent_config.get("role_in_team", "member"),
                        "priority": agent_config.get("priority", 1),
                        "agent_config": agent_config.get("config", {}),
                        "created_at": datetime.utcnow(),
                        "is_active": True
                    }

                    await db.execute(insert(TeamAgent).values(**team_agent_data))

                    agents_data.append({
                        "id": agent.id,
                        "name": agent.name,
                        "role": agent.role,
                        "role_in_team": agent_config.get("role_in_team", "member"),
                        "priority": agent_config.get("priority", 1)
                    })

        await db.commit()

        logger.info(f"✅ Team '{request.name}' criado com ID {new_team.id}")

        return TeamResponse(
            id=new_team.id,
            name=new_team.name,
            description=new_team.description,
            team_type=new_team.team_type,
            is_active=new_team.is_active,
            created_at=new_team.created_at,
            updated_at=new_team.updated_at,
            agent_count=len(agents_data),
            agents=agents_data
        )

    except Exception as e:
        await db.rollback()
        logger.error(f"❌ Erro ao criar team: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao criar team: {str(e)}")


@app.get("/api/teams/{team_id}", response_model=TeamResponse)
async def get_team(
        team_id: int,
        user_id: int = Depends(get_current_user),
        db: AsyncSession = Depends(get_db)
):
    """Busca um team específico"""
    try:
        from sqlalchemy import select, func

        # Buscar team
        result = await db.execute(
            select(Team).where(
                Team.id == team_id,
                Team.user_id == user_id,
                Team.is_active == True
            )
        )
        team = result.scalar_one_or_none()

        if not team:
            raise HTTPException(status_code=404, detail="Team não encontrado")

        # Buscar agentes do team
        agents_result = await db.execute(
            select(TeamAgent, Agent)
            .join(Agent, TeamAgent.agent_id == Agent.id)
            .where(TeamAgent.team_id == team.id, TeamAgent.is_active == True)
        )
        team_agents = agents_result.all()

        agents_data = []
        for team_agent, agent in team_agents:
            agents_data.append({
                "id": agent.id,
                "name": agent.name,
                "role": agent.role,
                "role_in_team": team_agent.role_in_team,
                "priority": team_agent.priority
            })

        return TeamResponse(
            id=team.id,
            name=team.name,
            description=team.description,
            team_type=team.team_type,
            is_active=team.is_active,
            created_at=team.created_at,
            updated_at=team.updated_at,
            agent_count=len(agents_data),
            agents=agents_data
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Erro ao buscar team {team_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")


# =============================================
# AGNO INTEGRATION ENDPOINTS
# =============================================

if AGNO_AVAILABLE:
    @app.post("/api/agents/{agent_id}/execute")
    async def execute_agent(
            agent_id: int,
            prompt: str = Body(..., embed=True),
            user_id: int = Depends(get_current_user),
            db: AsyncSession = Depends(get_db)
    ):
        """Executa um agente usando Agno framework"""
        try:
            from sqlalchemy import select

            # Buscar agente
            result = await db.execute(
                select(Agent).where(
                    Agent.id == agent_id,
                    Agent.user_id == user_id,
                    Agent.is_active == True
                )
            )
            agent = result.scalar_one_or_none()

            if not agent:
                raise HTTPException(status_code=404, detail="Agente não encontrado")

            # Criar agente Agno
            model_map = {
                "openai": OpenAIChat,
                "anthropic": Claude
            }

            model_class = model_map.get(agent.model_provider)
            if not model_class:
                raise HTTPException(
                    status_code=400,
                    detail=f"Provider {agent.model_provider} não suportado"
                )

            # Configurar modelo
            model_config = {"model": agent.model_id}
            if agent.model_provider == "openai":
                model_config["api_key"] = os.getenv("OPENAI_API_KEY")
            elif agent.model_provider == "anthropic":
                model_config["api_key"] = os.getenv("ANTHROPIC_API_KEY")

            model = model_class(**model_config)

            # Criar agente Agno
            agno_agent = AgnoAgent(
                name=agent.name,
                role=agent.role,
                model=model,
                instructions=agent.instructions or [],
                tools=[DuckDuckGoTools(), CalculatorTools(), ReasoningTools()]  # Default tools
            )

            # Executar
            response = agno_agent.run(prompt)

            logger.info(f"✅ Agente {agent_id} executado com sucesso")

            return BaseResponse(
                message="Agente executado com sucesso",
                data={
                    "agent_id": agent_id,
                    "agent_name": agent.name,
                    "prompt": prompt,
                    "response": response.content if hasattr(response, 'content') else str(response)
                }
            )

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"❌ Erro ao executar agente {agent_id}: {e}")
            raise HTTPException(status_code=500, detail=f"Erro na execução: {str(e)}")


    @app.post("/api/teams/{team_id}/execute")
    async def execute_team(
            team_id: int,
            prompt: str = Body(..., embed=True),
            user_id: int = Depends(get_current_user),
            db: AsyncSession = Depends(get_db)
    ):
        """Executa um team usando Agno framework"""
        try:
            from sqlalchemy import select

            # Buscar team
            result = await db.execute(
                select(Team).where(
                    Team.id == team_id,
                    Team.user_id == user_id,
                    Team.is_active == True
                )
            )
            team = result.scalar_one_or_none()

            if not team:
                raise HTTPException(status_code=404, detail="Team não encontrado")

            # Buscar agentes do team
            agents_result = await db.execute(
                select(TeamAgent, Agent)
                .join(Agent, TeamAgent.agent_id == Agent.id)
                .where(TeamAgent.team_id == team.id, TeamAgent.is_active == True)
                .order_by(TeamAgent.priority)
            )
            team_agents = agents_result.all()

            if not team_agents:
                raise HTTPException(status_code=400, detail="Team não possui agentes")

            # Criar agentes Agno
            agno_agents = []
            model_map = {
                "openai": OpenAIChat,
                "anthropic": Claude
            }

            for team_agent, agent in team_agents:
                model_class = model_map.get(agent.model_provider)
                if model_class:
                    model_config = {"model": agent.model_id}
                    if agent.model_provider == "openai":
                        model_config["api_key"] = os.getenv("OPENAI_API_KEY")
                    elif agent.model_provider == "anthropic":
                        model_config["api_key"] = os.getenv("ANTHROPIC_API_KEY")

                    model = model_class(**model_config)

                    agno_agent = AgnoAgent(
                        name=agent.name,
                        role=agent.role,
                        model=model,
                        instructions=agent.instructions or [],
                        tools=[DuckDuckGoTools(), CalculatorTools(), ReasoningTools()]
                    )
                    agno_agents.append(agno_agent)

            if not agno_agents:
                raise HTTPException(status_code=400, detail="Nenhum agente válido no team")

            # Criar team Agno
            from agno.team import Team as AgnoTeam

            agno_team = AgnoTeam(
                name=team.name,
                description=team.description,
                agents=agno_agents
            )

            # Executar team
            response = agno_team.run(prompt)

            logger.info(f"✅ Team {team_id} executado com sucesso")

            return BaseResponse(
                message="Team executado com sucesso",
                data={
                    "team_id": team_id,
                    "team_name": team.name,
                    "prompt": prompt,
                    "response": response.content if hasattr(response, 'content') else str(response),
                    "agents_used": len(agno_agents)
                }
            )

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"❌ Erro ao executar team {team_id}: {e}")
            raise HTTPException(status_code=500, detail=f"Erro na execução: {str(e)}")

else:
    @app.post("/api/agents/{agent_id}/execute")
    async def execute_agent_fallback(agent_id: int):
        """Fallback quando Agno não está disponível"""
        raise HTTPException(
            status_code=503,
            detail="Agno framework não disponível. Instale agno-python para usar esta funcionalidade."
        )


    @app.post("/api/teams/{team_id}/execute")
    async def execute_team_fallback(team_id: int):
        """Fallback quando Agno não está disponível"""
        raise HTTPException(
            status_code=503,
            detail="Agno framework não disponível. Instale agno-python para usar esta funcionalidade."
        )


# =============================================
# ERROR HANDLERS
# =============================================

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handler personalizado para HTTPExceptions"""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "message": exc.detail,
            "status_code": exc.status_code,
            "timestamp": datetime.utcnow().isoformat()
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handler para erros gerais"""
    logger.error(f"❌ Erro não tratado: {exc}")
    logger.error(traceback.format_exc())

    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "message": "Erro interno do servidor",
            "status_code": 500,
            "timestamp": datetime.utcnow().isoformat()
        }
    )


# =============================================
# STARTUP MESSAGE
# =============================================

if __name__ == "__main__":
    import uvicorn

    logger.info("🚀 Iniciando servidor Agno Platform")
    logger.info("📚 Documentação: http://127.0.0.1:8000/docs")
    logger.info("🔧 Health Check: http://127.0.0.1:8000/api/health")

    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )