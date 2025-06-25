from fastapi import APIRouter, Depends
from typing import List
from dependencies import get_current_user
from database import get_db

router = APIRouter()

@router.get("/users/me")
async def read_users_me():
    return {"username": "fakecurrentuser"}

@router.get("/usuario/anos-operacao", response_model=List[int])
def listar_anos_operacao(usuario=Depends(get_current_user), db=Depends(get_db)):
    with db as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT DISTINCT strftime('%Y', date) as ano
            FROM operacoes
            WHERE usuario_id = ?
            ORDER BY ano DESC
            """,
            (usuario.id,)
        )
        anos = [int(row[0]) for row in cursor.fetchall() if row[0] is not None]
    return anos
