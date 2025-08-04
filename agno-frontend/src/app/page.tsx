// src/app/page.tsx - PÁGINA PRINCIPAL CORRIGIDA
'use client';

import React, { useState, useEffect } from 'react';
import {
  Bot, Settings, MessageSquare, Activity, Package,
  BarChart3, Plus, Terminal, User, Clock
} from 'lucide-react';
import AgnoChatInterface from '@/components/AgnoChatInterface';

// =============================================
// COMPONENTE PRINCIPAL DA PÁGINA
// =============================================
const AgnoMainPage = () => {
  // Estados principais
  const [activeTab, setActiveTab] = useState('chat');
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected');
  const [systemInfo, setSystemInfo] = useState<any>(null);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  // =============================================
  // FUNÇÕES UTILITÁRIAS
  // =============================================
  const testConnection = async () => {
    try {
      setConnectionStatus('connecting');

      const response = await fetch(`${API_BASE}/api/health`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        mode: 'cors'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setSystemInfo(data);
      setConnectionStatus('connected');
      console.log('✅ Sistema conectado:', data);
    } catch (error) {
      setConnectionStatus('disconnected');
      console.error('❌ Erro de conexão:', error);
    }
  };

  // =============================================
  // EFFECTS
  // =============================================
  useEffect(() => {
    // Testar conexão ao inicializar
    testConnection();
  }, []);

  // =============================================
  // COMPONENTE: INDICADOR DE CONEXÃO
  // =============================================
  const ConnectionIndicator = () => (
    <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
      connectionStatus === 'connected' 
        ? 'bg-green-100 text-green-700'
        : connectionStatus === 'connecting'
        ? 'bg-yellow-100 text-yellow-700 animate-pulse'
        : 'bg-red-100 text-red-700'
    }`}>
      <div className={`w-2 h-2 rounded-full ${
        connectionStatus === 'connected' ? 'bg-green-500' :
        connectionStatus === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'
      }`} />
      <span>
        {connectionStatus === 'connected' ? 'Conectado' :
         connectionStatus === 'connecting' ? 'Conectando...' : 'Desconectado'}
      </span>
    </div>
  );

  // =============================================
  // COMPONENTE: VISÃO GERAL DO SISTEMA
  // =============================================
  const SystemOverview = () => (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card de Status */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Activity className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Status do Sistema</p>
              <p className="text-lg font-semibold text-gray-900">
                {connectionStatus === 'connected' ? 'Online' : 'Offline'}
              </p>
            </div>
          </div>
        </div>

        {/* Card de Versão */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Settings className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Versão</p>
              <p className="text-lg font-semibold text-gray-900">
                {systemInfo?.version || '4.2.0'}
              </p>
            </div>
          </div>
        </div>

        {/* Card de Framework */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Package className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Framework</p>
              <p className="text-lg font-semibold text-gray-900">
                {systemInfo?.agno_framework ? 'Agno Real' : 'FastAPI'}
              </p>
            </div>
          </div>
        </div>

        {/* Card de Ferramentas */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <BarChart3 className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Ferramentas</p>
              <p className="text-lg font-semibold text-gray-900">
                {systemInfo?.total_tools || '5'} Ativas
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Informações detalhadas do sistema */}
      {systemInfo && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Informações do Sistema</h3>
          <div className="bg-gray-50 rounded-lg p-4">
            <pre className="text-sm text-gray-700 overflow-x-auto">
              {JSON.stringify(systemInfo, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );

  // =============================================
  // RENDER PRINCIPAL
  // =============================================
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-4">
              <Bot className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Agno Platform
                </h1>
                <p className="text-sm text-gray-500">
                  Interface completa para testes e chat com IA
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <ConnectionIndicator />
              <button
                onClick={testConnection}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                title="Reconectar"
              >
                <Activity className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {[
              { id: 'overview', name: 'Visão Geral', icon: BarChart3 },
              { id: 'chat', name: 'Chat Interface', icon: MessageSquare },
              { id: 'agents', name: 'Agentes', icon: Bot },
              { id: 'tools', name: 'Ferramentas', icon: Package },
              { id: 'logs', name: 'Logs', icon: Terminal }
            ].map(tab => {
              const IconComponent = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <IconComponent className="w-4 h-4" />
                  {tab.name}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Content Area */}
      <main className="max-w-7xl mx-auto">
        {activeTab === 'overview' && <SystemOverview />}

        {activeTab === 'chat' && (
          <div className="h-[calc(100vh-140px)]">
            <AgnoChatInterface />
          </div>
        )}

        {activeTab === 'agents' && (
          <div className="p-6">
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <Bot className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Gerenciamento de Agentes</h3>
              <p className="text-gray-500 mb-4">
                Visualize e gerencie seus agentes IA aqui. Use a aba "Chat Interface" para interagir com eles.
              </p>
              <button
                onClick={() => setActiveTab('chat')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Ir para Chat
              </button>
            </div>
          </div>
        )}

        {activeTab === 'tools' && (
          <div className="p-6">
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Ferramentas do Sistema</h3>
              <p className="text-gray-500 mb-4">
                Configure e monitore as ferramentas disponíveis para os agentes.
              </p>
              <div className="text-sm text-gray-600">
                <p>✅ Web Search - Busca na internet</p>
                <p>✅ Code Interpreter - Execução de código</p>
                <p>✅ Calculator - Calculadora avançada</p>
                <p>✅ File Handler - Manipulação de arquivos</p>
                <p>✅ API Caller - Chamadas de API</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="p-6">
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <Terminal className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Logs do Sistema</h3>
              <p className="text-gray-500 mb-4">
                Monitore os logs do sistema em tempo real. Verifique o console do navegador para logs detalhados.
              </p>
              <p className="text-xs text-gray-400">
                Pressione F12 no navegador para abrir o console e ver os logs em tempo real
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AgnoMainPage;