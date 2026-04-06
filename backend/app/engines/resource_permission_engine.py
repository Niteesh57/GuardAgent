"""
app/engines/resource_permission_engine.py
In-memory store for Selective Scope Authorization (User-Curated Permissions).
Tracks which specific resources (file IDs) a user has explicitly approved for agent access.
"""

class ResourcePermissionEngine:
    def __init__(self):
        # Maps user_id -> set of allowed file_ids
        # e.g., "auth0|123": {"file_1A", "file_2B"}
        self._allowed_resources: dict[str, set[str]] = {}

    def grant_access(self, user_id: str, file_ids: list[str]):
        """Explicitly add file_ids to the allowed list for a user."""
        if user_id not in self._allowed_resources:
            self._allowed_resources[user_id] = set()
        self._allowed_resources[user_id].update(file_ids)

    def revoke_access(self, user_id: str, file_ids: list[str]):
        """Revoke access to specific file_ids for a user."""
        if user_id in self._allowed_resources:
            for fid in file_ids:
                self._allowed_resources[user_id].discard(fid)

    def check_access(self, user_id: str, file_id: str) -> bool:
        """Returns True if the user has authorized the agent to read this file."""
        return file_id in self._allowed_resources.get(user_id, set())

    def get_allowed(self, user_id: str) -> list[str]:
        """Returns all currently explicitly allowed file_ids."""
        return list(self._allowed_resources.get(user_id, set()))

# Singleton instance for the demo
resource_engine = ResourcePermissionEngine()
