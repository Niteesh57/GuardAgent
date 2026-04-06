"""
app/main.py — FastAPI Guard Agent entry point

Mounts:
  GET  /health                     — public health check
  POST /chat                       — Conversational Groq Agent
  GET  /permissions/status/{svc}   — check service connection (auth required)
  POST /permissions/connect/{svc}  — get OAuth connect URL (auth required)
  GET  /permissions/services       — all services status (auth required)
  POST /undo/{log_id}              — reverse an action (auth required)
  GET  /undo/logs/recent           — recent action logs (auth required)
"""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from app.routers import health, chat, permissions, undo, auth, sessions, contracts, history
from app.services.session_store import init_db

load_dotenv()

FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")

app = FastAPI(
    title="Guard Agent API",
    description=(
        "A secure Trust Orchestrator for AI Actions. "
        "Validates JWT tokens via Auth0, fetches third-party credentials "
        "from Auth0 Token Vault, and executes actions with full audit logging."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS — allow Next.js frontend ────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(chat.router)
app.include_router(permissions.router)
app.include_router(sessions.router)
app.include_router(undo.router)
app.include_router(contracts.router)
app.include_router(history.router)


@app.on_event("startup")
async def startup():
    init_db()


@app.get("/")
async def root():
    return {
        "name": "Guard Agent API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
    }
