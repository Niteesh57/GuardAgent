"""
app/engines/negotiator_engine.py
A dedicated LLM agent that explains permission requests in plain English.

The Negotiator's job is to:
1. Act as a transparent, trustworthy spokesperson for the AI agent.
2. Explain exactly WHAT access is being requested.
3. Explain WHY the access is needed for the user's specific task.
4. Explain WHAT the agent will do with the access (and what it will NOT do).
5. Be honest about limitations and reassure the user about data privacy.
"""
import os
from groq import AsyncGroq
from dotenv import load_dotenv

load_dotenv()

groq_client = AsyncGroq(api_key=os.environ.get("GROQ_API_KEY"))

# Rich context about each permission
PERMISSION_CONTEXT = {
    "read_emails": {
        "what": "Read access to your Gmail inbox",
        "scope": "gmail.readonly",
        "data_accessed": "Email subjects, senders, dates, and message bodies",
        "not_accessed": "Attachments are not downloaded; emails are not modified or deleted",
    },
    "send_email": {
        "what": "Send emails on your behalf via Gmail",
        "scope": "gmail.send",
        "data_accessed": "Only the specific email you asked to be sent",
        "not_accessed": "Cannot read your inbox, cannot access other emails",
    },
    "read_calendar": {
        "what": "Read-only access to your Google Calendar",
        "scope": "calendar.readonly",
        "data_accessed": "Event titles, start/end times, attendees, and descriptions",
        "not_accessed": "Cannot create, modify, or delete calendar events",
    },
    "create_calendar_event": {
        "what": "Create calendar events on your Google Calendar",
        "scope": "calendar.events",
        "data_accessed": "Only the event details you provide (title, time, attendees)",
        "not_accessed": "Cannot read existing events; only creates new events you request",
    },
    "create_document": {
        "what": "Create Google Docs documents on your behalf",
        "scope": "docs.documents",
        "data_accessed": "Only the document content you provide",
        "not_accessed": "Cannot read your existing documents; only creates new ones",
    },
    "edit_document": {
        "what": "Edit Google Docs documents on your behalf",
        "scope": "docs.documents",
        "data_accessed": "Only the document you specify and the content you provide",
        "not_accessed": "Cannot access other documents; only edits the specific document",
    },
    "template_document": {
        "what": "Create formatted documents from templates",
        "scope": "docs.documents",
        "data_accessed": "Only the template details and content you provide",
        "not_accessed": "Cannot access your existing documents; only creates new ones",
    },
    "read_drive_file": {
        "what": "Read specific files from your Google Drive",
        "scope": "drive.readonly",
        "data_accessed": "ONLY the specific files you explicitly select and approve",
        "not_accessed": "Will absolutely NOT read or scan any other files in your Drive unless explicitly checked",
    },
    "send_sms": {
        "what": "Send SMS messages via Twilio",
        "scope": "sms:send",
        "data_accessed": "Only the specific phone number and message content you provide",
        "not_accessed": "Cannot read your SMS history; no contact list access",
    },
}

NEGOTIATOR_SYSTEM_PROMPT = """You are the Permission Negotiator for an AI Assistant.
Your role is to be a transparent, trustworthy spokesperson that explains permission requests with full honesty.

When explaining a permission:
1. Be clear and concise — use simple language (no jargon)
2. Explain WHAT data will be accessed (be specific)
3. Explain WHY this data is needed for the user's task
4. Explain WHAT you will NOT do with the access (privacy reassurance)
5. Mention how long the access is used (session-based, one-time, etc.)

Keep your explanation to 3-4 sentences max. Be friendly and trustworthy, not salesy.
Always end with: "You can revoke this access at any time from Settings."
"""


async def explain_permission(action: str, user_query: str) -> dict:
    """
    Generate a natural language explanation of why a permission is needed.
    
    Args:
        action: The tool name (e.g., 'read_emails', 'send_email')
        user_query: The user's original query that triggered this permission request
    
    Returns:
        {
            "action": str,
            "explanation": str,
            "what_accessed": str,
            "what_not_accessed": str,
            "scope": str,
        }
    """
    ctx = PERMISSION_CONTEXT.get(action, {})
    what = ctx.get("what", f"Access to {action}")
    scope = ctx.get("scope", "unknown")
    data_accessed = ctx.get("data_accessed", "relevant data")
    not_accessed = ctx.get("not_accessed", "other data remains private")

    prompt = f"""The user asked: "{user_query}"

To complete this task, I need the following permission:
- Permission: {what}
- Scope: {scope}
- Data accessed: {data_accessed}
- Data NOT accessed: {not_accessed}

Please explain to the user in 3-4 friendly sentences:
1. Why this specific permission is needed for their task
2. Exactly what data will be accessed
3. Privacy reassurances (what will NOT be accessed or stored)
End with: "You can revoke this access at any time from Settings."
"""

    response = await groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": NEGOTIATOR_SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        max_tokens=300,
        temperature=0.3,
    )

    explanation = response.choices[0].message.content.strip()

    return {
        "action": action,
        "explanation": explanation,
        "what_accessed": data_accessed,
        "what_not_accessed": not_accessed,
        "scope": scope,
    }
