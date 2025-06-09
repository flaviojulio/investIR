from fastapi import FastAPI, UploadFile, File, HTTPException, Path, Body, Depends, status
from fastapi.middleware.cors import CORSMiddleware
import json
from typing import List, Dict, Any
import uvicorn
import logging # Added logging import

from auth import TokenExpiredError, InvalidTokenError, TokenNotFoundError, TokenRevokedError

import models # Import the entire models module to use models.UsuarioProventoRecebidoDB
from models import (
    OperacaoCreate, Operacao, ResultadoMensal, CarteiraAtual, 
    DARF, AtualizacaoCarteira, OperacaoFechada, ResultadoTicker, AcaoInfo, # Changed StockInfo to AcaoInfo
    ProventoCreate, ProventoInfo, EventoCorporativoCreate, EventoCorporativoInfo, # Added EventoCorporativo models
    ResumoProventoAnual, ResumoProventoMensal, ResumoProventoPorAcao, # ProventoRecebidoUsuario removed as it's no longer the response_model here
    UsuarioProventoRecebidoDB, # Explicitly import UsuarioProventoRecebidoDB
    # Modelos de autenticação
    UsuarioCreate, UsuarioUpdate, UsuarioResponse, LoginResponse, FuncaoCreate, FuncaoUpdate, FuncaoResponse, TokenResponse,
    BaseModel # Ensure BaseModel is available for DARFStatusUpdate
)

# Pydantic model for DARF status update
class DARFStatusUpdate(BaseModel):
    status: str

from database import (
    criar_tabelas, 
    limpar_banco_dados, 
    # get_db, remover_operacao, obter_todas_operacoes removed
)

import services # Keep this for other service functions
from services import (
    calcular_operacoes_fechadas,
    processar_operacoes,
    calcular_resultados_mensais,
    calcular_carteira_atual,
    gerar_darfs,
    inserir_operacao_manual,
    atualizar_item_carteira,
    # recalcular_carteira, recalcular_resultados are internal to services now for delete
    # Add new service imports
    listar_operacoes_service,
    deletar_operacao_service,
    obter_operacao_service, # Added for returning created operacao
    gerar_resumo_operacoes_fechadas, # Added for summary
    deletar_todas_operacoes_service, # Added for bulk delete
    atualizar_status_darf_service, # Added for DARF status update
    remover_item_carteira_service, # Added for deleting single portfolio item
    listar_operacoes_por_ticker_service, # Added for fetching operations by ticker
    calcular_resultados_por_ticker_service, # Added for ticker results
    # Provento services
    registrar_provento_service,
    listar_proventos_por_acao_service,
    listar_todos_proventos_service,
    listar_proventos_recebidos_pelo_usuario_service, # Service para proventos detalhados do usuário
    gerar_resumo_proventos_anuais_usuario_service, # Service para resumo anual de proventos
    gerar_resumo_proventos_mensais_usuario_service, # Service para resumo mensal de proventos
    gerar_resumo_proventos_por_acao_usuario_service, # Service para resumo por ação de proventos
    recalcular_proventos_recebidos_para_usuario_service, # Novo serviço de recálculo
    # EventoCorporativo services
    registrar_evento_corporativo_service,
    listar_eventos_corporativos_por_acao_service,
    listar_todos_eventos_corporativos_service
)

from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
import auth # Keep this for other auth functions
# auth.get_db removed from here

# Import the new router
from routers import analysis_router
from dependencies import get_current_user, oauth2_scheme # Import from dependencies

# Inicialização do banco de dados
criar_tabelas() # Creates non-auth tables
auth.inicializar_autenticacao() # Initializes authentication system (creates auth tables, modifies others, adds admin)

app = FastAPI(
    title="API de Acompanhamento de Carteiras de Ações e IR",
    description="API para upload de operações de ações e cálculo de imposto de renda",
    version="1.0.0"
)

# Configuração de CORS para permitir requisições de origens diferentes
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include the analysis router
app.include_router(analysis_router.router, prefix="/api") # Assuming all API routes are prefixed with /api

# Endpoint para listar todas as ações (acoes)
@app.get("/api/acoes", response_model=List[AcaoInfo], tags=["Ações"]) # Renamed path, response_model, tags
async def listar_acoes(): # Renamed function
    """
    Lista todas as ações cadastradas no sistema.
    Este endpoint é público e não requer autenticação.
    """
    try:
        acoes = services.listar_todas_acoes_service() # Renamed service call
        return acoes
    except Exception as e:
        # Log a exceção 'e' aqui para depuração
        logging.error(f"Error in /api/acoes: {e}", exc_info=True) # Updated log message
        raise HTTPException(status_code=500, detail=f"Erro interno ao listar ações: {str(e)}")

# Endpoints de Proventos

@app.post("/api/acoes/{id_acao}/proventos", response_model=ProventoInfo, status_code=status.HTTP_201_CREATED, tags=["Proventos"])
async def registrar_provento_para_acao(
    id_acao: int = Path(..., description="ID da ação à qual o provento pertence"),
    provento_in: ProventoCreate = Body(...),
    usuario: UsuarioResponse = Depends(get_current_user) # Ensure user is logged in
):
    """
    Registra um novo provento para uma ação específica.
    """
    try:
        # usuario.id is available if needed by the service for ownership, though not used in current provento logic
        return services.registrar_provento_service(id_acao_url=id_acao, provento_in=provento_in)
    except HTTPException as e:
        raise e # Re-raise HTTPExceptions directly from the service
    except Exception as e:
        logging.error(f"Error in POST /api/acoes/{id_acao}/proventos: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro interno ao registrar provento: {str(e)}")

