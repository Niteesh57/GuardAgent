"""
app/engines/intent_engine.py
Validates incoming intent payloads and routes them to the
correct adapter function.

Input schema:
  {
    "action": "send_email",
    "data":    { ... action-specific payload ... },
    "context": { ... optional metadata ... }
  }
"""
import traceback
from app.adapters import gmail_adapter, calendar_adapter, docs_adapter, drive_adapter, firecrawl_adapter
from app.adapters.gmail_adapter import InsufficientScopeError
from app.services.token_vault import get_token

# Whitelist of supported actions → (service, handler coroutine)
ACTION_REGISTRY = {
    "read_emails":           ("gmail",      gmail_adapter.read_emails),
    "send_email":            ("gmail",      gmail_adapter.send_email),
    "read_calendar":         ("calendar",   calendar_adapter.read_events),
    "create_calendar_event": ("calendar",   calendar_adapter.create_event),
    "create_document":       ("docs",       docs_adapter.create_document),
    "edit_document":         ("docs",       docs_adapter.edit_document),
    "template_document":     ("docs",       docs_adapter.create_document_from_template),
    "search_drive":          ("drive",      drive_adapter.search_drive),
    "read_drive_file":       ("drive",      drive_adapter.read_drive_file),
    # Uses FIRECRAWL_API_KEY from .env — no OAuth user token required
    "research_topic":        ("firecrawl",  firecrawl_adapter.research_topic),
}

# Services that use a server-side API key rather than a user OAuth token
SERVER_KEY_SERVICES = {"firecrawl"}


async def execute_intent(action: str, data: dict, user_id: str, confirmed: bool = False) -> dict:
    """
    Validate and execute the intent.
    Returns execution_result dict on success, or a permission_request / error dict.
    """
    if action not in ACTION_REGISTRY:
        return {
            "type": "error",
            "message": f"Unknown action '{action}'. Supported: {list(ACTION_REGISTRY.keys())}",
        }

    service, handler = ACTION_REGISTRY[action]

    # Server-key services (e.g. Firecrawl) bypass Token Vault entirely
    if service in SERVER_KEY_SERVICES:
        token = ""  # adapter reads API key from env itself
    else:
        # Fetch token from Auth0 Token Vault
        try:
            token = await get_token(service, user_id)
        except ValueError:
            # Token missing entirely — return a permission_request
            from app.engines.permission_engine import check_permission
            return await check_permission(action, user_id)

    # Delegate to adapter
    try:
        # Inject user_id directly into data payload for resource permission checks
        if isinstance(data, dict):
            data["_user_id"] = user_id
            
        result = await handler(token, data)
        return {
            "type": "execution_result",
            "action": action,
            "service": service,
            "status": "success",
            "result": result,
        }
    except InsufficientScopeError:
        # Stored token lacks required scope (e.g. gmail.send) — trigger re-auth
        from app.engines.permission_engine import check_permission
        return await check_permission(action, user_id, force_reauth=True)
    except Exception as e:
        err_msg = str(e).lower()
        # Generic auth failure detection
        if "401" in err_msg or "unauthorized" in err_msg or "insufficient" in err_msg or "refresh the access token" in err_msg or "missing refresh token" in err_msg:
            from app.engines.permission_engine import check_permission
            return await check_permission(action, user_id, force_reauth=True)

        # Log the full traceback so we can see why it's failing
        print(f"--- execution failure ---")
        traceback.print_exc()
        print(f"-------------------------")

        return {
            "type": "execution_result",
            "action": action,
            "service": service,
            "status": "failure",
            "error": repr(e),  # Use repr(e) so empty string errors show up!
        }
