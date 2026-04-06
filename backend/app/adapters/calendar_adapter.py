"""
app/adapters/calendar_adapter.py
Google Calendar API operations.
All functions accept a raw access_token (from Token Vault).
"""
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials
from datetime import datetime, timedelta


def _build_service(access_token: str):
    creds = Credentials(token=access_token)
    return build("calendar", "v3", credentials=creds)


async def create_event(access_token: str, data: dict) -> dict:
    """
    data: {
      "summary": str,
      "start": "2024-01-01T10:00:00",
      "end":   "2024-01-01T11:00:00",  (optional, defaults to start + 1 hour)
      "timezone": "Asia/Kolkata",
      "attendees": ["email1", "email2"],
      "description": str (optional)
    }
    """
    service = _build_service(access_token)
    tz = data.get("timezone", "UTC")
    start = data["start"]

    # Default end to 1 hour after start if not provided
    if "end" in data and data["end"]:
        end = data["end"]
    else:
        start_dt = datetime.fromisoformat(start)
        end = (start_dt + timedelta(hours=1)).isoformat()

    # Handle attendees - can be comma-separated string or list
    raw_attendees = data.get("attendees", [])
    if isinstance(raw_attendees, str):
        raw_attendees = [e.strip() for e in raw_attendees.split(",") if e.strip()]

    event_body = {
        "summary": data.get("summary", "New Event"),
        "description": data.get("description", ""),
        "start": {"dateTime": start, "timeZone": tz},
        "end": {"dateTime": end, "timeZone": tz},
        "attendees": [{"email": e} for e in raw_attendees],
    }

    created = service.events().insert(calendarId="primary", body=event_body).execute()
    return {
        "event_id": created.get("id"),
        "html_link": created.get("htmlLink"),
        "summary": created.get("summary"),
        "start": created.get("start"),
        "end": created.get("end"),
    }


async def delete_event(access_token: str, event_id: str) -> bool:
    """Delete (cancel) a calendar event — used by reversal engine."""
    service = _build_service(access_token)
    service.events().delete(calendarId="primary", eventId=event_id).execute()
    return True


async def list_events(access_token: str, data: dict) -> dict:
    """
    data: { "time_min": ISO str, "time_max": ISO str, "max_results": int }
    """
    service = _build_service(access_token)
    results = service.events().list(
        calendarId="primary",
        timeMin=data.get("time_min"),
        timeMax=data.get("time_max"),
        maxResults=int(data.get("max_results", 10)),
        singleEvents=True,
        orderBy="startTime",
    ).execute()

    events = results.get("items", [])
    return {
        "events": [
            {
                "id": e.get("id"),
                "summary": e.get("summary"),
                "start": e.get("start"),
                "end": e.get("end"),
                "attendees": [a.get("email") for a in e.get("attendees", [])],
            }
            for e in events
        ]
    }


async def read_events(access_token: str, data: dict) -> dict:
    """
    LLM-friendly wrapper.
    data: { "days_ahead": int, "max_results": int }
    Fetches events from now until `days_ahead` days from now.
    """
    from datetime import datetime, timezone, timedelta
    now = datetime.now(timezone.utc)
    days = int(data.get("days_ahead", 7))
    time_max = now + timedelta(days=days)

    return await list_events(access_token, {
        "time_min": now.isoformat(),
        "time_max": time_max.isoformat(),
        "max_results": data.get("max_results", 10),
    })
