# agno_service.py - Integração do Agno com o sistema existente

import os
import json
import asyncio
from typing import List, Dict, Any, Optional
from datetime import datetime
from dataclasses import dataclass
from enum import Enum

# Agno imports
from agno.agent import Agent
from agno.team import Team
from agno.models.openai import OpenAIChat
from agno.models.anthropic import Claude
from agno.tools.duckduckgo import DuckDuckGoTools
from agno.tools.yfinance import YFinanceTools
from agno.tools.reasoning import ReasoningTools
#from agno.workflows import Workflow
#from agno.storage import PostgresStorage

# FastAPI imports
from fastapi import FastAPI, HTTPException, Depends, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Sistema existente
from supabase_client import supabase, get_api_key, testar_login, safe_supabase_query


class AgentType(str, Enum):
    SINGLE = "single"
    WORKFLOW = "workflow"
    TEAM = "team"


class ModelProvider(str, Enum):
    OPENAI = "openai"
    ANTHROPIC = "anthropic"


@dataclass
class AgentConfig:
    name: str
    role: str
    model_provider: ModelProvider
    model_id: str
    instructions: List[str]
    tools: List[str]
    memory_enabled: bool = True
    rag_enabled: bool = False
    rag_index_id: Optional[str] = None


@dataclass
class WorkflowConfig:
    name: str
    description: str
    agents: List[AgentConfig]
    flow_type: str = "sequential"  # sequential, parallel, conditional
    supervisor_enabled: bool = False


