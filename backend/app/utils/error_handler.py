"""
Standardized return formats for all agents.

Every agent must return its result using agent_result().
Errors are collected centrally in state["errors"] using make_error().
"""


def make_error(agent: str, message: str) -> dict:
    """
    Create a standardized error object.

    Args:
        agent:   Name of the agent that produced the error.
        message: Human-readable error description.
    """
    return {
        "agent": agent,
        "message": message,
    }


def agent_result(status: str, data: dict) -> dict:
    """
    Wrap an agent's output in a standardized envelope.

    Args:
        status: One of "success" | "failed" | "partial"
        data:   The agent's output payload.
    """
    assert status in {"success", "failed", "partial"}, f"Invalid status: {status}"
    return {
        "status": status,
        "data": data,
    }
