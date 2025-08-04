// src/components/AgnoToolsManager.tsx

import React, { useState, useEffect } from 'react';
import {
  Search, Settings, Play, AlertCircle, CheckCircle, Clock,
  Wrench, Brain, Globe, DollarSign, Image, Cloud,
  Plus, X, Edit, Trash2, Eye, Activity, TrendingUp
} from 'lucide-react';

// Types
interface AgnoTool {
  id: number;
  name: string;
  display_name: string;
  description: string;
  category: string;
  class_path: string;
  required_packages: string[];
  config_schema: any;
  is_active: boolean;
  created_at: string;
}

interface AgentTool {
  id: number;
  tool: AgnoTool;
  config: Record<string, any>;
  is_enabled: boolean;
  created_at: string;
}

interface ToolExecution {
  id: number;
  tool_name: string;
  method_called: string;
  input_params: Record<string, any>;
  output_result?: string;
  status: string;
  error_message?: string;
  execution_time_ms?: number;
  created_at: string;
}

interface ToolStats {
  period_days: number;
  total_executions: number;
  success_rate: number;
  tool_stats: Array<{
    name: string;
    display_name: string;
    executions: number;
    avg_time_ms: number;
  }>;
}

const AgnoToolsManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'tools' | 'executions' | 'stats'>('tools');
  const [tools, setTools] = useState<AgnoTool[]>([]);
  const [agentTools, setAgentTools] = useState<AgentTool[]>([]);
  const [executions, setExecutions] = useState<ToolExecution[]>([]);
  const [stats, setStats] = useState<ToolStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAgentId] = useState(1); // Para demo

  // Estados para modals
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showExecuteModal, setShowExecuteModal] = useState(false);
  const [selectedTool, setSelectedTool] = useState<AgnoTool | null>(null);
  const [toolConfig, setToolConfig] = useState<Record<string, any>>({});
  const [executePrompt, setExecutePrompt] = useState('');
  const [executionResult, setExecutionResult] = useState<any>(null);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  // Ícones por categoria
  const categoryIcons = {
    web_search: Globe,
    financial: DollarSign,
    ai_media: Image,
    cloud: Cloud,
    utilities: Wrench,
    reasoning: Brain,
  };

  const categories = [
    { value: 'all', label: 'Todas', icon: Settings },
    { value: 'web_search', label: 'Pesquisa Web', icon: Globe },
    { value: 'financial', label: 'Financeiro', icon: DollarSign },
    { value: 'ai_media', label: 'IA & Mídia', icon: Image },
    { value: 'cloud', label: 'Nuvem', icon: Cloud },
    { value: 'utilities', label: 'Utilitários', icon: Wrench },
    { value: 'reasoning', label: 'Raciocínio', icon: Brain },
  ];

  // Funções de API
  const fetchTools = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/agno/tools`);
      if (response.ok) {
        const data = await response.json();
        setTools(data);
      }
    } catch (error) {
      console.error('Erro ao carregar ferramentas:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAgentTools = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/agno/agents/${selectedAgentId}/tools`);
      if (response.ok) {
        const data = await response.json();
        setAgentTools(data);
      }
    } catch (error) {
      console.error('Erro ao carregar ferramentas do agente:', error);
    }
  };

  const fetchExecutions = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/agno/executions?limit=50`);
      if (response.ok) {
        const data = await response.json();
        setExecutions(data);
      }
    } catch (error) {
      console.error('Erro ao carregar execuções:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/agno/stats?days=30`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    }
  };

  const addToolToAgent = async (toolId: number, config: Record<string, any>) => {
    try {
      const response = await fetch(`${API_BASE}/api/agno/agents/${selectedAgentId}/tools`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool_id: toolId,
          config: config,
          is_enabled: true
        })
      });

      if (response.ok) {
        await fetchAgentTools();
        setShowConfigModal(false);
        setSelectedTool(null);
        setToolConfig({});
      }
    } catch (error) {
      console.error('Erro ao adicionar ferramenta:', error);
    }
  };

  const executeAgentWithTools = async (prompt: string) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/agno/agents/${selectedAgentId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_config: {
            model_provider: 'openai',
            model_id: 'gpt-4o'
          },
          tools: [],
          prompt: prompt
        })
      });

      if (response.ok) {
        const result = await response.json();
        setExecutionResult(result);
        await fetchExecutions();
      }
    } catch (error) {
      console.error('Erro na execução:', error);
      setExecutionResult({ status: 'error', error: error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTools();
    fetchAgentTools();
    fetchExecutions();
    fetchStats();
  }, []);

  // Filtrar ferramentas
  const filteredTools = tools.filter(tool => {
    const matchesCategory = selectedCategory === 'all' || tool.category === selectedCategory;
    const matchesSearch = tool.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         tool.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const isToolAdded = (toolId: number) => {
    return agentTools.some(at => at.tool.id === toolId && at.is_enabled);
  };

  const formatExecutionTime = (ms?: number) => {
    if (!ms) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Gerenciador de Ferramentas Agno
        </h1>
        <p className="text-gray-600">
          Configure e gerencie ferramentas de IA para seus agentes
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'tools', label: 'Ferramentas', icon: Wrench },
            { id: 'executions', label: 'Execuções', icon: Activity },
            { id: 'stats', label: 'Estatísticas', icon: TrendingUp }
          ].map(tab => {
            const IconComponent = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`
                  flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm
                  ${activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                <IconComponent className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab: Ferramentas */}
      {activeTab === 'tools' && (
        <div>
          {/* Filtros */}
          <div className="mb-6 flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Buscar ferramentas..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              {categories.map(category => {
                const IconComponent = category.icon;
                return (
                  <button
                    key={category.value}
                    onClick={() => setSelectedCategory(category.value)}
                    className={`
                      flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                      ${selectedCategory === category.value
                        ? 'bg-blue-100 text-blue-700 border border-blue-300'
                        : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
                      }
                    `}
                  >
                    <IconComponent className="w-4 h-4" />
                    {category.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Lista de Ferramentas */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTools.map(tool => {
              const CategoryIcon = categoryIcons[tool.category] || Wrench;
              const added = isToolAdded(tool.id);

              return (
                <div key={tool.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <CategoryIcon className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{tool.display_name}</h3>
                        <p className="text-sm text-gray-500">{tool.category.replace('_', ' ')}</p>
                      </div>
                    </div>
                    {added && (
                      <div className="flex items-center gap-1 text-green-600 bg-green-100 px-2 py-1 rounded-full text-xs">
                        <CheckCircle className="w-3 h-3" />
                        Ativo
                      </div>
                    )}
                  </div>

                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                    {tool.description}
                  </p>

                  {tool.required_packages.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs text-gray-500 mb-2">Dependências:</p>
                      <div className="flex flex-wrap gap-1">
                        {tool.required_packages.map(pkg => (
                          <span key={pkg} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                            {pkg}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    {!added ? (
                      <button
                        onClick={() => {
                          setSelectedTool(tool);
                          setToolConfig({});
                          setShowConfigModal(true);
                        }}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Adicionar
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setSelectedTool(tool);
                          setExecutePrompt('');
                          setExecutionResult(null);
                          setShowExecuteModal(true);
                        }}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      >
                        <Play className="w-4 h-4" />
                        Testar
                      </button>
                    )}

                    <button className="px-3 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredTools.length === 0 && (
            <div className="text-center py-12">
              <Wrench className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Nenhuma ferramenta encontrada</p>
            </div>
          )}
        </div>
      )}

      {/* Tab: Execuções */}
      {activeTab === 'executions' && (
        <div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Histórico de Execuções</h3>
            </div>

            <div className="divide-y divide-gray-200">
              {executions.map(execution => (
                <div key={execution.id} className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className={`
                        w-2 h-2 rounded-full
                        ${execution.status === 'success' ? 'bg-green-500' : 'bg-red-500'}
                      `} />
                      <span className="font-medium text-gray-900">{execution.tool_name}</span>
                      <span className="text-sm text-gray-500">{execution.method_called}</span>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {formatExecutionTime(execution.execution_time_ms)}
                      </div>
                      <span>{new Date(execution.created_at).toLocaleString()}</span>
                    </div>
                  </div>

                  {execution.output_result && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-700 font-mono">
                        {execution.output_result.substring(0, 200)}
                        {execution.output_result.length > 200 && '...'}
                      </p>
                    </div>
                  )}

                  {execution.error_message && (
                    <div className="mt-3 p-3 bg-red-50 rounded-lg">
                      <p className="text-sm text-red-700">
                        <AlertCircle className="w-4 h-4 inline mr-2" />
                        {execution.error_message}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {executions.length === 0 && (
              <div className="text-center py-12">
                <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Nenhuma execução registrada</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Estatísticas */}
      {activeTab === 'stats' && stats && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cards de métricas */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Activity className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-sm font-medium text-gray-600">Total de Execuções</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.total_executions}</p>
            <p className="text-sm text-gray-500">Últimos {stats.period_days} dias</p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <span className="text-sm font-medium text-gray-600">Taxa de Sucesso</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.success_rate}%</p>
            <p className="text-sm text-gray-500">Execuções bem-sucedidas</p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Wrench className="w-5 h-5 text-purple-600" />
              </div>
              <span className="text-sm font-medium text-gray-600">Ferramentas Ativas</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{tools.filter(t => t.is_active).length}</p>
            <p className="text-sm text-gray-500">Disponíveis no sistema</p>
          </div>

          {/* Tabela de uso por ferramenta */}
          <div className="lg:col-span-3 bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Uso por Ferramenta</h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ferramenta
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Execuções
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tempo Médio
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {stats.tool_stats.map(stat => (
                    <tr key={stat.name}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-medium text-gray-900">{stat.display_name}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                        {stat.executions}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                        {formatExecutionTime(stat.avg_time_ms)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Configurar Ferramenta */}
      {showConfigModal && selectedTool && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Configurar {selectedTool.display_name}
              </h3>
              <button
                onClick={() => setShowConfigModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              <p className="text-gray-600 mb-4">{selectedTool.description}</p>

              {/* Configurações básicas */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">
                    Mostrar resultado da ferramenta
                  </label>
                  <input
                    type="checkbox"
                    checked={toolConfig.show_result !== false}
                    onChange={(e) => setToolConfig(prev => ({
                      ...prev,
                      show_result: e.target.checked
                    }))}
                    className="rounded border-gray-300"
                  />
                </div>

                {/* Configurações específicas baseadas no schema */}
                {selectedTool.name === 'yfinance' && (
                  <>
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-gray-700">
                        Preços de ações
                      </label>
                      <input
                        type="checkbox"
                        checked={toolConfig.stock_price !== false}
                        onChange={(e) => setToolConfig(prev => ({
                          ...prev,
                          stock_price: e.target.checked
                        }))}
                        className="rounded border-gray-300"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-gray-700">
                        Recomendações de analistas
                      </label>
                      <input
                        type="checkbox"
                        checked={toolConfig.analyst_recommendations !== false}
                        onChange={(e) => setToolConfig(prev => ({
                          ...prev,
                          analyst_recommendations: e.target.checked
                        }))}
                        className="rounded border-gray-300"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="flex gap-3 p-6 border-t border-gray-200">
              <button
                onClick={() => setShowConfigModal(false)}
                className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => addToolToAgent(selectedTool.id, toolConfig)}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Executar Agente */}
      {showExecuteModal && selectedTool && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Testar {selectedTool.display_name}
              </h3>
              <button
                onClick={() => setShowExecuteModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Prompt para o agente:
                </label>
                <textarea
                  value={executePrompt}
                  onChange={(e) => setExecutePrompt(e.target.value)}
                  placeholder="Digite um prompt que utilize esta ferramenta..."
                  className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {executionResult && (
                <div className="mb-4">
                  <h4 className="font-medium text-gray-900 mb-2">Resultado:</h4>
                  <div className={`
                    p-4 rounded-lg
                    ${executionResult.status === 'success' 
                      ? 'bg-green-50 border border-green-200' 
                      : 'bg-red-50 border border-red-200'
                    }
                  `}>
                    {executionResult.status === 'success' ? (
                      <div>
                        <p className="text-green-800 font-mono text-sm whitespace-pre-wrap">
                          {executionResult.response}
                        </p>
                        <div className="mt-2 text-xs text-green-600">
                          Tempo: {formatExecutionTime(executionResult.execution_time_ms)} |
                          Ferramentas: {executionResult.tools_used}
                        </div>
                      </div>
                    ) : (
                      <p className="text-red-800">{executionResult.error}</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 p-6 border-t border-gray-200">
              <button
                onClick={() => setShowExecuteModal(false)}
                className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Fechar
              </button>
              <button
                onClick={() => executeAgentWithTools(executePrompt)}
                disabled={!executePrompt.trim() || loading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Executando...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Executar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgnoToolsManager;