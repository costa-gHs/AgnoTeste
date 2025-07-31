# app_fixed.py - Backend Agno Corrigido com Async Streaming

import os
import json
import asyncio
import uuid
from typing import List, Dict, Any, Optional, AsyncGenerator
from datetime import datetime, timedelta
import logging
from contextlib import asynccontextmanager

# FastAPI imports
from fastapi import FastAPI, HTTPException, Depends, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from pydantic import BaseModel

# Database
import asyncpg
import sqlalchemy as sa
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base

# Environment
from dotenv import load_dotenv

load_dotenv()

# Logging setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Database setup
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://agno_user:agno_password@localhost:5432/agno_db")
ASYNC_DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")

# Create async engine
engine = create_async_engine(ASYNC_DATABASE_URL, echo=True)
async_session = async_sessionmaker(engine, expire_on_commit=False)

Base = declarative_base()


# Pydantic Models
class CreateAgentRequest(BaseModel):
    name: str
    role: str
    model_provider: str = "openai"
    model_id: str = "gpt-4o-mini"
    instructions: List[str]
    tools: List[str] = []
    memory_enabled: bool = True
    rag_enabled: bool = False
    rag_index_id: Optional[str] = None


class ChatMessage(BaseModel):
    message: str
    context: Optional[Dict[str, Any]] = None


class CreateWorkflowRequest(BaseModel):
    name: str
    description: str
    flow_type: str = "sequential"
    supervisor_enabled: bool = False
    agents: List[CreateAgentRequest] = []


# Mock Agno Service with proper async generators
class MockAgnoService:
    """Serviço mock que simula o Agno com async generators corretos"""

    def __init__(self):
        self.agents = {}
        self.sessions = {}

    async def create_agent(self, user_id: int, config: CreateAgentRequest) -> str:
        """Cria um agente mock"""
        agent_id = str(len(MOCK_AGENTS) + 1)

        agent_data = {
            "id": int(agent_id),
            "name": config.name,
            "role": config.role,
            "model_provider": config.model_provider,
            "model_id": config.model_id,
            "instructions": config.instructions,
            "tools": config.tools,
            "memory_enabled": config.memory_enabled,
            "rag_enabled": config.rag_enabled,
            "is_active": True,
            "created_at": datetime.utcnow().isoformat()
        }

        MOCK_AGENTS.append(agent_data)
        logger.info(f"Mock agent created: {config.name} with ID {agent_id}")
        return agent_id

    async def run_agent(self, agent_id: str, message: str, user_id: int) -> AsyncGenerator[str, None]:
        """Executa agente com streaming - CORRIGIDO para ser async generator"""
        logger.info(f"Running mock agent {agent_id} for user {user_id}")

        # Encontrar o agente
        agent = None
        for a in MOCK_AGENTS:
            if str(a["id"]) == agent_id:
                agent = a
                break

        if not agent:
            yield f"data: {json.dumps({'type': 'error', 'message': 'Agent not found'})}\n\n"
            return

        # Simular resposta do agente com chunks
        response_parts = [
            f"Hello! I'm {agent['name']}.",
            f" I received your message: '{message}'",
            "\n\nI'll process your request using my configured tools.",
            f" As a {agent['role']}, I can help with:",
        ]

        # Adicionar informações baseadas nas ferramentas
        tools = agent.get('tools', [])
        if 'duckduckgo' in tools:
            response_parts.append("\n• Real-time web searches")
        if 'yfinance' in tools:
            response_parts.append("\n• Financial data analysis")
        if 'reasoning' in tools:
            response_parts.append("\n• Advanced reasoning and problem solving")

        response_parts.extend([
            "\n\nThis is an example of streaming response from real Agno.",
            " In production, I would process your request",
            f" using the {agent['model_id']} model",
            " and return a complete and contextualized response.",
            "\n\n✅ System working correctly!"
        ])

        # Stream each part with delay
        for i, part in enumerate(response_parts):
            await asyncio.sleep(0.3)  # Simulate processing delay
            yield f"data: {json.dumps({'type': 'chunk', 'content': part})}\n\n"

        # Register session
        session_id = f"session_{datetime.now().timestamp()}"
        MOCK_SESSIONS.append({
            "id": session_id,
            "agent_id": agent_id,
            "user_id": user_id,
            "message": message,
            "response_length": sum(len(part) for part in response_parts),
            "tokens_used": len(message.split()) * 4,  # Estimate
            "status": "completed",
            "start_time": datetime.utcnow().isoformat(),
            "duration": len(response_parts) * 0.3
        })

        # Update metrics
        MOCK_METRICS["total_sessions"] += 1
        MOCK_METRICS["total_tokens"] += len(message.split()) * 4
        MOCK_METRICS["avg_response_time"] = 2.3  # Mock
        MOCK_METRICS["success_rate"] = 95.0  # Mock

        await asyncio.sleep(0.5)
        yield f"data: {json.dumps({'type': 'complete', 'session_id': session_id})}\n\n"


# Mock data
MOCK_AGENTS = [
    {
        "id": 1,
        "name": "Academic Research Assistant",
        "role": "Academic Research Assistant",
        "model_provider": "openai",
        "model_id": "gpt-4o",
        "instructions": ["You are an academic research assistant.", "Always cite sources."],
        "tools": ["duckduckgo", "reasoning"],
        "memory_enabled": True,
        "rag_enabled": True,
        "is_active": True,
        "created_at": "2025-01-28T10:00:00Z"
    },
    {
        "id": 2,
        "name": "Financial Analyst",
        "role": "Financial Analyst",
        "model_provider": "anthropic",
        "model_id": "claude-3-5-sonnet-20241022",
        "instructions": ["You are a financial analyst.", "Provide detailed insights."],
        "tools": ["yfinance", "reasoning"],
        "memory_enabled": True,
        "rag_enabled": False,
        "is_active": True,
        "created_at": "2025-01-27T15:30:00Z"
    }
]

MOCK_WORKFLOWS = [
    {
        "id": 1,
        "name": "Complete Market Analysis",
        "description": "Workflow combining research and financial analysis",
        "flow_type": "sequential",
        "workflow_definition": {
            "nodes": [],
            "connections": []
        },
        "is_active": True,
        "created_at": "2025-01-25T14:20:00Z"
    }
]

MOCK_SESSIONS = []

MOCK_METRICS = {
    "total_sessions": 0,
    "success_rate": 0.0,
    "avg_response_time": 0.0,
    "total_tokens": 0,
    "active_agents": 0,
    "total_workflows": 0,
    "cost_today": 0.0,
    "errors_today": 0
}

# Initialize service
agno_service = MockAgnoService()


# Database lifespan
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("🚀 Starting Agno Platform API...")

    # Test database connection
    try:
        async with engine.begin() as conn:
            await conn.execute(sa.text("SELECT 1"))
        logger.info("✅ Database connection successful")
    except Exception as e:
        logger.error(f"❌ Database connection failed: {e}")

    yield

    # Shutdown
    logger.info("🛑 Shutting down Agno Platform API...")
    await engine.dispose()


# Create FastAPI app
app = FastAPI(
    title="Agno Platform API",
    description="Agno Platform API with corrected async streaming",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://frontend:3000",
        "*"  # For development - restrict in production
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Trusted hosts
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["localhost", "127.0.0.1", "*.localhost", "*"]  # Restrict in production
)


# Middleware for logging
@app.middleware("http")
async def log_requests(request, call_next):
    start_time = datetime.now()
    logger.info(f"📥 {request.method} {request.url}")

    response = await call_next(request)

    process_time = (datetime.now() - start_time).total_seconds()
    logger.info(f"📤 {response.status_code} - {process_time:.3f}s")

    return response


# Auth dependency
async def get_current_user(user_id: int = Query(default=1)):
    """Simple auth middleware"""
    return user_id


# Routes
@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Agno Platform API v2.0",
        "status": "online",
        "version": "2.0.0",
        "features": ["agents", "workflows", "templates", "streaming"],
        "docs": "/docs"
    }


@app.options("/{path:path}")
async def options_handler(path: str):
    """Handle OPTIONS requests for CORS"""
    return JSONResponse(
        content={"message": "OK"},
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "*",
        }
    )


@app.post("/api/agents/create")
async def create_agent(
        request: CreateAgentRequest,
        user_id: int = Depends(get_current_user)
):
    """Create a new agent"""
    try:
        agent_id = await agno_service.create_agent(user_id, request)
        return {"agent_id": agent_id, "status": "created", "message": "Agent created successfully"}
    except Exception as e:
        logger.error(f"Error creating agent: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/agents")
async def list_agents(user_id: int = Depends(get_current_user)):
    """List user agents"""
    try:
        return MOCK_AGENTS
    except Exception as e:
        logger.error(f"Error listing agents: {e}")
        return []


@app.post("/api/agents/{agent_id}/chat")
async def chat_with_agent(
        agent_id: str,
        message: ChatMessage,
        user_id: int = Depends(get_current_user)
):
    """Chat with agent using streaming - CORRIGIDO"""
    try:
        async def stream_generator():
            """Generator that properly handles the async iterator"""
            try:
                async for chunk in agno_service.run_agent(agent_id, message.message, user_id):
                    yield chunk
            except Exception as e:
                logger.error(f"Error in stream: {e}")
                error_chunk = f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
                yield error_chunk

        return StreamingResponse(
            stream_generator(),
            media_type="text/plain",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Access-Control-Allow-Origin": "*",
                "X-Accel-Buffering": "no",  # Disable proxy buffering
            }
        )
    except Exception as e:
        logger.error(f"Error in chat endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/workflows/create")
async def create_workflow(
        request: CreateWorkflowRequest,
        user_id: int = Depends(get_current_user)
):
    """Create a new workflow"""
    try:
        workflow_id = str(len(MOCK_WORKFLOWS) + 1)

        workflow_data = {
            "id": int(workflow_id),
            "name": request.name,
            "description": request.description,
            "flow_type": request.flow_type,
            "workflow_definition": {
                "nodes": [],
                "connections": [],
                "agents": [
                    {
                        "name": agent.name,
                        "role": agent.role,
                        "model_provider": agent.model_provider,
                        "model_id": agent.model_id,
                        "tools": agent.tools,
                        "instructions": agent.instructions
                    }
                    for agent in request.agents
                ]
            },
            "is_active": True,
            "created_at": datetime.utcnow().isoformat()
        }

        MOCK_WORKFLOWS.append(workflow_data)
        logger.info(f"Workflow created: {request.name} with ID {workflow_id}")

        return {"workflow_id": workflow_id, "status": "created", "message": "Workflow created successfully"}
    except Exception as e:
        logger.error(f"Error creating workflow: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/workflows")
async def list_workflows(user_id: int = Depends(get_current_user)):
    """List user workflows"""
    try:
        return MOCK_WORKFLOWS
    except Exception as e:
        logger.error(f"Error listing workflows: {e}")
        return []


@app.get("/api/sessions")
async def list_sessions(user_id: int = Depends(get_current_user)):
    """List user sessions"""
    try:
        return MOCK_SESSIONS[-50:]  # Last 50 sessions
    except Exception as e:
        logger.error(f"Error listing sessions: {e}")
        return []


@app.get("/api/metrics")
async def get_metrics(user_id: int = Depends(get_current_user)):
    """Get platform metrics"""
    try:
        MOCK_METRICS.update({
            "active_agents": len([a for a in MOCK_AGENTS if a.get("is_active", False)]),
            "total_workflows": len(MOCK_WORKFLOWS),
            "total_sessions": len(MOCK_SESSIONS)
        })
        return MOCK_METRICS
    except Exception as e:
        logger.error(f"Error getting metrics: {e}")
        return MOCK_METRICS


@app.get("/api/performance")
async def get_performance_data(
        hours: int = Query(24, description="Hours of data to return"),
        user_id: int = Depends(get_current_user)
):
    """Get performance data over time"""
    try:
        performance_data = []
        now = datetime.now()

        for i in range(hours):
            time_point = now - timedelta(hours=i)
            performance_data.append({
                "time": time_point.strftime("%H:%M"),
                "responseTime": 2.0 + (i % 3) * 0.5,
                "tokens": 1000 + (i % 5) * 500,
                "sessions": 10 + (i % 8) * 5,
                "errors": max(0, (i % 10) - 7)
            })

        return performance_data
    except Exception as e:
        logger.error(f"Error getting performance data: {e}")
        return []


@app.get("/api/health")
async def health_check():
    """API health check"""
    try:
        # Test database connection
        db_status = "healthy"
        try:
            async with engine.begin() as conn:
                await conn.execute(sa.text("SELECT 1"))
        except Exception as e:
            db_status = f"error: {str(e)}"

        health_data = {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "version": "2.0.0",
            "database": db_status,
            "services": {
                "agno": "available",
                "streaming": "functional",
                "async_support": "enabled"
            },
            "environment": os.getenv("ENVIRONMENT", "development")
        }

        return health_data
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=503, detail="Service unhealthy")


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"Unhandled error: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error",
            "message": "An unexpected error occurred",
            "timestamp": datetime.utcnow().isoformat()
        }
    )


if __name__ == "__main__":
    import uvicorn

    logger.info("Starting Agno Platform API...")

    uvicorn.run(
        "app_fixed:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
        access_log=True
    )