# agno_service.py - Integração REAL do Agno com o sistema existente

import os
import json
import asyncio
import uuid
import traceback
from typing import List, Dict, Any, Optional, AsyncGenerator
from datetime import datetime
from dataclasses import dataclass
from enum import Enum
import logging

# Agno imports
from agno.agent import Agent
from agno.team import Team
from agno.models.openai import OpenAIChat
from agno.models.anthropic import Claude
from agno.tools.duckduckgo import DuckDuckGoTools
from agno.tools.yfinance import YFinanceTools
from agno.tools.reasoning import ReasoningTools

# Sistema existente
try:
    from supabase_client import supabase, get_api_key, testar_login, safe_supabase_query
except ImportError:
    print("⚠️ supabase_client não encontrado - usando configuração básica")
    supabase = None

# Logging
logger = logging.getLogger(__name__)


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
    flow_type: str = "sequential"
    supervisor_enabled: bool = False


class AgnoService:
    """Serviço principal para gerenciar agentes Agno REAIS"""

    def __init__(self):
        self.agents: Dict[str, Agent] = {}
        self.teams: Dict[str, Team] = {}
        self.workflows: Dict[str, Any] = {}
        self.sessions: Dict[str, Dict] = {}

        logger.info("🚀 AgnoService REAL inicializado")

    async def initialize_storage(self, user_id: int):
        """Inicializa storage para o usuário"""
        # Por enquanto, retorna None - implementar storage depois
        return None

    def get_model(self, provider: ModelProvider, model_id: str, api_key: str):
        """Factory para criar modelos baseados no provider"""
        try:
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
        except Exception as e:
            logger.error(f"❌ Erro ao criar modelo {provider}/{model_id}: {str(e)}")
            raise

    def get_tools(self, tool_names: List[str]) -> List[Any]:
        """Factory para criar ferramentas baseadas nos nomes"""
        tools = []

        for tool_name in tool_names:
            try:
                if tool_name.lower() in ['duckduckgo', 'web_search', 'search']:
                    tools.append(DuckDuckGoTools())
                elif tool_name.lower() in ['yfinance', 'finance', 'stocks']:
                    tools.append(YFinanceTools())
                elif tool_name.lower() in ['reasoning', 'reason', 'think']:
                    tools.append(ReasoningTools())
                else:
                    logger.warning(f"⚠️ Ferramenta não reconhecida: {tool_name}")
            except Exception as e:
                logger.error(f"❌ Erro ao carregar ferramenta {tool_name}: {str(e)}")

        return tools

    async def create_single_agent(self, user_id: int, config: AgentConfig) -> str:
        """Cria um agente individual usando Agno REAL"""
        session_id = f"create_agent_{user_id}_{int(datetime.now().timestamp())}"

        try:
            logger.info(f"🎯 [SESSION: {session_id}] Criando agente REAL: {config.name}")
            logger.info(f"👤 [SESSION: {session_id}] Usuário: {user_id}")
            logger.info(f"🤖 [SESSION: {session_id}] Modelo: {config.model_provider}/{config.model_id}")

            # Obter API key
            api_key = self.get_api_key_for_provider(config.model_provider)
            if not api_key:
                raise ValueError(f"API key não encontrada para {config.model_provider}")

            # Criar modelo
            model = self.get_model(config.model_provider, config.model_id, api_key)

            # Criar ferramentas
            tools = self.get_tools(config.tools)

            # Criar agente REAL do Agno
            agent = Agent(
                name=config.name,
                role=config.role,
                model=model,
                tools=tools,
                instructions=config.instructions,
                markdown=True,
                debug_mode=True
            )

            # Gerar ID único
            agent_id = str(uuid.uuid4())

            # Armazenar agente
            self.agents[agent_id] = agent

            logger.info(f"✅ [SESSION: {session_id}] Agente REAL criado com ID: {agent_id}")

            return agent_id

        except Exception as e:
            logger.error(f"❌ [SESSION: {session_id}] Erro ao criar agente: {str(e)}")
            logger.error(f"📍 [SESSION: {session_id}] Traceback: {traceback.format_exc()}")
            raise

    async def create_workflow(self, user_id: int, config: WorkflowConfig) -> str:
        """Cria um workflow multi-agente usando Agno REAL"""
        session_id = f"create_workflow_{user_id}_{int(datetime.now().timestamp())}"

        try:
            logger.info(f"🔄 [SESSION: {session_id}] Criando workflow REAL: {config.name}")

            # Criar agentes individuais
            agents = []
            for agent_config in config.agents:
                agent_id = await self.create_single_agent(user_id, agent_config)
                agents.append(self.agents[agent_id])

            # Criar Team do Agno
            team = Team(
                name=config.name,
                members=agents,
                instructions=[config.description],
                show_tool_calls=True,
                markdown=True
            )

            # Gerar ID único para o workflow
            workflow_id = str(uuid.uuid4())

            # Armazenar workflow
            self.workflows[workflow_id] = {
                "team": team,
                "config": config,
                "created_at": datetime.now(),
                "user_id": user_id
            }

            logger.info(f"✅ [SESSION: {session_id}] Workflow REAL criado com ID: {workflow_id}")

            return workflow_id

        except Exception as e:
            logger.error(f"❌ [SESSION: {session_id}] Erro ao criar workflow: {str(e)}")
            raise

    async def run_agent(self, agent_id: str, message: str, user_id: int) -> AsyncGenerator[str, None]:
        """Executa agente REAL com streaming usando Agno"""
        session_id = f"run_agent_{agent_id}_{int(datetime.now().timestamp())}"

        try:
            logger.info(f"🚀 [SESSION: {session_id}] === EXECUTANDO AGENTE REAL ===")
            logger.info(f"👤 [SESSION: {session_id}] Usuário: {user_id}")
            logger.info(f"🤖 [SESSION: {session_id}] Agente: {agent_id}")
            logger.info(f"📝 [SESSION: {session_id}] Mensagem: '{message[:100]}...'")

            # Encontrar agente
            if agent_id not in self.agents:
                error_msg = f"Agente {agent_id} não encontrado"
                logger.error(f"❌ [SESSION: {session_id}] {error_msg}")

                error_data = {
                    "type": "error",
                    "message": error_msg,
                    "session_id": session_id
                }
                yield f'data: {json.dumps(error_data)}\n\n'
                return

            agent = self.agents[agent_id]
            logger.info(f"🎯 [SESSION: {session_id}] Agente encontrado: {agent.name}")

            # Executar agente REAL
            logger.info(f"⏳ [SESSION: {session_id}] Iniciando execução do Agno...")

            # Usar o método run do Agno com streaming
            response_chunks = []

            try:
                # Executar agente - o Agno pode não ter streaming nativo,
                # então vamos simular streaming com a resposta completa
                response = agent.run(message)

                if response:
                    # Converter resposta em chunks para streaming
                    response_text = str(response)
                    words = response_text.split(' ')

                    logger.info(f"📤 [SESSION: {session_id}] Iniciando streaming de {len(words)} palavras")

                    current_chunk = ""
                    chunk_count = 0

                    for i, word in enumerate(words):
                        current_chunk += word + " "
                        chunk_count += 1

                        # Enviar chunk a cada 3-5 palavras
                        if chunk_count >= 3 or i == len(words) - 1:
                            chunk_data = {
                                "type": "text",
                                "content": current_chunk,
                                "session_id": session_id,
                                "agent_id": agent_id,
                                "timestamp": datetime.now().isoformat()
                            }

                            yield f'data: {json.dumps(chunk_data)}\n\n'

                            # Reset para próximo chunk
                            current_chunk = ""
                            chunk_count = 0

                            # Pequeno delay para simular streaming natural
                            await asyncio.sleep(0.05)

                    # Enviar sinal de finalização
                    final_data = {
                        "type": "done",
                        "session_id": session_id,
                        "agent_id": agent_id,
                        "timestamp": datetime.now().isoformat(),
                        "total_words": len(words)
                    }

                    yield f'data: {json.dumps(final_data)}\n\n'

                    logger.info(f"✅ [SESSION: {session_id}] Execução REAL concluída - {len(words)} palavras")

                else:
                    # Caso a resposta seja vazia
                    error_data = {
                        "type": "error",
                        "message": "Agente não gerou resposta",
                        "session_id": session_id
                    }
                    yield f'data: {json.dumps(error_data)}\n\n'

            except Exception as agno_error:
                # Erro específico do Agno
                error_msg = f"Erro na execução do Agno: {str(agno_error)}"
                logger.error(f"💥 [SESSION: {session_id}] {error_msg}")
                logger.error(f"📍 [SESSION: {session_id}] Agno Traceback: {traceback.format_exc()}")

                error_data = {
                    "type": "error",
                    "message": error_msg,
                    "session_id": session_id,
                    "error_type": "agno_execution_error"
                }
                yield f'data: {json.dumps(error_data)}\n\n'

        except Exception as e:
            error_msg = f"Erro geral na execução: {str(e)}"
            logger.error(f"💥 [SESSION: {session_id}] {error_msg}")
            logger.error(f"📍 [SESSION: {session_id}] Traceback completo: {traceback.format_exc()}")

            error_data = {
                "type": "error",
                "message": error_msg,
                "session_id": session_id,
                "error_type": "general_error"
            }
            yield f'data: {json.dumps(error_data)}\n\n'

    async def run_workflow(self, workflow_id: str, message: str, user_id: int) -> AsyncGenerator[str, None]:
        """Executa workflow REAL com streaming"""
        session_id = f"run_workflow_{workflow_id}_{int(datetime.now().timestamp())}"

        try:
            logger.info(f"🔄 [SESSION: {session_id}] Executando workflow REAL")

            if workflow_id not in self.workflows:
                error_data = {
                    "type": "error",
                    "message": f"Workflow {workflow_id} não encontrado"
                }
                yield f'data: {json.dumps(error_data)}\n\n'
                return

            workflow = self.workflows[workflow_id]
            team = workflow["team"]

            # Executar team
            response = team.run(message)

            if response:
                # Simular streaming da resposta do team
                response_text = str(response)
                words = response_text.split(' ')

                for i, word in enumerate(words):
                    chunk_data = {
                        "type": "text",
                        "content": word + " ",
                        "session_id": session_id,
                        "workflow_id": workflow_id
                    }

                    yield f'data: {json.dumps(chunk_data)}\n\n'
                    await asyncio.sleep(0.03)

                # Finalizar
                final_data = {
                    "type": "done",
                    "session_id": session_id
                }
                yield f'data: {json.dumps(final_data)}\n\n'

        except Exception as e:
            error_data = {
                "type": "error",
                "message": str(e),
                "session_id": session_id
            }
            yield f'data: {json.dumps(error_data)}\n\n'

    async def list_agents(self, user_id: int) -> List[Dict[str, Any]]:
        """Lista todos os agentes do usuário"""
        try:
            logger.info(f"📋 Listando agentes para usuário {user_id}")

            agents_list = []

            for agent_id, agent in self.agents.items():
                agent_data = {
                    "id": agent_id,
                    "name": agent.name,
                    "role": agent.role,
                    "model_provider": "openai",  # Inferir do modelo
                    "model_id": "gpt-4o-mini",  # Inferir do modelo
                    "tools": [tool.__class__.__name__ for tool in agent.tools] if agent.tools else [],
                    "is_active": True,
                    "created_at": datetime.now().isoformat(),
                    "type": "real_agno_agent"
                }
                agents_list.append(agent_data)

            logger.info(f"✅ {len(agents_list)} agentes REAIS encontrados")
            return agents_list

        except Exception as e:
            logger.error(f"❌ Erro ao listar agentes: {str(e)}")
            return []

    def get_api_key_for_provider(self, provider: ModelProvider) -> Optional[str]:
        """Obtém API key para o provider especificado"""
        try:
            if provider == ModelProvider.OPENAI:
                api_key = os.getenv("OPENAI_API_KEY")
                if not api_key:
                    # Tentar obter do Supabase se disponível
                    if supabase:
                        try:
                            result = safe_supabase_query(
                                supabase.table("api_keys")
                                .select("key_value")
                                .eq("provider", "openai")
                                .limit(1)
                            )
                            if result and len(result) > 0:
                                api_key = result[0]["key_value"]
                        except Exception as e:
                            logger.warning(f"⚠️ Erro ao obter API key do Supabase: {str(e)}")

                return api_key

            elif provider == ModelProvider.ANTHROPIC:
                api_key = os.getenv("ANTHROPIC_API_KEY")
                if not api_key:
                    # Tentar obter do Supabase se disponível
                    if supabase:
                        try:
                            result = safe_supabase_query(
                                supabase.table("api_keys")
                                .select("key_value")
                                .eq("provider", "anthropic")
                                .limit(1)
                            )
                            if result and len(result) > 0:
                                api_key = result[0]["key_value"]
                        except Exception as e:
                            logger.warning(f"⚠️ Erro ao obter API key do Supabase: {str(e)}")

                return api_key

            return None

        except Exception as e:
            logger.error(f"❌ Erro ao obter API key para {provider}: {str(e)}")
            return None


# Instância global do serviço REAL
agno_service = AgnoService()

logger.info("🚀 AgnoService REAL exportado e pronto para uso!")