# app/api/routes/agents.py - Endpoints para criação de agentes com ferramentas e RAG

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from enum import Enum
import json
import uuid
import asyncio
from datetime import datetime

from backend.routers.database import get_db
from backend.models.agents import Agent, AgentTool, RAGIndex
from backend.models.tools import Tool
from backend.services.embedding_service import EmbeddingService
from backend.services.vector_store import VectorStoreService
from backend.services.document_processor import DocumentProcessor

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
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# =====================================================
# SERVIÇOS AUXILIARES
# =====================================================

class AgentService:
    def __init__(self, db: Session):
        self.db = db
        self.embedding_service = EmbeddingService()
        self.vector_store = VectorStoreService()
        self.document_processor = DocumentProcessor()

    async def create_agent_with_rag(
            self,
            agent_data: CreateAgentRequest,
            documents: List[UploadFile] = None
    ) -> Agent:
        """Cria agente com configuração RAG e processamento de documentos"""

        # 1. Criar agente base
        agent = Agent(
            id=str(uuid.uuid4()),
            name=agent_data.name,
            role=agent_data.role,
            description=agent_data.description,
            model_provider=agent_data.model_provider.value,
            model_id=agent_data.model_id,
            instructions=agent_data.instructions,
            memory_enabled=agent_data.memory_enabled,
            configuration=agent_data.configuration,
            is_active=True,
            rag_enabled=agent_data.rag_config.enabled
        )

        self.db.add(agent)
        self.db.flush()  # Para obter o ID

        # 2. Configurar ferramentas
        await self._configure_agent_tools(agent, agent_data.tools)

        # 3. Configurar RAG se habilitado
        if agent_data.rag_config.enabled:
            rag_index = await self._setup_rag_index(
                agent,
                agent_data.rag_config,
                documents
            )
            agent.rag_index_id = rag_index.id

        self.db.commit()
        self.db.refresh(agent)

        return agent

    async def _configure_agent_tools(
            self,
            agent: Agent,
            tool_configs: List[ToolConfigRequest]
    ):
        """Configura ferramentas do agente"""
        for tool_config in tool_configs:
            # Verificar se ferramenta existe
            tool = self.db.query(Tool).filter(
                Tool.id == tool_config.tool_id
            ).first()

            if not tool:
                raise HTTPException(
                    status_code=404,
                    detail=f"Ferramenta {tool_config.tool_id} não encontrada"
                )

            # Criar associação agente-ferramenta
            agent_tool = AgentTool(
                agent_id=agent.id,
                tool_id=tool.id,
                configuration=tool_config.config
            )
            self.db.add(agent_tool)

    async def _setup_rag_index(
            self,
            agent: Agent,
            rag_config: RAGConfigRequest,
            documents: List[UploadFile] = None
    ) -> RAGIndex:
        """Configura índice RAG e processa documentos"""

        # Criar índice RAG
        index_name = rag_config.index_name or f"agent_{agent.id}_index"

        rag_index = RAGIndex(
            id=str(uuid.uuid4()),
            name=index_name,
            agent_id=agent.id,
            embedding_model=rag_config.embedding_model.value,
            chunk_size=rag_config.chunk_size,
            chunk_overlap=rag_config.chunk_overlap,
            top_k=rag_config.top_k,
            threshold=rag_config.threshold,
            status="creating"
        )

        self.db.add(rag_index)
        self.db.flush()

        # Processar documentos em background
        if documents:
            asyncio.create_task(
                self._process_documents_background(rag_index, documents)
            )
        else:
            rag_index.status = "ready"

        return rag_index

    async def _process_documents_background(
            self,
            rag_index: RAGIndex,
            documents: List[UploadFile]
    ):
        """Processa documentos em background para o índice RAG"""
        try:
            all_chunks = []

            for document in documents:
                # Ler conteúdo do arquivo
                content = await document.read()

                # Processar documento baseado no tipo
                if document.content_type == "application/pdf":
                    text = await self.document_processor.extract_pdf_text(content)
                elif document.content_type in ["text/plain", "text/markdown"]:
                    text = content.decode('utf-8')
                elif document.content_type in [
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                ]:
                    text = await self.document_processor.extract_docx_text(content)
                else:
                    continue  # Skip unsupported file types

                # Dividir em chunks
                chunks = self.document_processor.split_text(
                    text=text,
                    chunk_size=rag_index.chunk_size,
                    chunk_overlap=rag_index.chunk_overlap
                )

                # Adicionar metadados
                for i, chunk in enumerate(chunks):
                    chunk_data = {
                        'text': chunk,
                        'source': document.filename,
                        'chunk_index': i,
                        'document_type': document.content_type
                    }
                    all_chunks.append(chunk_data)

            # Gerar embeddings
            texts = [chunk['text'] for chunk in all_chunks]
            embeddings = await self.embedding_service.create_embeddings(
                texts=texts,
                model=rag_index.embedding_model
            )

            # Salvar no vector store
            await self.vector_store.add_documents(
                index_name=rag_index.name,
                documents=all_chunks,
                embeddings=embeddings
            )

            # Atualizar status
            rag_index.status = "ready"
            rag_index.document_count = len(all_chunks)
            self.db.commit()

        except Exception as e:
            rag_index.status = "error"
            rag_index.error_message = str(e)
            self.db.commit()
            print(f"Erro ao processar documentos: {e}")


# =====================================================
# ENDPOINTS
# =====================================================

@router.get("/", response_model=List[AgentResponse])
async def get_agents(
        skip: int = 0,
        limit: int = 100,
        active_only: bool = True,
        db: Session = Depends(get_db)
):
    """Lista todos os agentes com suas configurações"""
    query = db.query(Agent)

    if active_only:
        query = query.filter(Agent.is_active == True)

    agents = query.offset(skip).limit(limit).all()

    # Enriquecer com dados das ferramentas
    result = []
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
            "created_at": agent.created_at,
            "updated_at": agent.updated_at,
            "tools": [],
            "rag_config": None
        }

        # Adicionar ferramentas
        for agent_tool in agent.agent_tools:
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

        result.append(agent_dict)

    return result


@router.get("/{agent_id}", response_model=AgentResponse)
async def get_agent(agent_id: str, db: Session = Depends(get_db)):
    """Obtém detalhes de um agente específico"""
    agent = db.query(Agent).filter(Agent.id == agent_id).first()

    if not agent:
        raise HTTPException(status_code=404, detail="Agente não encontrado")

    return agent


@router.post("/", response_model=AgentResponse)
async def create_agent(
        agent_data: CreateAgentRequest,
        db: Session = Depends(get_db)
):
    """Cria um novo agente com ferramentas e RAG"""
    try:
        service = AgentService(db)
        agent = await service.create_agent_with_rag(agent_data)
        return agent

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
        db: Session = Depends(get_db)
):
    """Upload de documentos para o índice RAG do agente"""

    agent = db.query(Agent).filter(Agent.id == agent_id).first()
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
        db: Session = Depends(get_db)
):
    """Atualiza configurações de um agente"""

    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agente não encontrado")

    try:
        # Atualizar campos básicos
        update_dict = update_data.dict(exclude_unset=True)

        for field, value in update_dict.items():
            if field == 'tools':
                # Atualizar ferramentas
                # Remover associações existentes
                db.query(AgentTool).filter(
                    AgentTool.agent_id == agent_id
                ).delete()

                # Criar novas associações
                service = AgentService(db)
                await service._configure_agent_tools(agent, value)

            elif field == 'rag_config':
                # Atualizar configuração RAG
                if value.enabled and not agent.rag_enabled:
                    # Habilitar RAG
                    service = AgentService(db)
                    rag_index = await service._setup_rag_index(agent, value)
                    agent.rag_index_id = rag_index.id
                    agent.rag_enabled = True

                elif not value.enabled and agent.rag_enabled:
                    # Desabilitar RAG
                    if agent.rag_index:
                        # Remover do vector store
                        await service.vector_store.delete_index(agent.rag_index.name)
                        db.delete(agent.rag_index)

                    agent.rag_enabled = False
                    agent.rag_index_id = None

            elif field in ['model_provider']:
                setattr(agent, field, value.value if hasattr(value, 'value') else value)
            else:
                setattr(agent, field, value)

        agent.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(agent)

        return agent

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao atualizar agente: {str(e)}"
        )


@router.delete("/{agent_id}")
async def delete_agent(agent_id: str, db: Session = Depends(get_db)):
    """Remove um agente (soft delete)"""

    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agente não encontrado")

    try:
        # Soft delete
        agent.is_active = False
        agent.updated_at = datetime.utcnow()

        # Se tem RAG habilitado, manter os dados mas marcar como inativo
        if agent.rag_index:
            agent.rag_index.status = "inactive"

        db.commit()

        return {"message": "Agente removido com sucesso"}

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao remover agente: {str(e)}"
        )


@router.post("/{agent_id}/test")
async def test_agent(
        agent_id: str,
        message: str = Form(...),
        db: Session = Depends(get_db)
):
    """Testa um agente com uma mensagem"""

    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agente não encontrado")

    try:
        # TODO: Implementar execução do agente usando o Agno framework
        # Por now, retornar resposta mock

        response = {
            "agent_id": agent_id,
            "message": message,
            "response": f"Olá! Sou o {agent.name}, {agent.role}. Recebi sua mensagem: '{message}'",
            "tools_used": [tool.tool.name for tool in agent.agent_tools[:3]],
            "rag_used": agent.rag_enabled,
            "execution_time": 1.23
        }

        return response

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao testar agente: {str(e)}"
        )


@router.get("/{agent_id}/rag/status")
async def get_rag_status(agent_id: str, db: Session = Depends(get_db)):
    """Obtém status do processamento RAG"""

    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agente não encontrado")

    if not agent.rag_enabled or not agent.rag_index:
        return {"enabled": False}

    rag_index = agent.rag_index

    return {
        "enabled": True,
        "status": rag_index.status,
        "document_count": rag_index.document_count,
        "error_message": rag_index.error_message,
        "last_updated": rag_index.updated_at
    }


# =====================================================
# ENDPOINTS PARA FERRAMENTAS DISPONÍVEIS
# =====================================================

@router.get("/tools/available")
async def get_available_tools(
        category: Optional[str] = None,
        db: Session = Depends(get_db)
):
    """Lista ferramentas disponíveis para agentes"""

    query = db.query(Tool).filter(Tool.is_active == True)

    if category:
        query = query.filter(Tool.category == category)

    tools = query.all()

    return [
        {
            "id": tool.id,
            "name": tool.name,
            "description": tool.description,
            "category": tool.category,
            "config_schema": tool.config_schema,
            "requires_auth": tool.requires_auth
        }
        for tool in tools
    ]