# backend/database.py - Configuração centralizada do banco de dados

import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy import text
from dotenv import load_dotenv
from typing import AsyncGenerator
import logging

# Configurar logging
logger = logging.getLogger(__name__)

# Carregar variáveis de ambiente
load_dotenv()

# =============================================
# CONFIGURAÇÃO DO BANCO
# =============================================

# URL do banco - usa a mesma configuração dos seus arquivos existentes
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://agno_user:agno_password@postgres:5432/agno_db")

# Converter para asyncpg se necessário
if DATABASE_URL.startswith("postgresql://"):
    ASYNC_DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
else:
    ASYNC_DATABASE_URL = DATABASE_URL

# Create async engine com configuração otimizada
engine = create_async_engine(
    ASYNC_DATABASE_URL,
    echo=False,  # Desabilitar logs SQL verbosos
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
    pool_recycle=3600,
    pool_timeout=30
)

# Async session maker
async_session = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=True,
    autocommit=False
)

# ✅ BASE PARA MODELOS SQLAlchemy - ESTÁ AQUI!
Base = declarative_base()


# =============================================
# DEPENDENCY FUNCTION
# =============================================

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency para obter sessão do banco de dados

    Yields:
        AsyncSession: Sessão do banco de dados
    """
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
# FUNÇÕES UTILITÁRIAS
# =============================================

async def test_connection():
    """
    Testa a conexão com o banco de dados

    Returns:
        bool: True se conectou com sucesso, False caso contrário
    """
    try:
        async with engine.begin() as conn:
            result = await conn.execute(text("SELECT 1"))
            row = result.fetchone()
            if row and row[0] == 1:
                logger.info("✅ Conexão com banco de dados OK")
                return True
            else:
                logger.error("❌ Teste de conexão falhou - resultado inesperado")
                return False
    except Exception as e:
        logger.error(f"❌ Erro na conexão com banco: {e}")
        return False


async def create_tables():
    """
    Cria todas as tabelas definidas nos modelos
    """
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("✅ Tabelas criadas com sucesso")
    except Exception as e:
        logger.error(f"❌ Erro ao criar tabelas: {e}")
        raise


async def drop_tables():
    """
    Remove todas as tabelas (CUIDADO!)
    """
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
        logger.info("⚠️ Tabelas removidas")
    except Exception as e:
        logger.error(f"❌ Erro ao remover tabelas: {e}")
        raise


# =============================================
# HEALTH CHECK
# =============================================

async def health_check():
    """
    Health check completo do banco de dados

    Returns:
        dict: Status da conexão e informações do banco
    """
    try:
        async with engine.begin() as conn:
            # Teste básico
            result = await conn.execute(text("SELECT 1 as test"))
            test_result = result.fetchone()

            # Informações do banco
            db_version = await conn.execute(text("SELECT version()"))
            version_info = db_version.fetchone()

            # Status das conexões
            pool_status = {
                "pool_size": engine.pool.size(),
                "checked_in": engine.pool.checkedin(),
                "checked_out": engine.pool.checkedout(),
                "overflow": engine.pool.overflow(),
                "invalid": engine.pool.invalid()
            }

            return {
                "status": "healthy",
                "test_query": test_result[0] if test_result else None,
                "database_version": version_info[0] if version_info else "unknown",
                "pool_status": pool_status,
                "connection_url": ASYNC_DATABASE_URL.split('@')[1] if '@' in ASYNC_DATABASE_URL else "hidden"
            }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
            "connection_url": ASYNC_DATABASE_URL.split('@')[1] if '@' in ASYNC_DATABASE_URL else "hidden"
        }


# =============================================
# EXPORTS (para facilitar imports)
# =============================================

__all__ = [
    "engine",
    "async_session",
    "Base",
    "get_db",
    "test_connection",
    "create_tables",
    "drop_tables",
    "health_check"
]