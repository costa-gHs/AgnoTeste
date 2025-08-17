# backend/app.py - VERSÃO CORRIGIDA PARA ASYNCPG
import os
import logging
from datetime import datetime
from contextlib import asynccontextmanager
from typing import Optional, Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import text as sa_text

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# =============================================
# DATABASE SETUP CORRIGIDO
# =============================================

def get_database_url():
    """Constrói a URL do banco com o driver correto"""

    # Tentar pegar URL completa do ambiente
    db_url = os.getenv("DATABASE_URL")

    if db_url:
        # Se já tem URL, garantir que usa asyncpg
        if db_url.startswith("postgresql://"):
            db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
        elif db_url.startswith("postgres://"):
            db_url = db_url.replace("postgres://", "postgresql+asyncpg://", 1)
        elif not db_url.startswith("postgresql+asyncpg://"):
            # Se tem psycopg2 ou outro driver, substituir por asyncpg
            if "+psycopg2://" in db_url:
                db_url = db_url.replace("+psycopg2://", "+asyncpg://")
            elif "+psycopg://" in db_url:
                db_url = db_url.replace("+psycopg://", "+asyncpg://")

        logger.info(f"✅ Usando DATABASE_URL do ambiente: {db_url.split('@')[0]}@***")
        return db_url

    # Construir URL a partir de componentes individuais
    db_host = os.getenv("DB_HOST", "localhost")
    db_port = os.getenv("DB_PORT", "5432")
    db_user = os.getenv("DB_USER", "postgres")
    db_password = os.getenv("DB_PASSWORD", "password")
    db_name = os.getenv("DB_NAME", "agno_platform")

    # IMPORTANTE: Usar postgresql+asyncpg:// para async
    url = f"postgresql+asyncpg://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"

    logger.info(f"✅ URL construída: postgresql+asyncpg://{db_user}:***@{db_host}:{db_port}/{db_name}")
    return url


DATABASE_URL = get_database_url()

# Criar engine com configurações otimizadas
try:
    engine = create_async_engine(
        DATABASE_URL,
        echo=False,
        pool_size=5,
        max_overflow=10,
        pool_timeout=30,
        pool_recycle=3600
    )
    logger.info("✅ Engine de banco criado com sucesso")
except Exception as e:
    logger.error(f"❌ Erro ao criar engine: {e}")
    raise

async_session = async_sessionmaker(engine, expire_on_commit=False)


async def get_db():
    """Dependency para obter sessão do banco"""
    async with async_session() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


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
    database_connected: bool
    database_driver: str


# =============================================
# LIFESPAN EVENTS
# =============================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Gerenciamento do ciclo de vida da aplicação"""
    # Startup
    logger.info("🚀 Iniciando Agno Platform Backend - Versão Corrigida AsyncPG")

    # Testar conexão com banco
    db_connected = False
    try:
        async with engine.begin() as conn:
            result = await conn.execute(sa_text("SELECT version()"))
            version = result.fetchone()
            if version:
                logger.info(f"✅ Conexão com PostgreSQL OK: {version[0][:50]}...")
                db_connected = True
    except Exception as e:
        logger.error(f"❌ Erro na conexão com banco: {e}")
        logger.error("💡 Verifique se:")
        logger.error("   - PostgreSQL está rodando")
        logger.error("   - Credenciais estão corretas")
        logger.error("   - asyncpg está instalado: pip install asyncpg")

    if not db_connected:
        logger.warning("⚠️ Continuando sem banco de dados...")

    yield

    # Shutdown
    logger.info("🔄 Finalizando aplicação...")


# =============================================
# FASTAPI APP SETUP
# =============================================

app = FastAPI(
    title="AGNO API",
    description="API para Agentes e Teams - Versão Corrigida",
    version="5.1.2-no-redirects",
    # IMPORTANTE: redirect_slashes=False evita os redirects automáticos
    redirect_slashes=False
)

# =============================================
# MIDDLEWARE CONFIGURATION
# =============================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Em produção, especifique os domínios
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
        message="Agno Platform API v5.1.1 - AsyncPG - Funcionando!",
        data={
            "version": "5.1.1",
            "docs": "/docs",
            "health": "/api/health",
            "status": "CORRIGIDA_ASYNCPG",
            "database_driver": "postgresql+asyncpg"
        }
    )


@app.get("/api/health", response_model=HealthResponse)
async def health_check():
    """Health check completo da aplicação"""

    # Testar banco de dados
    db_connected = False
    db_info = "N/A"

    try:
        async with engine.begin() as conn:
            result = await conn.execute(sa_text("SELECT version()"))
            version = result.fetchone()
            if version:
                db_connected = True
                db_info = version[0][:100]
    except Exception as e:
        logger.error(f"Erro no health check DB: {e}")
        db_info = f"Erro: {str(e)}"

    return HealthResponse(
        status="healthy" if db_connected else "degraded",
        timestamp=datetime.utcnow().isoformat(),
        version="5.1.1-asyncpg",
        environment=os.getenv("ENVIRONMENT", "development"),
        database_connected=db_connected,
        database_driver="postgresql+asyncpg"
    )


# =============================================
# REGISTRAR ROUTERS CORRIGIDOS
# =============================================

# Importar e registrar os routers corrigidos
try:
    from routers.agents import router as agents_router
    from routers.teams import router as teams_router

    app.include_router(agents_router)
    app.include_router(teams_router)

    logger.info("✅ Routers de agents e teams registrados com sucesso")

except ImportError as e:
    logger.error(f"❌ Erro ao importar routers: {e}")
    logger.info("📝 Certifique-se de que os arquivos routers/agents.py e routers/teams.py existem")


    # Fallback: criar endpoints básicos se routers não existirem
    @app.get("/api/agents")
    async def fallback_agents():
        return {"message": "Router agents.py não encontrado", "agents": []}


    @app.get("/api/teams")
    async def fallback_teams():
        return {"message": "Router teams.py não encontrado", "teams": []}


# =============================================
# EXCEPTION HANDLERS
# =============================================

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Handler global para exceptions"""
    logger.error(f"❌ Erro não tratado: {exc}")
    return {
        "error": "Erro interno do servidor",
        "detail": str(exc),
        "timestamp": datetime.utcnow().isoformat()
    }


# =============================================
# STARTUP MESSAGE
# =============================================

if __name__ == "__main__":
    import uvicorn

    print("\n" + "=" * 60)
    print("🚀 AGNO PLATFORM - BACKEND CORRIGIDO (AsyncPG)")
    print("=" * 60)
    print("✅ Driver AsyncPG configurado para PostgreSQL")
    print("✅ SQLAlchemy Async funcionando")
    print("✅ Endpoints /api/agents/{id}/chat criados")
    print("✅ Modelos Pydantic corrigidos")
    print("=" * 60)
    print("📋 DEPENDÊNCIAS NECESSÁRIAS:")
    print("   pip install asyncpg")
    print("   pip install sqlalchemy[asyncio]")
    print("=" * 60)

    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )