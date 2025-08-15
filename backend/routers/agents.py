# backend/routers/agents.py - VERSÃO CORRIGIDA PARA POSTGRESQL

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, insert, update, delete
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
from models.agents import Agent

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
    user_id: int = 1


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
    rag_config: Optional[Dict[str, Any]]
    is_active: bool
    user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# =====================================================
# ENDPOINTS
# =====================================================

@router.get("/", response_model=List[AgentResponse])
async def get_agents(
        skip: int = 0,
        limit: int = 100,
        active_only: bool = True,
        user_id: int = 1,
        db: AsyncSession = Depends(get_db)
):
    """Lista todos os agentes com suas configurações"""

    # Query simples sem relacionamentos problemáticos
    query = select(Agent).where(Agent.user_id == user_id)

    if active_only:
        query = query.where(Agent.is_active == True)

    query = query.offset(skip).limit(limit)

    result = await db.execute(query)
    agents = result.scalars().all()

    # Converter para response format
    result_list = []
    for agent in agents:
        # Processar tools do JSON
        tools_data = []
        if agent.tools:
            for tool in agent.tools:
                if isinstance(tool, dict):
                    tools_data.append(tool)
                elif isinstance(tool, str):
                    tools_data.append({"id": tool, "name": tool, "config": {}})

        # Processar configuração RAG
        rag_config = None
        if agent.rag_enabled:
            rag_config = {
                "enabled": True,
                "index_name": agent.rag_index_id,
                "status": "active"
            }
        else:
            rag_config = {"enabled": False}

        agent_dict = {
            "id": agent.id,
            "name": agent.name,
            "role": agent.role,
            "description": agent.description,
            "model_provider": agent.model_provider,
            "model_id": agent.model_id,
            "instructions": agent.instructions or [],
            "tools": tools_data,
            "memory_enabled": agent.memory_enabled,
            "rag_enabled": agent.rag_enabled,
            "rag_config": rag_config,
            "is_active": agent.is_active,
            "user_id": agent.user_id,
            "created_at": agent.created_at,
            "updated_at": agent.updated_at
        }

        result_list.append(agent_dict)

    return result_list


@router.get("/{agent_id}", response_model=AgentResponse)
async def get_agent(agent_id: int, user_id: int = 1, db: AsyncSession = Depends(get_db)):
    """Obtém detalhes de um agente específico"""

    result = await db.execute(
        select(Agent)
        .where(Agent.id == agent_id)
        .where(Agent.user_id == user_id)
    )
    agent = result.scalar_one_or_none()

    if not agent:
        raise HTTPException(status_code=404, detail="Agente não encontrado")

    # Processar tools do JSON
    tools_data = []
    if agent.tools:
        for tool in agent.tools:
            if isinstance(tool, dict):
                tools_data.append(tool)
            elif isinstance(tool, str):
                tools_data.append({"id": tool, "name": tool, "config": {}})

    # Processar configuração RAG
    rag_config = None
    if agent.rag_enabled:
        rag_config = {
            "enabled": True,
            "index_name": agent.rag_index_id,
            "status": "active"
        }
    else:
        rag_config = {"enabled": False}

    return {
        "id": agent.id,
        "name": agent.name,
        "role": agent.role,
        "description": agent.description,
        "model_provider": agent.model_provider,
        "model_id": agent.model_id,
        "instructions": agent.instructions or [],
        "tools": tools_data,
        "memory_enabled": agent.memory_enabled,
        "rag_enabled": agent.rag_enabled,
        "rag_config": rag_config,
        "is_active": agent.is_active,
        "user_id": agent.user_id,
        "created_at": agent.created_at,
        "updated_at": agent.updated_at
    }


@router.post("/", response_model=AgentResponse)
async def create_agent(
        agent_data: CreateAgentRequest,
        db: AsyncSession = Depends(get_db)
):
    """Cria um novo agente"""
    try:
        # Preparar dados para inserção
        agent_dict = {
            "user_id": agent_data.user_id,
            "name": agent_data.name,
            "role": agent_data.role,
            "description": agent_data.description,
            "model_provider": agent_data.model_provider.value,
            "model_id": agent_data.model_id,
            "instructions": agent_data.instructions,
            "tools": [tool.dict() for tool in agent_data.tools],
            "configuration": agent_data.configuration,
            "memory_enabled": agent_data.memory_enabled,
            "rag_enabled": agent_data.rag_config.enabled,
            "rag_index_id": agent_data.rag_config.index_name if agent_data.rag_config.enabled else None,
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }

        # Inserir no banco
        result = await db.execute(
            insert(Agent).values(**agent_dict).returning(Agent)
        )
        await db.commit()

        new_agent = result.scalar_one()

        return await get_agent(new_agent.id, agent_data.user_id, db)

    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao criar agente: {str(e)}"
        )


@router.put("/{agent_id}", response_model=AgentResponse)
async def update_agent(
        agent_id: int,
        agent_data: UpdateAgentRequest,
        user_id: int = 1,
        db: AsyncSession = Depends(get_db)
):
    """Atualiza um agente existente"""
    try:
        # Verificar se agente existe
        result = await db.execute(
            select(Agent).where(Agent.id == agent_id, Agent.user_id == user_id)
        )
        agent = result.scalar_one_or_none()

        if not agent:
            raise HTTPException(status_code=404, detail="Agente não encontrado")

        # Preparar dados para atualização
        update_data = {"updated_at": datetime.utcnow()}

        if agent_data.name is not None:
            update_data["name"] = agent_data.name
        if agent_data.role is not None:
            update_data["role"] = agent_data.role
        if agent_data.description is not None:
            update_data["description"] = agent_data.description
        if agent_data.model_provider is not None:
            update_data["model_provider"] = agent_data.model_provider.value
        if agent_data.model_id is not None:
            update_data["model_id"] = agent_data.model_id
        if agent_data.instructions is not None:
            update_data["instructions"] = agent_data.instructions
        if agent_data.tools is not None:
            update_data["tools"] = [tool.dict() for tool in agent_data.tools]
        if agent_data.memory_enabled is not None:
            update_data["memory_enabled"] = agent_data.memory_enabled
        if agent_data.rag_config is not None:
            update_data["rag_enabled"] = agent_data.rag_config.enabled
            update_data["rag_index_id"] = agent_data.rag_config.index_name if agent_data.rag_config.enabled else None
        if agent_data.configuration is not None:
            update_data["configuration"] = agent_data.configuration
        if agent_data.is_active is not None:
            update_data["is_active"] = agent_data.is_active

        # Atualizar no banco
        await db.execute(
            update(Agent).where(Agent.id == agent_id).values(**update_data)
        )
        await db.commit()

        return await get_agent(agent_id, user_id, db)

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao atualizar agente: {str(e)}"
        )


@router.delete("/{agent_id}")
async def delete_agent(
        agent_id: int,
        user_id: int = 1,
        db: AsyncSession = Depends(get_db)
):
    """Remove um agente (soft delete)"""
    try:
        # Verificar se agente existe
        result = await db.execute(
            select(Agent).where(Agent.id == agent_id, Agent.user_id == user_id)
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

        return {"message": "Agente removido com sucesso"}

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao remover agente: {str(e)}"
        )


@router.post("/{agent_id}/upload-documents")
async def upload_documents(
        agent_id: int,
        files: List[UploadFile] = File(...),
        user_id: int = 1,
        db: AsyncSession = Depends(get_db)
):
    """Upload de documentos para RAG (placeholder)"""
    try:
        # Verificar se agente existe
        result = await db.execute(
            select(Agent).where(Agent.id == agent_id, Agent.user_id == user_id)
        )
        agent = result.scalar_one_or_none()

        if not agent:
            raise HTTPException(status_code=404, detail="Agente não encontrado")

        if not agent.rag_enabled:
            raise HTTPException(status_code=400, detail="RAG não está habilitado para este agente")

        # Placeholder para processamento de documentos
        processed_files = []
        for file in files:
            content = await file.read()
            processed_files.append({
                "filename": file.filename,
                "size": len(content),
                "status": "processed"
            })

        return {
            "message": f"Processados {len(processed_files)} documentos",
            "files": processed_files
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao processar documentos: {str(e)}"
        )