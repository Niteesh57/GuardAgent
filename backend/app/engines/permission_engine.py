"""
app/engines/permission_engine.py
Checks whether a user has connected a required service.
If not, returns a structured permission_request object.
"""
from app.services.token_vault import check_connection, get_connect_url, SERVICE_SCOPES

# Map action → required service + scope
ACTION_REQUIREMENTS = {
    "read_emails":           {"service": "gmail",      "scope": "gmail:read",    "duration": "session"},
    "send_email":            {"service": "gmail",      "scope": "gmail:send",    "duration": "session"},
    "read_calendar":         {"service": "calendar",   "scope": "calendar:read", "duration": "session"},
    "create_calendar_event": {"service": "calendar",   "scope": "calendar:read", "duration": "session"},
    "create_document":       {"service": "docs",       "scope": "docs:write",    "duration": "session"},
    "edit_document":         {"service": "docs",       "scope": "docs:write",    "duration": "session"},
    "template_document":     {"service": "docs",       "scope": "docs:write",    "duration": "session"},
    "search_drive":          {"service": "drive",      "scope": "drive:read",    "duration": "session"},
    "read_drive_file":       {"service": "drive",      "scope": "drive:read",    "duration": "session"},
    # research_topic uses internal FIRECRAWL_API_KEY — no OAuth token needed
    "research_topic":        {"service": "firecrawl",  "scope": "firecrawl",    "duration": "session"},
}

HUMAN_READABLE_REASONS = {
    "read_emails":           "Read your Gmail inbox",
    "send_email":            "Send emails on your behalf via Gmail",
    "read_calendar":         "Read your Google Calendar events",
    "create_calendar_event": "Create calendar events on your behalf",
    "create_document":       "Create Google Docs documents on your behalf",
    "edit_document":         "Edit Google Docs documents on your behalf",
    "template_document":     "Create formatted documents from templates",
    "search_drive":          "Search for files in Google Drive",
    "read_drive_file":       "Read specific files from Google Drive",
    "research_topic":        "Search the web and compile research for your document",
}


async def check_permission(action: str, user_id: str, force_reauth: bool = False) -> dict:
    """
    Returns:
      {"granted": True}
        — if user has the required connection AND force_reauth is False.
      {"granted": False, "permission_request": {...}}
        — if user needs to connect the service OR force_reauth is True.
      {"granted": False, "error": "..."}
        — if action is unknown.
    """
    req = ACTION_REQUIREMENTS.get(action)
    if not req:
        return {
            "granted": False,
            "error": f"Unknown action: {action}. Cannot determine required permissions.",
        }

    service = req["service"]
    
    if not force_reauth:
        connected = await check_connection(service, user_id)
        if connected:
            return {"granted": True, "service": service, "scope": req["scope"]}

    connect_url = await get_connect_url(service)

    return {
        "granted": False,
        "permission_request": {
            "type": "permission_request",
            "action": action,            # ← included so UI can call /explain/{action}
            "service": service,
            "reason": HUMAN_READABLE_REASONS.get(action, f"Access {service} on your behalf"),
            "scope": SERVICE_SCOPES.get(service, req["scope"]),
            "duration": req["duration"],
            "connect_url": connect_url,
        },
    }