@app.get("/api/acoes/{id_acao}/proventos", response_model=List[ProventoInfo], tags=["Proventos"])
async def listar_proventos_da_acao(
    id_acao: int = Path(..., description="ID da ação para listar os proventos"),
    usuario: UsuarioResponse = Depends(get_current_user) # Ensure user is logged in for consistency, though not strictly used by service for filtering
):
    """
    Lista todos os proventos registrados para uma ação específica.
    """
    try:
        return services.listar_proventos_por_acao_service(id_acao=id_acao)
    except HTTPException as e:
        raise e
    except Exception as e:
        logging.error(f"Error in GET /api/acoes/{id_acao}/proventos: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro interno ao listar proventos da ação: {str(e)}")

@app.get("/api/proventos/", response_model=List[ProventoInfo], tags=["Proventos"])
async def listar_todos_os_proventos():
    """
    Lista todos os proventos de todas as ações cadastradas no sistema.
    Este endpoint é público.
    """
    try:
        return services.listar_todos_proventos_service()
    except Exception as e:
        logging.error(f"Error in GET /api/proventos: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro interno ao listar todos os proventos: {str(e)}")


# Endpoints de Eventos Corporativos

@app.post("/api/acoes/{id_acao}/eventos_corporativos", response_model=EventoCorporativoInfo, status_code=status.HTTP_201_CREATED, tags=["Eventos Corporativos"])
async def registrar_evento_para_acao(
    id_acao: int = Path(..., description="ID da ação à qual o evento pertence"),
    evento_in: EventoCorporativoCreate = Body(...),
    usuario: UsuarioResponse = Depends(get_current_user)
):
    """
    Registra um novo evento corporativo para uma ação específica.
    """
    try:
        return services.registrar_evento_corporativo_service(id_acao_url=id_acao, evento_in=evento_in)
    except HTTPException as e:
        raise e
    except Exception as e:
        logging.error(f"Error in POST /api/acoes/{id_acao}/eventos_corporativos: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro interno ao registrar evento corporativo: {str(e)}")

@app.get("/api/acoes/{id_acao}/eventos_corporativos", response_model=List[EventoCorporativoInfo], tags=["Eventos Corporativos"])
async def listar_eventos_da_acao_corporativos(
    id_acao: int = Path(..., description="ID da ação para listar os eventos corporativos"),
    usuario: UsuarioResponse = Depends(get_current_user)
):
    """
    Lista todos os eventos corporativos registrados para uma ação específica.
    """
    try:
        return services.listar_eventos_corporativos_por_acao_service(id_acao=id_acao)
    except HTTPException as e:
        raise e
    except Exception as e:
        logging.error(f"Error in GET /api/acoes/{id_acao}/eventos_corporativos: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro interno ao listar eventos corporativos da ação: {str(e)}")

@app.get("/api/eventos_corporativos/", response_model=List[EventoCorporativoInfo], tags=["Eventos Corporativos"])
async def listar_todos_os_eventos_corporativos_api( # Renamed to avoid conflict with service function
    usuario: UsuarioResponse = Depends(get_current_user)
):
    """
    Lista todos os eventos corporativos de todas as ações cadastradas no sistema.
    """
    try:
        return services.listar_todos_eventos_corporativos_service()
    except Exception as e:
        logging.error(f"Error in GET /api/eventos_corporativos: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro interno ao listar todos os eventos corporativos: {str(e)}")

# Endpoints de Proventos do Usuário

@app.get("/api/usuario/proventos/", response_model=List[models.UsuarioProventoRecebidoDB], tags=["Proventos Usuário"])
async def listar_proventos_usuario_detalhado(
    usuario: UsuarioResponse = Depends(get_current_user)
):
    """
    Lista todos os proventos que o usuário logado teria recebido,
    detalhando a quantidade de ações na data ex e o valor total.
    """
    try:
        # O serviço já retorna List[Dict[str, Any]], que o Pydantic validará contra ProventoRecebidoUsuario.
        # Se ProventoRecebidoUsuario tiver Config.from_attributes = True e o serviço retornasse objetos ORM,
        # a conversão seria automática. Como o serviço já constrói os dicionários, está ok.
        proventos_data = services.listar_proventos_recebidos_pelo_usuario_service(usuario_id=usuario.id)
        # Para garantir a validação e conversão correta para o response_model:
        return proventos_data
    except Exception as e:
        logging.error(f"Error in GET /api/usuario/proventos/ for user {usuario.id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro interno ao listar proventos do usuário: {str(e)}")

@app.get("/api/usuario/proventos/resumo_anual/", response_model=List[ResumoProventoAnual], tags=["Proventos Usuário"])
async def obter_resumo_proventos_anuais_usuario(
    usuario: UsuarioResponse = Depends(get_current_user)
):
    """
    Gera um resumo anual dos proventos recebidos pelo usuário logado.
    """
    try:
        return services.gerar_resumo_proventos_anuais_usuario_service(usuario_id=usuario.id)
    except Exception as e:
        logging.error(f"Error in GET /api/usuario/proventos/resumo_anual/ for user {usuario.id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro interno ao gerar resumo anual de proventos: {str(e)}")

