# backend/routers/workflow_team_router.py - VERSÃO CORRIGIDA

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime

from services.workflow_team_service import (
    workflow_team_service,
    NodeConfig,
    WorkflowConnection,
    VisualWorkflowDefinition,
    TeamDefinition
)

# ✅ REMOVIDO IMPORT DE AUTH - sem dependência
router = APIRouter(tags=["Workflow & Team Builder"])  # sem prefix



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
async def create_team(team_request: TeamRequest):
    """Cria um novo team de agentes"""
    try:
        team_def = TeamDefinition(
            name=team_request.name,
            description=team_request.description,
            team_type=team_request.team_type,
            agents=team_request.agents,
            supervisor_config=team_request.supervisor_config
        )

        # ✅ USAR USER_ID MOCK
        user_id = get_mock_user_id()
        team_id = await workflow_team_service.create_team(user_id, team_def)

        return {"team_id": team_id, "message": "Team criado com sucesso"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/teams", response_model=List[Dict])
async def list_teams():
    """Lista todos os teams do usuário"""
    try:
        user_id = get_mock_user_id()
        teams = await workflow_team_service.get_teams(user_id)
        return teams
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/teams/{team_id}", response_model=Dict)
async def get_team(team_id: str):
    """Busca detalhes de um team específico"""
    try:
        user_id = get_mock_user_id()
        teams = await workflow_team_service.get_teams(user_id)
        team = next((t for t in teams if str(t['id']) == team_id), None)

        if not team:
            raise HTTPException(status_code=404, detail="Team não encontrado")

        return team
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/teams/{team_id}/execute", response_model=Dict)
async def execute_team(team_id: str, execution_request: TeamExecutionRequest):
    """Executa um team com uma mensagem"""
    try:
        result = await workflow_team_service.execute_team(
            execution_request.team_id,
            execution_request.message
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/teams/{team_id}")
async def delete_team(team_id: str):
    """Remove um team"""
    try:
        # TODO: Implementar soft delete no serviço
        return {"message": "Team removido com sucesso"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== WORKFLOW BUILDER ENDPOINTS ====================

@router.post("/workflows/visual", response_model=Dict[str, str])
async def create_visual_workflow(workflow_request: VisualWorkflowRequest):
    """Cria um novo workflow visual"""
    try:
        # Converter para objetos de domínio
        nodes = [
            NodeConfig(
                id=node.id,
                type=node.type,
                name=node.name,
                position=node.position,
                config=node.config,
                status=node.status
            ) for node in workflow_request.nodes
        ]

        connections = [
            WorkflowConnection(
                from_node=conn.from_node,
                to_node=conn.to_node,
                condition=conn.condition
            ) for conn in workflow_request.connections
        ]

        visual_def = VisualWorkflowDefinition(
            nodes=nodes,
            connections=connections,
            metadata=workflow_request.metadata
        )

        user_id = get_mock_user_id()
        workflow_id = await workflow_team_service.create_visual_workflow(
            user_id,
            workflow_request.name,
            workflow_request.description,
            visual_def
        )

        return {"workflow_id": workflow_id, "message": "Workflow criado com sucesso"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/workflows", response_model=List[Dict])
async def list_workflows():
    """Lista todos os workflows do usuário"""
    try:
        from backend.supabase_client import supabase

        user_id = get_mock_user_id()
        result = supabase.table('agno_workflows') \
            .select('*') \
            .eq('user_id', user_id) \
            .eq('is_active', True) \
            .order('created_at', desc=True) \
            .execute()

        return result.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/workflows/{workflow_id}", response_model=Dict)
async def get_workflow(workflow_id: str):
    """Busca detalhes de um workflow específico"""
    try:
        from backend.supabase_client import supabase

        user_id = get_mock_user_id()
        result = supabase.table('agno_workflows') \
            .select('*') \
            .eq('id', int(workflow_id)) \
            .eq('user_id', user_id) \
            .execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Workflow não encontrado")

        return result.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/workflows/{workflow_id}/execute", response_model=Dict[str, str])
async def execute_workflow(
        workflow_id: str,
        execution_request: WorkflowExecutionRequest,
        background_tasks: BackgroundTasks
):
    """Executa um workflow visual"""
    try:
        execution_id = await workflow_team_service.execute_visual_workflow(
            workflow_id,
            execution_request.input_data
        )

        return {
            "execution_id": execution_id,
            "message": "Execução iniciada com sucesso"
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/workflows/executions/{execution_id}", response_model=Dict)
async def get_execution_status(execution_id: str):
    """Busca status de uma execução"""
    try:
        from backend.supabase_client import supabase

        user_id = get_mock_user_id()
        result = supabase.table('agno_workflow_executions') \
            .select('*, agno_execution_steps(*)') \
            .eq('id', execution_id) \
            .eq('user_id', user_id) \
            .execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Execução não encontrada")

        return result.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/workflows/executions/{execution_id}/steps", response_model=List[Dict])
async def get_execution_steps(execution_id: str):
    """Lista steps de uma execução com detalhes"""
    try:
        from backend.supabase_client import supabase

        result = supabase.table('agno_execution_steps') \
            .select('*') \
            .eq('execution_id', execution_id) \
            .order('step_order') \
            .execute()

        return result.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== TEMPLATES ENDPOINTS ====================

@router.get("/workflows/templates", response_model=List[Dict])
async def list_workflow_templates():
    """Lista templates de workflow disponíveis"""
    try:
        templates = await workflow_team_service.get_workflow_templates()
        return templates
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/workflows/from-template", response_model=Dict[str, str])
async def create_workflow_from_template(template_request: WorkflowFromTemplateRequest):
    """Cria um workflow baseado em um template"""
    try:
        user_id = get_mock_user_id()
        workflow_id = await workflow_team_service.create_workflow_from_template(
            user_id,
            template_request.template_id,
            template_request.name,
            template_request.customizations
        )

        return {
            "workflow_id": workflow_id,
            "message": "Workflow criado a partir do template"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== UTILITIES ENDPOINTS ====================

@router.get("/agents", response_model=List[Dict])
async def list_available_agents():
    """Lista agentes disponíveis para uso em workflows e teams"""
    try:
        from backend.supabase_client import supabase

        user_id = get_mock_user_id()
        result = supabase.table('agno_agents') \
            .select('*') \
            .eq('user_id', user_id) \
            .eq('is_active', True) \
            .order('name') \
            .execute()

        return result.data
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
async def get_workflow_analytics():
    """Analytics de workflows do usuário"""
    try:
        from backend.supabase_client import supabase

        user_id = get_mock_user_id()

        # Total de workflows
        workflows_result = supabase.table('agno_workflows') \
            .select('id', count='exact') \
            .eq('user_id', user_id) \
            .execute()

        # Execuções recentes
        executions_result = supabase.table('agno_workflow_executions') \
            .select('*') \
            .eq('user_id', user_id) \
            .order('started_at', desc=True) \
            .limit(10) \
            .execute()

        # Estatísticas
        stats = {
            'total_workflows': workflows_result.count or 0,
            'total_executions': len(executions_result.data),
            'recent_executions': executions_result.data,
            'success_rate': 0  # TODO: Calcular taxa de sucesso
        }

        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/analytics/teams", response_model=Dict)
async def get_team_analytics():
    """Analytics de teams do usuário"""
    try:
        from backend.supabase_client import supabase

        user_id = get_mock_user_id()

        # Total de teams
        teams_result = supabase.table('agno_teams') \
            .select('id', count='exact') \
            .eq('user_id', user_id) \
            .execute()

        stats = {
            'total_teams': teams_result.count or 0,
            'active_teams': teams_result.count or 0,  # Simplificado
            'most_used_teams': []
        }

        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))