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
   Cpu,
   AlertCircle,
   Download
 } from 'lucide-react';

 import EnhancedWorkflowBuilder from '../components/EnhancedWorkflowBuilder';
 import AgnoManagementInterface from '../components/AgnoManagementInterface';
 import AgnoChatInterface from '../components/AgnoChatInterface';

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

 /**
  * Página principal da aplicação. Nesta versão o estado `currentView` controla
  * qual módulo da aplicação deve ser exibido. Os cartões de ação chamam
  * setCurrentView() dentro de um manipulador de clique (`onClick`), e abaixo
  * há uma renderização condicional do componente correspondente.
  */
 const AgnoModernHomepage: React.FC = () => {
   const [currentView, setCurrentView] = useState<'dashboard' | 'workflow' | 'team' | 'chat'>('dashboard');
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
     { name: 'Web Search', icon: <Search className="w-6 h-6" />, description: 'Busca em tempo real na internet', category: 'data' },
     { name: 'Database Query', icon: <Database className="w-6 h-6" />, description: 'Consultas SQL inteligentes', category: 'data' },
     { name: 'Email Processing', icon: <Mail className="w-6 h-6" />, description: 'Análise e resposta de emails', category: 'communication' },
     { name: 'Calendar Management', icon: <Calendar className="w-6 h-6" />, description: 'Agendamento inteligente', category: 'productivity' },
     { name: 'Code Generation', icon: <Code className="w-6 h-6" />, description: 'Geração de código em múltiplas linguagens', category: 'development' },
     { name: 'Image Analysis', icon: <Image className="w-6 h-6" />, description: 'Processamento e análise de imagens', category: 'media' },
     { name: 'Voice Processing', icon: <Mic className="w-6 h-6" />, description: 'Transcrição e síntese de voz', category: 'media' },
     { name: 'API Integration', icon: <Globe className="w-6 h-6" />, description: 'Integração com APIs externas', category: 'integration' }
   ]);

   // Atualiza métricas a cada 5 segundos para simular dados em tempo real
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

   // Renderização condicional: mostra a view correta conforme currentView
   if (currentView === 'workflow') {
     return (
       <div className="p-4">
         <button
           onClick={() => setCurrentView('dashboard')}
           className="mb-4 text-blue-600 underline"
         >
           ← Voltar ao dashboard
         </button>
         <EnhancedWorkflowBuilder
           agents={[]}
           templates={[]}
           onSaveWorkflow={async () => Promise.resolve('')}
           onExecuteWorkflow={async () => Promise.resolve('')}
           onLoadTemplate={async () => Promise.resolve('')}
         />
       </div>
     );
   }

   if (currentView === 'team') {
     return (
       <div className="p-4">
         <button
           onClick={() => setCurrentView('dashboard')}
           className="mb-4 text-blue-600 underline"
         >
           ← Voltar ao dashboard
         </button>
         <AgnoManagementInterface />
       </div>
     );
   }

   if (currentView === 'chat') {
     return (
       <div className="p-4">
         <button
           onClick={() => setCurrentView('dashboard')}
           className="mb-4 text-blue-600 underline"
         >
           ← Voltar ao dashboard
         </button>
         <AgnoChatInterface />
       </div>
     );
   }

   // Dashboard principal
   return (
     <div className="p-8 space-y-16">
       {/* Cabeçalho */}
       <header className="flex flex-col items-center space-y-4 text-center">
         <h1 className="text-4xl font-bold">Agno Platform</h1>
         <p className="text-gray-600">Multi-Agent AI Platform</p>
         <span className="inline-block px-3 py-1 text-sm font-medium text-green-700 bg-green-100 rounded-full">
           Sistema Online
         </span>
       </header>

       {/* Seção Hero */}
       <section className="text-center max-w-3xl mx-auto space-y-4">
         <h2 className="text-3xl font-semibold">
           Bem-vindo ao futuro da&nbsp;
           <span className="text-blue-600">IA Multi‑Agente</span>
         </h2>
         <p className="text-lg text-gray-700">
           Crie, gerencie e orquestre workflows inteligentes com agentes especializados,
           ferramentas avançadas e RAG integrado para automatizar qualquer processo.
         </p>
       </section>

       {/* Cards de métricas */}
       <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
         <div className="p-4 bg-white rounded-xl shadow flex flex-col items-center">
           <Workflow className="w-6 h-6 text-blue-600 mb-2" />
           <span className="text-2xl font-semibold">{stats.workflows}</span>
           <span className="text-gray-500">Workflows Ativos</span>
           <span className="text-sm text-green-600">+12% este mês</span>
         </div>
         <div className="p-4 bg-white rounded-xl shadow flex flex-col items-center">
           <Users className="w-6 h-6 text-green-600 mb-2" />
           <span className="text-2xl font-semibold">{stats.teams}</span>
           <span className="text-gray-500">Teams Colaborativos</span>
           <span className="text-sm text-green-600">+3 novos hoje</span>
         </div>
         <div className="p-4 bg-white rounded-xl shadow flex flex-col items-center">
           <Bot className="w-6 h-6 text-purple-600 mb-2" />
           <span className="text-2xl font-semibold">{stats.agents}</span>
           <span className="text-gray-500">Assistentes IA</span>
           <span className="text-sm text-gray-500">Múltiplos modelos</span>
         </div>
         <div className="p-4 bg-white rounded-xl shadow flex flex-col items-center">
           <Activity className="w-6 h-6 text-pink-600 mb-2" />
           <span className="text-2xl font-semibold">{stats.executions_today}</span>
           <span className="text-gray-500">Execuções Hoje</span>
           <span className="text-sm text-gray-500">{stats.success_rate.toFixed(1)}% sucesso</span>
         </div>
       </section>

       {/* Cartões principais de ação */}
       <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
         <div className="p-6 bg-white rounded-xl shadow space-y-4">
           <div className="flex items-center gap-3">
             <GitBranch className="w-8 h-8 text-blue-600" />
             <h3 className="text-xl font-semibold">Workflow Builder</h3>
           </div>
           <p className="text-gray-600">
             Crie automações complexas com múltiplos agentes, condições e ferramentas integradas.
           </p>
           <button
             onClick={() => setCurrentView('workflow')}
             className="flex items-center gap-2 bg-white text-blue-600 px-6 py-3 rounded-xl font-semibold hover:bg-blue-50 transition-colors"
           >
             <Plus className="w-4 h-4" />
             Criar Workflow
           </button>
         </div>

         <div className="p-6 bg-white rounded-xl shadow space-y-4">
           <Users className="w-8 h-8 text-green-600" />
           <h3 className="text-xl font-semibold">Team Builder</h3>
           <p className="text-gray-600">
             Monte equipes de agentes especializados que trabalham em colaboração.
           </p>
           <button
             onClick={() => setCurrentView('team')}
             className="flex items-center gap-2 bg-white text-green-600 px-6 py-3 rounded-xl font-semibold hover:bg-green-50 transition-colors"
           >
             <Plus className="w-4 h-4" />
             Montar Team
           </button>
         </div>

         <div className="p-6 bg-white rounded-xl shadow space-y-4">
           <MessageSquare className="w-8 h-8 text-purple-600" />
           <h3 className="text-xl font-semibold">Chat Interface</h3>
           <p className="text-gray-600">
             Converse diretamente com seus agentes e veja ferramentas em ação em tempo real.
           </p>
           <button
             onClick={() => setCurrentView('chat')}
             className="flex items-center gap-2 bg-white text-purple-600 px-6 py-3 rounded-xl font-semibold hover:bg-purple-50 transition-colors"
           >
             <Plus className="w-4 h-4" />
             Iniciar Chat
           </button>
         </div>
       </section>

       {/* Performance em Tempo Real */}
       <section className="mt-12 space-y-6">
         <h3 className="text-2xl font-semibold">Performance em Tempo Real</h3>
         <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
           <div className="p-4 bg-white rounded-xl shadow">
             <span className="text-sm font-medium text-gray-600">Taxa de Sucesso</span>
             <div className="text-3xl font-semibold">{stats.success_rate.toFixed(1)}%</div>
           </div>
           <div className="p-4 bg-white rounded-xl shadow">
             <span className="text-sm font-medium text-gray-600">Tempo Médio de Resposta</span>
             <div className="text-3xl font-semibold">{stats.avg_response_time.toFixed(1)}s</div>
           </div>
           <div className="p-4 bg-white rounded-xl shadow">
             <span className="text-sm font-medium text-gray-600">Uptime do Sistema</span>
             <div className="text-3xl font-semibold">99.9%</div>
           </div>
         </div>
       </section>

       {/* Atividade Recente */}
       <section className="mt-12 space-y-4">
         <h3 className="text-2xl font-semibold">Atividade Recente</h3>
         <ul className="space-y-3">
           {recentActivity.map(activity => (
             <li
               key={activity.id}
               className={`flex items-center justify-between p-3 rounded-lg ${getStatusColor(activity.status)}`}
             >
               <div className="flex items-center gap-2">
                 {getStatusIcon(activity.status)}
                 <div className="font-medium">{activity.name}</div>
               </div>
               <div className="text-sm text-gray-600">
                 {activity.details} — {activity.timestamp}
               </div>
             </li>
           ))}
         </ul>
         <button className="text-blue-600 underline mt-2">Ver todas as atividades →</button>
       </section>

       {/* Ferramentas disponíveis */}
       <section className="mt-12 space-y-4">
         <h3 className="text-2xl font-semibold">Ferramentas Disponíveis</h3>
         <p className="text-gray-600">50+ ferramentas integradas</p>
         <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-4 gap-4">
           {availableTools.map(tool => (
             <div key={tool.name} className="p-4 bg-white rounded-lg shadow flex flex-col items-center space-y-2">
               {tool.icon}
               <span className="font-medium">{tool.name}</span>
               <span className="text-sm text-gray-600">{tool.description}</span>
             </div>
           ))}
         </div>
       </section>

       {/* Ações rápidas */}
       <section className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6">
         <div className="p-6 bg-white rounded-xl shadow flex flex-col space-y-2">
           <Plus className="w-6 h-6 text-blue-600" />
           <h4 className="font-semibold">Criar Novo Agente</h4>
           <p className="text-sm text-gray-600">Configure um assistente especializado</p>
           <button
             onClick={() => setCurrentView('team')}
             className="mt-2 text-blue-600 underline"
           >
             Começar
           </button>
         </div>
         <div className="p-6 bg-white rounded-xl shadow flex flex-col space-y-2">
           <Download className="w-6 h-6 text-green-600" />
           <h4 className="font-semibold">Importar Template</h4>
           <p className="text-sm text-gray-600">Use templates pré-configurados</p>
           <button className="mt-2 text-green-600 underline">Importar</button>
         </div>
         <div className="p-6 bg-white rounded-xl shadow flex flex-col space-y-2">
           <BarChart3 className="w-6 h-6 text-purple-600" />
           <h4 className="font-semibold">Ver Analytics</h4>
           <p className="text-sm text-gray-600">Métricas detalhadas de performance</p>
           <button className="mt-2 text-purple-600 underline">Ver Métricas</button>
         </div>
       </section>
     </div>
   );
 };

 export default AgnoModernHomepage;