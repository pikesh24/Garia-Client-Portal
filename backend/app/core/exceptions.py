from fastapi import HTTPException, status


class BusinessRuleViolation(HTTPException):
    """422 -- the request is well-formed but violates a domain rule
    (e.g. meeting <24h away, missing actual_hours_taken, unchecked verification box)."""

    def __init__(self, detail: str):
        super().__init__(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=detail)


class IrreversibleActionConflict(HTTPException):
    """409 -- an irreversible action has already been executed and cannot be repeated
    (e.g. feature already authorized, base feature already activated)."""

    def __init__(self, detail: str):
        super().__init__(status_code=status.HTTP_409_CONFLICT, detail=detail)
