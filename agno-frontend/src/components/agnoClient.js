// agnoClient.js - Cliente Agno Corrigido v3.0
// Corrige problemas de streaming e adiciona logs detalhados

import { useState, useEffect } from 'react';

class AgnoClient {
  constructor(baseURL = 'http://localhost:8000') {
    this.baseURL = baseURL;
    this.userId = 1;
    this.eventListeners = new Map();
    this.requestQueue = new Map();
    this.connectionTimeout = 30000; // 30 segundos
    this.streamingTimeout = 60000;  // 60 segundos para streaming
    this.debugMode = true;
  }

  setUserId(userId) {
    this.userId = userId;
    this.log('info', `User ID configurado para: ${userId}`);
  }

  setDebugMode(enabled) {
    this.debugMode = enabled;
    this.log('info', `Debug mode ${enabled ? 'ativado' : 'desativado'}`);
  }

  // Sistema de logging melhorado
  log(level, message, data = null) {
    if (!this.debugMode && level === 'debug') return;

    const timestamp = new Date().toLocaleTimeString();
    const emoji = {
      debug: '🔍',
      info: '📝',
      warn: '⚠️',
      error: '❌',
      success: '✅',
      stream: '🌊'
    }[level] || '📝';

    console.log(`${emoji} [${timestamp}] AgnoClient.${level.toUpperCase()}: ${message}`);

    if (data) {
      console.log('📊 Data:', data);
    }

    // Emitir evento de log para o frontend
    this.emit('log', { level, message, data, timestamp });
  }

  // Função helper para formatar erros
  formatError(error, context = '') {
    if (typeof error === 'string') {
      return error;
    }

    if (error && typeof error === 'object') {
      // Se é um AbortError (timeout)
      if (error.name === 'AbortError') {
        return `Timeout: ${context || 'Operação'} cancelada por tempo limite`;
      }

      // Se é um objeto Response
      if (error.status) {
        return `HTTP ${error.status}: ${error.statusText || 'Unknown error'}`;
      }

      // Se tem uma propriedade message
      if (error.message) {
        return error.message;
      }

      // Se tem detail (padrão FastAPI)
      if (error.detail) {
        return typeof error.detail === 'string' ? error.detail : JSON.stringify(error.detail);
      }

      // Tentar converter para string de forma legível
      try {
        return JSON.stringify(error);
      } catch {
        return error.toString();
      }
    }

    return `Unknown error${context ? ` in ${context}` : ''}`;
  }

  // Fazer requisições HTTP com retry automático
  async makeRequest(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const requestId = `${endpoint}_${Date.now()}`;

    const config = {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers,
      },
      mode: 'cors',
      credentials: 'omit',
      ...options,
    };

    // Adicionar user_id como query parameter para GET requests
    const urlWithUser = new URL(url);
    if (options.method !== 'POST' || !options.body) {
      urlWithUser.searchParams.append('user_id', this.userId);
    }

