# backend/routers/teams.py - VERSÃO CORRIGIDA SEM 307 REDIRECTS
from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, insert, update, delete, func
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from datetime import datetime
import json
import asyncio

try:
    from .agno_services import RealAgnoService, AGNO_AVAILABLE
except ImportError:
    try:
        from agno_services import RealAgnoService, AGNO_AVAILABLE
    except ImportError:
        AGNO_AVAILABLE = False
        RealAgnoService = None

real_agno_service = RealAgnoService() if AGNO_AVAILABLE else None
# Ajuste os imports conforme sua estrutura
try:
    from models.database import get_db
    from models.agents import Agent, Team, TeamAgent
except ImportError:
    from ..models.database import get_db
    from ..models.agents import Agent, Team, TeamAgent

# ==================== ROUTER SEM TRAILING SLASH ISSUES ====================
router = APIRouter(prefix="/api/teams", tags=["Teams"])

# ==================== MODELOS PYDANTIC ====================

class AgentInTeamRequest(BaseModel):
    agent_id: int
    role_in_team: str = "member"
    priority: int = 1

class TeamCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str = Field(default="", max_length=500)
    team_type: str = Field(default="collaborative")
    agents: List[AgentInTeamRequest] = Field(default=[])
    supervisor_agent_id: Optional[int] = None
    team_configuration: Dict[str, Any] = Field(default_factory=dict)
    user_id: int = Field(default=1)

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

        # Buscar team_agents com dados dos agentes
        result = await db.execute(
            select(TeamAgent, Agent)
            .join(Agent, TeamAgent.agent_id == Agent.id)
            .where(
                TeamAgent.team_id == team_id,
                TeamAgent.is_active == True,
                Agent.is_active == True
            )
            .order_by(TeamAgent.priority.asc())
        )
        team_agents = result.all()

        # Processar agentes
        agents_data = []
        for team_agent, agent in team_agents:
            # Processar configuração do agente no team
            agent_config = {}
            if team_agent.agent_config:
                if isinstance(team_agent.agent_config, str):
                    try:
                        agent_config = json.loads(team_agent.agent_config)
                    except:
                        agent_config = {}
                elif isinstance(team_agent.agent_config, dict):
                    agent_config = team_agent.agent_config

            # Processar instruções do agente
            instructions = agent.instructions if agent.instructions else []
            if isinstance(instructions, str):
                try:
                    instructions = json.loads(instructions)
                except:
                    instructions = [instructions]

            # Processar tools do agente
            tools = agent.tools if agent.tools else []
            if isinstance(tools, str):
                try:
                    tools = json.loads(tools)
                except:
                    tools = []
            if isinstance(tools, list):
                tools = [
                    t if isinstance(t, dict) else {"tool_id": str(t), "config": {}}
                    for t in tools
                ]
            agent_data = {
                "id": agent.id,
                "name": agent.name,
                "role": agent.role,
                "description": agent.description or "",
                "model_provider": agent.model_provider,
                "model_id": agent.model_id,
                "instructions": instructions,
                "tools": tools,
                "role_in_team": team_agent.role_in_team,
                "priority": team_agent.priority,
                "config": agent_config
            }
            agents_data.append(agent_data)

        # Processar configuração do team
        team_config = team.team_configuration if team.team_configuration else {}
        if isinstance(team_config, str):
            try:
                team_config = json.loads(team_config)
            except:
                team_config = {}

        return {
            "id": team.id,
            "name": team.name,
            "description": team.description or "",
            "team_type": team.team_type,
            "supervisor_agent_id": team.supervisor_agent_id,
            "team_configuration": team_config,
            "is_active": team.is_active,
            "created_at": team.created_at,
            "updated_at": team.updated_at,
            "agents": agents_data,
            "agent_count": len(agents_data)
        }

    except Exception as e:
        print(f"❌ Erro ao buscar team {team_id}: {e}")
        return None

# ==================== ENDPOINTS PRINCIPAIS ====================

@router.get("", response_model=List[TeamResponse])
async def list_teams(
    user_id: int = Query(1, description="ID do usuário"),
    db: AsyncSession = Depends(get_db)
):
    """Lista todos os teams do usuário - SEM TRAILING SLASH"""
    try:
        # Buscar teams ativos do usuário
        result = await db.execute(
            select(Team)
            .where(Team.user_id == user_id, Team.is_active == True)
            .order_by(Team.created_at.desc())
        )
        teams = result.scalars().all()

        # Buscar dados completos para cada team
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

@router.post("", response_model=TeamResponse)
async def create_team(
    request: TeamCreateRequest,
    db: AsyncSession = Depends(get_db)
):
    """Cria um novo team - SEM TRAILING SLASH"""
    try:
        # Validar que os agentes existem
        if request.agents:
            agent_ids = [agent.agent_id for agent in request.agents]
            result = await db.execute(
                select(Agent).where(
                    Agent.id.in_(agent_ids),
                    Agent.user_id == request.user_id,
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
            "user_id": request.user_id,
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
                    "agent_config": {},  # JSON como dict
                    "is_active": True,
                    "created_at": datetime.utcnow()
                }

                await db.execute(
                    insert(TeamAgent).values(**team_agent_data)
                )

        await db.commit()

        print(f"✅ Team criado: {new_team.name} (ID: {new_team.id}) com {len(request.agents)} agentes")

        # Retornar team completo
        team_complete = await get_team_with_agents(db, new_team.id, request.user_id)
        return TeamResponse(**team_complete)

    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        print(f"❌ Erro ao criar team: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao criar team: {str(e)}")

@router.get("/{team_id}", response_model=TeamResponse)
async def get_team(
    team_id: int,
    user_id: int = Query(1, description="ID do usuário"),
    db: AsyncSession = Depends(get_db)
):
    """Busca um team específico"""
    try:
        team_data = await get_team_with_agents(db, team_id, user_id)
        if not team_data:
            raise HTTPException(
                status_code=404,
                detail=f"Team {team_id} não encontrado"
            )

        return TeamResponse(**team_data)

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Erro ao buscar team {team_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")

@router.post("/{team_id}/execute")
async def execute_team(
    team_id: int,
    request: TeamExecuteRequest,
    user_id: int = Query(1, description="ID do usuário"),
    db: AsyncSession = Depends(get_db)
):
    """Executa um team"""
    try:
        # Buscar team com agentes
        team_data = await get_team_with_agents(db, team_id, user_id)
        if not team_data:
            raise HTTPException(
                status_code=404,
                detail=f"Team {team_id} não encontrado"
            )

        print(f"🚀 Executando team: {team_data['name']} com {len(team_data['agents'])} agentes")

        if AGNO_AVAILABLE and real_agno_service:
            responses = []
            for agent_info in team_data["agents"]:
                tools_list = [
                    t["tool_id"] if isinstance(t, dict) else str(t)
                    for t in (agent_info.get("tools") or [])
                ]
                agent_config = {
                    "name": agent_info["name"],
                    "role": agent_info["role"],
                    "model_provider": agent_info["model_provider"],
                    "model_id": agent_info["model_id"],
                    "instructions": agent_info.get("instructions", []),
                    "tools": tools_list,
                    "memory_enabled": getattr(agent_info, "memory_enabled", False),
                    "rag_enabled": getattr(agent_info, "rag_enabled", False),
                    "rag_index_id": getattr(agent_info, "rag_index_id", None),
                }
                try:
                    result = await asyncio.to_thread(
                        real_agno_service.execute_agent_task,
                        agent_config,
                        request.message,
                        tools_list,
                    )
                    responses.append({
                        "agent": agent_info["name"],
                        "response": result.get("response", "")
                    })
                except Exception as e:
                    print(f"⚠️ Falha na execução do agente {agent_info['name']}: {e}")
                    responses.append({
                        "agent": agent_info["name"],
                        "error": str(e)
                    })

            execution_result = {
                "team_id": team_id,
                "team_name": team_data["name"],
                "message": request.message,
                "responses": responses,
                "timestamp": datetime.utcnow().isoformat(),
                "status": "completed",
                "context": request.context,
            }
        else:
            execution_result = {
                "team_id": team_id,
                "team_name": team_data["name"],
                "message": request.message,
                "agents_involved": [agent["name"] for agent in team_data["agents"]],
                "response": f"Team '{team_data['name']}' processou a mensagem: '{request.message}'. Resultado simulado com {len(team_data['agents'])} agentes trabalhando em modo {team_data['team_type']}.",
                "execution_time_ms": 1500,
                "timestamp": datetime.utcnow().isoformat(),
                "status": "completed",
                "context": request.context,
                "logs": [
                    f"Iniciando execução do team {team_data['name']}",
                    f"Coordenando {len(team_data['agents'])} agentes",
                    f"Processando mensagem: {request.message[:50]}...",
                    "Execução concluída com sucesso",
                ],
            }

        return execution_result

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Erro na execução do team {team_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Erro na execução: {str(e)}")

@router.put("/{team_id}", response_model=TeamResponse)
async def update_team(
    team_id: int,
    request: TeamCreateRequest,
    db: AsyncSession = Depends(get_db)
):
    """Atualiza um team existente"""
    try:
        # Verificar se team existe
        result = await db.execute(
            select(Team).where(
                Team.id == team_id,
                Team.user_id == request.user_id,
                Team.is_active == True
            )
        )
        team = result.scalar_one_or_none()

        if not team:
            raise HTTPException(status_code=404, detail="Team não encontrado")

        # Validar agentes se fornecidos
        if request.agents:
            agent_ids = [agent.agent_id for agent in request.agents]
            result = await db.execute(
                select(Agent).where(
                    Agent.id.in_(agent_ids),
                    Agent.user_id == request.user_id,
                    Agent.is_active == True
                )
            )
            existing_agents = {agent.id for agent in result.scalars().all()}

            missing_agents = set(agent_ids) - existing_agents
            if missing_agents:
                raise HTTPException(
                    status_code=400,
                    detail=f"Agentes não encontrados: {list(missing_agents)}"
                )

        # Atualizar team
        await db.execute(
            update(Team)
            .where(Team.id == team_id)
            .values(
                name=request.name,
                description=request.description,
                team_type=request.team_type,
                supervisor_agent_id=request.supervisor_agent_id,
                team_configuration=request.team_configuration,
                updated_at=datetime.utcnow()
            )
        )

        # Desativar team_agents existentes
        await db.execute(
            update(TeamAgent)
            .where(TeamAgent.team_id == team_id)
            .values(is_active=False)
        )

        # Adicionar novos team_agents
        if request.agents:
            for agent_data in request.agents:
                team_agent_data = {
                    "team_id": team_id,
                    "agent_id": agent_data.agent_id,
                    "role_in_team": agent_data.role_in_team,
                    "priority": agent_data.priority,
                    "agent_config": {},
                    "is_active": True,
                    "created_at": datetime.utcnow()
                }

                await db.execute(
                    insert(TeamAgent).values(**team_agent_data)
                )

        await db.commit()

        print(f"✅ Team atualizado: {request.name} (ID: {team_id})")

        # Retornar team atualizado
        team_complete = await get_team_with_agents(db, team_id, request.user_id)
        return TeamResponse(**team_complete)

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        print(f"❌ Erro ao atualizar team {team_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")

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

# ==================== ENDPOINTS ADICIONAIS ====================

@router.get("/{team_id}/agents")
async def list_team_agents(
    team_id: int,
    user_id: int = Query(1, description="ID do usuário"),
    db: AsyncSession = Depends(get_db)
):
    """Lista agentes de um team específico"""
    try:
        team_data = await get_team_with_agents(db, team_id, user_id)
        if not team_data:
            raise HTTPException(
                status_code=404,
                detail=f"Team {team_id} não encontrado"
            )

        return {
            "team_id": team_id,
            "team_name": team_data["name"],
            "agents": team_data["agents"],
            "agent_count": team_data["agent_count"]
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Erro ao listar agentes do team {team_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")

@router.post("/{team_id}/agents/{agent_id}")
async def add_agent_to_team(
    team_id: int,
    agent_id: int,
    role_in_team: str = "member",
    priority: int = 1,
    user_id: int = Query(1, description="ID do usuário"),
    db: AsyncSession = Depends(get_db)
):
    """Adiciona um agente a um team"""
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

        # Verificar se agente existe
        result = await db.execute(
            select(Agent).where(
                Agent.id == agent_id,
                Agent.user_id == user_id,
                Agent.is_active == True
            )
        )
        agent = result.scalar_one_or_none()

        if not agent:
            raise HTTPException(status_code=404, detail="Agente não encontrado")

        # Verificar se agente já está no team
        result = await db.execute(
            select(TeamAgent).where(
                TeamAgent.team_id == team_id,
                TeamAgent.agent_id == agent_id,
                TeamAgent.is_active == True
            )
        )
        existing = result.scalar_one_or_none()

        if existing:
            raise HTTPException(
                status_code=400,
                detail=f"Agente {agent.name} já está no team {team.name}"
            )

        # Adicionar agente ao team
        team_agent_data = {
            "team_id": team_id,
            "agent_id": agent_id,
            "role_in_team": role_in_team,
            "priority": priority,
            "agent_config": {},
            "is_active": True,
            "created_at": datetime.utcnow()
        }

        await db.execute(
            insert(TeamAgent).values(**team_agent_data)
        )
        await db.commit()

        print(f"✅ Agente {agent.name} adicionado ao team {team.name}")

        return {
            "message": f"Agente {agent.name} adicionado ao team {team.name}",
            "team_id": team_id,
            "agent_id": agent_id,
            "role_in_team": role_in_team,
            "priority": priority
        }

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        print(f"❌ Erro ao adicionar agente ao team: {e}")
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")

@router.delete("/{team_id}/agents/{agent_id}")
async def remove_agent_from_team(
    team_id: int,
    agent_id: int,
    user_id: int = Query(1, description="ID do usuário"),
    db: AsyncSession = Depends(get_db)
):
    """Remove um agente de um team"""
    try:
        # Verificar se team_agent existe
        result = await db.execute(
            select(TeamAgent, Team, Agent)
            .join(Team, TeamAgent.team_id == Team.id)
            .join(Agent, TeamAgent.agent_id == Agent.id)
            .where(
                TeamAgent.team_id == team_id,
                TeamAgent.agent_id == agent_id,
                Team.user_id == user_id,
                TeamAgent.is_active == True
            )
        )
        team_agent_data = result.first()

        if not team_agent_data:
            raise HTTPException(
                status_code=404,
                detail="Agente não encontrado no team"
            )

        team_agent, team, agent = team_agent_data

        # Remover agente do team
        await db.execute(
            update(TeamAgent)
            .where(
                TeamAgent.team_id == team_id,
                TeamAgent.agent_id == agent_id
            )
            .values(is_active=False)
        )
        await db.commit()

        print(f"🗑️ Agente {agent.name} removido do team {team.name}")

        return {
            "message": f"Agente {agent.name} removido do team {team.name}",
            "team_id": team_id,
            "agent_id": agent_id
        }

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        print(f"❌ Erro ao remover agente do team: {e}")
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")