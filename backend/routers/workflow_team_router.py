# backend/routers/workflow_team_router.py - VERSÃO CORRIGIDA COMPLETA

from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, insert, update, delete, func, desc
import json
import uuid

import sys
import os
from models.database import get_db
from models.agents import Agent, Team, TeamAgent

router = APIRouter(tags=["Workflow & Team Builder"])


# ==================== PYDANTIC MODELS ====================

class NodeConfigRequest(BaseModel):
    id: str
    type: str
    name: str
    position: Dict[str, float]
    config: Dict[str, Any]
    status: str = 'idle'


class WorkflowConnectionRequest(BaseModel):
    from_node: str
    to_node: str
    condition: Optional[str] = None


class VisualWorkflowRequest(BaseModel):
    name: str
    description: str
    nodes: List[NodeConfigRequest]
    connections: List[WorkflowConnectionRequest]
    metadata: Dict[str, Any] = {}


class TeamRequest(BaseModel):
    name: str
    description: str
    team_type: str = 'collaborative'
    agents: List[Dict[str, Any]]
    supervisor_config: Optional[Dict[str, Any]] = None


class WorkflowExecutionRequest(BaseModel):
    workflow_id: str
    input_data: Dict[str, Any]


class TeamExecutionRequest(BaseModel):
    team_id: str
    message: str


class WorkflowFromTemplateRequest(BaseModel):
    template_id: int
    name: str
    customizations: Optional[Dict[str, Any]] = None


# ==================== STORAGE EM MEMÓRIA (TEMPORÁRIO) ====================
WORKFLOWS_STORAGE = {}
TEAMS_STORAGE = {}
EXECUTIONS_STORAGE = {}


def get_mock_user_id() -> int:
    """Retorna user_id mock para desenvolvimento"""
    return 1


# ==================== TEAMS ENDPOINTS CORRIGIDOS ====================

@router.get("/teams", response_model=List[Dict])
async def list_teams(user_id: int = 1, db: AsyncSession = Depends(get_db)):
    """Lista todos os teams do usuário - VERSÃO CORRIGIDA"""
    try:
        # Query simples sem relacionamentos problemáticos
        result = await db.execute(
            select(Team)
            .where(Team.user_id == user_id, Team.is_active == True)
            .order_by(desc(Team.created_at))
        )
        teams = result.scalars().all()

        # Buscar dados dos agentes para cada team
        teams_list = []
        for team in teams:
            # Buscar team_agents
            team_agents_result = await db.execute(
                select(TeamAgent).where(
                    TeamAgent.team_id == team.id,
                    TeamAgent.is_active == True
                )
            )
            team_agents = team_agents_result.scalars().all()

            # Buscar dados dos agentes
            agents_data = []
            if team_agents:
                agent_ids = [ta.agent_id for ta in team_agents]
                agents_result = await db.execute(
                    select(Agent).where(Agent.id.in_(agent_ids), Agent.is_active == True)
                )
                agents = {agent.id: agent for agent in agents_result.scalars().all()}

                for ta in team_agents:
                    if ta.agent_id in agents:
                        agent = agents[ta.agent_id]
                        agent_data = {
                            "id": agent.id,
                            "name": agent.name,
                            "role": agent.role,
                            "role_in_team": ta.role_in_team,
                            "priority": ta.priority
                        }
                        agents_data.append(agent_data)

            team_dict = {
                "id": team.id,
                "name": team.name,
                "description": team.description,
                "team_type": team.team_type,
                "is_active": team.is_active,
                "created_at": team.created_at.isoformat() if team.created_at else None,
                "updated_at": team.updated_at.isoformat() if team.updated_at else None,
                "agents": agents_data,
                "agent_count": len(agents_data)
            }
            teams_list.append(team_dict)

        print(f"💡 INFO     | 📋 Listados {len(teams_list)} teams para usuário {user_id}")
        return teams_list

    except Exception as e:
        print(f"❌ ERROR    | Erro ao listar teams: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/teams/{team_id}", response_model=Dict)
async def get_team(team_id: int, user_id: int = 1, db: AsyncSession = Depends(get_db)):
    """Busca detalhes de um team específico - VERSÃO CORRIGIDA"""
    try:
        # Buscar team
        result = await db.execute(
            select(Team).where(Team.id == team_id, Team.user_id == user_id)
        )
        team = result.scalar_one_or_none()

        if not team:
            raise HTTPException(status_code=404, detail="Team não encontrado")

        # Buscar team_agents
        team_agents_result = await db.execute(
            select(TeamAgent).where(
                TeamAgent.team_id == team_id,
                TeamAgent.is_active == True
            )
        )
        team_agents = team_agents_result.scalars().all()

        # Buscar dados dos agentes
        agents_data = []
        if team_agents:
            agent_ids = [ta.agent_id for ta in team_agents]
            agents_result = await db.execute(
                select(Agent).where(Agent.id.in_(agent_ids), Agent.is_active == True)
            )
            agents = {agent.id: agent for agent in agents_result.scalars().all()}

            for ta in team_agents:
                if ta.agent_id in agents:
                    agent = agents[ta.agent_id]
                    agent_data = {
                        "id": agent.id,
                        "name": agent.name,
                        "role": agent.role,
                        "description": agent.description,
                        "model_provider": agent.model_provider,
                        "model_id": agent.model_id,
                        "role_in_team": ta.role_in_team,
                        "priority": ta.priority,
                        "tools": agent.tools or []
                    }
                    agents_data.append(agent_data)

        team_dict = {
            "id": team.id,
            "name": team.name,
            "description": team.description,
            "team_type": team.team_type,
            "is_active": team.is_active,
            "created_at": team.created_at.isoformat() if team.created_at else None,
            "updated_at": team.updated_at.isoformat() if team.updated_at else None,
            "team_configuration": team.team_configuration or {},
            "agents": agents_data,
            "agent_count": len(agents_data)
        }

        return team_dict

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== WORKFLOWS ENDPOINTS ====================

