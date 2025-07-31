import React, { useState, useRef, useCallback } from 'react';
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
  Copy
} from 'lucide-react';

const WorkflowBuilder = () => {
  const [nodes, setNodes] = useState([]);
  const [connections, setConnections] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [draggedNode, setDraggedNode] = useState(null);
  const [workflowConfig, setWorkflowConfig] = useState({
    name: 'Novo Workflow',
    description: '',
    flowType: 'sequential'
  });
  const [showNodeConfig, setShowNodeConfig] = useState(false);
  const canvasRef = useRef(null);
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });

  const nodeTypes = [
    {
      id: 'agent',
      name: 'AI Agent',
      icon: Bot,
      color: 'bg-blue-500',
      description: 'Agente individual com tools específicas'
    },
    {
      id: 'condition',
      name: 'Condição',
      icon: GitBranch,
      color: 'bg-yellow-500',
      description: 'Lógica condicional no workflow'
    },
    {
      id: 'parallel',
      name: 'Paralelo',
      icon: Zap,
      color: 'bg-green-500',
      description: 'Execução paralela de agentes'
    }
  ];

  const addNode = (type, position = null) => {
    const newNode = {
      id: `node_${Date.now()}`,
      type: type.id,
      name: `${type.name} ${nodes.length + 1}`,
      position: position || {
        x: Math.random() * 400 + 100,
        y: Math.random() * 300 + 100
      },
      config: {
        modelProvider: 'openai',
        modelId: 'gpt-4o',
        tools: [],
        instructions: [''],
        role: ''
      },
      ...type
    };

    setNodes(prev => [...prev, newNode]);
    setSelectedNode(newNode);
    setShowNodeConfig(true);
  };

  const deleteNode = (nodeId) => {
    setNodes(prev => prev.filter(n => n.id !== nodeId));
    setConnections(prev => prev.filter(c => c.from !== nodeId && c.to !== nodeId));
    if (selectedNode?.id === nodeId) {
      setSelectedNode(null);
      setShowNodeConfig(false);
    }
  };

  const connectNodes = (fromId, toId) => {
    const exists = connections.some(c => c.from === fromId && c.to === toId);
    if (!exists && fromId !== toId) {
      setConnections(prev => [...prev, { from: fromId, to: toId, id: `conn_${Date.now()}` }]);
    }
  };

  const NodeComponent = ({ node, isSelected, onSelect, onDrag, onConnect }) => {
    const IconComponent = node.icon;

    return (
      <div
        className={`absolute cursor-move select-none ${isSelected ? 'z-20' : 'z-10'}`}
        style={{ left: node.position.x, top: node.position.y }}
        onMouseDown={(e) => onDrag(e, node)}
        onClick={() => onSelect(node)}
      >
        <div
          className={`
            w-32 p-3 rounded-lg shadow-lg border-2 transition-all
            ${isSelected 
              ? 'border-blue-500 shadow-xl' 
              : 'border-gray-200 hover:border-gray-300'
            }
            bg-white
          `}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className={`p-1 rounded ${node.color} text-white`}>
              <IconComponent className="w-4 h-4" />
            </div>
            <span className="text-xs font-medium truncate">{node.name}</span>
          </div>

          <div className="text-xs text-gray-500 mb-2">
            {node.type === 'agent' && `${node.config.modelId}`}
            {node.type === 'condition' && 'If/Else Logic'}
            {node.type === 'parallel' && 'Parallel Exec'}
          </div>

          <div className="flex justify-between items-center">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedNode(node);
                setShowNodeConfig(true);
              }}
              className="p-1 text-gray-400 hover:text-gray-600"
            >
              <Settings className="w-3 h-3" />
            </button>

            <div className="flex gap-1">
              <div
                className="w-2 h-2 bg-green-400 rounded-full cursor-pointer hover:bg-green-500"
                title="Conectar saída"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  // Lógica para iniciar conexão
                }}
              />
              <div
                className="w-2 h-2 bg-red-400 rounded-full cursor-pointer hover:bg-red-500"
                title="Conectar entrada"
              />
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                deleteNode(node.id);
              }}
              className="p-1 text-gray-400 hover:text-red-600"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  const ConnectionComponent = ({ connection }) => {
    const fromNode = nodes.find(n => n.id === connection.from);
    const toNode = nodes.find(n => n.id === connection.to);

    if (!fromNode || !toNode) return null;

    const startX = fromNode.position.x + 64; // Centro do nó
    const startY = fromNode.position.y + 32;
    const endX = toNode.position.x + 64;
    const endY = toNode.position.y + 32;

    return (
      <svg className="absolute inset-0 pointer-events-none z-0">
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon
              points="0 0, 10 3.5, 0 7"
              fill="#6b7280"
            />
          </marker>
        </defs>
        <path
          d={`M ${startX} ${startY} Q ${(startX + endX) / 2} ${startY - 50} ${endX} ${endY}`}
          stroke="#6b7280"
          strokeWidth="2"
          fill="none"
          markerEnd="url(#arrowhead)"
        />
      </svg>
    );
  };

  const NodeConfigPanel = () => {
    if (!selectedNode) return null;

    const updateNodeConfig = (updates) => {
      setNodes(prev => prev.map(node =>
        node.id === selectedNode.id
          ? { ...node, config: { ...node.config, ...updates } }
          : node
      ));
      setSelectedNode(prev => ({ ...prev, config: { ...prev.config, ...updates } }));
    };

    const updateNodeName = (name) => {
      setNodes(prev => prev.map(node =>
        node.id === selectedNode.id ? { ...node, name } : node
      ));
      setSelectedNode(prev => ({ ...prev, name }));
    };

    return (
      <div className="w-80 bg-white border-l border-gray-200 p-4 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Configurar Nó</h3>
          <button
            onClick={() => setShowNodeConfig(false)}
            className="p-1 text-gray-400 hover:text-gray-600"
          >
            ×
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nome do Nó
            </label>
            <input
              type="text"
              value={selectedNode.name}
              onChange={(e) => updateNodeName(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {selectedNode.type === 'agent' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Papel/Função
                </label>
                <input
                  type="text"
                  value={selectedNode.config.role}
                  onChange={(e) => updateNodeConfig({ role: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: Marketing Specialist"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Provedor
                  </label>
                  <select
                    value={selectedNode.config.modelProvider}
                    onChange={(e) => updateNodeConfig({ modelProvider: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Modelo
                  </label>
                  <select
                    value={selectedNode.config.modelId}
                    onChange={(e) => updateNodeConfig({ modelId: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {selectedNode.config.modelProvider === 'openai' ? (
                      <>
                        <option value="gpt-4o">GPT-4o</option>
                        <option value="gpt-4o-mini">GPT-4o Mini</option>
                        <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                      </>
                    ) : (
                      <>
                        <option value="claude-3-opus">Claude 3 Opus</option>
                        <option value="claude-3-sonnet">Claude 3 Sonnet</option>
                        <option value="claude-3-haiku">Claude 3 Haiku</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Instruções
                </label>
                <textarea
                  value={selectedNode.config.instructions[0] || ''}
                  onChange={(e) => updateNodeConfig({ instructions: [e.target.value] })}
                  className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows="3"
                  placeholder="Descreva como este agente deve se comportar..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ferramentas
                </label>
                <div className="space-y-2">
                  {['duckduckgo', 'yfinance', 'reasoning'].map(tool => (
                    <label key={tool} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedNode.config.tools.includes(tool)}
                        onChange={(e) => {
                          const tools = e.target.checked
                            ? [...selectedNode.config.tools, tool]
                            : selectedNode.config.tools.filter(t => t !== tool);
                          updateNodeConfig({ tools });
                        }}
                        className="mr-2"
                      />
                      <span className="text-sm capitalize">{tool}</span>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}

          {selectedNode.type === 'condition' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Condição
              </label>
              <textarea
                value={selectedNode.config.condition || ''}
                onChange={(e) => updateNodeConfig({ condition: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows="3"
                placeholder="Defina a lógica condicional..."
              />
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-6 pt-4 border-t">
          <button
            onClick={() => {
              const newNode = { ...selectedNode, id: `node_${Date.now()}` };
              newNode.position.x += 50;
              newNode.position.y += 50;
              setNodes(prev => [...prev, newNode]);
            }}
            className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 text-sm rounded hover:bg-gray-200 flex items-center justify-center gap-2"
          >
            <Copy className="w-3 h-3" />
            Duplicar
          </button>
        </div>
      </div>
    );
  };

  const handleCanvasMouseDown = (e) => {
    if (e.target === canvasRef.current) {
      setSelectedNode(null);
      setShowNodeConfig(false);
    }
  };

  const handleNodeDrag = (e, node) => {
    e.preventDefault();
    setDraggedNode(node);

    const handleMouseMove = (e) => {
      const rect = canvasRef.current.getBoundingClientRect();
      const newX = e.clientX - rect.left - canvasOffset.x - 64;
      const newY = e.clientY - rect.top - canvasOffset.y - 32;

      setNodes(prev => prev.map(n =>
        n.id === node.id
          ? { ...n, position: { x: Math.max(0, newX), y: Math.max(0, newY) } }
          : n
      ));
    };

    const handleMouseUp = () => {
      setDraggedNode(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const saveWorkflow = async () => {
    const workflowData = {
      ...workflowConfig,
      nodes: nodes.map(node => ({
        id: node.id,
        type: node.type,
        name: node.name,
        position: node.position,
        config: node.config
      })),
      connections: connections
    };

    console.log('Salvando workflow:', workflowData);
    // Aqui faria a chamada para a API
  };

  return (
    <div className="h-screen bg-gray-50 flex">
      {/* Toolbar */}
      <div className="w-64 bg-white border-r border-gray-200 p-4">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Workflow Builder</h2>
          <input
            type="text"
            value={workflowConfig.name}
            onChange={(e) => setWorkflowConfig(prev => ({ ...prev, name: e.target.value }))}
            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Nome do workflow"
          />
        </div>

        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Adicionar Nós</h3>
          <div className="space-y-2">
            {nodeTypes.map(type => {
              const IconComponent = type.icon;
              return (
                <button
                  key={type.id}
                  onClick={() => addNode(type)}
                  className="w-full p-3 border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-3 text-left"
                >
                  <div className={`p-2 rounded ${type.color} text-white`}>
                    <IconComponent className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-medium text-sm">{type.name}</div>
                    <div className="text-xs text-gray-500">{type.description}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Tipo de Fluxo</h3>
          <select
            value={workflowConfig.flowType}
            onChange={(e) => setWorkflowConfig(prev => ({ ...prev, flowType: e.target.value }))}
            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="sequential">Sequencial</option>
            <option value="parallel">Paralelo</option>
            <option value="conditional">Condicional</option>
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={saveWorkflow}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            Salvar Workflow
          </button>

          <button
            onClick={() => console.log('Testar workflow')}
            className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4" />
            Testar
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative overflow-hidden">
        <div
          ref={canvasRef}
          className="w-full h-full bg-gray-100 relative cursor-default"
          onMouseDown={handleCanvasMouseDown}
          style={{
            backgroundImage: `
              radial-gradient(circle, #d1d5db 1px, transparent 1px)
            `,
            backgroundSize: '20px 20px'
          }}
        >
          {/* Connections */}
          {connections.map(connection => (
            <ConnectionComponent key={connection.id} connection={connection} />
          ))}

          {/* Nodes */}
          {nodes.map(node => (
            <NodeComponent
              key={node.id}
              node={node}
              isSelected={selectedNode?.id === node.id}
              onSelect={setSelectedNode}
              onDrag={handleNodeDrag}
              onConnect={connectNodes}
            />
          ))}

          {nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-gray-500">
                <GitBranch className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">Canvas Vazia</h3>
                <p className="text-sm">Adicione nós da barra lateral para começar a construir seu workflow</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Config Panel */}
      {showNodeConfig && <NodeConfigPanel />}
    </div>
  );
};

export default WorkflowBuilder;