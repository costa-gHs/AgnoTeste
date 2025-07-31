'use client'

import React, { useState } from 'react';
import {
  Bot,
  GitBranch,
  FileText,
  Settings,
  Menu,
  X,
  Home,
  BarChart3
} from 'lucide-react';

// Importar os componentes existentes
import AgnoManagementInterface from '@/components/AgnoManagementInterface';
import AgentTemplates from '@/components/AgentTemplates';
import WorkflowBuilder from '@/components/WorkflowBuilder';
import AgnoMonitoring from '@/components/AgnoMonitoring';

export default function HomePage() {
  const [activeView, setActiveView] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [user] = useState({
    name: 'Usuário Admin',
    email: 'admin@agno.ai',
    avatar: null
  });

  const navigationItems = [
    {
      id: 'dashboard',
      name: 'Dashboard',
      icon: Home,
      component: AgnoManagementInterface
    },
    {
      id: 'templates',
      name: 'Templates',
      icon: FileText,
      component: AgentTemplates
    },
    {
      id: 'workflows',
      name: 'Workflow Builder',
      icon: GitBranch,
      component: WorkflowBuilder
    },
    {
      id: 'monitoring',
      name: 'Monitoramento',
      icon: BarChart3,
      component: AgnoMonitoring
    }
  ];

  const activeItem = navigationItems.find(item => item.id === activeView);
  const ActiveComponent = activeItem?.component;

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-16'} bg-white shadow-lg transition-all duration-300 flex flex-col`}>
        {/* Header do Sidebar */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            {sidebarOpen && (
              <div className="flex items-center gap-2">
                <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg text-white">
                  <Bot className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-gray-900">Agno Platform</h1>
                  <p className="text-xs text-gray-500">AI Agent Management</p>
                </div>
              </div>
            )}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Navegação */}
        <nav className="flex-1 p-4">
          <div className="space-y-2">
            {navigationItems.map((item) => {
              const IconComponent = item.icon;
              const isActive = activeView === item.id;
              
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveView(item.id)}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors
                    ${isActive 
                      ? 'bg-blue-50 text-blue-600 border border-blue-200' 
                      : 'text-gray-700 hover:bg-gray-50'
                    }
                  `}
                  title={!sidebarOpen ? item.name : undefined}
                >
                  <IconComponent className="w-5 h-5 flex-shrink-0" />
                  {sidebarOpen && (
                    <span className="font-medium">{item.name}</span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        {/* User Info */}
        <div className="p-4 border-t border-gray-200">
          <div className={`flex items-center gap-3 ${!sidebarOpen && 'justify-center'}`}>
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-medium text-sm">
              {user.name.charAt(0)}
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user.name}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {user.email}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {activeItem?.name || 'Dashboard'}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {activeView === 'dashboard' && 'Gerencie seus agentes e workflows'}
                {activeView === 'templates' && 'Crie e use templates para acelerar o desenvolvimento'}
                {activeView === 'workflows' && 'Construa workflows visuais com múltiplos agentes'}
                {activeView === 'monitoring' && 'Monitore performance e uso dos seus agentes'}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                <Settings className="w-5 h-5" />
              </button>
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-medium text-sm cursor-pointer">
                {user.name.charAt(0)}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto bg-gray-50">
          {ActiveComponent && <ActiveComponent />}
        </main>
      </div>
    </div>
  );
}