@router.post("/workflows/visual", response_model=Dict[str, str])
async def create_visual_workflow(
        workflow_request: VisualWorkflowRequest,
        db: AsyncSession = Depends(get_db)
):
    """Cria um workflow visual"""
    try:
        workflow_id = str(uuid.uuid4())
        user_id = get_mock_user_id()

        workflow_data = {
            "id": workflow_id,
            "name": workflow_request.name,
            "description": workflow_request.description,
            "user_id": user_id,
            "workflow_type": "visual",
            "nodes": [node.dict() for node in workflow_request.nodes],
            "connections": [conn.dict() for conn in workflow_request.connections],
            "metadata": workflow_request.metadata,
            "is_active": True,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }

        WORKFLOWS_STORAGE[workflow_id] = workflow_data
        return {"workflow_id": workflow_id, "message": "Workflow criado com sucesso"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/workflows", response_model=List[Dict])
async def list_workflows(user_id: int = 1, db: AsyncSession = Depends(get_db)):
    """Lista todos os workflows do usuário"""
    try:
        workflows_list = []

        # Adicionar workflows de exemplo se storage estiver vazio
        if not WORKFLOWS_STORAGE:
            example_workflows = [
                {
                    "id": "example_workflow_1",
                    "name": "Workflow de Análise",
                    "description": "Análise automática de dados",
                    "user_id": user_id,
                    "workflow_type": "visual",
                    "nodes": [
                        {"id": "start", "type": "start", "name": "Início"},
                        {"id": "agent1", "type": "agent", "name": "Agente Analista"}
                    ],
                    "connections": [{"from_node": "start", "to_node": "agent1"}],
                    "metadata": {"version": "1.0"},
                    "is_active": True,
                    "created_at": datetime.utcnow().isoformat(),
                    "updated_at": datetime.utcnow().isoformat()
                }
            ]

            for workflow in example_workflows:
                WORKFLOWS_STORAGE[workflow["id"]] = workflow

        # Retornar workflows ativos do usuário
        for workflow_id, workflow_data in WORKFLOWS_STORAGE.items():
            if workflow_data.get("user_id") == user_id and workflow_data.get("is_active", True):
                workflows_list.append(workflow_data)

        return workflows_list

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/workflows/{workflow_id}", response_model=Dict)
async def get_workflow(workflow_id: str, user_id: int = 1, db: AsyncSession = Depends(get_db)):
    """Busca detalhes de um workflow específico"""
    try:
        if workflow_id not in WORKFLOWS_STORAGE:
            raise HTTPException(status_code=404, detail="Workflow não encontrado")

        workflow_data = WORKFLOWS_STORAGE[workflow_id]

        if workflow_data.get("user_id") != user_id:
            raise HTTPException(status_code=404, detail="Workflow não encontrado")

        return workflow_data

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/workflows/{workflow_id}/execute", response_model=Dict[str, str])
async def execute_workflow(
        workflow_id: str,
        execution_request: WorkflowExecutionRequest,
        background_tasks: BackgroundTasks,
        db: AsyncSession = Depends(get_db)
):
    """Executa um workflow visual"""
    try:
        if workflow_id not in WORKFLOWS_STORAGE:
            raise HTTPException(status_code=404, detail="Workflow não encontrado")

        workflow_data = WORKFLOWS_STORAGE[workflow_id]
        execution_id = str(uuid.uuid4())

        # Simular execução
        EXECUTIONS_STORAGE[execution_id] = {
            "id": execution_id,
            "workflow_id": workflow_id,
            "status": "running",
            "input_data": execution_request.input_data,
            "started_at": datetime.utcnow().isoformat()
        }

        return {
            "execution_id": execution_id,
            "message": "Execução iniciada com sucesso"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== TEMPLATES ENDPOINTS ====================

@router.get("/templates", response_model=List[Dict])
async def list_workflow_templates(category: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    """Lista templates de workflow disponíveis"""
    try:
        templates = [
            {
                "id": 1,
                "name": "Análise de Dados",
                "description": "Template para análise automática de dados",
                "category": "analytics",
                "usage_count": 15,
                "template_definition": {
                    "nodes": [
                        {"id": "start", "type": "start", "name": "Início"},
                        {"id": "analyze", "type": "agent", "name": "Analisar"},
                        {"id": "report", "type": "agent", "name": "Relatório"}
                    ],
                    "connections": [
                        {"from_node": "start", "to_node": "analyze"},
                        {"from_node": "analyze", "to_node": "report"}
                    ]
                }
            },
            {
                "id": 2,
                "name": "Atendimento ao Cliente",
                "description": "Template para fluxo de atendimento",
                "category": "customer_service",
                "usage_count": 8,
                "template_definition": {
                    "nodes": [
                        {"id": "start", "type": "start", "name": "Início"},
                        {"id": "classify", "type": "agent", "name": "Classificar"},
                        {"id": "respond", "type": "agent", "name": "Responder"}
                    ],
                    "connections": [
                        {"from_node": "start", "to_node": "classify"},
                        {"from_node": "classify", "to_node": "respond"}
                    ]
                }
            }
        ]

        if category:
            templates = [t for t in templates if t["category"] == category]

        return templates

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/workflows/from-template", response_model=Dict[str, str])
async def create_workflow_from_template(
        template_request: WorkflowFromTemplateRequest,
        db: AsyncSession = Depends(get_db)
):
    """Cria um workflow a partir de um template"""
    try:
        workflow_id = str(uuid.uuid4())

        workflow_data = {
            "id": workflow_id,
            "name": template_request.name,
            "description": f"Workflow criado a partir do template {template_request.template_id}",
            "user_id": get_mock_user_id(),
            "workflow_type": "template",
            "template_id": template_request.template_id,
            "customizations": template_request.customizations,
            "is_active": True,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }

        WORKFLOWS_STORAGE[workflow_id] = workflow_data

        return {
            "workflow_id": workflow_id,
            "message": "Workflow criado a partir do template com sucesso"
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== ANALYTICS ENDPOINTS ====================

@router.get("/analytics/workflows", response_model=Dict)
async def get_workflow_analytics(user_id: int = 1, db: AsyncSession = Depends(get_db)):
    """Analytics de workflows do usuário"""
    try:
        user_workflows = [w for w in WORKFLOWS_STORAGE.values() if w.get("user_id") == user_id]
        total_workflows = len(user_workflows)
        total_executions = len(EXECUTIONS_STORAGE)

        recent_executions = list(EXECUTIONS_STORAGE.values())[-5:]

        stats = {
            'total_workflows': total_workflows,
            'total_executions': total_executions,
            'recent_executions': recent_executions,
            'success_rate': 85.5
        }

        return stats

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/analytics/teams", response_model=Dict)
async def get_team_analytics(user_id: int = 1, db: AsyncSession = Depends(get_db)):
    """Analytics de teams do usuário"""
    try:
        # Contar teams
        teams_result = await db.execute(
            select(func.count(Team.id))
            .where(Team.user_id == user_id, Team.is_active == True)
        )
        total_teams = teams_result.scalar()

        # Teams mais usados (simulado)
        most_used_result = await db.execute(
            select(Team.id, Team.name)
            .where(Team.user_id == user_id, Team.is_active == True)
            .limit(5)
        )
        most_used_teams = [
            {"id": row[0], "name": row[1], "usage_count": 0}
            for row in most_used_result.fetchall()
        ]

        stats = {
            'total_teams': total_teams,
            'active_teams': total_teams,
            'most_used_teams': most_used_teams
        }

        return stats

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))