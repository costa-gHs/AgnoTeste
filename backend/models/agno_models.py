# backend/models/agno_models.py

from sqlalchemy import Column, Integer, String, Text, Boolean, JSON, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from enum import Enum

Base = declarative_base()


class ToolStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    ERROR = "error"


class ToolCategory(str, Enum):
    WEB_SEARCH = "web_search"
    FINANCIAL = "financial"
    AI_MEDIA = "ai_media"
    CLOUD = "cloud"
    UTILITIES = "utilities"
    REASONING = "reasoning"


# ================================
# MODELOS DE BANCO DE DADOS
# ================================

class AgnoTool(Base):
    """Modelo para ferramentas do Agno disponíveis"""
    __tablename__ = "agno_tools"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False, index=True)
    display_name = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    category = Column(String(50), nullable=False)
    class_path = Column(String(200), nullable=False)  # ex: agno.tools.duckduckgo.DuckDuckGoTools
    required_packages = Column(JSON, default=list)  # Lista de pacotes necessários
    config_schema = Column(JSON, default=dict)  # Schema de configuração
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relacionamentos
    agent_tools = relationship("AgentTool", back_populates="tool")
    tool_executions = relationship("ToolExecution", back_populates="tool")


class AgentTool(Base):
    """Relacionamento entre agentes e ferramentas com configurações"""
    __tablename__ = "agent_tools"

    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, nullable=False, index=True)  # referência ao agente
    tool_id = Column(Integer, ForeignKey("agno_tools.id"), nullable=False)
    config = Column(JSON, default=dict)  # Configurações específicas da ferramenta
    is_enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relacionamentos
    tool = relationship("AgnoTool", back_populates="agent_tools")


class ToolExecution(Base):
    """Log de execuções de ferramentas"""
    __tablename__ = "tool_executions"

    id = Column(Integer, primary_key=True, index=True)
    tool_id = Column(Integer, ForeignKey("agno_tools.id"), nullable=False)
    agent_id = Column(Integer, nullable=False, index=True)
    user_id = Column(Integer, nullable=False, index=True)

    # Detalhes da execução
    method_called = Column(String(100), nullable=False)  # método da ferramenta executado
    input_params = Column(JSON, default=dict)  # parâmetros de entrada
    output_result = Column(Text)  # resultado da execução
    status = Column(String(20), default="success")  # success, error, timeout
    error_message = Column(Text)  # mensagem de erro se houver
    execution_time_ms = Column(Integer)  # tempo de execução em ms

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relacionamentos
    tool = relationship("AgnoTool", back_populates="tool_executions")


# ================================
# MODELOS PYDANTIC (API)
# ================================

class ToolConfigSchema(BaseModel):
    """Schema base para configuração de ferramentas"""
    show_result: bool = Field(default=True, description="Mostrar resultado da ferramenta")
    stop_after_tool_call: bool = Field(default=False, description="Parar após chamada da ferramenta")


class DuckDuckGoConfig(ToolConfigSchema):
    """Configuração para DuckDuckGo Tools"""
    max_results: int = Field(default=5, ge=1, le=20, description="Máximo de resultados")


class YFinanceConfig(ToolConfigSchema):
    """Configuração para YFinance Tools"""
    stock_price: bool = Field(default=True, description="Habilitar preços de ações")
    analyst_recommendations: bool = Field(default=True, description="Habilitar recomendações")
    stock_fundamentals: bool = Field(default=True, description="Habilitar fundamentos")
    company_info: bool = Field(default=True, description="Habilitar informações da empresa")
    company_news: bool = Field(default=True, description="Habilitar notícias")


class GoogleSearchConfig(ToolConfigSchema):
    """Configuração para Google Search Tools"""
    api_key: Optional[str] = Field(default=None, description="API Key do Google")
    cse_id: Optional[str] = Field(default=None, description="Custom Search Engine ID")


class DALLEConfig(ToolConfigSchema):
    """Configuração para DALLE Tools"""
    image_generation: bool = Field(default=True, description="Habilitar geração de imagens")
    size: str = Field(default="1024x1024", description="Tamanho da imagem")
    quality: str = Field(default="standard", description="Qualidade da imagem")


# Modelos de resposta da API
class AgnoToolResponse(BaseModel):
    id: int
    name: str
    display_name: str
    description: str
    category: ToolCategory
    class_path: str
    required_packages: List[str]
    config_schema: Dict[str, Any]
    is_active: bool
    created_at: datetime


class AgentToolResponse(BaseModel):
    id: int
    tool: AgnoToolResponse
    config: Dict[str, Any]
    is_enabled: bool
    created_at: datetime


class ToolExecutionResponse(BaseModel):
    id: int
    tool_name: str
    method_called: str
    input_params: Dict[str, Any]
    output_result: Optional[str]
    status: str
    error_message: Optional[str]
    execution_time_ms: Optional[int]
    created_at: datetime


# Modelos de request da API
class CreateAgentToolRequest(BaseModel):
    tool_id: int
    config: Dict[str, Any] = Field(default_factory=dict)
    is_enabled: bool = Field(default=True)


class UpdateAgentToolRequest(BaseModel):
    config: Optional[Dict[str, Any]] = None
    is_enabled: Optional[bool] = None


class ExecuteToolRequest(BaseModel):
    method: str
    params: Dict[str, Any] = Field(default_factory=dict)


class AgentWithToolsRequest(BaseModel):
    """Request para criar agente com ferramentas"""
    agent_config: Dict[str, Any]
    tools: List[CreateAgentToolRequest]
    prompt: str


# ================================
# CONFIGURAÇÕES DE FERRAMENTAS PREDEFINIDAS
# ================================

PREDEFINED_TOOLS = [
    {
        "name": "duckduckgo",
        "display_name": "DuckDuckGo Search",
        "description": "Pesquisa na web usando DuckDuckGo - focado em privacidade",
        "category": ToolCategory.WEB_SEARCH,
        "class_path": "agno.tools.duckduckgo.DuckDuckGoTools",
        "required_packages": ["duckduckgo-search"],
        "config_schema": DuckDuckGoConfig.model_json_schema()
    },
    {
        "name": "yfinance",
        "display_name": "Yahoo Finance",
        "description": "Dados financeiros do Yahoo Finance - ações, recomendações, notícias",
        "category": ToolCategory.FINANCIAL,
        "class_path": "agno.tools.yfinance.YFinanceTools",
        "required_packages": ["yfinance"],
        "config_schema": YFinanceConfig.model_json_schema()
    },
    {
        "name": "google_search",
        "display_name": "Google Search",
        "description": "Pesquisa programável do Google",
        "category": ToolCategory.WEB_SEARCH,
        "class_path": "agno.tools.googlesearch.GoogleSearchTools",
        "required_packages": ["google-api-python-client"],
        "config_schema": GoogleSearchConfig.model_json_schema()
    },
    {
        "name": "dalle",
        "display_name": "DALL-E Image Generation",
        "description": "Geração de imagens usando DALL-E da OpenAI",
        "category": ToolCategory.AI_MEDIA,
        "class_path": "agno.tools.dalle.DalleTools",
        "required_packages": ["openai"],
        "config_schema": DALLEConfig.model_json_schema()
    },
    {
        "name": "calculator",
        "display_name": "Calculator",
        "description": "Ferramentas matemáticas básicas",
        "category": ToolCategory.UTILITIES,
        "class_path": "agno.tools.calculator.CalculatorTools",
        "required_packages": [],
        "config_schema": ToolConfigSchema.model_json_schema()
    },
    {
        "name": "reasoning",
        "display_name": "Reasoning Tools",
        "description": "Ferramentas de raciocínio chain-of-thought",
        "category": ToolCategory.REASONING,
        "class_path": "agno.tools.reasoning.ReasoningTools",
        "required_packages": [],
        "config_schema": ToolConfigSchema.model_json_schema()
    },
    {
        "name": "youtube",
        "display_name": "YouTube Tools",
        "description": "Extração de transcrições e metadados de vídeos do YouTube",
        "category": ToolCategory.AI_MEDIA,
        "class_path": "agno.tools.youtube.YouTubeTools",
        "required_packages": ["youtube-transcript-api"],
        "config_schema": ToolConfigSchema.model_json_schema()
    },
    {
        "name": "newspaper",
        "display_name": "Newspaper Tools",
        "description": "Extração de texto de artigos de notícias",
        "category": ToolCategory.WEB_SEARCH,
        "class_path": "agno.tools.newspaper.NewspaperTools",
        "required_packages": ["newspaper3k", "lxml_html_clean"],
        "config_schema": ToolConfigSchema.model_json_schema()
    }
]