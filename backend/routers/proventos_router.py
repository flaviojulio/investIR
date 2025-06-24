from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional # Optional might be needed if db session becomes truly optional

# Service function and Pydantic schema
from app.services.proventos_service import get_sum_earnings_last_12_months, MonthlyEarnings

# User model and authentication dependency
from models import UsuarioResponse
from dependencies import get_current_user

# Regarding database session:
# The service get_sum_earnings_last_12_months has `db: Session` in its signature.
# However, the underlying database call in `database.py` (get_sum_proventos_by_month_for_user)
# uses its own `get_db()` context manager and does not use the passed 'db' Session.
# Therefore, we don't need to inject a real DB session here for that specific service call.
# We will pass `None` for the `db` argument.
# If other services were used that DO require an external Session, a proper
# DB dependency like `get_db_session` would be needed from `backend.dependencies`.

router = APIRouter(
    prefix="/proventos",
    tags=["Proventos"],
    # dependencies=[Depends(get_current_user)] # Apply to all routes in this router if needed
)

@router.get("/resumo/ultimos-12-meses", response_model=List[MonthlyEarnings])
async def get_last_12_months_earnings_summary(
    current_user: UsuarioResponse = Depends(get_current_user)
    # db: Optional[Session] = None # Explicitly not depending on a DB session from FastAPI for this call
):
    """
    Retorna o resumo de proventos recebidos pelo usuário nos últimos 12 meses,
    incluindo o mês atual e os 11 meses anteriores.
    """
    try:
        # Pass db=None as it's not used by the service due to database.py's self-managed connections
        earnings_summary = get_sum_earnings_last_12_months(db=None, user_id=current_user.id)
        return earnings_summary
    except Exception as e:
        # Log the exception e here for debugging purposes on the server
        # print(f"Error in /proventos/resumo/ultimos-12-meses: {e}") # Basic logging
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno ao calcular o resumo de proventos."
        )

# Example of how another endpoint might look if it needed a DB session directly:
# from sqlalchemy.orm import Session
# from backend.database import get_db_session_actual_dependency # Assuming this exists

# @router.get("/outro-exemplo")
# async def another_example(
#     db: Session = Depends(get_db_session_actual_dependency), # Actual DB session
#     current_user: UsuarioResponse = Depends(get_current_user)
# ):
#     # some_data = some_other_service(db=db, user_id=current_user.id)
#     return {"message": "This endpoint would use a DB session."}
