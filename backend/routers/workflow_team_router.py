# backend/routers/workflow_team_router.py - CORREÇÃO PONTUAL PARA ERRO 500

from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, insert, update, delete, func, desc
from sqlalchemy.orm import selectinload
import json
import uuid

import sys
import os
from models.database import get_db
from models.agents import Agent, Team, TeamAgent

# ✅ CORREÇÃO PONTUAL: Remover classes mockadas e queries SQLAlchemy problemáticas
# TODO: Implementar modelos SQLAlchemy reais depois

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


# ✅ FUNÇÃO MOCK PARA USER_ID (temporária)
def get_mock_user_id() -> int:
    """Retorna user_id mock para desenvolvimento"""
    return 1


# ==================== STORAGE EM MEMÓRIA (TEMPORÁRIO) ====================
# TODO: Mover para banco quando os modelos estiverem prontos

WORKFLOWS_STORAGE = {}
TEAMS_STORAGE = {}
EXECUTIONS_STORAGE = {}


# ==================== TEAM BUILDER ENDPOINTS ====================

@router.post("/teams", response_model=Dict[str, str])
async def create_team(team_request: TeamRequest, db: AsyncSession = Depends(get_db)):
    """Cria um novo team de agentes"""
    try:
        user_id = get_mock_user_id()
        team_id = str(uuid.uuid4())

        # ✅ CORREÇÃO: Usar apenas models reais existentes do PostgreSQL
        # Verificar se os agentes existem
        for agent_data in team_request.agents:
            if 'id' in agent_data:
                result = await db.execute(
                    select(Agent).where(Agent.id == agent_data['id'])
                )
                agent = result.scalar_one_or_none()
                if not agent:
                    raise HTTPException(status_code=400, detail=f"Agente {agent_data['id']} não encontrado")

        # Criar team no PostgreSQL
        team_dict = {
            "id": team_id,
            "name": team_request.name,
            "description": team_request.description,
            "team_type": team_request.team_type,
            "team_configuration": team_request.supervisor_config or {},
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }

        result = await db.execute(
            insert(Team).values(**team_dict).returning(Team.id)
        )
        created_team_id = result.scalar_one()

        # Adicionar agentes ao team
        for i, agent_data in enumerate(team_request.agents):
            if 'id' in agent_data:
                team_agent_dict = {
                    "id": str(uuid.uuid4()),
                    "team_id": created_team_id,
                    "agent_id": agent_data['id'],
                    "role_in_team": agent_data.get('role_in_team', 'member'),
                    "priority": i + 1,
                    "is_active": True,
                    "added_at": datetime.utcnow()
                }

                await db.execute(insert(TeamAgent).values(**team_agent_dict))

        await db.commit()

        return {"team_id": str(created_team_id), "message": "Team criado com sucesso"}

    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/teams", response_model=List[Dict])
async def list_teams(user_id: int = 1, db: AsyncSession = Depends(get_db)):
    """Lista todos os teams do usuário"""
    try:
        # ✅ CORREÇÃO: Usar apenas models reais do PostgreSQL
        result = await db.execute(
            select(Team)
            .options(selectinload(Team.team_agents).selectinload(TeamAgent.agent))
            .where(Team.is_active == True)
            .order_by(desc(Team.created_at))
        )
        teams = result.scalars().all()

        # Formatar resposta
        teams_list = []
        for team in teams:
            team_dict = {
                "id": team.id,
                "name": team.name,
                "description": team.description,
                "team_type": team.team_type,
                "is_active": team.is_active,
                "created_at": team.created_at.isoformat() if team.created_at else None,
                "updated_at": team.updated_at.isoformat() if team.updated_at else None,
                "agents": [
                    {
                        "id": ta.agent.id,
                        "name": ta.agent.name,
                        "role": ta.agent.role,
                        "role_in_team": ta.role_in_team,
                        "priority": ta.priority
                    }
                    for ta in team.team_agents if ta.is_active and ta.agent
                ]
            }
            teams_list.append(team_dict)

        return teams_list

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/teams/{team_id}", response_model=Dict)
async def get_team(team_id: str, user_id: int = 1, db: AsyncSession = Depends(get_db)):
    """Busca detalhes de um team específico"""
    try:
        # ✅ CORREÇÃO: Usar apenas models reais do PostgreSQL
        result = await db.execute(
            select(Team)
            .options(selectinload(Team.team_agents).selectinload(TeamAgent.agent))
            .where(Team.id == team_id)
        )
        team = result.scalar_one_or_none()

        if not team:
            raise HTTPException(status_code=404, detail="Team não encontrado")

        team_dict = {
            "id": team.id,
            "name": team.name,
            "description": team.description,
            "team_type": team.team_type,
            "is_active": team.is_active,
            "created_at": team.created_at.isoformat() if team.created_at else None,
            "updated_at": team.updated_at.isoformat() if team.updated_at else None,
            "team_configuration": team.team_configuration,
            "agents": [
                {
                    "id": ta.agent.id,
                    "name": ta.agent.name,
                    "role": ta.agent.role,
                    "role_in_team": ta.role_in_team,
                    "priority": ta.priority
                }
                for ta in team.team_agents if ta.is_active and ta.agent
            ]
        }

        return team_dict

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/teams/{team_id}/execute", response_model=Dict)
async def execute_team(
        team_id: str,
        execution_request: TeamExecutionRequest,
        db: AsyncSession = Depends(get_db)
):
    """Executa um team com uma mensagem"""
    try:
        # ✅ CORREÇÃO: Verificar se team existe no PostgreSQL
        result = await db.execute(
            select(Team)
            .options(selectinload(Team.team_agents).selectinload(TeamAgent.agent))
            .where(Team.id == team_id)
        )
        team = result.scalar_one_or_none()

        if not team:
            raise HTTPException(status_code=404, detail="Team não encontrado")

        # TODO: Integrar com Agno framework quando estiver pronto
        # Por enquanto, retornar resposta simulada
        execution_id = str(uuid.uuid4())

        # Simular execução
        agents_used = [ta.agent.name for ta in team.team_agents if ta.is_active and ta.agent]

        mock_result = {
            'execution_id': execution_id,
            'team_id': team_id,
            'response': f"Team '{team.name}' processou a mensagem: '{execution_request.message}'. Participaram {len(agents_used)} agentes.",
            'metadata': {
                'execution_time': "1.5s",
                'agents_used': agents_used,
                'team_type': team.team_type,
                'message_length': len(execution_request.message)
            }
        }

        # Salvar execução temporariamente em memória
        EXECUTIONS_STORAGE[execution_id] = {
            **mock_result,
            'status': 'completed',
            'started_at': datetime.utcnow().isoformat(),
            'completed_at': datetime.utcnow().isoformat()
        }

        return mock_result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/teams/{team_id}")
async def delete_team(team_id: str, user_id: int = 1, db: AsyncSession = Depends(get_db)):
    """Remove um team (soft delete)"""
    try:
        # ✅ CORREÇÃO: Soft delete no PostgreSQL
        result = await db.execute(
            update(Team)
            .where(Team.id == team_id)
            .values(is_active=False, updated_at=datetime.utcnow())
        )

        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Team não encontrado")

        await db.commit()
        return {"message": "Team removido com sucesso"}

    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# ==================== WORKFLOW BUILDER ENDPOINTS (SIMPLIFICADOS) ====================

@router.post("/workflows/visual", response_model=Dict[str, str])
async def create_visual_workflow(
        workflow_request: VisualWorkflowRequest,
        db: AsyncSession = Depends(get_db)
):
    """Cria um novo workflow visual"""
    try:
        user_id = get_mock_user_id()
        workflow_id = str(uuid.uuid4())

        # ✅ CORREÇÃO: Salvar em memória até criar modelos PostgreSQL
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
        # ✅ CORREÇÃO: Retornar workflows da memória (dados de exemplo)
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
        # ✅ CORREÇÃO: Buscar na memória
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
        # ✅ CORREÇÃO: Verificar se workflow existe na memória
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


@router.get("/workflows/executions/{execution_id}", response_model=Dict)
async def get_execution_status(execution_id: str, db: AsyncSession = Depends(get_db)):
    """Busca status de uma execução"""
    try:
        # ✅ CORREÇÃO: Buscar na memória
        if execution_id not in EXECUTIONS_STORAGE:
            raise HTTPException(status_code=404, detail="Execução não encontrada")

        execution = EXECUTIONS_STORAGE[execution_id]

        # Simular conclusão se ainda estiver rodando
        if execution.get("status") == "running":
            execution["status"] = "completed"
            execution["completed_at"] = datetime.utcnow().isoformat()
            execution["output_data"] = {"result": "Execução concluída com sucesso"}

        return execution

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== TEMPLATES ENDPOINTS ====================

@router.get("/workflows/templates", response_model=List[Dict])
async def list_workflow_templates(category: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    """Lista templates de workflow disponíveis"""
    try:
        # ✅ CORREÇÃO: Retornar templates estáticos
        templates = [
            {
                "id": 1,
                "name": "Análise de Dados",
                "description": "Template para análise automática de datasets",
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

        # ✅ CORREÇÃO: Criar workflow em memória
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
        # ✅ CORREÇÃO: Analytics com dados em memória
        user_workflows = [w for w in WORKFLOWS_STORAGE.values() if w.get("user_id") == user_id]
        total_workflows = len(user_workflows)
        total_executions = len(EXECUTIONS_STORAGE)

        recent_executions = list(EXECUTIONS_STORAGE.values())[-5:]  # Últimas 5

        stats = {
            'total_workflows': total_workflows,
            'total_executions': total_executions,
            'recent_executions': recent_executions,
            'success_rate': 85.5  # Mock
        }

        return stats

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/analytics/teams", response_model=Dict)
async def get_team_analytics(user_id: int = 1, db: AsyncSession = Depends(get_db)):
    """Analytics de teams do usuário"""
    try:
        # ✅ CORREÇÃO: Analytics com dados reais do PostgreSQL
        # Contar teams
        teams_result = await db.execute(
            select(func.count(Team.id))
            .where(Team.is_active == True)
        )
        total_teams = teams_result.scalar()

        # Teams mais usados (simulado)
        most_used_result = await db.execute(
            select(Team.id, Team.name)
            .where(Team.is_active == True)
            .limit(5)
        )
        most_used_teams = [
            {"id": row[0], "name": row[1], "usage_count": 0}  # Mock usage_count
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