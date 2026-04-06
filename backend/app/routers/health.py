"""
app/routers/health.py
Public health check and debug endpoints.
"""
from fastapi import APIRouter, Depends
from datetime import datetime, timezone

from app.auth import get_user_id
from app.services.token_vault import _get_mgmt_token, AUTH0_DOMAIN, SERVICE_CONNECTION_MAP
import httpx

router = APIRouter()


@router.get("/health")
async def health():
    return {
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "service": "Guard-agent-api",
    }


@router.get("/debug/vault")
async def debug_vault(user_id: str = Depends(get_user_id)):
    """
    Debug endpoint: returns the raw Auth0 identity data for the authenticated user.
    Shows whether access_token is present or null for connected social providers.
    Remove this endpoint before going to production.
    """
    try:
        mgmt_token = await _get_mgmt_token()
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"https://{AUTH0_DOMAIN}/api/v2/users/{user_id}",
                headers={"Authorization": f"Bearer {mgmt_token}"},
            )
            resp.raise_for_status()
            user_data = resp.json()

        identities = user_data.get("identities", [])
        # Summarise each identity without leaking full tokens
        identity_summary = []
        for identity in identities:
            access_token = identity.get("access_token")
            identity_summary.append({
                "provider": identity.get("provider"),
                "connection": identity.get("connection"),
                "has_access_token": access_token is not None,
                "access_token_preview": (access_token[:12] + "...") if access_token else None,
                "has_refresh_token": identity.get("refresh_token") is not None,
            })

        return {
            "user_id": user_id,
            "identities": identity_summary,
            "raw_identity_count": len(identities),
        }
    except Exception as e:
        return {"error": str(e), "user_id": user_id}
