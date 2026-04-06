"""
app/adapters/drive_adapter.py
Google Drive adapter showing Selective Scope Authorization with Real API.
"""
import io
from typing import Dict, Any
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
from google.oauth2.credentials import Credentials
from app.engines.resource_permission_engine import resource_engine

def _build_service(access_token: str):
    creds = Credentials(token=access_token)
    return build("drive", "v3", credentials=creds)

async def search_drive(token: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """Safe action. Searches drive returning only names and IDs."""
    service = _build_service(token)
    query = data.get("query", "").lower()
    
    # We always use pagination if there are many. Since this is an agent, we return a short page size.
    q_str = ""
    if query:
        # Basic search on name
        q_str = f"name contains '{query}'"
        
    results = service.files().list(
        q=q_str if q_str else None,
        pageSize=15, 
        fields="nextPageToken, files(id, name, mimeType)",
        orderBy="modifiedTime desc"
    ).execute()
    
    files = results.get("files", [])
    return {
        "files": [{"id": f["id"], "name": f["name"], "mimeType": f.get("mimeType", "")} for f in files]
    }

async def read_drive_file(token: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Contract-required action. Reads actual contents of the files.
    This request is INTERCEPTED by the Selective Scope Authorization layer.
    """
    service = _build_service(token)
    file_ids = data.get("file_ids", [])
    if isinstance(file_ids, str):
        file_ids = [file_ids]
        
    user_id = data.get("_user_id")
    if not user_id:
        raise ValueError("Missing user context for Resource Permission Engine.")

    read_contents = []
    blocked_files = []

    for fid in file_ids:
        # THE CORE INNOVATION: Check against User-Curated Permissions
        has_access = resource_engine.check_access(user_id, fid)
        if not has_access:
            blocked_files.append(fid)
            continue
            
        try:
            # First, get file metadata to determine how to download it
            file_meta = service.files().get(fileId=fid, fields="id, name, mimeType").execute()
            mime_type = file_meta.get("mimeType", "")
            
            # Google Workspace documents must be exported
            if mime_type.startswith("application/vnd.google-apps."):
                if mime_type == "application/vnd.google-apps.document":
                    request = service.files().export_media(fileId=fid, mimeType="text/plain")
                elif mime_type == "application/vnd.google-apps.presentation":
                    request = service.files().export_media(fileId=fid, mimeType="text/plain")
                elif mime_type == "application/vnd.google-apps.spreadsheet":
                    request = service.files().export_media(fileId=fid, mimeType="text/csv")
                else:
                    read_contents.append({"id": fid, "error": f"Unsupported Google Workspace format: {mime_type}"})
                    continue
            else:
                # Regular files (PDFs, text files, etc.)
                request = service.files().get_media(fileId=fid)

            # Download the content
            fh = io.BytesIO()
            downloader = MediaIoBaseDownload(fh, request)
            done = False
            while done is False:
                status, done = downloader.next_chunk()

            content_bytes = fh.getvalue()
            
            # Try to decode as text
            try:
                content_str = content_bytes.decode("utf-8")
                # Truncate content if it's too large for LLM context
                if len(content_str) > 20000:
                    content_str = content_str[:20000] + "\n...[CONTENT TRUNCATED FOR LENGTH]..."
            except UnicodeDecodeError:
                content_str = "[Binary or Non-UTF8 Content. Cannot directly read as text.]"
                
            read_contents.append({
                "id": fid,
                "name": file_meta.get("name"),
                "content": content_str
            })
            
        except Exception as e:
            err_str = str(e).lower()
            if "missing refresh token" in err_str or "refresh the access token" in err_str or "401" in err_str or "unauthorized" in err_str:
                raise e # Let it bubble up to trigger re-auth
            read_contents.append({"id": fid, "error": f"Failed to read file: {str(e)}"})

    response = {"read_files": read_contents}
    
    # Clearly communicate if the AI was blocked by the user's granular constraints
    if blocked_files:
        response["BLOCKED_BY_USER_CURATED_PERMISSIONS"] = (
            f"The following files could not be read because you did not grant "
            f"explicit permission for them: {blocked_files}"
        )
        
    return response
