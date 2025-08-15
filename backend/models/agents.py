# backend/models/agents.py - VERSÃO CORRIGIDA COM RELACIONAMENTOS EXPLÍCITOS

from sqlalchemy import Column, String, Text, Boolean, JSON, DateTime, Integer, ForeignKey, Float
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from database import Base  # Se database.py está no PYTHONPATH


class Agent(Base):
    """Modelo para agentes AI"""
    __tablename__ = "agents"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), nullable=False, index=True)
    role = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)

    # 🔴 ADICIONADO: user_id que estava faltando
    user_id = Column(Integer, nullable=False, default=1)

    # Configuração do modelo
    model_provider = Column(String(50), nullable=False)  # openai, anthropic, groq, etc
    model_id = Column(String(100), nullable=False)  # gpt-4, claude-3-opus, etc

    # Instruções e configuração
    instructions = Column(JSON, nullable=True, default=list)  # Lista de instruções
    configuration = Column(JSON, nullable=True, default=dict)  # Config específica do modelo

    # Features
    memory_enabled = Column(Boolean, default=True)
    rag_enabled = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)

    # RAG configuration
    rag_index_id = Column(String, ForeignKey("rag_indexes.id"), nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # 🔴 CORREÇÃO: Relacionamentos com foreign_keys explícitos
    agent_tools = relationship("AgentTool", back_populates="agent", cascade="all, delete-orphan")

    # 🔴 CORREÇÃO PRINCIPAL: Especificar foreign_keys explicitamente
    rag_index = relationship(
        "RAGIndex",
        foreign_keys=[rag_index_id],
        primaryjoin="Agent.rag_index_id==RAGIndex.id",
        post_update=True
    )

    team_memberships = relationship("TeamAgent", back_populates="agent")
    conversations = relationship("Conversation", back_populates="agent", cascade="all, delete-orphan")

    # 🔴 ADICIONADO: Relacionamento para quando o agente é supervisor
    supervised_teams = relationship(
        "Team",
        foreign_keys="Team.supervisor_agent_id",
        back_populates="supervisor"
    )


class Tool(Base):
    """Modelo para ferramentas disponíveis"""
    __tablename__ = "tools"

    id = Column(String, primary_key=True)  # web_search, database_query, etc
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=False)
    category = Column(String(50), nullable=False)  # data, communication, productivity, etc

    # Configuração da ferramenta
    config_schema = Column(JSON, nullable=True)  # JSON Schema para validação de config
    requires_auth = Column(Boolean, default=False)
    requires_setup = Column(Boolean, default=False)

    # Metadados
    icon_name = Column(String(50), nullable=True)  # Nome do ícone Lucide
    documentation_url = Column(String(500), nullable=True)

    # Status
    is_active = Column(Boolean, default=True)
    is_premium = Column(Boolean, default=False)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relacionamentos
    agent_tools = relationship("AgentTool", back_populates="tool")


class AgentTool(Base):
    """Associação entre agentes e ferramentas"""
    __tablename__ = "agent_tools"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    agent_id = Column(String, ForeignKey("agents.id"), nullable=False)
    tool_id = Column(String, ForeignKey("tools.id"), nullable=False)

    # Configuração específica da ferramenta para este agente
    configuration = Column(JSON, nullable=True, default=dict)

    # Status
    is_enabled = Column(Boolean, default=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relacionamentos
    agent = relationship("Agent", back_populates="agent_tools")
    tool = relationship("Tool", back_populates="agent_tools")


class RAGIndex(Base):
    """Modelo para índices RAG (Retrieval-Augmented Generation)"""
    __tablename__ = "rag_indexes"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), nullable=False, unique=True)

    # 🔴 CORREÇÃO: Remover agent_id como ForeignKey para evitar ciclo
    # O relacionamento é mantido através de Agent.rag_index_id

    # Configuração do embedding
    embedding_model = Column(String(100), nullable=False)  # text-embedding-3-small, etc
    vector_dimension = Column(Integer, nullable=True)  # Dimension do embedding

    # Configuração de chunking
    chunk_size = Column(Integer, default=1000)
    chunk_overlap = Column(Integer, default=200)

    # Configuração de retrieval
    top_k = Column(Integer, default=5)
    threshold = Column(Float, default=0.7)

    # Status e metadados
    status = Column(String(20), default="creating")  # creating, ready, error, updating
    document_count = Column(Integer, default=0)
    total_chunks = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_indexed_at = Column(DateTime, nullable=True)

    # 🔴 CORREÇÃO: Relacionamento com Agent sem ambiguidade
    # Removido back_populates para evitar conflito
    documents = relationship("RAGDocument", back_populates="index", cascade="all, delete-orphan")


class RAGDocument(Base):
    """Modelo para documentos no índice RAG"""
    __tablename__ = "rag_documents"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    index_id = Column(String, ForeignKey("rag_indexes.id"), nullable=False)

    # Metadados do documento
    filename = Column(String(255), nullable=False)
    content_type = Column(String(100), nullable=False)
    file_size = Column(Integer, nullable=True)
    file_hash = Column(String(64), nullable=True)  # SHA256 para detectar duplicatas

    # Processamento
    status = Column(String(20), default="processing")  # processing, ready, error
    chunk_count = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)

    # Timestamps
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    processed_at = Column(DateTime, nullable=True)

    # Relacionamentos
    index = relationship("RAGIndex", back_populates="documents")
    chunks = relationship("RAGChunk", back_populates="document", cascade="all, delete-orphan")


class RAGChunk(Base):
    """Modelo para chunks de documentos processados"""
    __tablename__ = "rag_chunks"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id = Column(String, ForeignKey("rag_documents.id"), nullable=False)

    # Conteúdo do chunk
    content = Column(Text, nullable=False)
    chunk_index = Column(Integer, nullable=False)

    # Metadados
    start_position = Column(Integer, nullable=True)
    end_position = Column(Integer, nullable=True)

    # Vector store reference (para cleanup)
    vector_id = Column(String(100), nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relacionamentos
    document = relationship("RAGDocument", back_populates="chunks")


# =====================================================
# MODELOS PARA TEAMS
# =====================================================

class Team(Base):
    """Modelo para teams de agentes"""
    __tablename__ = "teams"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)

    # 🔴 ADICIONADO: user_id que estava faltando
    user_id = Column(Integer, nullable=False, default=1)

    # Tipo de colaboração
    team_type = Column(String(20), nullable=False)  # collaborative, hierarchical, sequential

    # Configuração específica do tipo de team
    team_configuration = Column(JSON, nullable=True, default=dict)

    # Supervisor (para teams hierárquicos)
    supervisor_agent_id = Column(String, ForeignKey("agents.id"), nullable=True)

    # Status
    is_active = Column(Boolean, default=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # 🔴 CORREÇÃO: Relacionamentos com foreign_keys explícitos
    team_agents = relationship("TeamAgent", back_populates="team", cascade="all, delete-orphan")
    supervisor = relationship(
        "Agent",
        foreign_keys=[supervisor_agent_id],
        back_populates="supervised_teams"
    )
    executions = relationship("TeamExecution", back_populates="team", cascade="all, delete-orphan")


class TeamAgent(Base):
    """Associação entre teams e agentes"""
    __tablename__ = "team_agents"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    team_id = Column(String, ForeignKey("teams.id"), nullable=False)
    agent_id = Column(String, ForeignKey("agents.id"), nullable=False)

    # Papel do agente no team
    role_in_team = Column(String(50), nullable=True)  # leader, specialist, reviewer, etc
    priority = Column(Integer, nullable=True)  # Para teams sequenciais

    # Status
    is_active = Column(Boolean, default=True)

    # Timestamps
    added_at = Column(DateTime, default=datetime.utcnow)

    # Relacionamentos
    team = relationship("Team", back_populates="team_agents")
    agent = relationship("Agent", back_populates="team_memberships")


class TeamExecution(Base):
    """Modelo para execuções de teams"""
    __tablename__ = "team_executions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    team_id = Column(String, ForeignKey("teams.id"), nullable=False)

    # Input e output
    input_message = Column(Text, nullable=False)
    output_response = Column(Text, nullable=True)

    # Status da execução
    status = Column(String(20), default="pending")  # pending, running, completed, failed

    # Metadados da execução
    execution_metadata = Column(JSON, nullable=True, default=dict)
    error_message = Column(Text, nullable=True)

    # Métricas
    execution_time_ms = Column(Integer, nullable=True)
    agents_involved = Column(Integer, nullable=True)

    # Timestamps
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    # Relacionamentos
    team = relationship("Team", back_populates="executions")


# =====================================================
# MODELOS PARA CONVERSAS (OPCIONAL)
# =====================================================

class Conversation(Base):
    """Modelo para conversas/sessões com agentes"""
    __tablename__ = "conversations"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    agent_id = Column(String, ForeignKey("agents.id"), nullable=False)

    # 🔴 ADICIONADO: user_id
    user_id = Column(Integer, nullable=False, default=1)

    title = Column(String(200), nullable=True)

    # Status
    is_active = Column(Boolean, default=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relacionamentos
    agent = relationship("Agent", back_populates="conversations")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")


class Message(Base):
    """Modelo para mensagens em conversas"""
    __tablename__ = "messages"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id = Column(String, ForeignKey("conversations.id"), nullable=False)

    # Conteúdo
    role = Column(String(20), nullable=False)  # user, assistant, system
    content = Column(Text, nullable=False)

    # Metadados
    execution_message_metadata = Column(JSON, nullable=True, default=dict)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relacionamentos
    conversation = relationship("Conversation", back_populates="messages")