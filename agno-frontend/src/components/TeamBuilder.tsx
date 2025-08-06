// src/components/TeamBuilder.tsx - VERSÃO CORRIGIDA E MELHORADA

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
  CheckCircle,
  Loader,
  User,
  Shield,
  Target
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
  description?: string;
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
  availableAgents?: Agent[];  // Tornar opcional para evitar erros
  onSaveTeam: (team: Team) => Promise<void>;
  onExecuteTeam: (teamId: string, message: string) => Promise<any>;
  existingTeam?: Team;
  isLoading?: boolean;
}

const TeamBuilder: React.FC<TeamBuilderProps> = ({
  availableAgents = [],  // Valor padrão para evitar undefined
  onSaveTeam,
  onExecuteTeam,
  existingTeam,
  isLoading = false
}) => {
  // Estados principais
  const [team, setTeam] = useState<Team>({
    name: '',
    description: '',
    teamType: 'collaborative',
    agents: []
  });

  const [selectedAgents, setSelectedAgents] = useState<Agent[]>([]);
  const [showAgentSelector, setShowAgentSelector] = useState(false);
  const [testMessage, setTestMessage] = useState('Olá, time! Como podem me ajudar?');
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errors, setErrors] = useState<string[]>([]);

  // Carregar team existente se fornecido
  useEffect(() => {
    if (existingTeam) {
      setTeam(existingTeam);
      setSelectedAgents(existingTeam.agents);
    }
  }, [existingTeam]);

  // Configurações dos tipos de team
  const teamTypeOptions = [
    {
      value: 'collaborative',
      label: 'Colaborativo',
      description: 'Agentes trabalham juntos em paralelo, compartilhando tarefas',
      icon: Users,
      color: 'blue'
    },
    {
      value: 'hierarchical',
      label: 'Hierárquico',
      description: 'Um supervisor coordena e delega tarefas aos demais agentes',
      icon: Crown,
      color: 'purple'
    },
    {
      value: 'sequential',
      label: 'Sequencial',
      description: 'Agentes trabalham em ordem, passando resultado adiante',
      icon: ChevronRight,
      color: 'green'
    }
  ];

  const roleOptions = [
    { value: 'leader', label: 'Líder', icon: Crown },
    { value: 'specialist', label: 'Especialista', icon: Brain },
    { value: 'reviewer', label: 'Revisor', icon: Shield },
    { value: 'coordinator', label: 'Coordenador', icon: Target },
    { value: 'analyst', label: 'Analista', icon: ChevronDown },
    { value: 'executor', label: 'Executor', icon: Zap },
    { value: 'validator', label: 'Validador', icon: CheckCircle }
  ];

  // Função para validar o team
  const validateTeam = (): string[] => {
    const newErrors: string[] = [];

    if (!team.name.trim()) {
      newErrors.push('Nome do team é obrigatório');
    }

    if (selectedAgents.length === 0) {
      newErrors.push('É necessário pelo menos um agente no team');
    }

    if (team.teamType === 'hierarchical') {
      const hasLeader = selectedAgents.some(agent => agent.roleInTeam === 'leader');
      if (!hasLeader) {
        newErrors.push('Team hierárquico precisa de pelo menos um líder');
      }
    }

    if (team.teamType === 'sequential' && selectedAgents.length < 2) {
      newErrors.push('Team sequencial precisa de pelo menos 2 agentes');
    }

    return newErrors;
  };

  // Função para adicionar agente
  const addAgent = (agent: Agent) => {
    if (!selectedAgents.find(a => a.id === agent.id)) {
      const newAgent = {
        ...agent,
        roleInTeam: team.teamType === 'hierarchical' && selectedAgents.length === 0 ? 'leader' : 'specialist',
        priority: selectedAgents.length + 1
      };

      setSelectedAgents([...selectedAgents, newAgent]);
      setTeam(prev => ({
        ...prev,
        agents: [...prev.agents, newAgent]
      }));
    }
    setShowAgentSelector(false);
  };

  // Função para remover agente
  const removeAgent = (agentId: string) => {
    const updatedAgents = selectedAgents.filter(a => a.id !== agentId);
    setSelectedAgents(updatedAgents);
    setTeam(prev => ({
      ...prev,
      agents: updatedAgents
    }));
  };

  // Função para atualizar papel do agente
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

  // Função para atualizar prioridade do agente
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

  // Função para salvar team
  const handleSaveTeam = async () => {
    const validationErrors = validateTeam();
    setErrors(validationErrors);

    if (validationErrors.length > 0) {
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
      setErrors([]);
    } catch (error) {
      setSaveStatus('error');
      setErrors([`Erro ao salvar: ${error instanceof Error ? error.message : 'Erro desconhecido'}`]);
      console.error('Erro ao salvar team:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Função para executar team
  const handleExecuteTeam = async () => {
    if (!team.id || !testMessage.trim()) return;

    setIsExecuting(true);
    setExecutionResult(null);

    try {
      const result = await onExecuteTeam(team.id, testMessage);
      setExecutionResult(result);
    } catch (error) {
      setExecutionResult({
        error: error instanceof Error ? error.message : 'Erro na execução'
      });
    } finally {
      setIsExecuting(false);
    }
  };

  // Função para obter ícone do provedor
  const getModelIcon = (provider: string) => {
    const icons: Record<string, string> = {
      'openai': '🤖',
      'anthropic': '🧠',
      'groq': '⚡',
      'ollama': '🦙',
      'google': '🌟'
    };
    return icons[provider] || '🤖';
  };

  // Função para obter cor do tipo de team
  const getTeamTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'collaborative': 'blue',
      'hierarchical': 'purple',
      'sequential': 'green'
    };
    return colors[type] || 'gray';
  };

  // Função para obter agentes disponíveis (filtrar já selecionados)
  const getAvailableAgents = () => {
    if (!Array.isArray(availableAgents)) {
      console.warn('availableAgents não é um array:', availableAgents);
      return [];
    }

    return availableAgents.filter(agent =>
      !selectedAgents.find(sa => sa.id === agent.id)
    );
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
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
              disabled={isSaving || isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            >
              {isSaving ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Salvar Team
                </>
              )}
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

        {/* Erros de validação */}
        {errors.length > 0 && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-700 mb-2">
              <AlertCircle className="w-4 h-4" />
              Corrija os seguintes problemas:
            </div>
            <ul className="list-disc list-inside text-sm text-red-600">
              {errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2 text-blue-700">
            <Loader className="w-4 h-4 animate-spin" />
            Carregando agentes disponíveis...
          </div>
        )}
      </div>

      {/* Conteúdo principal */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* Informações básicas do team */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Informações do Team</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome do Team
                </label>
                <input
                  type="text"
                  value={team.name}
                  onChange={(e) => setTeam(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: Equipe de Análise de Dados"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descrição
                </label>
                <input
                  type="text"
                  value={team.description}
                  onChange={(e) => setTeam(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Descreva o propósito do team"
                />
              </div>
            </div>

            {/* Tipo de team */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Tipo de Team
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {teamTypeOptions.map((option) => (
                  <div
                    key={option.value}
                    className={`relative border-2 rounded-lg p-4 cursor-pointer transition-all ${
                      team.teamType === option.value
                        ? `border-${option.color}-500 bg-${option.color}-50`
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setTeam(prev => ({ ...prev, teamType: option.value as any }))}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <option.icon className={`w-5 h-5 ${
                        team.teamType === option.value ? `text-${option.color}-600` : 'text-gray-500'
                      }`} />
                      <span className="font-medium text-gray-900">{option.label}</span>
                    </div>
                    <p className="text-sm text-gray-600">{option.description}</p>

                    {team.teamType === option.value && (
                      <div className={`absolute top-2 right-2 w-4 h-4 bg-${option.color}-500 rounded-full flex items-center justify-center`}>
                        <CheckCircle className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Agentes do team */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Agentes do Team ({selectedAgents.length})
              </h2>
              <button
                onClick={() => setShowAgentSelector(true)}
                disabled={isLoading || getAvailableAgents().length === 0}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Adicionar Agente
              </button>
            </div>

            {/* Lista de agentes selecionados */}
            {selectedAgents.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Bot className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p className="text-lg">Nenhum agente adicionado</p>
                <p className="text-sm">Clique em "Adicionar Agente" para começar</p>
              </div>
            ) : (
              <div className="space-y-4">
                {selectedAgents
                  .sort((a, b) => (a.priority || 0) - (b.priority || 0))
                  .map((agent, index) => (
                  <div key={agent.id} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <span className="text-2xl">{getModelIcon(agent.model_provider)}</span>
                          <div>
                            <h3 className="font-semibold text-gray-900">{agent.name}</h3>
                            <p className="text-sm text-gray-600">{agent.role}</p>
                            {agent.description && (
                              <p className="text-xs text-gray-500">{agent.description}</p>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Papel no Team
                            </label>
                            <select
                              value={agent.roleInTeam || 'specialist'}
                              onChange={(e) => updateAgentRole(agent.id, e.target.value)}
                              className="w-full text-sm px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                            >
                              {roleOptions.map(role => (
                                <option key={role.value} value={role.value}>
                                  {role.label}
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
                                className="w-full text-sm px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                              />
                            </div>
                          )}

                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Ferramentas ({agent.tools?.length || 0})
                            </label>
                            <div className="flex flex-wrap gap-1">
                              {agent.tools?.slice(0, 3).map(tool => (
                                <span
                                  key={tool}
                                  className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full"
                                >
                                  {tool}
                                </span>
                              ))}
                              {(agent.tools?.length || 0) > 3 && (
                                <span className="text-xs text-gray-500">
                                  +{(agent.tools?.length || 0) - 3} mais
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => removeAgent(agent.id)}
                        className="ml-4 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Área de teste (se team já foi salvo) */}
          {team.id && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Testar Team</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Mensagem de Teste
                  </label>
                  <textarea
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                    placeholder="Digite uma mensagem para testar o team..."
                  />
                </div>

                <button
                  onClick={handleExecuteTeam}
                  disabled={isExecuting || !testMessage.trim()}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                >
                  {isExecuting ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      Executando...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      Executar
                    </>
                  )}
                </button>

                {executionResult && (
                  <div className="mt-4 p-4 border rounded-lg">
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
            </div>
          )}
        </div>
      </div>

      {/* Modal de Seleção de Agentes */}
      {showAgentSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Selecionar Agentes
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {getAvailableAgents().length} agentes disponíveis
              </p>
            </div>

            <div className="p-6 overflow-y-auto max-h-96">
              {getAvailableAgents().length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <User className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>Todos os agentes disponíveis já foram adicionados ao team.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {getAvailableAgents().map(agent => (
                    <div
                      key={agent.id}
                      className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => addAgent(agent)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{getModelIcon(agent.model_provider)}</span>
                        <div>
                          <h3 className="font-medium text-gray-900">{agent.name}</h3>
                          <p className="text-sm text-gray-600">{agent.role}</p>
                          {agent.description && (
                            <p className="text-xs text-gray-500">{agent.description}</p>
                          )}
                          <div className="flex gap-1 mt-1">
                            {agent.tools?.slice(0, 3).map(tool => (
                              <span
                                key={tool}
                                className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded"
                              >
                                {tool}
                              </span>
                            ))}
                            {(agent.tools?.length || 0) > 3 && (
                              <span className="text-xs text-gray-500">
                                +{(agent.tools?.length || 0) - 3} mais
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <Plus className="w-5 h-5 text-green-600" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setShowAgentSelector(false)}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
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