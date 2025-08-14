import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, Plus, Settings, Play, Bot, MessageSquare, Save, AlertCircle,
  CheckCircle, Loader, Search, Trash2, Edit, Copy, BarChart3, Clock,
  Crown, Target, Zap, RefreshCw, Send, Eye, Filter, Download, X
} from 'lucide-react';

// Types
interface Agent {
  id: string;
  name: string;
  role: string;
  role_in_team?: string;
  priority?: number;
  model_provider: string;
  model_id: string;
  tools: string[];
  is_active: boolean;
}

interface Team {
  id: string;
  name: string;
  description: string;
  team_type: 'collaborative' | 'hierarchical' | 'sequential';
  is_active: boolean;
  created_at: string;
  updated_at: string;
  team_configuration: Record<string, any>;
  agent_count: number;
  agents: Agent[];
  supervisor?: Agent;
  execution_count: number;
}

// Mock API hook (replace with real implementation)
const useTeams = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTeams = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('http://localhost:8000/api/teams');

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Ensure data is an array
      if (Array.isArray(data)) {
        setTeams(data);
      } else if (data && Array.isArray(data.teams)) {
        // Handle case where API returns {teams: [...]}
        setTeams(data.teams);
      } else {
        console.warn('API returned unexpected format:', data);
        setTeams([]);
      }
    } catch (err: any) {
      console.error('Error fetching teams:', err);
      setError(err.message || 'Erro ao carregar teams');

      // For development: Use mock data when API is not available
      const mockTeams: Team[] = [
        {
          id: '1',
          name: 'Equipe de Análise',
          description: 'Team focado em análise de dados e relatórios',
          team_type: 'collaborative',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          team_configuration: {},
          agent_count: 2,
          agents: [],
          execution_count: 15
        }
      ];
      setTeams(mockTeams);
    } finally {
      setLoading(false);
    }
  };

  const createTeam = async (teamData: any) => {
    try {
      const response = await fetch('http://localhost:8000/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(teamData)
      });
      const result = await response.json();
      await fetchTeams(); // Refresh list
      return result;
    } catch (err: any) {
      throw new Error(err.message);
    }
  };

  const executeTeam = async (teamId: string, message: string) => {
    try {
      const response = await fetch(`http://localhost:8000/api/teams/${teamId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });
      return await response.json();
    } catch (err: any) {
      throw new Error(err.message);
    }
  };

  const deleteTeam = async (teamId: string) => {
    try {
      await fetch(`http://localhost:8000/api/teams/${teamId}`, {
        method: 'DELETE'
      });
      await fetchTeams();
    } catch (err: any) {
      throw new Error(err.message);
    }
  };

  useEffect(() => {
    fetchTeams();
  }, []);

  return { teams, loading, error, fetchTeams, createTeam, executeTeam, deleteTeam };
};

const useAgents = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAgents = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:8000/api/agents');

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Ensure data is an array
      if (Array.isArray(data)) {
        setAgents(data);
      } else if (data && Array.isArray(data.agents)) {
        // Handle case where API returns {agents: [...]}
        setAgents(data.agents);
      } else {
        console.warn('API returned unexpected format for agents:', data);
        setAgents([]);
      }
    } catch (err) {
      console.error('Error fetching agents:', err);

      // For development: Use mock data when API is not available
      const mockAgents: Agent[] = [
        {
          id: '1',
          name: 'Assistente de Análise',
          role: 'Data Analyst',
          model_provider: 'openai',
          model_id: 'gpt-4',
          tools: ['web_search', 'database'],
          is_active: true
        },
        {
          id: '2',
          name: 'Especialista em Vendas',
          role: 'Sales Expert',
          model_provider: 'anthropic',
          model_id: 'claude-3-sonnet',
          tools: ['email', 'calendar'],
          is_active: true
        }
      ];
      setAgents(mockAgents);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  return { agents, loading, fetchAgents };
};

const TeamBuilder: React.FC = () => {
  // Hooks
  const { teams, loading: teamsLoading, error, fetchTeams, createTeam, executeTeam, deleteTeam } = useTeams();
  const { agents, loading: agentsLoading, fetchAgents } = useAgents();

  // States
  const [activeTab, setActiveTab] = useState<'builder' | 'testing' | 'analytics'>('builder');
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);
  const [newTeam, setNewTeam] = useState({
    name: '',
    description: '',
    team_type: 'collaborative' as const,
    agents: [] as Array<{ agent_id: string; role_in_team: string; priority: number }>
  });

  // Testing states
  const [testMessage, setTestMessage] = useState('');
  const [testResult, setTestResult] = useState<any>(null);
  const [testingTeam, setTestingTeam] = useState<string | null>(null);

  // Search and filter
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Filtered teams
  const filteredTeams = (teams || []).filter(team => {
    const matchesSearch = team.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         team.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || team.team_type === typeFilter;
    return matchesSearch && matchesType;
  });

  // Create team handler
  const handleCreateTeam = async () => {
    if (!newTeam.name.trim()) {
      alert('Nome do team é obrigatório');
      return;
    }

    if (newTeam.agents.length === 0) {
      alert('Adicione pelo menos um agente ao team');
      return;
    }

    try {
      await createTeam(newTeam);
      setIsCreatingTeam(false);
      setNewTeam({
        name: '',
        description: '',
        team_type: 'collaborative',
        agents: []
      });
      alert('Team criado com sucesso!');
    } catch (err: any) {
      alert(`Erro ao criar team: ${err.message}`);
    }
  };

  // Add agent to team
  const addAgentToTeam = (agent: Agent) => {
    if (newTeam.agents.some(a => a.agent_id === agent.id)) {
      alert('Agente já adicionado ao team');
      return;
    }

    setNewTeam(prev => ({
      ...prev,
      agents: [...prev.agents, {
        agent_id: agent.id,
        role_in_team: agent.role,
        priority: prev.agents.length + 1
      }]
    }));
  };

  // Remove agent from team
  const removeAgentFromTeam = (agentId: string) => {
    setNewTeam(prev => ({
      ...prev,
      agents: prev.agents.filter(a => a.agent_id !== agentId)
    }));
  };

  // Test team
  const handleTestTeam = async (team: Team) => {
    if (!testMessage.trim()) {
      alert('Digite uma mensagem para testar');
      return;
    }

    setTestingTeam(team.id);
    setTestResult(null);

    try {
      const result = await executeTeam(team.id, testMessage);
      setTestResult(result);
    } catch (err: any) {
      setTestResult({ error: err.message });
    } finally {
      setTestingTeam(null);
    }
  };

  // Delete team
  const handleDeleteTeam = async (teamId: string) => {
    if (confirm('Tem certeza que deseja deletar este team?')) {
      try {
        await deleteTeam(teamId);
        alert('Team deletado com sucesso!');
      } catch (err: any) {
        alert(`Erro ao deletar team: ${err.message}`);
      }
    }
  };

  if (teamsLoading || agentsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-600">Carregando...</span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Users className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Team Builder</h1>
              <p className="text-gray-600">Crie e gerencie teams de agentes colaborativos</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={fetchTeams}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Atualizar</span>
            </button>
            <button
              onClick={() => setIsCreatingTeam(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Team</span>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-4 mt-6 border-b">
          <button
            onClick={() => setActiveTab('builder')}
            className={`pb-2 px-1 border-b-2 transition-colors ${
              activeTab === 'builder'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Gerenciar Teams
          </button>
          <button
            onClick={() => setActiveTab('testing')}
            className={`pb-2 px-1 border-b-2 transition-colors ${
              activeTab === 'testing'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Testar Teams
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`pb-2 px-1 border-b-2 transition-colors ${
              activeTab === 'analytics'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Analytics
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <span className="text-red-700">{error}</span>
          </div>
        </div>
      )}

      {/* Content based on active tab */}
      {activeTab === 'builder' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Teams List */}
          <div className="lg:col-span-2 space-y-4">
            {/* Search and Filter */}
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex space-x-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Buscar teams..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">Todos os tipos</option>
                  <option value="collaborative">Colaborativo</option>
                  <option value="hierarchical">Hierárquico</option>
                  <option value="sequential">Sequencial</option>
                </select>
              </div>
            </div>

            {/* Teams Grid */}
            <div className="space-y-4">
              {filteredTeams.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
                  <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum team encontrado</h3>
                  <p className="text-gray-600">Crie seu primeiro team para começar</p>
                </div>
              ) : (
                filteredTeams.map((team) => (
                  <div key={team.id} className="bg-white rounded-lg shadow-sm border p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">{team.name}</h3>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            team.team_type === 'collaborative' ? 'bg-blue-100 text-blue-800' :
                            team.team_type === 'hierarchical' ? 'bg-purple-100 text-purple-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {team.team_type}
                          </span>
                        </div>
                        <p className="text-gray-600 mb-4">{team.description}</p>

                        <div className="flex items-center space-x-6 text-sm text-gray-500">
                          <div className="flex items-center space-x-1">
                            <Bot className="w-4 h-4" />
                            <span>{team.agent_count} agentes</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Play className="w-4 h-4" />
                            <span>{team.execution_count} execuções</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Clock className="w-4 h-4" />
                            <span>{new Date(team.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setSelectedTeam(team)}
                          className="p-2 text-gray-500 hover:text-blue-600 transition-colors"
                          title="Ver detalhes"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteTeam(team.id)}
                          className="p-2 text-gray-500 hover:text-red-600 transition-colors"
                          title="Deletar team"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Team Agents */}
                    {team.agents.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Agentes:</h4>
                        <div className="flex flex-wrap gap-2">
                          {team.agents.slice(0, 3).map((agent) => (
                            <div key={agent.id} className="flex items-center space-x-2 bg-gray-50 rounded-lg px-3 py-1">
                              <Bot className="w-3 h-3 text-gray-500" />
                              <span className="text-sm text-gray-700">{agent.name}</span>
                              {agent.role_in_team && (
                                <span className="text-xs text-gray-500">({agent.role_in_team})</span>
                              )}
                            </div>
                          ))}
                          {team.agents.length > 3 && (
                            <span className="text-sm text-gray-500">+{team.agents.length - 3} mais</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Team Details */}
            {selectedTeam && (
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Detalhes do Team</h3>
                <div className="space-y-3">
                  <div>
                    <span className="text-sm font-medium text-gray-700">Nome:</span>
                    <p className="text-gray-900">{selectedTeam.name}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-700">Tipo:</span>
                    <p className="text-gray-900 capitalize">{selectedTeam.team_type}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-700">Agentes:</span>
                    <div className="mt-2 space-y-2">
                      {selectedTeam.agents.map((agent) => (
                        <div key={agent.id} className="flex items-center justify-between bg-gray-50 rounded p-2">
                          <div>
                            <p className="text-sm font-medium">{agent.name}</p>
                            <p className="text-xs text-gray-500">{agent.role}</p>
                          </div>
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                            {agent.role_in_team}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Stats */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Estatísticas</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total de Teams:</span>
                  <span className="font-semibold">{(teams || []).length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Teams Ativos:</span>
                  <span className="font-semibold">{(teams || []).filter(t => t.is_active).length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Agentes Únicos:</span>
                  <span className="font-semibold">{(agents || []).length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Testing Tab */}
      {activeTab === 'testing' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Testar Team</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Selecionar Team:
                </label>
                <select
                  onChange={(e) => setSelectedTeam((teams || []).find(t => t.id === e.target.value) || null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Escolha um team...</option>
                  {(teams || []).map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name} ({team.agent_count} agentes)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mensagem de Teste:
                </label>
                <textarea
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  placeholder="Digite uma mensagem para testar o team..."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <button
                onClick={() => selectedTeam && handleTestTeam(selectedTeam)}
                disabled={!selectedTeam || !testMessage.trim() || testingTeam === selectedTeam?.id}
                className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {testingTeam === selectedTeam?.id ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>
                  {testingTeam === selectedTeam?.id ? 'Executando...' : 'Executar Team'}
                </span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Resultado da Execução</h3>

            {testResult ? (
              <div className="space-y-4">
                {testResult.error ? (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2">
                      <AlertCircle className="w-5 h-5 text-red-500" />
                      <span className="text-red-700">{testResult.error}</span>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center space-x-2 mb-2">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                        <span className="text-green-700 font-medium">Execução Concluída</span>
                      </div>
                      <div className="text-sm text-green-600">
                        <p>Team: {testResult.team_name}</p>
                        <p>Agentes: {testResult.agents_used}</p>
                        <p>Tempo: {testResult.execution_time_ms}ms</p>
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-2">Resposta:</h4>
                      <div className="text-gray-700 whitespace-pre-wrap">{testResult.response}</div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p>Execute um team para ver os resultados aqui</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="text-center py-12">
            <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Analytics em Desenvolvimento</h3>
            <p className="text-gray-600">Métricas detalhadas de performance dos teams serão disponibilizadas em breve</p>
          </div>
        </div>
      )}

      {/* Create Team Modal */}
      {isCreatingTeam && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Criar Novo Team</h2>
                <button
                  onClick={() => setIsCreatingTeam(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nome do Team *
                  </label>
                  <input
                    type="text"
                    value={newTeam.name}
                    onChange={(e) => setNewTeam(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ex: Equipe de Análise de Dados"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Descrição
                  </label>
                  <textarea
                    value={newTeam.description}
                    onChange={(e) => setNewTeam(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Descreva o propósito e objetivos do team..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tipo de Colaboração
                  </label>
                  <select
                    value={newTeam.team_type}
                    onChange={(e) => setNewTeam(prev => ({ ...prev, team_type: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="collaborative">Colaborativo - Agentes trabalham juntos</option>
                    <option value="hierarchical">Hierárquico - Com supervisor</option>
                    <option value="sequential">Sequencial - Um após o outro</option>
                  </select>
                </div>
              </div>

              {/* Agents Selection */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900">Agentes Disponíveis</h3>

                {(agents || []).length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Bot className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p>Nenhum agente disponível</p>
                    <p className="text-sm">Crie agentes primeiro para adicionar ao team</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 max-h-64 overflow-y-auto">
                    {(agents || []).map((agent) => {
                      const isSelected = newTeam.agents.some(a => a.agent_id === agent.id);

                      return (
                        <div
                          key={agent.id}
                          className={`flex items-center justify-between p-3 border rounded-lg transition-colors ${
                            isSelected
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <Bot className="w-5 h-5 text-gray-500" />
                            <div>
                              <p className="font-medium text-gray-900">{agent.name}</p>
                              <p className="text-sm text-gray-600">{agent.role}</p>
                              <p className="text-xs text-gray-500">{agent.model_provider} - {agent.model_id}</p>
                            </div>
                          </div>

                          {isSelected ? (
                            <button
                              onClick={() => removeAgentFromTeam(agent.id)}
                              className="px-3 py-1 bg-red-100 text-red-700 text-sm rounded hover:bg-red-200 transition-colors"
                            >
                              Remover
                            </button>
                          ) : (
                            <button
                              onClick={() => addAgentToTeam(agent)}
                              className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded hover:bg-blue-200 transition-colors"
                            >
                              Adicionar
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Selected Agents */}
              {newTeam.agents.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    Agentes Selecionados ({newTeam.agents.length})
                  </h3>
                  <div className="space-y-2">
                    {newTeam.agents.map((teamAgent, index) => {
                      const agent = (agents || []).find(a => a.id === teamAgent.agent_id);
                      if (!agent) return null;

                      return (
                        <div key={teamAgent.agent_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center space-x-3">
                            <span className="w-6 h-6 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center">
                              {index + 1}
                            </span>
                            <div>
                              <p className="font-medium text-gray-900">{agent.name}</p>
                              <p className="text-sm text-gray-600">{teamAgent.role_in_team}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => removeAgentFromTeam(agent.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setIsCreatingTeam(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateTeam}
                disabled={!newTeam.name.trim() || newTeam.agents.length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                Criar Team
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamBuilder;