from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional, Any, Dict
from datetime import date

from app.services.portfolio_analysis_service import calculate_portfolio_history # Corrected
from schemas import PortfolioHistoryResponseSchema, EquityPointSchema, ProfitabilityDetailsSchema # Corrected
from models import UsuarioResponse # Corrected
from dependencies import get_current_user # Corrected import path
from services import listar_operacoes_service # Corrected

router = APIRouter(
    prefix="/analysis",
    tags=["Analysis"],
    responses={404: {"description": "Not found"}},
)

@router.get("/portfolio/equity-history", response_model=PortfolioHistoryResponseSchema)
async def get_portfolio_equity_history(
    start_date: date,
    end_date: date,
    frequency: Optional[str] = Query('monthly', enum=['daily', 'monthly']),
    current_user: UsuarioResponse = Depends(get_current_user) # Changed dependency function
):
    """
    Calculates and returns the historical equity curve and profitability of a user's portfolio.
    """
    try:
        # Fetch operations for the current user
        user_operations_raw = listar_operacoes_service(usuario_id=current_user.id)

        # Transform operations to match the structure expected by calculate_portfolio_history
        # Specifically, map 'operation' to 'operation_type'
        transformed_operations: List[Dict[str, Any]] = []
        for op_raw in user_operations_raw:
            transformed_op = op_raw.copy() # Ensure all original fields are there
            if 'operation' in transformed_op:
                transformed_op['operation_type'] = transformed_op.pop('operation')
            
            # Ensure date is string "YYYY-MM-DD" if it's not already (it should be from DB/model)
            # The portfolio_analysis_service.Operacao model expects a string or date object for 'date'
            # and its validator will handle it. So, direct pass-through of date object is fine.
            if isinstance(transformed_op.get('date'), date):
                 transformed_op['date'] = transformed_op['date'].isoformat()

            # Ensure 'price' and 'fees' are present, even if service sets defaults, good practice here.
            if 'price' not in transformed_op:
                # This case should ideally not happen if data from DB is clean
                raise ValueError(f"Operation missing 'price': {op_raw.get('id')}")
            if 'fees' not in transformed_op:
                transformed_op['fees'] = 0.0 # Default if missing, though model has default

            transformed_operations.append(transformed_op)

        if start_date > end_date:
            raise ValueError("Start date cannot be after end date.")

        # Call the service function
        history_data = calculate_portfolio_history(
            operations_data=transformed_operations,
            start_date_str=start_date.isoformat(),
            end_date_str=end_date.isoformat(),
            period_frequency=frequency
        )
        
        # Ensure the output from calculate_portfolio_history matches the response schema
        # FastAPI will validate this, but manual check can be useful for debugging
        # Example: history_data might be {'equity_curve': [...], 'profitability': {...details...}}
        # ProfitabilityDetailsSchema expects specific keys.

        return history_data

    except ValueError as ve:
        # ValueErrors can come from date parsing, frequency validation, or business logic
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        # Log the exception e for server-side debugging
        print(f"Unexpected error in get_portfolio_equity_history: {e}") # Basic logging
        raise HTTPException(status_code=500, detail="An unexpected error occurred while calculating portfolio history.")
