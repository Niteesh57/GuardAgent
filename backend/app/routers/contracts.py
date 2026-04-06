"""
app/routers/contracts.py
Action Contract API endpoints.

Flow:
  1. chat_engine calls POST /contract/generate (or returns contract_id in response)
  2. Frontend shows ActionContractCard
  3. User clicks Approve → POST /contract/execute/{id}
  4. User clicks Edit+Send → POST /contract/execute/{id} with edited_args
  5. User clicks Reject → POST /contract/reject/{id}
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
from app.auth import get_user_id
from app.engines.graph.graph import run_to_contract, execute_contract, reject_contract, get_contract
from app.services.action_logger import log_action

router = APIRouter(prefix="/contract", tags=["Contracts"])


class GenerateContractRequest(BaseModel):
    action: str
    args: dict
    user_query: str


class ExecuteContractRequest(BaseModel):
    edited_args: Optional[dict] = None
    selected_file_ids: Optional[list[str]] = None


class RejectContractRequest(BaseModel):
    reason: str = "User rejected the contract"


@router.post("/generate")
async def generate_contract(
    body: GenerateContractRequest,
    user_id: str = Depends(get_user_id),
):
    """
    Stage 1: Generate a human-readable Action Contract for a proposed tool call.
    Returns the contract data + contract_id needed to approve/reject.
    """
    contract = await run_to_contract(
        action=body.action,
        args=body.args,
        user_query=body.user_query,
        user_id=user_id,
    )
    return contract


@router.post("/execute/{contract_id}")
async def execute_contract_endpoint(
    contract_id: str,
    body: ExecuteContractRequest,
    user_id: str = Depends(get_user_id),
):
    """
    Stage 2: User approved the contract (with optional edits).
    Executes the action via the intent engine.
    """
    contract = get_contract(contract_id)
    
    # Store user-curated permissions in the engine BEFORE execution
    if contract and contract.get("action") == "read_drive_file":
        if body.selected_file_ids is not None:
            from app.engines.resource_permission_engine import resource_engine
            resource_engine.grant_access(user_id, body.selected_file_ids)
            # Ensure the execution args only request what was officially selected
            if body.edited_args is None:
                body.edited_args = contract.get("args", {}).copy()
            body.edited_args["file_ids"] = body.selected_file_ids
            
    result = await execute_contract(
        contract_id=contract_id,
        user_id=user_id,
        edited_args=body.edited_args,
    )

    # Log the approved execution
    contract = get_contract(contract_id)
    if contract:
        log_action(
            user_id=user_id,
            action=contract.get("action", "unknown"),
            status=result.get("status", "unknown"),
            service_used=contract.get("action", "unknown").split("_")[-1],
            metadata={"contract_id": contract_id, "edited": body.edited_args is not None},
        )

    print("\n\n=== CONTRACT EXECUTE RESULT ===")
    print(result)
    print("===============================\n\n")

    return result


@router.post("/reject/{contract_id}")
async def reject_contract_endpoint(
    contract_id: str,
    body: RejectContractRequest,
    user_id: str = Depends(get_user_id),
):
    """
    User rejected the contract.
    Logs the rejection and returns an agent acknowledgment message.
    """
    result = reject_contract(contract_id=contract_id, user_id=user_id)

    contract = get_contract(contract_id)
    if contract:
        log_action(
            user_id=user_id,
            action=contract.get("action", "unknown"),
            status="rejected_by_user",
            service_used="none",
            metadata={"contract_id": contract_id, "reason": body.reason},
        )

    return result


@router.get("/{contract_id}")
async def get_contract_endpoint(
    contract_id: str,
    user_id: str = Depends(get_user_id),
):
    """Retrieve a specific contract by ID."""
    contract = get_contract(contract_id)
    if not contract or contract.get("user_id") != user_id:
        return {"error": "Contract not found."}
    return contract
