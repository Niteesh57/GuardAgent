"""
app/adapters/gmail_adapter.py
Gmail API operations using google-api-python-client.
All functions accept a raw access_token (from Token Vault).
"""
import base64
import email as email_lib
from email.mime.text import MIMEText
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from google.oauth2.credentials import Credentials


class InsufficientScopeError(Exception):
    """Raised when the stored token lacks the required OAuth scope (e.g. gmail.send)."""
    pass


def _build_service(access_token: str):
    creds = Credentials(token=access_token)
    return build("gmail", "v1", credentials=creds)


async def send_email(access_token: str, data: dict) -> dict:
    """
    data: { "to": str, "subject": str, "body": str }
    Returns: { "message_id": str, "thread_id": str }
    Raises InsufficientScopeError on 403 (missing gmail.send scope).
    """
    service = _build_service(access_token)

    msg = MIMEText(data.get("body", ""))
    msg["to"] = data["to"]
    msg["subject"] = data.get("subject", "(No Subject)")

    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
    try:
        result = service.users().messages().send(
            userId="me", body={"raw": raw}
        ).execute()
    except HttpError as e:
        if e.status_code == 403:
            raise InsufficientScopeError(
                f"Gmail rejected the send request (403). "
                f"The stored token may lack 'gmail.send' scope. "
                f"Please reconnect Gmail with send permissions."
            ) from e
        raise

    return {
        "message_id": result.get("id"),
        "thread_id": result.get("threadId"),
        "label_ids": result.get("labelIds", []),
        "to": data["to"],
        "subject": data.get("subject", "(No Subject)"),
    }


async def read_emails(access_token: str, data: dict) -> dict:
    """
    data: { "query": str, "max_results": int }
    Returns: { "messages": [...] }
    """
    service = _build_service(access_token)
    query = data.get("query", "is:unread")
    max_results = int(data.get("max_results", 5))

    results = service.users().messages().list(
        userId="me", q=query, maxResults=max_results
    ).execute()

    messages = results.get("messages", [])
    summaries = []
    for m in messages:
        msg = service.users().messages().get(
            userId="me", id=m["id"], format="metadata",
            metadataHeaders=["Subject", "From", "Date"]
        ).execute()
        headers = {h["name"]: h["value"] for h in msg.get("payload", {}).get("headers", [])}
        summaries.append({
            "id": m["id"],
            "subject": headers.get("Subject", "(No Subject)"),
            "from": headers.get("From", ""),
            "date": headers.get("Date", ""),
            "snippet": msg.get("snippet", ""),
        })

    return {"messages": summaries, "total_found": results.get("resultSizeEstimate", 0)}


async def delete_message(access_token: str, message_id: str) -> bool:
    """Move message to trash (reversible undo)."""
    service = _build_service(access_token)
    service.users().messages().trash(userId="me", id=message_id).execute()
    return True
