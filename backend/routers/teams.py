# backend/routers/teams.py - VERSÃO CORRIGIDA PARA POSTGRESQL

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, insert, update, delete, func
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from datetime import datetime
import uuid
import json

# Imports corrigidos para PostgreSQL
from models.database import get_db
from models.agents import Agent, Team, TeamAgent

router = APIRouter(prefix="/api/teams", tags=["Teams"])


# ==================== PYDANTIC MODELS ====================

class AgentInTeamRequest(BaseModel):
    agent_id: int  # Corrigido para int
    role_in_team: str = "member"
    priority: int = 1


class TeamCreateRequest(BaseModel):
    name: str
    description: str
    team_type: str = "collaborative"
    agents: List[AgentInTeamRequest]
    supervisor_agent_id: Optional[int] = None  # Corrigido para int
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
    id: int
    name: str
    description: str
    team_type: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    agent_count: int
    agents: List[Dict[str, Any]]
    supervisor: Optional[Dict[str, Any]] = None


# ==================== HELPER FUNCTIONS ====================

async def get_team_with_agents(db: AsyncSession, team_id: int) -> Optional[Dict[str, Any]]:
    """Busca team com todos os agentes usando queries separadas"""

    # Buscar team
    result = await db.execute(
        select(Team).where(Team.id == team_id, Team.is_active == True)
    )
    team = result.scalar_one_or_none()

    if not team:
        return None

    # Buscar team_agents
    result = await db.execute(
        select(TeamAgent).where(TeamAgent.team_id == team_id, TeamAgent.is_active == True)
    )
    team_agents = result.scalars().all()

    # Buscar dados dos agentes
    agents_data = []
    if team_agents:
        agent_ids = [ta.agent_id for ta in team_agents]
        result = await db.execute(
            select(Agent).where(Agent.id.in_(agent_ids), Agent.is_active == True)
        )
        agents = {agent.id: agent for agent in result.scalars().all()}

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
                    "is_active": agent.is_active,
                    "tools": agent.tools or []
                }
                agents_data.append(agent_data)

    # Buscar supervisor se existir
    supervisor_data = None
    if team.supervisor_agent_id:
        result = await db.execute(
            select(Agent).where(Agent.id == team.supervisor_agent_id)
        )
        supervisor = result.scalar_one_or_none()
        if supervisor:
            supervisor_data = {
                "id": supervisor.id,
                "name": supervisor.name,
                "role": supervisor.role
            }

    return {
        "id": team.id,
        "name": team.name,
        "description": team.description,
        "team_type": team.team_type,
        "is_active": team.is_active,
        "created_at": team.created_at,
        "updated_at": team.updated_at,
        "team_configuration": team.team_configuration or {},
        "agent_count": len(agents_data),
        "agents": agents_data,
        "supervisor": supervisor_data
    }


# ==================== ENDPOINTS ====================

@router.get("/", response_model=List[Dict[str, Any]])
async def list_teams(
        user_id: int = 1,
        active_only: bool = True,
        db: AsyncSession = Depends(get_db)
):
    """Lista todos os teams"""
    try:
        # Query simples sem relacionamentos
        query = select(Team).where(Team.user_id == user_id)

        if active_only:
            query = query.where(Team.is_active == True)

        query = query.order_by(Team.created_at.desc())

        result = await db.execute(query)
        teams = result.scalars().all()

        # Enriquecer com dados dos agentes para cada team
        teams_data = []
        for team in teams:
            team_data = await get_team_with_agents(db, team.id)
            if team_data:
                teams_data.append(team_data)

        return teams_data

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao listar teams: {str(e)}")


@router.get("/{team_id}", response_model=Dict[str, Any])
async def get_team(team_id: int, user_id: int = 1, db: AsyncSession = Depends(get_db)):
    """Busca um team específico"""
    try:
        team_data = await get_team_with_agents(db, team_id)
        if not team_data:
            raise HTTPException(status_code=404, detail="Team não encontrado")

        return team_data

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao buscar team: {str(e)}")


