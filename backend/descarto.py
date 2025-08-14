#!/usr/bin/env python3
"""
🔧 AGNO - Correção da coluna is_active faltante
Script para adicionar coluna is_active na tabela agno_team_agents

Uso:
    python fix_missing_column.py
"""

import asyncio
import asyncpg
import os

# Configuração
DATABASE_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'database': 'agno_db',
    'user': 'agno_user',
    'password': 'agno_password'
}

DATABASE_URL = f"postgresql://{DATABASE_CONFIG['user']}:{DATABASE_CONFIG['password']}@{DATABASE_CONFIG['host']}:{DATABASE_CONFIG['port']}/{DATABASE_CONFIG['database']}"


async def fix_missing_column():
    """Corrige a coluna is_active faltante"""
    try:
        conn = await asyncpg.connect(DATABASE_URL)
        print("🔗 Conectado ao banco!")

        # 1. Verificar se coluna existe
        print("🔍 Verificando se coluna is_active existe...")
        column_exists = await conn.fetchval("""
            SELECT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'agno_team_agents' 
                AND column_name = 'is_active'
            )
        """)

        if column_exists:
            print("✅ Coluna is_active já existe!")
        else:
            print("❌ Coluna is_active não existe. Adicionando...")

            # Adicionar coluna
            await conn.execute("""
                ALTER TABLE agno_team_agents 
                ADD COLUMN is_active BOOLEAN DEFAULT true
            """)

            print("✅ Coluna is_active adicionada!")

            # Atualizar registros existentes
            await conn.execute("""
                UPDATE agno_team_agents 
                SET is_active = true 
                WHERE is_active IS NULL
            """)

            print("✅ Registros existentes atualizados!")

        # 2. Criar índices que falharam
        print("🔧 Criando índices faltantes...")

        index_queries = [
            "CREATE INDEX IF NOT EXISTS idx_agno_team_agents_active ON agno_team_agents(is_active);",
            "CREATE INDEX IF NOT EXISTS idx_agno_teams_active ON agno_teams(is_active);",
            "CREATE INDEX IF NOT EXISTS idx_agno_teams_user_id ON agno_teams(user_id);",
            "CREATE INDEX IF NOT EXISTS idx_agno_team_agents_team_id ON agno_team_agents(team_id);",
            "CREATE INDEX IF NOT EXISTS idx_agno_team_agents_agent_id ON agno_team_agents(agent_id);"
        ]

        for query in index_queries:
            try:
                await conn.execute(query)
                print(f"✅ Índice criado: {query.split('idx_')[1].split(' ')[0]}")
            except Exception as e:
                print(f"⚠️  Erro no índice: {e}")

        # 3. Testar query problemática
        print("\n🧪 Testando query da API...")
        try:
            result = await conn.fetch("""
                SELECT t.id, t.name, t.description, t.team_type, t.is_active,
                       t.created_at, t.updated_at, t.team_configuration,
                       COUNT(ta.agent_id) as agent_count,
                       s.name as supervisor_name
                FROM agno_teams t
                LEFT JOIN agno_team_agents ta ON t.id = ta.team_id AND ta.is_active = true
                LEFT JOIN agno_agents s ON t.supervisor_agent_id = s.id
                WHERE t.user_id = $1 AND t.is_active = true
                GROUP BY t.id, s.name
                ORDER BY t.updated_at DESC
                LIMIT 10
            """, 1)

            print(f"✅ Query funcionando! Retornou {len(result)} teams")

            if result:
                print("\n📋 Teams encontrados:")
                for team in result:
                    print(f"  - {team['name']}: {team['agent_count']} agentes ({team['team_type']})")
            else:
                print("ℹ️  Nenhum team encontrado (normal se não há dados)")

        except Exception as e:
            print(f"❌ Query ainda falhando: {e}")

        # 4. Verificar estrutura final
        print("\n📊 Verificando estrutura da tabela agno_team_agents:")
        columns = await conn.fetch("""
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'agno_team_agents'
            ORDER BY ordinal_position
        """)

        for col in columns:
            print(f"  - {col['column_name']}: {col['data_type']} (nullable: {col['is_nullable']})")

        await conn.close()

        print("\n🎉 CORREÇÃO CONCLUÍDA!")
        print("👉 Agora reinicie o backend: docker-compose restart backend")
        print("🌐 Teste o frontend: http://localhost:3000")

    except Exception as e:
        print(f"❌ Erro na correção: {e}")


if __name__ == "__main__":
    asyncio.run(fix_missing_column())