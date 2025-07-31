#!/usr/bin/env python3
# start_backend_now.py - Script para inicializar o backend rapidamente

import os
import sys
import subprocess
import time
import requests
from pathlib import Path


def print_header(title):
    print("\n" + "=" * 60)
    print(f" {title}")
    print("=" * 60)


def print_step(step, message):
    print(f"\n🔹 Passo {step}: {message}")


def print_success(message):
    print(f"✅ {message}")


def print_error(message):
    print(f"❌ {message}")


def print_info(message):
    print(f"💡 {message}")


def check_backend_running():
    """Verifica se o backend já está rodando"""
    try:
        response = requests.get("http://localhost:8000", timeout=3)
        if response.status_code == 200:
            data = response.json()
            print_success(f"Backend já está rodando: {data.get('message')}")
            return True
    except:
        pass
    return False


def install_requirements():
    """Instala requisitos mínimos"""
    print_step(1, "Verificando e instalando dependências")

    required_packages = [
        "fastapi",
        "uvicorn",
        "python-dotenv",
        "pydantic",
        "requests"
    ]

    for package in required_packages:
        try:
            __import__(package)
            print_success(f"{package} já instalado")
        except ImportError:
            print(f"⚠️ Instalando {package}...")
            try:
                subprocess.check_call([sys.executable, "-m", "pip", "install", package])
                print_success(f"{package} instalado com sucesso")
            except subprocess.CalledProcessError:
                print_error(f"Falha ao instalar {package}")
                return False

    return True


def create_minimal_env():
    """Cria arquivo .env mínimo se não existir"""
    print_step(2, "Configurando arquivo .env")

    if not Path(".env").exists():
        print("📝 Criando arquivo .env básico...")
        with open(".env", "w", encoding="utf-8") as f:
            f.write("""# Agno Platform - Configuração Mínima
DEBUG=true
LOG_LEVEL=info

# API Keys (opcional para demo)
# OPENAI_API_KEY=sua_chave_aqui
# ANTHROPIC_API_KEY=sua_chave_aqui

# Supabase (opcional para demo)  
# SUPABASE_URL=https://seu-projeto.supabase.co
# SUPABASE_KEY=sua_chave_anon_supabase
""")
        print_success("Arquivo .env criado")
    else:
        print_success("Arquivo .env já existe")


def create_minimal_app():
    """Cria app.py mínimo se não existir"""
    print_step(3, "Verificando arquivo app.py")

    if not Path("app.py").exists():
        print("📝 Criando app.py mínimo...")
        with open("app.py", "w", encoding="utf-8") as f:
            f.write("""# app.py - Backend mínimo para Agno Platform
import os
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional
import json
from datetime import datetime

# Carregar variáveis de ambiente
from dotenv import load_dotenv
load_dotenv()

# Dados mock
MOCK_AGENTS = [
    {
        "id": 1,
        "nome": "Assistente de Demonstração",
        "modelo": "gpt-4o",
        "empresa": "openai",
        "agent_role": "Demo Assistant",
        "is_active_agent": True,
        "created_at": datetime.now().isoformat(),
        "langchain_config": json.dumps({
            "tools": ["reasoning"],
            "memory_enabled": True,
            "model_provider": "openai",
            "model_id": "gpt-4o"
        })
    }
]

# Criar app
app = FastAPI(title="Agno Platform API", version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Modelos
class CreateAgentRequest(BaseModel):
    name: str
    role: str
    model_provider: str = "openai"
    model_id: str = "gpt-4o"
    instructions: List[str] = ["Você é um assistente útil."]
    tools: List[str] = []
    memory_enabled: bool = True
    rag_enabled: bool = False

# Rotas
@app.get("/")
async def root():
    return {
        "message": "Agno Platform API - Demo Mode",
        "status": "online",
        "version": "1.0.0",
        "mode": "demo"
    }

@app.get("/api/health")
async def health():
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "mode": "demo",
        "backend_working": True
    }

@app.get("/api/agents")
async def list_agents(user_id: int = Query(1)):
    return MOCK_AGENTS

@app.get("/api/workflows")
async def list_workflows(user_id: int = Query(1)):
    return [
        {
            "id": 1,
            "nome": "Workflow de Demonstração",
            "descricao": "Workflow para testes",
            "is_active": True,
            "created_at": datetime.now().isoformat()
        }
    ]

@app.post("/api/agents/create")
async def create_agent(request: CreateAgentRequest, user_id: int = Query(1)):
    new_agent = {
        "id": len(MOCK_AGENTS) + 1,
        "nome": request.name,
        "modelo": request.model_id,
        "empresa": request.model_provider,
        "agent_role": request.role,
        "is_active_agent": True,
        "created_at": datetime.now().isoformat(),
        "langchain_config": json.dumps({
            "tools": request.tools,
            "memory_enabled": request.memory_enabled,
            "model_provider": request.model_provider,
            "model_id": request.model_id
        })
    }
    MOCK_AGENTS.append(new_agent)
    return {"agent_id": new_agent["id"], "status": "created"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
""")
        print_success("app.py criado")
    else:
        print_success("app.py já existe")


def start_backend():
    """Inicia o backend"""
    print_step(4, "Iniciando o backend")

    try:
        print("🚀 Executando: uvicorn app:app --host 0.0.0.0 --port 8000")
        print("💡 Para parar o servidor, pressione Ctrl+C")
        print("💡 Em outro terminal, execute: npm run dev")
        print("\n" + "=" * 60)
        print(" BACKEND INICIANDO - AGUARDE...")
        print("=" * 60)

        # Iniciar o servidor
        subprocess.run([
            sys.executable, "-m", "uvicorn",
            "app:app",
            "--host", "0.0.0.0",
            "--port", "8000",
            "--reload"
        ])

    except KeyboardInterrupt:
        print("\n🛑 Servidor parado pelo usuário")
    except Exception as e:
        print_error(f"Erro ao iniciar servidor: {e}")


def test_backend():
    """Testa se o backend está funcionando"""
    print("🧪 Testando conectividade...")

    for i in range(10):  # Tentar por 10 segundos
        try:
            response = requests.get("http://localhost:8000", timeout=2)
            if response.status_code == 200:
                data = response.json()
                print_success(f"Backend funcionando: {data.get('message')}")

                # Testar endpoints da API
                health = requests.get("http://localhost:8000/api/health", timeout=2)
                if health.status_code == 200:
                    print_success("Endpoint de health OK")

                agents = requests.get("http://localhost:8000/api/agents?user_id=1", timeout=2)
                if agents.status_code == 200:
                    print_success(f"Endpoint de agentes OK - {len(agents.json())} agentes")

                print("\n🎉 BACKEND ESTÁ FUNCIONANDO!")
                print("🌐 Agora você pode acessar: http://localhost:3000")
                return True

        except requests.exceptions.RequestException:
            pass

        time.sleep(1)
        print(f"⏳ Aguardando backend... ({i + 1}/10)")

    print_error("Backend não respondeu após 10 segundos")
    return False


def main():
    """Função principal"""
    print_header("INICIALIZAÇÃO RÁPIDA DO BACKEND AGNO")

    # Verificar se já está rodando
    if check_backend_running():
        print("\n🎉 Backend já está funcionando!")
        print("🌐 Acesse: http://localhost:3000")
        print("📚 API Docs: http://localhost:8000/docs")
        return

    # Preparar ambiente
    if not install_requirements():
        print_error("Falha ao instalar dependências")
        return

    create_minimal_env()
    create_minimal_app()

    print("\n" + "=" * 60)
    print(" PRONTO PARA INICIAR!")
    print("=" * 60)
    print("💡 O backend será iniciado na porta 8000")
    print("💡 Depois de iniciado, abra outro terminal e execute: npm run dev")
    print("💡 Para parar o backend, pressione Ctrl+C")

    input("\n📋 Pressione ENTER para iniciar o backend...")

    # Iniciar backend
    start_backend()


if __name__ == "__main__":
    main()