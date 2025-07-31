import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Bot,
  Plus,
  Trash2,
  Settings,
  ArrowRight,
  GitBranch,
  Play,
  Save,
  Zap,
  ChevronDown,
  Move,
  Copy,
  Eye,
  FileText,
  Users,
  Activity,
  AlertCircle,
  CheckCircle,
  Loader,
  X,
  RotateCcw,
  Maximize2,
  Grid3X3,
  MousePointer,
  Database,
  Code,
  MessageSquare,
  Timer,
  Filter,
  Layers,
  Target,
  Workflow,
  Import,
  ExternalLink,
  Share2,
  History,
  BookOpen,
  Lightbulb,
  Cpu,
  Network,
  Sparkles,
  Download, // ✅ ADICIONADO - Corrige o erro "Download is not defined"
  Upload     // ✅ ADICIONADO - Para complementar
} from 'lucide-react';

// Import do cliente Agno corrigido
import AgnoClient from './agnoClient';

const WorkflowBuilderFixed = () => {
  const [nodes, setNodes] = useState([]);
  const [connections, setConnections] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [draggedNode, setDraggedNode] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStart, setConnectionStart] = useState(null);
  const [agents, setAgents] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [executionResults, setExecutionResults] = useState([]);

  const [workflowConfig, setWorkflowConfig] = useState({
    name: 'Novo Workflow',
    description: '',
    flowType: 'sequential',
    version: '1.0.0',
    tags: [],
    isPublic: false,
    timeout: 300,
    retries: 3,
    parallelism: 2
  });

  const [showNodeConfig, setShowNodeConfig] = useState(false);
  const [showExecutionPanel, setShowExecutionPanel] = useState(false);
  const [showWorkflowSettings, setShowWorkflowSettings] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [gridVisible, setGridVisible] = useState(true);
  const [miniMapVisible, setMiniMapVisible] = useState(true);

  const canvasRef = useRef(null);
  const [agnoClient] = useState(() => new AgnoClient());

  // Carregar dados iniciais
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [agentsData, workflowsData] = await Promise.all([
        agnoClient.listAgents(),
        agnoClient.listWorkflows()
      ]);

      setAgents(agentsData);
      setWorkflows(workflowsData);

    } catch (err) {
      console.error('Erro ao carregar dados:', err);
      setError(`Erro ao carregar dados: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const nodeTypes = [
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

  const workflowTemplates = [
    {
      id: 'research_analysis',
      name: 'Pesquisa e Análise',
      description: 'Workflow para pesquisa de informações e análise detalhada',
      nodes: [
        { type: 'start', name: 'Iniciar Pesquisa', position: { x: 100, y: 200 } },
        { type: 'agent', name: 'Pesquisador', position: { x: 300, y: 200 }, config: { role: 'Pesquisador' } },
        { type: 'agent', name: 'Analista', position: { x: 500, y: 200 }, config: { role: 'Analista' } },
        { type: 'end', name: 'Finalizar', position: { x: 700, y: 200 } }
      ],
      connections: [
        { from: 0, to: 1 },
        { from: 1, to: 2 },
        { from: 2, to: 3 }
      ]
    },
    {
      id: 'content_creation',
      name: 'Criação de Conteúdo',
      description: 'Pipeline completo para criação e revisão de conteúdo',
      nodes: [
        { type: 'start', name: 'Novo Conteúdo', position: { x: 100, y: 150 } },
        { type: 'agent', name: 'Criador', position: { x: 300, y: 150 } },
        { type: 'condition', name: 'Revisar?', position: { x: 500, y: 150 } },
        { type: 'agent', name: 'Revisor', position: { x: 500, y: 300 } },
        { type: 'notification', name: 'Notificar', position: { x: 700, y: 150 } },
        { type: 'end', name: 'Concluído', position: { x: 900, y: 150 } }
      ],
      connections: [
        { from: 0, to: 1 },
        { from: 1, to: 2 },
        { from: 2, to: 3 },
        { from: 3, to: 2 },
        { from: 2, to: 4 },
        { from: 4, to: 5 }
      ]
    }
  ];

  const loadTemplate = (template) => {
    const templateNodes = template.nodes.map((nodeTemplate, index) => {
      const nodeType = nodeTypes.find(t => t.id === nodeTemplate.type);
      return {
        id: `node_${Date.now()}_${index}`,
        type: nodeTemplate.type,
        name: nodeTemplate.name,
        position: nodeTemplate.position,
        config: {
          agentId: nodeTemplate.config?.agentId || null,
          role: nodeTemplate.config?.role || '',
          condition: nodeTemplate.config?.condition || '',
          delay: nodeTemplate.config?.delay || 1000,
          transformation: nodeTemplate.config?.transformation || '',
          message: nodeTemplate.config?.message || '',
          instructions: nodeTemplate.config?.instructions || ['']
        },
        ...nodeType
      };
    });

    const templateConnections = template.connections.map((conn, index) => ({
      id: `conn_${Date.now()}_${index}`,
      from: templateNodes[conn.from].id,
      to: templateNodes[conn.to].id,
      type: 'default'
    }));

    setNodes(templateNodes);
    setConnections(templateConnections);
    setWorkflowConfig(prev => ({
      ...prev,
      name: template.name,
      description: template.description
    }));
    setShowTemplates(false);
  };

  const addNode = (type, position = null) => {
    // Verificar limite de instâncias
    if (type.maxInstances) {
      const existingCount = nodes.filter(n => n.type === type.id).length;
      if (existingCount >= type.maxInstances) {
        setError(`Máximo ${type.maxInstances} instância(s) de ${type.name} permitida(s)`);
        setTimeout(() => setError(null), 3000);
        return;
      }
    }

    const canvasRect = canvasRef.current?.getBoundingClientRect();
    const defaultPosition = position || {
      x: (canvasRect ? canvasRect.width / 2 : 400) / zoom - canvasOffset.x / zoom - 80,
      y: (canvasRect ? canvasRect.height / 2 : 300) / zoom - canvasOffset.y / zoom - 40
    };

    const newNode = {
      id: `node_${Date.now()}`,
      type: type.id,
      name: `${type.name} ${nodes.filter(n => n.type === type.id).length + 1}`,
      position: defaultPosition,
      config: {
        agentId: type.id === 'agent' ? (agents[0]?.id || null) : null,
        condition: type.id === 'condition' ? 'if (result.success) return "next"; else return "retry";' : null,
        delay: type.id === 'delay' ? 1000 : null,
        transformation: type.id === 'transform' ? 'return data.map(item => ({ ...item, processed: true }));' : null,
        message: type.id === 'notification' ? 'Processo concluído' : null,
        role: type.id === 'agent' ? '' : null,
        instructions: [''],
        timeout: 60,
        retries: 1
      },
      status: 'idle',
      lastRun: null,
      executionTime: null,
      ...type
    };

    setNodes(prev => [...prev, newNode]);
    if (type.configurable) {
      setSelectedNode(newNode);
      setShowNodeConfig(true);
    }
  };

  const deleteNode = (nodeId) => {
    setNodes(prev => prev.filter(n => n.id !== nodeId));
    setConnections(prev => prev.filter(c => c.from !== nodeId && c.to !== nodeId));
    if (selectedNode?.id === nodeId) {
      setSelectedNode(null);
      setShowNodeConfig(false);
    }
  };

  const duplicateNode = (node) => {
    const newNode = {
      ...node,
      id: `node_${Date.now()}`,
      name: `${node.name} (Cópia)`,
      position: {
        x: node.position.x + 50,
        y: node.position.y + 50
      },
      status: 'idle',
      lastRun: null,
      executionTime: null
    };
    setNodes(prev => [...prev, newNode]);
  };

  const validateWorkflow = () => {
    const errors = [];

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
      errors.push(`${incompleteNodes.length} nó(s) mal configurado(s)`);
    }

    return errors;
  };

  const executeWorkflow = async () => {
    const validationErrors = validateWorkflow();
    if (validationErrors.length > 0) {
      setError(`Erro de validação: ${validationErrors.join(', ')}`);
      return;
    }

    try {
      setExecuting(true);
      setExecutionResults([]);
      setShowExecutionPanel(true);
      setError(null);

      // Simular execução do workflow
      const startNode = nodes.find(n => n.type === 'start');
      if (!startNode) return;

      setNodes(prev => prev.map(n => ({ ...n, status: 'idle', executionTime: null })));

      const executionLog = [];
      const executed = new Set();

      const executeNode = async (nodeId, input = null) => {
        const node = nodes.find(n => n.id === nodeId);
        if (!node || executed.has(nodeId)) return null;

        executed.add(nodeId);

        setNodes(prev => prev.map(n =>
          n.id === nodeId ? { ...n, status: 'running' } : n
        ));

        const startTime = Date.now();

        executionLog.push({
          id: Date.now(),
          nodeId,
          nodeName: node.name,
          nodeType: node.type,
          status: 'running',
          timestamp: new Date().toLocaleTimeString(),
          input,
          output: null
        });

        setExecutionResults([...executionLog]);

        let delay = 1000;
        let output = input;

        switch (node.type) {
          case 'agent':
            delay = 2000 + Math.random() * 3000;
            output = `Resposta do agente: ${node.name}`;
            break;
          case 'condition':
            delay = 500;
            output = Math.random() > 0.5 ? 'success' : 'retry';
            break;
          case 'transform':
            delay = 1000;
            output = `Dados transformados por ${node.name}`;
            break;
          case 'delay':
            delay = node.config.delay || 1000;
            output = input;
            break;
          default:
            delay = 500;
        }

        await new Promise(resolve => setTimeout(resolve, delay));

        const executionTime = Date.now() - startTime;
        const success = Math.random() > 0.1;

        setNodes(prev => prev.map(n =>
          n.id === nodeId ? {
            ...n,
            status: success ? 'completed' : 'error',
            executionTime,
            lastRun: new Date().toISOString()
          } : n
        ));

        const logIndex = executionLog.findIndex(log => log.nodeId === nodeId && log.status === 'running');
        if (logIndex >= 0) {
          executionLog[logIndex] = {
            ...executionLog[logIndex],
            status: success ? 'completed' : 'error',
            output: success ? output : 'Erro na execução',
            executionTime
          };
          setExecutionResults([...executionLog]);
        }

        if (!success) {
          throw new Error(`Erro na execução do nó ${node.name}`);
        }

        const nextConnections = connections.filter(c => c.from === nodeId);

        if (node.type === 'parallel') {
          const promises = nextConnections.map(conn => executeNode(conn.to, output));
          await Promise.all(promises);
        } else {
          for (const conn of nextConnections) {
            await executeNode(conn.to, output);
          }
        }

        return output;
      };

      await executeNode(startNode.id, 'Workflow iniciado');

      setExecutionResults(prev => [...prev, {
        id: Date.now(),
        nodeId: null,
        nodeName: 'Sistema',
        nodeType: 'system',
        status: 'completed',
        timestamp: new Date().toLocaleTimeString(),
        input: null,
        output: 'Workflow concluído com sucesso!'
      }]);

    } catch (error) {
      console.error('Erro na execução:', error);
      setError(`Erro na execução: ${error.message}`);

      setExecutionResults(prev => [...prev, {
        id: Date.now(),
        nodeId: null,
        nodeName: 'Sistema',
        nodeType: 'system',
        status: 'error',
        timestamp: new Date().toLocaleTimeString(),
        input: null,
        output: `Execução falhou: ${error.message}`
      }]);
    } finally {
      setExecuting(false);
    }
  };

  const saveWorkflow = async () => {
    const validationErrors = validateWorkflow();
    if (validationErrors.length > 0) {
      setError(`Erro de validação: ${validationErrors.join(', ')}`);
      return;
    }

    if (!workflowConfig.name.trim()) {
      setError('Nome do workflow é obrigatório');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const workflowData = {
        name: workflowConfig.name,
        description: workflowConfig.description,
        flow_type: workflowConfig.flowType,
        supervisor_enabled: false,
        version: workflowConfig.version,
        tags: workflowConfig.tags,
        isPublic: workflowConfig.isPublic,
        timeout: workflowConfig.timeout,
        retries: workflowConfig.retries,
        parallelism: workflowConfig.parallelism,
        workflow_definition: {
          nodes: nodes.map(node => ({
            id: node.id,
            type: node.type,
            name: node.name,
            position: node.position,
            config: node.config
          })),
          connections: connections
        },
        agents: nodes
          .filter(node => node.type === 'agent' && node.config.agentId)
          .map(node => {
            const agent = agents.find(a => a.id.toString() === node.config.agentId);
            return {
              name: node.name,
              role: agent?.role || 'Assistant',
              model_provider: agent?.model_provider || 'openai',
              model_id: agent?.model_id || 'gpt-4o-mini',
              tools: [],
              instructions: node.config.instructions || ['Assistente útil']
            };
          })
      };

      console.log('Salvando workflow:', workflowData);
      const result = await agnoClient.createWorkflow(workflowData);

      console.log('Workflow salvo:', result);
      setError(null);

      // Mostrar sucesso por 3 segundos
      const successMessage = `Workflow "${workflowConfig.name}" salvo com sucesso!`;
      setError(null);
      // Você pode adicionar um estado de sucesso aqui se quiser

      await loadInitialData();

    } catch (error) {
      console.error('Erro ao salvar workflow:', error);
      setError(`Erro ao salvar workflow: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const clearCanvas = () => {
    if (confirm('Deseja limpar todo o canvas? Esta ação não pode ser desfeita.')) {
      setNodes([]);
      setConnections([]);
      setSelectedNode(null);
      setShowNodeConfig(false);
      setExecutionResults([]);
    }
  };

  const resetView = () => {
    setCanvasOffset({ x: 0, y: 0 });
    setZoom(1);
  };

  const exportWorkflow = () => {
    const workflowExport = {
      ...workflowConfig,
      nodes,
      connections,
      version: workflowConfig.version,
      exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(workflowExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${workflowConfig.name.replace(/\s+/g, '_')}_v${workflowConfig.version}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const importWorkflow = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedWorkflow = JSON.parse(e.target.result);

        setWorkflowConfig({
          name: importedWorkflow.name || 'Workflow Importado',
          description: importedWorkflow.description || '',
          flowType: importedWorkflow.flowType || 'sequential',
          version: importedWorkflow.version || '1.0.0',
          tags: importedWorkflow.tags || [],
          isPublic: importedWorkflow.isPublic || false,
          timeout: importedWorkflow.timeout || 300,
          retries: importedWorkflow.retries || 3,
          parallelism: importedWorkflow.parallelism || 2
        });

        setNodes(importedWorkflow.nodes || []);
        setConnections(importedWorkflow.connections || []);

        setError(null);
        // Mostrar sucesso
      } catch (error) {
        console.error('Erro ao importar:', error);
        setError('Erro ao importar workflow: arquivo inválido');
      }
    };
    reader.readAsText(file);
  };

  // Componente de Nó simplificado
  const NodeComponent = ({ node, isSelected }) => {
    const IconComponent = node.icon;
    const [isDragging, setIsDragging] = useState(false);

    const statusColors = {
      idle: 'border-gray-200 bg-white',
      running: 'border-blue-500 bg-blue-50 animate-pulse',
      completed: 'border-green-500 bg-green-50',
      error: 'border-red-500 bg-red-50'
    };

    const handleMouseDown = (e) => {
      e.stopPropagation();
      setIsDragging(true);
      setSelectedNode(node);

      const handleMouseMove = (e) => {
        const rect = canvasRef.current.getBoundingClientRect();
        const newX = (e.clientX - rect.left - canvasOffset.x) / zoom - 80;
        const newY = (e.clientY - rect.top - canvasOffset.y) / zoom - 40;

        setNodes(prev => prev.map(n =>
          n.id === node.id
            ? { ...n, position: { x: Math.max(0, newX), y: Math.max(0, newY) } }
            : n
        ));
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    };

    return (
      <div
        className={`absolute cursor-move select-none transition-all duration-200 ${
          isSelected ? 'z-20 scale-105' : 'z-10'
        } ${isDragging ? 'opacity-75' : 'opacity-100'}`}
        style={{
          left: node.position.x * zoom + canvasOffset.x,
          top: node.position.y * zoom + canvasOffset.y,
          transform: `scale(${zoom})`
        }}
        onMouseDown={handleMouseDown}
      >
        <div className={`
          w-48 p-4 rounded-xl shadow-lg border-2 transition-all duration-200
          ${statusColors[node.status] || statusColors.idle}
          ${isSelected ? 'ring-2 ring-blue-300' : ''}
        `}>
          <div className="flex items-center gap-3 mb-3">
            <div className={`p-2 rounded-lg ${node.color} text-white shadow-sm`}>
              <IconComponent className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-gray-900 text-sm truncate">{node.name}</div>
              <div className="text-xs text-gray-500 flex items-center gap-2">
                <span className="capitalize">{node.type}</span>
                {node.status === 'running' && <Loader className="w-3 h-3 animate-spin" />}
                {node.status === 'completed' && <CheckCircle className="w-3 h-3 text-green-500" />}
                {node.status === 'error' && <AlertCircle className="w-3 h-3 text-red-500" />}
              </div>
            </div>
          </div>

          <div className="text-xs text-gray-600 mb-3 space-y-1">
            {node.type === 'agent' && (
              <div className="flex items-center gap-1">
                <Bot className="w-3 h-3" />
                <span>{agents.find(a => a.id.toString() === node.config.agentId)?.name || 'Não selecionado'}</span>
              </div>
            )}
            {node.executionTime && (
              <div className="flex items-center gap-1 text-blue-600">
                <Activity className="w-3 h-3" />
                <span>{node.executionTime}ms</span>
              </div>
            )}
          </div>

          <div className="flex justify-between items-center">
            {node.type !== 'start' && (
              <div className="w-3 h-3 bg-red-400 rounded-full cursor-pointer hover:bg-red-500 transition-colors border-2 border-white shadow-sm" />
            )}

            <div className="flex gap-1">
              {node.configurable && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedNode(node);
                    setShowNodeConfig(true);
                  }}
                  className="p-1 text-gray-400 hover:text-blue-600 rounded transition-colors"
                >
                  <Settings className="w-3 h-3" />
                </button>
              )}

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  duplicateNode(node);
                }}
                className="p-1 text-gray-400 hover:text-green-600 rounded transition-colors"
              >
                <Copy className="w-3 h-3" />
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteNode(node.id);
                }}
                className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>

            {node.type !== 'end' && (
              <div className="w-3 h-3 bg-green-400 rounded-full cursor-pointer hover:bg-green-500 transition-colors border-2 border-white shadow-sm" />
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Carregando Workflow Builder</h3>
          <p className="text-gray-500">Conectando com o backend...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 flex">
      {/* Toolbar Lateral */}
      <div className="w-80 bg-white border-r border-gray-200 shadow-lg flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Workflow className="w-5 h-5" />
              Workflow Builder
            </h2>
            <div className="flex gap-1">
              <button
                onClick={() => setShowTemplates(true)}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                title="Templates"
              >
                <BookOpen className="w-4 h-4" />
              </button>
            </div>
          </div>

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
            rows="2"
            placeholder="Descrição do workflow"
          />

          <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
            <span>v{workflowConfig.version}</span>
            <span>•</span>
            <span>{nodes.length} nós</span>
            <span>•</span>
            <span>{connections.length} conexões</span>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded flex items-center gap-2 text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm flex-1">{error}</span>
            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Componentes */}
        <div className="flex-1 overflow-y-auto p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Componentes</h3>

          {['flow', 'execution', 'logic', 'data', 'utility'].map(category => {
            const categoryNodes = nodeTypes.filter(type => type.category === category);
            if (categoryNodes.length === 0) return null;

            const categoryNames = {
              flow: { name: 'Fluxo', icon: GitBranch },
              execution: { name: 'Execução', icon: Cpu },
              logic: { name: 'Lógica', icon: GitBranch },
              data: { name: 'Dados', icon: Database },
              utility: { name: 'Utilidades', icon: Zap }
            };

            const CategoryIcon = categoryNames[category].icon;

            return (
              <div key={category} className="mb-4">
                <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <CategoryIcon className="w-3 h-3" />
                  {categoryNames[category].name}
                </h4>
                <div className="space-y-2">
                  {categoryNodes.map(type => {
                    const IconComponent = type.icon;
                    const currentCount = nodes.filter(n => n.type === type.id).length;
                    const isMaxed = type.maxInstances && currentCount >= type.maxInstances;

                    return (
                      <button
                        key={type.id}
                        onClick={() => !isMaxed && addNode(type)}
                        disabled={isMaxed}
                        className={`w-full p-3 border rounded-lg flex items-center gap-3 text-left transition-all ${
                          isMaxed 
                            ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed' 
                            : 'border-gray-200 hover:bg-gray-50 hover:border-gray-300 hover:shadow-sm'
                        }`}
                      >
                        <div className={`p-2 rounded ${type.color} text-white shadow-sm flex-shrink-0`}>
                          <IconComponent className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-gray-900 flex items-center gap-2">
                            {type.name}
                            {type.maxInstances && (
                              <span className="text-xs text-gray-500">
                                ({currentCount}/{type.maxInstances})
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 line-clamp-2">{type.description}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Ações principais */}
        <div className="p-4 border-t border-gray-200">
          <div className="space-y-2">
            <div className="flex gap-2">
              <button
                onClick={saveWorkflow}
                disabled={saving || nodes.length === 0}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors text-sm font-medium"
              >
                {saving ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Salvar
                  </>
                )}
              </button>

              <button
                onClick={() => setShowExecutionPanel(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2 transition-colors text-sm font-medium"
              >
                <Play className="w-4 h-4" />
                Executar
              </button>
            </div>

            <div className="flex gap-2">
              <button
                onClick={exportWorkflow}
                className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center justify-center gap-2 transition-colors text-sm"
              >
                <Download className="w-4 h-4" />
                Exportar
              </button>

              <label className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center justify-center gap-2 transition-colors text-sm cursor-pointer">
                <Upload className="w-4 h-4" />
                Importar
                <input
                  type="file"
                  accept=".json"
                  onChange={importWorkflow}
                  className="hidden"
                />
              </label>

              <button
                onClick={clearCanvas}
                className="px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 flex items-center justify-center gap-2 transition-colors text-sm"
                title="Limpar Canvas"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Canvas Principal */}
      <div className="flex-1 relative overflow-hidden bg-gray-50">
        {/* Controles do Canvas */}
        <div className="absolute top-4 right-4 z-30 flex gap-2">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2 flex items-center gap-2">
            <button
              onClick={() => setZoom(Math.max(0.25, zoom - 0.25))}
              className="p-1 text-gray-600 hover:bg-gray-100 rounded"
              title="Diminuir zoom"
            >
              -
            </button>
            <span className="text-sm font-medium text-gray-700 min-w-[3rem] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom(Math.min(2, zoom + 0.25))}
              className="p-1 text-gray-600 hover:bg-gray-100 rounded"
              title="Aumentar zoom"
            >
              +
            </button>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2 flex items-center gap-1">
            <button
              onClick={resetView}
              className="p-1 text-gray-600 hover:bg-gray-100 rounded"
              title="Resetar visualização"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={() => setGridVisible(!gridVisible)}
              className={`p-1 rounded ${gridVisible ? 'text-blue-600 bg-blue-100' : 'text-gray-600 hover:bg-gray-100'}`}
              title="Alternar grid"
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div
          ref={canvasRef}
          className="w-full h-full relative cursor-default"
          onMouseDown={(e) => {
            if (e.target === canvasRef.current) {
              if (isConnecting) {
                setIsConnecting(false);
                setConnectionStart(null);
              } else {
                setSelectedNode(null);
                setShowNodeConfig(false);

                setIsPanning(true);
                setPanStart({ x: e.clientX - canvasOffset.x, y: e.clientY - canvasOffset.y });
              }
            }
          }}
          onMouseMove={(e) => {
            if (isPanning) {
              setCanvasOffset({
                x: e.clientX - panStart.x,
                y: e.clientY - panStart.y
              });
            }
          }}
          onMouseUp={() => setIsPanning(false)}
          style={{
            backgroundImage: gridVisible ? `
              radial-gradient(circle, #d1d5db 1px, transparent 1px)
            ` : 'none',
            backgroundSize: gridVisible ? `${20 * zoom}px ${20 * zoom}px` : 'auto',
            backgroundPosition: gridVisible ? `${canvasOffset.x}px ${canvasOffset.y}px` : 'auto'
          }}
        >
          {/* SVG para conexões */}
          <svg className="absolute inset-0 pointer-events-none z-10" width="100%" height="100%">
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <polygon
                  points="0 0, 10 3.5, 0 7"
                  fill="#6b7280"
                />
              </marker>
            </defs>
            {connections.map(connection => {
              const fromNode = nodes.find(n => n.id === connection.from);
              const toNode = nodes.find(n => n.id === connection.to);

              if (!fromNode || !toNode) return null;

              const startX = (fromNode.position.x + 96) * zoom + canvasOffset.x;
              const startY = (fromNode.position.y + 50) * zoom + canvasOffset.y;
              const endX = (toNode.position.x + 96) * zoom + canvasOffset.x;
              const endY = (toNode.position.y + 50) * zoom + canvasOffset.y;

              return (
                <g key={connection.id}>
                  <path
                    d={`M ${startX} ${startY} Q ${(startX + endX) / 2} ${startY - 50 * zoom} ${endX} ${endY}`}
                    stroke="#6b7280"
                    strokeWidth={2 * zoom}
                    fill="none"
                    markerEnd="url(#arrowhead)"
                    className="hover:stroke-blue-500 cursor-pointer transition-colors"
                  />
                </g>
              );
            })}
          </svg>

          {/* Nós */}
          {nodes.map(node => (
            <NodeComponent
              key={node.id}
              node={node}
              isSelected={selectedNode?.id === node.id}
            />
          ))}

          {/* Estado vazio */}
          {nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center text-gray-500">
                <Workflow className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">Canvas Vazio</h3>
                <p className="text-sm mb-2">Adicione componentes da barra lateral para começar</p>
              </div>
            </div>
          )}

          {/* Info do Canvas */}
          <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-sm border border-gray-200 px-3 py-2">
            <div className="text-xs text-gray-600 flex items-center gap-4">
              <div className="flex items-center gap-1">
                <Target className="w-3 h-3" />
                <span>{nodes.length} nós</span>
              </div>
              <div className="flex items-center gap-1">
                <Network className="w-3 h-3" />
                <span>{connections.length} conexões</span>
              </div>
              <div className="flex items-center gap-1">
                <Bot className="w-3 h-3" />
                <span>{agents.length} agentes</span>
              </div>
              {executing && (
                <div className="flex items-center gap-1 text-green-600">
                  <Activity className="w-3 h-3 animate-pulse" />
                  <span>Executando</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Painel de Execução */}
      {showExecutionPanel && (
        <div className="w-80 bg-white border-l border-gray-200 shadow-lg flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Execução
              </h3>
              <button
                onClick={() => setShowExecutionPanel(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex gap-2">
              <button
                onClick={executeWorkflow}
                disabled={executing || nodes.length === 0}
                className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
              >
                {executing ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Executando...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Executar
                  </>
                )}
              </button>

              <button
                onClick={() => setExecutionResults([])}
                className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
                title="Limpar log"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-3">
              {executionResults.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Execute o workflow para ver os resultados</p>
                </div>
              ) : (
                executionResults.map(result => (
                  <div key={result.id} className={`
                    p-3 rounded-lg border-l-4 text-sm
                    ${result.status === 'running' ? 'border-blue-500 bg-blue-50' :
                      result.status === 'completed' ? 'border-green-500 bg-green-50' :
                      result.status === 'error' ? 'border-red-500 bg-red-50' :
                      'border-gray-500 bg-gray-50'}
                  `}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">{result.nodeName}</span>
                      <span className="text-xs text-gray-500">{result.timestamp}</span>
                    </div>

                    {result.input && (
                      <div className="text-xs text-gray-600 mb-1">
                        <strong>Input:</strong> {result.input}
                      </div>
                    )}

                    {result.output && (
                      <div className="text-xs text-gray-600 mb-1">
                        <strong>Output:</strong> {result.output}
                      </div>
                    )}

                    {result.executionTime && (
                      <div className="text-xs text-gray-500">
                        Tempo: {result.executionTime}ms
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Templates */}
      {showTemplates && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Sparkles className="w-6 h-6" />
                Templates de Workflow
              </h2>
              <button
                onClick={() => setShowTemplates(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {workflowTemplates.map(template => (
                <div key={template.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <h3 className="font-semibold text-gray-900 mb-2">{template.name}</h3>
                  <p className="text-sm text-gray-600 mb-4">{template.description}</p>

                  <div className="text-xs text-gray-500 mb-4">
                    {template.nodes.length} nós • {template.connections.length} conexões
                  </div>

                  <button
                    onClick={() => loadTemplate(template)}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                  >
                    Usar Template
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkflowBuilderFixed;