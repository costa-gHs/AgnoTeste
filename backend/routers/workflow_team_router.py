# backend/routers/workflow_team_router.py - VERSÃO CORRIGIDA PARA POSTGRESQL

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


# ✅ TEMPORÁRIO: Models mockados já que não existem arquivos separados
class Workflow:
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)

    id = None
    name = None
    description = None
    user_id = None
    workflow_type = None
    nodes = None
    connections = None
    metadata = None
    is_active = None
    created_at = None
    updated_at = None


class WorkflowExecution:
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)

    id = None
    workflow_id = None
    user_id = None
    input_data = None
    output_data = None
    status = None
    started_at = None
    completed_at = None
    error_message = None
    steps = []


class ExecutionStep:
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)

    id = None
    execution_id = None
    step_order = None
    node_id = None
    status = None
    input_data = None
    output_data = None
    error_message = None
    started_at = None
    completed_at = None


class WorkflowTemplate:
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)

    id = None
    name = None
    description = None
    category = None
    template_definition = None
    usage_count = 0
    is_public = None
    created_at = None


# ✅ TEMPORÁRIO: Services mockados
class NodeConfig:
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)


class WorkflowConnection:
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)


class VisualWorkflowDefinition:
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)


class TeamDefinition:
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)


class WorkflowTeamService:
    async def create_team(self, user_id, team_def):
        return "mock_team_id"

    async def get_teams(self, user_id):
        return []

    async def execute_team(self, team_id, message):
        return {"result": "mock"}


workflow_team_service = WorkflowTeamService()

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
    return 1  # Por enquanto, usar sempre user_id = 1


# ==================== TEAM BUILDER ENDPOINTS ====================

@router.post("/teams", response_model=Dict[str, str])
async def create_team(team_request: TeamRequest, db: AsyncSession = Depends(get_db)):
    """Cria um novo team de agentes"""
    try:
        user_id = get_mock_user_id()

        # ✅ CORREÇÃO: Usar apenas models que existem (Team do agents.py)
        team_dict = {
            "id": str(uuid.uuid4()),
            "name": team_request.name,
            "description": team_request.description,
            "team_type": team_request.team_type,
            "user_id": user_id,
            "team_configuration": team_request.supervisor_config,  # Ajustado para campo que existe
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }

        # ✅ MOCK: Por enquanto retornar sucesso sem salvar no banco
        # TODO: Implementar quando os models estiverem prontos
        # result = await db.execute(insert(Team).values(**team_dict).returning(Team.id))
        mock_team_id = team_dict["id"]

        # TODO: Adicionar agentes ao team quando TeamAgent estiver funcionando

        # await db.commit()

        # TODO: Integrar com Agno framework
        # team_def = TeamDefinition(...)
        # team_id = await workflow_team_service.create_team(user_id, team_def)

        return {"team_id": str(mock_team_id), "message": "Team criado com sucesso (mock)"}

    except Exception as e:
        # await db.rollback()  # Comentado pois não estamos usando transação ainda
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/teams", response_model=List[Dict])
async def list_teams(user_id: int = 1, db: AsyncSession = Depends(get_db)):
    """Lista todos os teams do usuário"""
    try:
        # ✅ MOCK: Retornar lista vazia por enquanto
        # TODO: Implementar quando Team model estiver funcionando
        teams_list = []
        return teams_list

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/teams/{team_id}", response_model=Dict)
async def get_team(team_id: str, user_id: int = 1, db: AsyncSession = Depends(get_db)):
    """Busca detalhes de um team específico"""
    try:
        # ✅ MOCK: Retornar dados mock por enquanto
        team_dict = {
            "id": team_id,
            "name": f"Team {team_id}",
            "description": "Team de exemplo",
            "team_type": "collaborative",
            "is_active": True,
            "agents": []
        }
        return team_dict

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
            select(Team).where(Team.id == team_id)
        )
        team = result.scalar_one_or_none()

        if not team:
            raise HTTPException(status_code=404, detail="Team não encontrado")

        # TODO: Integrar com Agno framework
        # result = await workflow_team_service.execute_team(team_id, execution_request.message)

        # Resposta mock por enquanto
        mock_result = {
            'team_id': team_id,
            'response': f"Processando mensagem: {execution_request.message}",
            'metadata': {
                'execution_time': "0.5s",
                'agents_used': [team.name]
            }
        }

        return mock_result

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
            .where(Team.user_id == user_id)
            .values(is_active=False, updated_at=datetime.utcnow())
        )

        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Team não encontrado")

        await db.commit()
        return {"message": "Team removido com sucesso"}

    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# ==================== WORKFLOW BUILDER ENDPOINTS ====================

