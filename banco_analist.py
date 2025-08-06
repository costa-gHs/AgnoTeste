# database_export.py
import asyncpg
import pandas as pd
import asyncio
import os
from datetime import datetime


async def export_database_to_csv():
    """Exporta todas as tabelas relevantes do banco para CSVs"""

    # Configuração do banco - AJUSTE CONFORME SEU SETUP
    DATABASE_CONFIG = {
        'host': 'localhost',  # ou seu host
        'port': 5432,
        'database': 'agno_db',  # ou nome do seu banco
        'user': 'agno_user',  # ou seu usuário
        'password': 'agno_password'  # ou sua senha
    }

    # Ou use uma connection string completa:
    # DATABASE_URL = "postgresql://user:password@localhost:5432/agno_db"

    try:
        # Conectar ao banco
        print("🔌 Conectando ao banco...")
        conn = await asyncpg.connect(**DATABASE_CONFIG)
        # Ou: conn = await asyncpg.connect(DATABASE_URL)

        # Criar diretório para CSVs
        export_dir = f"database_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        os.makedirs(export_dir, exist_ok=True)

        # Tabelas para exportar
        tables_to_export = [
            'agno_agents',
            'agno_chat_sessions',
            'agno_users',
            'agno_workflows',
            'agno_system_settings',
            'agno_agent_templates'
        ]

        print(f"📁 Exportando para: {export_dir}/")

        for table_name in tables_to_export:
            try:
                print(f"📋 Exportando tabela: {table_name}")

                # Verificar se tabela existe
                exists = await conn.fetchval(
                    "SELECT EXISTS (SELECT FROM pg_tables WHERE tablename = $1)",
                    table_name
                )

                if not exists:
                    print(f"⚠️  Tabela {table_name} não existe - pulando")
                    continue

                # Buscar todos os dados
                rows = await conn.fetch(f"SELECT * FROM {table_name}")

                if not rows:
                    print(f"📭 Tabela {table_name} está vazia")
                    # Criar CSV vazio com estrutura
                    columns = await conn.fetch(
                        """
                        SELECT column_name 
                        FROM information_schema.columns 
                        WHERE table_name = $1 
                        ORDER BY ordinal_position
                        """,
                        table_name
                    )
                    df = pd.DataFrame(columns=[col['column_name'] for col in columns])
                else:
                    # Converter para DataFrame
                    df = pd.DataFrame(rows)

                # Salvar CSV
                csv_path = f"{export_dir}/{table_name}.csv"
                df.to_csv(csv_path, index=False, encoding='utf-8')

                print(f"✅ {table_name}: {len(df)} registros → {csv_path}")

            except Exception as e:
                print(f"❌ Erro ao exportar {table_name}: {e}")

        # Exportar informações do schema
        print("📊 Exportando informações do schema...")

        # Estrutura das tabelas
        schema_info = await conn.fetch("""
            SELECT 
                table_name,
                column_name,
                data_type,
                is_nullable,
                column_default
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name LIKE 'agno_%'
            ORDER BY table_name, ordinal_position
        """)

        schema_df = pd.DataFrame(schema_info)
        schema_df.to_csv(f"{export_dir}/schema_info.csv", index=False)

        # Contagem de registros por tabela
        counts_info = []
        for table_name in tables_to_export:
            try:
                count = await conn.fetchval(f"SELECT COUNT(*) FROM {table_name}")
                counts_info.append({
                    'table_name': table_name,
                    'record_count': count
                })
            except:
                counts_info.append({
                    'table_name': table_name,
                    'record_count': 'N/A'
                })

        counts_df = pd.DataFrame(counts_info)
        counts_df.to_csv(f"{export_dir}/table_counts.csv", index=False)

        # Resumo das ferramentas por agente
        try:
            tools_summary = await conn.fetch("""
                SELECT 
                    id,
                    name,
                    model_provider,
                    model_id,
                    tools,
                    is_active,
                    created_at
                FROM agno_agents 
                ORDER BY id
            """)

            tools_df = pd.DataFrame(tools_summary)
            tools_df.to_csv(f"{export_dir}/agents_tools_summary.csv", index=False)
            print(f"✅ Resumo de ferramentas salvo")

        except Exception as e:
            print(f"⚠️  Não foi possível exportar resumo de ferramentas: {e}")

        await conn.close()

        print(f"\n🎉 Exportação concluída!")
        print(f"📁 Arquivos salvos em: {export_dir}/")
        print(f"📋 Tabelas exportadas: {len([f for f in os.listdir(export_dir) if f.endswith('.csv')])}")

        # Listar arquivos criados
        print("\n📄 Arquivos gerados:")
        for file in sorted(os.listdir(export_dir)):
            size = os.path.getsize(f"{export_dir}/{file}")
            print(f"  - {file} ({size} bytes)")

        return export_dir

    except Exception as e:
        print(f"❌ Erro geral: {e}")
        print("💡 Verifique:")
        print("   - Configurações do banco (host, porta, usuário, senha)")
        print("   - Se o PostgreSQL está rodando")
        print("   - Se o banco 'agno_db' existe")
        return None


def print_connection_help():
    """Imprime ajuda para configurar conexão"""
    print("""
🔧 CONFIGURAÇÃO DA CONEXÃO COM BANCO

1. Abra o arquivo database_export.py
2. Edite a seção DATABASE_CONFIG:

DATABASE_CONFIG = {
    'host': 'SEU_HOST',        # ex: 'localhost' ou IP do servidor
    'port': SUA_PORTA,         # ex: 5432
    'database': 'SEU_BANCO',   # ex: 'agno_db'
    'user': 'SEU_USUARIO',     # ex: 'postgres'
    'password': 'SUA_SENHA'    # sua senha do postgres
}

3. Ou use uma connection string:
DATABASE_URL = "postgresql://usuario:senha@host:porta/banco"

4. Execute o script:
python database_export.py
""")


if __name__ == "__main__":
    print("🚀 Iniciando exportação do banco de dados...")
    print_connection_help()

    try:
        export_dir = asyncio.run(export_database_to_csv())

        if export_dir:
            print(f"\n✅ SUCESSO! Envie os arquivos da pasta '{export_dir}' para análise.")
        else:
            print("\n❌ Falha na exportação. Verifique as configurações.")

    except KeyboardInterrupt:
        print("\n⏹️  Exportação cancelada pelo usuário")
    except Exception as e:
        print(f"\n💥 Erro inesperado: {e}")