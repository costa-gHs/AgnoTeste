// agnoClient_fixed.js - Cliente Agno Corrigido com Tratamento de Erros Aprimorado

import { useState, useEffect } from 'react';

class AgnoClient {
  constructor(baseURL = 'http://localhost:8000') {
    this.baseURL = baseURL;
    this.userId = 1;
    this.eventListeners = new Map();
    this.requestQueue = new Map();
    this.connectionTimeout = 15000; // 15 segundos
  }

  setUserId(userId) {
    this.userId = userId;
    console.log(`🔧 User ID configurado para: ${userId}`);
  }

  // Função helper para formatar erros de forma consistente
  formatError(error, context = '') {
    if (typeof error === 'string') {
      return error;
    }

    if (error && typeof error === 'object') {
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

  // Fazer requisições HTTP com retry automático e melhor tratamento de erros
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
        console.log(`🌐 [Tentativa ${attempt}/${maxRetries}] ${options.method || 'GET'}: ${urlWithUser.toString()}`);

        // Create timeout promise
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.connectionTimeout);

        try {
          const response = await fetch(urlWithUser.toString(), {
            ...config,
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          console.log(`📡 Resposta recebida: ${response.status} ${response.statusText}`);

          if (!response.ok) {
            let errorData;
            try {
              const contentType = response.headers.get('content-type');
              if (contentType && contentType.includes('application/json')) {
                errorData = await response.json();
              } else {
                const text = await response.text();
                errorData = { message: text || `HTTP ${response.status}: ${response.statusText}` };
              }
            } catch (parseError) {
              console.warn('Erro ao parsear resposta de erro:', parseError);
              errorData = { message: `HTTP ${response.status}: ${response.statusText}` };
            }

            const errorMessage = this.formatError(errorData, `${options.method || 'GET'} ${endpoint}`);
            const error = new Error(errorMessage);
            error.status = response.status;
            error.response = response;
            throw error;
          }

          const contentType = response.headers.get('content-type');
          let data;

          try {
            if (contentType && contentType.includes('application/json')) {
              data = await response.json();
            } else {
              data = await response.text();
            }
          } catch (parseError) {
            console.warn('Erro ao parsear resposta:', parseError);
            data = await response.text();
          }

          console.log(`✅ Dados recebidos:`, data);
          return data;

        } catch (fetchError) {
          clearTimeout(timeoutId);

          if (fetchError.name === 'AbortError') {
            throw new Error(`Request timeout after ${this.connectionTimeout}ms`);
          }

          throw fetchError;
        }

      } catch (error) {
        lastError = error;
        const errorMessage = this.formatError(error, `attempt ${attempt}/${maxRetries}`);
        console.error(`❌ [Tentativa ${attempt}/${maxRetries}] Erro: "${errorMessage}"`);

        // Se é erro de rede, timeout, ou server error, tentar novamente
        if (attempt < maxRetries && (
          error.name === 'TypeError' ||
          error.name === 'AbortError' ||
          error.message.includes('timeout') ||
          error.message.includes('fetch') ||
          error.message.includes('network') ||
          (error.status && error.status >= 500)
        )) {
          const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          console.log(`⏳ Aguardando ${delayMs}ms antes da próxima tentativa...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
          continue;
        }

        break;
      }
    }

    // Se chegou aqui, todas as tentativas falharam
    const finalErrorMessage = this.formatError(lastError, 'all retry attempts failed');
    console.error('❌ Todas as tentativas falharam:', finalErrorMessage);

    if (lastError && (lastError.name === 'TypeError' || lastError.message.includes('fetch'))) {
      throw new Error(`Não foi possível conectar com o servidor em ${this.baseURL}. Verifique se o backend está rodando na porta 8000.`);
    }

    throw new Error(finalErrorMessage);
  }

  // Fazer requisição de streaming com melhor tratamento de erros
  async makeStreamingRequest(endpoint, data, onChunk, onComplete, onError) {
    const url = `${this.baseURL}${endpoint}?user_id=${this.userId}`;

    try {
      console.log(`🌊 Iniciando streaming para: ${url}`);
      console.log(`📤 Dados enviados:`, data);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.connectionTimeout);

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

      console.log(`📡 Status do streaming: ${response.status}`);

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

      console.log('🔄 Iniciando leitura do stream...');

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            console.log(`✅ Stream concluído após ${chunkCount} chunks`);
            break;
          }

          chunkCount++;
          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;

          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.trim() === '') continue;

            if (line.startsWith('data: ')) {
              try {
                const jsonData = line.slice(6);
                const parsed = JSON.parse(jsonData);

                console.log(`📨 Chunk recebido:`, parsed);

                if (parsed.type === 'chunk' && parsed.content) {
                  onChunk(parsed.content);
                } else if (parsed.type === 'complete') {
                  console.log('🏁 Stream marcado como completo');
                  onComplete(parsed);
                  return;
                } else if (parsed.type === 'error') {
                  const errorMessage = this.formatError(parsed, 'stream error');
                  console.error('❌ Erro no stream:', errorMessage);
                  onError(new Error(errorMessage));
                  return;
                }
              } catch (parseError) {
                console.warn('⚠️ Erro ao parsear chunk JSON:', parseError);
                const content = line.startsWith('data: ') ? line.slice(6) : line;
                if (content.trim() && !content.includes('{')) {
                  onChunk(content);
                }
              }
            } else if (line.trim() && !line.startsWith(':')) {
              console.log(`📄 Linha não-SSE:`, line);
              onChunk(line + '\n');
            }
          }
        }

        if (chunkCount > 0) {
          console.log('🏁 Stream finalizado implicitamente');
          onComplete({ session_id: `session_${Date.now()}` });
        }

      } finally {
        reader.releaseLock();
      }

    } catch (error) {
      const errorMessage = this.formatError(error, 'streaming');
      console.error('❌ Erro no streaming:', errorMessage);
      onError(new Error(errorMessage));
    }
  }

  // AGENTS API
  async createAgent(agentData) {
    console.log('🤖 Criando agente:', agentData);

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
    console.log('📋 Listando agentes...');
    return this.makeRequest('/api/agents');
  }

  async chatWithAgent(agentId, message, onChunk, onComplete, onError) {
    console.log(`💬 Iniciando chat com agente ${agentId}:`, message);

    if (!agentId || !message.trim()) {
      const error = new Error('ID do agente e mensagem são obrigatórios');
      if (onError) onError(error);
      return;
    }

    const safeOnComplete = (data) => {
      console.log('✅ Chat com agente concluído:', data);
      if (onComplete) onComplete(data);
    };

    const safeOnError = (error) => {
      const errorMessage = this.formatError(error, 'agent chat');
      console.error('❌ Erro no chat com agente:', errorMessage);
      if (onError) onError(new Error(errorMessage));
    };

    return this.makeStreamingRequest(
      `/api/agents/${agentId}/chat`,
      { message: message.trim() },
      onChunk,
      safeOnComplete,
      safeOnError
    );
  }

  // WORKFLOWS API
  async createWorkflow(workflowData) {
    console.log('🔄 Criando workflow:', workflowData);

    if (!workflowData.name) {
      throw new Error('Nome do workflow é obrigatório');
    }

    return this.makeRequest('/api/workflows/create', {
      method: 'POST',
      body: JSON.stringify(workflowData),
    });
  }

  async listWorkflows() {
    console.log('📋 Listando workflows...');
    return this.makeRequest('/api/workflows');
  }

  // SESSIONS API
  async listSessions() {
    console.log('📋 Listando sessões...');
    return this.makeRequest('/api/sessions');
  }

  // METRICS API
  async getMetrics() {
    console.log('📊 Buscando métricas...');
    return this.makeRequest('/api/metrics');
  }

  async getPerformanceData(hours = 24) {
    console.log(`📈 Buscando dados de performance (${hours}h)...`);
    return this.makeRequest(`/api/performance?hours=${hours}`);
  }

  // HEALTH CHECK
  async healthCheck() {
    console.log('🏥 Verificando saúde do sistema...');
    try {
      const result = await this.makeRequest('/api/health');
      console.log('✅ Sistema saudável:', result);
      return result;
    } catch (error) {
      const errorMessage = this.formatError(error, 'health check');
      console.error('❌ Sistema com problemas:', errorMessage);
      throw new Error(errorMessage);
    }
  }

  // Testar conectividade básica
  async testConnection() {
    try {
      console.log('🧪 Testando conectividade básica...');

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
        console.log('✅ Backend acessível:', data);
        return true;
      } else {
        console.log(`⚠️ Backend respondeu com erro: ${response.status}`);
        return false;
      }
    } catch (error) {
      const errorMessage = this.formatError(error, 'connection test');
      console.error('❌ Backend inaccessível:', errorMessage);
      return false;
    }
  }

  // EVENT EMITTER PATTERN
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
    console.log(`📡 Listener adicionado para evento: ${event}`);
  }

  off(event, callback) {
    if (this.eventListeners.has(event)) {
      const listeners = this.eventListeners.get(event);
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
        console.log(`📡 Listener removido para evento: ${event}`);
      }
    }
  }

  emit(event, data) {
    if (this.eventListeners.has(event)) {
      console.log(`📡 Emitindo evento: ${event}`, data);
      this.eventListeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          const errorMessage = this.formatError(error, `event listener for ${event}`);
          console.error(`❌ Erro no listener do evento ${event}:`, errorMessage);
        }
      });
    }
  }

  getConnectionInfo() {
    return {
      baseURL: this.baseURL,
      userId: this.userId,
      connectionTimeout: this.connectionTimeout,
      activeListeners: Array.from(this.eventListeners.keys()),
      queuedRequests: this.requestQueue.size
    };
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
              console.warn('Health check falhou:', healthError);
              setConnectionStatus('connected');
            }
          }
        }
      } catch (error) {
        const errorMessage = client.formatError(error, 'connection check');
        console.error('Erro no check de conexão:', errorMessage);
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
console.log('🚀 AgnoClient v2.0 inicializado:', agnoClientGlobal.getConnectionInfo());

export default AgnoClient;