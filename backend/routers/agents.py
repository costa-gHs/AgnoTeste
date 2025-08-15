# backend/routers/agents.py - VERSÃO CORRIGIDA FINAL
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, insert, update, delete
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime
import json

# Ajuste os imports conforme sua estrutura
try:
    from models.database import get_db
    from models.agents import Agent
except ImportError:
    from ..models.database import get_db
    from ..models.agents import Agent

router = APIRouter(prefix="/api/agents", tags=["Agents"])


# Adicionar rotas com e sem trailing slash para evitar 307 redirects
@router.api_route("/", methods=["GET", "POST"])
@router.api_route("", methods=["GET", "POST"])
async def agents_root_handler(request, db: AsyncSession = Depends(get_db)):
    """Handler unificado para /agents e /agents/"""
    if request.method == "GET":
        user_id = request.query_params.get("user_id", 1)
        return await list_agents(int(user_id), db)
    elif request.method == "POST":
        body = await request.json()
        request_obj = CreateAgentRequest(**body)
        return await create_agent(request_obj, db)


# ==================== MODELOS PYDANTIC CORRIGIDOS ====================

class ToolConfigRequest(BaseModel):
    tool_id: str
    config: Optional[Dict[str, Any]] = {}


class RAGConfigRequest(BaseModel):
    enabled: bool = False
    index_name: Optional[str] = None
    embedding_model: str = "text-embedding-ada-002"
    chunk_size: int = 1000
    chunk_overlap: int = 200
    top_k: int = 5
    threshold: float = 0.7


class CreateAgentRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    role: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(default="", max_length=500)
    model_provider: str = Field(default="openai")
    model_id: str = Field(default="gpt-4o")
    instructions: List[str] = Field(default=[])  # Array de strings
    tools: List[ToolConfigRequest] = Field(default=[])  # Array de objetos
    memory_enabled: bool = Field(default=True)
    rag_config: RAGConfigRequest = Field(default_factory=RAGConfigRequest)  # Objeto completo
    configuration: Dict[str, Any] = Field(default_factory=dict)
    user_id: int = Field(default=1)


class ChatRequest(BaseModel):
    prompt: str = Field(..., min_length=1)  # Campo 'prompt', não 'message'
    stream: bool = Field(default=False)
    context: Optional[Dict[str, Any]] = Field(default_factory=dict)


class AgentResponse(BaseModel):
    id: int
    name: str
    role: str
    description: Optional[str]
    model_provider: str
    model_id: str
    instructions: List[str]
    tools: List[Dict[str, Any]]
    memory_enabled: bool
    rag_enabled: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime


# ==================== ENDPOINTS CORRIGIDOS ====================

@router.get("/", response_model=List[AgentResponse])
async def list_agents(
        user_id: int = Query(1, description="ID do usuário"),
        db: AsyncSession = Depends(get_db)
):
    """Lista todos os agentes do usuário"""
    try:
        result = await db.execute(
            select(Agent)
            .where(Agent.user_id == user_id, Agent.is_active == True)
            .order_by(Agent.created_at.desc())
        )
        agents = result.scalars().all()

        def normalize_tools(tools_data):
            """Converte tools de qualquer formato para o esperado"""
            if not tools_data:
                return []

            if isinstance(tools_data, list):
                normalized = []
                for tool in tools_data:
                    if isinstance(tool, dict):
                        # Já está no formato correto
                        if "tool_id" in tool:
                            normalized.append(tool)
                        else:
                            # Dicionário mas sem tool_id, converter
                            normalized.append({"tool_id": str(tool), "config": {}})
                    elif isinstance(tool, str):
                        # String simples, converter para dicionário
                        normalized.append({"tool_id": tool, "config": {}})
                    else:
                        # Outro tipo, converter para string
                        normalized.append({"tool_id": str(tool), "config": {}})
                return normalized
            else:
                # Se não for lista, tentar converter
                return [{"tool_id": str(tools_data), "config": {}}]

        def normalize_instructions(instructions_data):
            """Garante que instructions seja sempre uma lista de strings"""
            if not instructions_data:
                return []
            if isinstance(instructions_data, list):
                return [str(inst) for inst in instructions_data]
            else:
                return [str(instructions_data)]

        agents_response = []
        for agent in agents:
            try:
                agent_response = AgentResponse(
                    id=agent.id,
                    name=agent.name,
                    role=agent.role,
                    description=agent.description,
                    model_provider=agent.model_provider,
                    model_id=agent.model_id,
                    instructions=normalize_instructions(agent.instructions),
                    tools=normalize_tools(agent.tools),  # ← CORREÇÃO AQUI
                    memory_enabled=agent.memory_enabled,
                    rag_enabled=agent.rag_enabled,
                    is_active=agent.is_active,
                    created_at=agent.created_at,
                    updated_at=agent.updated_at
                )
                agents_response.append(agent_response)
            except Exception as agent_error:
                print(f"⚠️ Erro ao processar agente {agent.id}: {agent_error}")
                print(f"   Tools originais: {agent.tools}")
                print(f"   Tools normalizadas: {normalize_tools(agent.tools)}")
                # Continua com os outros agentes
                continue

        print(f"📋 Listados {len(agents_response)} agentes válidos para usuário {user_id}")
        return agents_response

    except Exception as e:
        print(f"❌ Erro ao listar agentes: {e}")
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")


@router.post("/")
@router.post("")
async def create_agent(
        request: CreateAgentRequest,
        db: AsyncSession = Depends(get_db)
):
    """Cria um novo agente com validação corrigida"""
    try:
        # Converter tools para formato do banco
        tools_db = []
        for tool in request.tools:
            if isinstance(tool, ToolConfigRequest):
                tools_db.append({
                    "tool_id": tool.tool_id,
                    "config": tool.config or {}
                })
            elif isinstance(tool, dict):
                tools_db.append(tool)
            else:
                tools_db.append({"tool_id": str(tool), "config": {}})

        # Preparar dados para inserção
        agent_data = {
            "user_id": request.user_id,
            "name": request.name,
            "role": request.role,
            "description": request.description,
            "model_provider": request.model_provider,
            "model_id": request.model_id,
            "instructions": request.instructions,  # Array direto
            "tools": tools_db,  # Array de objetos
            "configuration": request.configuration,
            "memory_enabled": request.memory_enabled,
            "rag_enabled": request.rag_config.enabled,
            "rag_index_id": request.rag_config.index_name,
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }

        # Inserir no banco
        result = await db.execute(
            insert(Agent).values(**agent_data).returning(Agent)
        )
        await db.commit()

        new_agent = result.scalar_one()

        print(f"✅ Agente criado: {new_agent.name} (ID: {new_agent.id})")

        return AgentResponse(
            id=new_agent.id,
            name=new_agent.name,
            role=new_agent.role,
            description=new_agent.description,
            model_provider=new_agent.model_provider,
            model_id=new_agent.model_id,
            instructions=new_agent.instructions if isinstance(new_agent.instructions, list) else [
                str(new_agent.instructions)] if new_agent.instructions else [],
            tools=tools_db,  # Já está no formato correto
            memory_enabled=new_agent.memory_enabled,
            rag_enabled=new_agent.rag_enabled,
            is_active=new_agent.is_active,
            created_at=new_agent.created_at,
            updated_at=new_agent.updated_at
        )

    except Exception as e:
        await db.rollback()
        print(f"❌ Erro ao criar agente: {e}")
        print(f"Request data: {request}")
        raise HTTPException(status_code=500, detail=f"Erro ao criar agente: {str(e)}")


@router.post("/{agent_id}/chat")
async def chat_with_agent(
        agent_id: int,
        request: ChatRequest,
        user_id: int = Query(1, description="ID do usuário"),
        db: AsyncSession = Depends(get_db)
):
    """ENDPOINT CORRIGIDO: Chat com agente específico"""
    try:
        # Buscar agente
        result = await db.execute(
            select(Agent).where(
                Agent.id == agent_id,
                Agent.user_id == user_id,
                Agent.is_active == True
            )
        )
        agent = result.scalar_one_or_none()

        if not agent:
            raise HTTPException(
                status_code=404,
                detail=f"Agente {agent_id} não encontrado"
            )

        print(f"💬 Chat iniciado com agente: {agent.name}")

        # Simular resposta (substitua pela integração real com Agno/LLM)
        response_data = {
            "agent_id": agent_id,
            "agent_name": agent.name,
            "prompt": request.prompt,
            "response": f"Olá! Sou o {agent.name}, um {agent.role}. Recebi sua mensagem: '{request.prompt}'. Esta é uma resposta simulada para teste da API.",
            "timestamp": datetime.utcnow().isoformat(),
            "model": f"{agent.model_provider}/{agent.model_id}",
            "tools_used": [],
            "context": request.context
        }

        if request.stream:
            # Para streaming, você implementaria aqui
            return {"message": "Streaming não implementado ainda", "data": response_data}
        else:
            return response_data

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Erro no chat com agente {agent_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Erro no chat: {str(e)}")


@router.delete("/{agent_id}")
async def delete_agent(
        agent_id: int,
        user_id: int = Query(1, description="ID do usuário"),
        db: AsyncSession = Depends(get_db)
):
    """Remove um agente (soft delete)"""
    try:
        # Verificar se agente existe
        result = await db.execute(
            select(Agent).where(
                Agent.id == agent_id,
                Agent.user_id == user_id,
                Agent.is_active == True
            )
        )
        agent = result.scalar_one_or_none()

        if not agent:
            raise HTTPException(status_code=404, detail="Agente não encontrado")

        # Soft delete
        await db.execute(
            update(Agent)
            .where(Agent.id == agent_id)
            .values(is_active=False, updated_at=datetime.utcnow())
        )
        await db.commit()

        print(f"🗑️ Agente {agent.name} removido")

        return {"message": f"Agente {agent.name} removido com sucesso"}

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        print(f"❌ Erro ao remover agente {agent_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")