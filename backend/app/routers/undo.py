"""
app/routers/undo.py
Reverse / undo a previously executed agent action.
"""
from fastapi import APIRouter, Depends
from app.auth import get_user_id
from app.services.reversal_engine import reverse_action
from app.services.action_logger import get_recent_logs

router = APIRouter(prefix="/undo", tags=["Undo"])


@router.post("/{log_id}")
async def undo_action(
    log_id: str,
    user_id: str = Depends(get_user_id),
):
    """
    Attempt to reverse the action identified by log_id.
    Only the original user can undo their own actions.
    """
    result = await reverse_action(log_id, user_id)
    return result


@router.get("/logs/recent")
async def recent_logs(user_id: str = Depends(get_user_id)):
    """Return the 20 most recent action logs (all users — admin use)."""
    logs = get_recent_logs(limit=20)
    return {"logs": logs}
