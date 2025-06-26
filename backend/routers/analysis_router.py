from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional, Any, Dict
from datetime import date, datetime
import schemas
from app.services.portfolio_analysis_service import calculate_portfolio_history
from models import UsuarioResponse
from dependencies import get_current_user
from services import listar_operacoes_service
from database import get_db

router = APIRouter(
    prefix="/analysis",
    tags=["Analysis"],
    responses={404: {"description": "Not found"}},
)

@router.get("/portfolio/equity-history", response_model=schemas.PortfolioHistoryResponseSchema) # Prefixed with schemas.
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

@router.get("/bens-e-direitos/acoes", response_model=List[schemas.BemDireitoAcaoSchema]) # Corrected schema import
async def get_bens_e_direitos_acoes_endpoint(
    year: int = Query(..., description="The year for which to retrieve the assets and rights information (e.g., 2023). Value will be as of December 31st of this year."),
    current_user: UsuarioResponse = Depends(get_current_user)
):
    """
    Retrieves the list of stock assets (ações) held by the user on December 31st
    of the specified year, formatted for "Bens e Direitos" tax declaration.
    """
    try:
        if year < 1900 or year > datetime.now().year + 5: # Basic year validation
            raise ValueError("Year is out of a reasonable range.")

        target_date_str = f"{year}-12-31"

        # Correctly import and call the service function
        from app.services.portfolio_analysis_service import get_bens_e_direitos_acoes as service_get_bens_e_direitos_acoes # Corrected import

        bens_e_direitos_data = service_get_bens_e_direitos_acoes(
            user_id=current_user.id,
            target_date_str=target_date_str
        )
        return bens_e_direitos_data
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        print(f"Unexpected error in get_bens_e_direitos_acoes_endpoint: {e}") # Basic logging
        # Consider more specific error handling or logging here
        raise HTTPException(status_code=500, detail="An unexpected error occurred while retrieving assets and rights information.")

# Define the response model for the new endpoint
class RendimentoIsentoResponse(schemas.BaseModel): # Use schemas.BaseModel if that's your base Pydantic model
    ticker: str
    empresa: Optional[str] = None
    cnpj: Optional[str] = None
    valor_total_recebido_no_ano: float

@router.get("/rendimentos-isentos", response_model=List[RendimentoIsentoResponse])
async def get_rendimentos_isentos_endpoint(
    year: int = Query(..., description="O ano para o qual buscar os rendimentos isentos (e.g., 2023)."),
    current_user: UsuarioResponse = Depends(get_current_user)
):
    """
    Busca os rendimentos isentos e não tributáveis (Dividendos e Rendimentos)
    recebidos pelo usuário em um determinado ano.
    """
    try:
        if year < 1900 or year > datetime.now().year + 5: # Basic year validation
            raise ValueError("Ano fora de um intervalo razoável.")

        # Import and call the service function
        from app.services.portfolio_analysis_service import get_rendimentos_isentos_por_ano

        rendimentos_data = get_rendimentos_isentos_por_ano(
            user_id=current_user.id,
            year=year
        )
        return rendimentos_data
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        # Log the exception e for server-side debugging
        print(f"Unexpected error in get_rendimentos_isentos_endpoint: {e}") # Basic logging
        raise HTTPException(status_code=500, detail="Erro inesperado ao buscar rendimentos isentos.")

# --- Novo endpoint: Lucros Isentos Mensais (vendas até 20 mil) ---
from models import ResultadoMensal

class LucroIsentoMensalResponse(schemas.BaseModel):
    mes: str  # YYYY-MM
    ganho_liquido_swing: float
    isento_swing: bool

@router.get("/lucros-isentos", response_model=List[LucroIsentoMensalResponse])
async def get_lucros_isentos_mensais(
    year: int = Query(..., description="Ano base para buscar lucros isentos mensais (vendas até 20 mil)."),
    current_user: UsuarioResponse = Depends(get_current_user)
):
    """
    Retorna os lucros isentos mensais (vendas até 20 mil) do usuário autenticado para o ano selecionado.
    """
    if year < 1900 or year > datetime.now().year + 5:
        raise HTTPException(status_code=400, detail="Ano fora de um intervalo razoável.")
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            query = '''
                SELECT mes, ganho_liquido_swing, isento_swing
                FROM resultados_mensais
                WHERE usuario_id = ?
                  AND isento_swing = 1
                  AND mes LIKE ?
                ORDER BY mes
            '''
            cursor.execute(query, (current_user.id, f'{year}-%'))
            rows = cursor.fetchall()
            result = [
                {
                    "mes": row["mes"],
                    "ganho_liquido_swing": row["ganho_liquido_swing"],
                    "isento_swing": bool(row["isento_swing"]),
                }
                for row in rows
            ]
        return result
    except Exception as e:
        print(f"Erro ao buscar lucros isentos mensais: {e}")
        raise HTTPException(status_code=500, detail="Erro inesperado ao buscar lucros isentos mensais.")
