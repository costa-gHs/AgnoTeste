# backend/routers/teams.py - ROTA FUNCIONAL PARA TEAMS

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, insert, update, delete, func
from sqlalchemy.orm import selectinload
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from datetime import datetime
import uuid
import json
import asyncio

# Imports corrigidos para PostgreSQL
from models.database import get_db
from models.agents import Agent, Team, TeamAgent, TeamExecution

router = APIRouter(prefix="/api/teams", tags=["Teams"])


# ==================== PYDANTIC MODELS ====================

class AgentInTeamRequest(BaseModel):
    agent_id: str
    role_in_team: str = "member"
    priority: int = 1


class TeamCreateRequest(BaseModel):
    name: str
    description: str
    team_type: str = "collaborative"  # collaborative, hierarchical, sequential
    agents: List[AgentInTeamRequest]
    supervisor_agent_id: Optional[str] = None
    team_configuration: Dict[str, Any] = {}


class TeamUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    team_type: Optional[str] = None
    is_active: Optional[bool] = None
    team_configuration: Optional[Dict[str, Any]] = None


class TeamExecuteRequest(BaseModel):
    message: str
    context: Optional[Dict[str, Any]] = {}


class TeamResponse(BaseModel):
    id: str
    name: str
    description: str
    team_type: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    agent_count: int
    agents: List[Dict[str, Any]]
    supervisor: Optional[Dict[str, Any]] = None
    execution_count: int = 0
    last_execution: Optional[datetime] = None


# ==================== HELPER FUNCTIONS ====================

async def get_team_with_agents(db: AsyncSession, team_id: str) -> Optional[Team]:
    """Busca team com todos os agentes carregados"""
    result = await db.execute(
        select(Team)
        .options(
            selectinload(Team.team_agents).selectinload(TeamAgent.agent),
            selectinload(Team.supervisor)
        )
        .where(Team.id == team_id, Team.is_active == True)
    )
    return result.scalar_one_or_none()


def format_team_response(team: Team) -> Dict[str, Any]:
    """Formata team para resposta da API"""
    return {
        "id": team.id,
        "name": team.name,
        "description": team.description,
        "team_type": team.team_type,
        "is_active": team.is_active,
        "created_at": team.created_at,
        "updated_at": team.updated_at,
        "team_configuration": team.team_configuration or {},
        "agent_count": len([ta for ta in team.team_agents if ta.is_active]),
        "agents": [
            {
                "id": ta.agent.id,
                "name": ta.agent.name,
                "role": ta.agent.role,
                "role_in_team": ta.role_in_team,
                "priority": ta.priority,
                "model_provider": ta.agent.model_provider,
                "model_id": ta.agent.model_id,
                "tools": [tool.tool_id for tool in ta.agent.tools if tool.is_active],
                "is_active": ta.agent.is_active
            }
            for ta in team.team_agents if ta.is_active and ta.agent
        ],
        "supervisor": {
            "id": team.supervisor.id,
            "name": team.supervisor.name,
            "role": team.supervisor.role
        } if team.supervisor else None,
        "execution_count": len(team.executions) if hasattr(team, 'executions') else 0
    }


# ==================== TEAM CRUD ENDPOINTS ====================

@router.post("/", response_model=Dict[str, Any])
async def create_team(
        team_request: TeamCreateRequest,
        db: AsyncSession = Depends(get_db)
):
    """Cria um novo team de agentes"""
    try:
        # Verificar se agentes existem
        agent_ids = [agent.agent_id for agent in team_request.agents]
        if agent_ids:
            result = await db.execute(
                select(Agent).where(Agent.id.in_(agent_ids), Agent.is_active == True)
            )
            existing_agents = result.scalars().all()
            existing_ids = {agent.id for agent in existing_agents}

            missing_agents = set(agent_ids) - existing_ids
            if missing_agents:
                raise HTTPException(
                    status_code=400,
                    detail=f"Agentes não encontrados: {list(missing_agents)}"
                )

        # Verificar supervisor se especificado
        if team_request.supervisor_agent_id:
            result = await db.execute(
                select(Agent).where(
                    Agent.id == team_request.supervisor_agent_id,
                    Agent.is_active == True
                )
            )
            supervisor = result.scalar_one_or_none()
            if not supervisor:
                raise HTTPException(
                    status_code=400,
                    detail=f"Supervisor não encontrado: {team_request.supervisor_agent_id}"
                )

        # Criar team
        team_id = str(uuid.uuid4())
        team_data = {
            "id": team_id,
            "name": team_request.name,
            "description": team_request.description,
            "team_type": team_request.team_type,
            "team_configuration": team_request.team_configuration,
            "supervisor_agent_id": team_request.supervisor_agent_id,
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }

        result = await db.execute(
            insert(Team).values(**team_data)
        )

        # Adicionar agentes ao team
        for agent_req in team_request.agents:
            team_agent_data = {
                "id": str(uuid.uuid4()),
                "team_id": team_id,
                "agent_id": agent_req.agent_id,
                "role_in_team": agent_req.role_in_team,
                "priority": agent_req.priority,
                "is_active": True,
                "added_at": datetime.utcnow()
            }
            await db.execute(insert(TeamAgent).values(**team_agent_data))

        await db.commit()

        # Buscar team criado com relações
        created_team = await get_team_with_agents(db, team_id)
        if not created_team:
            raise HTTPException(status_code=500, detail="Erro ao criar team")

        return {
            "success": True,
            "message": "Team criado com sucesso",
            "team": format_team_response(created_team)
        }

    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")


@router.get("/", response_model=List[Dict[str, Any]])
async def list_teams(
        active_only: bool = True,
        db: AsyncSession = Depends(get_db)
):
    """Lista todos os teams"""
    try:
        query = select(Team).options(
            selectinload(Team.team_agents).selectinload(TeamAgent.agent),
            selectinload(Team.supervisor)
        ).order_by(Team.created_at.desc())

        if active_only:
            query = query.where(Team.is_active == True)

        result = await db.execute(query)
        teams = result.scalars().all()

        return [format_team_response(team) for team in teams]

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao listar teams: {str(e)}")


@router.get("/{team_id}", response_model=Dict[str, Any])
async def get_team(team_id: str, db: AsyncSession = Depends(get_db)):
    """Busca um team específico"""
    try:
        team = await get_team_with_agents(db, team_id)
        if not team:
            raise HTTPException(status_code=404, detail="Team não encontrado")

        return format_team_response(team)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao buscar team: {str(e)}")


@router.put("/{team_id}", response_model=Dict[str, Any])
async def update_team(
        team_id: str,
        team_update: TeamUpdateRequest,
        db: AsyncSession = Depends(get_db)
):
    """Atualiza um team"""
    try:
        # Verificar se team existe
        team = await get_team_with_agents(db, team_id)
        if not team:
            raise HTTPException(status_code=404, detail="Team não encontrado")

        # Preparar dados para atualização
        update_data = {}
        if team_update.name is not None:
            update_data["name"] = team_update.name
        if team_update.description is not None:
            update_data["description"] = team_update.description
        if team_update.team_type is not None:
            update_data["team_type"] = team_update.team_type
        if team_update.is_active is not None:
            update_data["is_active"] = team_update.is_active
        if team_update.team_configuration is not None:
            update_data["team_configuration"] = team_update.team_configuration

        if update_data:
            update_data["updated_at"] = datetime.utcnow()
            await db.execute(
                update(Team).where(Team.id == team_id).values(**update_data)
            )

        await db.commit()

        # Buscar team atualizado
        updated_team = await get_team_with_agents(db, team_id)
        return {
            "success": True,
            "message": "Team atualizado com sucesso",
            "team": format_team_response(updated_team)
        }

    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao atualizar team: {str(e)}")


@router.delete("/{team_id}")
async def delete_team(team_id: str, db: AsyncSession = Depends(get_db)):
    """Remove um team (soft delete)"""
    try:
        team = await get_team_with_agents(db, team_id)
        if not team:
            raise HTTPException(status_code=404, detail="Team não encontrado")

        # Soft delete - apenas marca como inativo
        await db.execute(
            update(Team)
            .where(Team.id == team_id)
            .values(is_active=False, updated_at=datetime.utcnow())
        )

        # Desativar associações de agentes
        await db.execute(
            update(TeamAgent)
            .where(TeamAgent.team_id == team_id)
            .values(is_active=False)
        )

        await db.commit()

        return {
            "success": True,
            "message": "Team removido com sucesso"
        }

    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao remover team: {str(e)}")


# ==================== TEAM EXECUTION ====================

@router.post("/{team_id}/execute", response_model=Dict[str, Any])
async def execute_team(
        team_id: str,
        execute_request: TeamExecuteRequest,
        db: AsyncSession = Depends(get_db)
):
    """Executa um team com uma mensagem"""
    try:
        # Buscar team
        team = await get_team_with_agents(db, team_id)
        if not team:
            raise HTTPException(status_code=404, detail="Team não encontrado")

        if not team.is_active:
            raise HTTPException(status_code=400, detail="Team está inativo")

        # Criar execução
        execution_id = str(uuid.uuid4())
        execution_data = {
            "id": execution_id,
            "team_id": team_id,
            "input_message": execute_request.message,
            "status": "running",
            "metadata": execute_request.context or {},
            "started_at": datetime.utcnow()
        }

        await db.execute(insert(TeamExecution).values(**execution_data))
        await db.commit()

        # TODO: Implementar execução real dos agentes
        # Por ora, simular resposta
        response = await simulate_team_execution(team, execute_request.message)

        # Atualizar execução com resultado
        await db.execute(
            update(TeamExecution)
            .where(TeamExecution.id == execution_id)
            .values(
                output_response=response,
                status="completed",
                completed_at=datetime.utcnow()
            )
        )
        await db.commit()

        return {
            "execution_id": execution_id,
            "status": "completed",
            "response": response,
            "team_name": team.name,
            "agents_used": len(team.team_agents),
            "execution_time_ms": 1500  # Mock
        }

    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro na execução: {str(e)}")


async def simulate_team_execution(team: Team, message: str) -> str:
    """Simula execução do team - substituir por execução real"""
    agents_info = [
        f"🤖 **{ta.agent.name}** ({ta.role_in_team}): {ta.agent.role}"
        for ta in team.team_agents if ta.is_active
    ]

    response = f"""**Team '{team.name}' Executado com Sucesso!**

**Tipo de Colaboração:** {team.team_type}
**Mensagem Recebida:** {message}

**Agentes Participantes:**
{chr(10).join(agents_info)}

**Resultado da Execução:**
Este é um resultado simulado. A integração com o sistema de execução real dos agentes será implementada na próxima fase.

**Próximos Passos:**
1. Integrar com o Agno Framework para execução real
2. Implementar fluxo de colaboração entre agentes
3. Adicionar métricas de performance em tempo real
"""

    return response


# ==================== TEAM ANALYTICS ====================

@router.get("/{team_id}/analytics", response_model=Dict[str, Any])
async def get_team_analytics(team_id: str, db: AsyncSession = Depends(get_db)):
    """Busca analytics de um team"""
    try:
        team = await get_team_with_agents(db, team_id)
        if not team:
            raise HTTPException(status_code=404, detail="Team não encontrado")

        # Buscar execuções
        result = await db.execute(
            select(TeamExecution)
            .where(TeamExecution.team_id == team_id)
            .order_by(TeamExecution.started_at.desc())
        )
        executions = result.scalars().all()

        # Calcular métricas
        total_executions = len(executions)
        completed_executions = len([e for e in executions if e.status == "completed"])
        success_rate = (completed_executions / total_executions * 100) if total_executions > 0 else 0

        return {
            "team_id": team_id,
            "team_name": team.name,
            "total_executions": total_executions,
            "successful_executions": completed_executions,
            "success_rate": round(success_rate, 2),
            "avg_response_time_ms": 1500,  # Mock
            "last_execution": executions[0].started_at.isoformat() if executions else None,
            "agent_count": len(team.team_agents),
            "team_type": team.team_type
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao buscar analytics: {str(e)}")


@router.get("/{team_id}/executions", response_model=List[Dict[str, Any]])
async def get_team_executions(
        team_id: str,
        limit: int = 20,
        db: AsyncSession = Depends(get_db)
):
    """Lista execuções de um team"""
    try:
        result = await db.execute(
            select(TeamExecution)
            .where(TeamExecution.team_id == team_id)
            .order_by(TeamExecution.started_at.desc())
            .limit(limit)
        )
        executions = result.scalars().all()

        return [
            {
                "id": exec.id,
                "input_message": exec.input_message,
                "output_response": exec.output_response,
                "status": exec.status,
                "started_at": exec.started_at.isoformat(),
                "completed_at": exec.completed_at.isoformat() if exec.completed_at else None,
                "execution_time_ms": (
                    int((exec.completed_at - exec.started_at).total_seconds() * 1000)
                    if exec.completed_at and exec.started_at else None
                )
            }
            for exec in executions
        ]

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao buscar execuções: {str(e)}")