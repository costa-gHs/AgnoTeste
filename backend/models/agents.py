# app/models/agents.py - Modelos para agentes, ferramentas e RAG

from sqlalchemy import Column, String, Text, Boolean, JSON, DateTime, Integer, ForeignKey, Float
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.database import Base


class Agent(Base):
    """Modelo para agentes AI"""
    __tablename__ = "agents"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), nullable=False, index=True)
    role = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)

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

    # Relacionamentos
    agent_tools = relationship("AgentTool", back_populates="agent", cascade="all, delete-orphan")
    rag_index = relationship("RAGIndex", back_populates="agent")
    team_memberships = relationship("TeamAgent", back_populates="agent")
    conversations = relationship("Conversation", back_populates="agent")


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
    agent_id = Column(String, ForeignKey("agents.id"), nullable=False)

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

    # Relacionamentos
    agent = relationship("Agent", back_populates="rag_index")
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

    # Relacionamentos
    team_agents = relationship("TeamAgent", back_populates="team", cascade="all, delete-orphan")
    supervisor = relationship("Agent", foreign_keys=[supervisor_agent_id])
    executions = relationship("TeamExecution", back_populates="team")


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
    status = Column(String(20), default="running")  # running, completed, failed, cancelled
    error_message = Column(Text, nullable=True)

    # Métricas
    execution_time_seconds = Column(Float, nullable=True)
    agents_used = Column(JSON, nullable=True, default=list)  # IDs dos agentes que participaram
    tools_used = Column(JSON, nullable=True, default=list)  # Ferramentas utilizadas
    total_tokens = Column(Integer, nullable=True)
    total_cost = Column(Float, nullable=True)

    # Timestamps
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    # Relacionamentos
    team = relationship("Team", back_populates="executions")
    steps = relationship("ExecutionStep", back_populates="execution", cascade="all, delete-orphan")


class ExecutionStep(Base):
    """Modelo para steps individuais de execução"""
    __tablename__ = "execution_steps"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    execution_id = Column(String, ForeignKey("team_executions.id"), nullable=False)
    agent_id = Column(String, ForeignKey("agents.id"), nullable=False)

    # Detalhes do step
    step_number = Column(Integer, nullable=False)
    input_message = Column(Text, nullable=False)
    output_response = Column(Text, nullable=True)

    # Status
    status = Column(String(20), default="running")  # running, completed, failed
    error_message = Column(Text, nullable=True)

    # Métricas
    execution_time_seconds = Column(Float, nullable=True)
    tools_used = Column(JSON, nullable=True, default=list)
    tokens_used = Column(Integer, nullable=True)
    cost = Column(Float, nullable=True)

    # Timestamps
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    # Relacionamentos
    execution = relationship("TeamExecution", back_populates="steps")
    agent = relationship("Agent")


# =====================================================
# MODELOS PARA CONVERSAS E HISTÓRICO
# =====================================================

class Conversation(Base):
    """Modelo para conversas com agentes"""
    __tablename__ = "conversations"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    agent_id = Column(String, ForeignKey("agents.id"), nullable=True)
    team_id = Column(String, ForeignKey("teams.id"), nullable=True)

    # Metadados da conversa
    title = Column(String(200), nullable=True)
    user_id = Column(String(100), nullable=True)  # Para futuro sistema de usuários

    # Status
    is_active = Column(Boolean, default=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_message_at = Column(DateTime, nullable=True)

    # Relacionamentos
    agent = relationship("Agent", back_populates="conversations")
    team = relationship("Team")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")


class Message(Base):
    """Modelo para mensagens individuais"""
    __tablename__ = "messages"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id = Column(String, ForeignKey("conversations.id"), nullable=False)

    # Conteúdo da mensagem
    role = Column(String(20), nullable=False)  # user, assistant, system
    content = Column(Text, nullable=False)

    # Metadados
    agent_id = Column(String, ForeignKey("agents.id"), nullable=True)  # Qual agente respondeu
    tool_calls = Column(JSON, nullable=True, default=list)  # Ferramentas utilizadas
    tokens_used = Column(Integer, nullable=True)
    execution_time_seconds = Column(Float, nullable=True)
    cost = Column(Float, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relacionamentos
    conversation = relationship("Conversation", back_populates="messages")
    agent = relationship("Agent")


# =====================================================
# SEED DATA PARA FERRAMENTAS
# =====================================================

INITIAL_TOOLS = [
    {
        "id": "web_search",
        "name": "Web Search",
        "description": "Busca em tempo real na internet com múltiplos provedores",
        "category": "data",
        "config_schema": {
            "type": "object",
            "properties": {
                "max_results": {"type": "integer", "default": 10, "minimum": 1, "maximum": 50},
                "search_engine": {"type": "string", "enum": ["google", "bing", "duckduckgo"], "default": "google"}
            }
        },
        "requires_auth": True,
        "icon_name": "search"
    },
    {
        "id": "database_query",
        "name": "Database Query",
        "description": "Executa consultas SQL em bancos de dados conectados",
        "category": "data",
        "config_schema": {
            "type": "object",
            "properties": {
                "connection_string": {"type": "string"},
                "read_only": {"type": "boolean", "default": True}
            }
        },
        "requires_auth": True,
        "requires_setup": True,
        "icon_name": "database"
    },
    {
        "id": "api_integration",
        "name": "API Integration",
        "description": "Integração com APIs REST e GraphQL externas",
        "category": "integration",
        "config_schema": {
            "type": "object",
            "properties": {
                "base_url": {"type": "string"},
                "auth_type": {"type": "string", "enum": ["bearer", "api_key", "basic"], "default": "bearer"},
                "timeout": {"type": "integer", "default": 30}
            }
        },
        "requires_auth": True,
        "requires_setup": True,
        "icon_name": "globe"
    },
    {
        "id": "code_generation",
        "name": "Code Generation",
        "description": "Gera código em Python, JavaScript, SQL e outras linguagens",
        "category": "development",
        "config_schema": {
            "type": "object",
            "properties": {
                "default_language": {"type": "string", "default": "python"},
                "include_comments": {"type": "boolean", "default": True},
                "code_style": {"type": "string", "enum": ["pep8", "google", "microsoft"], "default": "pep8"}
            }
        },
        "requires_auth": False,
        "icon_name": "code"
    },
    {
        "id": "email_processing",
        "name": "Email Processing",
        "description": "Análise, classificação e resposta automática de emails",
        "category": "communication",
        "config_schema": {
            "type": "object",
            "properties": {
                "imap_server": {"type": "string"},
                "smtp_server": {"type": "string"},
                "auto_reply": {"type": "boolean", "default": False}
            }
        },
        "requires_auth": True,
        "requires_setup": True,
        "icon_name": "mail"
    },
    {
        "id": "calendar_management",
        "name": "Calendar Management",
        "description": "Agendamento inteligente e gestão de calendários",
        "category": "productivity",
        "config_schema": {
            "type": "object",
            "properties": {
                "calendar_provider": {"type": "string", "enum": ["google", "outlook", "caldav"], "default": "google"},
                "time_zone": {"type": "string", "default": "America/Sao_Paulo"}
            }
        },
        "requires_auth": True,
        "requires_setup": True,
        "icon_name": "calendar"
    },
    {
        "id": "document_processing",
        "name": "Document Processing",
        "description": "Processamento de PDFs, DOCs e outros documentos",
        "category": "productivity",
        "config_schema": {
            "type": "object",
            "properties": {
                "extract_images": {"type": "boolean", "default": False},
                "preserve_formatting": {"type": "boolean", "default": True}
            }
        },
        "requires_auth": False,
        "icon_name": "file-text"
    },
    {
        "id": "image_analysis",
        "name": "Image Analysis",
        "description": "Análise de imagens com visão computacional",
        "category": "media",
        "config_schema": {
            "type": "object",
            "properties": {
                "vision_model": {"type": "string", "enum": ["gpt-4-vision", "claude-3-vision"],
                                 "default": "gpt-4-vision"},
                "max_image_size": {"type": "integer", "default": 2048}
            }
        },
        "requires_auth": True,
        "is_premium": True,
        "icon_name": "image"
    },
    {
        "id": "voice_processing",
        "name": "Voice Processing",
        "description": "Transcrição de áudio e síntese de voz",
        "category": "media",
        "config_schema": {
            "type": "object",
            "properties": {
                "transcription_model": {"type": "string", "enum": ["whisper-1"], "default": "whisper-1"},
                "voice_model": {"type": "string", "enum": ["tts-1", "tts-1-hd"], "default": "tts-1"}
            }
        },
        "requires_auth": True,
        "is_premium": True,
        "icon_name": "mic"
    }
]