@router.post("/workflows/visual", response_model=Dict[str, str])
async def create_visual_workflow(
        workflow_request: VisualWorkflowRequest,
        db: AsyncSession = Depends(get_db)
):
    """Cria um novo workflow visual"""
    try:
        user_id = get_mock_user_id()

        # ✅ CORREÇÃO: Criar workflow no PostgreSQL
        workflow_dict = {
            "id": str(uuid.uuid4()),
            "name": workflow_request.name,
            "description": workflow_request.description,
            "user_id": user_id,
            "workflow_type": "visual",
            "nodes": [node.dict() for node in workflow_request.nodes],
            "connections": [conn.dict() for conn in workflow_request.connections],
            "metadata": workflow_request.metadata,
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }

        result = await db.execute(
            insert(Workflow).values(**workflow_dict).returning(Workflow.id)
        )
        workflow_id = result.scalar_one()

        await db.commit()

        # TODO: Integrar com workflow_team_service
        # visual_def = VisualWorkflowDefinition(...)
        # workflow_id = await workflow_team_service.create_visual_workflow(...)

        return {"workflow_id": str(workflow_id), "message": "Workflow criado com sucesso"}

    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/workflows", response_model=List[Dict])
async def list_workflows(user_id: int = 1, db: AsyncSession = Depends(get_db)):
    """Lista todos os workflows do usuário"""
    try:
        # ✅ CORREÇÃO: Query no PostgreSQL
        result = await db.execute(
            select(Workflow)
            .where(Workflow.user_id == user_id)
            .where(Workflow.is_active == True)
            .order_by(desc(Workflow.created_at))
        )
        workflows = result.scalars().all()

        # Formatar resposta
        workflows_list = []
        for workflow in workflows:
            workflow_dict = {
                "id": workflow.id,
                "name": workflow.name,
                "description": workflow.description,
                "workflow_type": workflow.workflow_type,
                "nodes": workflow.nodes,
                "connections": workflow.connections,
                "metadata": workflow.metadata,
                "is_active": workflow.is_active,
                "created_at": workflow.created_at,
                "updated_at": workflow.updated_at
            }
            workflows_list.append(workflow_dict)

        return workflows_list

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/workflows/{workflow_id}", response_model=Dict)
async def get_workflow(workflow_id: str, user_id: int = 1, db: AsyncSession = Depends(get_db)):
    """Busca detalhes de um workflow específico"""
    try:
        # ✅ CORREÇÃO: Buscar no PostgreSQL
        result = await db.execute(
            select(Workflow)
            .where(Workflow.id == workflow_id)
            .where(Workflow.user_id == user_id)
        )
        workflow = result.scalar_one_or_none()

        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow não encontrado")

        workflow_dict = {
            "id": workflow.id,
            "name": workflow.name,
            "description": workflow.description,
            "workflow_type": workflow.workflow_type,
            "nodes": workflow.nodes,
            "connections": workflow.connections,
            "metadata": workflow.metadata,
            "is_active": workflow.is_active,
            "created_at": workflow.created_at,
            "updated_at": workflow.updated_at
        }

        return workflow_dict

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
        # ✅ CORREÇÃO: Verificar se workflow existe no PostgreSQL
        result = await db.execute(
            select(Workflow).where(Workflow.id == workflow_id)
        )
        workflow = result.scalar_one_or_none()

        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow não encontrado")

        # ✅ CORREÇÃO: Criar execução no PostgreSQL
        execution_dict = {
            "id": str(uuid.uuid4()),
            "workflow_id": workflow_id,
            "user_id": workflow.user_id,
            "input_data": execution_request.input_data,
            "status": "running",
            "started_at": datetime.utcnow()
        }

        execution_result = await db.execute(
            insert(WorkflowExecution).values(**execution_dict).returning(WorkflowExecution.id)
        )
        execution_id = execution_result.scalar_one()

        await db.commit()

        # TODO: Executar workflow em background
        # background_tasks.add_task(execute_workflow_background, execution_id, workflow)

        return {
            "execution_id": str(execution_id),
            "message": "Execução iniciada com sucesso"
        }

    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/workflows/executions/{execution_id}", response_model=Dict)
async def get_execution_status(execution_id: str, db: AsyncSession = Depends(get_db)):
    """Busca status de uma execução"""
    try:
        # ✅ CORREÇÃO: Buscar no PostgreSQL
        result = await db.execute(
            select(WorkflowExecution)
            .options(selectinload(WorkflowExecution.steps))
            .where(WorkflowExecution.id == execution_id)
        )
        execution = result.scalar_one_or_none()

        if not execution:
            raise HTTPException(status_code=404, detail="Execução não encontrada")

        execution_dict = {
            "id": execution.id,
            "workflow_id": execution.workflow_id,
            "status": execution.status,
            "input_data": execution.input_data,
            "output_data": execution.output_data,
            "error_message": execution.error_message,
            "started_at": execution.started_at,
            "completed_at": execution.completed_at,
            "steps": []
        }

        # Adicionar steps
        for step in execution.steps:
            step_dict = {
                "id": step.id,
                "step_order": step.step_order,
                "node_id": step.node_id,
                "status": step.status,
                "input_data": step.input_data,
                "output_data": step.output_data,
                "error_message": step.error_message,
                "started_at": step.started_at,
                "completed_at": step.completed_at
            }
            execution_dict["steps"].append(step_dict)

        return execution_dict

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/workflows/executions/{execution_id}/steps", response_model=List[Dict])
async def get_execution_steps(execution_id: str, db: AsyncSession = Depends(get_db)):
    """Lista steps de uma execução com detalhes"""
    try:
        # ✅ CORREÇÃO: Buscar steps no PostgreSQL
        result = await db.execute(
            select(ExecutionStep)
            .where(ExecutionStep.execution_id == execution_id)
            .order_by(ExecutionStep.step_order)
        )
        steps = result.scalars().all()

        steps_list = []
        for step in steps:
            step_dict = {
                "id": step.id,
                "execution_id": step.execution_id,
                "step_order": step.step_order,
                "node_id": step.node_id,
                "status": step.status,
                "input_data": step.input_data,
                "output_data": step.output_data,
                "error_message": step.error_message,
                "started_at": step.started_at,
                "completed_at": step.completed_at
            }
            steps_list.append(step_dict)

        return steps_list

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== TEMPLATES ENDPOINTS ====================

@router.get("/workflows/templates", response_model=List[Dict])
async def list_workflow_templates(db: AsyncSession = Depends(get_db)):
    """Lista templates de workflow disponíveis"""
    try:
        # ✅ CORREÇÃO: Query no PostgreSQL
        result = await db.execute(
            select(WorkflowTemplate)
            .where(WorkflowTemplate.is_public == True)
            .order_by(desc(WorkflowTemplate.usage_count))
        )
        templates = result.scalars().all()

        templates_list = []
        for template in templates:
            template_dict = {
                "id": template.id,
                "name": template.name,
                "description": template.description,
                "category": template.category,
                "template_definition": template.template_definition,
                "usage_count": template.usage_count,
                "is_public": template.is_public,
                "created_at": template.created_at
            }
            templates_list.append(template_dict)

        return templates_list

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/workflows/from-template", response_model=Dict[str, str])
async def create_workflow_from_template(
        template_request: WorkflowFromTemplateRequest,
        db: AsyncSession = Depends(get_db)
):
    """Cria um workflow baseado em um template"""
    try:
        user_id = get_mock_user_id()

        # ✅ CORREÇÃO: Buscar template no PostgreSQL
        template_result = await db.execute(
            select(WorkflowTemplate).where(WorkflowTemplate.id == template_request.template_id)
        )
        template = template_result.scalar_one_or_none()

        if not template:
            raise HTTPException(status_code=404, detail="Template não encontrado")

        # Criar workflow baseado no template
        workflow_dict = {
            "id": str(uuid.uuid4()),
            "name": template_request.name,
            "description": template.description,
            "user_id": user_id,
            "workflow_type": "visual",
            "nodes": template.template_definition.get("nodes", []),
            "connections": template.template_definition.get("connections", []),
            "metadata": template.template_definition.get("metadata", {}),
            "template_id": template.id,
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }

        # Aplicar customizações se houver
        if template_request.customizations:
            # TODO: Aplicar customizações ao template
            pass

        result = await db.execute(
            insert(Workflow).values(**workflow_dict).returning(Workflow.id)
        )
        workflow_id = result.scalar_one()

        # Incrementar contador de uso do template
        await db.execute(
            update(WorkflowTemplate)
            .where(WorkflowTemplate.id == template.id)
            .values(usage_count=template.usage_count + 1)
        )

        await db.commit()

        return {
            "workflow_id": str(workflow_id),
            "message": "Workflow criado a partir do template"
        }

    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# ==================== UTILITIES ENDPOINTS ====================

@router.get("/agents", response_model=List[Dict])
async def list_available_agents(user_id: int = 1, db: AsyncSession = Depends(get_db)):
    """Lista agentes disponíveis para uso em workflows e teams"""
    try:
        # ✅ CORREÇÃO: Query no PostgreSQL
        result = await db.execute(
            select(Agent)
            .where(Agent.user_id == user_id)
            .where(Agent.is_active == True)
            .order_by(Agent.name)
        )
        agents = result.scalars().all()

        agents_list = []
        for agent in agents:
            agent_dict = {
                "id": agent.id,
                "name": agent.name,
                "role": agent.role,
                "description": agent.description,
                "model_provider": agent.model_provider,
                "model_id": agent.model_id,
                "memory_enabled": agent.memory_enabled,
                "rag_enabled": agent.rag_enabled,
                "created_at": agent.created_at
            }
            agents_list.append(agent_dict)

        return agents_list

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tools", response_model=List[Dict])
async def list_available_tools():
    """Lista tools disponíveis no framework Agno"""
    tools = [
        {
            "id": "duckduckgo",
            "name": "DuckDuckGo Search",
            "description": "Busca na web usando DuckDuckGo",
            "category": "search"
        },
        {
            "id": "yfinance",
            "name": "Yahoo Finance",
            "description": "Dados financeiros e de mercado",
            "category": "finance"
        },
        {
            "id": "calculator",
            "name": "Calculator",
            "description": "Cálculos matemáticos básicos e avançados",
            "category": "math"
        },
        {
            "id": "reasoning",
            "name": "Reasoning Tools",
            "description": "Ferramentas de raciocínio e lógica",
            "category": "logic"
        }
    ]
    return tools


@router.get("/models", response_model=List[Dict])
async def list_available_models():
    """Lista modelos de LLM disponíveis"""
    models = [
        {
            "provider": "openai",
            "models": [
                {"id": "gpt-4o", "name": "GPT-4 Omni", "description": "Modelo mais avançado da OpenAI"},
                {"id": "gpt-4o-mini", "name": "GPT-4 Omni Mini", "description": "Versão otimizada e rápida"},
                {"id": "gpt-4", "name": "GPT-4", "description": "Modelo anterior da OpenAI"},
                {"id": "gpt-3.5-turbo", "name": "GPT-3.5 Turbo", "description": "Modelo rápido e eficiente"}
            ]
        },
        {
            "provider": "anthropic",
            "models": [
                {"id": "claude-3-5-sonnet-20241022", "name": "Claude 3.5 Sonnet",
                 "description": "Modelo mais avançado da Anthropic"},
                {"id": "claude-3-haiku-20240307", "name": "Claude 3 Haiku", "description": "Modelo rápido da Anthropic"}
            ]
        },
        {
            "provider": "groq",
            "models": [
                {"id": "llama-3.1-70b-versatile", "name": "Llama 3.1 70B",
                 "description": "Modelo open source de alta performance"}
            ]
        }
    ]
    return models


# ==================== ANALYTICS ENDPOINTS ====================

@router.get("/analytics/workflows", response_model=Dict)
async def get_workflow_analytics(user_id: int = 1, db: AsyncSession = Depends(get_db)):
    """Analytics de workflows do usuário"""
    try:
        # ✅ CORREÇÃO: Queries de analytics no PostgreSQL

        # Total de workflows
        workflows_result = await db.execute(
            select(func.count(Workflow.id))
            .where(Workflow.user_id == user_id)
        )
        total_workflows = workflows_result.scalar()

        # Execuções recentes
        executions_result = await db.execute(
            select(WorkflowExecution)
            .join(Workflow)
            .where(Workflow.user_id == user_id)
            .order_by(desc(WorkflowExecution.started_at))
            .limit(10)
        )
        recent_executions = executions_result.scalars().all()

        # Formatar execuções
        executions_list = []
        for execution in recent_executions:
            execution_dict = {
                "id": execution.id,
                "workflow_id": execution.workflow_id,
                "status": execution.status,
                "started_at": execution.started_at,
                "completed_at": execution.completed_at
            }
            executions_list.append(execution_dict)

        # Calcular taxa de sucesso
        success_result = await db.execute(
            select(func.count(WorkflowExecution.id))
            .join(Workflow)
            .where(Workflow.user_id == user_id)
            .where(WorkflowExecution.status == "completed")
        )
        successful_executions = success_result.scalar()

        total_executions_result = await db.execute(
            select(func.count(WorkflowExecution.id))
            .join(Workflow)
            .where(Workflow.user_id == user_id)
        )
        total_executions = total_executions_result.scalar()

        success_rate = (successful_executions / total_executions * 100) if total_executions > 0 else 0

        stats = {
            'total_workflows': total_workflows,
            'total_executions': total_executions,
            'recent_executions': executions_list,
            'success_rate': round(success_rate, 2)
        }

        return stats

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/analytics/teams", response_model=Dict)
async def get_team_analytics(user_id: int = 1, db: AsyncSession = Depends(get_db)):
    """Analytics de teams do usuário"""
    try:
        # ✅ CORREÇÃO: Analytics de teams no PostgreSQL

        # Total de teams
        teams_result = await db.execute(
            select(func.count(Team.id))
            .where(Team.user_id == user_id)
            .where(Team.is_active == True)
        )
        total_teams = teams_result.scalar()

        # Teams mais usados (mock por enquanto)
        most_used_result = await db.execute(
            select(Team.id, Team.name)
            .where(Team.user_id == user_id)
            .where(Team.is_active == True)
            .limit(5)
        )
        most_used_teams = [
            {"id": row[0], "name": row[1], "usage_count": 0}  # Mock usage_count
            for row in most_used_result.fetchall()
        ]

        stats = {
            'total_teams': total_teams,
            'active_teams': total_teams,  # Simplificado por enquanto
            'most_used_teams': most_used_teams
        }

        return stats

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))