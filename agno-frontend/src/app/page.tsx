// src/app/page.tsx - PÁGINA PRINCIPAL MODERNA
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
  MessageSquare
} from 'lucide-react';

interface DashboardStats {
  workflows: number;
  teams: number;
  agents: number;
  executions_today: number;
}

interface RecentActivity {
  id: string;
  type: 'workflow' | 'team' | 'execution';
  name: string;
  timestamp: string;
  status: 'completed' | 'running' | 'failed';
}

const AgnoMainPage = () => {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats>({
    workflows: 0,
    teams: 0,
    agents: 0,
    executions_today: 0
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'error'>('connecting');

  // Carregar dados do dashboard
  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setConnectionStatus('connecting');

        // Simular carregamento de dados (substituir por chamadas reais da API)
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Mock data - substituir por dados reais
        setStats({
          workflows: 12,
          teams: 5,
          agents: 23,
          executions_today: 47
        });

        setRecentActivity([
          {
            id: '1',
            type: 'workflow',
            name: 'Análise de Dados Completa',
            timestamp: '2 min atrás',
            status: 'completed'
          },
          {
            id: '2',
            type: 'team',
            name: 'Equipe de Pesquisa',
            timestamp: '5 min atrás',
            status: 'running'
          },
          {
            id: '3',
            type: 'execution',
            name: 'Processamento de Relatório',
            timestamp: '10 min atrás',
            status: 'completed'
          }
        ]);

        setConnectionStatus('connected');
      } catch (error) {
        setConnectionStatus('error');
        console.error('Erro ao carregar dados:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100';
      case 'running': return 'text-blue-600 bg-blue-100';
      case 'failed': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'workflow': return <Workflow className="w-4 h-4" />;
      case 'team': return <Users className="w-4 h-4" />;
      case 'execution': return <Play className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando Agno Platform...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200/50 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Agno Platform</h1>
                <p className="text-sm text-gray-500">Multi-Agent Workflow Builder</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Status indicator */}
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
                connectionStatus === 'connected' 
                  ? 'bg-green-100 text-green-700'
                  : connectionStatus === 'connecting'
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-red-100 text-red-700'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  connectionStatus === 'connected' ? 'bg-green-500' :
                  connectionStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'
                }`} />
                {connectionStatus === 'connected' ? 'Sistema Online' :
                 connectionStatus === 'connecting' ? 'Conectando...' : 'Erro de Conexão'}
              </div>

              <button
                onClick={() => router.push('/settings')}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Bem-vindo de volta! 👋
          </h2>
          <p className="text-gray-600">
            Gerencie seus workflows multi-agente, teams colaborativos e automações inteligentes.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <button
            onClick={() => router.push('/workflows/builder')}
            className="group bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200 text-left"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                <Workflow className="w-6 h-6 text-blue-600" />
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Criar Workflow</h3>
            <p className="text-sm text-gray-600">
              Design workflows visuais com drag-and-drop
            </p>
          </button>

          <button
            onClick={() => router.push('/teams/builder')}
            className="group bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200 text-left"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition-colors">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-purple-600 transition-colors" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Criar Team</h3>
            <p className="text-sm text-gray-600">
              Configure equipes de agentes colaborativos
            </p>
          </button>

          <button
            onClick={() => router.push('/chat')}
            className="group bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200 text-left"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-green-100 rounded-lg group-hover:bg-green-200 transition-colors">
                <MessageSquare className="w-6 h-6 text-green-600" />
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-green-600 transition-colors" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Chat Interface</h3>
            <p className="text-sm text-gray-600">
              Converse diretamente com seus agentes
            </p>
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Workflows</p>
                <p className="text-2xl font-bold text-gray-900">{stats.workflows}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <Workflow className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center">
              <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
              <span className="text-sm text-green-600">+12% este mês</span>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Teams</p>
                <p className="text-2xl font-bold text-gray-900">{stats.teams}</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center">
              <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
              <span className="text-sm text-green-600">+8% este mês</span>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Agentes</p>
                <p className="text-2xl font-bold text-gray-900">{stats.agents}</p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-lg">
                <Bot className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center">
              <Sparkles className="w-4 h-4 text-blue-500 mr-1" />
              <span className="text-sm text-blue-600">5 ativos agora</span>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Execuções Hoje</p>
                <p className="text-2xl font-bold text-gray-900">{stats.executions_today}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <Zap className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center">
              <Clock className="w-4 h-4 text-gray-500 mr-1" />
              <span className="text-sm text-gray-600">Última: 2 min</span>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recent Activity */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Atividade Recente</h3>
                  <button
                    onClick={() => router.push('/activity')}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Ver tudo
                  </button>
                </div>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {recentActivity.map((activity) => (
                    <div key={activity.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                      <div className="p-2 bg-white rounded-lg shadow-sm">
                        {getActivityIcon(activity.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{activity.name}</p>
                        <p className="text-sm text-gray-500">{activity.timestamp}</p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(activity.status)}`}>
                        {activity.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Acesso Rápido</h3>
              </div>
              <div className="p-6">
                <div className="space-y-3">
                  <button
                    onClick={() => router.push('/workflows')}
                    className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <Grid3X3 className="w-5 h-5 text-gray-600" />
                    <span className="font-medium text-gray-900">Meus Workflows</span>
                  </button>

                  <button
                    onClick={() => router.push('/teams')}
                    className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <Users className="w-5 h-5 text-gray-600" />
                    <span className="font-medium text-gray-900">Meus Teams</span>
                  </button>

                  <button
                    onClick={() => router.push('/agents')}
                    className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <Bot className="w-5 h-5 text-gray-600" />
                    <span className="font-medium text-gray-900">Gerenciar Agentes</span>
                  </button>

                  <button
                    onClick={() => router.push('/analytics')}
                    className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <BarChart3 className="w-5 h-5 text-gray-600" />
                    <span className="font-medium text-gray-900">Analytics</span>
                  </button>
                </div>
              </div>
            </div>

            {/* System Status */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 mt-6">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Status do Sistema</h3>
              </div>
              <div className="p-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">API Status</span>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-sm font-medium text-green-600">Healthy</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Agno Framework</span>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-sm font-medium text-green-600">Connected</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Database</span>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-sm font-medium text-green-600">Online</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgnoMainPage;