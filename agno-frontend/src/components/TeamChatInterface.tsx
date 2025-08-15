// agno-frontend/src/components/TeamChatInterface.tsx

import React, { useState, useEffect, useRef } from 'react';
import {
  Send, Bot, User, Loader, MessageSquare, Clock, CheckCircle,
  AlertCircle, RefreshCw, Settings, BarChart3, Play, Users,
  Copy, Download, X, Maximize2, Minimize2
} from 'lucide-react';

interface Team {
  id: string;
  name: string;
  description: string;
  team_type: 'collaborative' | 'hierarchical' | 'sequential';
  agent_count: number;
  agents: Array<{
    id: string;
    name: string;
    role: string;
    role_in_team?: string;
  }>;
}

interface ChatMessage {
  id: string;
  type: 'user' | 'team' | 'system';
  content: string;
  timestamp: Date;
  team_name?: string;
  execution_id?: string;
  execution_time?: number;
  agents_used?: number;
  status?: 'sending' | 'completed' | 'error';
}

interface TeamChatProps {
  teams: Team[];
  onExecuteTeam: (teamId: string, message: string) => Promise<any>;
  className?: string;
}

const TeamChatInterface: React.FC<TeamChatProps> = ({
  teams,
  onExecuteTeam,
  className = ''
}) => {
  // States
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Add system message
  const addSystemMessage = (content: string) => {
    const message: ChatMessage = {
      id: Date.now().toString(),
      type: 'system',
      content,
      timestamp: new Date(),
      status: 'completed'
    };
    setMessages(prev => [...prev, message]);
  };

  // Handle team selection
  const handleTeamSelect = (team: Team) => {
    setSelectedTeam(team);
    addSystemMessage(`Team "${team.name}" selecionado. ${team.agent_count} agentes disponíveis.`);
  };

  // Handle message send
  const handleSendMessage = async () => {
    if (!currentMessage.trim() || !selectedTeam || isExecuting) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      type: 'user',
      content: currentMessage,
      timestamp: new Date(),
      status: 'completed'
    };

    setMessages(prev => [...prev, userMessage]);
    setCurrentMessage('');
    setIsExecuting(true);

    const teamResponseId = `team-${Date.now()}`;
    const teamMessage: ChatMessage = {
      id: teamResponseId,
      type: 'team',
      content: 'Processando...',
      timestamp: new Date(),
      team_name: selectedTeam.name,
      status: 'sending'
    };

    setMessages(prev => [...prev, teamMessage]);

    try {
      const startTime = Date.now();
      const response = await onExecuteTeam(selectedTeam.id, userMessage.content);
      const executionTime = Date.now() - startTime;

      setMessages(prev => prev.map(msg =>
        msg.id === teamResponseId
          ? {
              ...msg,
              content: response.response || 'Processamento concluído',
              execution_time: executionTime,
              agents_used: selectedTeam.agents.length,
              status: 'completed'
            }
          : msg
      ));
    } catch (error: any) {
      setMessages(prev => prev.map(msg =>
        msg.id === teamResponseId
          ? {
              ...msg,
              content: `Erro: ${error.message}`,
              status: 'error'
            }
          : msg
      ));
    } finally {
      setIsExecuting(false);
      inputRef.current?.focus();
    }
  };

  // Copy message to clipboard
  const copyToClipboard = (content: string) => {
    navigator.clipboard.writeText(content);
    // You could add a toast notification here
  };

  // Export chat history
  const exportChatHistory = () => {
    const chatData = JSON.stringify(messages, null, 2);
    const blob = new Blob([chatData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-history-${selectedTeam?.name || 'team'}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`flex flex-col bg-white rounded-lg border shadow-lg ${className} ${
      isExpanded ? 'fixed inset-4 z-50' : 'h-[600px]'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-gray-50">
        <div className="flex items-center space-x-3">
          <Users className="w-5 h-5 text-blue-600" />
          <h2 className="font-semibold">Team Chat Interface</h2>
          {selectedTeam && (
            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-sm rounded">
              {selectedTeam.name}
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {messages.length > 0 && (
            <button
              onClick={exportChatHistory}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Exportar histórico"
            >
              <Download className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Team Selection */}
      {!selectedTeam && (
        <div className="flex-1 p-6">
          <h3 className="font-medium mb-4">Selecione um time para começar:</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {teams.map(team => (
              <button
                key={team.id}
                onClick={() => handleTeamSelect(team)}
                className="p-4 border rounded-lg hover:bg-gray-50 hover:border-blue-300 transition-all text-left"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-medium">{team.name}</h4>
                    <p className="text-sm text-gray-600 mt-1">{team.description}</p>
                  </div>
                  <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                    {team.agent_count} agentes
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {team.agents.slice(0, 3).map(agent => (
                    <span key={agent.id} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded">
                      {agent.name}
                    </span>
                  ))}
                  {team.agents.length > 3 && (
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                      +{team.agents.length - 3} mais
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat Messages */}
      {selectedTeam && (
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map(message => (
              <div
                key={message.id}
                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[70%] ${
                  message.type === 'user' ? 'order-2' : ''
                }`}>
                  {/* Message Header */}
                  <div className={`flex items-center space-x-2 mb-1 ${
                    message.type === 'user' ? 'justify-end' : ''
                  }`}>
                    {message.type === 'team' && (
                      <Bot className="w-4 h-4 text-blue-600" />
                    )}
                    {message.type === 'user' && (
                      <User className="w-4 h-4 text-gray-600" />
                    )}
                    {message.type === 'system' && (
                      <Settings className="w-4 h-4 text-gray-500" />
                    )}
                    <span className="text-xs text-gray-500">
                      {message.type === 'team' && message.team_name}
                      {message.type === 'user' && 'Você'}
                      {message.type === 'system' && 'Sistema'}
                    </span>
                    <span className="text-xs text-gray-400">
                      {message.timestamp.toLocaleTimeString()}
                    </span>
                  </div>

                  {/* Message Content */}
                  <div className={`rounded-lg p-3 ${
                    message.type === 'user'
                      ? 'bg-blue-600 text-white'
                      : message.type === 'system'
                      ? 'bg-gray-100 text-gray-700'
                      : 'bg-gray-100 text-gray-900'
                  }`}>
                    {message.status === 'sending' ? (
                      <div className="flex items-center space-x-2">
                        <Loader className="w-4 h-4 animate-spin" />
                        <span>Processando...</span>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    )}
                  </div>

                  {/* Message Footer */}
                  {message.type === 'team' && message.status === 'completed' && (
                    <div className="flex items-center space-x-3 mt-2 text-xs text-gray-500">
                      {message.execution_time && (
                        <span className="flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>{(message.execution_time / 1000).toFixed(2)}s</span>
                        </span>
                      )}
                      {message.agents_used && (
                        <span className="flex items-center space-x-1">
                          <Users className="w-3 h-3" />
                          <span>{message.agents_used} agentes</span>
                        </span>
                      )}
                      <button
                        onClick={() => copyToClipboard(message.content)}
                        className="flex items-center space-x-1 hover:text-gray-700"
                      >
                        <Copy className="w-3 h-3" />
                        <span>Copiar</span>
                      </button>
                    </div>
                  )}

                  {message.status === 'error' && (
                    <div className="flex items-center space-x-2 mt-2 text-xs text-red-600">
                      <AlertCircle className="w-3 h-3" />
                      <span>Erro ao processar mensagem</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 border-t bg-gray-50">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => {
                  setSelectedTeam(null);
                  setMessages([]);
                }}
                className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                title="Trocar time"
              >
                <RefreshCw className="w-4 h-4" />
              </button>

              <input
                ref={inputRef}
                type="text"
                value={currentMessage}
                onChange={(e) => setCurrentMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Digite sua mensagem..."
                disabled={isExecuting}
                className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
              />

              <button
                onClick={handleSendMessage}
                disabled={!currentMessage.trim() || isExecuting}
                className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isExecuting ? (
                  <Loader className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>

            {/* Team Info */}
            <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
              <span>
                Time: {selectedTeam.name} ({selectedTeam.team_type})
              </span>
              <span>
                {selectedTeam.agents.length} agentes ativos
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default TeamChatInterface;