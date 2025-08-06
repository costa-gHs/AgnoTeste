// src/components/EnhancedWorkflowBuilder.tsx

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Play, Bot, Zap, GitBranch, Timer, Code, MessageSquare, CheckCircle,
  Plus, Trash2, Settings, Save, Eye, Download, Upload, Copy,
  Workflow, Grid, MousePointer, Move, Maximize2, RotateCcw,
  AlertCircle, Clock, CheckCircle2, XCircle, Loader2
} from 'lucide-react';

interface NodeType {
  id: string;
  name: string;
  icon: React.ComponentType<any>;
  color: string;
  description: string;
  category: string;
  configurable?: boolean;
  maxInstances?: number;
}

interface Node {
  id: string;
  type: string;
  name: string;
  position: { x: number; y: number };
  config: {
    agentId?: string;
    role?: string;
    instructions?: string[];
    condition?: string;
    delay?: number;
    transformation?: string;
    message?: string;
    timeout?: number;
    retries?: number;
  };
  status: 'idle' | 'running' | 'completed' | 'failed';
  lastRun?: string;
  executionTime?: number;
}

interface Connection {
  id: string;
  from: string;
  to: string;
  condition?: string;
}

interface WorkflowExecution {
  id: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: string;
  completedAt?: string;
  steps: ExecutionStep[];
  inputData: any;
  outputData?: any;
  errorMessage?: string;
}

interface ExecutionStep {
  id: string;
  nodeId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: string;
  completedAt?: string;
  executionTime?: number;
  inputData?: any;
  outputData?: any;
  errorMessage?: string;
}

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  nodes: Node[];
  connections: Connection[];
  previewImage?: string;
  tags: string[];
  usageCount: number;
}

interface EnhancedWorkflowBuilderProps {
  agents: Array<{
    id: string;
    name: string;
    role: string;
    model_provider: string;
    model_id: string;
    tools: string[];
  }>;
  templates: Template[];
  onSaveWorkflow: (workflow: any) => Promise<void>;
  onExecuteWorkflow: (workflowId: string, inputData: any) => Promise<string>;
  onLoadTemplate: (templateId: string) => Promise<void>;
  existingWorkflow?: any;
}

const EnhancedWorkflowBuilder: React.FC<EnhancedWorkflowBuilderProps> = ({
  agents,
  templates,
  onSaveWorkflow,
  onExecuteWorkflow,
  onLoadTemplate,
  existingWorkflow
}) => {
  // Estados principais
  const [nodes, setNodes] = useState<Node[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStart, setConnectionStart] = useState<string | null>(null);

  // Estados da interface
  const [zoom, setZoom] = useState(1);
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Estados de configuração
  const [workflowConfig, setWorkflowConfig] = useState({
    name: 'Novo Workflow',
    description: '',
    version: '1.0.0'
  });

  // Estados de execução
  const [currentExecution, setCurrentExecution] = useState<WorkflowExecution | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionInput, setExecutionInput] = useState('');

  // Estados de interface
  const [showNodeConfig, setShowNodeConfig] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showExecutionPanel, setShowExecutionPanel] = useState(false);
  const [activeTab, setActiveTab] = useState<'design' | 'execute' | 'history'>('design');

  // Referencias
  const canvasRef = useRef<HTMLDivElement>(null);
  const executionIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Tipos de nós disponíveis
  const nodeTypes: NodeType[] = [
    {
      id: 'start',
      name: 'Início',
      icon: Play,
      color: 'bg-gradient-to-r from-green-500 to-emerald-500',
      description: 'Ponto de entrada do workflow',
      category: 'flow',
      maxInstances: 1
    },
    {
      id: 'agent',
      name: 'AI Agent',
      icon: Bot,
      color: 'bg-gradient-to-r from-blue-500 to-indigo-500',
      description: 'Agente individual com tools específicas',
      category: 'execution',
      configurable: true
    },
    {
      id: 'parallel',
      name: 'Gateway Paralelo',
      icon: Zap,
      color: 'bg-gradient-to-r from-yellow-500 to-orange-500',
      description: 'Executa múltiplos caminhos simultaneamente',
      category: 'flow',
      configurable: true
    },
    {
      id: 'condition',
      name: 'Decisão',
      icon: GitBranch,
      color: 'bg-gradient-to-r from-purple-500 to-pink-500',
      description: 'Lógica condicional baseada em resultados',
      category: 'logic',
      configurable: true
    },
    {
      id: 'delay',
      name: 'Pausa',
      icon: Timer,
      color: 'bg-gradient-to-r from-gray-500 to-slate-600',
      description: 'Introduz delay no workflow',
      category: 'utility',
      configurable: true
    },
    {
      id: 'transform',
      name: 'Transformador',
      icon: Code,
      color: 'bg-gradient-to-r from-teal-500 to-cyan-500',
      description: 'Processa e transforma dados',
      category: 'data',
      configurable: true
    },
    {
      id: 'notification',
      name: 'Notificação',
      icon: MessageSquare,
      color: 'bg-gradient-to-r from-rose-500 to-red-500',
      description: 'Envia notificações ou alertas',
      category: 'utility',
      configurable: true
    },
    {
      id: 'end',
      name: 'Fim',
      icon: CheckCircle,
      color: 'bg-gradient-to-r from-gray-600 to-gray-700',
      description: 'Ponto de saída do workflow',
      category: 'flow',
      maxInstances: 1
    }
  ];

  // Carregar workflow existente
  useEffect(() => {
    if (existingWorkflow) {
      setWorkflowConfig({
        name: existingWorkflow.name,
        description: existingWorkflow.description,
        version: '1.0.0'
      });

      if (existingWorkflow.visual_definition) {
        setNodes(existingWorkflow.visual_definition.nodes || []);
        setConnections(existingWorkflow.visual_definition.connections || []);
      }
    }
  }, [existingWorkflow]);

  // Funções de manipulação de nós
  const addNode = (type: NodeType) => {
    if (type.maxInstances && nodes.filter(n => n.type === type.id).length >= type.maxInstances) {
      return;
    }

    const canvasRect = canvasRef.current?.getBoundingClientRect();
    const defaultPosition = {
      x: canvasRect ? (canvasRect.width / 2) / zoom - canvasOffset.x / zoom - 60 : 200,
      y: canvasRect ? (canvasRect.height / 2) / zoom - canvasOffset.y / zoom - 40 : 300
    };

    const newNode: Node = {
      id: `node_${Date.now()}`,
      type: type.id,
      name: `${type.name} ${nodes.filter(n => n.type === type.id).length + 1}`,
      position: defaultPosition,
      config: {
        agentId: type.id === 'agent' ? (agents[0]?.id || null) : undefined,
        condition: type.id === 'condition' ? 'if (result.success) return "next"; else return "retry";' : undefined,
        delay: type.id === 'delay' ? 1000 : undefined,
        transformation: type.id === 'transform' ? 'return data.map(item => ({ ...item, processed: true }));' : undefined,
        message: type.id === 'notification' ? 'Processo concluído' : undefined,
        role: type.id === 'agent' ? '' : undefined,
        instructions: [''],
        timeout: 60,
        retries: 1
      },
      status: 'idle'
    };

    setNodes(prev => [...prev, newNode]);

    if (type.configurable) {
      setSelectedNode(newNode);
      setShowNodeConfig(true);
    }
  };

  const deleteNode = (nodeId: string) => {
    setNodes(prev => prev.filter(n => n.id !== nodeId));
    setConnections(prev => prev.filter(c => c.from !== nodeId && c.to !== nodeId));
    if (selectedNode?.id === nodeId) {
      setSelectedNode(null);
      setShowNodeConfig(false);
    }
  };

  const duplicateNode = (node: Node) => {
    const newNode: Node = {
      ...node,
      id: `node_${Date.now()}`,
      name: `${node.name} (Cópia)`,
      position: {
        x: node.position.x + 50,
        y: node.position.y + 50
      },
      status: 'idle',
      lastRun: undefined,
      executionTime: undefined
    };
    setNodes(prev => [...prev, newNode]);
  };

  // Funções de conexão
  const startConnection = (nodeId: string) => {
    setIsConnecting(true);
    setConnectionStart(nodeId);
  };

  const completeConnection = (toNodeId: string) => {
    if (connectionStart && connectionStart !== toNodeId) {
      const newConnection: Connection = {
        id: `conn_${Date.now()}`,
        from: connectionStart,
        to: toNodeId
      };

      setConnections(prev => [...prev, newConnection]);
    }

    setIsConnecting(false);
    setConnectionStart(null);
  };

  const deleteConnection = (connectionId: string) => {
    setConnections(prev => prev.filter(c => c.id !== connectionId));
  };

  // Funções de validação
  const validateWorkflow = () => {
    const errors: string[] = [];

    const startNodes = nodes.filter(n => n.type === 'start');
    if (startNodes.length === 0) {
      errors.push('Workflow deve ter um nó de início');
    }

    const endNodes = nodes.filter(n => n.type === 'end');
    if (endNodes.length === 0) {
      errors.push('Workflow deve ter um nó de fim');
    }

    const connectedNodes = new Set();
    connections.forEach(conn => {
      connectedNodes.add(conn.from);
      connectedNodes.add(conn.to);
    });

    const orphanNodes = nodes.filter(n =>
      n.type !== 'start' && n.type !== 'end' && !connectedNodes.has(n.id)
    );

    if (orphanNodes.length > 0) {
      errors.push(`${orphanNodes.length} nó(s) não conectado(s)`);
    }

    const incompleteNodes = nodes.filter(n => {
      if (n.type === 'agent' && !n.config.agentId) return true;
      if (n.type === 'condition' && !n.config.condition) return true;
      if (n.type === 'transform' && !n.config.transformation) return true;
      return false;
    });

    if (incompleteNodes.length > 0) {
      errors.push(`${incompleteNodes.length} nó(s) com configuração incompleta`);
    }

    return errors;
  };

  // Funções de execução
  const executeWorkflow = async () => {
    const errors = validateWorkflow();
    if (errors.length > 0) {
      alert('Erros de validação:\n' + errors.join('\n'));
      return;
    }

    setIsExecuting(true);
    setActiveTab('execute');
    setShowExecutionPanel(true);

    try {
      // Criar dados de entrada
      const inputData = {
        message: executionInput || 'Executar workflow',
        timestamp: new Date().toISOString()
      };

      // Salvar workflow primeiro se necessário
      const workflowData = {
        name: workflowConfig.name,
        description: workflowConfig.description,
        visual_definition: {
          nodes,
          connections,
          metadata: workflowConfig
        }
      };

      // Executar workflow
      const executionId = await onExecuteWorkflow('temp', inputData);

      // Criar execução mock para demonstração
      const mockExecution: WorkflowExecution = {
        id: executionId,
        status: 'running',
        startedAt: new Date().toISOString(),
        steps: nodes.map(node => ({
          id: `step_${node.id}`,
          nodeId: node.id,
          status: 'pending'
        })),
        inputData
      };

      setCurrentExecution(mockExecution);

      // Simular execução dos steps
      simulateExecution(mockExecution);

    } catch (error) {
      console.error('Erro na execução:', error);
      setIsExecuting(false);
    }
  };

  const simulateExecution = (execution: WorkflowExecution) => {
    let stepIndex = 0;
    const interval = setInterval(() => {
      if (stepIndex >= execution.steps.length) {
        setCurrentExecution(prev => prev ? {
          ...prev,
          status: 'completed',
          completedAt: new Date().toISOString()
        } : null);
        setIsExecuting(false);
        clearInterval(interval);
        return;
      }

      const step = execution.steps[stepIndex];
      const node = nodes.find(n => n.id === step.nodeId);

      // Atualizar status do step
      setCurrentExecution(prev => {
        if (!prev) return null;
        const updatedSteps = [...prev.steps];
        updatedSteps[stepIndex] = {
          ...step,
          status: 'running',
          startedAt: new Date().toISOString()
        };
        return { ...prev, steps: updatedSteps };
      });

      // Atualizar status do nó visual
      setNodes(prev => prev.map(n =>
        n.id === step.nodeId ? { ...n, status: 'running' } : n
      ));

      // Simular tempo de execução
      setTimeout(() => {
        setCurrentExecution(prev => {
          if (!prev) return null;
          const updatedSteps = [...prev.steps];
          updatedSteps[stepIndex] = {
            ...step,
            status: 'completed',
            completedAt: new Date().toISOString(),
            executionTime: Math.random() * 2000 + 500
          };
          return { ...prev, steps: updatedSteps };
        });

        setNodes(prev => prev.map(n =>
          n.id === step.nodeId ? { ...n, status: 'completed' } : n
        ));

        stepIndex++;
      }, Math.random() * 2000 + 1000);
    }, 500);

    executionIntervalRef.current = interval;
  };

  // Função para salvar workflow
  const saveWorkflow = async () => {
    const errors = validateWorkflow();
    if (errors.length > 0) {
      alert('Erros de validação:\n' + errors.join('\n'));
      return;
    }

    try {
      const workflowData = {
        name: workflowConfig.name,
        description: workflowConfig.description,
        visual_definition: {
          nodes,
          connections,
          metadata: workflowConfig
        }
      };

      await onSaveWorkflow(workflowData);
      alert('Workflow salvo com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert('Erro ao salvar workflow');
    }
  };

  // Renderização de nó
  const renderNode = (node: Node) => {
    const nodeType = nodeTypes.find(t => t.id === node.type);
    if (!nodeType) return null;

    const Icon = nodeType.icon;

    return (
      <div
        key={node.id}
        className={`absolute cursor-pointer select-none transition-all duration-200 ${
          selectedNode?.id === node.id ? 'scale-110 shadow-lg' : 'hover:scale-105'
        }`}
        style={{
          left: node.position.x,
          top: node.position.y,
          transform: `scale(${zoom})`
        }}
        onClick={() => {
          setSelectedNode(node);
          if (nodeType.configurable) {
            setShowNodeConfig(true);
          }
        }}
      >
        <div className={`
          relative w-24 h-24 rounded-xl ${nodeType.color} 
          shadow-md flex flex-col items-center justify-center text-white
          border-2 ${selectedNode?.id === node.id ? 'border-white' : 'border-transparent'}
          ${node.status === 'running' ? 'animate-pulse' : ''}
        `}>
          <Icon className="w-6 h-6 mb-1" />
          <span className="text-xs font-medium text-center px-1 leading-tight">
            {node.name.length > 10 ? node.name.substring(0, 10) + '...' : node.name}
          </span>

          {/* Status indicator */}
          <div className="absolute -top-1 -right-1">
            {node.status === 'running' && (
              <div className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse" />
            )}
            {node.status === 'completed' && (
              <div className="w-3 h-3 bg-green-400 rounded-full" />
            )}
            {node.status === 'failed' && (
              <div className="w-3 h-3 bg-red-400 rounded-full" />
            )}
          </div>

          {/* Connection points */}
          <div
            className="absolute w-3 h-3 bg-blue-500 rounded-full -right-1.5 top-1/2 transform -translate-y-1/2 cursor-crosshair hover:bg-blue-600"
            onClick={(e) => {
              e.stopPropagation();
              if (isConnecting) {
                completeConnection(node.id);
              } else {
                startConnection(node.id);
              }
            }}
          />

          <div
            className="absolute w-3 h-3 bg-blue-500 rounded-full -left-1.5 top-1/2 transform -translate-y-1/2 cursor-crosshair hover:bg-blue-600"
            onClick={(e) => {
              e.stopPropagation();
              if (isConnecting) {
                completeConnection(node.id);
              }
            }}
          />
        </div>
      </div>
    );
  };

  // Renderização de conexão
  const renderConnection = (connection: Connection) => {
    const fromNode = nodes.find(n => n.id === connection.from);
    const toNode = nodes.find(n => n.id === connection.to);

    if (!fromNode || !toNode) return null;

    const fromX = fromNode.position.x + 48; // Center of node (96/2)
    const fromY = fromNode.position.y + 48;
    const toX = toNode.position.x + 48;
    const toY = toNode.position.y + 48;

    const midX = (fromX + toX) / 2;
    const midY = (fromY + toY) / 2;

    return (
      <g key={connection.id}>
        <path
          d={`M ${fromX} ${fromY} Q ${midX} ${fromY} ${midX} ${midY} Q ${midX} ${toY} ${toX} ${toY}`}
          stroke="#6366f1"
          strokeWidth="2"
          fill="none"
          className="cursor-pointer hover:stroke-indigo-700"
          onClick={() => setSelectedConnection(connection)}
        />
        <circle
          cx={midX}
          cy={midY}
          r="4"
          fill="#6366f1"
          className="cursor-pointer hover:fill-indigo-700"
          onClick={() => deleteConnection(connection.id)}
        />
      </g>
    );
  };

  return (
    <div className="h-full flex bg-gray-50">
      {/* Sidebar esquerda - Paleta de nós */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Workflow className="w-5 h-5" />
            Enhanced Workflow Builder
          </h2>
        </div>

        {/* Configurações do workflow */}
        <div className="p-4 border-b border-gray-200">
          <input
            type="text"
            value={workflowConfig.name}
            onChange={(e) => setWorkflowConfig(prev => ({ ...prev, name: e.target.value }))}
            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-2"
            placeholder="Nome do workflow"
          />
          <textarea
            value={workflowConfig.description}
            onChange={(e) => setWorkflowConfig(prev => ({ ...prev, description: e.target.value }))}
            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            rows={2}
            placeholder="Descrição do workflow"
          />
        </div>

        {/* Paleta de nós por categoria */}
        <div className="flex-1 overflow-y-auto">
          {['flow', 'execution', 'logic', 'data', 'utility'].map(category => (
            <div key={category} className className="border-b border-gray-100">
              <div className="p-3 bg-gray-50 font-medium text-sm text-gray-700 uppercase tracking-wide">
                {category === 'flow' && 'Controle de Fluxo'}
                {category === 'execution' && 'Execução'}
                {category === 'logic' && 'Lógica'}
                {category === 'data' && 'Dados'}
                {category === 'utility' && 'Utilitários'}
              </div>
              <div className="p-2 space-y-2">
                {nodeTypes
                  .filter(type => type.category === category)
                  .map(type => {
                    const Icon = type.icon;
                    const isMaxed = type.maxInstances && nodes.filter(n => n.type === type.id).length >= type.maxInstances;

                    return (
                      <div
                        key={type.id}
                        className={`
                          p-3 rounded-lg border cursor-pointer transition-all
                          ${isMaxed 
                            ? 'bg-gray-100 border-gray-200 cursor-not-allowed opacity-50' 
                            : 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-sm'
                          }
                        `}
                        onClick={() => !isMaxed && addNode(type)}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg ${type.color} flex items-center justify-center`}>
                            <Icon className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-gray-900 text-sm">{type.name}</h3>
                            <p className="text-xs text-gray-500 truncate">{type.description}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>

        {/* Ações */}
        <div className="p-4 border-t border-gray-200 space-y-2">
          <button
            onClick={saveWorkflow}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            Salvar Workflow
          </button>

          <button
            onClick={executeWorkflow}
            disabled={isExecuting}
            className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isExecuting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {isExecuting ? 'Executando...' : 'Executar Workflow'}
          </button>

          <button
            onClick={() => setShowTemplates(true)}
            className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center justify-center gap-2"
          >
            <Grid className="w-4 h-4" />
            Templates
          </button>
        </div>
      </div>

      {/* Área principal - Canvas */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="bg-white border-b border-gray-200 p-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex gap-1">
              <button
                onClick={() => setActiveTab('design')}
                className={`px-3 py-2 text-sm rounded-lg ${
                  activeTab === 'design'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Design
              </button>
              <button
                onClick={() => setActiveTab('execute')}
                className={`px-3 py-2 text-sm rounded-lg ${
                  activeTab === 'execute'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Execução
              </button>
            </div>

            <div className="text-sm text-gray-500">
              {nodes.length} nós • {connections.length} conexões
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setZoom(prev => Math.max(0.25, prev - 0.25))}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              -
            </button>
            <span className="text-sm text-gray-600 min-w-12 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom(prev => Math.min(2, prev + 0.25))}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              +
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div
          ref={canvasRef}
          className="flex-1 relative overflow-hidden workflow-canvas bg-gray-50"
          style={{ transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px)` }}
        >
          {/* SVG para conexões */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            {connections.map(renderConnection)}
          </svg>

          {/* Nós */}
          {nodes.map(renderNode)}

          {/* Indicador de conexão ativa */}
          {isConnecting && connectionStart && (
            <div className="absolute inset-0 bg-blue-50 bg-opacity-50 pointer-events-none">
              <div className="text-center pt-8 text-blue-600 font-medium">
                Clique em outro nó para conectar
              </div>
            </div>
          )}
        </div>

        {/* Painel de entrada para execução */}
        {activeTab === 'execute' && (
          <div className="bg-white border-t border-gray-200 p-4">
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Dados de entrada
                </label>
                <input
                  type="text"
                  value={executionInput}
                  onChange={(e) => setExecutionInput(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Digite a mensagem ou dados para o workflow..."
                />
              </div>
              <button
                onClick={executeWorkflow}
                disabled={isExecuting}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isExecuting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                Executar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Painel direito - Execução e configurações */}
      {(showExecutionPanel || showNodeConfig) && (
        <div className="w-96 bg-white border-l border-gray-200 flex flex-col">
          {/* Header do painel */}
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">
              {showExecutionPanel ? 'Execução' : 'Configurações'}
            </h3>
            <button
              onClick={() => {
                setShowExecutionPanel(false);
                setShowNodeConfig(false);
              }}
              className="p-1 text-gray-500 hover:bg-gray-100 rounded"
            >
              ×
            </button>
          </div>

          {/* Conteúdo do painel */}
          <div className="flex-1 overflow-y-auto p-4">
            {showExecutionPanel && currentExecution && (
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">Status</span>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      currentExecution.status === 'running' ? 'bg-yellow-100 text-yellow-800' :
                      currentExecution.status === 'completed' ? 'bg-green-100 text-green-800' :
                      currentExecution.status === 'failed' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {currentExecution.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">
                    Iniciado em: {new Date(currentExecution.startedAt).toLocaleTimeString()}
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium">Steps de Execução</h4>
                  {currentExecution.steps.map((step, index) => {
                    const node = nodes.find(n => n.id === step.nodeId);
                    return (
                      <div key={step.id} className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{node?.name}</span>
                          <div className="flex items-center gap-2">
                            {step.status === 'pending' && <Clock className="w-4 h-4 text-gray-400" />}
                            {step.status === 'running' && <Loader2 className="w-4 h-4 text-yellow-500 animate-spin" />}
                            {step.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                            {step.status === 'failed' && <XCircle className="w-4 h-4 text-red-500" />}
                          </div>
                        </div>
                        {step.executionTime && (
                          <div className="text-xs text-gray-500 mt-1">
                            {Math.round(step.executionTime)}ms
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {showNodeConfig && selectedNode && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nome do Nó
                  </label>
                  <input
                    type="text"
                    value={selectedNode.name}
                    onChange={(e) => {
                      setSelectedNode({ ...selectedNode, name: e.target.value });
                      setNodes(prev => prev.map(n =>
                        n.id === selectedNode.id ? { ...n, name: e.target.value } : n
                      ));
                    }}
                    className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {selectedNode.type === 'agent' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Agente
                    </label>
                    <select
                      value={selectedNode.config.agentId || ''}
                      onChange={(e) => {
                        const newConfig = { ...selectedNode.config, agentId: e.target.value };
                        setSelectedNode({ ...selectedNode, config: newConfig });
                        setNodes(prev => prev.map(n =>
                          n.id === selectedNode.id ? { ...n, config: newConfig } : n
                        ));
                      }}
                      className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Selecione um agente</option>
                      {agents.map(agent => (
                        <option key={agent.id} value={agent.id}>
                          {agent.name} - {agent.role}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {selectedNode.type === 'condition' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Condição (JavaScript)
                    </label>
                    <textarea
                      value={selectedNode.config.condition || ''}
                      onChange={(e) => {
                        const newConfig = { ...selectedNode.config, condition: e.target.value };
                        setSelectedNode({ ...selectedNode, config: newConfig });
                        setNodes(prev => prev.map(n =>
                          n.id === selectedNode.id ? { ...n, config: newConfig } : n
                        ));
                      }}
                      className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                      rows={4}
                      placeholder="if (result.success) return 'next'; else return 'retry';"
                    />
                  </div>
                )}

                {selectedNode.type === 'delay' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Delay (milissegundos)
                    </label>
                    <input
                      type="number"
                      value={selectedNode.config.delay || 1000}
                      onChange={(e) => {
                        const newConfig = { ...selectedNode.config, delay: parseInt(e.target.value) };
                        setSelectedNode({ ...selectedNode, config: newConfig });
                        setNodes(prev => prev.map(n =>
                          n.id === selectedNode.id ? { ...n, config: newConfig } : n
                        ));
                      }}
                      className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                      min="0"
                    />
                  </div>
                )}

                <div className="pt-4 border-t border-gray-200">
                  <button
                    onClick={() => duplicateNode(selectedNode)}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 mb-2"
                  >
                    <Copy className="w-4 h-4" />
                    Duplicar Nó
                  </button>

                  <button
                    onClick={() => deleteNode(selectedNode.id)}
                    className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Excluir Nó
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de Templates */}
      {showTemplates && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Templates de Workflow</h2>
                <button
                  onClick={() => setShowTemplates(false)}
                  className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-96">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map(template => (
                  <div
                    key={template.id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md cursor-pointer transition-shadow"
                    onClick={() => {
                      onLoadTemplate(template.id);
                      setShowTemplates(false);
                    }}
                  >
                    <h3 className="font-medium text-gray-900 mb-2">{template.name}</h3>
                    <p className="text-sm text-gray-600 mb-3">{template.description}</p>

                    <div className="flex flex-wrap gap-1 mb-3">
                      {template.tags.slice(0, 3).map(tag => (
                        <span
                          key={tag}
                          className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    <div className="text-xs text-gray-500">
                      Usado {template.usageCount} vezes
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedWorkflowBuilder;