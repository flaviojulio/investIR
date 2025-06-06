from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from typing import Dict, Any # Any is used, Dict might not be needed directly here but good for context

# Assuming auth.py is in the same directory (backend)
# and models.py is also in the same directory (backend)
import auth
from models import UsuarioResponse # This is the Pydantic model for user response
from auth import TokenExpiredError, InvalidTokenError, TokenNotFoundError, TokenRevokedError

# Moved from main.py
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login") # tokenUrl should match an endpoint in your app

async def get_current_user(token: str = Depends(oauth2_scheme)) -> UsuarioResponse:
    """
    Decodes the token, gets the user ID, fetches the user from the database,
    and returns the user data as a UsuarioResponse Pydantic model.
    Raises HTTPException for various error conditions.
    """
    try:
        payload = auth.verificar_token(token)
    except TokenExpiredError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"message": "O token de autenticação expirou.", "error_code": "TOKEN_EXPIRED"},
            headers={"WWW-Authenticate": "Bearer"},
        )
    except InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"message": f"O token de autenticação é inválido ou malformado: {str(e)}", "error_code": "TOKEN_INVALID"},
            headers={"WWW-Authenticate": "Bearer"},
        )
    except TokenNotFoundError: # This specific exception might not be raised by your auth.verificar_token
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"message": "O token de autenticação não foi reconhecido.", "error_code": "TOKEN_NOT_FOUND"},
            headers={"WWW-Authenticate": "Bearer"},
        )
    except TokenRevokedError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"message": "O token de autenticação foi revogado (ex: logout ou alteração de senha).", "error_code": "TOKEN_REVOKED"},
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e: # Catch any other unexpected errors during token verification
        # It's good practice to log the actual error e here
        print(f"Unexpected error during token verification: {e}") # Basic logging
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"message": f"Erro inesperado durante a verificação do token.", "error_code": "UNEXPECTED_TOKEN_VERIFICATION_ERROR"},
            # Avoid exposing internal error details like str(e) directly to the client in production for security.
        )

    sub_str = payload.get("sub")
    if not sub_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"message": "Token inválido: ID de usuário (sub) ausente no payload.", "error_code": "TOKEN_PAYLOAD_MISSING_SUB"},
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        usuario_id = int(sub_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"message": "Token inválido: ID de usuário (sub) não é um inteiro válido.", "error_code": "TOKEN_PAYLOAD_INVALID_SUB_FORMAT"},
            headers={"WWW-Authenticate": "Bearer"},
        )

    usuario_dict = auth.obter_usuario(usuario_id) # This returns a Dict from auth.py
    if not usuario_dict:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, # Or status.HTTP_404_NOT_FOUND if preferred for "user not found"
            detail={"message": "Usuário associado ao token não encontrado.", "error_code": "USER_FOR_TOKEN_NOT_FOUND"},
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Convert the dictionary to the Pydantic model UsuarioResponse
    # This ensures the response shape is consistent and validated.
    try:
        return UsuarioResponse(**usuario_dict)
    except Exception as e: # Catch potential Pydantic validation errors or other issues
        print(f"Error converting user dict to UsuarioResponse: {e}") # Basic logging
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"message": "Erro ao processar dados do usuário.", "error_code": "USER_DATA_PROCESSING_ERROR"},
        )

# Example of another dependency if needed, e.g., for admin rights:
# async def get_admin_user(current_user: UsuarioResponse = Depends(get_current_user)) -> UsuarioResponse:
#     if "admin" not in current_user.funcoes: # Assuming funcoes is a list of roles on UsuarioResponse
#         raise HTTPException(
#             status_code=status.HTTP_403_FORBIDDEN,
#             detail="Acesso negado. Permissão de administrador necessária.",
#         )
#     return current_user
