# tools_config.py - Configuração centralizada das ferramentas Agno

import os
from typing import Dict, List, Any, Optional
from dataclasses import dataclass

# Agno tool imports
from agno.tools.duckduckgo import DuckDuckGoTools
from agno.tools.yfinance import YFinanceTools
from agno.tools.reasoning import ReasoningTools

# Para ferramentas customizadas (exemplos)
from agno.tools.file import FileTools
from agno.tools.python_code import PythonCodeTools


@dataclass
class ToolConfig:
    """Configuração de uma ferramenta"""
    id: str
    name: str
    description: str
    category: str
    enabled: bool = True
    config: Dict[str, Any] = None
    requires_api_key: bool = False
    api_key_env: Optional[str] = None


class AgnoToolsManager:
    """Gerenciador centralizado das ferramentas do Agno"""

    def __init__(self):
        self.available_tools = {
            # Ferramentas de busca
            "duckduckgo": ToolConfig(
                id="duckduckgo",
                name="DuckDuckGo Search",
                description="Pesquisa na web usando DuckDuckGo - ideal para informações atuais",
                category="search",
                enabled=True,
                config={
                    "max_results": 10,
                    "region": "pt-br",
                    "safesearch": "moderate"
                }
            ),

            # Ferramentas financeiras
            "yfinance": ToolConfig(
                id="yfinance",
                name="Yahoo Finance",
                description="Dados financeiros em tempo real - ações, análises, informações de empresas",
                category="finance",
                enabled=True,
                config={
                    "stock_price": True,
                    "analyst_recommendations": True,
                    "company_info": True,
                    "historical_prices": True,
                    "news": True,
                    "fundamentals": True
                }
            ),

            # Ferramentas de raciocínio
            "reasoning": ToolConfig(
                id="reasoning",
                name="Reasoning Tools",
                description="Capacidades avançadas de raciocínio e resolução de problemas",
                category="reasoning",
                enabled=True,
                config={
                    "add_instructions": True,
                    "enable_step_by_step": True,
                    "enable_verification": True
                }
            ),

            # Ferramentas de código
            "python_code": ToolConfig(
                id="python_code",
                name="Python Code Executor",
                description="Executa código Python de forma segura para cálculos e análises",
                category="code",
                enabled=False,  # Desativado por padrão por segurança
                config={
                    "timeout": 30,
                    "allowed_imports": ["math", "datetime", "json", "re"],
                    "max_output_length": 1000
                }
            ),

            # Ferramentas de arquivos
            "file_tools": ToolConfig(
                id="file_tools",
                name="File Manager",
                description="Manipulação de arquivos - leitura, escrita e processamento",
                category="files",
                enabled=False,  # Desativado por padrão por segurança
                config={
                    "allowed_extensions": [".txt", ".json", ".csv", ".md"],
                    "max_file_size": "10MB",
                    "base_directory": "./uploads"
                }
            ),

            # Ferramentas personalizadas (exemplos para expansão)
            "weather": ToolConfig(
                id="weather",
                name="Weather API",
                description="Informações meteorológicas atuais e previsões",
                category="weather",
                enabled=False,
                requires_api_key=True,
                api_key_env="WEATHER_API_KEY",
                config={
                    "default_units": "metric",
                    "include_forecast": True,
                    "forecast_days": 5
                }
            ),

            "news": ToolConfig(
                id="news",
                name="News API",
                description="Notícias atuais de diversas fontes",
                category="news",
                enabled=False,
                requires_api_key=True,
                api_key_env="NEWS_API_KEY",
                config={
                    "sources": ["bbc", "cnn", "reuters"],
                    "language": "pt",
                    "max_articles": 10
                }
            ),

            "translator": ToolConfig(
                id="translator",
                name="Google Translate",
                description="Tradução entre idiomas usando Google Translate",
                category="language",
                enabled=False,
                requires_api_key=True,
                api_key_env="GOOGLE_TRANSLATE_API_KEY",
                config={
                    "default_source": "auto",
                    "default_target": "pt",
                    "max_text_length": 5000
                }
            ),

            "calculator": ToolConfig(
                id="calculator",
                name="Advanced Calculator",
                description="Calculadora avançada com funções matemáticas complexas",
                category="math",
                enabled=True,
                config={
                    "precision": 10,
                    "angle_mode": "radians",
                    "enable_constants": True
                }
            )
        }

    def get_available_tools(self, category: Optional[str] = None) -> List[ToolConfig]:
        """Retorna lista de ferramentas disponíveis"""
        tools = list(self.available_tools.values())

        if category:
            tools = [t for t in tools if t.category == category]

        return [t for t in tools if t.enabled]

    def get_tool_by_id(self, tool_id: str) -> Optional[ToolConfig]:
        """Retorna configuração de uma ferramenta específica"""
        return self.available_tools.get(tool_id)

    def is_tool_available(self, tool_id: str) -> bool:
        """Verifica se uma ferramenta está disponível"""
        tool = self.get_tool_by_id(tool_id)
        if not tool or not tool.enabled:
            return False

        # Verifica se precisa de API key
        if tool.requires_api_key and tool.api_key_env:
            return bool(os.getenv(tool.api_key_env))

        return True

    def create_tool_instance(self, tool_id: str):
        """Cria instância da ferramenta"""
        tool_config = self.get_tool_by_id(tool_id)
        if not tool_config or not self.is_tool_available(tool_id):
            raise ValueError(f"Ferramenta {tool_id} não está disponível")

        # Mapeamento das ferramentas para suas classes
        tool_classes = {
            "duckduckgo": self._create_duckduckgo,
            "yfinance": self._create_yfinance,
            "reasoning": self._create_reasoning,
            "python_code": self._create_python_code,
            "file_tools": self._create_file_tools,
            "calculator": self._create_calculator,
            # Adicione outras ferramentas personalizadas aqui
        }

        creator = tool_classes.get(tool_id)
        if not creator:
            raise ValueError(f"Implementação não encontrada para {tool_id}")

        return creator(tool_config)

    def _create_duckduckgo(self, config: ToolConfig):
        """Cria instância do DuckDuckGo"""
        return DuckDuckGoTools(
            max_results=config.config.get("max_results", 10),
            region=config.config.get("region", "pt-br"),
            safesearch=config.config.get("safesearch", "moderate")
        )

    def _create_yfinance(self, config: ToolConfig):
        """Cria instância do YFinance"""
        return YFinanceTools(
            stock_price=config.config.get("stock_price", True),
            analyst_recommendations=config.config.get("analyst_recommendations", True),
            company_info=config.config.get("company_info", True),
            historical_prices=config.config.get("historical_prices", True),
            news=config.config.get("news", True),
            fundamentals=config.config.get("fundamentals", True)
        )

    def _create_reasoning(self, config: ToolConfig):
        """Cria instância do Reasoning Tools"""
        return ReasoningTools(
            add_instructions=config.config.get("add_instructions", True)
        )

    def _create_python_code(self, config: ToolConfig):
        """Cria instância do Python Code Executor"""
        try:
            return PythonCodeTools(
                timeout=config.config.get("timeout", 30),
                allowed_imports=config.config.get("allowed_imports", []),
                max_output_length=config.config.get("max_output_length", 1000)
            )
        except ImportError:
            raise ValueError("PythonCodeTools não está disponível")

    def _create_file_tools(self, config: ToolConfig):
        """Cria instância do File Tools"""
        try:
            return FileTools(
                allowed_extensions=config.config.get("allowed_extensions", []),
                max_file_size=config.config.get("max_file_size", "10MB"),
                base_directory=config.config.get("base_directory", "./uploads")
            )
        except ImportError:
            raise ValueError("FileTools não está disponível")

    def _create_calculator(self, config: ToolConfig):
        """Cria calculadora personalizada"""
        from agno.tools.python_code import PythonCodeTools

        # Usar PythonCodeTools como base para calculadora
        calculator_code = """
import math
import cmath

class Calculator:
    def __init__(self, precision=10, angle_mode='radians'):
        self.precision = precision
        self.angle_mode = angle_mode

    def calculate(self, expression):
        # Implementar calculadora segura aqui
        try:
            result = eval(expression, {"__builtins__": {}, "math": math, "cmath": cmath})
            return round(result, self.precision) if isinstance(result, float) else result
        except Exception as e:
            return f"Erro: {str(e)}"

calc = Calculator()
"""

        try:
            return PythonCodeTools(
                timeout=10,
                allowed_imports=["math", "cmath"],
                setup_code=calculator_code
            )
        except ImportError:
            # Fallback para calculadora simples
            class SimpleCalculator:
                def calculate(self, expression):
                    try:
                        import math
                        result = eval(expression, {"__builtins__": {}, "math": math})
                        return result
                    except Exception as e:
                        return f"Erro: {str(e)}"

            return SimpleCalculator()

    def get_categories(self) -> List[str]:
        """Retorna lista de categorias disponíveis"""
        return list(set(tool.category for tool in self.available_tools.values()))

    def get_tools_by_category(self, category: str) -> List[ToolConfig]:
        """Retorna ferramentas de uma categoria específica"""
        return [tool for tool in self.available_tools.values()
                if tool.category == category and tool.enabled]

    def enable_tool(self, tool_id: str):
        """Habilita uma ferramenta"""
        if tool_id in self.available_tools:
            self.available_tools[tool_id].enabled = True

    def disable_tool(self, tool_id: str):
        """Desabilita uma ferramenta"""
        if tool_id in self.available_tools:
            self.available_tools[tool_id].enabled = False

    def add_custom_tool(self, tool_config: ToolConfig, creator_function):
        """Adiciona uma ferramenta personalizada"""
        self.available_tools[tool_config.id] = tool_config
        # Registrar função criadora
        setattr(self, f"_create_{tool_config.id}", creator_function)


# Instância global do gerenciador
tools_manager = AgnoToolsManager()


def get_tools_for_agent(tool_ids: List[str]) -> List[Any]:
    """
    Função helper para criar instâncias das ferramentas para um agente
    """
    tools = []
    for tool_id in tool_ids:
        try:
            tool = tools_manager.create_tool_instance(tool_id)
            tools.append(tool)
            print(f"✅ Ferramenta {tool_id} carregada com sucesso")
        except Exception as e:
            print(f"❌ Erro ao carregar ferramenta {tool_id}: {e}")

    return tools


def get_available_tools_info() -> Dict[str, Any]:
    """
    Retorna informações sobre todas as ferramentas disponíveis
    para exibir na UI
    """
    tools_info = {}

    for category in tools_manager.get_categories():
        tools_info[category] = []

        for tool in tools_manager.get_tools_by_category(category):
            tools_info[category].append({
                "id": tool.id,
                "name": tool.name,
                "description": tool.description,
                "enabled": tool.enabled,
                "available": tools_manager.is_tool_available(tool.id),
                "requires_api_key": tool.requires_api_key,
                "config": tool.config
            })

    return tools_info


# Exemplos de uso:
if __name__ == "__main__":
    # Listar ferramentas disponíveis
    print("🔧 Ferramentas disponíveis:")
    for tool in tools_manager.get_available_tools():
        status = "✅" if tools_manager.is_tool_available(tool.id) else "❌"
        print(f"{status} {tool.name} ({tool.id}) - {tool.description}")

    # Testar criação de ferramentas
    print("\n🧪 Testando criação de ferramentas:")
    test_tools = ["duckduckgo", "yfinance", "reasoning"]

    for tool_id in test_tools:
        try:
            tool = tools_manager.create_tool_instance(tool_id)
            print(f"✅ {tool_id}: {type(tool).__name__}")
        except Exception as e:
            print(f"❌ {tool_id}: {e}")

    # Informações para UI
    print("\n📊 Informações para UI:")
    import json

    print(json.dumps(get_available_tools_info(), indent=2, ensure_ascii=False))