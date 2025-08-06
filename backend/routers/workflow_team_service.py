# backend/services/workflow_team_service.py

import json
import uuid
import asyncio
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime
from dataclasses import dataclass, asdict
from fastapi import HTTPException
from loguru import logger

# Agno Framework imports
from agno.agent import Agent
from agno.team import Team
from agno.models.openai import OpenAIChat
from agno.models.anthropic import Claude
from agno.tools.duckduckgo import DuckDuckGoTools
from agno.tools.yfinance import YFinanceTools
from agno.tools.calculator import CalculatorTools
from agno.tools.reasoning import ReasoningTools

# Supabase client
from backend.supabase_client import supabase


@dataclass
class NodeConfig:
    """Configuração de um nó no workflow visual"""
    id: str
    type: str  # 'start', 'agent', 'condition', 'parallel', 'end', etc.
    name: str
    position: Dict[str, float]  # x, y coordinates
    config: Dict[str, Any]  # configurações específicas do nó
    status: str = 'idle'


@dataclass
class WorkflowConnection:
    """Conexão entre nós no workflow"""
    from_node: str
    to_node: str
    condition: Optional[str] = None  # condição para execução


@dataclass
class VisualWorkflowDefinition:
    """Definição completa de um workflow visual"""
    nodes: List[NodeConfig]
    connections: List[WorkflowConnection]
    metadata: Dict[str, Any]


@dataclass
class TeamDefinition:
    """Definição de um team com agentes"""
    name: str
    description: str
    team_type: str  # 'collaborative', 'hierarchical', 'sequential'
    agents: List[Dict[str, Any]]  # lista de agentes com configs
    supervisor_config: Optional[Dict[str, Any]] = None


class WorkflowTeamService:
    """Serviço principal para Workflow Builder e Team Builder"""

    def __init__(self):
        self.active_workflows: Dict[str, Any] = {}
        self.active_teams: Dict[str, Team] = {}
        self.agents_cache: Dict[str, Agent] = {}
        logger.info("🚀 WorkflowTeamService inicializado")

    # ==================== TEAM BUILDER ====================

    async def create_team(self, user_id: int, team_def: TeamDefinition) -> str:
        """Cria um novo team com agentes"""
        try:
            # 1. Criar agentes do team
            team_agents = []
            agent_configs = []

            for agent_config in team_def.agents:
                # Criar ou recuperar agente
                agent = await self._create_or_get_agent(user_id, agent_config)
                team_agents.append(agent)
                agent_configs.append(agent_config)

            # 2. Criar supervisor se especificado
            supervisor_agent = None
            if team_def.supervisor_config:
                supervisor_agent = await self._create_or_get_agent(
                    user_id, team_def.supervisor_config
                )
                team_agents.append(supervisor_agent)

            # 3. Criar Team usando Agno framework
            agno_team = Team(
                name=team_def.name,
                members=team_agents,
                instructions=[team_def.description],
                show_tool_calls=True,
                markdown=True
            )

            # 4. Salvar no banco
            team_data = {
                'user_id': user_id,
                'name': team_def.name,
                'description': team_def.description,
                'team_type': team_def.team_type,
                'supervisor_agent_id': supervisor_agent.id if supervisor_agent else None,
                'team_configuration': {
                    'agents': agent_configs,
                    'supervisor': team_def.supervisor_config
                }
            }

            result = supabase.table('agno_teams').insert(team_data).execute()
            team_id = result.data[0]['id']

            # 5. Relacionar agentes ao team
            for i, agent_config in enumerate(agent_configs):
                agent_relation = {
                    'team_id': team_id,
                    'agent_id': agent_config.get('id'),
                    'role_in_team': agent_config.get('role_in_team', 'member'),
                    'priority': i + 1,
                    'agent_config': agent_config
                }
                supabase.table('agno_team_agents').insert(agent_relation).execute()

            # 6. Cache do team ativo
            self.active_teams[str(team_id)] = agno_team

            logger.info(f"✅ Team criado: {team_def.name} (ID: {team_id})")
            return str(team_id)

        except Exception as e:
            logger.error(f"❌ Erro ao criar team: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))

    async def get_teams(self, user_id: int) -> List[Dict]:
        """Lista todos os teams do usuário"""
        try:
            result = supabase.table('agno_teams') \
                .select('*, agno_team_agents(*, agno_agents(name, role, model_provider))') \
                .eq('user_id', user_id) \
                .eq('is_active', True) \
                .execute()

            return result.data
        except Exception as e:
            logger.error(f"❌ Erro ao buscar teams: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))

    async def execute_team(self, team_id: str, message: str) -> Dict:
        """Executa um team com uma mensagem"""
        try:
            if team_id in self.active_teams:
                team = self.active_teams[team_id]
            else:
                team = await self._load_team(team_id)
                self.active_teams[team_id] = team

            # Executar usando Agno Team
            response = team.run(message)

            return {
                'team_id': team_id,
                'response': response.content,
                'metadata': {
                    'execution_time': response.metrics.get('execution_time'),
                    'agents_used': [agent.name for agent in team.members]
                }
            }

        except Exception as e:
            logger.error(f"❌ Erro ao executar team: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))

    # ==================== WORKFLOW BUILDER ====================

    async def create_visual_workflow(
            self,
            user_id: int,
            name: str,
            description: str,
            visual_def: VisualWorkflowDefinition
    ) -> str:
        """Cria um workflow visual com nós e conexões"""
        try:
            # 1. Validar workflow
            self._validate_visual_workflow(visual_def)

            # 2. Salvar no banco
            workflow_data = {
                'user_id': user_id,
                'name': name,
                'description': description,
                'flow_type': 'visual',
                'workflow_definition': asdict(visual_def),
                'visual_definition': {
                    'nodes': [asdict(node) for node in visual_def.nodes],
                    'connections': [asdict(conn) for conn in visual_def.connections],
                    'metadata': visual_def.metadata
                }
            }

            result = supabase.table('agno_workflows').insert(workflow_data).execute()
            workflow_id = result.data[0]['id']

            logger.info(f"✅ Workflow visual criado: {name} (ID: {workflow_id})")
            return str(workflow_id)

        except Exception as e:
            logger.error(f"❌ Erro ao criar workflow visual: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))

    async def execute_visual_workflow(
            self,
            workflow_id: str,
            input_data: Dict[str, Any]
    ) -> str:
        """Executa um workflow visual"""
        try:
            # 1. Carregar workflow
            workflow = await self._load_workflow(workflow_id)
            visual_def = VisualWorkflowDefinition(**workflow['visual_definition'])

            # 2. Criar execução no banco
            execution_data = {
                'workflow_id': int(workflow_id),
                'user_id': workflow['user_id'],
                'input_data': input_data,
                'execution_status': 'running'
            }

            execution_result = supabase.table('agno_workflow_executions') \
                .insert(execution_data).execute()
            execution_id = execution_result.data[0]['id']

            # 3. Executar workflow assincronamente
            asyncio.create_task(
                self._execute_workflow_steps(execution_id, visual_def, input_data)
            )

            return execution_id

        except Exception as e:
            logger.error(f"❌ Erro ao executar workflow: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))

    async def _execute_workflow_steps(
            self,
            execution_id: str,
            visual_def: VisualWorkflowDefinition,
            input_data: Dict[str, Any]
    ):
        """Executa os steps do workflow visual de forma assíncrona"""
        try:
            # 1. Encontrar nó de início
            start_nodes = [n for n in visual_def.nodes if n.type == 'start']
            if not start_nodes:
                raise ValueError("Workflow deve ter um nó de início")

            # 2. Executar sequencialmente seguindo as conexões
            current_data = input_data
            current_node = start_nodes[0]
            visited_nodes = set()

            while current_node and current_node.id not in visited_nodes:
                visited_nodes.add(current_node.id)

                # Executar nó atual
                step_result = await self._execute_node(
                    execution_id, current_node, current_data
                )

                if step_result['status'] == 'failed':
                    await self._update_execution_status(execution_id, 'failed', step_result.get('error'))
                    return

                current_data = step_result.get('output_data', current_data)

                # Encontrar próximo nó
                next_connections = [
                    conn for conn in visual_def.connections
                    if conn.from_node == current_node.id
                ]

                if not next_connections:
                    break

                # Por simplicidade, pegar primeira conexão
                # TODO: Implementar lógica condicional
                next_node_id = next_connections[0].to_node
                current_node = next(
                    (n for n in visual_def.nodes if n.id == next_node_id),
                    None
                )

            # 3. Finalizar execução
            await self._update_execution_status(
                execution_id, 'completed', None, current_data
            )

        except Exception as e:
            logger.error(f"❌ Erro na execução do workflow: {str(e)}")
            await self._update_execution_status(execution_id, 'failed', str(e))

    async def _execute_node(
            self,
            execution_id: str,
            node: NodeConfig,
            input_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Executa um nó específico do workflow"""
        step_data = {
            'execution_id': execution_id,
            'node_id': node.id,
            'step_type': node.type,
            'input_data': input_data,
            'status': 'running',
            'started_at': datetime.utcnow().isoformat()
        }

        step_result = supabase.table('agno_execution_steps') \
            .insert(step_data).execute()
        step_id = step_result.data[0]['id']

        try:
            output_data = input_data

            if node.type == 'agent':
                # Executar agente
                agent_id = node.config.get('agentId')
                if agent_id:
                    agent = await self._get_cached_agent(agent_id)
                    message = input_data.get('message', 'Processe estes dados')
                    response = agent.run(message)
                    output_data = {
                        **input_data,
                        'agent_response': response.content,
                        'agent_id': agent_id
                    }

            elif node.type == 'condition':
                # Lógica condicional (simplificada)
                condition = node.config.get('condition', 'true')
                # TODO: Implementar avaliação segura de condições
                output_data = {
                    **input_data,
                    'condition_result': True  # Simplificado
                }

            elif node.type == 'transform':
                # Transformação de dados (simplificada)
                transformation = node.config.get('transformation')
                # TODO: Implementar transformações seguras
                output_data = {
                    **input_data,
                    'transformed': True
                }

            # Atualizar step como concluído
            supabase.table('agno_execution_steps') \
                .update({
                'status': 'completed',
                'output_data': output_data,
                'completed_at': datetime.utcnow().isoformat()
            }) \
                .eq('id', step_id) \
                .execute()

            return {
                'status': 'completed',
                'output_data': output_data
            }

        except Exception as e:
            # Atualizar step como falha
            supabase.table('agno_execution_steps') \
                .update({
                'status': 'failed',
                'error_message': str(e),
                'completed_at': datetime.utcnow().isoformat()
            }) \
                .eq('id', step_id) \
                .execute()

            return {
                'status': 'failed',
                'error': str(e)
            }

    # ==================== HELPERS ====================

    async def _create_or_get_agent(self, user_id: int, agent_config: Dict) -> Agent:
        """Cria ou recupera um agente baseado na configuração"""
        agent_id = agent_config.get('id')

        if agent_id and agent_id in self.agents_cache:
            return self.agents_cache[agent_id]

        # Buscar agente no banco
        if agent_id:
            result = supabase.table('agno_agents') \
                .select('*').eq('id', agent_id).execute()

            if result.data:
                agent_data = result.data[0]
                agent = await self._build_agno_agent(agent_data)
                self.agents_cache[agent_id] = agent
                return agent

        # Criar novo agente se não existir
        agent = await self._build_agno_agent(agent_config)
        return agent

    async def _build_agno_agent(self, config: Dict) -> Agent:
        """Constrói um agente Agno baseado na configuração"""
        # Selecionar modelo
        provider = config.get('model_provider', 'openai')
        model_id = config.get('model_id', 'gpt-4o-mini')

        if provider == 'openai':
            model = OpenAIChat(id=model_id)
        elif provider == 'anthropic':
            model = Claude(id=model_id)
        else:
            model = OpenAIChat(id='gpt-4o-mini')

        # Selecionar tools
        tools = []
        tool_names = config.get('tools', [])

        if isinstance(tool_names, str):
            tool_names = json.loads(tool_names)

        for tool_name in tool_names:
            if tool_name == 'web_search' or tool_name == 'duckduckgo':
                tools.append(DuckDuckGoTools())
            elif tool_name == 'yfinance':
                tools.append(YFinanceTools())
            elif tool_name == 'calculator' or tool_name == 'calculations':
                tools.append(CalculatorTools())
            elif tool_name == 'reasoning':
                tools.append(ReasoningTools())

        # Criar agente
        instructions = config.get('instructions', [])
        if isinstance(instructions, str):
            instructions = json.loads(instructions)

        agent = Agent(
            name=config.get('name', 'Agent'),
            role=config.get('role', 'Assistant'),
            model=model,
            tools=tools,
            instructions=instructions,
            markdown=True,
            debug_mode=True
        )

        return agent

    def _validate_visual_workflow(self, visual_def: VisualWorkflowDefinition):
        """Valida um workflow visual"""
        # Verificar se tem nó de início
        start_nodes = [n for n in visual_def.nodes if n.type == 'start']
        if len(start_nodes) != 1:
            raise ValueError("Workflow deve ter exatamente um nó de início")

        # Verificar se tem nó de fim
        end_nodes = [n for n in visual_def.nodes if n.type == 'end']
        if len(end_nodes) == 0:
            raise ValueError("Workflow deve ter pelo menos um nó de fim")

        # Verificar conexões válidas
        node_ids = {n.id for n in visual_def.nodes}
        for conn in visual_def.connections:
            if conn.from_node not in node_ids or conn.to_node not in node_ids:
                raise ValueError(f"Conexão inválida: {conn.from_node} -> {conn.to_node}")

    async def _load_workflow(self, workflow_id: str) -> Dict:
        """Carrega um workflow do banco"""
        result = supabase.table('agno_workflows') \
            .select('*').eq('id', int(workflow_id)).execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Workflow não encontrado")

        return result.data[0]

    async def _load_team(self, team_id: str) -> Team:
        """Carrega um team do banco e constrói o objeto Agno Team"""
        result = supabase.table('agno_teams') \
            .select('*, agno_team_agents(*, agno_agents(*))') \
            .eq('id', int(team_id)).execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Team não encontrado")

        team_data = result.data[0]

        # Construir agentes do team
        agents = []
        for team_agent in team_data['agno_team_agents']:
            agent_data = team_agent['agno_agents']
            agent = await self._build_agno_agent(agent_data)
            agents.append(agent)

        # Criar Team Agno
        team = Team(
            name=team_data['name'],
            members=agents,
            instructions=[team_data['description']],
            show_tool_calls=True,
            markdown=True
        )

        return team

    async def _get_cached_agent(self, agent_id: str) -> Agent:
        """Recupera agente do cache ou carrega do banco"""
        if agent_id in self.agents_cache:
            return self.agents_cache[agent_id]

        result = supabase.table('agno_agents') \
            .select('*').eq('id', int(agent_id)).execute()

        if not result.data:
            raise ValueError(f"Agente {agent_id} não encontrado")

        agent = await self._build_agno_agent(result.data[0])
        self.agents_cache[agent_id] = agent
        return agent

    async def _update_execution_status(
            self,
            execution_id: str,
            status: str,
            error_message: Optional[str] = None,
            output_data: Optional[Dict] = None
    ):
        """Atualiza status de uma execução"""
        update_data = {
            'execution_status': status,
            'completed_at': datetime.utcnow().isoformat()
        }

        if error_message:
            update_data['error_message'] = error_message

        if output_data:
            update_data['output_data'] = output_data

        supabase.table('agno_workflow_executions') \
            .update(update_data) \
            .eq('id', execution_id) \
            .execute()

    # ==================== TEMPLATES ====================

    async def get_workflow_templates(self) -> List[Dict]:
        """Lista templates de workflow disponíveis"""
        result = supabase.table('agno_workflow_templates') \
            .select('*') \
            .eq('is_public', True) \
            .order('usage_count', desc=True) \
            .execute()

        return result.data

    async def create_workflow_from_template(
            self,
            user_id: int,
            template_id: int,
            name: str,
            customizations: Optional[Dict] = None
    ) -> str:
        """Cria um workflow baseado em um template"""
        # Buscar template
        template_result = supabase.table('agno_workflow_templates') \
            .select('*').eq('id', template_id).execute()

        if not template_result.data:
            raise HTTPException(status_code=404, detail="Template não encontrado")

        template = template_result.data[0]
        template_def = template['template_definition']

        # Aplicar customizações se houver
        if customizations:
            # TODO: Aplicar customizações ao template
            pass

        # Criar workflow baseado no template
        visual_def = VisualWorkflowDefinition(
            nodes=[NodeConfig(**node) for node in template_def['nodes']],
            connections=[WorkflowConnection(**conn) for conn in template_def['connections']],
            metadata=template_def.get('metadata', {})
        )

        workflow_id = await self.create_visual_workflow(
            user_id, name, template['description'], visual_def
        )

        # Incrementar contador de uso do template
        supabase.table('agno_workflow_templates') \
            .update({'usage_count': template['usage_count'] + 1}) \
            .eq('id', template_id) \
            .execute()

        return workflow_id


# Instância global do serviço
workflow_team_service = WorkflowTeamService()