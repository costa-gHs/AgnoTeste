# backend/models/agents.py - VERSÃO CORRIGIDA PARA POSTGRESQL

from sqlalchemy import Column, Integer, String, Text, Boolean, JSON, DateTime
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()


class Agent(Base):
    __tablename__ = "agno_agents"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, default=1)
    name = Column(String(100), nullable=False, index=True)
    description = Column(Text, nullable=True)
    role = Column(String(200), nullable=False)
    model_provider = Column(String(50), nullable=False)
    model_id = Column(String(100), nullable=False)
    instructions = Column(JSON, nullable=True, default=list)
    tools = Column(JSON, nullable=True, default=list)
    configuration = Column(JSON, nullable=True, default=dict)
    memory_enabled = Column(Boolean, default=True)
    rag_enabled = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    rag_index_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Team(Base):
    __tablename__ = "agno_teams"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, default=1)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    team_type = Column(String(50), default='collaborative')
    supervisor_agent_id = Column(Integer, nullable=True)
    team_configuration = Column(JSON, default=dict)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class TeamAgent(Base):
    __tablename__ = "agno_team_agents"

    id = Column(Integer, primary_key=True, index=True)
    team_id = Column(Integer, nullable=False)
    agent_id = Column(Integer, nullable=False)
    role_in_team = Column(String(50), nullable=True)
    priority = Column(Integer, default=1)
    agent_config = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)