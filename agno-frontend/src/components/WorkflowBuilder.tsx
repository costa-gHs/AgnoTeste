// src/components/WorkflowBuilder.tsx - NOVA VERSÃO MELHORADA

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Play,
  Plus,
  Trash2,
  Settings,
  Save,
  Share,
  Copy,
  Download,
  Upload,
  Zap,
  GitBranch,
  Clock,
  AlertCircle,
  CheckCircle,
  Loader,
  Code,
  Database,
  MessageSquare,
  Filter,
  ArrowRight,
  MoreVertical,
  Edit3,
  Eye,
  Maximize
} from 'lucide-react';

// =============================================
// TIPOS E INTERFACES
// =============================================

type NodeType =
  | 'start'
  | 'agent'
  | 'condition'
  | 'transform'
  | 'api_call'
  | 'delay'
  | 'parallel'
  | 'merge'
  | 'end';

interface Position {
  x: number;
  y: number;
}

interface NodeConfig {
  id: string;
  type: NodeType;
  position: Position;
  data: {
    label: string;
    description?: string;
    config?: Record<string, any>;
    status?: 'idle' | 'running' | 'success' | 'error';
  };
}

interface ConnectionConfig {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
  condition?: string;
}

interface WorkflowConfig {
  id?: string;
  name: string;
  description: string;
  nodes: NodeConfig[];
  connections: ConnectionConfig[];
  variables: Record<string, any>;
  metadata: {
    created: string;
    modified: string;
    version: string;
    author?: string;
  };
}

interface WorkflowBuilderProps {
  workflow?: WorkflowConfig;
  onSave: (workflow: WorkflowConfig) => Promise<void>;
  onExecute: (workflowId: string, input?: any) => Promise<any>;
  availableAgents: Array<{
    id: string;
    name: string;
    type: string;
  }>;
  readOnly?: boolean;
}

// =============================================
// CONFIGURAÇÕES DE NODES
// =============================================

const NODE_TYPES = {
  start: {
    label: 'Início',
    description: 'Ponto de partida do workflow',
    icon: Play,
    color: 'green',
    maxInputs: 0,
    maxOutputs: 1,
    configurable: true
  },
  agent: {
    label: 'Agente IA',
    description: 'Executa tarefas usando IA',
    icon: MessageSquare,
    color: 'blue',
    maxInputs: 1,
    maxOutputs: 2,
    configurable: true
  },
  condition: {
    label: 'Condição',
    description: 'Tomada de decisão baseada em condições',
    icon: GitBranch,
    color: 'yellow',
    maxInputs: 1,
    maxOutputs: 2,
    configurable: true
  },
  transform: {
    label: 'Transformação',
    description: 'Processa e transforma dados',
    icon: Code,
    color: 'purple',
    maxInputs: 1,
    maxOutputs: 1,
    configurable: true
  },
  api_call: {
    label: 'API Call',
    description: 'Chama APIs externas',
    icon: Database,
    color: 'indigo',
    maxInputs: 1,
    maxOutputs: 1,
    configurable: true
  },
  delay: {
    label: 'Aguardar',
    description: 'Pausa a execução por um tempo',
    icon: Clock,
    color: 'gray',
    maxInputs: 1,
    maxOutputs: 1,
    configurable: true
  },
  parallel: {
    label: 'Paralelo',
    description: 'Executa múltiplas tarefas em paralelo',
    icon: Zap,
    color: 'orange',
    maxInputs: 1,
    maxOutputs: 5,
    configurable: false
  },
  merge: {
    label: 'Junção',
    description: 'Combina resultados de múltiplas fontes',
    icon: Filter,
    color: 'pink',
    maxInputs: 5,
    maxOutputs: 1,
    configurable: true
  },
  end: {
    label: 'Fim',
    description: 'Finaliza o workflow',
    icon: CheckCircle,
    color: 'red',
    maxInputs: 1,
    maxOutputs: 0,
    configurable: false
  }
} as const;

// =============================================
// COMPONENTE PRINCIPAL
// =============================================

const WorkflowBuilder: React.FC<WorkflowBuilderProps> = ({
  workflow: initialWorkflow,
  onSave,
  onExecute,
  availableAgents,
  readOnly = false
}) => {
  // Estados principais
  const [workflow, setWorkflow] = useState<WorkflowConfig>(() => ({
    name: 'Novo Workflow',
    description: '',
    nodes: [],
    connections: [],
    variables: {},
    metadata: {
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      version: '1.0.0'
    },
    ...initialWorkflow
  }));

  const [selectedNode, setSelectedNode] = useState<NodeConfig | null>(null);
  const [selectedConnection, setSelectedConnection] = useState<ConnectionConfig | null>(null);
  const [draggedNodeType, setDraggedNodeType] = useState<NodeType | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showNodePalette, setShowNodePalette] = useState(true);
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Position>({ x: 0, y: 0 });

  const canvasRef = useRef<HTMLDivElement>(null);
  const [connecting, setConnecting] = useState<{
    from: string;
    fromHandle?: string;
  } | null>(null);

  // =============================================
  // FUNÇÕES UTILITÁRIAS
  // =============================================

  const generateId = () => Math.random().toString(36).substring(2, 11);

  const getNodeColor = (type: NodeType, status?: string) => {
    const baseColor = NODE_TYPES[type].color;
    const statusColors = {
      running: 'blue',
      success: 'green',
      error: 'red',
      idle: baseColor
    };
    return statusColors[status as keyof typeof statusColors] || baseColor;
  };

  const findNodeById = (id: string) => workflow.nodes.find(n => n.id === id);

  const getConnectionsForNode = (nodeId: string) => ({
    incoming: workflow.connections.filter(c => c.target === nodeId),
    outgoing: workflow.connections.filter(c => c.source === nodeId)
  });

  const validateWorkflow = (): string[] => {
    const errors: string[] = [];

    // Verificar se há pelo menos um node de início
    if (!workflow.nodes.some(n => n.type === 'start')) {
      errors.push('O workflow deve ter pelo menos um ponto de início');
    }

    // Verificar se há pelo menos um node de fim
    if (!workflow.nodes.some(n => n.type === 'end')) {
      errors.push('O workflow deve ter pelo menos um ponto de finalização');
    }

    // Verificar nodes desconectados
    const connectedNodes = new Set([
      ...workflow.connections.map(c => c.source),
      ...workflow.connections.map(c => c.target)
    ]);

    const disconnectedNodes = workflow.nodes.filter(n =>
      n.type !== 'start' && n.type !== 'end' && !connectedNodes.has(n.id)
    );

    if (disconnectedNodes.length > 0) {
      errors.push(`Nodes desconectados: ${disconnectedNodes.map(n => n.data.label).join(', ')}`);
    }

    return errors;
  };

  // =============================================
  // MANIPULAÇÃO DE NODES
  // =============================================

  const addNode = useCallback((type: NodeType, position: Position) => {
    if (readOnly) return;

    const newNode: NodeConfig = {
      id: generateId(),
      type,
      position,
      data: {
        label: NODE_TYPES[type].label,
        description: NODE_TYPES[type].description,
        status: 'idle',
        config: type === 'agent' ? { agentId: '', instructions: '' } : {}
      }
    };

    setWorkflow(prev => ({
      ...prev,
      nodes: [...prev.nodes, newNode],
      metadata: { ...prev.metadata, modified: new Date().toISOString() }
    }));
  }, [readOnly]);

  const updateNode = useCallback((nodeId: string, updates: Partial<NodeConfig>) => {
    if (readOnly) return;

    setWorkflow(prev => ({
      ...prev,
      nodes: prev.nodes.map(node =>
        node.id === nodeId ? { ...node, ...updates } : node
      ),
      metadata: { ...prev.metadata, modified: new Date().toISOString() }
    }));
  }, [readOnly]);

  const deleteNode = useCallback((nodeId: string) => {
    if (readOnly) return;

    setWorkflow(prev => ({
      ...prev,
      nodes: prev.nodes.filter(n => n.id !== nodeId),
      connections: prev.connections.filter(c =>
        c.source !== nodeId && c.target !== nodeId
      ),
      metadata: { ...prev.metadata, modified: new Date().toISOString() }
    }));
  }, [readOnly]);

  const moveNode = useCallback((nodeId: string, position: Position) => {
    if (readOnly) return;

    updateNode(nodeId, { position });
  }, [readOnly, updateNode]);

  // =============================================
  // MANIPULAÇÃO DE CONEXÕES
  // =============================================

  const addConnection = useCallback((source: string, target: string) => {
    if (readOnly) return;

    // Verificar se conexão já existe
    const exists = workflow.connections.some(c =>
      c.source === source && c.target === target
    );
    if (exists) return;

    const newConnection: ConnectionConfig = {
      id: generateId(),
      source,
      target,
      label: ''
    };

    setWorkflow(prev => ({
      ...prev,
      connections: [...prev.connections, newConnection],
      metadata: { ...prev.metadata, modified: new Date().toISOString() }
    }));
  }, [readOnly, workflow.connections]);

  const deleteConnection = useCallback((connectionId: string) => {
    if (readOnly) return;

    setWorkflow(prev => ({
      ...prev,
      connections: prev.connections.filter(c => c.id !== connectionId),
      metadata: { ...prev.metadata, modified: new Date().toISOString() }
    }));
  }, [readOnly]);

  // =============================================
  // HANDLERS DE EVENTOS
  // =============================================

  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = (e.clientX - rect.left - pan.x) / zoom;
    const y = (e.clientY - rect.top - pan.y) / zoom;

    if (draggedNodeType) {
      addNode(draggedNodeType, { x, y });
      setDraggedNodeType(null);
    } else {
      setSelectedNode(null);
      setSelectedConnection(null);
    }
  }, [draggedNodeType, pan, zoom, addNode]);

  const handleNodeClick = useCallback((node: NodeConfig, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedNode(node);
    setShowConfigPanel(true);
  }, []);

  const handleConnectionStart = useCallback((nodeId: string) => {
    if (readOnly) return;
    setConnecting({ from: nodeId });
  }, [readOnly]);

  const handleConnectionEnd = useCallback((nodeId: string) => {
    if (readOnly || !connecting) return;

    if (connecting.from !== nodeId) {
      addConnection(connecting.from, nodeId);
    }
    setConnecting(null);
  }, [readOnly, connecting, addConnection]);

  // =============================================
  // FUNÇÕES DE WORKFLOW
  // =============================================

  const handleSave = async () => {
    if (readOnly) return;

    const errors = validateWorkflow();
    if (errors.length > 0) {
      alert(`Erros no workflow:\n${errors.join('\n')}`);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(workflow);
    } catch (error) {
      console.error('Erro ao salvar workflow:', error);
      alert('Erro ao salvar workflow');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExecute = async () => {
    if (!workflow.id) {
      alert('Salve o workflow antes de executá-lo');
      return;
    }

    setIsExecuting(true);
    try {
      const result = await onExecute(workflow.id);
      setExecutionResult(result);
    } catch (error) {
      console.error('Erro ao executar workflow:', error);
      setExecutionResult({ error: (error as Error).message });
    } finally {
      setIsExecuting(false);
    }
  };

  const exportWorkflow = () => {
    const dataStr = JSON.stringify(workflow, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${workflow.name.replace(/\s+/g, '_')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // =============================================
  // RENDERIZAÇÃO
  // =============================================

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <input
                type="text"
                value={workflow.name}
                onChange={(e) => setWorkflow(prev => ({
                  ...prev,
                  name: e.target.value
                }))}
                className="text-xl font-bold text-gray-900 bg-transparent border-none outline-none"
                disabled={readOnly}
              />
              <p className="text-sm text-gray-600">{workflow.description}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowNodePalette(!showNodePalette)}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
              title="Toggle Node Palette"
            >
              <Plus className="w-4 h-4" />
            </button>

            <button
              onClick={exportWorkflow}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
              title="Export Workflow"
            >
              <Download className="w-4 h-4" />
            </button>

            <button
              onClick={handleExecute}
              disabled={isExecuting || !workflow.id}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isExecuting ? (
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

            {!readOnly && (
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSaving ? (
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
            )}
          </div>
        </div>
      </div>

      {/* Corpo principal */}
      <div className="flex-1 flex">
        {/* Paleta de Nodes */}
        {showNodePalette && !readOnly && (
          <div className="w-64 bg-white border-r border-gray-200 p-4 overflow-y-auto">
            <h3 className="font-medium text-gray-900 mb-3">Componentes</h3>

            <div className="space-y-2">
              {Object.entries(NODE_TYPES).map(([type, config]) => (
                <div
                  key={type}
                  className="p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                  draggable
                  onDragStart={() => setDraggedNodeType(type as NodeType)}
                  onClick={() => {
                    // Adicionar no centro da tela
                    const centerX = (canvasRef.current?.clientWidth || 800) / 2;
                    const centerY = (canvasRef.current?.clientHeight || 600) / 2;
                    addNode(type as NodeType, { x: centerX, y: centerY });
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-${config.color}-100 text-${config.color}-600`}>
                      <config.icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-medium text-sm text-gray-900">{config.label}</div>
                      <div className="text-xs text-gray-600">{config.description}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Canvas */}
        <div className="flex-1 relative overflow-hidden">
          <div
            ref={canvasRef}
            className="w-full h-full bg-gray-100 relative cursor-crosshair"
            onClick={handleCanvasClick}
            style={{
              backgroundImage: `
                radial-gradient(circle, #e5e7eb 1px, transparent 1px)
              `,
              backgroundSize: '20px 20px',
              backgroundPosition: `${pan.x}px ${pan.y}px`
            }}
          >
            {/* Renderizar nodes */}
            {workflow.nodes.map(node => {
              const nodeType = NODE_TYPES[node.type];
              const isSelected = selectedNode?.id === node.id;
              const connections = getConnectionsForNode(node.id);

              return (
                <div
                  key={node.id}
                  className={`absolute bg-white border-2 rounded-lg p-3 cursor-pointer transition-all ${
                    isSelected 
                      ? 'border-blue-500 shadow-lg' 
                      : `border-${getNodeColor(node.type, node.data.status)}-300 hover:shadow-md`
                  }`}
                  style={{
                    left: node.position.x * zoom + pan.x,
                    top: node.position.y * zoom + pan.y,
                    transform: `scale(${zoom})`,
                    transformOrigin: 'top left'
                  }}
                  onClick={(e) => handleNodeClick(node, e)}
                  onMouseDown={(e) => {
                    // Lógica para drag and drop
                    e.preventDefault();

                    const startX = e.clientX;
                    const startY = e.clientY;
                    const startPos = node.position;

                    const handleMouseMove = (e: MouseEvent) => {
                      const deltaX = (e.clientX - startX) / zoom;
                      const deltaY = (e.clientY - startY) / zoom;

                      moveNode(node.id, {
                        x: startPos.x + deltaX,
                        y: startPos.y + deltaY
                      });
                    };

                    const handleMouseUp = () => {
                      document.removeEventListener('mousemove', handleMouseMove);
                      document.removeEventListener('mouseup', handleMouseUp);
                    };

                    document.addEventListener('mousemove', handleMouseMove);
                    document.addEventListener('mouseup', handleMouseUp);
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-${getNodeColor(node.type, node.data.status)}-100 text-${getNodeColor(node.type, node.data.status)}-600`}>
                      <nodeType.icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-medium text-sm text-gray-900">{node.data.label}</div>
                      {node.data.status && node.data.status !== 'idle' && (
                        <div className={`text-xs text-${getNodeColor(node.type, node.data.status)}-600`}>
                          {node.data.status === 'running' && 'Executando...'}
                          {node.data.status === 'success' && 'Concluído'}
                          {node.data.status === 'error' && 'Erro'}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Pontos de conexão */}
                  {nodeType.maxInputs > 0 && (
                    <div
                      className="absolute w-3 h-3 bg-gray-400 border border-white rounded-full -left-1.5 top-1/2 transform -translate-y-1/2 cursor-pointer hover:bg-blue-500"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleConnectionEnd(node.id);
                      }}
                    />
                  )}

                  {nodeType.maxOutputs > 0 && (
                    <div
                      className="absolute w-3 h-3 bg-gray-400 border border-white rounded-full -right-1.5 top-1/2 transform -translate-y-1/2 cursor-pointer hover:bg-blue-500"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleConnectionStart(node.id);
                      }}
                    />
                  )}

                  {/* Botão de delete */}
                  {!readOnly && isSelected && (
                    <button
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNode(node.id);
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}

            {/* Renderizar conexões */}
            <svg className="absolute inset-0 pointer-events-none" style={{ zIndex: 1 }}>
              {workflow.connections.map(connection => {
                const sourceNode = findNodeById(connection.source);
                const targetNode = findNodeById(connection.target);

                if (!sourceNode || !targetNode) return null;

                const sourceX = (sourceNode.position.x + 100) * zoom + pan.x;
                const sourceY = (sourceNode.position.y + 25) * zoom + pan.y;
                const targetX = targetNode.position.x * zoom + pan.x;
                const targetY = (targetNode.position.y + 25) * zoom + pan.y;

                const midX = (sourceX + targetX) / 2;

                return (
                  <g key={connection.id}>
                    <path
                      d={`M ${sourceX} ${sourceY} Q ${midX} ${sourceY} ${midX} ${(sourceY + targetY) / 2} Q ${midX} ${targetY} ${targetX} ${targetY}`}
                      stroke="#6b7280"
                      strokeWidth="2"
                      fill="none"
                      className="hover:stroke-blue-500 cursor-pointer"
                      onClick={() => setSelectedConnection(connection)}
                    />
                    <path
                      d={`M ${targetX - 8} ${targetY - 4} L ${targetX} ${targetY} L ${targetX - 8} ${targetY + 4}`}
                      stroke="#6b7280"
                      strokeWidth="2"
                      fill="none"
                    />
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Controles de zoom */}
          <div className="absolute bottom-4 right-4 flex flex-col gap-2">
            <button
              onClick={() => setZoom(prev => Math.min(prev + 0.1, 2))}
              className="w-8 h-8 bg-white border border-gray-300 rounded flex items-center justify-center hover:bg-gray-50"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoom(prev => Math.max(prev - 0.1, 0.5))}
              className="w-8 h-8 bg-white border border-gray-300 rounded flex items-center justify-center hover:bg-gray-50"
            >
              −
            </button>
            <button
              onClick={() => {
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }}
              className="w-8 h-8 bg-white border border-gray-300 rounded flex items-center justify-center hover:bg-gray-50 text-xs"
            >
              1:1
            </button>
          </div>
        </div>

        {/* Painel de configuração */}
        {showConfigPanel && selectedNode && (
          <div className="w-80 bg-white border-l border-gray-200 p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-gray-900">Configurações</h3>
              <button
                onClick={() => setShowConfigPanel(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome
                </label>
                <input
                  type="text"
                  value={selectedNode.data.label}
                  onChange={(e) => updateNode(selectedNode.id, {
                    data: { ...selectedNode.data, label: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={readOnly}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descrição
                </label>
                <textarea
                  value={selectedNode.data.description || ''}
                  onChange={(e) => updateNode(selectedNode.id, {
                    data: { ...selectedNode.data, description: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  disabled={readOnly}
                />
              </div>

              {/* Configurações específicas por tipo de node */}
              {selectedNode.type === 'agent' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Agente
                  </label>
                  <select
                    value={selectedNode.data.config?.agentId || ''}
                    onChange={(e) => updateNode(selectedNode.id, {
                      data: {
                        ...selectedNode.data,
                        config: { ...selectedNode.data.config, agentId: e.target.value }
                      }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={readOnly}
                  >
                    <option value="">Selecione um agente</option>
                    {availableAgents.map(agent => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {selectedNode.type === 'condition' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Condição
                  </label>
                  <textarea
                    value={selectedNode.data.config?.condition || ''}
                    onChange={(e) => updateNode(selectedNode.id, {
                      data: {
                        ...selectedNode.data,
                        config: { ...selectedNode.data.config, condition: e.target.value }
                      }
                    })}
                    placeholder="Ex: output.success === true"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={2}
                    disabled={readOnly}
                  />
                </div>
              )}

              {selectedNode.type === 'delay' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tempo de espera (segundos)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={selectedNode.data.config?.delay || 5}
                    onChange={(e) => updateNode(selectedNode.id, {
                      data: {
                        ...selectedNode.data,
                        config: { ...selectedNode.data.config, delay: parseInt(e.target.value) }
                      }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={readOnly}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Resultado da execução */}
      {executionResult && (
        <div className="bg-white border-t border-gray-200 p-4">
          <h3 className="font-medium text-gray-900 mb-2">Resultado da Execução</h3>
          <div className="bg-gray-50 rounded-lg p-3 max-h-40 overflow-y-auto">
            {executionResult.error ? (
              <div className="text-red-600 text-sm">
                Erro: {executionResult.error}
              </div>
            ) : (
              <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                {JSON.stringify(executionResult, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkflowBuilder;