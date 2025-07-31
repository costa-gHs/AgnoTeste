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
  GitBranch
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, BarChart, Bar } from 'recharts';

const AgnoMonitoring = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [timeRange, setTimeRange] = useState('24h');
  const [filterAgent, setFilterAgent] = useState('all');
  const [sessions, setSessions] = useState([]);
  const [metrics, setMetrics] = useState({});
  const [performanceData, setPerformanceData] = useState([]);
  const [usageData, setUsageData] = useState([]);

  // Mock data para demonstração
  useEffect(() => {
    // Métricas gerais
    setMetrics({
      totalSessions: 156,
      successRate: 94.2,
      avgResponseTime: 2.3,
      totalTokens: 45678,
      activeAgents: 8,
      totalWorkflows: 3,
      costToday: 12.45,
      errorsToday: 3
    });

    // Dados de performance ao longo do tempo
    setPerformanceData([
      { time: '00:00', responseTime: 1.8, tokens: 1200, sessions: 12, errors: 0 },
      { time: '04:00', responseTime: 2.1, tokens: 890, sessions: 8, errors: 1 },
      { time: '08:00', responseTime: 2.8, tokens: 2100, sessions: 25, errors: 0 },
      { time: '12:00', responseTime: 3.2, tokens: 3400, sessions: 35, errors: 1 },
      { time: '16:00', responseTime: 2.9, tokens: 2800, sessions: 28, errors: 0 },
      { time: '20:00', responseTime: 2.4, tokens: 1950, sessions: 22, errors: 1 }
    ]);

    // Uso por agente
    setUsageData([
      { name: 'Assistente de Pesquisa', sessions: 45, tokens: 12000, avgTime: 2.1, success: 96 },
      { name: 'Analista Financeiro', sessions: 38, tokens: 15000, avgTime: 3.2, success: 92 },
      { name: 'Marketing Specialist', sessions: 32, tokens: 8500, avgTime: 1.8, success: 98 },
      { name: 'Workflow Completo', sessions: 25, tokens: 18000, avgTime: 4.5, success: 88 },
      { name: 'Support Agent', sessions: 16, tokens: 6200, avgTime: 1.5, success: 100 }
    ]);

    // Sessões recentes
    setSessions([
      {
        id: 'sess_001',
        agent: 'Assistente de Pesquisa',
        user: 'user_123',
        startTime: '2025-01-28 14:30:25',
        duration: 125,
        tokens: 1250,
        status: 'success',
        messages: 8,
        cost: 0.15
      },
      {
        id: 'sess_002',
        agent: 'Analista Financeiro',
        user: 'user_456',
        startTime: '2025-01-28 14:28:10',
        duration: 203,
        tokens: 2100,
        status: 'success',
        messages: 12,
        cost: 0.28
      },
      {
        id: 'sess_003',
        agent: 'Marketing Specialist',
        user: 'user_789',
        startTime: '2025-01-28 14:25:45',
        duration: 95,
        tokens: 890,
        status: 'error',
        messages: 5,
        cost: 0.09,
        error: 'Rate limit exceeded'
      }
    ]);
  }, []);

  const MetricCard = ({ title, value, subtitle, icon: Icon, trend, color = 'blue' }) => {
    const colorClasses = {
      blue: 'bg-blue-50 text-blue-600',
      green: 'bg-green-50 text-green-600',
      yellow: 'bg-yellow-50 text-yellow-600',
      red: 'bg-red-50 text-red-600'
    };

    return (
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 mb-1">{title}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            {subtitle && (
              <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
            )}
          </div>
          <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
        {trend && (
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

  const SessionRow = ({ session }) => {
    const statusColor = {
      success: 'text-green-600 bg-green-50',
      error: 'text-red-600 bg-red-50',
      timeout: 'text-yellow-600 bg-yellow-50'
    };

    const StatusIcon = {
      success: CheckCircle,
      error: XCircle,
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
              <div className="text-sm text-gray-500">{session.startTime}</div>
            </div>
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="flex items-center">
            <Bot className="w-4 h-4 text-blue-500 mr-2" />
            <span className="text-sm text-gray-900">{session.agent}</span>
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="flex items-center">
            <User className="w-4 h-4 text-gray-400 mr-2" />
            <span className="text-sm text-gray-900">{session.user}</span>
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          {session.duration}s
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          {session.tokens.toLocaleString()}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          {session.messages}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          ${session.cost.toFixed(3)}
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          {session.error && (
            <div className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
              {session.error}
            </div>
          )}
        </td>
      </tr>
    );
  };

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
                <p className="text-sm text-gray-500">Performance e analytics dos seus agentes AI</p>
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

              <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2">
                <RefreshCw className="w-4 h-4" />
                Atualizar
              </button>

              <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-2">
                <Download className="w-4 h-4" />
                Exportar
              </button>
            </div>
          </div>

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
              Sessões
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
              Por Agente
            </button>
            <button
              onClick={() => setActiveTab('costs')}
              className={`${
                activeTab === 'costs'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
            >
              <PieChart className="w-4 h-4" />
              Custos
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
                value={metrics.totalSessions}
                subtitle="últimas 24h"
                icon={Activity}
                trend={12.5}
                color="blue"
              />
              <MetricCard
                title="Taxa de Sucesso"
                value={`${metrics.successRate}%`}
                subtitle="sessões bem-sucedidas"
                icon={CheckCircle}
                trend={2.1}
                color="green"
              />
              <MetricCard
                title="Tempo Médio"
                value={`${metrics.avgResponseTime}s`}
                subtitle="tempo de resposta"
                icon={Clock}
                trend={-5.3}
                color="yellow"
              />
              <MetricCard
                title="Custo Hoje"
                value={`$${metrics.costToday}`}
                subtitle="tokens consumidos"
                icon={TrendingUp}
                trend={8.7}
                color="red"
              />
            </div>

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

                <select
                  value={filterAgent}
                  onChange={(e) => setFilterAgent(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="all">Todos os agentes</option>
                  <option value="research">Assistente de Pesquisa</option>
                  <option value="finance">Analista Financeiro</option>
                  <option value="marketing">Marketing Specialist</option>
                </select>

                <select className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent">
                  <option value="all">Todos os status</option>
                  <option value="success">Sucesso</option>
                  <option value="error">Erro</option>
                  <option value="timeout">Timeout</option>
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
                      Mensagens
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Custo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Observações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sessions.map(session => (
                    <SessionRow key={session.id} session={session} />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginação */}
            <div className="flex items-center justify-between bg-white px-6 py-3 border border-gray-200 rounded-lg">
              <div className="text-sm text-gray-700">
                Exibindo <span className="font-medium">1</span> a <span className="font-medium">10</span> de{' '}
                <span className="font-medium">156</span> resultados
              </div>
              <div className="flex gap-2">
                <button className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50">
                  Anterior
                </button>
                <button className="px-3 py-1 bg-purple-600 text-white rounded text-sm">
                  1
                </button>
                <button className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50">
                  2
                </button>
                <button className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50">
                  Próximo
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Agents Tab */}
        {activeTab === 'agents' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Tabela de agentes */}
              <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance por Agente</h3>
                <div className="space-y-4">
                  {usageData.map((agent, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Bot className="w-4 h-4 text-blue-500" />
                          <span className="font-medium text-gray-900">{agent.name}</span>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          agent.success >= 95 ? 'bg-green-50 text-green-600' :
                          agent.success >= 90 ? 'bg-yellow-50 text-yellow-600' :
                          'bg-red-50 text-red-600'
                        }`}>
                          {agent.success}% sucesso
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <div className="text-gray-500">Sessões</div>
                          <div className="font-medium">{agent.sessions}</div>
                        </div>
                        <div>
                          <div className="text-gray-500">Tokens</div>
                          <div className="font-medium">{agent.tokens.toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-gray-500">Tempo Médio</div>
                          <div className="font-medium">{agent.avgTime}s</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Gráfico de uso */}
              <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Uso por Agente</h3>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={usageData} layout="horizontal" margin={{ left: 100 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={100} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="sessions" fill="#8884d8" name="Sessões" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* Costs Tab */}
        {activeTab === 'costs' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <MetricCard
                title="Custo Total (24h)"
                value={`$${metrics.costToday}`}
                subtitle="tokens consumidos"
                icon={TrendingUp}
                color="red"
              />
              <MetricCard
                title="Custo por Sessão"
                value="$0.08"
                subtitle="média das últimas 24h"
                icon={Activity}
                color="blue"
              />
              <MetricCard
                title="Economia vs GPT-4"
                value="23%"
                subtitle="usando modelos otimizados"
                icon={Zap}
                color="green"
              />
            </div>

            {/* Breakdown de custos por agente */}
            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Custos por Agente</h3>
              <div className="space-y-4">
                {usageData.map((agent, index) => {
                  const cost = (agent.tokens * 0.0001).toFixed(3);
                  return (
                    <div key={index} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Bot className="w-5 h-5 text-blue-500" />
                        <div>
                          <div className="font-medium text-gray-900">{agent.name}</div>
                          <div className="text-sm text-gray-500">{agent.tokens.toLocaleString()} tokens</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-gray-900">${cost}</div>
                        <div className="text-sm text-gray-500">{agent.sessions} sessões</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AgnoMonitoring;