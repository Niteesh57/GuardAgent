"""
app/services/session_store.py
Persistent chat session storage using SQLite.
"""
import sqlite3
import json
import uuid
from datetime import datetime
from pathlib import Path

# Database file lives in the backend directory
DB_PATH = Path(__file__).parent.parent.parent / "chat_sessions.db"


def _get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Create tables if they don't exist. Called on startup."""
    with _get_conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                name TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                permission_request TEXT,
                created_at TEXT NOT NULL,
                action_contract TEXT,
                is_email_animation BOOLEAN DEFAULT 0
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id)")
        
        # Schema evolution for dynamic updates
        try:
            conn.execute("ALTER TABLE messages ADD COLUMN action_contract TEXT")
        except sqlite3.OperationalError:
            pass
        try:
            conn.execute("ALTER TABLE messages ADD COLUMN is_email_animation BOOLEAN DEFAULT 0")
        except sqlite3.OperationalError:
            pass
            
        conn.commit()


# ─── Session CRUD ─────────────────────────────────────────────────────────────

def create_session(user_id: str, name: str = None) -> dict:
    session_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    if not name:
        name = f"Session {datetime.utcnow().strftime('%b %d, %H:%M')}"
    with _get_conn() as conn:
        conn.execute(
            "INSERT INTO sessions(id, user_id, name, created_at, updated_at) VALUES(?,?,?,?,?)",
            (session_id, user_id, name, now, now)
        )
        conn.commit()
    return {"id": session_id, "name": name, "created_at": now, "updated_at": now, "message_count": 0}


def list_sessions(user_id: str) -> list:
    with _get_conn() as conn:
        rows = conn.execute("""
            SELECT s.id, s.name, s.created_at, s.updated_at,
                   COUNT(m.id) as message_count
            FROM sessions s
            LEFT JOIN messages m ON m.session_id = s.id
            WHERE s.user_id = ?
            GROUP BY s.id
            ORDER BY s.updated_at DESC
        """, (user_id,)).fetchall()
    return [dict(r) for r in rows]


def get_session(session_id: str, user_id: str) -> dict | None:
    with _get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM sessions WHERE id=? AND user_id=?", (session_id, user_id)
        ).fetchone()
    if not row:
        return None
    return dict(row)


def rename_session(session_id: str, user_id: str, name: str) -> bool:
    now = datetime.utcnow().isoformat()
    with _get_conn() as conn:
        cur = conn.execute(
            "UPDATE sessions SET name=?, updated_at=? WHERE id=? AND user_id=?",
            (name, now, session_id, user_id)
        )
        conn.commit()
    return cur.rowcount > 0


def delete_session(session_id: str, user_id: str) -> bool:
    with _get_conn() as conn:
        conn.execute("DELETE FROM messages WHERE session_id=?", (session_id,))
        cur = conn.execute(
            "DELETE FROM sessions WHERE id=? AND user_id=?", (session_id, user_id)
        )
        conn.commit()
    return cur.rowcount > 0


# ─── Message CRUD ─────────────────────────────────────────────────────────────

def get_messages(session_id: str, user_id: str) -> list:
    """Returns messages in order for a given session (ownership checked via join)."""
    with _get_conn() as conn:
        rows = conn.execute("""
            SELECT m.id, m.role, m.content, m.permission_request, m.created_at, m.action_contract, m.is_email_animation
            FROM messages m
            JOIN sessions s ON s.id = m.session_id
            WHERE m.session_id=? AND s.user_id=?
            ORDER BY m.created_at ASC
        """, (session_id, user_id)).fetchall()
    result = []
    for r in rows:
        msg = dict(r)
        if msg["permission_request"]:
            msg["permission_request"] = json.loads(msg["permission_request"])
        if msg["action_contract"]:
            msg["action_contract"] = json.loads(msg["action_contract"])
        result.append(msg)
    return result


def append_message(session_id: str, role: str, content: str, permission_request: dict = None, action_contract: dict = None, is_email_animation: bool = False) -> dict:
    msg_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    pr_json = json.dumps(permission_request) if permission_request else None
    ac_json = json.dumps(action_contract) if action_contract else None
    with _get_conn() as conn:
        conn.execute(
            "INSERT INTO messages(id, session_id, role, content, permission_request, action_contract, is_email_animation, created_at) VALUES(?,?,?,?,?,?,?,?)",
            (msg_id, session_id, role, content, pr_json, ac_json, 1 if is_email_animation else 0, now)
        )
        # Update session's updated_at
        conn.execute(
            "UPDATE sessions SET updated_at=? WHERE id=?", (now, session_id)
        )
        conn.commit()
    return {"id": msg_id, "role": role, "content": content,
            "permission_request": permission_request, "action_contract": action_contract, "is_email_animation": is_email_animation, "created_at": now}


def update_message(msg_id: str, content: str = None, action_contract: dict = None, is_email_animation: bool = None) -> bool:
    with _get_conn() as conn:
        updates = []
        params = []
        if content is not None:
            updates.append("content=?")
            params.append(content)
        if action_contract is not None:
            updates.append("action_contract=?")
            params.append(json.dumps(action_contract))
        if is_email_animation is not None:
            updates.append("is_email_animation=?")
            params.append(1 if is_email_animation else 0)
            
        if not updates:
            return False
            
        params.append(msg_id)
        query = f"UPDATE messages SET {', '.join(updates)} WHERE id=?"
        cur = conn.execute(query, tuple(params))
        conn.commit()
    return cur.rowcount > 0