class AgnoService:
    """Serviço principal para gerenciar agentes Agno"""

    def __init__(self):
        self.agents: Dict[str, Agent] = {}
        self.teams: Dict[str, Team] = {}
        self.workflows: Dict[str, Any] = {}

    async def initialize_storage(self, user_id: int):
        """Inicializa storage PostgreS para o usuário"""
        return ("nada")
        #return PostgresStorage(
        #   table_name=f"agent_sessions_{user_id}",
        #   connection_url=os.getenv("DATABASE_URL")  # Supabase connection
        #)

    def get_model(self, provider: ModelProvider, model_id: str, api_key: str):
        """Factory para criar modelos baseados no provider"""
        if provider == ModelProvider.OPENAI:
            return OpenAIChat(
                id=model_id,
                api_key=api_key
            )
        elif provider == ModelProvider.ANTHROPIC:
            return Claude(
                id=model_id,
                api_key=api_key
            )
        else:
            raise ValueError(f"Provider não suportado: {provider}")

    def get_tools(self, tool_names: List[str]):
        """Factory para criar tools baseadas nos nomes"""
        tools = []
        tool_mapping = {
            "duckduckgo": DuckDuckGoTools(),
            "yfinance": YFinanceTools(
                stock_price=True,
                analyst_recommendations=True,
                company_info=True
            ),
            "reasoning": ReasoningTools(add_instructions=True)
        }

        for tool_name in tool_names:
            if tool_name in tool_mapping:
                tools.append(tool_mapping[tool_name])

        return tools

    async def create_single_agent(
            self,
            user_id: int,
            config: AgentConfig
    ) -> str:
        """Cria um agente individual"""
        try:
            # Busca API key do usuário
            api_key = get_api_key(user_id)
            if not api_key:
                raise HTTPException(status_code=400, detail="API key não encontrada")

            # Cria modelo
            model = self.get_model(config.model_provider, config.model_id, api_key)

            # Cria tools
            tools = self.get_tools(config.tools)

            # Inicializa storage se necessário
            storage = None
            if config.memory_enabled:
                storage = await self.initialize_storage(user_id)

            # Cria agente
            agent = Agent(
                name=config.name,
                role=config.role,
                model=model,
                tools=tools,
                instructions=config.instructions,
                storage=storage,
                markdown=True,
                show_tool_calls=True
            )

            # Salva no banco de dados
            agent_data = {
                "nome": config.name,
                "modelo": config.model_id,
                "empresa": config.model_provider.value,
                "agent_type": "single",
                "agent_role": config.role,
                "instructions": json.dumps(config.instructions),
                "usa_rag": config.rag_enabled,
                "rag_index_id": config.rag_index_id,
                "is_active_agent": True,
                "created_at": datetime.utcnow().isoformat()
            }

            def save_agent():
                return supabase.table("ai_models").insert(agent_data).execute()

            result = safe_supabase_query(save_agent, operation_name="salvar agente")
            agent_id = result.data[0]["id"]

            # Armazena em memória
            self.agents[str(agent_id)] = agent

            return str(agent_id)

        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Erro ao criar agente: {str(e)}")

    async def create_workflow(
            self,
            user_id: int,
            config: WorkflowConfig
    ) -> str:
        """Cria um workflow multi-agente"""
        try:
            api_key = get_api_key(user_id)
            if not api_key:
                raise HTTPException(status_code=400, detail="API key não encontrada")

            # Cria agentes do workflow
            agents = []
            for agent_config in config.agents:
                model = self.get_model(agent_config.model_provider, agent_config.model_id, api_key)
                tools = self.get_tools(agent_config.tools)

                agent = Agent(
                    name=agent_config.name,
                    role=agent_config.role,
                    model=model,
                    tools=tools,
                    instructions=agent_config.instructions,
                    markdown=True
                )
                agents.append(agent)

            # Cria Team baseado no tipo de flow
            if config.flow_type == "sequential":
                team = Team(
                    name=config.name,
                    members=agents,
                    instructions=[config.description]
                )
            elif config.flow_type == "parallel":
                team = Team(
                    name=config.name,
                    members=agents,
                    mode="parallel",
                    instructions=[config.description]
                )
            else:  # conditional/supervisor
                team = Team(
                    name=config.name,
                    members=agents,
                    mode="supervisor" if config.supervisor_enabled else "coordinate",
                    instructions=[config.description]
                )

            # Salva workflow no banco
            workflow_data = {
                "nome": config.name,
                "descricao": config.description,
                "workflow_config": json.dumps({
                    "flow_type": config.flow_type,
                    "supervisor_enabled": config.supervisor_enabled,
                    "agents": [
                        {
                            "name": ac.name,
                            "role": ac.role,
                            "model_provider": ac.model_provider.value,
                            "model_id": ac.model_id,
                            "tools": ac.tools,
                            "instructions": ac.instructions
                        }
                        for ac in config.agents
                    ]
                }),
                "is_active": True,
                "created_at": datetime.utcnow().isoformat()
            }

            def save_workflow():
                return supabase.table("agent_workflows").insert(workflow_data).execute()

            result = safe_supabase_query(save_workflow, operation_name="salvar workflow")
            workflow_id = result.data[0]["id"]

            # Armazena em memória
            self.teams[str(workflow_id)] = team

            return str(workflow_id)

        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Erro ao criar workflow: {str(e)}")

    async def run_agent(
            self,
            agent_id: str,
            message: str,
            user_id: int,
            stream: bool = False
    ) -> Dict[str, Any]:
        """Executa um agente individual"""
        try:
            if agent_id not in self.agents:
                # Carrega agente do banco se não estiver em memória
                await self.load_agent_from_db(agent_id, user_id)

            agent = self.agents.get(agent_id)
            if not agent:
                raise HTTPException(status_code=404, detail="Agente não encontrado")

            if stream:
                # Para streaming, retorna generator
                return await agent.arun(message, stream=True)
            else:
                # Execução simples
                response = await agent.arun(message)
                return {
                    "content": response.content,
                    "tool_calls": response.tool_calls if hasattr(response, 'tool_calls') else [],
                    "reasoning": response.reasoning if hasattr(response, 'reasoning') else None
                }

        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Erro ao executar agente: {str(e)}")

    async def run_workflow(
            self,
            workflow_id: str,
            message: str,
            user_id: int
    ) -> Dict[str, Any]:
        """Executa um workflow"""
        try:
            if workflow_id not in self.teams:
                await self.load_workflow_from_db(workflow_id, user_id)

            team = self.teams.get(workflow_id)
            if not team:
                raise HTTPException(status_code=404, detail="Workflow não encontrado")

            response = await team.arun(message)
            return {
                "content": response.content,
                "agents_used": response.agents_used if hasattr(response, 'agents_used') else [],
                "execution_flow": response.execution_flow if hasattr(response, 'execution_flow') else []
            }

        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Erro ao executar workflow: {str(e)}")

    async def load_agent_from_db(self, agent_id: str, user_id: int):
        """Carrega agente do banco de dados"""

        def get_agent():
            return supabase.table("ai_models").select("*").eq("id", agent_id).single().execute()

        result = safe_supabase_query(get_agent, operation_name="carregar agente")
        if not result.data:
            raise HTTPException(status_code=404, detail="Agente não encontrado")

        data = result.data
        api_key = get_api_key(user_id)

        # Reconstroi agente
        model = self.get_model(
            ModelProvider(data["empresa"]),
            data["modelo"],
            api_key
        )

        tools = self.get_tools(json.loads(data.get("tools", "[]")))
        instructions = json.loads(data.get("instructions", "[]"))

        agent = Agent(
            name=data["nome"],
            role=data["agent_role"],
            model=model,
            tools=tools,
            instructions=instructions,
            markdown=True
        )

        self.agents[agent_id] = agent

    async def load_workflow_from_db(self, workflow_id: str, user_id: int):
        """Carrega workflow do banco de dados"""

        def get_workflow():
            return supabase.table("agent_workflows").select("*").eq("id", workflow_id).single().execute()

        result = safe_supabase_query(get_workflow, operation_name="carregar workflow")
        if not result.data:
            raise HTTPException(status_code=404, detail="Workflow não encontrado")

        data = result.data
        config_data = json.loads(data["workflow_config"])
        api_key = get_api_key(user_id)

        # Reconstroi agentes do workflow
        agents = []
        for agent_config in config_data["agents"]:
            model = self.get_model(
                ModelProvider(agent_config["model_provider"]),
                agent_config["model_id"],
                api_key
            )
            tools = self.get_tools(agent_config["tools"])

            agent = Agent(
                name=agent_config["name"],
                role=agent_config["role"],
                model=model,
                tools=tools,
                instructions=agent_config["instructions"],
                markdown=True
            )
            agents.append(agent)

        # Reconstroi team
        team = Team(
            name=data["nome"],
            members=agents,
            mode=config_data.get("flow_type", "sequential"),
            instructions=[data["descricao"]]
        )

        self.teams[workflow_id] = team


# Instância global do serviço
agno_service = AgnoService()


# Modelos Pydantic para API
class CreateAgentRequest(BaseModel):
    name: str
    role: str
    model_provider: ModelProvider
    model_id: str
    instructions: List[str]
    tools: List[str] = []
    memory_enabled: bool = True
    rag_enabled: bool = False
    rag_index_id: Optional[str] = None


class CreateWorkflowRequest(BaseModel):
    name: str
    description: str
    flow_type: str = "sequential"
    supervisor_enabled: bool = False
    agents: List[CreateAgentRequest]


class RunRequest(BaseModel):
    message: str
    stream: bool = False


# Rotas da API
app = FastAPI(title="Agno Integration API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/agents/create")
async def create_agent(request: CreateAgentRequest, user_id: int):
    """Cria um novo agente individual"""
    config = AgentConfig(
        name=request.name,
        role=request.role,
        model_provider=request.model_provider,
        model_id=request.model_id,
        instructions=request.instructions,
        tools=request.tools,
        memory_enabled=request.memory_enabled,
        rag_enabled=request.rag_enabled,
        rag_index_id=request.rag_index_id
    )

    agent_id = await agno_service.create_single_agent(user_id, config)
    return {"agent_id": agent_id, "status": "created"}


@app.post("/workflows/create")
async def create_workflow(request: CreateWorkflowRequest, user_id: int):
    """Cria um novo workflow multi-agente"""
    agent_configs = [
        AgentConfig(
            name=agent.name,
            role=agent.role,
            model_provider=agent.model_provider,
            model_id=agent.model_id,
            instructions=agent.instructions,
            tools=agent.tools,
            memory_enabled=agent.memory_enabled,
            rag_enabled=agent.rag_enabled,
            rag_index_id=agent.rag_index_id
        )
        for agent in request.agents
    ]

    config = WorkflowConfig(
        name=request.name,
        description=request.description,
        agents=agent_configs,
        flow_type=request.flow_type,
        supervisor_enabled=request.supervisor_enabled
    )

    workflow_id = await agno_service.create_workflow(user_id, config)
    return {"workflow_id": workflow_id, "status": "created"}


@app.post("/agents/{agent_id}/run")
async def run_agent(agent_id: str, request: RunRequest, user_id: int):
    """Executa um agente individual"""
    result = await agno_service.run_agent(
        agent_id,
        request.message,
        user_id,
        request.stream
    )
    return result


@app.post("/workflows/{workflow_id}/run")
async def run_workflow(workflow_id: str, request: RunRequest, user_id: int):
    """Executa um workflow"""
    result = await agno_service.run_workflow(workflow_id, request.message, user_id)
    return result


@app.get("/agents")
async def list_agents(user_id: int):
    """Lista agentes do usuário"""

    def get_user_agents():
        return supabase.table("ai_models").select("*").eq("user_id", user_id).execute()

    result = safe_supabase_query(get_user_agents, operation_name="listar agentes")
    return result.data


@app.get("/workflows")
async def list_workflows(user_id: int):
    """Lista workflows do usuário"""

    def get_user_workflows():
        return supabase.table("agent_workflows").select("*").eq("user_id", user_id).execute()

    result = safe_supabase_query(get_user_workflows, operation_name="listar workflows")
    return result.data


@app.websocket("/ws/agents/{agent_id}")
async def websocket_agent(websocket: WebSocket, agent_id: str, user_id: int):
    """WebSocket para streaming com agentes"""
    await websocket.accept()

    try:
        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)

            # Executa agente com streaming
            async for chunk in agno_service.run_agent(
                    agent_id,
                    message_data["message"],
                    user_id,
                    stream=True
            ):
                await websocket.send_text(json.dumps({
                    "type": "chunk",
                    "content": chunk
                }))

            await websocket.send_text(json.dumps({
                "type": "complete"
            }))

    except Exception as e:
        await websocket.send_text(json.dumps({
            "type": "error",
            "message": str(e)
        }))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)