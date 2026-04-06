"""
app/adapters/firecrawl_adapter.py
Firecrawl API integration for web research.
Uses the FIRECRAWL_API_KEY from .env — no OAuth required.
"""
import os
import httpx
from typing import Any, Dict

FIRECRAWL_API_KEY = os.environ.get("FIRECRAWL_API_KEY", "")
FIRECRAWL_BASE_URL = "https://api.firecrawl.dev/v1"


async def research_topic(_token: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Search the web for a topic using Firecrawl and return
    a structured list of results with title, url, and markdown content.

    data:
      - topic: str  — The research topic/query to search for
      - num_results: int (optional) — How many results to retrieve (default: 5)
    """
    topic = data.get("topic", "").strip()
    num_results = int(data.get("num_results", 5))

    if not topic:
        return {"error": "No topic provided for research."}

    if not FIRECRAWL_API_KEY:
        return {"error": "FIRECRAWL_API_KEY is not configured in the environment."}

    headers = {
        "Authorization": f"Bearer {FIRECRAWL_API_KEY}",
        "Content-Type": "application/json",
    }

    payload = {
        "query": topic,
        "limit": num_results,
        "scrapeOptions": {
            "formats": ["markdown"],
        }
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{FIRECRAWL_BASE_URL}/search",
            headers=headers,
            json=payload,
        )

    if response.status_code != 200:
        return {"error": f"Firecrawl API error {response.status_code}: {response.text[:500]}"}

    resp_json = response.json()
    raw_results = resp_json.get("data", [])

    results = []
    for item in raw_results:
        content = item.get("markdown", "") or item.get("content", "")
        # Truncate each result to avoid overflowing the LLM context
        if len(content) > 4000:
            content = content[:4000] + "\n...[TRUNCATED]..."
        results.append({
            "title": item.get("title", "Untitled"),
            "url": item.get("url", ""),
            "content": content,
        })

    return {
        "topic": topic,
        "results": results,
        "total": len(results),
    }
