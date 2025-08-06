# app/models/tools.py - Modelo para ferramentas

from sqlalchemy import Column, String, Text, Boolean, JSON, DateTime, Integer
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.database import Base


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

    def __repr__(self):
        return f"<Tool(id='{self.id}', name='{self.name}', category='{self.category}')>"