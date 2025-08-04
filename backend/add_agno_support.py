# backend/migrations/add_agno_support.py

"""
Migration para adicionar suporte ao Agno nas tabelas existentes
Execute: python -m backend.migrations.add_agno_support
"""

import asyncio
import sys
import os
from pathlib import Path
from datetime import datetime

# Adicionar o diretório raiz ao path
sys.path.append(str(Path(__file__).parent.parent.parent))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from backend.database import DATABASE_URL, engine
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def add_agno_support_to_existing_tables():
    """Adiciona suporte ao Agno nas tabelas existentes"""
    try:
        logger.info("🔧 Adicionando suporte ao Agno nas tabelas existentes...")

        async with engine.begin() as conn:
            # Verificar se as tabelas existem
            result = await conn.execute(text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name IN ('agno_agents', 'agno_chat_sessions')
            """))

            existing_tables = [row[0] for row in result.fetchall()]
            logger.info(f"✅ Tabelas encontradas: {existing_tables}")

            if 'agno_agents' not in existing_tables:
                logger.error("❌ Tabela agno_agents não encontrada")
                return False

            # 1. Verificar e adicionar colunas na tabela agno_agents se necessário
            logger.info("🔍 Verificando colunas da tabela agno_agents...")

            columns_result = await conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'agno_agents' AND table_schema = 'public'
            """))

            existing_columns = [row[0] for row in columns_result.fetchall()]
            logger.info(f"📋 Colunas existentes: {existing_columns}")

            # Colunas necessárias para o Agno
            required_columns = {
                'agno_tools_config': 'JSONB DEFAULT \'{}\'::jsonb',
                'agno_enabled': 'BOOLEAN DEFAULT false',
                'last_execution': 'TIMESTAMP',
                'execution_count': 'INTEGER DEFAULT 0',
                'agno_version': 'VARCHAR(50)',
                'streaming_enabled': 'BOOLEAN DEFAULT true'
            }

            # Adicionar colunas que não existem
            for column_name, column_def in required_columns.items():
                if column_name not in existing_columns:
                    logger.info(f"➕ Adicionando coluna {column_name}...")

                    alter_query = f"""
                        ALTER TABLE agno_agents 
                        ADD COLUMN {column_name} {column_def}
                    """

                    await conn.execute(text(alter_query))
                    logger.info(f"✅ Coluna {column_name} adicionada")
                else:
                    logger.info(f"⚪ Coluna {column_name} já existe")

            # 2. Criar tabela de logs de execução do Agno se não existir
            logger.info("🗄️ Criando tabela de logs de execução do Agno...")

            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS agno_execution_logs (
                    id SERIAL PRIMARY KEY,
                    agent_id INTEGER REFERENCES agno_agents(id) ON DELETE CASCADE,
                    user_id INTEGER NOT NULL,
                    prompt TEXT NOT NULL,
                    response TEXT,
                    tools_used JSONB DEFAULT '[]'::jsonb,
                    execution_time_ms INTEGER,
                    tokens_used INTEGER,
                    model_used VARCHAR(100),
                    status VARCHAR(20) DEFAULT 'success',
                    error_message TEXT,
                    agno_version VARCHAR(50),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

                    -- Índices para performance
                    INDEX idx_agno_logs_agent_id (agent_id),
                    INDEX idx_agno_logs_user_id (user_id),
                    INDEX idx_agno_logs_created_at (created_at),
                    INDEX idx_agno_logs_status (status)
                )
            """))
            logger.info("✅ Tabela agno_execution_logs criada/verificada")

            # 3. Criar tabela de ferramentas disponíveis
            logger.info("🔧 Criando tabela de ferramentas Agno...")

            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS agno_available_tools (
                    id SERIAL PRIMARY KEY,
                    tool_name VARCHAR(100) UNIQUE NOT NULL,
                    display_name VARCHAR(200) NOT NULL,
                    description TEXT,
                    category VARCHAR(50),
                    class_path VARCHAR(300),
                    config_schema JSONB DEFAULT '{}'::jsonb,
                    dependencies JSONB DEFAULT '[]'::jsonb,
                    is_available BOOLEAN DEFAULT true,
                    requires_api_key BOOLEAN DEFAULT false,
                    api_key_env_var VARCHAR(100),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

                    INDEX idx_agno_tools_name (tool_name),
                    INDEX idx_agno_tools_category (category),
                    INDEX idx_agno_tools_available (is_available)
                )
            """))
            logger.info("✅ Tabela agno_available_tools criada/verificada")

            # 4. Popular tabela de ferramentas com ferramentas padrão do Agno
            logger.info("📦 Populando ferramentas padrão do Agno...")

            default_tools = [
                {
                    'tool_name': 'duckduckgo',
                    'display_name': 'DuckDuckGo Search',
                    'description': 'Pesquisa na web com foco em privacidade',
                    'category': 'web_search',
                    'class_path': 'agno.tools.duckduckgo.DuckDuckGoTools',
                    'dependencies': '["duckduckgo-search"]',
                    'requires_api_key': False
                },
                {
                    'tool_name': 'yfinance',
                    'display_name': 'Yahoo Finance',
                    'description': 'Dados financeiros, preços de ações e análises',
                    'category': 'financial',
                    'class_path': 'agno.tools.yfinance.YFinanceTools',
                    'dependencies': '["yfinance"]',
                    'requires_api_key': False
                },
                {
                    'tool_name': 'calculator',
                    'display_name': 'Calculator',
                    'description': 'Operações matemáticas precisas',
                    'category': 'utilities',
                    'class_path': 'agno.tools.calculator.CalculatorTools',
                    'dependencies': '[]',
                    'requires_api_key': False
                },
                {
                    'tool_name': 'reasoning',
                    'display_name': 'Reasoning Tools',
                    'description': 'Raciocínio estruturado e chain-of-thought',
                    'category': 'reasoning',
                    'class_path': 'agno.tools.reasoning.ReasoningTools',
                    'dependencies': '[]',
                    'requires_api_key': False
                },
                {
                    'tool_name': 'dalle',
                    'display_name': 'DALL-E Image Generation',
                    'description': 'Geração de imagens com IA da OpenAI',
                    'category': 'ai_media',
                    'class_path': 'agno.tools.dalle.DalleTools',
                    'dependencies': '["openai"]',
                    'requires_api_key': True,
                    'api_key_env_var': 'OPENAI_API_KEY'
                },
                {
                    'tool_name': 'google_search',
                    'display_name': 'Google Search',
                    'description': 'Pesquisa programável do Google',
                    'category': 'web_search',
                    'class_path': 'agno.tools.googlesearch.GoogleSearchTools',
                    'dependencies': '["google-api-python-client"]',
                    'requires_api_key': True,
                    'api_key_env_var': 'GOOGLE_API_KEY'
                },
                {
                    'tool_name': 'youtube',
                    'display_name': 'YouTube Tools',
                    'description': 'Extração de transcrições de vídeos',
                    'category': 'ai_media',
                    'class_path': 'agno.tools.youtube.YouTubeTools',
                    'dependencies': '["youtube-transcript-api"]',
                    'requires_api_key': False
                }
            ]

            for tool in default_tools:
                # Verificar se já existe
                check_result = await conn.execute(text("""
                    SELECT id FROM agno_available_tools WHERE tool_name = :tool_name
                """), {"tool_name": tool["tool_name"]})

                if not check_result.fetchone():
                    # Inserir ferramenta
                    insert_query = text("""
                        INSERT INTO agno_available_tools (
                            tool_name, display_name, description, category, class_path,
                            dependencies, requires_api_key, api_key_env_var
                        ) VALUES (
                            :tool_name, :display_name, :description, :category, :class_path,
                            :dependencies::jsonb, :requires_api_key, :api_key_env_var
                        )
                    """)

                    await conn.execute(insert_query, tool)
                    logger.info(f"  ✅ Ferramenta {tool['tool_name']} adicionada")
                else:
                    logger.info(f"  ⚪ Ferramenta {tool['tool_name']} já existe")

            # 5. Atualizar agentes existentes para habilitar Agno
            logger.info("🤖 Atualizando agentes existentes para suporte ao Agno...")

            update_result = await conn.execute(text("""
                UPDATE agno_agents 
                SET 
                    agno_enabled = true,
                    agno_version = 'real_integration_v1.0',
                    streaming_enabled = true,
                    updated_at = CURRENT_TIMESTAMP
                WHERE agno_enabled IS NULL OR agno_enabled = false
            """))

            updated_count = update_result.rowcount
            logger.info(f"✅ {updated_count} agentes atualizados para suporte ao Agno")

            # 6. Criar função para mapear ferramentas do banco para o Agno
            logger.info("🔄 Criando função de mapeamento de ferramentas...")

            await conn.execute(text("""
                CREATE OR REPLACE FUNCTION map_db_tools_to_agno(db_tools JSONB)
                RETURNS JSONB AS $$
                DECLARE
                    result JSONB := '[]'::jsonb;
                    tool TEXT;
                    mapped_tool TEXT;
                BEGIN
                    -- Mapear ferramentas do formato antigo para Agno
                    FOR tool IN SELECT jsonb_array_elements_text(db_tools)
                    LOOP
                        mapped_tool := CASE tool
                            WHEN 'web_search' THEN 'duckduckgo'
                            WHEN 'financial' THEN 'yfinance'
                            WHEN 'calculations' THEN 'calculator'
                            WHEN 'reasoning' THEN 'reasoning'
                            WHEN 'image_generation' THEN 'dalle'
                            WHEN 'code_interpreter' THEN 'reasoning'
                            ELSE tool
                        END;

                        result := result || to_jsonb(mapped_tool);
                    END LOOP;

                    RETURN result;
                END;
                $$ LANGUAGE plpgsql;
            """))
            logger.info("✅ Função de mapeamento criada")

            # 7. Atualizar configurações de ferramentas dos agentes
            logger.info("🔧 Atualizando configurações de ferramentas...")

            await conn.execute(text("""
                UPDATE agno_agents 
                SET agno_tools_config = jsonb_build_object(
                    'agno_tools', map_db_tools_to_agno(COALESCE(tools, '[]'::jsonb)),
                    'original_tools', tools,
                    'mapped_at', CURRENT_TIMESTAMP,
                    'mapping_version', 'v1.0'
                )
                WHERE agno_tools_config = '{}'::jsonb OR agno_tools_config IS NULL
            """))

            logger.info("✅ Configurações de ferramentas atualizadas")

        logger.info("🎉 Suporte ao Agno adicionado com sucesso às tabelas existentes!")
        return True

    except Exception as e:
        logger.error(f"❌ Erro ao adicionar suporte ao Agno: {e}")
        import traceback
        logger.error(f"📍 Traceback: {traceback.format_exc()}")
        return False


