"""
app/routers/permissions.py
Manage user service connections (Token Vault) via Auth0.
Includes Negotiator endpoints for explainable + negotiable permissions.
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.auth import get_user_id
from app.services.token_vault import check_connection, get_connect_url
from app.services.token_vault import SERVICE_CONNECTION_MAP
from app.engines.negotiator_engine import explain_permission
from app.services.action_logger import log_action

router = APIRouter(prefix="/permissions", tags=["Permissions"])


class ExplainRequest(BaseModel):
    user_query: str = "the user's task"


class RejectRequest(BaseModel):
    action: str
    reason: str = "User declined"


@router.get("/status/{service}")
async def permission_status(
    service: str,
    user_id: str = Depends(get_user_id),
):
    """Check whether the user has connected a given service."""
    if service not in SERVICE_CONNECTION_MAP:
        return {"service": service, "connected": False, "error": "Unknown service"}

    connected = await check_connection(service, user_id)
    return {"service": service, "connected": connected, "user_id": user_id}


@router.post("/connect/{service}")
async def connect_service(
    service: str,
    user_id: str = Depends(get_user_id),
):
    """Return the OAuth connect URL so the frontend can redirect the user."""
    try:
        url = await get_connect_url(service)
        return {"service": service, "connect_url": url}
    except ValueError as e:
        return {"error": str(e)}


@router.get("/services")
async def list_services(user_id: str = Depends(get_user_id)):
    """List all supported services and their connection status."""
    statuses = {}
    for svc in SERVICE_CONNECTION_MAP:
        statuses[svc] = await check_connection(svc, user_id)
    return {"user_id": user_id, "services": statuses}


@router.post("/explain/{action}")
async def explain_permission_request(
    action: str,
    body: ExplainRequest,
    user_id: str = Depends(get_user_id),
):
    """
    Ask the Negotiator LLM to explain WHY a specific permission is needed.
    The Negotiator speaks in plain English, explains what data is accessed,
    what is NOT accessed, and gives privacy assurances.
    """
    result = await explain_permission(action=action, user_query=body.user_query)
    return result


@router.post("/reject")
async def reject_permission(
    body: RejectRequest,
    user_id: str = Depends(get_user_id),
):
    """
    User explicitly rejected a permission request.
    Logs the rejection so the agent knows to not retry.
    Returns a natural language message the agent can relay.
    """
    log_action(
        user_id=user_id,
        action=body.action,
        status="rejected_by_user",
        service_used="none",
        metadata={"reason": body.reason}
    )

    # Map action to friendly description for the rejection message
    action_descriptions = {
        "read_emails": "read your Gmail inbox",
        "send_email": "send emails on your behalf",
        "read_calendar": "check your Google Calendar",
        "create_calendar_event": "create calendar events",
        "create_document": "create documents",
        "edit_document": "edit documents",
        "template_document": "create documents from templates",
        "send_sms": "send an SMS",
    }
    description = action_descriptions.get(body.action, f"perform '{body.action}'")

    return {
        "status": "rejected",
        "action": body.action,
        "agent_message": (
            f"Understood. I will not {description} for this session. "
            f"If you change your mind, you can grant access from Settings "
            f"or simply ask me again."
        ),
    }
