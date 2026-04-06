"""
app/auth.py
Auth0 Server Client (Backend-for-Frontend OAuth flow)
Uses the auth0_server_python SDK provided by the user.
"""
import os
from auth0_server_python.auth_server.server_client import ServerClient
from dotenv import load_dotenv

load_dotenv()

class MemoryStateStore:
    """In-memory state store for session data (development only)"""
    def __init__(self):
        self._data = {}
    
    async def get(self, key, options=None):
        print(f"StateStore.get(key={key}, options={options})")
        return self._data.get(key)
    
    async def set(self, key, value, options=None):
        print(f"StateStore.set(key={key}, options={options})")
        self._data[key] = value
    
    async def delete(self, key, options=None):
        print(f"StateStore.delete(key={key}, options={options})")
        self._data.pop(key, None)
    
    async def delete_by_logout_token(self, claims, options=None):
        pass

class MemoryTransactionStore:
    """In-memory transaction store for OAuth flows (development only)"""
    def __init__(self):
        self._data = {}
    
    async def get(self, key, options=None):
        return self._data.get(key)
    
    async def set(self, key, value, options=None):
        self._data[key] = value
    
    async def delete(self, key, options=None):
        self._data.pop(key, None)

state_store = MemoryStateStore()
transaction_store = MemoryTransactionStore()

auth0 = ServerClient(
    domain=os.getenv('AUTH0_DOMAIN'),
    client_id=os.getenv('AUTH0_CLIENT_ID'),
    client_secret=os.getenv('AUTH0_CLIENT_SECRET'),
    secret=os.getenv('AUTH0_SECRET', 'a_very_long_random_string_for_session_encryption_12345'),
    redirect_uri=os.getenv('AUTH0_REDIRECT_URI', 'http://localhost:8000/callback'),
    state_store=state_store,
    transaction_store=transaction_store,
    authorization_params={
        'scope': 'openid profile email',
        'audience': os.getenv('AUTH0_AUDIENCE', '')
    }
)

from fastapi import Request, HTTPException

async def get_current_user(request: Request) -> dict:
    """Dependency to enforce valid Auth0 session and optionally check scopes."""
    session_id = request.cookies.get("cloud_agent_session")
    if not session_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
        
    session = await auth0.get_session(store_options={"session_id": session_id})
    if not session:
        print(f"DEBUG: No session found for session_id: {session_id}")
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    print(f"DEBUG: Raw session object type: {type(session)}")
    # If session is a dict, print its keys
    if isinstance(session, dict):
        print(f"DEBUG: Session keys: {list(session.keys())}")
        user = session.get("user") or session
    else:
        # If session is an object, check for .user attribute
        user = getattr(session, 'user', session)
    
    print(f"DEBUG: User object type: {type(user)}")
    if isinstance(user, dict):
        print(f"DEBUG: User keys: {list(user.keys())}")
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid session data")
    return user

async def get_user_id(request: Request) -> str:
    user = await get_current_user(request)
    # Try looking for 'sub' in common places
    sub = None
    if isinstance(user, dict):
        sub = user.get("sub") or user.get("user_id")
    else:
        sub = getattr(user, "sub", None) or getattr(user, "user_id", None)
        
    if not sub:
        print(f"DEBUG: Sub missing. User data: {user}")
        raise HTTPException(status_code=401, detail="User identifier (sub) missing from session")
    return sub
