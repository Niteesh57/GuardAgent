"""
app/engines/graph/nodes/contract_node.py

ContractNode — A dedicated Groq LLM agent that generates a structured
Action Contract for any given tool call.

This is Agent 2 of 3 in the multi-agent pipeline:
  IntentNode → ContractNode → ExecutorNode

The contract tells the user exactly:
  - What steps will be executed
  - What permissions are needed
  - What data is accessed
  - The risk level
  - Whether the action can be undone
"""
import os
import json
from groq import AsyncGroq
from dotenv import load_dotenv

load_dotenv()

groq_client = AsyncGroq(api_key=os.environ.get("GROQ_API_KEY"))

CONTRACT_SYSTEM_PROMPT = """You are the Contract Generator agent for an AI assistant.
Your job is to generate a precise, honest Action Contract before any sensitive action is taken.

You will be given:
- The action the agent wants to take (e.g., send_email)
- The arguments (e.g., to, subject, body)
- The user's original request

You must return a JSON object with EXACTLY these fields:
{
  "action_title": "Human-readable action name (e.g., 'Send Birthday Email')",
  "steps": ["Step 1 description", "Step 2 description", ...],
  "permissions_needed": [{"scope": "gmail.send", "reason": "To send the email"}],
  "data_used": ["Only the email address you specified", "Email subject and body you requested"],
  "data_not_used": ["Your inbox is not read", "No other emails are accessed"],
  "risk_level": "Low" | "Medium" | "High",
  "risk_reason": "Short explanation of risk level",
  "reversible": true | false,
  "reversible_description": "How to undo this action (or 'This action cannot be undone')",
  "estimated_time": "< 1 second" | "1-3 seconds" | "3-10 seconds"
}

RULES:
- Be specific and honest. Don't downplay risk.
- steps should be 2-5 items, max.
- Always return valid JSON only — no markdown, no prefixes.
"""


async def run_contract_node(action: str, args: dict, user_query: str, user_id: str) -> dict:
    """
    Agent 2: Contract Generator.
    Takes an action + its arguments and returns a structured Action Contract.
    """
    prompt = f"""Generate an Action Contract for this situation:

Action: {action}
Arguments: {json.dumps(args, indent=2)}
User's original request: "{user_query}"

Return only the JSON contract object."""

    response = await groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": CONTRACT_SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        max_tokens=600,
        temperature=0.1,
        response_format={"type": "json_object"},
    )

    raw = response.choices[0].message.content.strip()
    contract_data = json.loads(raw)

    # Ensure all required fields exist with defaults
    contract_payload = {
        "action_title": contract_data.get("action_title", action.replace("_", " ").title()),
        "action": action,
        "args": args,
        "steps": contract_data.get("steps", ["Execute the requested action"]),
        "permissions_needed": contract_data.get("permissions_needed", []),
        "data_used": contract_data.get("data_used", []),
        "data_not_used": contract_data.get("data_not_used", []),
        "risk_level": contract_data.get("risk_level", "Medium"),
        "risk_reason": contract_data.get("risk_reason", ""),
        "reversible": contract_data.get("reversible", False),
        "reversible_description": contract_data.get(
            "reversible_description", "Contact Google support to recall the email"
        ),
        "estimated_time": contract_data.get("estimated_time", "< 1 second"),
    }
    
    if action == "read_drive_file":
        from app.services.token_vault import get_token
        from app.adapters.drive_adapter import search_drive
        try:
            token = await get_token("drive", user_id)
            # Fetch a list of files from Drive to populate the selectable resources UI
            search_response = await search_drive(token, {"query": ""})
            drive_files = search_response.get("files", [])
            
            requested_ids = args.get("file_ids", [])
            if isinstance(requested_ids, str):
                requested_ids = [requested_ids]
                
            contract_payload["selectable_resources"] = [
                {"id": f["id"], "name": f["name"], "selected": f["id"] in requested_ids}
                for f in drive_files
            ]
        except Exception:
            # Fallback if there's an issue fetching real files for the UI
            contract_payload["selectable_resources"] = []

    return contract_payload
