"""
app/engines/explainability_engine.py
Generates a human-readable step-by-step explanation of what
the agent will do BEFORE any execution takes place.
"""

STEP_TEMPLATES = {
    "send_email": [
        "Verify you have Gmail access via Auth0 Token Vault",
        "Fetch your Gmail access token securely",
        "Compose the email with the provided recipient and message",
        "Send the email via Gmail API on your behalf",
        "Log the action with timestamp and status",
    ],
    "read_emails": [
        "Verify you have Gmail read access via Auth0 Token Vault",
        "Fetch your Gmail access token securely",
        "Query Gmail API with your search parameters",
        "Return matching email summaries (no content stored)",
        "Log the action with timestamp and status",
    ],
    "create_event": [
        "Verify you have Google Calendar access via Auth0 Token Vault",
        "Fetch your Calendar access token securely",
        "Create the event with provided title, time, and attendees",
        "Confirm event creation via Calendar API",
        "Log the action with timestamp and status",
    ],
    "list_events": [
        "Verify you have Google Calendar read access via Auth0 Token Vault",
        "Fetch your Calendar access token securely",
        "Query upcoming events within the specified time range",
        "Return event list (no data stored)",
        "Log the action with timestamp and status",
    ],
    "send_sms": [
        "Verify Twilio account credentials",
        "Compose the SMS with provided recipient number and message",
        "Send SMS via Twilio API",
        "Log the action with timestamp and status",
    ],
}


def generate_explanation(action: str, data: dict) -> dict:
    """
    Returns a structured explanation object for the given action.
    """
    steps = STEP_TEMPLATES.get(action, [
        f"Validate action: {action}",
        "Fetch required access token from Auth0 Token Vault",
        "Execute action via the appropriate API",
        "Log result",
    ])

    return {
        "type": "explanation",
        "action": action,
        "summary": f"The agent will {steps[0].lower()} and proceed through {len(steps)} steps.",
        "steps": steps,
        "data_preview": {k: ("***" if "token" in k.lower() or "secret" in k.lower() else v)
                         for k, v in (data or {}).items()},
    }
