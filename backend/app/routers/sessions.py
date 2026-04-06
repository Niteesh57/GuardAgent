"""
app/routers/sessions.py
REST API for managing persistent named chat sessions.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.auth import get_user_id
from app.services import session_store

router = APIRouter(prefix="/sessions", tags=["Sessions"])


class CreateSessionRequest(BaseModel):
    name: Optional[str] = None


class RenameSessionRequest(BaseModel):
    name: str


@router.get("")
async def list_sessions(user_id: str = Depends(get_user_id)):
    """List all sessions for the authenticated user, newest first."""
    return {"sessions": session_store.list_sessions(user_id)}


@router.post("")
async def create_session(req: CreateSessionRequest, user_id: str = Depends(get_user_id)):
    """Create a new named session."""
    session = session_store.create_session(user_id, req.name)
    return session


@router.get("/{session_id}")
async def get_session(session_id: str, user_id: str = Depends(get_user_id)):
    """Get session metadata."""
    session = session_store.get_session(session_id, user_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.get("/{session_id}/messages")
async def get_messages(session_id: str, user_id: str = Depends(get_user_id)):
    """Get full message history for a session."""
    session = session_store.get_session(session_id, user_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    messages = session_store.get_messages(session_id, user_id)
    return {"session_id": session_id, "messages": messages}


@router.patch("/{session_id}")
async def rename_session(session_id: str, req: RenameSessionRequest, user_id: str = Depends(get_user_id)):
    """Rename a session."""
    ok = session_store.rename_session(session_id, user_id, req.name)
    if not ok:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"ok": True}


@router.delete("/{session_id}")
async def delete_session(session_id: str, user_id: str = Depends(get_user_id)):
    """Delete a session and all its messages."""
    ok = session_store.delete_session(session_id, user_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"ok": True}


class CreateMessageRequest(BaseModel):
    role: str
    content: str
    permission_request: Optional[dict] = None
    action_contract: Optional[dict] = None
    is_email_animation: Optional[bool] = False

@router.post("/{session_id}/messages")
async def append_custom_message(session_id: str, req: CreateMessageRequest, user_id: str = Depends(get_user_id)):
    """Append a custom message (like a manual contract or animation bubble) to the session."""
    session = session_store.get_session(session_id, user_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    msg = session_store.append_message(
        session_id, req.role, req.content, req.permission_request, req.action_contract, req.is_email_animation
    )
    return msg


class UpdateMessageRequest(BaseModel):
    content: Optional[str] = None
    action_contract: Optional[dict] = None
    is_email_animation: Optional[bool] = None

@router.put("/{session_id}/messages/{msg_id}")
async def update_custom_message(session_id: str, msg_id: str, req: UpdateMessageRequest, user_id: str = Depends(get_user_id)):
    """Update fields on an existing message (e.g. mark a contract as executed)."""
    session = session_store.get_session(session_id, user_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    ok = session_store.update_message(msg_id, req.content, req.action_contract, req.is_email_animation)
    if not ok:
        raise HTTPException(status_code=404, detail="Message not found")
    return {"ok": True}

