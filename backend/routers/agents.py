# backend/routers/agents.py - VERSÃO CORRIGIDA SEM 307 REDIRECTS
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, insert, update, delete
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime
import json
import asyncio

try:
    from .agno_services import RealAgnoService, AGNO_AVAILABLE
except ImportError:
    try:
        from agno_services import RealAgnoService, AGNO_AVAILABLE
    except ImportError:
        AGNO_AVAILABLE = False
        RealAgnoService = None

real_agno_service = RealAgnoService() if AGNO_AVAILABLE else None
# Ajuste os imports conforme sua estrutura
try:
    from models.database import get_db
    from models.agents import Agent
except ImportError:
    from ..models.database import get_db
    from ..models.agents import Agent

# ==================== ROUTER SEM TRAILING SLASH ISSUES ====================
router = APIRouter(prefix="/api/agents", tags=["Agents"])

# ==================== MODELOS PYDANTIC ====================

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
    instructions: List[str] = Field(default=[])
    tools: List[ToolConfigRequest] = Field(default=[])
    configuration: Dict[str, Any] = Field(default_factory=dict)
    memory_enabled: bool = Field(default=False)
    rag_config: RAGConfigRequest = Field(default_factory=RAGConfigRequest)
    user_id: int = Field(default=1)

class ChatRequest(BaseModel):
    prompt: str = Field(..., min_length=1)
    context: Optional[Dict[str, Any]] = Field(default_factory=dict)
    stream: bool = Field(default=False)

class AgentResponse(BaseModel):
    id: int
    name: str
    role: str
    description: str
    model_provider: str
    model_id: str
    instructions: List[str]
    tools: List[Dict[str, Any]]
    is_active: bool
    created_at: datetime
    updated_at: datetime

# ==================== ENDPOINTS PRINCIPAIS ====================

@router.get("", response_model=List[AgentResponse])
async def list_agents(
    user_id: int = Query(1, description="ID do usuário"),
    db: AsyncSession = Depends(get_db)
):
    """Lista todos os agentes do usuário - SEM TRAILING SLASH"""
    try:
        # Buscar agentes ativos do usuário
        result = await db.execute(
            select(Agent).where(
                Agent.user_id == user_id,
                Agent.is_active == True
            ).order_by(Agent.created_at.desc())
        )
        agents = result.scalars().all()

        # Converter para response format
        agents_response = []
        for agent in agents:
            try:
                # Processar instruções (garantir que é uma lista)
                instructions = agent.instructions if agent.instructions else []
                if isinstance(instructions, str):
                    try:
                        instructions = json.loads(instructions)
                    except:
                        instructions = [instructions]
                elif not isinstance(instructions, list):
                    instructions = []

                # Processar tools (garantir que é uma lista de dicts)
                tools = agent.tools if agent.tools else []
                if isinstance(tools, str):
                    try:
                        tools = json.loads(tools)
                    except:
                        tools = []
                elif not isinstance(tools, list):
                    tools = []

                # Garantir que cada ferramenta seja um dicionário
                if isinstance(tools, list):
                    tools = [
                        t if isinstance(t, dict) else {"tool_id": str(t), "config": {}}
                        for t in tools
                    ]

                agent_data = {
                    "id": agent.id,
                    "name": agent.name,
                    "role": agent.role,
                    "description": agent.description or "",
                    "model_provider": agent.model_provider,
                    "model_id": agent.model_id,
                    "instructions": instructions,
                    "tools": tools,
                    "is_active": agent.is_active,
                    "created_at": agent.created_at,
                    "updated_at": agent.updated_at
                }

                agents_response.append(AgentResponse(**agent_data))

            except Exception as e:
                print(f"⚠️ Erro ao processar agente {agent.id}: {e}")
                continue

        print(f"📋 Listados {len(agents_response)} agentes válidos para usuário {user_id}")
        return agents_response

    except Exception as e:
        print(f"❌ Erro ao listar agentes: {e}")
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")

@router.post("", response_model=AgentResponse)
async def create_agent(
    request: CreateAgentRequest,
    db: AsyncSession = Depends(get_db)
):
    """Cria um novo agente - SEM TRAILING SLASH"""
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
            "instructions": request.instructions,
            "tools": tools_db,
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

        # Retornar agente criado
        return AgentResponse(
            id=new_agent.id,
            name=new_agent.name,
            role=new_agent.role,
            description=new_agent.description or "",
            model_provider=new_agent.model_provider,
            model_id=new_agent.model_id,
            instructions=new_agent.instructions or [],
            tools=new_agent.tools or [],
            is_active=new_agent.is_active,
            created_at=new_agent.created_at,
            updated_at=new_agent.updated_at
        )

    except Exception as e:
        await db.rollback()
        print(f"❌ Erro ao criar agente: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao criar agente: {str(e)}")

@router.get("/{agent_id}", response_model=AgentResponse)
async def get_agent(
    agent_id: int,
    user_id: int = Query(1, description="ID do usuário"),
    db: AsyncSession = Depends(get_db)
):
    """Busca um agente específico"""
    try:
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

        # Processar dados
        instructions = agent.instructions if agent.instructions else []
        if isinstance(instructions, str):
            try:
                instructions = json.loads(instructions)
            except:
                instructions = [instructions]

        tools = agent.tools if agent.tools else []
        if isinstance(tools, str):
            try:
                tools = json.loads(tools)
            except:
                tools = []

        return AgentResponse(
            id=agent.id,
            name=agent.name,
            role=agent.role,
            description=agent.description or "",
            model_provider=agent.model_provider,
            model_id=agent.model_id,
            instructions=instructions,
            tools=tools,
            is_active=agent.is_active,
            created_at=agent.created_at,
            updated_at=agent.updated_at
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Erro ao buscar agente {agent_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")

@router.post("/{agent_id}/chat")
async def chat_with_agent(
    agent_id: int,
    request: ChatRequest,
    user_id: int = Query(1, description="ID do usuário"),
    db: AsyncSession = Depends(get_db)
):
    """Chat com um agente específico"""
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

        print(f"💬 Chat iniciado com agente: {agent.name}")

        # Simular resposta do agente (substitua pela integração real com LLM)
        tools_list = []
        if agent.tools:
            if isinstance(agent.tools, list):
                tools_list = [
                    t["tool_id"] if isinstance(t, dict) else str(t)
                    for t in agent.tools
                ]

        if AGNO_AVAILABLE and real_agno_service:
            try:
                agent_config = {
                    "name": agent.name,
                    "role": agent.role,
                    "model_provider": agent.model_provider,
                    "model_id": agent.model_id,
                    "instructions": agent.instructions or [],
                    "tools": tools_list,
                    "memory_enabled": agent.memory_enabled,
                    "rag_enabled": getattr(agent, "rag_enabled", False),
                    "rag_index_id": getattr(agent, "rag_index_id", None),
                }
                result = await asyncio.to_thread(
                    real_agno_service.execute_agent_task,
                    agent_config,
                    request.prompt,
                    tools_list,
                )
                response_text = result.get("response", "")
                tools_used = result.get("tools_used", 0)
                print(response_text)
            except Exception as e:
                print(f"⚠️ Falha na execução real: {e}")
                response_text = f"[mock] {agent.name} recebeu: '{request.prompt}'"
                tools_used = []
        else:
            response_text = f"Olá! Sou o {agent.name}, um {agent.role}. Recebi sua mensagem: '{request.prompt}'. Esta é uma resposta simulada para teste da API."
            tools_used = []

        response_data = {
            "agent_id": agent_id,
            "agent_name": agent.name,
            "user_prompt": request.prompt,
            "response": f"Olá! Sou o {agent.name}, um {agent.role}. Recebi sua mensagem: '{request.prompt}'. Esta é uma resposta simulada para teste da API.",
            "response": response_text,
            "timestamp": datetime.utcnow().isoformat(),
            "model": f"{agent.model_provider}/{agent.model_id}",
            "tools_used": [],
            "context": request.context,
            "tools_used": tools_used,
            "context": request.context,
        }

        if request.stream:
            return {"message": "Streaming não implementado ainda", "data": response_data}
        else:
            return response_data
        return response_data

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Erro no chat com agente {agent_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Erro no chat: {str(e)}")

@router.put("/{agent_id}", response_model=AgentResponse)
async def update_agent(
    agent_id: int,
    request: CreateAgentRequest,
    db: AsyncSession = Depends(get_db)
):
    """Atualiza um agente existente"""
    try:
        # Verificar se agente existe
        result = await db.execute(
            select(Agent).where(
                Agent.id == agent_id,
                Agent.user_id == request.user_id,
                Agent.is_active == True
            )
        )
        agent = result.scalar_one_or_none()

        if not agent:
            raise HTTPException(status_code=404, detail="Agente não encontrado")

        # Preparar dados para atualização
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

        # Atualizar agente
        await db.execute(
            update(Agent)
            .where(Agent.id == agent_id)
            .values(
                name=request.name,
                role=request.role,
                description=request.description,
                model_provider=request.model_provider,
                model_id=request.model_id,
                instructions=request.instructions,
                tools=tools_db,
                configuration=request.configuration,
                memory_enabled=request.memory_enabled,
                rag_enabled=request.rag_config.enabled,
                rag_index_id=request.rag_config.index_name,
                updated_at=datetime.utcnow()
            )
        )
        await db.commit()

        print(f"✅ Agente atualizado: {request.name} (ID: {agent_id})")

        # Buscar agente atualizado
        result = await db.execute(
            select(Agent).where(Agent.id == agent_id)
        )
        updated_agent = result.scalar_one()

        return AgentResponse(
            id=updated_agent.id,
            name=updated_agent.name,
            role=updated_agent.role,
            description=updated_agent.description or "",
            model_provider=updated_agent.model_provider,
            model_id=updated_agent.model_id,
            instructions=updated_agent.instructions or [],
            tools=updated_agent.tools or [],
            is_active=updated_agent.is_active,
            created_at=updated_agent.created_at,
            updated_at=updated_agent.updated_at
        )

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        print(f"❌ Erro ao atualizar agente {agent_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")

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