async def verify_agno_integration():
    """Verifica se a integração com Agno está funcionando"""
    try:
        logger.info("🔍 Verificando integração com Agno...")

        async with engine.begin() as conn:
            # Verificar colunas adicionadas
            result = await conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'agno_agents' 
                AND column_name IN ('agno_tools_config', 'agno_enabled', 'agno_version')
            """))

            agno_columns = [row[0] for row in result.fetchall()]
            logger.info(f"✅ Colunas Agno encontradas: {agno_columns}")

            # Verificar ferramentas disponíveis
            tools_result = await conn.execute(text("""
                SELECT tool_name, display_name, is_available 
                FROM agno_available_tools 
                ORDER BY category, tool_name
            """))

            tools = tools_result.fetchall()
            logger.info(f"🔧 Ferramentas disponíveis: {len(tools)}")

            for tool in tools:
                status = "✅" if tool.is_available else "❌"
                logger.info(f"  {status} {tool.tool_name} - {tool.display_name}")

            # Verificar agentes com Agno habilitado
            agents_result = await conn.execute(text("""
                SELECT COUNT(*) as total, 
                       COUNT(CASE WHEN agno_enabled = true THEN 1 END) as agno_enabled
                FROM agno_agents 
                WHERE is_active = true
            """))

            agents_stats = agents_result.fetchone()
            logger.info(f"🤖 Agentes: {agents_stats.total} total, {agents_stats.agno_enabled} com Agno habilitado")

            # Verificar logs
            logs_result = await conn.execute(text("""
                SELECT COUNT(*) FROM agno_execution_logs
            """))

            logs_count = logs_result.scalar()
            logger.info(f"📊 Logs de execução: {logs_count}")

        return True

    except Exception as e:
        logger.error(f"❌ Erro na verificação: {e}")
        return False


def create_sample_agent_with_agno():
    """Cria um agente de exemplo com ferramentas Agno"""
    try:
        logger.info("🤖 Criando agente de exemplo com Agno...")

        # Usar engine síncrono para simplificar
        sync_engine = create_engine(DATABASE_URL.replace('+asyncpg', ''))
        SessionLocal = sessionmaker(bind=sync_engine)

        with SessionLocal() as db:
            # Verificar se já existe
            existing = db.execute(text("""
                SELECT id FROM agno_agents WHERE name = 'Assistente Agno Demo'
            """)).fetchone()

            if existing:
                logger.info("⚪ Agente de exemplo já existe")
                return existing.id

            # Criar agente de exemplo
            result = db.execute(text("""
                INSERT INTO agno_agents (
                    user_id, name, description, role, model_provider, model_id,
                    instructions, tools, agno_enabled, agno_version,
                    agno_tools_config, memory_enabled, is_active, created_at
                ) VALUES (
                    1, 
                    'Assistente Agno Demo',
                    'Agente de demonstração com ferramentas Agno reais',
                    'Assistente de demonstração',
                    'openai',
                    'gpt-4o',
                    '["Você é um assistente de demonstração com acesso a ferramentas reais do Agno.", "Use as ferramentas quando apropriado para fornecer informações precisas."]'::jsonb,
                    '["web_search", "financial", "calculations", "reasoning"]'::jsonb,
                    true,
                    'real_integration_v1.0',
                    '{"agno_tools": ["duckduckgo", "yfinance", "calculator", "reasoning"], "demo_agent": true}'::jsonb,
                    true,
                    true,
                    CURRENT_TIMESTAMP
                ) RETURNING id
            """))

            agent_id = result.scalar()
            db.commit()

            logger.info(f"✅ Agente de exemplo criado com ID: {agent_id}")
            return agent_id

    except Exception as e:
        logger.error(f"❌ Erro ao criar agente de exemplo: {e}")
        return None


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Adicionar suporte ao Agno às tabelas existentes")
    parser.add_argument("--add", action="store_true", help="Adicionar suporte ao Agno")
    parser.add_argument("--verify", action="store_true", help="Verificar integração")
    parser.add_argument("--create-demo", action="store_true", help="Criar agente de demonstração")
    parser.add_argument("--all", action="store_true", help="Executar todas as operações")

    args = parser.parse_args()

    if args.all or not any([args.add, args.verify, args.create_demo]):
        # Executar tudo
        success = asyncio.run(add_agno_support_to_existing_tables())
        if success:
            asyncio.run(verify_agno_integration())
            create_sample_agent_with_agno()
    else:
        if args.add:
            asyncio.run(add_agno_support_to_existing_tables())

        if args.verify:
            asyncio.run(verify_agno_integration())

        if args.create_demo:
            create_sample_agent_with_agno()