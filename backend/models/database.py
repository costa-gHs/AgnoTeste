# backend/database.py - Configuração centralizada do banco de dados

import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from dotenv import load_dotenv
from typing import AsyncGenerator

# Carregar variáveis de ambiente
load_dotenv()

# =============================================
# CONFIGURAÇÃO DO BANCO
# =============================================

# URL do banco - usa a mesma configuração dos seus arquivos existentes
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://agno_user:agno_password@postgres:5432/agno_db")
ASYNC_DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")

# Create async engine com configuração otimizada (mesma do seu app.py)
engine = create_async_engine(
    ASYNC_DATABASE_URL,
    echo=False,  # Desabilitar logs SQL verbosos
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
    pool_recycle=3600
)

# Async session maker (mesmo do seu app.py)
async_session = async_sessionmaker(engine, expire_on_commit=False)

# Base para modelos SQLAlchemy
Base = declarative_base()

# =============================================
# DEPENDENCY FUNCTION
# =============================================


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency para obter sessão do banco"""
    async with async_session() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()