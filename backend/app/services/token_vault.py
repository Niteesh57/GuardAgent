"""
app/services/token_vault.py
Fetches third-party access tokens from Auth0 Token Vault
via the Auth0 Management API.

Auth0 Token Vault stores OAuth tokens for connected social
providers (Google, etc.) on behalf of the user — we NEVER
store or log these tokens.
"""
import os
import httpx
from functools import lru_cache
from dotenv import load_dotenv

load_dotenv()

AUTH0_DOMAIN = os.environ.get("AUTH0_DOMAIN")
MGMT_CLIENT_ID = os.environ.get("AUTH0_MGMT_CLIENT_ID")
MGMT_CLIENT_SECRET = os.environ.get("AUTH0_MGMT_CLIENT_SECRET")
MGMT_AUDIENCE = os.environ.get("AUTH0_MGMT_AUDIENCE")

# Map service names to Auth0 connection names
SERVICE_CONNECTION_MAP = {
    "gmail": "google-oauth2",
    "calendar": "google-oauth2",  # Same Google identity, different scopes
    "docs": "google-oauth2",      # Same Google identity, different scopes
    "drive": "google-oauth2",
}

# Required scopes per service
SERVICE_SCOPES = {
    "gmail": "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send",
    "calendar": "https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events",
    "docs": "https://www.googleapis.com/auth/documents",
    "drive": "https://www.googleapis.com/auth/drive.readonly",
}


async def _get_mgmt_token() -> str:
    """Fetch a short-lived Management API token using client credentials."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"https://{AUTH0_DOMAIN}/oauth/token",
            json={
                "grant_type": "client_credentials",
                "client_id": MGMT_CLIENT_ID,
                "client_secret": MGMT_CLIENT_SECRET,
                "audience": MGMT_AUDIENCE,
            },
        )
        resp.raise_for_status()
        return resp.json()["access_token"]


async def get_token(service: str, user_id: str) -> str:
    """
    Fetch a third-party access token from Auth0 Token Vault.
    Returns the raw access token string.
    Raises ValueError if the user hasn't connected this service.
    """
    connection = SERVICE_CONNECTION_MAP.get(service)
    if not connection:
        raise ValueError(f"Unknown service: {service}")

    mgmt_token = await _get_mgmt_token()

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://{AUTH0_DOMAIN}/api/v2/users/{user_id}",
            headers={"Authorization": f"Bearer {mgmt_token}"},
        )
        resp.raise_for_status()
        user_data = resp.json()

    # Look for the linked identity / token vault entry
    identities = user_data.get("identities", [])
    for identity in identities:
        if identity.get("connection") == connection:
            access_token = identity.get("access_token")
            if access_token:
                return access_token

    raise ValueError(
        f"User has not connected {service}. No token found in Token Vault."
    )


async def check_connection(service: str, user_id: str) -> bool:
    """Return True if user has a valid Token Vault entry for this service."""
    try:
        await get_token(service, user_id)
        return True
    except (ValueError, httpx.HTTPError):
        return False


async def get_connect_url(service: str) -> str:
    """
    Return the Auth0 /authorize URL that initiates the Token Vault
    OAuth connection flow for the given service.
    """
    connection = SERVICE_CONNECTION_MAP.get(service)
    if not connection:
        raise ValueError(f"Unknown service: {service}")

    scope = SERVICE_SCOPES.get(service, "openid profile email")
    # URL-encode the connection_scope (spaces -> %20)
    encoded_scope = scope.replace(" ", "%20")
    client_id = os.environ.get("AUTH0_CLIENT_ID", MGMT_CLIENT_ID)
    redirect_uri = os.environ.get("AUTH0_REDIRECT_URI", "http://localhost:8000/callback")

    url = (
        f"https://{AUTH0_DOMAIN}/authorize"
        f"?response_type=code"
        f"&client_id={client_id}"
        f"&connection={connection}"
        f"&redirect_uri={redirect_uri}"
        f"&scope=openid%20profile%20email"
        f"&connection_scope={encoded_scope}"
        f"&access_type=offline"
        f"&prompt=consent"
        f"&state=token_vault_return"
    )
    return url
