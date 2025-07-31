// agnoClient.js - Cliente para conectar com o backend Agno

class AgnoClient {
  constructor(baseURL = 'http://localhost:8000') {
    this.baseURL = baseURL;
    this.userId = 1; // Pode ser configurado dinamicamente
    this.eventListeners = new Map();
  }

  // Configurar ID do usuário
  setUserId(userId) {
    this.userId = userId;
  }

  // Fazer requisições HTTP
  async makeRequest(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    // Adicionar user_id como query parameter
    const urlWithUser = new URL(url);
    urlWithUser.searchParams.append('user_id', this.userId);

    try {
      const response = await fetch(urlWithUser.toString(), config);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Erro desconhecido' }));
        throw new Error(errorData.detail || errorData.message || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Erro na requisição:', error);
      throw error;
    }
  }

  // Fazer requisição de streaming
  async makeStreamingRequest(endpoint, data, onChunk, onComplete, onError) {
    const url = `${this.baseURL}${endpoint}?user_id=${this.userId}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Mantém a linha incompleta no buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'chunk' && data.content) {
                onChunk(data.content);
              } else if (data.type === 'complete') {
                onComplete(data);
                return;
              } else if (data.type === 'error') {
                onError(new Error(data.message));
                return;
              }
            } catch (e) {
              console.error('Erro ao parsear chunk:', e);
            }
          }
        }
      }
    } catch (error) {
      onError(error);
    }
  }

  // AGENTS API
  async createAgent(agentData) {
    return this.makeRequest('/api/agents/create', {
      method: 'POST',
      body: JSON.stringify(agentData),
    });
  }

  async listAgents() {
    return this.makeRequest('/api/agents');
  }

  async chatWithAgent(agentId, message, onChunk, onComplete, onError) {
    return this.makeStreamingRequest(
      `/api/agents/${agentId}/chat`,
      { message },
      onChunk,
      onComplete,
      onError
    );
  }

  // WORKFLOWS API
  async createWorkflow(workflowData) {
    return this.makeRequest('/api/workflows/create', {
      method: 'POST',
      body: JSON.stringify(workflowData),
    });
  }

  async listWorkflows() {
    return this.makeRequest('/api/workflows');
  }

  async chatWithWorkflow(workflowId, message, onChunk, onComplete, onError) {
    return this.makeStreamingRequest(
      `/api/workflows/${workflowId}/chat`,
      { message },
      onChunk,
      onComplete,
      onError
    );
  }

  // SESSIONS API
  async listSessions() {
    return this.makeRequest('/api/sessions');
  }

  // HEALTH CHECK
  async healthCheck() {
    return this.makeRequest('/api/health');
  }

  // WEBSOCKET CHAT
  createWebSocketChat(type, itemId, onMessage, onError, onClose) {
    const wsUrl = `ws://localhost:8000/ws/${type}/${itemId}?user_id=${this.userId}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log(`WebSocket conectado para ${type}:${itemId}`);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch (error) {
        console.error('Erro ao parsear mensagem WebSocket:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('Erro no WebSocket:', error);
      onError(error);
    };

    ws.onclose = () => {
      console.log('WebSocket fechado');
      onClose();
    };

    return {
      send: (message) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ message }));
        }
      },
      close: () => ws.close()
    };
  }

  // EVENT EMITTER PATTERN
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
  }

  off(event, callback) {
    if (this.eventListeners.has(event)) {
      const listeners = this.eventListeners.get(event);
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).forEach(callback => callback(data));
    }
  }
}

// Hook React para usar o cliente Agno
export const useAgnoClient = () => {
  const [client] = useState(() => new AgnoClient());

  useEffect(() => {
    // Configurar eventos globais se necessário
    return () => {
      // Cleanup
    };
  }, [client]);

  return client;
};

// Instância global do cliente (pode ser usada em componentes não-React)
export const agnoClient = new AgnoClient();

export default AgnoClient;