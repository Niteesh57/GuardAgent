"""
app/routers/agent.py
POST /agent/execute — the full Guard Agent pipeline:
  1. Validate JWT (auth middleware)
  2. Permission check → return permission_request if missing
  3. Generate explanation → return explanation for confirmation
  4. On confirmed=true → execute via intent engine
  5. Log the action
  6. Return execution_result
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Any

from app.auth import auth0, get_user_id
from app.engines.permission_engine import check_permission
from app.engines.explainability_engine import generate_explanation
from app.engines.intent_engine import execute_intent
from app.services.action_logger import log_action

router = APIRouter(prefix="/agent", tags=["Agent"])


class IntentRequest(BaseModel):
    action: str
    data: dict[str, Any] = {}
    context: dict[str, Any] = {}
    confirmed: bool = False            # Must be True for sensitive actions
    explanation_seen: bool = False     # True = user has seen the explanation


@router.post("/execute")
async def execute_agent_action(
    intent: IntentRequest,
    user_id: str = Depends(get_user_id),
    claims: dict = Depends(auth0.require_auth()),
):
    """
    Full agent pipeline. Returns one of:
      permission_request  — user must grant access first
      explanation         — preview of what will happen
      execution_result    — success or failure after execution
      error               — validation / unknown action error
    """

    # ── Step 1: Permission check ─────────────────────────────────
    perm = await check_permission(intent.action, user_id)

    if not perm.get("granted"):
        if "error" in perm:
            return perm
        # Log the permission request event
        log_action(
            user_id=user_id,
            action=intent.action,
            status="permission_requested",
            service_used=perm.get("permission_request", {}).get("service", "unknown"),
            metadata={"reason": perm.get("permission_request", {}).get("reason")},
        )
        return perm["permission_request"]

    # ── Step 2: Explanation gate ─────────────────────────────────
    # If the user hasn't confirmed they've seen the explanation, send it.
    if not intent.explanation_seen:
        explanation = generate_explanation(intent.action, intent.data)
        return explanation

    # ── Step 3: Execute intent ───────────────────────────────────
    result = await execute_intent(
        action=intent.action,
        data=intent.data,
        user_id=user_id,
        confirmed=intent.confirmed,
    )

    # ── Step 4: Log action ───────────────────────────────────────
    log_action(
        user_id=user_id,
        action=intent.action,
        status=result.get("status", "unknown"),
        service_used=result.get("service", "unknown"),
        permissions_used=[perm.get("scope", "")],
        metadata={
            "result": result.get("result", {}),
            "error": result.get("error"),
            "user_email": claims.get("email", ""),
        },
    )

    return result


@router.get("/actions")
async def list_supported_actions(_: str = Depends(get_user_id)):
    """Return all supported actions with required service/scope info."""
    from app.engines.permission_engine import ACTION_REQUIREMENTS, HUMAN_READABLE_REASONS
    return {
        "actions": [
            {
                "action": action,
                "service": req["service"],
                "scope": req["scope"],
                "duration": req["duration"],
                "description": HUMAN_READABLE_REASONS.get(action, ""),
            }
            for action, req in ACTION_REQUIREMENTS.items()
        ]
    }
