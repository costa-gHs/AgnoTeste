import React, { useState, useEffect } from 'react';
import {
  Activity,
  Clock,
  Zap,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  BarChart3,
  PieChart,
  RefreshCw,
  Download,
  Filter,
  Search,
  Calendar,
  User,
  Bot,
  GitBranch,
  Loader,
  AlertCircle
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, BarChart, Bar } from 'recharts';

// Import do cliente Agno
import AgnoClient from './agnoClient';

const AgnoMonitoringReal = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [timeRange, setTimeRange] = useState('24h');
  const [sessions, setSessions] = useState([]);
  const [metrics, setMetrics] = useState({});
  const [performanceData, setPerformanceData] = useState([]);
  const [agents, setAgents] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // Cliente Agno
  const [agnoClient] = useState(() => new AgnoClient());

  // Carregar dados iniciais
  useEffect(() => {
    loadAllData();

    // Auto-refresh a cada 30 segundos
    const interval = setInterval(loadAllData, 30000);
    return () => clearInterval(interval);
  }, [timeRange]);

  const loadAllData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Carregar dados em paralelo
      const [
        metricsData,
        performanceResult,
        sessionsData,
        agentsData,
        workflowsData
      ] = await Promise.all([
        agnoClient.makeRequest('/api/metrics'),
        agnoClient.makeRequest(`/api/performance?hours=${timeRange === '24h' ? 24 : timeRange === '7d' ? 168 : 720}`),
        agnoClient.makeRequest('/api/sessions'),
        agnoClient.makeRequest('/api/agents'),
        agnoClient.makeRequest('/api/workflows')
      ]);

      setMetrics(metricsData);
      setPerformanceData(performanceResult.reverse()); // Mais recente primeiro
      setSessions(sessionsData);
      setAgents(agentsData);
      setWorkflows(workflowsData);
      setLastUpdate(new Date());

    } catch (err) {
      console.error('Erro ao carregar dados:', err);
      setError(`Erro ao carregar dados: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const formatTimeRange = (range) => {
    switch (range) {
      case '1h': return 'última hora';
      case '24h': return 'últimas 24h';
      case '7d': return 'últimos 7 dias';
      case '30d': return 'últimos 30 dias';
      default: return range;
    }
  };

  const MetricCard = ({ title, value, subtitle, icon: Icon, trend, color = 'blue', loading = false }) => {
    const colorClasses = {
      blue: 'bg-blue-50 text-blue-600',
      green: 'bg-green-50 text-green-600',
      yellow: 'bg-yellow-50 text-yellow-600',
      red: 'bg-red-50 text-red-600',
      purple: 'bg-purple-50 text-purple-600'
    };

    return (
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm text-gray-600 mb-1">{title}</p>
            {loading ? (
              <div className="flex items-center gap-2">
                <Loader className="w-4 h-4 animate-spin text-gray-400" />
                <span className="text-gray-400">Carregando...</span>
              </div>
            ) : (
              <>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
                {subtitle && (
                  <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
                )}
              </>
            )}
          </div>
          <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
        {trend && !loading && (
          <div className="mt-4 flex items-center">
            <TrendingUp className={`w-4 h-4 mr-1 ${trend > 0 ? 'text-green-500' : 'text-red-500'}`} />
            <span className={`text-sm font-medium ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {trend > 0 ? '+' : ''}{trend}%
            </span>
            <span className="text-sm text-gray-500 ml-1">vs ontem</span>
          </div>
        )}
      </div>
    );
  };

  const SessionRow = ({ session, index }) => {
    const statusColor = {
      completed: 'text-green-600 bg-green-50',
      error: 'text-red-600 bg-red-50',
      active: 'text-blue-600 bg-blue-50',
      timeout: 'text-yellow-600 bg-yellow-50'
    };

    const StatusIcon = {
      completed: CheckCircle,
      error: XCircle,
      active: Activity,
      timeout: AlertTriangle
    }[session.status];

    return (
      <tr className="hover:bg-gray-50">
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="flex items-center">
            <div className={`p-1 rounded-full ${statusColor[session.status]} mr-3`}>
              <StatusIcon className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-medium text-gray-900">{session.id}</div>
              <div className="text-sm text-gray-500">
                {new Date(session.start_time).toLocaleString('pt-BR')}
              </div>
            </div>
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="flex items-center">
            <Bot className="w-4 h-4 text-blue-500 mr-2" />
            <span className="text-sm text-gray-900">
              {agents.find(a => a.id.toString() === session.agent_id)?.nome || `Agente ${session.agent_id}`}
            </span>
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="flex items-center">
            <User className="w-4 h-4 text-gray-400 mr-2" />
            <span className="text-sm text-gray-900">user_{session.user_id}</span>
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          {session.duration ? `${session.duration.toFixed(1)}s` : 'N/A'}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          {session.tokens_used ? session.tokens_used.toLocaleString() : 'N/A'}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          {session.response_length || 0}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          ${((session.tokens_used || 0) * 0.0001).toFixed(3)}
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          {session.status === 'error' && (
            <div className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded max-w-xs truncate">
              Erro na execução
            </div>
          )}
        </td>
      </tr>
    );
  };

  if (loading && sessions.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Carregando Dashboard</h3>
          <p className="text-gray-500">Conectando com o backend Agno...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Activity className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Monitoramento Agno</h1>
                <p className="text-sm text-gray-500">
                  Performance e analytics em tempo real • Última atualização: {lastUpdate.toLocaleTimeString('pt-BR')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="1h">Última hora</option>
                <option value="24h">Últimas 24h</option>
                <option value="7d">Últimos 7 dias</option>
                <option value="30d">Últimos 30 dias</option>
              </select>

              <button
                onClick={loadAllData}
                disabled={loading}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </button>

              <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-2">
                <Download className="w-4 h-4" />
                Exportar
              </button>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm">{error}</span>
              <button
                onClick={() => setError(null)}
                className="ml-auto text-red-500 hover:text-red-700"
              >
                ×
              </button>
            </div>
          )}

          {/* Navigation Tabs */}
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('overview')}
              className={`${
                activeTab === 'overview'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
            >
              <BarChart3 className="w-4 h-4" />
              Visão Geral
            </button>
            <button
              onClick={() => setActiveTab('sessions')}
              className={`${
                activeTab === 'sessions'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
            >
              <Activity className="w-4 h-4" />
              Sessões ({sessions.length})
            </button>
            <button
              onClick={() => setActiveTab('agents')}
              className={`${
                activeTab === 'agents'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
            >
              <Bot className="w-4 h-4" />
              Agentes ({agents.length})
            </button>
            <button
              onClick={() => setActiveTab('performance')}
              className={`${
                activeTab === 'performance'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
            >
              <TrendingUp className="w-4 h-4" />
              Performance
            </button>
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Métricas principais */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <MetricCard
                title="Total de Sessões"
                value={metrics.total_sessions || 0}
                subtitle={formatTimeRange(timeRange)}
                icon={Activity}
                trend={12.5}
                color="blue"
                loading={loading}
              />
              <MetricCard
                title="Taxa de Sucesso"
                value={`${(metrics.success_rate || 0).toFixed(1)}%`}
                subtitle="sessões bem-sucedidas"
                icon={CheckCircle}
                trend={2.1}
                color="green"
                loading={loading}
              />
              <MetricCard
                title="Tempo Médio"
                value={`${(metrics.avg_response_time || 0).toFixed(1)}s`}
                subtitle="tempo de resposta"
                icon={Clock}
                trend={-5.3}
                color="yellow"
                loading={loading}
              />
              <MetricCard
                title="Tokens Usados"
                value={(metrics.total_tokens || 0).toLocaleString()}
                subtitle={`$${(metrics.cost_today || 0).toFixed(2)} em custos`}
                icon={Zap}
                trend={8.7}
                color="purple"
                loading={loading}
              />
            </div>

            {/* Status dos componentes */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Status do Sistema</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Backend API</span>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm font-medium text-green-600">Online</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Banco de Dados</span>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm font-medium text-green-600">Conectado</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Agentes Ativos</span>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span className="text-sm font-medium text-blue-600">{metrics.active_agents || 0}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Recursos</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Agentes Criados</span>
                    <span className="text-sm font-medium text-gray-900">{agents.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Workflows</span>
                    <span className="text-sm font-medium text-gray-900">{workflows.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Sessões Hoje</span>
                    <span className="text-sm font-medium text-gray-900">{sessions.length}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Últimas Atividades</h3>
                <div className="space-y-3">
                  {sessions.slice(0, 3).map((session, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <Bot className="w-4 h-4 text-blue-500" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          Sessão {session.id}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(session.start_time).toLocaleTimeString('pt-BR')}
                        </div>
                      </div>
                      <div className={`w-2 h-2 rounded-full ${
                        session.status === 'completed' ? 'bg-green-500' : 
                        session.status === 'error' ? 'bg-red-500' : 'bg-blue-500'
                      }`}></div>
                    </div>
                  ))}
                  {sessions.length === 0 && (
                    <div className="text-sm text-gray-500 text-center py-4">
                      Nenhuma atividade recente
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sessions Tab */}
        {activeTab === 'sessions' && (
          <div className="space-y-6">
            {/* Filtros */}
            <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar sessões..."
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                <select className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent">
                  <option value="all">Todos os agentes</option>
                  {agents.map(agent => (
                    <option key={agent.id} value={agent.id}>{agent.nome}</option>
                  ))}
                </select>

                <select className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent">
                  <option value="all">Todos os status</option>
                  <option value="completed">Sucesso</option>
                  <option value="error">Erro</option>
                  <option value="active">Ativo</option>
                </select>
              </div>
            </div>

            {/* Tabela de sessões */}
            <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Sessão
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Agente
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Usuário
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Duração
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tokens
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Resposta
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Custo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sessions.map((session, index) => (
                    <SessionRow key={session.id || index} session={session} index={index} />
                  ))}
                </tbody>
              </table>

              {sessions.length === 0 && (
                <div className="text-center py-12">
                  <Activity className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Nenhuma sessão encontrada
                  </h3>
                  <p className="text-gray-500">
                    As sessões aparecerão aqui quando os agentes forem utilizados.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Agents Tab */}
        {activeTab === 'agents' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {agents.map(agent => {
              // Calcular estatísticas do agente
              const agentSessions = sessions.filter(s => s.agent_id === agent.id.toString());
              const successRate = agentSessions.length > 0
                ? (agentSessions.filter(s => s.status === 'completed').length / agentSessions.length * 100).toFixed(1)
                : 0;
              const totalTokens = agentSessions.reduce((sum, s) => sum + (s.tokens_used || 0), 0);
              const avgDuration = agentSessions.length > 0
                ? (agentSessions.reduce((sum, s) => sum + (s.duration || 0), 0) / agentSessions.length).toFixed(1)
                : 0;

              return (
                <div key={agent.id} className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Bot className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{agent.nome}</h3>
                        <p className="text-sm text-gray-500">{agent.agent_role}</p>
                      </div>
                    </div>
                    <div className={`w-2 h-2 rounded-full ${
                      agent.is_active_agent ? 'bg-green-500' : 'bg-gray-400'
                    }`} />
                  </div>

                  <div className="space-y-3 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Taxa de Sucesso</span>
                      <span className={`font-medium ${
                        successRate >= 90 ? 'text-green-600' : 
                        successRate >= 70 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {successRate}%
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Sessões</span>
                      <span className="font-medium text-gray-900">{agentSessions.length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Tokens Usados</span>
                      <span className="font-medium text-gray-900">{totalTokens.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Tempo Médio</span>
                      <span className="font-medium text-gray-900">{avgDuration}s</span>
                    </div>
                  </div>

                  <div className="text-xs text-gray-500">
                    Modelo: {agent.empresa} - {agent.modelo}
                  </div>
                </div>
              );
            })}

            {agents.length === 0 && (
              <div className="col-span-full text-center py-12">
                <Bot className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Nenhum agente encontrado
                </h3>
                <p className="text-gray-500">
                  Crie agentes para vê-los aparecer aqui.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Performance Tab */}
        {activeTab === 'performance' && (
          <div className="space-y-8">
            {/* Gráficos de performance */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Tempo de Resposta</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={performanceData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="responseTime" stroke="#8884d8" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Uso de Tokens</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={performanceData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Area type="monotone" dataKey="tokens" stroke="#82ca9d" fill="#82ca9d" fillOpacity={0.3} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Atividade por período */}
            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Sessões e Erros por Período</h3>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="sessions" fill="#8884d8" name="Sessões" />
                  <Bar dataKey="errors" fill="#ff7300" name="Erros" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AgnoMonitoringReal;