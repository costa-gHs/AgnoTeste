#!/usr/bin/env python3
# backend/migrate_database.py - Script Python para aplicar correções no banco

import asyncio
import sys
import os
from pathlib import Path
from datetime import datetime
import logging

# Configurar logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Adicionar o diretório backend ao path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))


async def run_migration():
    """Executa as migrações necessárias no banco de dados"""

    logger.info("=" * 60)
    logger.info("🚀 INICIANDO MIGRAÇÃO DO BANCO DE DADOS")
    logger.info("=" * 60)

    engine = None  # Inicializar variável

    try:
        # Importar dependências
        from sqlalchemy import text, inspect, Column, Integer
        from sqlalchemy.ext.asyncio import create_async_engine

        # 🔴 CORREÇÃO: Garantir que estamos usando o driver asyncpg
        DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://agno_user:agno_password@localhost:5432/agno_db")

        # Corrigir URL se estiver usando psycopg2
        if "postgresql://" in DATABASE_URL and "+asyncpg" not in DATABASE_URL:
            # Substituir postgresql:// por postgresql+asyncpg://
            DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")
            logger.info(f"📝 URL corrigida para usar asyncpg: {DATABASE_URL.split('@')[1]}")  # Log sem senha

        # Se estiver usando psycopg2 explicitamente, trocar
        if "postgresql+psycopg2://" in DATABASE_URL:
            DATABASE_URL = DATABASE_URL.replace("postgresql+psycopg2://", "postgresql+asyncpg://")
            logger.info("📝 Trocado psycopg2 por asyncpg")

        # Criar engine
        engine = create_async_engine(DATABASE_URL, echo=False)

        async with engine.begin() as conn:
            logger.info("✅ Conectado ao banco de dados")

            # 1. CRIAR TABELA DE USUÁRIOS SE NÃO EXISTIR
            logger.info("\n1️⃣ Verificando/Criando tabela de usuários...")
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    username VARCHAR(50) UNIQUE NOT NULL,
                    email VARCHAR(255) UNIQUE NOT NULL,
                    full_name VARCHAR(255),
                    is_active BOOLEAN DEFAULT true,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                )
            """))

            # Inserir usuário padrão
            await conn.execute(text("""
                INSERT INTO users (id, username, email, full_name, is_active) 
                VALUES (1, 'default', 'default@agno.ai', 'Default User', true)
                ON CONFLICT (id) DO NOTHING
            """))
            logger.info("✅ Tabela users verificada")

            # 2. ADICIONAR COLUNAS user_id SE NÃO EXISTIREM
            logger.info("\n2️⃣ Adicionando colunas user_id faltantes...")

            tables_to_add_user_id = ['agents', 'teams', 'conversations']

            for table in tables_to_add_user_id:
                # Verificar se a tabela existe
                result = await conn.execute(text(f"""
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_name = '{table}'
                    )
                """))
                table_exists = result.scalar()

                if table_exists:
                    # Verificar se a coluna user_id existe
                    result = await conn.execute(text(f"""
                        SELECT EXISTS (
                            SELECT FROM information_schema.columns 
                            WHERE table_name = '{table}' 
                            AND column_name = 'user_id'
                        )
                    """))
                    column_exists = result.scalar()

                    if not column_exists:
                        await conn.execute(text(f"""
                            ALTER TABLE {table} 
                            ADD COLUMN user_id INTEGER DEFAULT 1
                        """))
                        logger.info(f"✅ Adicionada coluna user_id em {table}")
                    else:
                        logger.info(f"ℹ️ Coluna user_id já existe em {table}")

            # 3. REMOVER COLUNA agent_id DE rag_indexes SE EXISTIR
            logger.info("\n3️⃣ Removendo coluna conflitante agent_id de rag_indexes...")

            # Verificar se a tabela rag_indexes existe
            result = await conn.execute(text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'rag_indexes'
                )
            """))

            if result.scalar():
                # Verificar se a coluna agent_id existe
                result = await conn.execute(text("""
                    SELECT EXISTS (
                        SELECT FROM information_schema.columns 
                        WHERE table_name = 'rag_indexes' 
                        AND column_name = 'agent_id'
                    )
                """))

                if result.scalar():
                    await conn.execute(text("""
                        ALTER TABLE rag_indexes 
                        DROP COLUMN agent_id
                    """))
                    logger.info("✅ Removida coluna agent_id de rag_indexes")
                else:
                    logger.info("ℹ️ Coluna agent_id já foi removida de rag_indexes")

            # 4. RENOMEAR COLUNAS metadata PARA EVITAR CONFLITOS
            logger.info("\n4️⃣ Renomeando colunas 'metadata' reservadas...")

            # Renomear em team_executions
            result = await conn.execute(text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_name = 'team_executions' 
                    AND column_name = 'metadata'
                )
            """))

            if result.scalar():
                await conn.execute(text("""
                    ALTER TABLE team_executions 
                    RENAME COLUMN metadata TO execution_metadata
                """))
                logger.info("✅ Renomeada coluna metadata para execution_metadata em team_executions")

            # Renomear em messages
            result = await conn.execute(text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_name = 'messages' 
                    AND column_name = 'metadata'
                )
            """))

            if result.scalar():
                await conn.execute(text("""
                    ALTER TABLE messages 
                    RENAME COLUMN metadata TO message_metadata
                """))
                logger.info("✅ Renomeada coluna metadata para message_metadata em messages")

            # 5. CRIAR ÍNDICES PARA MELHORAR PERFORMANCE
            logger.info("\n5️⃣ Criando índices para melhorar performance...")

            indices = [
                ("idx_agents_user_id", "agents", "user_id"),
                ("idx_teams_user_id", "teams", "user_id"),
                ("idx_conversations_user_id", "conversations", "user_id"),
                ("idx_agents_rag_index_id", "agents", "rag_index_id"),
                ("idx_teams_supervisor_agent_id", "teams", "supervisor_agent_id"),
            ]

            for index_name, table_name, column_name in indices:
                # Verificar se a tabela existe
                result = await conn.execute(text(f"""
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_name = '{table_name}'
                    )
                """))

                if result.scalar():
                    await conn.execute(text(f"""
                        CREATE INDEX IF NOT EXISTS {index_name} 
                        ON {table_name}({column_name})
                    """))
                    logger.info(f"✅ Índice {index_name} criado/verificado")

            # 6. ADICIONAR CONSTRAINTS
            logger.info("\n6️⃣ Adicionando constraints de integridade...")

            # Constraint para team_type
            result = await conn.execute(text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.table_constraints 
                    WHERE constraint_name = 'check_team_type'
                )
            """))

            if not result.scalar():
                result = await conn.execute(text("""
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_name = 'teams'
                    )
                """))

                if result.scalar():
                    await conn.execute(text("""
                        ALTER TABLE teams 
                        ADD CONSTRAINT check_team_type 
                        CHECK (team_type IN ('collaborative', 'hierarchical', 'sequential'))
                    """))
                    logger.info("✅ Constraint check_team_type adicionada")

            # 7. CRIAR TRIGGERS PARA updated_at
            logger.info("\n7️⃣ Criando triggers para atualizar updated_at...")

            await conn.execute(text("""
                CREATE OR REPLACE FUNCTION update_updated_at_column()
                RETURNS TRIGGER AS $$
                BEGIN
                    NEW.updated_at = CURRENT_TIMESTAMP;
                    RETURN NEW;
                END;
                $$ language 'plpgsql'
            """))

            trigger_tables = ['agents', 'teams', 'rag_indexes', 'conversations']

            for table in trigger_tables:
                # Verificar se a tabela existe
                result = await conn.execute(text(f"""
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_name = '{table}'
                    )
                """))

                if result.scalar():
                    trigger_name = f"update_{table}_updated_at"
                    await conn.execute(text(f"""
                        DROP TRIGGER IF EXISTS {trigger_name} ON {table}
                    """))
                    await conn.execute(text(f"""
                        CREATE TRIGGER {trigger_name} 
                        BEFORE UPDATE ON {table} 
                        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
                    """))
                    logger.info(f"✅ Trigger {trigger_name} criado")

            # 8. CRIAR TABELAS DO SQLALCHEMY SE NÃO EXISTIREM
            logger.info("\n8️⃣ Criando tabelas do SQLAlchemy...")

            try:
                # Importar modelos
                from models.database import Base
                from models.agents import (
                    Agent, Tool, AgentTool, RAGIndex, RAGDocument, RAGChunk,
                    Team, TeamAgent, TeamExecution, Conversation, Message
                )

                # Criar tabelas
                await conn.run_sync(Base.metadata.create_all)
                logger.info("✅ Tabelas do SQLAlchemy criadas/verificadas")
            except ImportError as e:
                logger.warning(f"⚠️ Não foi possível importar modelos: {e}")
                logger.info("   As tabelas serão criadas quando o servidor iniciar")

            # 9. INSERIR DADOS DE TESTE
            logger.info("\n9️⃣ Inserindo dados de teste...")

            # Verificar se já existem agentes
            result = await conn.execute(text("SELECT COUNT(*) FROM agents"))
            count = result.scalar()

            if count == 0:
                await conn.execute(text("""
                    INSERT INTO agents (id, user_id, name, role, model_provider, model_id, instructions, is_active)
                    VALUES 
                        ('agent-1', 1, 'Assistente Geral', 'General Assistant', 'openai', 'gpt-4', '["Seja útil e prestativo"]'::jsonb, true),
                        ('agent-2', 1, 'Especialista em Código', 'Code Expert', 'anthropic', 'claude-3-sonnet', '["Foque em qualidade de código"]'::jsonb, true)
                """))
                logger.info("✅ Agentes de teste inseridos")

            # Verificar se já existem teams
            result = await conn.execute(text("SELECT COUNT(*) FROM teams"))
            count = result.scalar()

            if count == 0:
                await conn.execute(text("""
                    INSERT INTO teams (id, user_id, name, description, team_type, is_active)
                    VALUES 
                        ('team-1', 1, 'Time de Desenvolvimento', 'Time para tarefas de programação', 'collaborative', true)
                """))

                await conn.execute(text("""
                    INSERT INTO team_agents (team_id, agent_id, role_in_team, priority, is_active)
                    VALUES 
                        ('team-1', 'agent-1', 'coordinator', 1, true),
                        ('team-1', 'agent-2', 'specialist', 2, true)
                    ON CONFLICT DO NOTHING
                """))
                logger.info("✅ Time de teste inserido")

            logger.info("\n" + "=" * 60)
            logger.info("✅ MIGRAÇÃO CONCLUÍDA COM SUCESSO!")
            logger.info("=" * 60)

            # Estatísticas finais
            logger.info("\n📊 Estatísticas do banco:")

            for table in ['users', 'agents', 'teams', 'team_agents']:
                result = await conn.execute(text(f"""
                    SELECT COUNT(*) FROM {table}
                    WHERE EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_name = '{table}'
                    )
                """))
                count = result.scalar()
                if count is not None:
                    logger.info(f"   - {table}: {count} registros")

            return True

    except ImportError as e:
        logger.error(f"❌ ERRO DE IMPORTAÇÃO: {e}")
        logger.error("Instale o asyncpg: pip install asyncpg")
        return False
    except Exception as e:
        logger.error(f"❌ ERRO NA MIGRAÇÃO: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return False
    finally:
        if engine is not None:
            await engine.dispose()


async def verify_migration():
    """Verifica se a migração foi aplicada corretamente"""

    logger.info("\n" + "=" * 60)
    logger.info("🔍 VERIFICANDO MIGRAÇÃO")
    logger.info("=" * 60)

    try:
        # Testar imports
        logger.info("\n1️⃣ Testando imports dos modelos...")
        from models.agents import Agent, Team, TeamExecution
        logger.info("✅ Imports OK")

        # Testar conexão
        logger.info("\n2️⃣ Testando conexão com banco...")
        from models.database import async_session
        from sqlalchemy import select
        from sqlalchemy.orm import selectinload

        async with async_session() as db:
            # Testar query com relacionamentos
            query = select(Agent).options(
                selectinload(Agent.agent_tools),
                selectinload(Agent.rag_index)
            ).limit(1)

            result = await db.execute(query)
            agents = result.scalars().all()
            logger.info(f"✅ Query executada com sucesso! {len(agents)} agentes encontrados")

        return True

    except Exception as e:
        logger.error(f"❌ Erro na verificação: {e}")
        return False


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description='Script de migração do banco de dados')
    parser.add_argument('--verify-only', action='store_true', help='Apenas verifica sem aplicar migração')
    args = parser.parse_args()

    # Verificar se asyncpg está instalado
    try:
        import asyncpg
    except ImportError:
        logger.error("❌ asyncpg não está instalado!")
        logger.error("Execute: pip install asyncpg")
        sys.exit(1)

    if args.verify_only:
        success = asyncio.run(verify_migration())
    else:
        success = asyncio.run(run_migration())
        if success:
            logger.info("\n🔍 Verificando migração...")
            success = asyncio.run(verify_migration())

    if success:
        logger.info("\n✅ Tudo pronto! Reinicie o servidor com: python app.py")
    else:
        logger.error("\n❌ Migração falhou. Verifique os logs acima.")

    sys.exit(0 if success else 1)