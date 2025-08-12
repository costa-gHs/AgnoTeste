#!/usr/bin/env python3
"""
test_import_variations.py - Testa várias maneiras de fazer os imports problemáticos

Execute de qualquer lugar:
    python test_import_variations.py
"""

import sys
import os
from pathlib import Path


def find_project_root():
    """Encontra a raiz do projeto automaticamente"""
    current = Path.cwd()

    if (current / "backend").exists():
        return current

    if current.name == "backend":
        return current.parent

    for parent in current.parents:
        if (parent / "backend").exists():
            return parent

    return None


def test_import_variations():
    """Testa diferentes maneiras de fazer os imports problemáticos"""

    project_root = find_project_root()
    if not project_root:
        print("❌ Não encontrei a raiz do projeto")
        return

    print(f"📁 Raiz: {project_root}")

    # Adicionar ao PYTHONPATH
    if str(project_root) not in sys.path:
        sys.path.insert(0, str(project_root))
        print(f"✅ Adicionado ao PYTHONPATH")

    print("\n" + "=" * 60)
    print("🧪 TESTANDO VARIAÇÕES DE IMPORT PARA get_db")
    print("=" * 60)

    # Variações para get_db
    get_db_variations = [
        "from backend.database import get_db",
        "from database import get_db",
        "from backend.models.database import get_db",
        "from models.database import get_db",
        "from app.database import get_db",
        "from ..database import get_db",
        "from ...database import get_db"
    ]

    working_get_db = []

    for i, import_statement in enumerate(get_db_variations, 1):
        try:
            # Limpar imports anteriores
            modules_to_clear = [m for m in sys.modules.keys() if 'database' in m or 'get_db' in m]
            for m in modules_to_clear:
                if m in sys.modules:
                    del sys.modules[m]

            # Tentar o import
            exec(import_statement)
            print(f"✅ {i}. {import_statement}")
            working_get_db.append(import_statement)

        except ImportError as e:
            print(f"❌ {i}. {import_statement} - ImportError: {e}")
        except Exception as e:
            print(f"⚠️ {i}. {import_statement} - Erro: {e}")

    print("\n" + "=" * 60)
    print("🧪 TESTANDO VARIAÇÕES DE IMPORT PARA Agent, AgentTool, RAGIndex")
    print("=" * 60)

    # Variações para models
    model_variations = [
        "from backend.models.agents import Agent, AgentTool, RAGIndex",
        "from models.agents import Agent, AgentTool, RAGIndex",
        "from backend.models import Agent, AgentTool, RAGIndex",
        "from models import Agent, AgentTool, RAGIndex",
        "from app.models.agents import Agent, AgentTool, RAGIndex",
        "from ..models.agents import Agent, AgentTool, RAGIndex",
        "from ...models.agents import Agent, AgentTool, RAGIndex"
    ]

    working_models = []

    for i, import_statement in enumerate(model_variations, 1):
        try:
            # Limpar imports anteriores
            modules_to_clear = [m for m in sys.modules.keys() if 'agents' in m or 'models' in m]
            for m in modules_to_clear:
                if m in sys.modules:
                    del sys.modules[m]

            # Tentar o import
            exec(import_statement)
            print(f"✅ {i}. {import_statement}")
            working_models.append(import_statement)

        except ImportError as e:
            print(f"❌ {i}. {import_statement} - ImportError: {e}")
        except Exception as e:
            print(f"⚠️ {i}. {import_statement} - Erro: {e}")

    print("\n" + "=" * 60)
    print("📋 RESULTADO FINAL")
    print("=" * 60)

    if working_get_db:
        print("✅ IMPORTS QUE FUNCIONAM PARA get_db:")
        for imp in working_get_db:
            print(f"   {imp}")
    else:
        print("❌ NENHUM IMPORT FUNCIONOU PARA get_db")

    print()

    if working_models:
        print("✅ IMPORTS QUE FUNCIONAM PARA Agent, AgentTool, RAGIndex:")
        for imp in working_models:
            print(f"   {imp}")
    else:
        print("❌ NENHUM IMPORT FUNCIONOU PARA Agent, AgentTool, RAGIndex")

    print("\n" + "=" * 60)
    print("🔧 CORREÇÕES RECOMENDADAS")
    print("=" * 60)

    if working_get_db and working_models:
        print("Use estes imports nos seus arquivos:")
        print(f"   {working_get_db[0]}")
        print(f"   {working_models[0]}")

        print("\nSubstituições necessárias:")
        print("📝 backend/models/agents.py:")
        print(f"   Linha 8: from app.database import Base")
        print(f"   ➜ Substituir por: {working_get_db[0].replace('get_db', 'Base')}")

        print("\n📝 backend/routers/agents.py:")
        print(f"   Linha 17: from models.database import get_db")
        print(f"   ➜ Substituir por: {working_get_db[0]}")
        print(f"   Linha 18: from models.agents import Agent, AgentTool, RAGIndex")
        print(f"   ➜ Substituir por: {working_models[0]}")

        print("\n📝 backend/routers/workflow_team_router.py:")
        print(f"   Linha 15: from models.database import get_db")
        print(f"   ➜ Substituir por: {working_get_db[0]}")
        print(f"   Linha 16: from models.agents import Agent, Team, TeamAgent")
        print(f"   ➜ Substituir por: {working_models[0].replace('RAGIndex', 'Team, TeamAgent')}")

    else:
        print("❌ Não foi possível encontrar imports funcionais.")
        print("Possíveis problemas:")
        print("   • Arquivos database.py ou agents.py não existem")
        print("   • Estrutura de diretórios incorreta")
        print("   • Arquivos __init__.py faltando")


def test_specific_imports():
    """Testa imports específicos que sabemos que estão falhando"""

    print("\n" + "=" * 60)
    print("🎯 TESTE ESPECÍFICO DOS IMPORTS PROBLEMÁTICOS")
    print("=" * 60)

    specific_tests = [
        ("get_db", "backend.database", "get_db"),
        ("Agent", "backend.models.agents", "Agent"),
        ("AgentTool", "backend.models.agents", "AgentTool"),
        ("RAGIndex", "backend.models.agents", "RAGIndex"),
        ("Team", "backend.models.agents", "Team"),
        ("TeamAgent", "backend.models.agents", "TeamAgent")
    ]

    results = {}

    for item_name, module_name, attr_name in specific_tests:
        try:
            module = __import__(module_name, fromlist=[attr_name])
            attr = getattr(module, attr_name)
            print(f"✅ {item_name}: Encontrado em {module_name}")
            results[item_name] = f"from {module_name} import {attr_name}"
        except ImportError as e:
            print(f"❌ {item_name}: ImportError - {e}")
            results[item_name] = None
        except AttributeError as e:
            print(f"⚠️ {item_name}: Módulo existe mas item não encontrado - {e}")
            results[item_name] = None
        except Exception as e:
            print(f"❌ {item_name}: Erro - {e}")
            results[item_name] = None

    return results


if __name__ == "__main__":
    test_import_variations()
    test_specific_imports()