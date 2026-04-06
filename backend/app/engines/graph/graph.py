"""
app/engines/graph/graph.py

The Contract Graph — a LangGraph-style multi-agent orchestrator.

Pipeline:
  [IntentNode] → [ContractNode] → {wait for user decision}
                                        ↓
                              [ExecutorNode] → result

This module:
- Runs the pipeline up to the contract (pauses for user approval)
- Stores pending contracts in memory by contract_id
- Executes approved contracts via the intent engine
"""
import uuid
from typing import Optional
from app.engines.graph.nodes.contract_node import run_contract_node
from app.engines.intent_engine import execute_intent

# In-memory contract store: contract_id → contract dict
# In production, replace with Redis or a DB
_pending_contracts: dict[str, dict] = {}


async def run_to_contract(
    action: str,
    args: dict,
    user_query: str,
    user_id: str,
) -> dict:
    """
    Agent-to-Agent Pipeline Stage 1:
      IntentNode: we already know the action + args from the LLM tool call.
      ContractNode: generate a human-readable action contract.

    Returns the contract dict + a contract_id the frontend uses to approve/reject.
    """
    # Node 1: Intent is already resolved (passed in from chat_engine)
    # Node 2: Contract generation
    contract = await run_contract_node(action=action, args=args, user_query=user_query, user_id=user_id)

    # Store the contract pending user approval
    contract_id = str(uuid.uuid4())
    _pending_contracts[contract_id] = {
        "id": contract_id,
        "user_id": user_id,
        "user_query": user_query,
        "status": "pending",
        **contract,
    }

    return {
        "contract_id": contract_id,
        **contract,
    }


async def execute_contract(
    contract_id: str,
    user_id: str,
    edited_args: Optional[dict] = None,
) -> dict:
    """
    Agent-to-Agent Pipeline Stage 2 (post-approval):
      ExecutorNode: execute the approved contract via the intent engine.

    edited_args: if the user modified the contract (e.g., tweaked the email body),
                 these override the original args.
    """
    contract = _pending_contracts.get(contract_id)
    if not contract:
        return {"error": "Contract not found or already executed."}

    if contract["user_id"] != user_id:
        return {"error": "Unauthorized."}

    if contract["status"] != "pending":
        return {"error": f"Contract is already '{contract['status']}'."}

    action = contract["action"]
    args = edited_args if edited_args is not None else contract["args"]

    # Node 3: Executor — calls the intent engine
    result = await execute_intent(
        action=action,
        data=args,
        user_id=user_id,
        confirmed=True,
    )

    # Mark contract as executed
    _pending_contracts[contract_id]["status"] = "executed"
    _pending_contracts[contract_id]["result"] = result

    return result


def reject_contract(contract_id: str, user_id: str) -> dict:
    """Mark a contract as rejected by the user."""
    contract = _pending_contracts.get(contract_id)
    if not contract:
        return {"error": "Contract not found."}
    if contract["user_id"] != user_id:
        return {"error": "Unauthorized."}

    _pending_contracts[contract_id]["status"] = "rejected"

    action_titles = {
        "read_emails": "read your Gmail inbox",
        "send_email": "send the email",
        "read_calendar": "check your calendar",
        "create_calendar_event": "create the calendar event",
        "create_document": "create the document",
        "edit_document": "edit the document",
        "template_document": "create the document from template",
    }
    description = action_titles.get(contract["action"], f"perform '{contract['action']}'")

    return {
        "status": "rejected",
        "contract_id": contract_id,
        "agent_message": (
            f"Understood — I won't {description}. "
            "Your decision has been noted. Just let me know if you change your mind."
        ),
    }


def get_contract(contract_id: str) -> Optional[dict]:
    """Retrieve a contract by ID."""
    return _pending_contracts.get(contract_id)
