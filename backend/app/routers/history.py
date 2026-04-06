"""
app/routers/history.py
GET /history — Return the action/permission history for the current authenticated user.
"""
from fastapi import APIRouter, Depends
from app.auth import get_user_id
from app.services.action_logger import get_recent_logs

router = APIRouter(prefix="/history", tags=["History"])


@router.get("")
async def get_user_history(user_id: str = Depends(get_user_id)):
    """
    Return the action and permission history for the current user.
    Filters to only show this user's records.
    """
    all_logs = get_recent_logs(limit=100)
    user_logs = [log for log in all_logs if log.get("user_id") == user_id]
    # Return in reverse chronological order (newest first)
    return {"history": list(reversed(user_logs))}
