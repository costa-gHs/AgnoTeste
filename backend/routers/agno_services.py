# backend/services/real_agno_service.py

import os
import time
import json
import importlib
import traceback
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime
from loguru import logger

# Agno imports - REAIS, não mock
try:
    from agno.agent import Agent
    from agno.models.openai import OpenAIChat
    from agno.models.anthropic import Claude  # ✅ CORREÇÃO: Era AnthropicChat, agora é Claude
    from agno.models.groq import Groq
    from agno.team import Team

    # Ferramentas reais do Agno
    from agno.tools.duckduckgo import DuckDuckGoTools
    from agno.tools.yfinance import YFinanceTools
    from agno.tools.calculator import CalculatorTools
    from agno.tools.reasoning import ReasoningTools

    # Ferramentas opcionais (se disponíveis)
    try:
        from agno.tools.dalle import DalleTools

        DALLE_AVAILABLE = True
    except ImportError:
        DALLE_AVAILABLE = False

    try:
        from agno.tools.youtube import YouTubeTools

        YOUTUBE_AVAILABLE = True
    except ImportError:
        YOUTUBE_AVAILABLE = False

    try:
        from agno.tools.googlesearch import GoogleSearchTools

        GOOGLE_SEARCH_AVAILABLE = True
    except ImportError:
        GOOGLE_SEARCH_AVAILABLE = False

    AGNO_AVAILABLE = True
    logger.info("✅ Agno framework carregado com sucesso")

except ImportError as e:
    logger.error(f"❌ Erro ao importar Agno: {e}")
    AGNO_AVAILABLE = False


class RealAgnoService:
    """Serviço REAL do Agno - integra com framework verdadeiro"""

    def __init__(self):
        if not AGNO_AVAILABLE:
            raise ImportError("Agno framework não está disponível")

        # ✅ CORREÇÃO: Mapear corretamente os modelos disponíveis
        self.available_models = {
            "openai": {
                "gpt-4o": OpenAIChat,
                "gpt-4o-mini": OpenAIChat,
                "gpt-3.5-turbo": OpenAIChat,
                "gpt-4": OpenAIChat,
                "o1": OpenAIChat,
                "o1-mini": OpenAIChat,
                "o1-preview": OpenAIChat,
                "o3-mini": OpenAIChat
            },
            "anthropic": {
                "claude-3-5-sonnet-20241022": Claude,
                "claude-3-sonnet-20240229": Claude,
                "claude-3-haiku-20240307": Claude,
                "claude-sonnet-4-20250514": Claude,  # ✅ Modelo mais recente
                "claude-3-7-sonnet-latest": Claude
            },
            "groq": {
                "llama-3.3-70b-versatile": Groq,
                "llama-3.2-3b-preview": Groq,
                "llama-3.2-11b-vision-preview": Groq,
                "mixtral-8x7b-32768": Groq
            }
        }

        # Mapear ferramentas disponíveis
        self.available_tools = self._initialize_available_tools()

        logger.info(f"🔧 {len(self.available_tools)} ferramentas Agno disponíveis")

    def _initialize_available_tools(self) -> Dict[str, Any]:
        """Inicializa mapeamento de ferramentas disponíveis"""
        tools_map = {
            "duckduckgo": {
                "class": DuckDuckGoTools,
                "name": "DuckDuckGo Search",
                "description": "Pesquisa na web com foco em privacidade",
                "category": "web_search",
                "available": True
            },
            "yfinance": {
                "class": YFinanceTools,
                "name": "Yahoo Finance",
                "description": "Dados financeiros, preços de ações, notícias",
                "category": "financial",
                "available": True
            },
            "calculator": {
                "class": CalculatorTools,
                "name": "Calculator",
                "description": "Operações matemáticas e cálculos",
                "category": "utilities",
                "available": True
            },
            "reasoning": {
                "class": ReasoningTools,
                "name": "Reasoning Tools",
                "description": "Raciocínio estruturado e chain-of-thought",
                "category": "reasoning",
                "available": True
            }
        }

        # Adicionar ferramentas opcionais se disponíveis
        if DALLE_AVAILABLE:
            tools_map["dalle"] = {
                "class": DalleTools,
                "name": "DALL-E Image Generation",
                "description": "Geração de imagens com IA",
                "category": "ai_media",
                "available": True
            }

        if YOUTUBE_AVAILABLE:
            tools_map["youtube"] = {
                "class": YouTubeTools,
                "name": "YouTube Tools",
                "description": "Extração de transcrições de vídeos",
                "category": "ai_media",
                "available": True
            }

        if GOOGLE_SEARCH_AVAILABLE and os.getenv("GOOGLE_API_KEY"):
            tools_map["google_search"] = {
                "class": GoogleSearchTools,
                "name": "Google Search",
                "description": "Pesquisa programável do Google",
                "category": "web_search",
                "available": True
            }

        return tools_map

    def get_model_instance(self, provider: str, model_id: str, **kwargs):
        """Cria instância REAL do modelo"""
        if provider not in self.available_models:
            raise ValueError(f"Provider '{provider}' não suportado")

        if model_id not in self.available_models[provider]:
            raise ValueError(f"Modelo '{model_id}' não disponível para '{provider}'")

        model_class = self.available_models[provider][model_id]

        # Configurações específicas por provider
        model_kwargs = kwargs.copy()

        if provider == "openai":
            if not os.getenv("OPENAI_API_KEY"):
                raise ValueError("OPENAI_API_KEY não configurada")
        elif provider == "anthropic":
            if not os.getenv("ANTHROPIC_API_KEY"):
                raise ValueError("ANTHROPIC_API_KEY não configurada")
        elif provider == "groq":
            if not os.getenv("GROQ_API_KEY"):
                raise ValueError("GROQ_API_KEY não configurada")

        # ✅ CORREÇÃO: Usar parâmetro 'id' em vez de 'model' para todos os provedores
        return model_class(id=model_id, **model_kwargs)

    def create_tool_instance(self, tool_name: str, config: Dict[str, Any] = None) -> Any:
        """Cria instância REAL de uma ferramenta"""
        if tool_name not in self.available_tools:
            raise ValueError(f"Ferramenta '{tool_name}' não disponível")

        tool_info = self.available_tools[tool_name]
        if not tool_info["available"]:
            raise ValueError(f"Ferramenta '{tool_name}' não está disponível")

        tool_class = tool_info["class"]
        tool_config = config or {}

        # Configurações específicas por ferramenta
        if tool_name == "yfinance":
            default_config = {
                "stock_price": True,
                "analyst_recommendations": True,
                "stock_fundamentals": True,
                "company_info": True,
                "company_news": True
            }
            tool_config = {**default_config, **tool_config}

        elif tool_name == "dalle":
            if not os.getenv("OPENAI_API_KEY"):
                raise ValueError("OPENAI_API_KEY necessária para DALL-E")

        elif tool_name == "google_search":
            if not os.getenv("GOOGLE_API_KEY") or not os.getenv("GOOGLE_CSE_ID"):
                raise ValueError("GOOGLE_API_KEY e GOOGLE_CSE_ID necessárias")
            tool_config = {
                "api_key": os.getenv("GOOGLE_API_KEY"),
                "cse_id": os.getenv("GOOGLE_CSE_ID"),
                **tool_config
            }

        try:
            return tool_class(**tool_config)
        except Exception as e:
            logger.error(f"Erro ao criar ferramenta {tool_name}: {e}")
            raise

    def create_agent_from_db_config(
            self,
            agent_config: Dict[str, Any],
            tools_list: List[str] = None
    ) -> Agent:
        """Cria um agente Agno REAL baseado na configuração do banco"""

        # Extrair configurações
        model_provider = agent_config.get("model_provider", "openai")
        model_id = agent_config.get("model_id", "gpt-4o")
        instructions = agent_config.get("instructions", [])
        description = agent_config.get("description", "Assistente IA")
        name = agent_config.get("name", "Agente")

        # Criar modelo
        model = self.get_model_instance(model_provider, model_id)

        # Criar ferramentas
        tool_instances = []
        if tools_list:
            for tool_name in tools_list:
                try:
                    tool_instance = self.create_tool_instance(tool_name)
                    tool_instances.append(tool_instance)
                    logger.info(f"✅ Ferramenta {tool_name} adicionada ao agente")
                except Exception as e:
                    logger.warning(f"⚠️ Erro ao carregar ferramenta {tool_name}: {e}")

        # ✅ CORREÇÃO: Configurar agente com parâmetros corretos do Agno
        agent_params = {
            "model": model,
            "tools": tool_instances,
            "instructions": instructions if isinstance(instructions, list) else [str(instructions)],
            "description": description,
            "name": name,
            "show_tool_calls": True,
            "markdown": True
        }

        try:
            agent = Agent(**agent_params)
            logger.info(f"🤖 Agente '{name}' criado com {len(tool_instances)} ferramentas")
            return agent
        except Exception as e:
            logger.error(f"❌ Erro ao criar agente: {e}")
            raise

    def execute_agent_task(
            self,
            agent_config: Dict[str, Any],
            prompt: str,
            tools_list: List[str] = None,
            stream: bool = False
    ) -> Dict[str, Any]:
        """Executa uma tarefa REAL usando agente Agno"""
        start_time = time.time()

        try:
            # Criar agente real
            agent = self.create_agent_from_db_config(agent_config, tools_list)

            if stream:
                # Para streaming, retornar o agente para uso externo
                return {
                    "status": "ready_for_stream",
                    "agent": agent,
                    "prompt": prompt,
                    "tools_count": len(tools_list) if tools_list else 0
                }
            else:
                # Executar tarefa
                logger.info(f"🚀 Executando prompt: {prompt[:100]}...")

                # ✅ CORREÇÃO: Usar método run() do Agno corretamente
                response = agent.run(prompt)
                execution_time = int((time.time() - start_time) * 1000)

                # Extrair conteúdo da resposta
                if hasattr(response, 'content'):
                    content = response.content
                elif hasattr(response, 'messages') and response.messages:
                    content = response.messages[-1].content
                else:
                    content = str(response)

                logger.info(f"✅ Execução concluída em {execution_time}ms")

                return {
                    "status": "success",
                    "response": content,
                    "execution_time_ms": execution_time,
                    "tools_used": len(tools_list) if tools_list else 0,
                    "model_used": f"{agent_config.get('model_provider')}/{agent_config.get('model_id')}"
                }

        except Exception as e:
            error_msg = str(e)
            execution_time = int((time.time() - start_time) * 1000)

            logger.error(f"❌ Erro na execução: {error_msg}")
            logger.error(f"📍 Traceback: {traceback.format_exc()}")

            return {
                "status": "error",
                "error": error_msg,
                "execution_time_ms": execution_time,
                "tools_attempted": len(tools_list) if tools_list else 0
            }

    def create_streaming_generator(self, agent: Agent, prompt: str):
        """Gerador para streaming de resposta REAL"""
        try:
            logger.info(f"🔄 Iniciando streaming para prompt: {prompt[:50]}...")

            # ✅ CORREÇÃO: Usar método de streaming correto do Agno
            if hasattr(agent, 'stream'):
                # Método preferido para streaming
                for chunk in agent.stream(prompt):
                    yield {
                        "type": "chunk",
                        "content": str(chunk),
                        "timestamp": datetime.utcnow().isoformat()
                    }
            elif hasattr(agent, 'print_response'):
                # Alternativa usando print_response com stream=True
                response = agent.run(prompt, stream=True)
                content = response.content if hasattr(response, 'content') else str(response)

                # Simular chunks
                words = content.split()
                for i, word in enumerate(words):
                    yield {
                        "type": "chunk",
                        "content": word + " ",
                        "progress": f"{i + 1}/{len(words)}"
                    }
                    time.sleep(0.05)  # Simular delay
            else:
                # Fallback: executar normal e simular streaming
                response = agent.run(prompt)
                content = response.content if hasattr(response, 'content') else str(response)

                # Simular chunks
                words = content.split()
                for i, word in enumerate(words):
                    yield {
                        "type": "chunk",
                        "content": word + " ",
                        "progress": f"{i + 1}/{len(words)}"
                    }
                    time.sleep(0.05)  # Simular delay

            yield {
                "type": "done",
                "message": "Execução concluída com sucesso"
            }

        except Exception as e:
            logger.error(f"❌ Erro no streaming: {e}")
            yield {
                "type": "error",
                "error": str(e)
            }

    def get_available_tools_info(self) -> List[Dict[str, Any]]:
        """Retorna informações das ferramentas disponíveis"""
        tools_info = []

        for tool_name, tool_data in self.available_tools.items():
            # Verificar dependências específicas
            dependencies_ok = True
            missing_deps = []

            if tool_name == "dalle" and not os.getenv("OPENAI_API_KEY"):
                dependencies_ok = False
                missing_deps.append("OPENAI_API_KEY")

            elif tool_name == "google_search":
                if not os.getenv("GOOGLE_API_KEY"):
                    dependencies_ok = False
                    missing_deps.append("GOOGLE_API_KEY")
                if not os.getenv("GOOGLE_CSE_ID"):
                    dependencies_ok = False
                    missing_deps.append("GOOGLE_CSE_ID")

            tools_info.append({
                "name": tool_name,
                "display_name": tool_data["name"],
                "description": tool_data["description"],
                "category": tool_data["category"],
                "available": tool_data["available"] and dependencies_ok,
                "missing_dependencies": missing_deps,
                "class_path": f"{tool_data['class'].__module__}.{tool_data['class'].__name__}"
            })

        return tools_info

    def test_tool(self, tool_name: str, test_params: Dict[str, Any] = None) -> Dict[str, Any]:
        """Testa uma ferramenta específica"""
        try:
            tool_instance = self.create_tool_instance(tool_name)

            # Parâmetros de teste por ferramenta
            if tool_name == "duckduckgo":
                result = tool_instance.search("python programming")
            elif tool_name == "yfinance":
                result = tool_instance.get_current_stock_price("AAPL")
            elif tool_name == "calculator":
                result = tool_instance.add(2, 3)
            elif tool_name == "reasoning":
                result = tool_instance.think("What is 2+2?")
            else:
                result = "Teste não implementado para esta ferramenta"

            return {
                "status": "success",
                "tool": tool_name,
                "result": str(result)[:500],  # Limitar resultado
                "result_type": type(result).__name__
            }

        except Exception as e:
            return {
                "status": "error",
                "tool": tool_name,
                "error": str(e)
            }

    def get_system_health(self) -> Dict[str, Any]:
        """Verifica saúde do sistema Agno"""
        health = {
            "agno_framework": AGNO_AVAILABLE,
            "total_tools": len(self.available_tools),
            "available_tools": len([t for t in self.available_tools.values() if t["available"]]),
            "model_providers": list(self.available_models.keys()),
            "api_keys_status": {},
            "tools_status": {}
        }

        # Verificar API keys
        api_keys = {
            "OPENAI_API_KEY": "OpenAI",
            "ANTHROPIC_API_KEY": "Anthropic",
            "GROQ_API_KEY": "Groq",
            "GOOGLE_API_KEY": "Google Search"
        }

        for key, service in api_keys.items():
            health["api_keys_status"][service] = bool(os.getenv(key))

        # Status das ferramentas
        for tool_name, tool_data in self.available_tools.items():
            health["tools_status"][tool_name] = {
                "available": tool_data["available"],
                "category": tool_data["category"]
            }

        # Status geral
        configured_keys = sum(health["api_keys_status"].values())
        if configured_keys >= 1 and health["available_tools"] >= 2:
            health["overall_status"] = "healthy"
        elif configured_keys >= 1:
            health["overall_status"] = "partial"
        else:
            health["overall_status"] = "degraded"

        return health


# Instância global do serviço
agno_service = None


def get_real_agno_service() -> RealAgnoService:
    """Factory para obter instância do serviço Agno real"""
    global agno_service

    if agno_service is None:
        if not AGNO_AVAILABLE:
            raise RuntimeError("Agno framework não está disponível")
        agno_service = RealAgnoService()

    return agno_service