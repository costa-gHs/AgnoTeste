// src/app/page.tsx - VERSÃO CORRIGIDA
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

// ✅ IMPORTS CORRETOS - apenas componentes que existem
import WorkflowBuilder from '@/components/WorkflowBuilder';
import TeamBuilder from '@/components/TeamBuilder';
import AgnoChatInterface from '@/components/AgnoChatInterface'; // ✅ Nome correto

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
  const [currentView, setCurrentView] = useState('dashboard'); // ✅ State para views
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
        await new Promise(resolve => setTimeout(resolve, 1000));

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
            name: 'Análise de Documentos',
            timestamp: '2 min atrás',
            status: 'completed'
          },
          {
            id: '2',
            type: 'team',
            name: 'Team de Marketing',
            timestamp: '5 min atrás',
            status: 'running'
          }
        ]);

        setConnectionStatus('connected');
      } catch (error) {
        setConnectionStatus('error');
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  // ✅ FUNÇÃO PARA RENDERIZAR VIEW ATUAL
  const renderCurrentView = () => {
    switch (currentView) {
      case 'workflows':
        return (
          <div className="h-screen bg-gray-50">
            <div className="p-4 bg-white border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setCurrentView('dashboard')}
                  className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
                >
                  <ArrowRight className="w-4 h-4 rotate-180" />
                  Voltar
                </button>
                <h1 className="text-xl font-semibold text-gray-900">Workflow Builder</h1>
              </div>
            </div>
            <WorkflowBuilder />
          </div>
        );

      case 'teams':
        return (
          <div className="h-screen bg-gray-50">
            <div className="p-4 bg-white border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setCurrentView('dashboard')}
                  className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
                >
                  <ArrowRight className="w-4 h-4 rotate-180" />
                  Voltar
                </button>
                <h1 className="text-xl font-semibold text-gray-900">Team Builder</h1>
              </div>
            </div>
            <TeamBuilder />
          </div>
        );

      case 'chat':
        return (
          <div className="h-screen bg-gray-50">
            <div className="p-4 bg-white border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setCurrentView('dashboard')}
                  className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
                >
                  <ArrowRight className="w-4 h-4 rotate-180" />
                  Voltar
                </button>
                <h1 className="text-xl font-semibold text-gray-900">Chat Interface</h1>
              </div>
            </div>
            <AgnoChatInterface />
          </div>
        );

      default:
        return renderDashboard();
    }
  };

  // ✅ DASHBOARD PRINCIPAL
  const renderDashboard = () => (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Bem-vindo ao Agno Platform! 👋
          </h1>
          <p className="text-gray-600">
            Gerencie seus workflows multi-agente, teams colaborativos e automações inteligentes.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <button
            onClick={() => setCurrentView('workflows')}
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
            onClick={() => setCurrentView('teams')}
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
            onClick={() => setCurrentView('chat')}
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

        {/* Recent Activity */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Atividade Recente</h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="p-2 bg-white rounded-lg shadow-sm">
                    {activity.type === 'workflow' && <Workflow className="w-5 h-5 text-blue-600" />}
                    {activity.type === 'team' && <Users className="w-5 h-5 text-purple-600" />}
                    {activity.type === 'execution' && <Zap className="w-5 h-5 text-green-600" />}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{activity.name}</h4>
                    <p className="text-sm text-gray-600">{activity.timestamp}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {activity.status === 'completed' && <CheckCircle className="w-5 h-5 text-green-600" />}
                    {activity.status === 'running' && <Activity className="w-5 h-5 text-blue-600" />}
                    {activity.status === 'failed' && <AlertCircle className="w-5 h-5 text-red-600" />}
                    <span className={`text-sm font-medium ${
                      activity.status === 'completed' ? 'text-green-600' :
                      activity.status === 'running' ? 'text-blue-600' : 'text-red-600'
                    }`}>
                      {activity.status === 'completed' ? 'Completo' :
                       activity.status === 'running' ? 'Executando' : 'Erro'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return <div>{renderCurrentView()}</div>;
};

export default AgnoMainPage;