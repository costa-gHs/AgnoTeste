// src/components/TeamBuilder.tsx

import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Trash2,
  Settings,
  Play,
  Crown,
  Bot,
  ChevronRight,
  ChevronDown,
  Zap,
  Brain,
  MessageSquare,
  Save,
  AlertCircle,
  CheckCircle
} from 'lucide-react';

interface Agent {
  id: string;
  name: string;
  role: string;
  model_provider: string;
  model_id: string;
  tools: string[];
  instructions: string[];
  roleInTeam?: string;
  priority?: number;
}

interface Team {
  id?: string;
  name: string;
  description: string;
  teamType: 'collaborative' | 'hierarchical' | 'sequential';
  agents: Agent[];
  supervisorConfig?: {
    agentId: string;
    instructions: string[];
  };
}

interface TeamBuilderProps {
  availableAgents: Agent[];
  onSaveTeam: (team: Team) => Promise<void>;
  onExecuteTeam: (teamId: string, message: string) => Promise<any>;
  existingTeam?: Team;
}

const TeamBuilder: React.FC<TeamBuilderProps> = ({
  availableAgents,
  onSaveTeam,
  onExecuteTeam,
  existingTeam
}) => {
  const [team, setTeam] = useState<Team>({
    name: '',
    description: '',
    teamType: 'collaborative',
    agents: []
  });

  const [selectedAgents, setSelectedAgents] = useState<Agent[]>([]);
  const [showAgentSelector, setShowAgentSelector] = useState(false);
  const [testMessage, setTestMessage] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Carregar team existente se fornecido
  useEffect(() => {
    if (existingTeam) {
      setTeam(existingTeam);
      setSelectedAgents(existingTeam.agents);
    }
  }, [existingTeam]);

  const teamTypeOptions = [
    {
      value: 'collaborative',
      label: 'Colaborativo',
      description: 'Agentes trabalham juntos em paralelo',
      icon: Users
    },
    {
      value: 'hierarchical',
      label: 'Hierárquico',
      description: 'Um supervisor coordena os demais agentes',
      icon: Crown
    },
    {
      value: 'sequential',
      label: 'Sequencial',
      description: 'Agentes trabalham um após o outro',
      icon: ChevronRight
    }
  ];

  const roleOptions = [
    'leader',
    'specialist',
    'reviewer',
    'coordinator',
    'analyst',
    'executor',
    'validator'
  ];

  const addAgent = (agent: Agent) => {
    if (!selectedAgents.find(a => a.id === agent.id)) {
      const newAgent = {
        ...agent,
        roleInTeam: 'specialist',
        priority: selectedAgents.length + 1
      };

      setSelectedAgents([...selectedAgents, newAgent]);
      setTeam(prev => ({
        ...prev,
        agents: [...prev.agents, newAgent]
      }));
    }
  };

  const removeAgent = (agentId: string) => {
    const updatedAgents = selectedAgents.filter(a => a.id !== agentId);
    setSelectedAgents(updatedAgents);
    setTeam(prev => ({
      ...prev,
      agents: updatedAgents
    }));
  };

  const updateAgentRole = (agentId: string, roleInTeam: string) => {
    const updatedAgents = selectedAgents.map(agent =>
      agent.id === agentId ? { ...agent, roleInTeam } : agent
    );

    setSelectedAgents(updatedAgents);
    setTeam(prev => ({
      ...prev,
      agents: updatedAgents
    }));
  };

  const updateAgentPriority = (agentId: string, priority: number) => {
    const updatedAgents = selectedAgents.map(agent =>
      agent.id === agentId ? { ...agent, priority } : agent
    );

    setSelectedAgents(updatedAgents);
    setTeam(prev => ({
      ...prev,
      agents: updatedAgents
    }));
  };

  const handleSaveTeam = async () => {
    if (!team.name || selectedAgents.length === 0) {
      setSaveStatus('error');
      return;
    }

    setIsSaving(true);
    setSaveStatus('idle');

    try {
      await onSaveTeam({
        ...team,
        agents: selectedAgents
      });
      setSaveStatus('success');
    } catch (error) {
      setSaveStatus('error');
      console.error('Erro ao salvar team:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExecuteTeam = async () => {
    if (!team.id || !testMessage) return;

    setIsExecuting(true);
    setExecutionResult(null);

    try {
      const result = await onExecuteTeam(team.id, testMessage);
      setExecutionResult(result);
    } catch (error) {
      setExecutionResult({ error: error.message });
    } finally {
      setIsExecuting(false);
    }
  };

  const getModelIcon = (provider: string) => {
    switch (provider) {
      case 'openai': return '🤖';
      case 'anthropic': return '🧠';
      case 'groq': return '⚡';
      default: return '🤖';
    }
  };

  return (
    <div className="h-full flex">
      {/* Painel Principal */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <Users className="w-8 h-8 text-blue-600" />
              Team Builder
            </h1>

            <div className="flex gap-2">
              <button
                onClick={handleSaveTeam}
                disabled={isSaving || !team.name || selectedAgents.length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'Salvando...' : 'Salvar Team'}
              </button>
            </div>
          </div>

          {/* Status de salvamento */}
          {saveStatus === 'success' && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
              <CheckCircle className="w-4 h-4" />
              Team salvo com sucesso!
            </div>
          )}

          {saveStatus === 'error' && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
              <AlertCircle className="w-4 h-4" />
              Erro ao salvar team. Verifique os campos obrigatórios.
            </div>
          )}

          {/* Configurações básicas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nome do Team *
              </label>
              <input
                type="text"
                value={team.name}
                onChange={(e) => setTeam(prev => ({ ...prev, name: e.target.value }))}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ex: Equipe de Análise Financeira"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo do Team
              </label>
              <select
                value={team.teamType}
                onChange={(e) => setTeam(prev => ({ ...prev, teamType: e.target.value as any }))}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {teamTypeOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label} - {option.description}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Descrição
            </label>
            <textarea
              value={team.description}
              onChange={(e) => setTeam(prev => ({ ...prev, description: e.target.value }))}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
              placeholder="Descreva o propósito e objetivos do team..."
            />
          </div>
        </div>

        {/* Lista de Agentes Selecionados */}
        <div className="flex-1 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">
              Agentes do Team ({selectedAgents.length})
            </h2>

            <button
              onClick={() => setShowAgentSelector(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Adicionar Agente
            </button>
          </div>

          {selectedAgents.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Bot className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg">Nenhum agente adicionado</p>
              <p className="text-sm">Clique em "Adicionar Agente" para começar</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {selectedAgents
                .sort((a, b) => (a.priority || 0) - (b.priority || 0))
                .map((agent, index) => (
                <div key={agent.id} className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl">{getModelIcon(agent.model_provider)}</span>
                        <div>
                          <h3 className="font-semibold text-gray-900">{agent.name}</h3>
                          <p className="text-sm text-gray-600">{agent.role}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Papel no Team
                          </label>
                          <select
                            value={agent.roleInTeam || 'specialist'}
                            onChange={(e) => updateAgentRole(agent.id, e.target.value)}
                            className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                          >
                            {roleOptions.map(role => (
                              <option key={role} value={role}>
                                {role.charAt(0).toUpperCase() + role.slice(1)}
                              </option>
                            ))}
                          </select>
                        </div>

                        {team.teamType === 'sequential' && (
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Ordem de Execução
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={agent.priority || index + 1}
                              onChange={(e) => updateAgentPriority(agent.id, parseInt(e.target.value))}
                              className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        )}

                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Modelo
                          </label>
                          <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                            {agent.model_id}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-1">
                        {agent.tools.map(tool => (
                          <span
                            key={tool}
                            className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                          >
                            {tool}
                          </span>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => removeAgent(agent.id)}
                      className="ml-4 p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Supervisor Config (apenas para tipo hierárquico) */}
          {team.teamType === 'hierarchical' && (
            <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <Crown className="w-4 h-4 text-yellow-600" />
                Configuração do Supervisor
              </h3>
              <p className="text-sm text-gray-600 mb-3">
                No modo hierárquico, um agente supervisor coordena o trabalho dos demais.
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Agente Supervisor
                </label>
                <select
                  value={team.supervisorConfig?.agentId || ''}
                  onChange={(e) => setTeam(prev => ({
                    ...prev,
                    supervisorConfig: {
                      agentId: e.target.value,
                      instructions: ['Coordene o trabalho dos agentes especializados']
                    }
                  }))}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selecione um agente</option>
                  {selectedAgents.map(agent => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name} - {agent.role}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Painel de Teste */}
        {team.id && (
          <div className="bg-gray-50 border-t border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4 text-green-600" />
              Testar Team
            </h3>

            <div className="flex gap-4">
              <input
                type="text"
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Digite uma mensagem para testar o team..."
                onKeyPress={(e) => e.key === 'Enter' && handleExecuteTeam()}
              />

              <button
                onClick={handleExecuteTeam}
                disabled={isExecuting || !testMessage}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Play className="w-4 h-4" />
                {isExecuting ? 'Executando...' : 'Executar'}
              </button>
            </div>

            {executionResult && (
              <div className="mt-4 p-4 bg-white border border-gray-200 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">Resultado:</h4>
                {executionResult.error ? (
                  <div className="text-red-600 text-sm">
                    Erro: {executionResult.error}
                  </div>
                ) : (
                  <div className="text-sm text-gray-700 whitespace-pre-wrap">
                    {executionResult.response}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal de Seleção de Agentes */}
      {showAgentSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Selecionar Agentes
              </h2>
            </div>

            <div className="p-6 overflow-y-auto max-h-96">
              <div className="grid gap-3">
                {availableAgents
                  .filter(agent => !selectedAgents.find(sa => sa.id === agent.id))
                  .map(agent => (
                  <div
                    key={agent.id}
                    className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                    onClick={() => addAgent(agent)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{getModelIcon(agent.model_provider)}</span>
                      <div>
                        <h3 className="font-medium text-gray-900">{agent.name}</h3>
                        <p className="text-sm text-gray-600">{agent.role}</p>
                        <div className="flex gap-1 mt-1">
                          {agent.tools.slice(0, 3).map(tool => (
                            <span
                              key={tool}
                              className="px-1 py-0.5 bg-gray-100 text-gray-600 text-xs rounded"
                            >
                              {tool}
                            </span>
                          ))}
                          {agent.tools.length > 3 && (
                            <span className="text-xs text-gray-500">
                              +{agent.tools.length - 3} mais
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <Plus className="w-5 h-5 text-green-600" />
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setShowAgentSelector(false)}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamBuilder;