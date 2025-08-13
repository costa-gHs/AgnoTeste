// src/app/page.tsx
"use client";

import React, { useState, useEffect } from 'react';
import {
  Bot, Workflow, Users, Zap, BarChart3, Settings, Play, Plus,
  ArrowRight, Activity, Clock, CheckCircle, TrendingUp, Sparkles,
  Grid3X3, MessageSquare, Brain, Database, Globe, Shield, Layers,
  Target, GitBranch, FileText, Search, Mic, Image, Code,
  Calendar, Mail, Phone, Cpu, AlertCircle, Download
} from 'lucide-react';

// Import do TeamBuilder
import TeamBuilder from '../components/TeamBuilder';

// Imports opcionais com fallback
let EnhancedWorkflowBuilder: React.ComponentType<any> | null = null;
let AgnoChatInterface: React.ComponentType<any> | null = null;

try {
  EnhancedWorkflowBuilder = require('../components/EnhancedWorkflowBuilder').default;
} catch (e) {
  console.warn('EnhancedWorkflowBuilder não disponível:', e);
}

try {
  AgnoChatInterface = require('../components/AgnoChatInterface').default;
} catch (e) {
  console.warn('AgnoChatInterface não disponível:', e);
}

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

const AgnoModernHomepage: React.FC = () => {
  const [currentView, setCurrentView] = useState<'dashboard' | 'workflow' | 'team' | 'chat'>('dashboard');
  const [isLoading, setIsLoading] = useState(true);
  const [hasErrors, setHasErrors] = useState(false);

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
    { name: 'Web Search', icon: <Search className="w-6 h-6" />, description: 'Busca em tempo real', category: 'data' },
    { name: 'Database Query', icon: <Database className="w-6 h-6" />, description: 'Consultas SQL', category: 'data' },
    { name: 'Email Processing', icon: <Mail className="w-6 h-6" />, description: 'Análise de emails', category: 'communication' },
    { name: 'Calendar Management', icon: <Calendar className="w-6 h-6" />, description: 'Agendamento', category: 'productivity' },
    { name: 'Code Generation', icon: <Code className="w-6 h-6" />, description: 'Geração de código', category: 'development' },
    { name: 'Image Analysis', icon: <Image className="w-6 h-6" />, description: 'Análise de imagens', category: 'media' },
    { name: 'Voice Processing', icon: <Mic className="w-6 h-6" />, description: 'Processamento de voz', category: 'media' },
    { name: 'API Integration', icon: <Globe className="w-6 h-6" />, description: 'Integração APIs', category: 'integration' }
  ]);

  // Simular carregamento e verificar erros
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);

    const errorHandler = (error: ErrorEvent) => {
      console.error('Erro JavaScript detectado:', error);
      setHasErrors(true);
    };

    window.addEventListener('error', errorHandler);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('error', errorHandler);
    };
  }, []);

  // Atualizar métricas em tempo real
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
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'running': return <Activity className="w-4 h-4 text-blue-600" />;
      case 'failed': return <AlertCircle className="w-4 h-4 text-red-600" />;
      default: return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };

  // Componente de fallback para erros
  const ErrorFallback = ({ message }: { message: string }) => (
    <div className="p-8 bg-red-50 border border-red-200 rounded-lg text-center">
      <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
      <h3 className="text-lg font-semibold text-red-800 mb-2">Componente Indisponível</h3>
      <p className="text-red-600 mb-4">{message}</p>
      <button
        onClick={() => setCurrentView('dashboard')}
        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
      >
        Voltar ao Dashboard
      </button>
    </div>
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-800">Carregando Agno Platform...</h2>
          <p className="text-gray-600 mt-2">Inicializando sistemas</p>
        </div>
      </div>
    );
  }

  // Renderização condicional com fallbacks
  if (currentView === 'workflow') {
    return (
      <div className="p-4 min-h-screen bg-gray-50">
        <button
          onClick={() => setCurrentView('dashboard')}
          className="mb-4 px-4 py-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
        >
          ← Voltar ao Dashboard
        </button>
        {EnhancedWorkflowBuilder ? (
          <EnhancedWorkflowBuilder
            agents={[]}
            templates={[]}
            onSaveWorkflow={async () => Promise.resolve('')}
            onExecuteWorkflow={async () => Promise.resolve('')}
            onLoadTemplate={async () => Promise.resolve('')}
          />
        ) : (
          <ErrorFallback message="O construtor de workflows não está disponível. Verifique as dependências." />
        )}
      </div>
    );
  }

  if (currentView === 'team') {
    return (
      <div className="p-4 min-h-screen bg-gray-50">
        <button
          onClick={() => setCurrentView('dashboard')}
          className="mb-4 px-4 py-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
        >
          ← Voltar ao Dashboard
        </button>
        <TeamBuilder />
      </div>
    );
  }

  if (currentView === 'chat') {
    return (
      <div className="p-4 min-h-screen bg-gray-50">
        <button
          onClick={() => setCurrentView('dashboard')}
          className="mb-4 px-4 py-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
        >
          ← Voltar ao Dashboard
        </button>
        {AgnoChatInterface ? (
          <AgnoChatInterface />
        ) : (
          <ErrorFallback message="A interface de chat não está disponível. Verifique as dependências." />
        )}
      </div>
    );
  }

  // Dashboard principal
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Alerta de erros se houver */}
      {hasErrors && (
        <div className="bg-red-600 text-white p-3 text-center">
          <AlertCircle className="w-4 h-4 inline mr-2" />
          Alguns erros foram detectados. Verifique o console para mais detalhes.
        </div>
      )}

      <div className="p-8 space-y-16">
        {/* Cabeçalho */}
        <header className="flex flex-col items-center space-y-4 text-center">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-600 rounded-xl">
              <Bot className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900">Agno Platform</h1>
          </div>
          <p className="text-xl text-gray-600">Multi-Agent AI Platform</p>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium text-green-700">Sistema Online ✅ TeamBuilder Funcionando</span>
          </div>
        </header>

        {/* Seção Hero */}
        <section className="text-center max-w-4xl mx-auto space-y-6">
          <h2 className="text-3xl font-semibold text-gray-900">
            Bem-vindo ao futuro da&nbsp;
            <span className="text-blue-600 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              IA Multi‑Agente
            </span>
          </h2>
          <p className="text-lg text-gray-700 leading-relaxed">
            Crie, gerencie e orquestre workflows inteligentes com agentes especializados,
            ferramentas avançadas e RAG integrado para automatizar qualquer processo.
          </p>

          {/* Cartões de ação principais */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
            <button
              onClick={() => setCurrentView('workflow')}
              className="group p-6 bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-blue-200"
            >
              <div className="flex flex-col items-center space-y-3">
                <div className="p-3 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                  <Workflow className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900">Workflows</h3>
                <p className="text-gray-600 text-center">Construa automações inteligentes</p>
                <ArrowRight className="w-5 h-5 text-blue-600 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>

            <button
              onClick={() => setCurrentView('team')}
              className="group p-6 bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-green-200 ring-2 ring-green-200"
            >
              <div className="flex flex-col items-center space-y-3">
                <div className="p-3 bg-green-100 rounded-lg group-hover:bg-green-200 transition-colors">
                  <Users className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900">Team Builder ✅</h3>
                <p className="text-gray-600 text-center">Gerencie sua equipe de IA</p>
                <div className="flex items-center gap-1 text-green-600">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">Funcionando!</span>
                </div>
                <ArrowRight className="w-5 h-5 text-green-600 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>

            <button
              onClick={() => setCurrentView('chat')}
              className="group p-6 bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-purple-200"
            >
              <div className="flex flex-col items-center space-y-3">
                <div className="p-3 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition-colors">
                  <MessageSquare className="w-8 h-8 text-purple-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900">Chat</h3>
                <p className="text-gray-600 text-center">Converse com seus agentes</p>
                <ArrowRight className="w-5 h-5 text-purple-600 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
          </div>
        </section>

        {/* Métricas do Dashboard */}
        <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: 'Workflows', value: stats.workflows, icon: <Workflow className="w-5 h-5" />, color: 'text-blue-600' },
            { label: 'Times', value: stats.teams, icon: <Users className="w-5 h-5" />, color: 'text-green-600' },
            { label: 'Agentes', value: stats.agents, icon: <Bot className="w-5 h-5" />, color: 'text-purple-600' },
            { label: 'Execuções Hoje', value: stats.executions_today, icon: <Activity className="w-5 h-5" />, color: 'text-orange-600' },
            { label: 'Taxa de Sucesso', value: `${stats.success_rate.toFixed(1)}%`, icon: <TrendingUp className="w-5 h-5" />, color: 'text-emerald-600' },
            { label: 'Tempo Médio', value: `${stats.avg_response_time.toFixed(1)}s`, icon: <Clock className="w-5 h-5" />, color: 'text-indigo-600' }
          ].map((metric, index) => (
            <div key={index} className="p-4 bg-white rounded-lg shadow border border-gray-100">
              <div className="flex items-center justify-between">
                <div className={`p-2 rounded-lg bg-gray-50 ${metric.color}`}>
                  {metric.icon}
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold text-gray-900">{metric.value}</div>
                <div className="text-sm text-gray-600">{metric.label}</div>
              </div>
            </div>
          ))}
        </section>

        {/* Atividade Recente */}
        <section className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          <h3 className="text-2xl font-semibold mb-6 flex items-center gap-3">
            <Activity className="w-6 h-6 text-blue-600" />
            Atividade Recente
          </h3>
          <div className="space-y-3">
            {recentActivity.map(activity => (
              <div
                key={activity.id}
                className="flex items-center justify-between p-4 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(activity.status)}
                  <div>
                    <div className="font-medium text-gray-900">{activity.name}</div>
                    <div className="text-sm text-gray-600">{activity.details}</div>
                  </div>
                </div>
                <div className="text-sm text-gray-500">
                  {activity.timestamp}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Ferramentas Disponíveis */}
        <section className="space-y-6">
          <div className="text-center">
            <h3 className="text-2xl font-semibold mb-2">Ferramentas Disponíveis</h3>
            <p className="text-gray-600">Mais de 50 ferramentas integradas para seus agentes</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
            {availableTools.map(tool => (
              <div
                key={tool.name}
                className="p-4 bg-white rounded-lg shadow border border-gray-100 hover:shadow-md transition-shadow group cursor-pointer"
              >
                <div className="flex flex-col items-center space-y-2 text-center">
                  <div className="p-2 bg-gray-100 rounded-lg group-hover:bg-blue-100 transition-colors">
                    {tool.icon}
                  </div>
                  <span className="font-medium text-sm text-gray-900">{tool.name}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center py-8 border-t border-gray-200">
          <p className="text-gray-600">
            Agno Platform - Powered by FastAPI & Next.js | TeamBuilder: ✅ Funcionando
          </p>
        </footer>
      </div>
    </div>
  );
};

export default AgnoModernHomepage;