@router.post("/", response_model=Dict[str, Any])
async def create_team(
        team_request: TeamCreateRequest,
        user_id: int = 1,
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
        team_data = {
            "user_id": user_id,
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
            insert(Team).values(**team_data).returning(Team.id)
        )
        team_id = result.scalar_one()

        # Adicionar agentes ao team
        for agent_req in team_request.agents:
            team_agent_data = {
                "team_id": team_id,
                "agent_id": agent_req.agent_id,
                "role_in_team": agent_req.role_in_team,
                "priority": agent_req.priority,
                "is_active": True,
                "created_at": datetime.utcnow()
            }
            await db.execute(insert(TeamAgent).values(**team_agent_data))

        await db.commit()

        # Buscar team criado
        created_team = await get_team_with_agents(db, team_id)
        if not created_team:
            raise HTTPException(status_code=500, detail="Erro ao criar team")

        return {
            "success": True,
            "message": "Team criado com sucesso",
            "team": created_team
        }

    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")


@router.put("/{team_id}", response_model=Dict[str, Any])
async def update_team(
        team_id: int,
        team_update: TeamUpdateRequest,
        user_id: int = 1,
        db: AsyncSession = Depends(get_db)
):
    """Atualiza um team"""
    try:
        # Verificar se team existe
        result = await db.execute(
            select(Team).where(Team.id == team_id, Team.user_id == user_id)
        )
        team = result.scalar_one_or_none()
        if not team:
            raise HTTPException(status_code=404, detail="Team não encontrado")

        # Preparar dados para atualização
        update_data = {"updated_at": datetime.utcnow()}

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

        # Aplicar atualização
        await db.execute(
            update(Team).where(Team.id == team_id).values(**update_data)
        )
        await db.commit()

        # Buscar team atualizado
        updated_team = await get_team_with_agents(db, team_id)
        return {
            "success": True,
            "message": "Team atualizado com sucesso",
            "team": updated_team
        }

    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao atualizar team: {str(e)}")


@router.delete("/{team_id}")
async def delete_team(
        team_id: int,
        user_id: int = 1,
        db: AsyncSession = Depends(get_db)
):
    """Remove um team (soft delete)"""
    try:
        # Verificar se team existe
        result = await db.execute(
            select(Team).where(Team.id == team_id, Team.user_id == user_id)
        )
        team = result.scalar_one_or_none()
        if not team:
            raise HTTPException(status_code=404, detail="Team não encontrado")

        # Soft delete do team
        await db.execute(
            update(Team)
            .where(Team.id == team_id)
            .values(is_active=False, updated_at=datetime.utcnow())
        )

        # Soft delete dos team_agents
        await db.execute(
            update(TeamAgent)
            .where(TeamAgent.team_id == team_id)
            .values(is_active=False)
        )

        await db.commit()

        return {"message": "Team removido com sucesso"}

    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao remover team: {str(e)}")


@router.post("/{team_id}/agents")
async def add_agent_to_team(
        team_id: int,
        agent_request: AgentInTeamRequest,
        user_id: int = 1,
        db: AsyncSession = Depends(get_db)
):
    """Adiciona um agente ao team"""
    try:
        # Verificar se team existe
        result = await db.execute(
            select(Team).where(Team.id == team_id, Team.user_id == user_id, Team.is_active == True)
        )
        team = result.scalar_one_or_none()
        if not team:
            raise HTTPException(status_code=404, detail="Team não encontrado")

        # Verificar se agente existe
        result = await db.execute(
            select(Agent).where(Agent.id == agent_request.agent_id, Agent.is_active == True)
        )
        agent = result.scalar_one_or_none()
        if not agent:
            raise HTTPException(status_code=404, detail="Agente não encontrado")

        # Verificar se agente já está no team
        result = await db.execute(
            select(TeamAgent).where(
                TeamAgent.team_id == team_id,
                TeamAgent.agent_id == agent_request.agent_id,
                TeamAgent.is_active == True
            )
        )
        existing = result.scalar_one_or_none()
        if existing:
            raise HTTPException(status_code=400, detail="Agente já está no team")

        # Adicionar agente ao team
        team_agent_data = {
            "team_id": team_id,
            "agent_id": agent_request.agent_id,
            "role_in_team": agent_request.role_in_team,
            "priority": agent_request.priority,
            "is_active": True,
            "created_at": datetime.utcnow()
        }
        await db.execute(insert(TeamAgent).values(**team_agent_data))
        await db.commit()

        return {"message": "Agente adicionado ao team com sucesso"}

    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao adicionar agente: {str(e)}")


@router.delete("/{team_id}/agents/{agent_id}")
async def remove_agent_from_team(
        team_id: int,
        agent_id: int,
        user_id: int = 1,
        db: AsyncSession = Depends(get_db)
):
    """Remove um agente do team"""
    try:
        # Verificar se team existe
        result = await db.execute(
            select(Team).where(Team.id == team_id, Team.user_id == user_id, Team.is_active == True)
        )
        team = result.scalar_one_or_none()
        if not team:
            raise HTTPException(status_code=404, detail="Team não encontrado")

        # Verificar se agente está no team
        result = await db.execute(
            select(TeamAgent).where(
                TeamAgent.team_id == team_id,
                TeamAgent.agent_id == agent_id,
                TeamAgent.is_active == True
            )
        )
        team_agent = result.scalar_one_or_none()
        if not team_agent:
            raise HTTPException(status_code=404, detail="Agente não está no team")

        # Remover agente do team (soft delete)
        await db.execute(
            update(TeamAgent)
            .where(TeamAgent.team_id == team_id, TeamAgent.agent_id == agent_id)
            .values(is_active=False)
        )
        await db.commit()

        return {"message": "Agente removido do team com sucesso"}

    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao remover agente: {str(e)}")