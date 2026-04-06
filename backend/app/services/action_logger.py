"""
app/services/action_logger.py
Appends structured action logs to a JSONL file.
Every agent action — success or failure — is logged here.
"""
import os
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

LOG_FILE = os.environ.get("LOG_FILE", "logs/actions.jsonl")


def _ensure_log_dir():
    Path(LOG_FILE).parent.mkdir(parents=True, exist_ok=True)


def log_action(
    user_id: str,
    action: str,
    status: str,
    service_used: str,
    permissions_used: list[str] | None = None,
    metadata: dict | None = None,
) -> dict:
    """
    Append a structured log entry and return its full record (with log_id).
    status should be "success" | "failure" | "permission_requested"
    """
    _ensure_log_dir()

    record = {
        "log_id": str(uuid.uuid4()),
        "user_id": user_id,
        "action": action,
        "status": status,
        "service_used": service_used,
        "permissions_used": permissions_used or [],
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "metadata": metadata or {},
    }

    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps(record) + "\n")

    return record


def get_recent_logs(limit: int = 20) -> list[dict]:
    """Return the most recent `limit` log entries."""
    _ensure_log_dir()
    try:
        with open(LOG_FILE, "r", encoding="utf-8") as f:
            lines = [l.strip() for l in f if l.strip()]
        records = [json.loads(l) for l in lines]
        return records[-limit:]
    except FileNotFoundError:
        return []


def get_log_by_id(log_id: str) -> dict | None:
    """Retrieve a single log record by its log_id."""
    try:
        with open(LOG_FILE, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                record = json.loads(line)
                if record.get("log_id") == log_id:
                    return record
    except FileNotFoundError:
        pass
    return None
