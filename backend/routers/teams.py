# backend/routers/teams.py - VERSÃO CORRIGIDA FINAL
from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, insert, update, delete, func
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from datetime import datetime
import json

# Ajuste os imports conforme sua estrutura
try:
    from models.database import get_db
    from models.agents import Agent, Team, TeamAgent
except ImportError:
    from ..models.database import get_db
    from ..models.agents import Agent, Team, TeamAgent

router = APIRouter(prefix="/api/teams", tags=["Teams"])


# ==================== MODELOS PYDANTIC CORRIGIDOS ====================

class AgentInTeamRequest(BaseModel):
    agent_id: int  # Deve ser int, não string
    role_in_team: str = "member"
    priority: int = 1


class TeamCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str = Field(default="", max_length=500)
    team_type: str = Field(default="collaborative")
    agents: List[AgentInTeamRequest] = Field(default=[])
    supervisor_agent_id: Optional[int] = None  # Deve ser int, não string
    team_configuration: Dict[str, Any] = Field(default_factory=dict)


class TeamExecuteRequest(BaseModel):
    message: str = Field(..., min_length=1)
    context: Optional[Dict[str, Any]] = Field(default_factory=dict)


class TeamResponse(BaseModel):
    id: int
    name: str
    description: str
    team_type: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    agents: List[Dict[str, Any]]
    agent_count: int


# ==================== HELPER FUNCTIONS ====================

async def get_team_with_agents(db: AsyncSession, team_id: int, user_id: int = 1) -> Optional[Dict[str, Any]]:
    """Busca team com todos os agentes"""
    try:
        # Buscar team
        result = await db.execute(
            select(Team).where(
                Team.id == team_id,
                Team.user_id == user_id,
                Team.is_active == True
            )
        )
        team = result.scalar_one_or_none()

        if not team:
            return None

        # Buscar team_agents
        result = await db.execute(
            select(TeamAgent).where(
                TeamAgent.team_id == team_id,
                TeamAgent.is_active == True
            )
        )
        team_agents = result.scalars().all()

        # Buscar dados dos agentes
        agents_data = []
        if team_agents:
            agent_ids = [ta.agent_id for ta in team_agents]
            agents_result = await db.execute(
                select(Agent).where(
                    Agent.id.in_(agent_ids),
                    Agent.is_active == True
                )
            )
            agents = {agent.id: agent for agent in agents_result.scalars().all()}

            for ta in team_agents:
                if ta.agent_id in agents:
                    agent = agents[ta.agent_id]
                    agent_data = {
                        "agent_id": agent.id,
                        "name": agent.name,
                        "role": agent.role,
                        "role_in_team": ta.role_in_team,
                        "priority": ta.priority,
                        "model_provider": agent.model_provider,
                        "model_id": agent.model_id
                    }
                    agents_data.append(agent_data)

        return {
            "id": team.id,
            "name": team.name,
            "description": team.description,
            "team_type": team.team_type,
            "is_active": team.is_active,
            "created_at": team.created_at,
            "updated_at": team.updated_at,
            "agents": agents_data,
            "agent_count": len(agents_data),
            "team_configuration": team.team_configuration or {}
        }

    except Exception as e:
        print(f"❌ Erro ao buscar team {team_id}: {e}")
        return None


# ==================== ENDPOINTS CORRIGIDOS ====================

@router.get("/")
@router.get("")
async def list_teams(
        user_id: int = Query(1, description="ID do usuário"),
        db: AsyncSession = Depends(get_db)
):
    """Lista todos os teams do usuário"""
    try:
        result = await db.execute(
            select(Team)
            .where(Team.user_id == user_id, Team.is_active == True)
            .order_by(Team.created_at.desc())
        )
        teams = result.scalars().all()

        teams_response = []
        for team in teams:
            team_data = await get_team_with_agents(db, team.id, user_id)
            if team_data:
                teams_response.append(TeamResponse(**team_data))

        print(f"📋 Listados {len(teams_response)} teams para usuário {user_id}")
        return teams_response

    except Exception as e:
        print(f"❌ Erro ao listar teams: {e}")
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")


@router.post("/")
@router.post("")
async def create_team(
        request: TeamCreateRequest,
        user_id: int = Query(1, description="ID do usuário"),
        db: AsyncSession = Depends(get_db)
):
    """Cria um novo team com validação corrigida"""
    try:
        # Validar que os agentes existem
        if request.agents:
            agent_ids = [agent.agent_id for agent in request.agents]
            result = await db.execute(
                select(Agent).where(
                    Agent.id.in_(agent_ids),
                    Agent.user_id == user_id,
                    Agent.is_active == True
                )
            )
            existing_agents = {agent.id for agent in result.scalars().all()}

            # Verificar se todos os agentes existem
            missing_agents = set(agent_ids) - existing_agents
            if missing_agents:
                raise HTTPException(
                    status_code=400,
                    detail=f"Agentes não encontrados: {list(missing_agents)}"
                )

        # Criar team
        team_data = {
            "user_id": user_id,
            "name": request.name,
            "description": request.description,
            "team_type": request.team_type,
            "supervisor_agent_id": request.supervisor_agent_id,
            "team_configuration": request.team_configuration,
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }

        result = await db.execute(
            insert(Team).values(**team_data).returning(Team)
        )
        new_team = result.scalar_one()

        # Adicionar agentes ao team
        if request.agents:
            for agent_data in request.agents:
                team_agent_data = {
                    "team_id": new_team.id,
                    "agent_id": agent_data.agent_id,
                    "role_in_team": agent_data.role_in_team,
                    "priority": agent_data.priority,
                    "agent_config": "{}",  # JSON vazio como string
                    "is_active": True,
                    "created_at": datetime.utcnow()
                }

                await db.execute(
                    insert(TeamAgent).values(**team_agent_data)
                )

        await db.commit()

        print(f"✅ Team criado: {new_team.name} (ID: {new_team.id}) com {len(request.agents)} agentes")

        # Retornar team completo
        team_complete = await get_team_with_agents(db, new_team.id, user_id)
        return TeamResponse(**team_complete)

    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        print(f"❌ Erro ao criar team: {e}")
        print(f"Request data: {request}")
        raise HTTPException(status_code=500, detail=f"Erro ao criar team: {str(e)}")


@router.post("/{team_id}/execute")
async def execute_team(
        team_id: int,
        request: TeamExecuteRequest,
        user_id: int = Query(1, description="ID do usuário"),
        db: AsyncSession = Depends(get_db)
):
    """ENDPOINT CORRIGIDO: Executa um team"""
    try:
        # Buscar team com agentes
        team_data = await get_team_with_agents(db, team_id, user_id)
        if not team_data:
            raise HTTPException(
                status_code=404,
                detail=f"Team {team_id} não encontrado"
            )

        print(f"🚀 Executando team: {team_data['name']} com {len(team_data['agents'])} agentes")

        # Simular execução do team (substitua pela lógica real)
        execution_result = {
            "team_id": team_id,
            "team_name": team_data["name"],
            "message": request.message,
            "agents_involved": [agent["name"] for agent in team_data["agents"]],
            "response": f"Team '{team_data['name']}' processou a mensagem: '{request.message}'. "
                        f"Resultado simulado com {len(team_data['agents'])} agentes trabalhando em modo {team_data['team_type']}.",
            "execution_time_ms": 1500,  # Simulado
            "timestamp": datetime.utcnow().isoformat(),
            "status": "completed",
            "context": request.context,
            "logs": [
                f"Iniciando execução do team {team_data['name']}",
                f"Coordenando {len(team_data['agents'])} agentes",
                f"Processando mensagem: {request.message[:50]}...",
                "Execução concluída com sucesso"
            ]
        }

        return execution_result

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Erro na execução do team {team_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Erro na execução: {str(e)}")


@router.delete("/{team_id}")
async def delete_team(
        team_id: int,
        user_id: int = Query(1, description="ID do usuário"),
        db: AsyncSession = Depends(get_db)
):
    """Remove um team (soft delete)"""
    try:
        # Verificar se team existe
        result = await db.execute(
            select(Team).where(
                Team.id == team_id,
                Team.user_id == user_id,
                Team.is_active == True
            )
        )
        team = result.scalar_one_or_none()

        if not team:
            raise HTTPException(status_code=404, detail="Team não encontrado")

        # Desativar team_agents primeiro
        await db.execute(
            update(TeamAgent)
            .where(TeamAgent.team_id == team_id)
            .values(is_active=False)
        )

        # Soft delete do team
        await db.execute(
            update(Team)
            .where(Team.id == team_id)
            .values(is_active=False, updated_at=datetime.utcnow())
        )

        await db.commit()

        print(f"🗑️ Team {team.name} removido")

        return {"message": f"Team {team.name} removido com sucesso"}

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        print(f"❌ Erro ao remover team {team_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")