@app.get("/api/usuario/proventos/resumo_mensal/{ano}/", response_model=List[ResumoProventoMensal], tags=["Proventos Usuário"])
async def obter_resumo_proventos_mensais_usuario(
    ano: int = Path(..., description="Ano para o resumo mensal", ge=2000, le=2100),
    usuario: UsuarioResponse = Depends(get_current_user)
):
    """
    Gera um resumo mensal dos proventos recebidos pelo usuário logado para um ano específico.
    """
    try:
        return services.gerar_resumo_proventos_mensais_usuario_service(usuario_id=usuario.id, ano_filtro=ano)
    except Exception as e:
        logging.error(f"Error in GET /api/usuario/proventos/resumo_mensal/{ano}/ for user {usuario.id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro interno ao gerar resumo mensal de proventos: {str(e)}")

@app.get("/api/usuario/proventos/resumo_por_acao/", response_model=List[ResumoProventoPorAcao], tags=["Proventos Usuário"])
async def obter_resumo_proventos_por_acao_usuario(
    usuario: UsuarioResponse = Depends(get_current_user)
):
    """
    Gera um resumo dos proventos recebidos pelo usuário logado, agrupados por ação.
    """
    try:
        return services.gerar_resumo_proventos_por_acao_usuario_service(usuario_id=usuario.id)
    except Exception as e:
        logging.error(f"Error in GET /api/usuario/proventos/resumo_por_acao/ for user {usuario.id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro interno ao gerar resumo de proventos por ação: {str(e)}")

@app.post("/api/usuario/proventos/recalcular", response_model=Dict[str, Any], tags=["Proventos Usuário"])
async def recalcular_proventos_usuario_endpoint(
    usuario: UsuarioResponse = Depends(get_current_user)
):
    """
    Dispara o recálculo de todos os proventos recebidos para o usuário logado.
    Esta operação limpará os registros existentes e os recriará com base nos proventos globais e no histórico de operações do usuário.
    """
    try:
        resultado_recalculo = services.recalcular_proventos_recebidos_para_usuario_service(usuario_id=usuario.id)
        return resultado_recalculo
    except Exception as e:
        logging.error(f"Error in POST /api/usuario/proventos/recalcular for user {usuario.id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro durante o recálculo de proventos: {str(e)}")


# Configuração do OAuth2
# oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login") # MOVED to dependencies.py

# Função para obter o usuário atual
# async def get_current_user(token: str = Depends(oauth2_scheme)) -> Dict[str, Any]: # MOVED to dependencies.py
#     try:
#         payload = auth.verificar_token(token)
#     except TokenExpiredError:
#         raise HTTPException(
#             status_code=status.HTTP_401_UNAUTHORIZED,
#             detail={"message": "O token de autenticação expirou.", "error_code": "TOKEN_EXPIRED"},
#             headers={"WWW-Authenticate": "Bearer"},
#         )
#     except InvalidTokenError as e: # Use 'as e' to include original error message
#         raise HTTPException(
#             status_code=status.HTTP_401_UNAUTHORIZED,
#             detail={"message": f"O token de autenticação é inválido ou malformado: {str(e)}", "error_code": "TOKEN_INVALID"},
#             headers={"WWW-Authenticate": "Bearer"},
#         )
#     except TokenNotFoundError:
#         raise HTTPException(
#             status_code=status.HTTP_401_UNAUTHORIZED,
#             detail={"message": "O token de autenticação não foi reconhecido.", "error_code": "TOKEN_NOT_FOUND"},
#             headers={"WWW-Authenticate": "Bearer"},
#         )
#     except TokenRevokedError:
#         raise HTTPException(
#             status_code=status.HTTP_401_UNAUTHORIZED,
#             detail={"message": "O token de autenticação foi revogado (ex: logout ou alteração de senha).", "error_code": "TOKEN_REVOKED"},
#             headers={"WWW-Authenticate": "Bearer"},
#         )
#     except Exception as e: # Capture and potentially log the original exception
#         # Log the exception e for debugging (e.g., import logging; logging.exception("Unexpected error"))
#         raise HTTPException(
#             status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
#             detail={"message": f"Erro inesperado durante a verificação do token: {str(e)}", "error_code": "UNEXPECTED_TOKEN_VERIFICATION_ERROR"},
#         )

#     sub_str = payload.get("sub")
#     if not sub_str:
#         raise HTTPException(
#             status_code=status.HTTP_401_UNAUTHORIZED,
#             detail={"message": "Token inválido: ID de usuário (sub) ausente no payload.", "error_code": "TOKEN_PAYLOAD_MISSING_SUB"},
#             headers={"WWW-Authenticate": "Bearer"},
#         )
#     try:
#         usuario_id = int(sub_str) # Converte para int
#     except ValueError:
#         raise HTTPException(
#             status_code=status.HTTP_401_UNAUTHORIZED,
#             detail={"message": "Token inválido: ID de usuário (sub) não é um inteiro válido.", "error_code": "TOKEN_PAYLOAD_INVALID_SUB_FORMAT"},
#             headers={"WWW-Authenticate": "Bearer"},
#         )

