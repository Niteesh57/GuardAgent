import uuid
from fastapi import APIRouter, Request, Response
from fastapi.responses import JSONResponse, RedirectResponse
from app.auth import auth0

router = APIRouter(tags=["Auth"])

def _get_or_create_session(request: Request, response: Response = None) -> str:
    session_id = request.cookies.get("cloud_agent_session")
    if not session_id:
        session_id = str(uuid.uuid4())
        if response:
            response.set_cookie("cloud_agent_session", session_id, httponly=True)
    return session_id

@router.get("/login")
async def login(request: Request):
    """Initiates the Auth0 login flow."""
    try:
        import uuid
        session_id = request.cookies.get("cloud_agent_session") or str(uuid.uuid4())
        
        # Start interactive login
        auth_url = await auth0.start_interactive_login(store_options={"session_id": session_id})
        
        response = RedirectResponse(url=auth_url)
        response.set_cookie("cloud_agent_session", session_id, httponly=True)
        return response
    except Exception as e:
        print(f"Login error: {e}")
        return RedirectResponse(url="http://localhost:3000/?error=login_failed")


@router.get("/callback")
async def callback(request: Request):
    """Handles the Auth0 callback."""
    try:
        session_id = _get_or_create_session(request)
        
        # Bypass for Token Vault third-party connections
        if request.query_params.get("state") == "token_vault_return":
            return RedirectResponse(url="http://localhost:3000/")
            
        url = str(request.url)
        
        # Complete login
        session_data = await auth0.complete_interactive_login(url, store_options={"session_id": session_id})
        
        res = RedirectResponse(url="http://localhost:3000/")
        # Ensure cookie stays
        res.set_cookie("cloud_agent_session", session_id, httponly=True)
        return res
    except Exception as e:
        print(f"Callback error: {e}")
        return RedirectResponse(url=f"http://localhost:3000/?error=auth_failed")


@router.get("/logout")
async def logout(request: Request):
    """Handles Auth0 logout."""
    try:
        session_id = _get_or_create_session(request)
        
        logout_url = await auth0.logout(store_options={"session_id": session_id})
        res = RedirectResponse(url=logout_url if isinstance(logout_url, str) else "http://localhost:3000/")
        res.delete_cookie("cloud_agent_session")
        return res
    except Exception as e:
        print(f"Logout error: {e}")
        res = RedirectResponse(url="http://localhost:3000/")
        res.delete_cookie("cloud_agent_session")
        return res


@router.get("/me")
async def get_profile(request: Request):
    """Returns the current user profile from the session."""
    try:
        session_id = request.cookies.get("cloud_agent_session")
        if not session_id:
            return {"isAuthenticated": False, "user": None}
            
        session = await auth0.get_session(store_options={"session_id": session_id})
        if session:
            # Depending on auth0-server-python session format
            return {"isAuthenticated": True, "user": getattr(session, 'user', session)}
        return {"isAuthenticated": False, "user": None}
    except Exception as e:
        print(f"Me error: {e}")
        return {"isAuthenticated": False, "user": None}

