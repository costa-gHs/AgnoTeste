-- Agno Platform Database Schema
-- PostgreSQL Database Initialization

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table (simplified, main auth still via Supabase)
CREATE TABLE agno_users (
    id SERIAL PRIMARY KEY,
    supabase_user_id UUID UNIQUE,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255),
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    subscription_tier VARCHAR(20) DEFAULT 'free',
    api_quota_limit INTEGER DEFAULT 1000,
    api_quota_used INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- API Keys table
CREATE TABLE agno_api_keys (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES agno_users(id) ON DELETE CASCADE,
    provider VARCHAR(20) NOT NULL, -- 'openai', 'anthropic', 'google', etc
    key_name VARCHAR(100) NOT NULL,
    encrypted_key TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, provider, key_name)
);

-- Agents table
CREATE TABLE agno_agents (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES agno_users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    role VARCHAR(255),
    model_provider VARCHAR(20) NOT NULL, -- 'openai', 'anthropic'
    model_id VARCHAR(100) NOT NULL,
    instructions JSONB NOT NULL DEFAULT '[]',
    tools JSONB NOT NULL DEFAULT '[]',
    configuration JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    is_public BOOLEAN DEFAULT false,
    version VARCHAR(20) DEFAULT '1.0.0',
    tags TEXT[],
    memory_enabled BOOLEAN DEFAULT true,
    rag_enabled BOOLEAN DEFAULT false,
    rag_index_id VARCHAR(255),
    reasoning_enabled BOOLEAN DEFAULT false,
    max_tokens INTEGER DEFAULT 4000,
    temperature DECIMAL(3,2) DEFAULT 0.7,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Workflows table
CREATE TABLE agno_workflows (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES agno_users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    flow_type VARCHAR(20) DEFAULT 'sequential', -- 'sequential', 'parallel', 'conditional'
    workflow_definition JSONB NOT NULL DEFAULT '{}',
    version VARCHAR(20) DEFAULT '1.0.0',
    is_active BOOLEAN DEFAULT true,
    is_public BOOLEAN DEFAULT false,
    tags TEXT[],
    timeout_seconds INTEGER DEFAULT 300,
    max_retries INTEGER DEFAULT 3,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Workflow Agents (Many-to-Many relationship)
CREATE TABLE agno_workflow_agents (
    id SERIAL PRIMARY KEY,
    workflow_id INTEGER REFERENCES agno_workflows(id) ON DELETE CASCADE,
    agent_id INTEGER REFERENCES agno_agents(id) ON DELETE CASCADE,
    position INTEGER NOT NULL DEFAULT 0,
    node_config JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(workflow_id, agent_id, position)
);

-- Chat Sessions table
CREATE TABLE agno_chat_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id INTEGER REFERENCES agno_users(id) ON DELETE CASCADE,
    agent_id INTEGER REFERENCES agno_agents(id) ON DELETE SET NULL,
    workflow_id INTEGER REFERENCES agno_workflows(id) ON DELETE SET NULL,
    session_name VARCHAR(255),
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'completed', 'error', 'timeout'
    total_messages INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    total_cost DECIMAL(10,4) DEFAULT 0.00,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    CHECK (agent_id IS NOT NULL OR workflow_id IS NOT NULL)
);

-- Chat Messages table
CREATE TABLE agno_chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES agno_chat_sessions(id) ON DELETE CASCADE,
    message_type VARCHAR(20) NOT NULL, -- 'user', 'assistant', 'system', 'tool'
    content TEXT NOT NULL,
    tokens_used INTEGER DEFAULT 0,
    processing_time_ms INTEGER,
    tools_used TEXT[],
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Agent Templates table
CREATE TABLE agno_agent_templates (
    id SERIAL PRIMARY KEY,
    creator_id INTEGER REFERENCES agno_users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL,
    tags TEXT[],
    agent_config JSONB NOT NULL,
    is_public BOOLEAN DEFAULT false,
    is_featured BOOLEAN DEFAULT false,
    download_count INTEGER DEFAULT 0,
    rating_avg DECIMAL(3,2) DEFAULT 0.0,
    rating_count INTEGER DEFAULT 0,
    version VARCHAR(20) DEFAULT '1.0.0',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Template Ratings table
CREATE TABLE agno_template_ratings (
    id SERIAL PRIMARY KEY,
    template_id INTEGER REFERENCES agno_agent_templates(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES agno_users(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    review TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(template_id, user_id)
);

-- Execution Logs table
CREATE TABLE agno_execution_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES agno_chat_sessions(id) ON DELETE CASCADE,
    agent_id INTEGER REFERENCES agno_agents(id) ON DELETE SET NULL,
    workflow_id INTEGER REFERENCES agno_workflows(id) ON DELETE SET NULL,
    node_id VARCHAR(255),
    execution_type VARCHAR(20) NOT NULL, -- 'agent', 'workflow', 'tool', 'condition'
    status VARCHAR(20) NOT NULL, -- 'started', 'completed', 'error', 'timeout'
    input_data JSONB,
    output_data JSONB,
    error_message TEXT,
    execution_time_ms INTEGER,
    tokens_used INTEGER DEFAULT 0,
    cost DECIMAL(10,4) DEFAULT 0.00,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Usage Analytics table
CREATE TABLE agno_usage_analytics (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES agno_users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_sessions INTEGER DEFAULT 0,
    total_messages INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    total_cost DECIMAL(10,4) DEFAULT 0.00,
    agent_executions INTEGER DEFAULT 0,
    workflow_executions INTEGER DEFAULT 0,
    success_rate DECIMAL(5,2) DEFAULT 0.00,
    avg_response_time_ms INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, date)
);

-- System Settings table
CREATE TABLE agno_system_settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value JSONB NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_agno_agents_user_id ON agno_agents(user_id);
CREATE INDEX idx_agno_agents_is_active ON agno_agents(is_active);
CREATE INDEX idx_agno_workflows_user_id ON agno_workflows(user_id);
CREATE INDEX idx_agno_chat_sessions_user_id ON agno_chat_sessions(user_id);
CREATE INDEX idx_agno_chat_sessions_agent_id ON agno_chat_sessions(agent_id);
CREATE INDEX idx_agno_chat_messages_session_id ON agno_chat_messages(session_id);
CREATE INDEX idx_agno_chat_messages_created_at ON agno_chat_messages(created_at);
CREATE INDEX idx_agno_execution_logs_session_id ON agno_execution_logs(session_id);
CREATE INDEX idx_agno_execution_logs_started_at ON agno_execution_logs(started_at);
CREATE INDEX idx_agno_usage_analytics_user_date ON agno_usage_analytics(user_id, date);
CREATE INDEX idx_agno_agent_templates_category ON agno_agent_templates(category);
CREATE INDEX idx_agno_agent_templates_is_public ON agno_agent_templates(is_public);

-- Create triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_agno_users_updated_at BEFORE UPDATE ON agno_users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_agno_agents_updated_at BEFORE UPDATE ON agno_agents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_agno_workflows_updated_at BEFORE UPDATE ON agno_workflows FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_agno_agent_templates_updated_at BEFORE UPDATE ON agno_agent_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default system settings
INSERT INTO agno_system_settings (setting_key, setting_value, description, is_public) VALUES
('max_agents_per_user', '50', 'Maximum number of agents per user', true),
('max_workflows_per_user', '20', 'Maximum number of workflows per user', true),
('max_session_duration_hours', '24', 'Maximum session duration in hours', true),
('default_model_provider', '"openai"', 'Default model provider for new agents', true),
('default_model_id', '"gpt-4o-mini"', 'Default model ID for new agents', true),
('enable_public_templates', 'true', 'Enable public template sharing', true),
('maintenance_mode', 'false', 'System maintenance mode', false);

-- Insert sample data for development
INSERT INTO agno_users (supabase_user_id, username, email, full_name) VALUES
(uuid_generate_v4(), 'admin', 'admin@agno.ai', 'Admin User'),
(uuid_generate_v4(), 'demo', 'demo@agno.ai', 'Demo User');

-- Insert sample agent templates
INSERT INTO agno_agent_templates (creator_id, name, description, category, tags, agent_config, is_public, is_featured) VALUES
(1, 'Assistente de Pesquisa', 'Template para pesquisa acadêmica e científica', 'research', ARRAY['pesquisa', 'acadêmico', 'ciência'],
 '{"modelProvider": "openai", "modelId": "gpt-4o", "tools": ["duckduckgo", "reasoning"], "instructions": ["Você é um assistente de pesquisa acadêmica.", "Sempre cite suas fontes."], "memoryEnabled": true, "ragEnabled": true}',
 true, true),
(1, 'Analista Financeiro', 'Template para análise financeira e de mercado', 'finance', ARRAY['finanças', 'mercado', 'investimentos'],
 '{"modelProvider": "anthropic", "modelId": "claude-3-5-sonnet-20241022", "tools": ["yfinance", "reasoning"], "instructions": ["Você é um analista financeiro experiente.", "Forneça análises detalhadas com disclaimers."], "memoryEnabled": true, "ragEnabled": false}',
 true, true);