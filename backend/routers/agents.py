# backend/routers/agents.py - VERSÃO CORRIGIDA PARA POSTGRESQL

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, insert, update, delete
from sqlalchemy.orm import selectinload
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from enum import Enum
import json
import uuid
import asyncio
from datetime import datetime

import sys
import os
from models.database import get_db
from models.agents import Agent, AgentTool, RAGIndex


# ✅ TEMPORÁRIO: Services mockados já que não existem ainda
class EmbeddingService:
    def __init__(self): pass


class VectorStoreService:
    def __init__(self): pass

    async def create_index(self, index_name: str, embedding_model: str): pass

    async def add_documents(self, index_name: str, documents: list): pass


class DocumentProcessor:
    def __init__(self): pass

    async def process_document(self, content, filename, chunk_size, chunk_overlap):
        return []  # Mock


# ✅ TEMPORÁRIO: Tool mock
class Tool:
    def __init__(self, id=None, name=None, description=None, category=None):
        self.id = id
        self.name = name
        self.description = description
        self.category = category


router = APIRouter()


# =====================================================
# MODELOS PYDANTIC
# =====================================================

class ModelProvider(str, Enum):
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GROQ = "groq"
    OLLAMA = "ollama"


class EmbeddingModel(str, Enum):
    ADA_002 = "text-embedding-ada-002"
    TEXT_3_SMALL = "text-embedding-3-small"
    TEXT_3_LARGE = "text-embedding-3-large"


class RAGConfigRequest(BaseModel):
    enabled: bool = False
    index_name: Optional[str] = None
    embedding_model: EmbeddingModel = EmbeddingModel.TEXT_3_SMALL
    chunk_size: int = Field(default=1000, ge=100, le=4000)
    chunk_overlap: int = Field(default=200, ge=0, le=1000)
    top_k: int = Field(default=5, ge=1, le=20)
    threshold: float = Field(default=0.7, ge=0.0, le=1.0)


class ToolConfigRequest(BaseModel):
    tool_id: str
    config: Optional[Dict[str, Any]] = {}


class CreateAgentRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    role: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=500)
    model_provider: ModelProvider
    model_id: str
    instructions: List[str] = []
    tools: List[ToolConfigRequest] = []
    memory_enabled: bool = True
    rag_config: RAGConfigRequest = RAGConfigRequest()
    configuration: Dict[str, Any] = {}
    user_id: int = 1  # ✅ ADICIONADO: Campo obrigatório para PostgreSQL


class UpdateAgentRequest(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    description: Optional[str] = None
    model_provider: Optional[ModelProvider] = None
    model_id: Optional[str] = None
    instructions: Optional[List[str]] = None
    tools: Optional[List[ToolConfigRequest]] = None
    memory_enabled: Optional[bool] = None
    rag_config: Optional[RAGConfigRequest] = None
    configuration: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


class AgentResponse(BaseModel):
    id: str
    name: str
    role: str
    description: Optional[str]
    model_provider: str
    model_id: str
    instructions: List[str]
    tools: List[Dict[str, Any]]
    memory_enabled: bool
    rag_enabled: bool
    rag_config: Optional[Dict[str, Any]]
    is_active: bool
    user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# =====================================================
# ENDPOINTS (Versões simplificadas para funcionar)
# =====================================================

@router.get("/", response_model=List[AgentResponse])
async def get_agents(
        skip: int = 0,
        limit: int = 100,
        active_only: bool = True,
        user_id: int = 1,  # ✅ ADICIONADO: Filtro por usuário
        db: AsyncSession = Depends(get_db)
):
    """Lista todos os agentes com suas configurações"""

    # ✅ CORREÇÃO: Query no PostgreSQL com SQLAlchemy
    query = select(Agent).options(
        selectinload(Agent.agent_tools).selectinload(AgentTool.tool),
        selectinload(Agent.rag_index)
    ).where(Agent.user_id == user_id)

    if active_only:
        query = query.where(Agent.is_active == True)

    query = query.offset(skip).limit(limit)

    result = await db.execute(query)
    agents = result.scalars().all()

    # Enriquecer com dados das ferramentas
    result_list = []
    for agent in agents:
        agent_dict = {
            "id": agent.id,
            "name": agent.name,
            "role": agent.role,
            "description": agent.description,
            "model_provider": agent.model_provider,
            "model_id": agent.model_id,
            "instructions": agent.instructions or [],
            "memory_enabled": agent.memory_enabled,
            "rag_enabled": agent.rag_enabled,
            "is_active": agent.is_active,
            "user_id": agent.user_id,
            "created_at": agent.created_at,
            "updated_at": agent.updated_at,
            "tools": [],
            "rag_config": None
        }

        # Adicionar ferramentas
        for agent_tool in agent.agent_tools:
            if agent_tool.tool:  # Verificar se tool existe
                tool_data = {
                    "id": agent_tool.tool.id,
                    "name": agent_tool.tool.name,
                    "description": agent_tool.tool.description,
                    "category": agent_tool.tool.category,
                    "config": agent_tool.configuration
                }
                agent_dict["tools"].append(tool_data)

        # Adicionar configuração RAG
        if agent.rag_index:
            agent_dict["rag_config"] = {
                "enabled": True,
                "index_name": agent.rag_index.name,
                "embedding_model": agent.rag_index.embedding_model,
                "chunk_size": agent.rag_index.chunk_size,
                "chunk_overlap": agent.rag_index.chunk_overlap,
                "top_k": agent.rag_index.top_k,
                "threshold": agent.rag_index.threshold,
                "status": agent.rag_index.status,
                "document_count": agent.rag_index.document_count
            }
        else:
            agent_dict["rag_config"] = {"enabled": False}

        result_list.append(agent_dict)

    return result_list


@router.get("/{agent_id}", response_model=AgentResponse)
async def get_agent(agent_id: str, user_id: int = 1, db: AsyncSession = Depends(get_db)):
    """Obtém detalhes de um agente específico"""

    # ✅ CORREÇÃO: Query no PostgreSQL
    result = await db.execute(
        select(Agent)
        .options(
            selectinload(Agent.agent_tools).selectinload(AgentTool.tool),
            selectinload(Agent.rag_index)
        )
        .where(Agent.id == agent_id)
        .where(Agent.user_id == user_id)
    )
    agent = result.scalar_one_or_none()

    if not agent:
        raise HTTPException(status_code=404, detail="Agente não encontrado")

    return agent


@router.post("/", response_model=AgentResponse)
async def create_agent(
        agent_data: CreateAgentRequest,
        db: AsyncSession = Depends(get_db)
):
    """Cria um novo agente com ferramentas e RAG"""
    try:
        # ✅ MOCK: Retornar dados do agente criado como dicionário
        mock_agent = {
            "id": str(uuid.uuid4()),
            "name": agent_data.name,
            "role": agent_data.role,
            "description": agent_data.description,
            "model_provider": agent_data.model_provider.value,
            "model_id": agent_data.model_id,
            "instructions": agent_data.instructions,
            "tools": [],
            "memory_enabled": agent_data.memory_enabled,
            "rag_enabled": agent_data.rag_config.enabled,
            "rag_config": {"enabled": agent_data.rag_config.enabled},
            "is_active": True,
            "user_id": agent_data.user_id,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }

        return mock_agent

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao criar agente: {str(e)}"
        )


@router.post("/{agent_id}/upload-documents")
async def upload_rag_documents(
        agent_id: str,
        files: List[UploadFile] = File(...),
        user_id: int = 1,
        db: AsyncSession = Depends(get_db)
):
    """Upload de documentos para o índice RAG do agente"""

    # ✅ CORREÇÃO: Buscar agent no PostgreSQL
    result = await db.execute(
        select(Agent)
        .options(selectinload(Agent.rag_index))
        .where(Agent.id == agent_id)
        .where(Agent.user_id == user_id)
    )
    agent = result.scalar_one_or_none()

    if not agent:
        raise HTTPException(status_code=404, detail="Agente não encontrado")

    if not agent.rag_enabled or not agent.rag_index:
        raise HTTPException(
            status_code=400,
            detail="RAG não está habilitado para este agente"
        )

    # Validar tipos de arquivo
    allowed_types = {
        "application/pdf",
        "text/plain",
        "text/markdown",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    }

    for file in files:
        if file.content_type not in allowed_types:
            raise HTTPException(
                status_code=400,
                detail=f"Tipo de arquivo não suportado: {file.content_type}"
            )

    try:
        service = AgentService(db)

        # Processar documentos em background
        asyncio.create_task(
            service._process_documents_background(agent.rag_index, files)
        )

        return {
            "message": f"Upload iniciado para {len(files)} arquivo(s)",
            "status": "processing",
            "files": [file.filename for file in files]
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erro no upload: {str(e)}"
        )


@router.put("/{agent_id}", response_model=AgentResponse)
async def update_agent(
        agent_id: str,
        update_data: UpdateAgentRequest,
        user_id: int = 1,
        db: AsyncSession = Depends(get_db)
):
    """Atualiza configurações de um agente"""

    # ✅ CORREÇÃO: Buscar agent no PostgreSQL
    result = await db.execute(
        select(Agent).where(Agent.id == agent_id).where(Agent.user_id == user_id)
    )
    agent = result.scalar_one_or_none()

    if not agent:
        raise HTTPException(status_code=404, detail="Agente não encontrado")

    try:
        # Atualizar campos básicos
        update_dict = update_data.dict(exclude_unset=True)
        update_dict["updated_at"] = datetime.utcnow()

        # ✅ CORREÇÃO: Atualizar no PostgreSQL
        await db.execute(
            update(Agent)
            .where(Agent.id == agent_id)
            .values(**{k: v for k, v in update_dict.items()
                       if k not in ['tools', 'rag_config']})
        )

        # Atualizar ferramentas se especificado
        if 'tools' in update_dict:
            # Remover associações existentes
            await db.execute(
                delete(AgentTool).where(AgentTool.agent_id == agent_id)
            )

            # Criar novas associações
            service = AgentService(db)
            await service._configure_agent_tools(agent, update_dict['tools'])

        # Atualizar configuração RAG se especificado
        if 'rag_config' in update_dict:
            rag_config = update_dict['rag_config']
            if rag_config.enabled and not agent.rag_enabled:
                # Habilitar RAG
                service = AgentService(db)
                rag_index = await service._setup_rag_index(agent, rag_config)

                await db.execute(
                    update(Agent)
                    .where(Agent.id == agent_id)
                    .values(rag_index_id=rag_index.id, rag_enabled=True)
                )

            elif not rag_config.enabled and agent.rag_enabled:
                # Desabilitar RAG
                await db.execute(
                    update(Agent)
                    .where(Agent.id == agent_id)
                    .values(rag_enabled=False, rag_index_id=None)
                )

        await db.commit()

        # Retornar agent atualizado
        updated_result = await db.execute(
            select(Agent)
            .options(
                selectinload(Agent.agent_tools).selectinload(AgentTool.tool),
                selectinload(Agent.rag_index)
            )
            .where(Agent.id == agent_id)
        )
        updated_agent = updated_result.scalar_one()

        return updated_agent

    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao atualizar agente: {str(e)}"
        )


@router.delete("/{agent_id}")
async def delete_agent(
        agent_id: str,
        user_id: int = 1,
        db: AsyncSession = Depends(get_db)
):
    """Remove um agente (soft delete)"""

    # ✅ CORREÇÃO: Soft delete no PostgreSQL
    result = await db.execute(
        update(Agent)
        .where(Agent.id == agent_id)
        .where(Agent.user_id == user_id)
        .values(is_active=False, updated_at=datetime.utcnow())
    )

    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Agente não encontrado")

    await db.commit()
    return {"message": "Agente removido com sucesso"}


@router.post("/{agent_id}/chat")
async def chat_with_agent(
        agent_id: str,
        message: dict,
        user_id: int = 1,
        db: AsyncSession = Depends(get_db)
):
    """Chat com um agente específico"""

    # ✅ CORREÇÃO: Buscar agent no PostgreSQL
    result = await db.execute(
        select(Agent)
        .options(
            selectinload(Agent.agent_tools).selectinload(AgentTool.tool),
            selectinload(Agent.rag_index)
        )
        .where(Agent.id == agent_id)
        .where(Agent.user_id == user_id)
        .where(Agent.is_active == True)
    )
    agent = result.scalar_one_or_none()

    if not agent:
        raise HTTPException(status_code=404, detail="Agente não encontrado")

    try:
        # TODO: Implementar integração com Agno framework
        response = {
            "agent_id": agent_id,
            "response": "Chat implementação pendente",
            "message": message.get("content", ""),
            "timestamp": datetime.utcnow().isoformat()
        }

        return response

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erro no chat: {str(e)}"
        )