#     # Agora usuario_id é um int e pode ser usado para chamar auth.obter_usuario
#     usuario_data = auth.obter_usuario(usuario_id)
#     if not usuario_data:
#         raise HTTPException(
#             status_code=status.HTTP_401_UNAUTHORIZED, # Ou status.HTTP_404_NOT_FOUND
#             detail={"message": "Usuário associado ao token não encontrado.", "error_code": "USER_FOR_TOKEN_NOT_FOUND"},
#             headers={"WWW-Authenticate": "Bearer"},
#         )
    
#     return usuario_data

# Função para verificar se o usuário é administrador
# Note: The type hint for `usuario` should ideally be UsuarioResponse after this change.
# However, get_current_user in dependencies.py returns UsuarioResponse.
# FastAPI handles this correctly due to Pydantic model.
async def get_admin_user(usuario: UsuarioResponse = Depends(get_current_user)) -> UsuarioResponse:
    # Access 'funcoes' as an attribute of the Pydantic model
    if "admin" not in usuario.funcoes:
        raise HTTPException(
            status_code=403,
            detail="Acesso negado. Permissão de administrador necessária.",
        )
    return usuario

# Endpoints de autenticação
@app.post("/api/auth/registrar", response_model=UsuarioResponse)
async def registrar_usuario(usuario: UsuarioCreate):
    """
    Registra um novo usuário no sistema.
    """
    try:
        usuario_id = auth.criar_usuario(
            username=usuario.username,
            email=usuario.email,
            senha=usuario.senha,
            nome_completo=usuario.nome_completo
        )
        
        return auth.obter_usuario(usuario_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao registrar usuário: {str(e)}")


@app.post("/api/auth/login", response_model=TokenResponse)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = auth.verificar_credenciais(form_data.username, form_data.password)
    if not user:
        raise HTTPException(status_code=401, detail="Usuário ou senha incorretos")
    token = auth.gerar_token(user["id"])
    return {"access_token": token, "token_type": "bearer"}

# Commented out /api/auth/me endpoint removed.

@app.post("/api/auth/logout")
async def logout(token: str = Depends(oauth2_scheme)):
    """
    Encerra a sessão do usuário revogando o token.
    """
    success = auth.revogar_token(token)
    
    if not success:
        raise HTTPException(status_code=400, detail="Erro ao encerrar sessão")
    
    return {"mensagem": "Sessão encerrada com sucesso"}

@app.get("/api/auth/me", response_model=UsuarioResponse)
async def get_me(usuario: UsuarioResponse = Depends(get_current_user)): # Changed type hint
    """
    Retorna os dados do usuário autenticado.
    """
    return usuario

# Endpoints de administração de usuários (apenas para administradores)
@app.get("/api/usuarios", response_model=List[UsuarioResponse])
async def listar_usuarios(admin: UsuarioResponse = Depends(get_admin_user)): # Changed type hint
    """
    Lista todos os usuários do sistema.
    Requer permissão de administrador.
    """
    return auth.obter_todos_usuarios()

@app.get("/api/usuarios/{usuario_id}", response_model=UsuarioResponse)
async def obter_usuario_por_id(
    usuario_id: int = Path(..., description="ID do usuário"),
    admin: UsuarioResponse = Depends(get_admin_user) # Changed type hint
):
    """
    Obtém os dados de um usuário pelo ID.
    Requer permissão de administrador.
    """
    usuario = auth.obter_usuario(usuario_id)
    
    if not usuario:
        raise HTTPException(status_code=404, detail=f"Usuário {usuario_id} não encontrado")
    
    return usuario

@app.put("/api/usuarios/{usuario_id}", response_model=UsuarioResponse)
async def atualizar_usuario_por_id(
    usuario_data: UsuarioUpdate,
    usuario_id: int = Path(..., description="ID do usuário"),
    admin: UsuarioResponse = Depends(get_admin_user) # Changed type hint
):
    """
    Atualiza os dados de um usuário.
    Requer permissão de administrador.
    """
    try:
        success = auth.atualizar_usuario(usuario_id, usuario_data.model_dump(exclude_unset=True))
        
        if not success:
            raise HTTPException(status_code=404, detail=f"Usuário {usuario_id} não encontrado")
        
        return auth.obter_usuario(usuario_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao atualizar usuário: {str(e)}")

@app.delete("/api/usuarios/{usuario_id}")
async def excluir_usuario(
    usuario_id: int = Path(..., description="ID do usuário"),
    admin: UsuarioResponse = Depends(get_admin_user) # Changed type hint
):
    """
    Exclui um usuário do sistema.
    Requer permissão de administrador.
    """
    success = auth.excluir_usuario(usuario_id)
    
    if not success:
        raise HTTPException(status_code=404, detail=f"Usuário {usuario_id} não encontrado")
    
    return {"mensagem": f"Usuário {usuario_id} excluído com sucesso"}

@app.post("/api/usuarios/{usuario_id}/funcoes/{funcao_nome}")
async def adicionar_funcao_a_usuario(
    usuario_id: int = Path(..., description="ID do usuário"),
    funcao_nome: str = Path(..., description="Nome da função"),
    admin: UsuarioResponse = Depends(get_admin_user) # Changed type hint
):
    """
    Adiciona uma função a um usuário.
    Requer permissão de administrador.
    """
    success = auth.adicionar_funcao_usuario(usuario_id, funcao_nome)
    
    if not success:
        raise HTTPException(status_code=404, detail="Usuário ou função não encontrados")
    
    updated_usuario = auth.obter_usuario(usuario_id)
    if not updated_usuario:
        # Should not happen if adicionar_funcao_usuario was successful and usuario_id is valid
        raise HTTPException(status_code=404, detail=f"Usuário {usuario_id} não encontrado após adicionar função.")
    return updated_usuario

@app.delete("/api/usuarios/{usuario_id}/funcoes/{funcao_nome}", response_model=UsuarioResponse)
async def remover_funcao_de_usuario(
    usuario_id: int = Path(..., description="ID do usuário"),
    funcao_nome: str = Path(..., description="Nome da função"),
    admin: UsuarioResponse = Depends(get_admin_user) # Changed type hint
):
    """
    Remove uma função de um usuário.
    Requer permissão de administrador.
    """
    success = auth.remover_funcao_usuario(usuario_id, funcao_nome)
    
    if not success:
        # This could mean user not found, function not found, or user didn't have the function.
        # For simplicity, we'll check if the user exists to give a more specific 404 for the user.
        usuario = auth.obter_usuario(usuario_id)
        if not usuario:
            raise HTTPException(status_code=404, detail=f"Usuário {usuario_id} não encontrado.")
        # If user exists, the issue was with the function or its assignment.
        raise HTTPException(status_code=404, detail=f"Função '{funcao_nome}' não encontrada ou não associada ao usuário {usuario_id}.")

    updated_usuario = auth.obter_usuario(usuario_id)
    if not updated_usuario:
        # Should not happen if remover_funcao_usuario was successful and usuario_id is valid
        raise HTTPException(status_code=404, detail=f"Usuário {usuario_id} não encontrado após remover função.")
    return updated_usuario

# Endpoints para gerenciar funções
@app.get("/api/funcoes", response_model=List[FuncaoResponse])
async def listar_funcoes(admin: UsuarioResponse = Depends(get_admin_user)): # Changed type hint
    """
    Lista todas as funções do sistema.
    Requer permissão de administrador.
    """
    return auth.obter_todas_funcoes()

@app.post("/api/funcoes", response_model=FuncaoResponse)
async def criar_nova_funcao(
    funcao: FuncaoCreate,
    admin: UsuarioResponse = Depends(get_admin_user) # Changed type hint
):
    """
    Cria uma nova função no sistema.
    Requer permissão de administrador.
    """
    try:
        funcao_id = auth.criar_funcao(funcao.nome, funcao.descricao)
        
        # Obtém a função criada usando o novo serviço
        funcao_criada = auth.obter_funcao(funcao_id)
        if not funcao_criada:
            # This case should ideally not happen if criar_funcao succeeded
            raise HTTPException(status_code=500, detail="Erro ao obter função recém-criada.")
        return funcao_criada
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao criar função: {str(e)}")

@app.put("/api/funcoes/{funcao_id}", response_model=FuncaoResponse)
async def atualizar_funcao_existente(
    funcao_id: int = Path(..., description="ID da função a ser atualizada"),
    funcao_data: FuncaoUpdate = Body(...),
    admin: UsuarioResponse = Depends(get_admin_user) # Changed type hint
):
    """
    Atualiza uma função existente no sistema.
    Requer permissão de administrador.
    """
    try:
        # Verificar se pelo menos um campo foi enviado para atualização
        if funcao_data.model_dump(exclude_unset=True) == {}:
            raise HTTPException(status_code=400, detail="Pelo menos um campo (nome ou descrição) deve ser fornecido para atualização.")

        success = auth.atualizar_funcao(
            funcao_id,
            nome=funcao_data.nome,
            descricao=funcao_data.descricao
        )
        if not success:
            # Se atualizar_funcao retorna False, pode ser "não encontrado" ou outro motivo não coberto por ValueError
            # Verificar se a função realmente não existe mais pode ser redundante se auth.atualizar_funcao já lida com isso
            updated_funcao = auth.obter_funcao(funcao_id)
            if not updated_funcao:
                 raise HTTPException(status_code=404, detail=f"Função com ID {funcao_id} não encontrada.")
            # Se chegou aqui, a atualização falhou por um motivo não de "não encontrado" que não levantou ValueError
            # Isso pode indicar um problema lógico em auth.atualizar_funcao se não houver conflito de nome
            # Para agora, vamos assumir que o nome pode ser o problema se não for ValueError
            raise HTTPException(status_code=409, detail=f"Não foi possível atualizar a função com ID {funcao_id}. Verifique se o novo nome já está em uso.")


        updated_funcao = auth.obter_funcao(funcao_id)
        if not updated_funcao:
            # Este caso é improvável se success=True, mas é uma salvaguarda
            raise HTTPException(status_code=404, detail=f"Função com ID {funcao_id} não encontrada após a atualização.")
        
        return updated_funcao
    except ValueError as e: # Captura conflitos de nome ou nome vazio de auth.atualizar_funcao
        raise HTTPException(status_code=400, detail=str(e)) # Reutiliza 400 para conflito de nome/validação
    except HTTPException as e: # Re-raise HTTPExceptions para não mascará-las com 500
        raise e
    except Exception as e:
        # Log a exceção 'e' aqui para depuração
        raise HTTPException(status_code=500, detail=f"Erro interno ao atualizar função: {str(e)}")

@app.delete("/api/funcoes/{funcao_id}", response_model=Dict[str, str])
async def deletar_funcao_existente(
    funcao_id: int = Path(..., description="ID da função a ser excluída"),
    admin: UsuarioResponse = Depends(get_admin_user) # Changed type hint
):
    """
    Exclui uma função existente do sistema.
    A função não pode ser excluída se estiver atualmente em uso por algum usuário.
    Requer permissão de administrador.
    """
    try:
        success = auth.excluir_funcao(funcao_id)
        if not success:
            # Isso cobre o caso onde obter_funcao(funcao_id) em excluir_funcao retorna None
            raise HTTPException(status_code=404, detail=f"Função com ID {funcao_id} não encontrada.")
        
        return {"mensagem": f"Função {funcao_id} excluída com sucesso"}
    except ValueError as e: # Captura o erro de função em uso
        raise HTTPException(status_code=409, detail=str(e)) # 409 Conflict
    except HTTPException as e: # Re-raise outras HTTPExceptions
        raise e
    except Exception as e:
        # Log a exceção 'e' aqui para depuração
        raise HTTPException(status_code=500, detail=f"Erro interno ao excluir função: {str(e)}")

# Endpoints de operações com autenticação
@app.get("/api/operacoes", response_model=List[Operacao])
async def listar_operacoes(usuario: UsuarioResponse = Depends(get_current_user)):
    try:
        operacoes = listar_operacoes_service(usuario_id=usuario.id)
        return operacoes
    except Exception as e:
        user_id_for_log = usuario.id if usuario else "Unknown"
        logging.error(f"Error in /api/operacoes for user {user_id_for_log}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error in /api/operacoes. Check logs.")

@app.get("/api/operacoes/ticker/{ticker}", response_model=List[Operacao])
async def listar_operacoes_por_ticker(
    ticker: str = Path(..., description="Ticker da ação"),
    usuario: UsuarioResponse = Depends(get_current_user) # Changed type hint
):
    """
    Lista todas as operações de um usuário para um ticker específico.
    """
    try:
        operacoes = services.listar_operacoes_por_ticker_service(usuario_id=usuario.id, ticker=ticker) # Use .id
        return operacoes
    except Exception as e:
        user_id_for_log = usuario.id if usuario else "Unknown" # Use .id
        logging.error(f"Error in /api/operacoes/ticker/{ticker} for user {user_id_for_log}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error in /api/operacoes/ticker. Check logs.")

@app.post("/api/upload", response_model=Dict[str, str])
async def upload_operacoes(
    file: UploadFile = File(...),
    usuario: UsuarioResponse = Depends(get_current_user) # Changed type hint
):
    """
    Endpoint para upload de arquivo JSON com operações de compra e venda de ações.
    
    O arquivo deve seguir o formato:
    [
      {
        "date": "YYYY-MM-DD",
        "ticker": "PETR4",
        "operation": "buy"|"sell",
        "quantity": 100,
        "price": 28.50,
        "fees": 5.20
      },
      …
    ]
    """
    try:
        # Lê o conteúdo do arquivo
        conteudo = await file.read()
        
        # Converte o JSON para uma lista de dicionários
        operacoes_json = json.loads(conteudo)
        
        # Valida e processa as operações
        operacoes = [OperacaoCreate(**op) for op in operacoes_json]
        
        # Salva as operações no banco de dados com o ID do usuário
        try:
            processar_operacoes(operacoes, usuario_id=usuario.id) # Use .id
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        
        return {"mensagem": f"Arquivo processado com sucesso. {len(operacoes)} operações importadas."}
    
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Formato de arquivo JSON inválido")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao processar arquivo: {str(e)}")

@app.get("/api/resultados", response_model=List[ResultadoMensal])
async def obter_resultados(usuario: UsuarioResponse = Depends(get_current_user)):
    """
    Retorna os resultados mensais de apuração de imposto de renda.
    """
    try:
        resultados = calcular_resultados_mensais(usuario_id=usuario.id)
        return resultados
    except Exception as e:
        user_id_for_log = usuario.id if usuario else "Unknown"
        logging.error(f"Error in /api/resultados for user {user_id_for_log}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error in /api/resultados. Check logs.")

@app.get("/api/resultados/ticker/{ticker}", response_model=ResultadoTicker)
async def listar_resultados_por_ticker(
    ticker: str = Path(..., description="Ticker da ação"),
    usuario: UsuarioResponse = Depends(get_current_user) # Changed type hint
):
    """
    Lista resultados agregados para um ticker específico para o usuário logado.
    """
    try:
        resultados = services.calcular_resultados_por_ticker_service(usuario_id=usuario.id, ticker=ticker) # Use .id
        return resultados
    except Exception as e:
        user_id_for_log = usuario.id if usuario else "Unknown" # Use .id
        logging.error(f"Error in /api/resultados/ticker/{ticker} for user {user_id_for_log}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error in /api/resultados/ticker. Check logs.")

@app.get("/api/carteira", response_model=List[CarteiraAtual])
async def obter_carteira(usuario: UsuarioResponse = Depends(get_current_user)):
    """
    Retorna a carteira atual de ações.
    """
    try:
        carteira = calcular_carteira_atual(usuario_id=usuario.id)
        return carteira
    except Exception as e:
        user_id_for_log = usuario.id if usuario else "Unknown"
        logging.error(f"Error in /api/carteira for user {user_id_for_log}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error in /api/carteira. Check logs.")

@app.get("/api/darfs", response_model=List[DARF])
async def obter_darfs(usuario: UsuarioResponse = Depends(get_current_user)):
    """
    Retorna os DARFs gerados para pagamento de imposto de renda.
    """
    try:
        darfs = gerar_darfs(usuario_id=usuario.id) # Use .id
        return darfs
    except Exception as e:
        user_id_for_log = usuario.id if usuario else "Unknown" # Use .id
        logging.error(f"Error in /api/darfs for user {user_id_for_log}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error in /api/darfs. Check logs.")

@app.put("/api/impostos/darf_status/{year_month}/{type}", response_model=Dict[str, str])
async def atualizar_status_darf(
    year_month: str = Path(..., description="Ano e mês no formato YYYY-MM, e.g., 2023-12"),
    type: str = Path(..., description="Tipo de DARF: 'swing' ou 'daytrade'"),
    status_update: DARFStatusUpdate = Body(...),
    usuario: UsuarioResponse = Depends(get_current_user) # Changed type hint
):
    """
    Atualiza o status de um DARF específico (swing ou daytrade) para um determinado mês/ano.
    O status pode ser, por exemplo, "Pendente", "Pago", "Atrasado".
    """
    try:
        # Validação do tipo já está no endpoint Path e será tratada pelo service,
        # mas uma checagem extra aqui pode fornecer um erro mais imediato se desejado.
        # No entanto, o Path param 'type' não tem validação regex ou enum aqui.
        # A validação no service é suficiente.
        
        # Convert type to lowercase to ensure consistency before calling service
        darf_type_lower = type.lower()
        if darf_type_lower not in ["swing", "daytrade"]:
            raise HTTPException(status_code=400, detail="Tipo de DARF inválido. Use 'swing' or 'daytrade'.")

        resultado = services.atualizar_status_darf_service(
            usuario_id=usuario.id, # Use .id
            year_month=year_month,
            darf_type=darf_type_lower,
            new_status=status_update.status
        )
        
        # Analisa a mensagem para determinar o código de status HTTP apropriado
        if "não encontrado" in resultado.get("mensagem", "").lower() or \
           "não necessitou alteração" in resultado.get("mensagem", "").lower() : # Check for "no change needed"
            # Se o recurso não foi encontrado ou não precisou de alteração, pode ser um 404 ou 200/304.
            # Para "não encontrado", 404 é apropriado.
            # Para "não necessitou alteração", um 200 com a mensagem é ok, ou 304 Not Modified se aplicável.
            # A especificação pedia para levantar HTTPException se não encontrado.
             if "não encontrado" in resultado.get("mensagem", "").lower():
                raise HTTPException(status_code=404, detail=resultado["mensagem"])
        
        # Se chegou aqui e não é "não encontrado", consideramos sucesso.
        return resultado
    except ValueError as ve: # Captura ValueError do service (e.g., tipo de DARF inválido)
        raise HTTPException(status_code=400, detail=str(ve))
    except HTTPException as he: # Re-raise outras HTTPExceptions (como a 404 acima)
        raise he
    except Exception as e:
        # Log a exceção 'e' para depuração detalhada
        # import logging
        # logging.exception("Erro ao atualizar status do DARF")
        raise HTTPException(status_code=500, detail=f"Erro interno ao atualizar status do DARF: {str(e)}")

# Novos endpoints para as funcionalidades adicionais

@app.post("/api/operacoes", response_model=Operacao)
async def criar_operacao(
    operacao: OperacaoCreate,
    usuario: Dict = Depends(get_current_user)
):
    """
    Cria uma nova operação manualmente e retorna a operação criada.
    
    Args:
        operacao: Dados da operação a ser criada.
    """
    try:
        new_operacao_id = services.inserir_operacao_manual(operacao, usuario_id=usuario.id) # Use .id
        operacao_criada = services.obter_operacao_service(new_operacao_id, usuario_id=usuario.id) # Use .id
        if not operacao_criada:
            # This case should ideally not happen if insertion and ID return were successful
            raise HTTPException(status_code=500, detail="Operação criada mas não pôde ser recuperada.")
        return operacao_criada
    except ValueError as e: # Handle ticker validation error
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        # Log the exception e for detailed debugging
        raise HTTPException(status_code=500, detail=f"Erro ao criar operação: {str(e)}")

@app.put("/api/carteira/{ticker}", response_model=Dict[str, str])
async def atualizar_carteira(
    ticker: str = Path(..., description="Ticker da ação"), 
    dados: AtualizacaoCarteira = Body(...),
    usuario: Dict = Depends(get_current_user)
):
    """
    Atualiza a quantidade e o preço médio de uma ação na carteira.
    O custo total será calculado automaticamente (quantidade * preço médio).
    
    Args:
        ticker: Ticker da ação a ser atualizada.
        dados: Novos dados da ação (quantidade e preço médio).
    """
    try:
        # Verifica se o ticker no path é o mesmo do body
        if ticker.upper() != dados.ticker.upper():
            raise HTTPException(status_code=400, detail="O ticker no path deve ser o mesmo do body")
        
        atualizar_item_carteira(dados, usuario_id=usuario.id) # Use .id
        return {"mensagem": f"Ação {ticker.upper()} atualizada com sucesso."}
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao atualizar ação: {str(e)}")

@app.delete("/api/carteira/{ticker}", response_model=Dict[str, str])
async def deletar_item_carteira(
    ticker: str = Path(..., description="Ticker da ação a ser removida da carteira"),
    usuario: Dict[str, Any] = Depends(get_current_user)
):
    """
    Remove um item específico (ticker) da carteira atual do usuário.
    Esta é uma ação de override manual e não aciona recálculos automáticos da carteira.
    """
    try:
        success = services.remover_item_carteira_service(usuario_id=usuario.id, ticker=ticker.upper()) # Use .id
        if success:
            return {"mensagem": f"Ação {ticker.upper()} removida da carteira com sucesso."}
        else:
            raise HTTPException(status_code=404, detail=f"Ação {ticker.upper()} não encontrada na carteira do usuário.")
    except HTTPException as he:
        raise he
    except Exception as e:
        # Log the exception e for detailed debugging
        raise HTTPException(status_code=500, detail=f"Erro ao remover ação da carteira: {str(e)}")

@app.get("/api/operacoes/fechadas", response_model=List[OperacaoFechada])
async def obter_operacoes_fechadas(usuario: UsuarioResponse = Depends(get_current_user)):
    """
    Retorna as operações fechadas (compra seguida de venda ou vice-versa).
    Inclui detalhes como data de abertura e fechamento, preços, quantidade e resultado.
    """
    try:
        operacoes_fechadas = calcular_operacoes_fechadas(usuario_id=usuario.id)
        return operacoes_fechadas
    except Exception as e:
        user_id_for_log = usuario.id if usuario else "Unknown"
        logging.error(f"Error in /api/operacoes/fechadas for user {user_id_for_log}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error in /api/operacoes/fechadas. Check logs.")

@app.get("/api/operacoes/fechadas/resumo", response_model=Dict[str, Any])
async def obter_resumo_operacoes_fechadas(usuario: UsuarioResponse = Depends(get_current_user)):
    """
    Retorna um resumo das operações fechadas, incluindo:
    - Total de operações fechadas
    - Lucro/prejuízo total
    - Lucro/prejuízo de operações day trade
    - Lucro/prejuízo de operações swing trade
    - Operações mais lucrativas
    - Operações com maior prejuízo
    """
    try:
        resumo = services.gerar_resumo_operacoes_fechadas(usuario_id=usuario.id) # Use .id
        return resumo
    except Exception as e:
        user_id_for_log = usuario.id if usuario else "Unknown" # Use .id
        logging.error(f"Error in /api/operacoes/fechadas/resumo for user {user_id_for_log}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error in /api/operacoes/fechadas/resumo. Check logs.")
    
@app.delete("/api/admin/reset-financial-data", response_model=Dict[str, str])
async def resetar_banco(admin: Dict = Depends(get_admin_user)):
    """
    Remove todos os dados financeiros e operacionais do banco de dados.
    Requer permissão de administrador.
    Preserva dados de usuários e autenticação.
    """
    try:
        limpar_banco_dados()
        return {"mensagem": "Dados financeiros e operacionais foram removidos com sucesso."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao limpar banco de dados: {str(e)}")

@app.delete("/api/operacoes/{operacao_id}", response_model=Dict[str, str])
async def deletar_operacao(
    operacao_id: int = Path(..., description="ID da operação"),
    usuario: Dict = Depends(get_current_user)
):
    """
    Remove uma operação pelo ID.
    
    Args:
        operacao_id: ID da operação a ser removida.
    """
    try:
        # Use the new service function
        success = deletar_operacao_service(operacao_id=operacao_id, usuario_id=usuario.id) # Use .id
        if success:
            return {"mensagem": f"Operação {operacao_id} removida com sucesso."}
        else:
            # This case might be hit if remover_operacao returned False but didn't raise an error
            # that deletar_operacao_service would propagate.
            # database.remover_operacao returns bool, so service translates this.
            # If service returns False, it means op not found for that user.
            raise HTTPException(status_code=404, detail=f"Operação {operacao_id} não encontrada ou não pertence ao usuário.")
    except HTTPException as e:
        raise e # Re-raise HTTPExceptions directly
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao remover operação: {str(e)}")

@app.delete("/api/bulk-ops/operacoes/delete-all", response_model=Dict[str, Any]) # Changed path to new prefix
async def deletar_todas_operacoes(
    usuario: Dict[str, Any] = Depends(get_current_user)
):
    """
    Remove TODAS as operações do usuário logado.
    Use com cuidado, esta ação é irreversível.
    """
    try:
        resultado = services.deletar_todas_operacoes_service(usuario_id=usuario.id) # Use .id
        return resultado
    except Exception as e:
        user_id_for_log = usuario.id if usuario else "Unknown" # Use .id
        logging.error(f"Error in /api/bulk-ops/operacoes/delete-all for user {user_id_for_log}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro ao deletar todas as operações: {str(e)}")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)