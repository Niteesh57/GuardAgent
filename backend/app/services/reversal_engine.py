"""
app/services/reversal_engine.py
Undo / cancel previously executed agent actions.
Looks up a log entry by log_id and attempts reversal.
"""
from app.services.action_logger import get_log_by_id
from app.adapters import gmail_adapter, calendar_adapter
from app.services.token_vault import get_token


async def reverse_action(log_id: str, user_id: str) -> dict:
    """
    Attempt to reverse the action identified by log_id.
    Returns a structured result dict.
    """
    record = get_log_by_id(log_id)

    if not record:
        return {
            "type": "error",
            "message": f"No action found with log_id: {log_id}",
        }

    if record["user_id"] != user_id:
        return {
            "type": "error",
            "message": "You do not have permission to undo this action.",
        }

    action = record["action"]
    meta = record.get("metadata", {})
    service = record.get("service_used", "")

    try:
        token = await get_token(service, user_id)
    except ValueError as e:
        return {"type": "error", "message": str(e)}

    # Undo routing
    if action == "send_email":
        message_id = meta.get("message_id")
        if not message_id:
            return {"type": "error", "message": "No message_id found to undo."}
        result = await gmail_adapter.delete_message(token, message_id)
        return {
            "type": "reversal_result",
            "action_reversed": action,
            "log_id": log_id,
            "status": "success" if result else "failed",
            "detail": "Email moved to trash.",
        }

    elif action == "create_event":
        event_id = meta.get("event_id")
        if not event_id:
            return {"type": "error", "message": "No event_id found to undo."}
        result = await calendar_adapter.delete_event(token, event_id)
        return {
            "type": "reversal_result",
            "action_reversed": action,
            "log_id": log_id,
            "status": "success" if result else "failed",
            "detail": "Calendar event deleted.",
        }

    else:
        return {
            "type": "error",
            "message": f"Reversal not supported for action: {action}",
        }