    const maxRetries = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.log('debug', `[Tentativa ${attempt}/${maxRetries}] ${options.method || 'GET'}: ${urlWithUser.toString()}`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          this.log('warn', `Request timeout após ${this.connectionTimeout}ms`);
          controller.abort();
        }, this.connectionTimeout);

        try {
          const response = await fetch(urlWithUser.toString(), {
            ...config,
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          this.log('debug', `Resposta recebida: ${response.status} ${response.statusText}`);

          if (!response.ok) {
            let errorData;
            try {
              errorData = await response.json();
            } catch {
              errorData = {
                detail: `HTTP ${response.status}: ${response.statusText}`,
                status: response.status
              };
            }
            throw errorData;
          }

          const data = await response.json();
          this.log('success', `Requisição bem-sucedida para ${endpoint}`);
          return data;

        } catch (error) {
          clearTimeout(timeoutId);
          throw error;
        }

      } catch (error) {
        lastError = error;
        const errorMessage = this.formatError(error, `${endpoint} (tentativa ${attempt})`);

        if (attempt === maxRetries) {
          this.log('error', `Falha definitiva após ${maxRetries} tentativas: ${errorMessage}`);
        } else {
          this.log('warn', `Tentativa ${attempt} falhou: ${errorMessage}. Tentando novamente...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }

    const finalErrorMessage = this.formatError(lastError, endpoint);
    throw new Error(finalErrorMessage);
  }

  // STREAMING CORRIGIDO - Esta é a função principal que estava com problema
  async makeStreamingRequest(endpoint, data, onChunk, onComplete, onError) {
    const url = `${this.baseURL}${endpoint}?user_id=${this.userId}`;
    const requestId = `stream_${Date.now()}`;

    try {
      this.log('stream', `Iniciando streaming para: ${url}`, data);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        this.log('error', `Streaming timeout após ${this.streamingTimeout}ms`);
        controller.abort();
      }, this.streamingTimeout);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/plain, application/json',
          'Cache-Control': 'no-cache',
        },
        mode: 'cors',
        credentials: 'omit',
        body: JSON.stringify(data),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      this.log('stream', `Status do streaming: ${response.status}`);

      if (!response.ok) {
        let errorMessage;
        try {
          const errorData = await response.json();
          errorMessage = this.formatError(errorData, 'streaming request');
        } catch {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      if (!response.body) {
        throw new Error('Streaming não suportado - resposta sem body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let chunkCount = 0;
      let totalContent = '';

      this.log('stream', 'Iniciando leitura do stream...');

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            this.log('stream', `Stream concluído após ${chunkCount} chunks`);
            break;
          }

          chunkCount++;
          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;

          // Processar linhas completas
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Manter a última linha incompleta no buffer

          for (const line of lines) {
            if (line.trim() === '') continue;

            this.log('debug', `Processando linha: ${line.substring(0, 100)}...`);

            if (line.startsWith('data: ')) {
              try {
                const jsonData = line.slice(6);
                const parsed = JSON.parse(jsonData);

                this.log('stream', `Chunk estruturado recebido:`, parsed);

                if (parsed.type === 'chunk' && parsed.content) {
                  totalContent += parsed.content;
                  onChunk(parsed.content);
                } else if (parsed.type === 'complete') {
                  this.log('success', 'Stream marcado como completo');
                  onComplete(parsed);
                  return;
                } else if (parsed.type === 'error') {
                  const errorMessage = this.formatError(parsed, 'stream error');
                  this.log('error', `Erro no stream: ${errorMessage}`);
                  onError(new Error(errorMessage));
                  return;
                }
              } catch (parseError) {
                this.log('warn', `Erro ao parsear chunk JSON: ${parseError.message}`);
                // Se não conseguir parsear como JSON, tratar como texto simples
                const content = line.startsWith('data: ') ? line.slice(6) : line;
                if (content.trim() && !content.includes('{')) {
                  totalContent += content;
                  onChunk(content);
                }
              }
            } else if (line.trim() && !line.startsWith(':')) {
              // Linha de texto simples (não SSE)
              this.log('stream', `Linha não-SSE: ${line.substring(0, 50)}...`);
              totalContent += line + '\n';
              onChunk(line + '\n');
            }
          }
        }

        // Se recebemos chunks mas não houve sinal explícito de completion
        if (chunkCount > 0) {
          this.log('success', 'Stream finalizado implicitamente');
          onComplete({
            session_id: `session_${Date.now()}`,
            total_chunks: chunkCount,
            total_content: totalContent
          });
        } else {
          this.log('warn', 'Stream finalizado sem chunks recebidos');
          onError(new Error('Stream finalizado sem receber dados'));
        }

      } finally {
        reader.releaseLock();
      }

    } catch (error) {
      const errorMessage = this.formatError(error, 'streaming');
      this.log('error', `Erro no streaming: ${errorMessage}`);
      onError(new Error(errorMessage));
    }
  }

  // AGENTS API
  async createAgent(agentData) {
    this.log('info', 'Criando agente:', agentData);

    if (!agentData.name || !agentData.role) {
      throw new Error('Nome e papel são obrigatórios');
    }

    // Garantir que instructions seja um array
    if (typeof agentData.instructions === 'string') {
      agentData.instructions = [agentData.instructions];
    }

    return this.makeRequest('/api/agents/create', {
      method: 'POST',
      body: JSON.stringify(agentData),
    });
  }

  async listAgents() {
    this.log('info', 'Listando agentes...');
    return this.makeRequest('/api/agents');
  }

  async chatWithAgent(agentId, message, onChunk, onComplete, onError) {
    this.log('info', `Iniciando chat com agente ${agentId}:`, { message: message.substring(0, 100) + '...' });

    if (!agentId || !message.trim()) {
      const error = new Error('ID do agente e mensagem são obrigatórios');
      this.log('error', error.message);
      if (onError) onError(error);
      return;
    }

    // Wrappers seguros para os callbacks
    const safeOnChunk = (chunk) => {
      this.log('stream', `Chunk recebido: "${chunk.substring(0, 50)}..."`);
      if (onChunk) onChunk(chunk);
    };

    const safeOnComplete = (data) => {
      this.log('success', 'Chat com agente concluído:', data);
      if (onComplete) onComplete(data);
    };

    const safeOnError = (error) => {
      const errorMessage = this.formatError(error, 'agent chat');
      this.log('error', `Erro no chat com agente: ${errorMessage}`);
      if (onError) onError(new Error(errorMessage));
    };

    return this.makeStreamingRequest(
      `/api/agents/${agentId}/chat`,
      { message: message.trim() },
      safeOnChunk,
      safeOnComplete,
      safeOnError
    );
  }

  // WORKFLOWS API
  async createWorkflow(workflowData) {
    this.log('info', 'Criando workflow:', workflowData);

    if (!workflowData.name) {
      throw new Error('Nome do workflow é obrigatório');
    }

    return this.makeRequest('/api/workflows/create', {
      method: 'POST',
      body: JSON.stringify(workflowData),
    });
  }

  async listWorkflows() {
    this.log('info', 'Listando workflows...');
    return this.makeRequest('/api/workflows');
  }

  // HEALTH CHECK
  async healthCheck() {
    this.log('info', 'Verificando saúde do sistema...');
    try {
      const result = await this.makeRequest('/');
      this.log('success', 'Sistema saudável:', result);
      return result;
    } catch (error) {
      const errorMessage = this.formatError(error, 'health check');
      this.log('error', `Sistema com problemas: ${errorMessage}`);
      throw new Error(errorMessage);
    }
  }

  // Testar conectividade básica
  async testConnection() {
    try {
      this.log('info', 'Testando conectividade básica...');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(this.baseURL, {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        this.log('success', 'Backend acessível:', data);
        return true;
      } else {
        this.log('warn', `Backend respondeu com erro: ${response.status}`);
        return false;
      }
    } catch (error) {
      const errorMessage = this.formatError(error, 'connection test');
      this.log('error', `Backend inacessível: ${errorMessage}`);
      return false;
    }
  }

  // EVENT EMITTER PATTERN
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
    this.log('debug', `Listener adicionado para evento: ${event}`);
  }

  off(event, callback) {
    if (this.eventListeners.has(event)) {
      const listeners = this.eventListeners.get(event);
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
        this.log('debug', `Listener removido para evento: ${event}`);
      }
    }
  }

  emit(event, data) {
    if (this.eventListeners.has(event)) {
      this.log('debug', `Emitindo evento: ${event}`, data);
      this.eventListeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          const errorMessage = this.formatError(error, `event listener for ${event}`);
          this.log('error', `Erro no listener do evento ${event}: ${errorMessage}`);
        }
      });
    }
  }

  getConnectionInfo() {
    return {
      baseURL: this.baseURL,
      userId: this.userId,
      connectionTimeout: this.connectionTimeout,
      streamingTimeout: this.streamingTimeout,
      debugMode: this.debugMode,
      activeListeners: Array.from(this.eventListeners.keys()),
      queuedRequests: this.requestQueue.size
    };
  }

  // Método para configurar callbacks de log global
  setLogCallback(callback) {
    this.on('log', callback);
  }

  removeLogCallback(callback) {
    this.off('log', callback);
  }
}

// Hook React para usar o cliente Agno
export const useAgnoClient = () => {
  const [client] = useState(() => new AgnoClient());
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [lastError, setLastError] = useState(null);

  useEffect(() => {
    let mounted = true;

    const checkConnection = async () => {
      try {
        setConnectionStatus('connecting');
        setLastError(null);

        const connected = await client.testConnection();

        if (mounted) {
          setIsConnected(connected);
          setConnectionStatus(connected ? 'connected' : 'disconnected');

          if (connected) {
            try {
              await client.healthCheck();
              setConnectionStatus('healthy');
            } catch (healthError) {
              client.log('warn', 'Health check falhou:', healthError);
              setConnectionStatus('connected');
            }
          }
        }
      } catch (error) {
        const errorMessage = client.formatError(error, 'connection check');
        client.log('error', `Erro no check de conexão: ${errorMessage}`);
        if (mounted) {
          setIsConnected(false);
          setConnectionStatus('error');
          setLastError(errorMessage);
        }
      }
    };

    checkConnection();
    const interval = setInterval(checkConnection, 30000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [client]);

  return {
    client,
    isConnected,
    connectionStatus,
    lastError,
    refresh: () => {
      setConnectionStatus('connecting');
      client.testConnection().then(connected => {
        setIsConnected(connected);
        setConnectionStatus(connected ? 'connected' : 'disconnected');
      }).catch(error => {
        const errorMessage = client.formatError(error, 'manual refresh');
        setLastError(errorMessage);
        setConnectionStatus('error');
      });
    }
  };
};

// Instância global do cliente
export const agnoClientGlobal = new AgnoClient();

// Log de inicialização
agnoClientGlobal.log('success', 'AgnoClient v3.0 inicializado', agnoClientGlobal.getConnectionInfo());

export default AgnoClient;