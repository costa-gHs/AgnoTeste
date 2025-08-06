"use client";
import React, { useState, useEffect } from 'react';
import {
  Bot,
  Workflow,
  Users,
  Zap,
  BarChart3,
  Settings,
  Play,
  Plus,
  ArrowRight,
  Activity,
  Clock,
  CheckCircle,
  TrendingUp,
  Sparkles,
  Grid3X3,
  MessageSquare,
  Brain,
  Database,
  Globe,
  Shield,
  Layers,
  Target,
  GitBranch,
  FileText,
  Search,
  Mic,
  Image,
  Code,
  Calendar,
  Mail,
  Phone,
  Cpu
} from 'lucide-react';

interface DashboardStats {
  workflows: number;
  teams: number;
  agents: number;
  executions_today: number;
  success_rate: number;
  avg_response_time: number;
}

interface RecentActivity {
  id: string;
  type: 'workflow' | 'team' | 'execution' | 'agent';
  name: string;
  timestamp: string;
  status: 'completed' | 'running' | 'failed';
  details?: string;
}

interface Tool {
  name: string;
  icon: React.ReactNode;
  description: string;
  category: string;
}

const AgnoModernHomepage = () => {
  const [currentView, setCurrentView] = useState('dashboard');
  const [stats, setStats] = useState<DashboardStats>({
    workflows: 24,
    teams: 8,
    agents: 45,
    executions_today: 156,
    success_rate: 94.2,
    avg_response_time: 2.8
  });

  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([
    {
      id: '1',
      type: 'workflow',
      name: 'Análise de Sentimentos de Reviews',
      timestamp: '2 min atrás',
      status: 'completed',
      details: 'Processou 2.3k reviews'
    },
    {
      id: '2',
      type: 'team',
      name: 'Time de Customer Success',
      timestamp: '15 min atrás',
      status: 'running',
      details: 'Atendendo 12 tickets'
    },
    {
      id: '3',
      type: 'agent',
      name: 'Assistente de Vendas Pro',
      timestamp: '1 hora atrás',
      status: 'completed',
      details: 'Lead qualificado com sucesso'
    }
  ]);

  const [availableTools] = useState<Tool[]>([
    { name: 'Web Search', icon: <Search className="w-5 h-5" />, description: 'Busca em tempo real na internet', category: 'data' },
    { name: 'Database Query', icon: <Database className="w-5 h-5" />, description: 'Consultas SQL inteligentes', category: 'data' },
    { name: 'Email Processing', icon: <Mail className="w-5 h-5" />, description: 'Análise e resposta de emails', category: 'communication' },
    { name: 'Calendar Management', icon: <Calendar className="w-5 h-5" />, description: 'Agendamento inteligente', category: 'productivity' },
    { name: 'Code Generation', icon: <Code className="w-5 h-5" />, description: 'Geração de código em múltiplas linguagens', category: 'development' },
    { name: 'Image Analysis', icon: <Image className="w-5 h-5" />, description: 'Processamento e análise de imagens', category: 'media' },
    { name: 'Voice Processing', icon: <Mic className="w-5 h-5" />, description: 'Transcrição e síntese de voz', category: 'media' },
    { name: 'API Integration', icon: <Globe className="w-5 h-5" />, description: 'Integração com APIs externas', category: 'integration' }
  ]);

  // Simulação de dados em tempo real
  useEffect(() => {
    const interval = setInterval(() => {
      setStats(prev => ({
        ...prev,
        executions_today: prev.executions_today + Math.floor(Math.random() * 3),
        success_rate: 90 + Math.random() * 8,
        avg_response_time: 1.5 + Math.random() * 2
      }));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100';
      case 'running': return 'text-blue-600 bg-blue-100';
      case 'failed': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'running': return <Activity className="w-4 h-4 animate-pulse" />;
      case 'failed': return <AlertCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-2 rounded-xl">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Agno Platform</h1>
                <p className="text-xs text-gray-600">Multi-Agent AI Platform</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                Sistema Online
              </div>
              <button className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors">
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Bem-vindo ao futuro da
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent"> IA Multi-Agente</span>
          </h1>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            Crie, gerencie e orquestre workflows inteligentes com agentes especializados,
            ferramentas avançadas e RAG integrado para automatizar qualquer processo.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/50 shadow-sm hover:shadow-md transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-100 rounded-xl">
                <Workflow className="w-6 h-6 text-blue-600" />
              </div>
              <span className="text-2xl font-bold text-gray-900">{stats.workflows}</span>
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">Workflows Ativos</h3>
            <p className="text-sm text-gray-600">+12% este mês</p>
          </div>

          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/50 shadow-sm hover:shadow-md transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-green-100 rounded-xl">
                <Users className="w-6 h-6 text-green-600" />
              </div>
              <span className="text-2xl font-bold text-gray-900">{stats.teams}</span>
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">Teams Colaborativos</h3>
            <p className="text-sm text-gray-600">+3 novos hoje</p>
          </div>

          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/50 shadow-sm hover:shadow-md transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-purple-100 rounded-xl">
                <Bot className="w-6 h-6 text-purple-600" />
              </div>
              <span className="text-2xl font-bold text-gray-900">{stats.agents}</span>
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">Assistentes IA</h3>
            <p className="text-sm text-gray-600">Múltiplos modelos</p>
          </div>

          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/50 shadow-sm hover:shadow-md transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-orange-100 rounded-xl">
                <Zap className="w-6 h-6 text-orange-600" />
              </div>
              <span className="text-2xl font-bold text-gray-900">{stats.executions_today}</span>
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">Execuções Hoje</h3>
            <p className="text-sm text-gray-600">{stats.success_rate.toFixed(1)}% sucesso</p>
          </div>
        </div>

        {/* Main Action Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Workflow Builder */}
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl p-8 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
            <div className="relative z-10">
              <Workflow className="w-12 h-12 mb-6" />
              <h2 className="text-2xl font-bold mb-3">Workflow Builder</h2>
              <p className="text-blue-100 mb-6">
                Crie automações complexas com múltiplos agentes, condições e ferramentas integradas.
              </p>
              <button
                onClick={() => setCurrentView('workflow')}
                className="bg-white text-blue-600 px-6 py-3 rounded-xl font-semibold hover:bg-blue-50 transition-colors flex items-center gap-2"
              >
                Criar Workflow
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Team Builder */}
          <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-3xl p-8 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
            <div className="relative z-10">
              <Users className="w-12 h-12 mb-6" />
              <h2 className="text-2xl font-bold mb-3">Team Builder</h2>
              <p className="text-green-100 mb-6">
                Monte equipes de agentes especializados que trabalham em colaboração.
              </p>
              <button
                onClick={() => setCurrentView('team')}
                className="bg-white text-green-600 px-6 py-3 rounded-xl font-semibold hover:bg-green-50 transition-colors flex items-center gap-2"
              >
                Montar Team
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Chat Interface */}
          <div className="bg-gradient-to-br from-purple-500 to-violet-600 rounded-3xl p-8 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
            <div className="relative z-10">
              <MessageSquare className="w-12 h-12 mb-6" />
              <h2 className="text-2xl font-bold mb-3">Chat Interface</h2>
              <p className="text-purple-100 mb-6">
                Converse diretamente com seus agentes e veja ferramentas em ação em tempo real.
              </p>
              <button
                onClick={() => setCurrentView('chat')}
                className="bg-white text-purple-600 px-6 py-3 rounded-xl font-semibold hover:bg-purple-50 transition-colors flex items-center gap-2"
              >
                Iniciar Chat
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Performance Metrics */}
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/50">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Performance em Tempo Real</h2>
              <BarChart3 className="w-6 h-6 text-gray-600" />
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Taxa de Sucesso</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 transition-all duration-500"
                      style={{ width: `${stats.success_rate}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium text-gray-900">{stats.success_rate.toFixed(1)}%</span>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-600">Tempo Médio de Resposta</span>
                <span className="text-sm font-medium text-gray-900">{stats.avg_response_time.toFixed(1)}s</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-600">Uptime do Sistema</span>
                <span className="text-sm font-medium text-green-600">99.9%</span>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/50">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Atividade Recente</h2>
              <Activity className="w-6 h-6 text-gray-600" />
            </div>

            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${getStatusColor(activity.status)}`}>
                    {getStatusIcon(activity.status)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {activity.name}
                    </p>
                    <p className="text-xs text-gray-600">{activity.details}</p>
                  </div>
                  <span className="text-xs text-gray-500">{activity.timestamp}</span>
                </div>
              ))}
            </div>

            <button className="w-full mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium">
              Ver todas as atividades →
            </button>
          </div>
        </div>

        {/* Available Tools */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/50 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Ferramentas Disponíveis</h2>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Cpu className="w-4 h-4" />
              50+ ferramentas integradas
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
            {availableTools.map((tool) => (
              <div
                key={tool.name}
                className="group p-3 bg-gray-50 hover:bg-white rounded-xl transition-all duration-200 hover:shadow-md cursor-pointer"
                title={tool.description}
              >
                <div className="flex flex-col items-center text-center">
                  <div className="p-2 bg-white rounded-lg mb-2 group-hover:scale-110 transition-transform">
                    {tool.icon}
                  </div>
                  <span className="text-xs font-medium text-gray-700">{tool.name}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="bg-white/70 backdrop-blur-sm rounded-xl p-4 border border-white/50 hover:bg-white transition-all duration-300 flex items-center gap-3 text-left">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Plus className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Criar Novo Agente</h3>
              <p className="text-sm text-gray-600">Configure um assistente especializado</p>
            </div>
          </button>

          <button className="bg-white/70 backdrop-blur-sm rounded-xl p-4 border border-white/50 hover:bg-white transition-all duration-300 flex items-center gap-3 text-left">
            <div className="p-2 bg-green-100 rounded-lg">
              <GitBranch className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Importar Template</h3>
              <p className="text-sm text-gray-600">Use templates pré-configurados</p>
            </div>
          </button>

          <button className="bg-white/70 backdrop-blur-sm rounded-xl p-4 border border-white/50 hover:bg-white transition-all duration-300 flex items-center gap-3 text-left">
            <div className="p-2 bg-purple-100 rounded-lg">
              <BarChart3 className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Ver Analytics</h3>
              <p className="text-sm text-gray-600">Métricas detalhadas de performance</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AgnoModernHomepage;