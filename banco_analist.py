# =====================================
# DATABASE_EXPORT.PY - Exportar Banco para CSV
# =====================================

import asyncio
import pandas as pd
import psycopg2
from sqlalchemy import create_engine, text, inspect
import os
from datetime import datetime
from pathlib import Path
import logging

# Configurar logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# =====================================
# CONFIGURAÇÕES DO BANCO (baseado no docker-compose.yml)
# =====================================

DATABASE_CONFIG = {
    'host': 'localhost',  # ou 'postgres' se rodar dentro do container
    'port': 5432,
    'database': 'agno_db',
    'user': 'agno_user',
    'password': 'agno_password'
}

# URL de conexão
DATABASE_URL = f"postgresql://{DATABASE_CONFIG['user']}:{DATABASE_CONFIG['password']}@{DATABASE_CONFIG['host']}:{DATABASE_CONFIG['port']}/{DATABASE_CONFIG['database']}"


def get_engine():
    """Criar engine do SQLAlchemy"""
    try:
        engine = create_engine(DATABASE_URL)
        return engine
    except Exception as e:
        logger.error(f"Erro ao criar engine: {e}")
        raise


def test_connection():
    """Testar conexão com o banco"""
    try:
        engine = get_engine()
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            row = result.fetchone()
            if row and row[0] == 1:
                logger.info("✅ Conexão com banco de dados OK")
                return True
    except Exception as e:
        logger.error(f"❌ Erro na conexão: {e}")
        return False


def get_all_tables():
    """Obter lista de todas as tabelas"""
    try:
        engine = get_engine()
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        logger.info(f"📋 Tabelas encontradas: {tables}")
        return tables
    except Exception as e:
        logger.error(f"Erro ao obter tabelas: {e}")
        return []


def export_table_to_csv(table_name: str, output_dir: str) -> bool:
    """Exportar uma tabela específica para CSV"""
    try:
        engine = get_engine()

        # Ler dados da tabela
        query = f"SELECT * FROM {table_name}"
        df = pd.read_sql(query, engine)

        # Verificar se tem dados
        if df.empty:
            logger.warning(f"⚠️ Tabela '{table_name}' está vazia")
            return False

        # Nome do arquivo CSV
        csv_file = os.path.join(output_dir, f"{table_name}.csv")

        # Exportar para CSV
        df.to_csv(csv_file, index=False, encoding='utf-8')

        logger.info(f"✅ Tabela '{table_name}' exportada: {len(df)} registros → {csv_file}")
        return True

    except Exception as e:
        logger.error(f"❌ Erro ao exportar tabela '{table_name}': {e}")
        return False


def get_table_info(table_name: str) -> dict:
    """Obter informações detalhadas de uma tabela"""
    try:
        engine = get_engine()
        inspector = inspect(engine)

        # Informações das colunas
        columns = inspector.get_columns(table_name)

        # Contar registros
        with engine.connect() as conn:
            result = conn.execute(text(f"SELECT COUNT(*) FROM {table_name}"))
            count = result.scalar()

        return {
            'table_name': table_name,
            'columns': len(columns),
            'rows': count,
            'column_details': [
                {
                    'name': col['name'],
                    'type': str(col['type']),
                    'nullable': col['nullable'],
                    'primary_key': col.get('primary_key', False)
                }
                for col in columns
            ]
        }
    except Exception as e:
        logger.error(f"Erro ao obter info da tabela '{table_name}': {e}")
        return {}


def generate_database_report(output_dir: str):
    """Gerar relatório geral do banco de dados"""
    try:
        tables = get_all_tables()
        report_data = []

        for table in tables:
            info = get_table_info(table)
            if info:
                report_data.append({
                    'Tabela': info['table_name'],
                    'Colunas': info['columns'],
                    'Registros': info['rows'],
                    'Detalhes_Colunas': str(info['column_details'])
                })

        # Criar DataFrame do relatório
        df_report = pd.DataFrame(report_data)

        # Salvar relatório
        report_file = os.path.join(output_dir, "database_report.csv")
        df_report.to_csv(report_file, index=False, encoding='utf-8')

        logger.info(f"📊 Relatório geral salvo: {report_file}")
        return True

    except Exception as e:
        logger.error(f"Erro ao gerar relatório: {e}")
        return False


def export_custom_queries(output_dir: str):
    """Executar consultas customizadas e exportar resultados"""

    custom_queries = {
        # Exemplos de consultas úteis
        'usuarios_ativos': """
            SELECT 
                id,
                name as nome,
                email,
                phone as telefone,
                is_active as ativo,
                created_at as criado_em
            FROM users 
            WHERE is_active = true
            ORDER BY created_at DESC
        """,

        'produtos_por_categoria': """
            SELECT 
                category as categoria,
                COUNT(*) as total_produtos,
                AVG(price) as preco_medio,
                SUM(stock) as estoque_total
            FROM products 
            WHERE is_available = true
            GROUP BY category
            ORDER BY total_produtos DESC
        """,

        'relatorio_vendas': """
            SELECT 
                u.name as proprietario,
                u.email,
                p.name as produto,
                p.category as categoria,
                p.price as preco,
                p.stock as estoque,
                p.created_at as criado_em
            FROM products p
            JOIN users u ON p.owner_id = u.id
            WHERE p.is_available = true
            ORDER BY p.created_at DESC
        """
    }

    try:
        engine = get_engine()

        for query_name, query_sql in custom_queries.items():
            try:
                df = pd.read_sql(query_sql, engine)

                if not df.empty:
                    csv_file = os.path.join(output_dir, f"relatorio_{query_name}.csv")
                    df.to_csv(csv_file, index=False, encoding='utf-8')
                    logger.info(f"📋 Relatório '{query_name}' gerado: {len(df)} registros")
                else:
                    logger.warning(f"⚠️ Consulta '{query_name}' não retornou dados")

            except Exception as e:
                logger.error(f"Erro na consulta '{query_name}': {e}")

    except Exception as e:
        logger.error(f"Erro geral nas consultas customizadas: {e}")


def main():
    """Função principal"""
    print("🚀 Iniciando exportação do banco de dados para CSV...")

    # Testar conexão
    if not test_connection():
        print("❌ Falha na conexão. Verifique as configurações do banco.")
        return False

    # Criar diretório de saída
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_dir = f"export_agno_db_{timestamp}"
    Path(output_dir).mkdir(exist_ok=True)

    print(f"📁 Diretório de saída: {output_dir}")

    # Obter todas as tabelas
    tables = get_all_tables()

    if not tables:
        print("❌ Nenhuma tabela encontrada no banco.")
        return False

    # Exportar cada tabela
    success_count = 0
    for table in tables:
        if export_table_to_csv(table, output_dir):
            success_count += 1

    # Gerar relatório geral
    generate_database_report(output_dir)

    # Gerar relatórios customizados
    export_custom_queries(output_dir)

    # Resumo final
    print(f"\n📊 RESUMO DA EXPORTAÇÃO:")
    print(f"   • Tabelas encontradas: {len(tables)}")
    print(f"   • Tabelas exportadas: {success_count}")
    print(f"   • Diretório: {output_dir}")
    print(f"   • Arquivos gerados:")

    # Listar arquivos gerados
    for file in sorted(Path(output_dir).glob("*.csv")):
        file_size = file.stat().st_size / 1024  # KB
        print(f"     - {file.name} ({file_size:.1f} KB)")

    print(f"\n✅ Exportação concluída com sucesso!")
    return True


# =====================================
# SCRIPT PARA EXECUTAR CONSULTAS ESPECÍFICAS
# =====================================

def run_specific_query(query: str, filename: str = None):
    """Executar consulta específica e salvar em CSV"""
    try:
        engine = get_engine()
        df = pd.read_sql(query, engine)

        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"consulta_customizada_{timestamp}.csv"

        df.to_csv(filename, index=False, encoding='utf-8')
        print(f"✅ Consulta executada e salva em: {filename}")
        print(f"📊 Registros encontrados: {len(df)}")

        # Mostrar preview dos dados
        if len(df) > 0:
            print("\n📋 Preview dos dados:")
            print(df.head().to_string(index=False))

        return True

    except Exception as e:
        print(f"❌ Erro ao executar consulta: {e}")
        return False


# =====================================
# EXEMPLOS DE USO
# =====================================

if __name__ == "__main__":
    print("=" * 50)
    print("🗄️ AGNO DATABASE EXPORT TOOL")
    print("=" * 50)

    # Opção 1: Exportação completa
    print("\n1️⃣ Exportação completa do banco de dados:")
    main()

    print("\n" + "=" * 50)

    # Opção 2: Consulta específica (exemplo)
    print("\n2️⃣ Exemplo de consulta específica:")

    consulta_exemplo = """
    SELECT 
        u.name as usuario_nome,
        u.email,
        COUNT(p.id) as total_produtos,
        COALESCE(SUM(p.price * p.stock), 0) as valor_estoque
    FROM users u
    LEFT JOIN products p ON u.id = p.owner_id AND p.is_available = true
    GROUP BY u.id, u.name, u.email
    ORDER BY valor_estoque DESC
    """

    run_specific_query(consulta_exemplo, "relatorio_usuarios_produtos.csv")

    print("\n🎉 Processo concluído!")

# =====================================
# INSTRUÇÕES DE USO
# =====================================

"""
📝 COMO USAR ESTE SCRIPT:

1. Instalar dependências:
   pip install pandas psycopg2-binary sqlalchemy

2. Verificar se o banco está rodando:
   docker-compose ps

3. Executar o script:
   python database_export.py

4. Os arquivos CSV serão gerados na pasta:
   export_agno_db_YYYYMMDD_HHMMSS/

5. Para consultas específicas, edite a função run_specific_query()

⚠️ IMPORTANTE:
- Certifique-se que o PostgreSQL está rodando
- Ajuste as configurações de conexão se necessário
- O script pode demorar dependendo do tamanho do banco
"""