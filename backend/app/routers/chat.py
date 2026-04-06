"""
app/routers/chat.py
POST /chat  — runs the Groq agent loop, saves messages to SQLite session store.
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import List, Optional

from app.auth import get_user_id, get_current_user
from app.engines.chat_engine import run_chat_cycle
from app.services import session_store

router = APIRouter(prefix="/chat", tags=["Chat"])


class ChatRequest(BaseModel):
    messages: List[dict]
    session_id: Optional[str] = None   # active session to save messages into


@router.post("")
async def chat_endpoint(
    req: ChatRequest,
    user_id: str = Depends(get_user_id),
    user: dict = Depends(get_current_user),
):
    """
    Receives current message history from the frontend, runs the Groq engine,
    persists the user message and response to the session, and returns the result.
    """
    # Auto-create a session if none is provided
    session_id = req.session_id
    if not session_id:
        session = session_store.create_session(user_id)
        session_id = session["id"]

    # Persist the user's latest message (last item in the list)
    if req.messages:
        last_user_msg = req.messages[-1]
        if last_user_msg.get("role") == "user":
            session_store.append_message(session_id, "user", last_user_msg["content"])

    # Run the agent
    result = await run_chat_cycle(req.messages, user_id, user)

    # Persist the assistant's response
    if result.get("messages"):
        final_msg = result["messages"][-1]
        if final_msg.get("role") == "assistant":
            content = final_msg.get("content") or ""
            # If there is a permission_request but no content, generate a fallback text
            pr = result.get("permission_request")
            if not content and pr:
                content = f"I need access to **{pr.get('service', 'a service')}** to do that."
            if content:  # only save if there's actually something to store
                session_store.append_message(session_id, "assistant", content, pr)
    elif result.get("permission_request"):
        pr = result["permission_request"]
        session_store.append_message(
            session_id,
            "assistant",
            f"I need access to **{pr.get('service', 'a service')}** to do that.",
            pr,
        )

    # Attach the active session_id so the frontend can track it
    result["session_id"] = session_id
    return result
