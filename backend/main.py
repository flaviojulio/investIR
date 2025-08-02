from fastapi import FastAPI, UploadFile, File, HTTPException, Path, Body, Depends, status
from fastapi.middleware.cors import CORSMiddleware
import json
from decimal import Decimal
from typing import List, Dict, Any
import uvicorn
import logging # Added logging import
from datetime import datetime, date # Added for date handling
from utils import extrair_mes_data_seguro, validar_cpf, formatar_cpf, limpar_cpf

from auth import TokenExpiredError, InvalidTokenError, TokenNotFoundError, TokenRevokedError
from dependencies import get_current_user

# Custom JSON encoder to handle Decimal types
class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super(DecimalEncoder, self).default(obj)

from models import (
    OperacaoCreate, Operacao, ResultadoMensal, CarteiraAtual, 
    DARF, AtualizacaoCarteira, OperacaoFechada, ResultadoTicker, AcaoInfo,
    ProventoCreate, ProventoInfo, ProventoRecebidoUsuario, EventoCorporativoCreate, EventoCorporativoInfo,
    ResumoProventoAnual, ResumoProventoMensal, ResumoProventoPorAcao,
    UsuarioProventoRecebidoDB, UsuarioCreate, UsuarioUpdate, UsuarioResponse,
    LoginResponse, FuncaoCreate, FuncaoUpdate, FuncaoResponse, TokenResponse,
    Corretora, # Added Corretora model
    ConfiguracaoUsuarioCreate, ConfiguracaoUsuarioUpdate, ConfiguracaoUsuarioResponse,
    MensagemCreate, MensagemUpdate, MensagemResponse, EstatisticasMensagens,
)
from pydantic import BaseModel


# Pydantic model for DARF status update
class DARFStatusUpdate(BaseModel):
    status: str

# Pydantic model for user feedback
class FeedbackUsuarioCreate(BaseModel):
    categoria: str = 'geral'  # 'bug', 'duvida_fiscal', 'sugestao', 'geral'
    pagina_atual: str = None
    mensagem: str
    prioridade: str = 'media'  # 'baixa', 'media', 'alta'

class FeedbackUsuarioResponse(BaseModel):
    id: int
    usuario_id: int
    categoria: str
    pagina_atual: str
    mensagem: str
    prioridade: str
    data_criacao: str
    status: str

from database import (
    criar_tabelas, 
    limpar_banco_dados, 
    # get_db, remover_operacao, obter_todas_operacoes removed
    obter_configuracao_usuario,
    atualizar_configuracao_usuario,
    criar_configuracao_usuario_padrao,
    # Funções de mensageria
    criar_mensagem,
    obter_mensagens_usuario,
    marcar_mensagem_como_lida,
    marcar_todas_mensagens_como_lidas,
    deletar_mensagem,
    obter_estatisticas_mensagens,
    limpar_mensagens_expiradas,
    # Função de feedback
    inserir_feedback_usuario,
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
    obter_operacoes_fechadas_otimizado_service, # Added for optimized API
    obter_extrato_otimizado_service, # Added for optimized extrato API
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
    recalcular_proventos_recebidos_para_usuario_service, # Antigo serviço de recálculo
    recalcular_proventos_recebidos_rapido, # Novo serviço de recálculo RÁPIDO
    # EventoCorporativo services
    registrar_evento_corporativo_service,
    listar_eventos_corporativos_por_acao_service,
    listar_todos_eventos_corporativos_service,
    listar_eventos_corporativos_usuario_service,  # NOVO SERVIÇO
    # Importation services
    processar_importacao_com_deteccao_duplicatas,  # NOVA LINHA
    listar_historico_importacoes_service,  # NOVA LINHA
    obter_detalhes_importacao_service,  # NOVA LINHA
    reverter_importacao_service,  # NOVA LINHA
    # Duplicate analysis services
    analisar_duplicatas_service,
    limpar_importacoes_service,
    # Ações services
    obter_informacoes_acao_service
)

from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
import auth # Keep this for other auth functions
from validacao_b3 import validar_operacoes_b3, gerar_aviso_b3, gerar_relatorio_detalhado_b3
# auth.get_db removed from here

# Import the new router
from routers import analysis_router  # Incluído novamente para funcionalidade de gráficos
from routers import proventos_router # Incluído novamente para funcionalidade de gráficos
from routers import usuario_router # Added usuario_router import
from routers import cotacoes_router # Added cotacoes_router import
from dependencies import get_current_user, oauth2_scheme # Import from dependencies

# Inicialização do banco de dados
criar_tabelas() # Creates non-auth tables
auth.inicializar_autenticacao() # Initializes authentication system (creates auth tables, modifies others, adds admin)

# Executar migrações necessárias
from database import migrar_resultados_mensais
migrar_resultados_mensais() # Adiciona coluna irrf_swing se não existir

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
app.include_router(analysis_router.router, prefix="/api") # Incluído novamente para funcionalidade de gráficos
app.include_router(proventos_router.router, prefix="/api") # Incluído novamente para funcionalidade de gráficos
app.include_router(usuario_router.router, prefix="/api") # Added usuario_router
app.include_router(cotacoes_router.router, prefix="/api") # Added cotacoes_router

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

@app.get("/api/acoes/info/{ticker}", response_model=Dict[str, Any], tags=["Ações"])
async def obter_informacoes_acao(
    ticker: str = Path(..., description="Ticker da ação para obter informações")
):
    """
    Obtém informações específicas de uma ação por ticker (nome, logo, etc.).
    Este endpoint é público e não requer autenticação.
    """
    try:
        return obter_informacoes_acao_service(ticker=ticker.upper())
    except HTTPException as e:
        raise e
    except Exception as e:
        logging.error(f"Error in /api/acoes/info/{ticker}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro interno ao obter informações da ação: {str(e)}")

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

@app.get("/api/usuario/proventos/", response_model=List[ProventoRecebidoUsuario], tags=["Proventos Usuário"])
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
        # Replace with the new "rapido" service
        import logging
        logging.info(f"[PROVENTO-TRACE] Iniciando recálculo manual rápido de proventos para usuário {usuario.id}. ORIGEM: recalcular_proventos_usuario_endpoint")
        stats = services.recalcular_proventos_recebidos_rapido(usuario_id=usuario.id)
        logging.info(f"[PROVENTO-TRACE] Recálculo manual rápido de proventos para usuário {usuario.id} concluído. Stats: {stats}")
        return {
            "message": "Recálculo rápido de proventos concluído.",
            "stats": stats
        }
    except Exception as e:
        logging.error(f"Error in POST /api/usuario/proventos/recalcular for user {usuario.id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro durante o recálculo de proventos: {str(e)}")

@app.get("/api/dividendos/novos", response_model=List[Dict[str, Any]], tags=["Notificações Dividendos"])
async def obter_novos_dividendos(
    usuario: UsuarioResponse = Depends(get_current_user)
):
    """
    Retorna os dividendos recentemente cadastrados para a carteira do usuário.
    Usa o campo data_calculo para identificar dividendos novos (últimos 2 dias apenas).
    """
    try:
        import services
        
        # Obter dividendos dos últimos 2 dias baseado na data_calculo (padrão do service)
        novos_dividendos = services.obter_novos_dividendos_usuario_service(usuario_id=usuario.id)
        
        return novos_dividendos
    except Exception as e:
        logging.error(f"Error in GET /api/dividendos/novos for user {usuario.id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro ao buscar novos dividendos: {str(e)}")

@app.get("/api/dividendos/proximos", response_model=List[Dict[str, Any]], tags=["Notificações Dividendos"])
async def obter_proximos_dividendos(
    usuario: UsuarioResponse = Depends(get_current_user)
):
    """
    Retorna os dividendos que serão pagos nos próximos 15 dias para ações da carteira do usuário.
    """
    try:
        from datetime import datetime, timedelta
        import services
        
        # Obter dividendos dos próximos 15 dias
        data_inicio = datetime.now().date()
        data_fim = data_inicio + timedelta(days=15)
        
        proximos_dividendos = services.obter_proximos_dividendos_usuario_service(
            usuario_id=usuario.id, 
            data_inicio=data_inicio, 
            data_fim=data_fim
        )
        
        return proximos_dividendos
    except Exception as e:
        logging.error(f"Error in GET /api/dividendos/proximos for user {usuario.id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro ao buscar próximos dividendos: {str(e)}")

@app.get("/api/usuario/eventos_corporativos/", response_model=List[EventoCorporativoInfo], tags=["Eventos Corporativos Usuário"])
async def listar_eventos_corporativos_usuario(
    usuario: UsuarioResponse = Depends(get_current_user)
):
    """
    Lista apenas os eventos corporativos relevantes para o usuário logado.
    Retorna somente eventos de ações que o usuário possuía na data de registro do evento.
    """
    try:
        eventos_data = services.listar_eventos_corporativos_usuario_service(usuario_id=usuario.id)
        return eventos_data
    except Exception as e:
        logging.error(f"Error in GET /api/usuario/eventos_corporativos/ for user {usuario.id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro interno ao listar eventos corporativos do usuário: {str(e)}")


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
    
    # Atualizar último login do usuário
    services.atualizar_ultimo_login_usuario(user["id"])
    
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
        # Ajusta datas para string e inclui corretora_nome
        for op in operacoes:
            if isinstance(op["date"], (datetime, date)):
                op["date"] = op["date"].isoformat()
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

@app.post("/api/upload", response_model=Dict[str, Any])
async def upload_operacoes(
    file: UploadFile = File(...),
    usuario: UsuarioResponse = Depends(get_current_user)
):
    """
    Endpoint para upload de arquivo JSON/Excel com operações.
    Agora com detecção de duplicatas e rastreamento completo.
    """
    try:
        print(f"[BACKEND] Upload iniciado por usuário {usuario.id} ({usuario.email})")
        print(f"[BACKEND] Arquivo: {file.filename}")
        print(f"[BACKEND] Content-Type: {file.content_type}")
        print(f"[BACKEND] Tamanho: {file.size if hasattr(file, 'size') else 'N/A'} bytes")
        
        # Lê o conteúdo do arquivo
        print("[EMOJI] [BACKEND] Lendo conteúdo do arquivo...")
        conteudo = await file.read()
        print(f"[BACKEND] Conteúdo lido: {len(conteudo)} bytes")
        
        # Converte o JSON para uma lista de dicionários
        print("[BACKEND] Convertendo JSON...")
        try:
            operacoes_json = json.loads(conteudo)
            print(f"[BACKEND] JSON parseado com sucesso. Tipo: {type(operacoes_json)}")
            if isinstance(operacoes_json, list):
                print(f"[BACKEND] Lista com {len(operacoes_json)} operações")
                if len(operacoes_json) > 0:
                    print(f"[BACKEND] Primeira operação: {operacoes_json[0]}")
            else:
                print(f"[BACKEND] JSON não é uma lista: {operacoes_json}")
        except json.JSONDecodeError as e:
            print(f"[BACKEND] Erro ao parsear JSON: {e}")
            raise HTTPException(status_code=400, detail="Formato de arquivo JSON inválido")
        
        # Valida e processa as operações
        print("[BACKEND] Validando operações...")
        try:
            operacoes = []
            operacoes_ignoradas_validacao = 0
            operacoes_processadas = []
            
            for i, op in enumerate(operacoes_json):
                print(f"[RELOAD] [BACKEND] Processando operação {i+1}/{len(operacoes_json)}: {op}")
                try:
                    processed_op = preprocess_imported_operation(op)
                    print(f"[OK] [BACKEND] Operação {i+1} processada: {processed_op}")
                    
                    # Ignora operações com quantidade zero ou negativa
                    if processed_op.get("quantity", 0) <= 0:
                        print(f"[WARNING] [BACKEND] Operação {i+1} ignorada: quantidade inválida ({processed_op.get('quantity', 0)})")
                        operacoes_ignoradas_validacao += 1
                        continue
                    
                    operacao_create = OperacaoCreate(**processed_op)
                    operacoes.append(operacao_create)
                    operacoes_processadas.append(processed_op)  # Para validação B3
                    print(f"[OK] [BACKEND] Operação {i+1} validada com sucesso")
                except Exception as e:
                    print(f"[ERROR] [BACKEND] Erro ao processar operação {i+1}: {e}")
                    print(f"[ERROR] [BACKEND] Operação problemática: {op}")
                    print(f"[WARNING] [BACKEND] Ignorando operação {i+1} e continuando...")
                    operacoes_ignoradas_validacao += 1
                    continue
            
            print(f"[OK] [BACKEND] {len(operacoes)} operações processadas com sucesso")
            if operacoes_ignoradas_validacao > 0:
                print(f"[WARNING] [BACKEND] {operacoes_ignoradas_validacao} operações ignoradas por problemas de validação")
            
            # Se não há operações válidas, retorna erro
            if len(operacoes) == 0:
                print("[ERROR] [BACKEND] Nenhuma operação válida encontrada")
                raise HTTPException(status_code=400, detail="Nenhuma operação válida encontrada no arquivo")
            
            # NOVA VALIDAÇÃO B3 - Verificar saldos negativos
            print("[EMOJI] [BACKEND] Executando validação B3 para saldos negativos...")
            operacoes_b3_validas, relatorio_b3 = validar_operacoes_b3(operacoes_processadas)
            
            # Log do relatório B3
            relatorio_detalhado = gerar_relatorio_detalhado_b3(relatorio_b3)
            print(relatorio_detalhado)
            
            # Atualizar lista de operações com as validadas pela B3
            if len(operacoes_b3_validas) < len(operacoes):
                print(f"[WARNING] [BACKEND] Validação B3: {len(operacoes_b3_validas)}/{len(operacoes)} operações validadas")
                
                # Recriar lista de OperacaoCreate com operações válidas B3
                operacoes_finais = []
                for op_valida in operacoes_b3_validas:
                    try:
                        operacao_create = OperacaoCreate(**op_valida)
                        operacoes_finais.append(operacao_create)
                    except Exception as e:
                        print(f"[ERROR] [BACKEND] Erro ao recriar operação B3: {e}")
                        continue
                
                operacoes = operacoes_finais
                print(f"[OK] [BACKEND] {len(operacoes)} operações finais após validação B3")
                
        except HTTPException as e:
            raise e
        except Exception as e:
            print(f"[ERROR] [BACKEND] Erro na validação das operações: {e}")
            raise HTTPException(status_code=400, detail=f"Erro ao validar operações: {str(e)}")
        
        # Processa com detecção de duplicatas
        print("[SEARCH] [BACKEND] Iniciando processamento com detecção de duplicatas...")
        try:
            resultado = processar_importacao_com_deteccao_duplicatas(
                operacoes=operacoes,
                usuario_id=usuario.id,
                nome_arquivo=file.filename,
                conteudo_arquivo=conteudo,
                nome_arquivo_original=file.filename
            )
            
            # Adiciona informações sobre operações ignoradas
            total_operacoes_ignoradas = operacoes_ignoradas_validacao + relatorio_b3.get('total_operacoes_ignoradas', 0)
            
            if total_operacoes_ignoradas > 0:
                resultado["operacoes_ignoradas"] = total_operacoes_ignoradas
                
                # Gerar aviso específico da B3 se houver
                aviso_b3 = gerar_aviso_b3(relatorio_b3)
                if aviso_b3:
                    resultado["aviso_b3"] = aviso_b3
                    resultado["aviso"] = aviso_b3
                else:
                    resultado["aviso"] = f"{total_operacoes_ignoradas} operações foram ignoradas por problemas de validação"
                
                # Adicionar relatório B3 para debug
                resultado["relatorio_b3"] = relatorio_b3
            
            print(f"[OK] [BACKEND] Processamento concluído: {resultado}")
        except Exception as e:
            print(f"[ERROR] [BACKEND] Erro no processamento: {e}")
            raise HTTPException(status_code=500, detail=f"Erro ao processar importação: {str(e)}")
        
        # Recalcula proventos apenas se houver operações importadas
        if resultado.get('importacao', {}).get('total_operacoes_importadas', 0) > 0:
            print(f"[RELOAD] [BACKEND] Recalculando proventos para {resultado.get('importacao', {}).get('total_operacoes_importadas', 0)} operações...")
            from services import recalcular_proventos_recebidos_rapido
            logging.info(f"[PROVENTO-TRACE] Iniciando recálculo rápido de proventos para usuário {usuario.id} após upload. ORIGEM: upload_operacoes. Operações inseridas: {resultado.get('importacao', {}).get('total_operacoes_importadas', 0)}")
            try:
                recalcular_proventos_recebidos_rapido(usuario_id=usuario.id)
                print("[OK] [BACKEND] Recálculo de proventos concluído")
                logging.info(f"[PROVENTO-TRACE] Recálculo rápido de proventos para usuário {usuario.id} após upload concluído.")
            except Exception as e:
                print(f"[ERROR] [BACKEND] Erro no recálculo de proventos: {e}")
                # Não falha o upload por causa do recálculo de proventos
        
        print(f"[EMOJI] [BACKEND] Upload concluído com sucesso para usuário {usuario.id}")
        return resultado
        
    except json.JSONDecodeError:
        print("[ERROR] [BACKEND] Erro: Formato de arquivo JSON inválido")
        raise HTTPException(status_code=400, detail="Formato de arquivo JSON inválido")
    except HTTPException as e:
        print(f"[ERROR] [BACKEND] HTTPException: {e.detail}")
        raise e
    except Exception as e:
        print(f"[ERROR] [BACKEND] Erro inesperado: {e}")
        logging.error(f"Error in upload for user {usuario.id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro ao processar arquivo: {str(e)}")

@app.get("/api/resultados", response_model=List[ResultadoMensal])
async def obter_resultados(mes: str = None, usuario: UsuarioResponse = Depends(get_current_user)):
    """
    Retorna os resultados mensais com todos os dados necessários para o frontend.
    VERSÃO CORRIGIDA: Usar dados diretos do banco sem processamento excessivo.
    """
    try:
        logging.info(f"[API] /api/resultados chamado por usuario_id={usuario.id} | mes={mes}")
        
        # 1. OBTER DADOS DIRETOS DO BANCO
        resultados_do_banco = services.obter_resultados_mensais(usuario_id=usuario.id)
        
        if not resultados_do_banco:
            logging.info(f"[API] Nenhum resultado mensal encontrado para usuario_id={usuario.id}")
            return []
        
        # 2. FILTRAR POR MÊS SE SOLICITADO
        if mes:
            resultados_do_banco = [r for r in resultados_do_banco if r.get("mes") == mes]
        
        # 3. CONVERTER PARA FORMATO ESPERADO PELO FRONTEND (mínimo processamento)
        resultados_formatados = []
        for resultado in resultados_do_banco:
            try:
                # Usar dados diretos do banco com fallbacks seguros
                resultado_formatado = {
                    # Dados básicos
                    "mes": resultado.get("mes", ""),
                    
                    # Swing Trade - dados diretos do banco
                    "vendas_swing": float(resultado.get("vendas_swing", 0)),
                    "custo_swing": float(resultado.get("custo_swing", 0)),
                    "ganho_liquido_swing": float(resultado.get("ganho_liquido_swing", 0)),
                    "isento_swing": bool(resultado.get("isento_swing", False)),
                    "irrf_swing": round(float(resultado.get("irrf_swing", 0)), 3),
                    "prejuizo_acumulado_swing": float(resultado.get("prejuizo_acumulado_swing", 0)),
                    "ir_devido_swing": float(resultado.get("ir_devido_swing", 0)),
                    "ir_pagar_swing": float(resultado.get("ir_pagar_swing", 0)),
                    
                    # Day Trade - dados diretos do banco
                    "vendas_day_trade": float(resultado.get("vendas_day_trade", 0)),
                    "custo_day_trade": float(resultado.get("custo_day_trade", 0)),
                    "ganho_liquido_day": float(resultado.get("ganho_liquido_day", 0)),
                    "prejuizo_acumulado_day": float(resultado.get("prejuizo_acumulado_day", 0)),
                    "irrf_day": round(float(resultado.get("irrf_day", 0)), 3),
                    "ir_devido_day": float(resultado.get("ir_devido_day", 0)),
                    "ir_pagar_day": float(resultado.get("ir_pagar_day", 0)),
                    
                    # Status DARF - dados diretos do banco
                    "status_darf_swing_trade": resultado.get("status_darf_swing_trade"),
                    "status_darf_day_trade": resultado.get("status_darf_day_trade"),
                    
                    # DARF Swing
                    "darf_codigo_swing": resultado.get("darf_codigo_swing"),
                    "darf_competencia_swing": resultado.get("darf_competencia_swing"), 
                    "darf_valor_swing": resultado.get("darf_valor_swing"),
                    "darf_vencimento_swing": resultado.get("darf_vencimento_swing"),
                    
                    # DARF Day
                    "darf_codigo_day": resultado.get("darf_codigo_day"),
                    "darf_competencia_day": resultado.get("darf_competencia_day"),
                    "darf_valor_day": resultado.get("darf_valor_day"),
                    "darf_vencimento_day": resultado.get("darf_vencimento_day"),
                }
                
                resultados_formatados.append(resultado_formatado)
                
                # Log para debug
                logging.info(f"[API] Mês {resultado.get('mes')}: prejuizo_swing={resultado_formatado['prejuizo_acumulado_swing']}, prejuizo_day={resultado_formatado['prejuizo_acumulado_day']}")
                
            except Exception as e:
                logging.error(f"Erro ao processar resultado do mês {resultado.get('mes', 'N/A')}: {e}")
                continue
        
        logging.info(f"[API] Retornando {len(resultados_formatados)} resultados mensais")
        return resultados_formatados
        
    except Exception as e:
        logging.error(f"Erro em /api/resultados para usuário {usuario.id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")


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
    usuario: UsuarioResponse = Depends(get_current_user)  # MUDANÇA: usar UsuarioResponse
):
    """
    Cria uma nova operação manualmente e retorna a operação criada.
    
    Args:
        operacao: Dados da operação a ser criada.
    """
    try:
        new_operacao_id = services.inserir_operacao_manual(operacao, usuario_id=usuario.id, importacao_id=None)  # MUDANÇA: importacao_id=None para operações manuais
        operacao_criada = services.obter_operacao_service(new_operacao_id, usuario_id=usuario.id)
        if not operacao_criada:
            raise HTTPException(status_code=500, detail="Operação criada mas não pôde ser recuperada.")
        return operacao_criada
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao criar operação: {str(e)}")

@app.post("/api/feedback", response_model=FeedbackUsuarioResponse, tags=["Feedback"])
async def criar_feedback(
    feedback: FeedbackUsuarioCreate,
    usuario: UsuarioResponse = Depends(get_current_user)
):
    """
    Cria um novo feedback do usuário.
    
    Args:
        feedback: Dados do feedback a ser criado.
        usuario: Usuário autenticado que está enviando o feedback.
    
    Returns:
        FeedbackUsuarioResponse: Dados do feedback criado.
    """
    try:
        # Validar tamanho da mensagem
        if len(feedback.mensagem) > 1000:
            raise HTTPException(status_code=400, detail="Mensagem muito longa. Máximo 1000 caracteres.")
        
        if not feedback.mensagem.strip():
            raise HTTPException(status_code=400, detail="Mensagem não pode estar vazia.")
        
        # Validar categoria
        categorias_validas = ['bug', 'duvida_fiscal', 'sugestao', 'geral']
        if feedback.categoria not in categorias_validas:
            raise HTTPException(status_code=400, detail=f"Categoria deve ser uma de: {', '.join(categorias_validas)}")
        
        # Validar prioridade
        prioridades_validas = ['baixa', 'media', 'alta']
        if feedback.prioridade not in prioridades_validas:
            raise HTTPException(status_code=400, detail=f"Prioridade deve ser uma de: {', '.join(prioridades_validas)}")
        
        # Preparar dados para inserção
        feedback_data = {
            'usuario_id': usuario.id,
            'categoria': feedback.categoria,
            'pagina_atual': feedback.pagina_atual,
            'mensagem': feedback.mensagem.strip(),
            'prioridade': feedback.prioridade
        }
        
        # Inserir no banco de dados
        feedback_id = inserir_feedback_usuario(feedback_data)
        
        # Retornar resposta
        return FeedbackUsuarioResponse(
            id=feedback_id,
            usuario_id=usuario.id,
            categoria=feedback.categoria,
            pagina_atual=feedback.pagina_atual,
            mensagem=feedback.mensagem.strip(),
            prioridade=feedback.prioridade,
            data_criacao=datetime.now().isoformat(),
            status='pendente'
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao criar feedback: {str(e)}")

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

# [SEARCH] DEBUG: Identificar diferença entre API e Script

# 1[EMOJI]⃣ ADICIONAR DEBUG no main.py no endpoint /api/operacoes/fechadas
@app.get("/api/operacoes/fechadas", response_model=List[Dict[str, Any]])
async def obter_operacoes_fechadas(usuario: UsuarioResponse = Depends(get_current_user)):
    """
    DEBUG: Adicionar logs para identificar o problema
    """
    try:
        logging.info(f"[SEARCH] [API DEBUG] /api/operacoes/fechadas chamado por usuario_id={usuario.id}")
        
        # [SEARCH] VERIFICAR: Dados existentes no banco ANTES do recálculo
        from database import get_db
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT ticker, data_fechamento, data_abertura, resultado
                FROM operacoes_fechadas 
                WHERE usuario_id = %s 
                ORDER BY data_fechamento DESC 
                LIMIT 5
            ''', (usuario.id,))
            
            dados_existentes = cursor.fetchall()
            logging.info(f"[SEARCH] [API DEBUG] Dados existentes no banco ANTES do recálculo:")
            for row in dados_existentes:
                logging.info(f"   - {dict(row)}")
        
        # [OK] 1. GARANTIR RECÁLCULO COMPLETO SE NECESSÁRIO
        # Verificar se há operações fechadas no banco
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) as count FROM operacoes_fechadas WHERE usuario_id = %s", (usuario.id,))
            count_result = cursor.fetchone()
            
        if not count_result or count_result['count'] == 0:
            logging.info(f"[SEARCH] [API DEBUG] Nenhuma operação fechada encontrada, recalculando...")
            services.recalcular_carteira(usuario_id=usuario.id)
            services.calcular_operacoes_fechadas(usuario_id=usuario.id)  # <- AQUI ESTÁ O PROBLEMA
            services.recalcular_resultados_corrigido(usuario_id=usuario.id)
        
        # [SEARCH] VERIFICAR: Dados DEPOIS do recálculo
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT ticker, data_fechamento, data_abertura, resultado
                FROM operacoes_fechadas 
                WHERE usuario_id = %s 
                ORDER BY data_fechamento DESC 
                LIMIT 5
            ''', (usuario.id,))
            
            dados_depois = cursor.fetchall()
            logging.info(f"[SEARCH] [API DEBUG] Dados DEPOIS do recálculo:")
            for row in dados_depois:
                logging.info(f"   - {dict(row)}")
        
        # [OK] 2. BUSCAR OPERAÇÕES FECHADAS DO BANCO
        operacoes_fechadas_db = services.obter_operacoes_para_calculo_fechadas(usuario_id=usuario.id)
        
        # [SEARCH] VERIFICAR: O que services.obter_operacoes_para_calculo_fechadas está retornando
        logging.info(f"[SEARCH] [API DEBUG] services.obter_operacoes_para_calculo_fechadas retornou {len(operacoes_fechadas_db)} operações:")
        for i, op in enumerate(operacoes_fechadas_db[:3]):  # Primeiras 3
            logging.info(f"   - Op {i+1}: {op.get('ticker', 'N/A')} | data_fechamento: {op.get('data_fechamento', 'N/A')}")
            
        # [OK] 3. BUSCAR RESULTADOS MENSAIS
        resultados_mensais = services.obter_resultados_mensais(usuario_id=usuario.id)
        resultados_map = {rm["mes"]: rm for rm in resultados_mensais}
        
        logging.info(f"[API] Encontrados {len(operacoes_fechadas_db)} operações fechadas e {len(resultados_mensais)} resultados mensais")
        
        # [OK] 4. ENRIQUECER DADOS PARA FRONTEND
        operacoes_enriquecidas = []
        
        for op in operacoes_fechadas_db:
            try:
                # Determinar mês da operação
                data_fechamento = op.get('data_fechamento')
                if isinstance(data_fechamento, str):
                    mes_operacao = data_fechamento[:7]  # YYYY-MM
                elif hasattr(data_fechamento, 'strftime'):
                    mes_operacao = extrair_mes_data_seguro(data_fechamento)
                else:
                    logging.warning(f"Data de fechamento inválida: {data_fechamento}")
                    continue
                
                # Buscar resultado mensal correspondente
                resultado_mensal = resultados_map.get(mes_operacao)
                
                # [OK] CALCULAR STATUS_IR CORRIGIDO
                status_ir = _calcular_status_ir_para_frontend(op, resultado_mensal)
                
                # [OK] VERIFICAR SE DEVE GERAR DARF
                deve_gerar_darf = _deve_gerar_darf_para_frontend(op, resultado_mensal)
                status_darf = _obter_status_darf_para_frontend(op, resultado_mensal) if deve_gerar_darf else None
                
                # [OK] CONSTRUIR OPERAÇÃO ENRIQUECIDA
                # CORREÇÃO: Converter Decimal para float para evitar erro NaN no frontend
                preco_medio_compra = op.get("preco_medio_compra", 0)
                preco_medio_venda = op.get("preco_medio_venda", 0)
                valor_compra = op.get("valor_compra", 0)
                valor_venda = op.get("valor_venda", 0)
                resultado = op.get("resultado", 0)
                
                if isinstance(preco_medio_compra, Decimal):
                    preco_medio_compra = float(preco_medio_compra)
                if isinstance(preco_medio_venda, Decimal):
                    preco_medio_venda = float(preco_medio_venda)
                if isinstance(valor_compra, Decimal):
                    valor_compra = float(valor_compra)
                if isinstance(valor_venda, Decimal):
                    valor_venda = float(valor_venda)
                if isinstance(resultado, Decimal):
                    resultado = float(resultado)
                
                op_enriquecida = {
                    # Dados básicos da operação
                    "id": op.get("id"),
                    "ticker": op.get("ticker"),
                    "quantidade": op.get("quantidade", 0),
                    "data_abertura": op.get("data_abertura", data_fechamento),
                    "data_fechamento": data_fechamento,
                    "preco_medio_compra": preco_medio_compra,
                    "preco_medio_venda": preco_medio_venda,
                    "valor_compra": valor_compra,
                    "valor_venda": valor_venda,
                    "resultado": resultado,
                    "day_trade": op.get("day_trade", False),
                    "tipo": op.get("tipo", "compra-venda"),
                    
                    # [OK] STATUS FISCAL CORRIGIDO
                    "status_ir": status_ir,
                    
                    # [OK] DADOS PARA MODAL DARF
                    "mes_operacao": mes_operacao,
                    "resultado_mensal_encontrado": resultado_mensal is not None,
                    "deve_gerar_darf": deve_gerar_darf,
                    "status_darf": status_darf,
                    
                    # [OK] DADOS PARA COMPENSAÇÃO
                    "prejuizo_anterior_disponivel": _obter_prejuizo_anterior(resultado_mensal, op),
                    "valor_ir_devido": _calcular_valor_ir_devido(op, resultado_mensal),
                    "valor_ir_pagar": _calcular_valor_ir_pagar(op, resultado_mensal),
                    
                    # [OK] METADADOS ÚTEIS
                    "percentual_lucro": op.get("percentual_lucro", 0),
                    "taxas_total": op.get("taxas_total", 0),
                    "operacoes_relacionadas": op.get("operacoes_relacionadas", []),
                }
                
                operacoes_enriquecidas.append(op_enriquecida)
                
            except Exception as e:
                logging.error(f"Erro ao processar operação {op.get('id', 'N/A')}: {e}")
                continue
        
        logging.info(f"[API] Retornando {len(operacoes_enriquecidas)} operações enriquecidas")
        return operacoes_enriquecidas
        
    except Exception as e:
        logging.error(f"[SEARCH] [API DEBUG] Erro em /api/operacoes/fechadas para usuário {usuario.id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")

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

@app.get("/api/operacoes/fechadas/otimizado", response_model=List[Dict[str, Any]])
async def obter_operacoes_fechadas_otimizado(usuario: UsuarioResponse = Depends(get_current_user)):
    """
    [START] API OTIMIZADA: Retorna operações fechadas com todos os cálculos já feitos no backend
    - Performance: O(n) vs O(n²) do frontend atual
    - Prejuízo acumulado pré-calculado
    - Detalhes de compensação pré-calculados
    - Status DARF otimizado
    - Estatísticas por mês cached
    """
    try:
        logging.info(f"[START] [API OTIMIZADA] Buscando operações otimizadas para usuário {usuario.id}")
        
        operacoes_otimizadas = obter_operacoes_fechadas_otimizado_service(usuario.id)
        
        logging.info(f"[START] [API OTIMIZADA] Retornando {len(operacoes_otimizadas)} operações com cálculos pré-feitos")
        
        return operacoes_otimizadas
        
    except Exception as e:
        logging.error(f"[START] [API OTIMIZADA] Erro para usuário {usuario.id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")

@app.get("/api/extrato/otimizado", response_model=Dict[str, Any])
async def obter_extrato_otimizado(usuario: UsuarioResponse = Depends(get_current_user)):
    """
    [START] API OTIMIZADA EXTRATO: Retorna todos os dados do extrato pré-processados
    - Operações abertas filtradas e mapeadas
    - Operações fechadas com cálculos
    - Proventos do usuário
    - Eventos corporativos relevantes
    - Performance: O(n) vs O(n²) do frontend
    """
    try:
        logging.info(f"[START] [EXTRATO OTIMIZADO] Buscando dados para usuário {usuario.id}")
        
        extrato_otimizado = obter_extrato_otimizado_service(usuario.id)
        
        total_items = sum(len(v) if isinstance(v, list) else 0 for v in extrato_otimizado.values())
        logging.info(f"[START] [EXTRATO OTIMIZADO] Retornando {total_items} itens pré-processados")
        
        return extrato_otimizado
        
    except Exception as e:
        logging.error(f"[START] [EXTRATO OTIMIZADO] Erro para usuário {usuario.id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")

@app.get("/api/test/auth")
async def test_auth(usuario: UsuarioResponse = Depends(get_current_user)):
    """
    [EMOJI] Endpoint de teste para verificar autenticação
    """
    try:
        return {
            "status": "authenticated", 
            "user_id": usuario.id,
            "username": usuario.nome,
            "message": "Autenticação funcionando"
        }
    except Exception as e:
        logging.error(f"[EMOJI] [TEST AUTH] Erro: {e}")
        raise HTTPException(status_code=500, detail=f"Erro: {str(e)}")
    
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

# Novo endpoint para listar todas as corretoras cadastradas
@app.get("/api/corretoras", response_model=List[Corretora], tags=["Corretoras"])
async def listar_corretoras():
    """
    Lista todas as corretoras cadastradas no sistema.
    """
    try:
        from database import get_db
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id, nome, cnpj FROM corretoras ORDER BY nome ASC")
            corretoras = cursor.fetchall()
            return [Corretora(id=row["id"], nome=row["nome"], cnpj=row["cnpj"]) for row in corretoras]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao listar corretoras: {str(e)}")

# ==================== IMPORTATION ENDPOINTS ====================

@app.get("/api/importacoes", response_model=List[Dict[str, Any]], tags=["Importações"])
async def listar_importacoes(
    limite: int = 50,
    usuario: UsuarioResponse = Depends(get_current_user)
):
    """
    Lista o histórico de importações do usuário.
    """
    try:
        importacoes = listar_historico_importacoes_service(usuario.id, limite)
        return importacoes
    except Exception as e:
        logging.error(f"Error listing imports for user {usuario.id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro ao listar importações: {str(e)}")

@app.get("/api/importacoes/{importacao_id}", response_model=Dict[str, Any], tags=["Importações"])
async def obter_detalhes_importacao(
    importacao_id: int = Path(..., description="ID da importação"),
    usuario: UsuarioResponse = Depends(get_current_user)
):
    """
    Obtém detalhes completos de uma importação específica,
    incluindo todas as operações importadas.
    """
    try:
        detalhes = obter_detalhes_importacao_service(importacao_id, usuario.id)
        return detalhes
    except HTTPException as e:
        raise e
    except Exception as e:
        logging.error(f"Error getting import details {importacao_id} for user {usuario.id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro ao obter detalhes da importação: {str(e)}")

@app.delete("/api/importacoes/{importacao_id}/reverter", response_model=Dict[str, Any], tags=["Importações"])
async def reverter_importacao(
    importacao_id: int = Path(..., description="ID da importação a ser revertida"),
    usuario: UsuarioResponse = Depends(get_current_user)
):
    """
    Reverte uma importação, removendo todas as operações que foram importadas.
    Esta ação é irreversível.
    """
    try:
        resultado = reverter_importacao_service(importacao_id, usuario.id)
        
        # Recalcular carteira e resultados após reverter
        import logging
        from services import recalcular_proventos_recebidos_rapido
        logging.info(f"[PROVENTO-TRACE] Iniciando recálculo rápido de proventos para usuário {usuario.id} após reverter importação {importacao_id}. ORIGEM: reverter_importacao")
        recalcular_proventos_recebidos_rapido(usuario_id=usuario.id)
        logging.info(f"[PROVENTO-TRACE] Recálculo rápido de proventos para usuário {usuario.id} após reverter importação concluído.")
        
        return resultado
    except HTTPException as e:
        raise e
    except Exception as e:
        logging.error(f"Error reverting import {importacao_id} for user {usuario.id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro ao reverter importação: {str(e)}")

@app.get("/api/importacoes/{importacao_id}/operacoes", response_model=List[Dict[str, Any]], tags=["Importações"])
async def listar_operacoes_da_importacao(
    importacao_id: int = Path(..., description="ID da importação"),
    usuario: UsuarioResponse = Depends(get_current_user)
):
    """
    Lista todas as operações de uma importação específica.
    """
    try:
        detalhes = obter_detalhes_importacao_service(importacao_id, usuario.id)
        return detalhes["operacoes"]
    except HTTPException as e:
        raise e
    except Exception as e:
        logging.error(f"Error listing operations for import {importacao_id}, user {usuario.id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro ao listar operações da importação: {str(e)}")

@app.delete("/api/importacoes/limpar", response_model=Dict[str, Any], tags=["Importações"])
async def limpar_historico_importacoes(
    usuario: UsuarioResponse = Depends(get_current_user)
):
    """
    Remove todas as importações do usuário logado.
    Isso permite reutilizar os mesmos arquivos de importação no futuro.
    
    Útil quando você quer "resetar" o histórico de importações sem perder as operações.
    """
    try:
        resultado = limpar_importacoes_service(usuario.id)
        return resultado
    except Exception as e:
        logging.error(f"Error clearing imports for user {usuario.id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro ao limpar importações: {str(e)}")

# ==================== DUPLICATE ANALYSIS ENDPOINTS ====================

@app.get("/api/operacoes/duplicatas/analise", response_model=Dict[str, Any], tags=["Análises"])
async def analisar_duplicatas_potenciais(
    tolerancia_preco: float = 0.01,
    tolerancia_dias: int = 1,
    usuario: UsuarioResponse = Depends(get_current_user)
):
    """
    Analisa operações existentes em busca de possíveis duplicatas
    que possam ter passado despercebidas.
    """
    try:
        from database import get_db
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Buscar operações muito similares
            cursor.execute('''
                SELECT 
                    o1.id as id1, o1.date as date1, o1.ticker, o1.operation, 
                    o1.quantity, o1.price as price1, o1.importacao_id as imp1,
                    o2.id as id2, o2.date as date2, o2.price as price2, 
                    o2.importacao_id as imp2,
                    ABS(EXTRACT(days FROM (o1.date - o2.date))) as diff_dias,
                    ABS(o1.price - o2.price) as diff_preco
                FROM operacoes o1
                JOIN operacoes o2 ON 
                    o1.usuario_id = o2.usuario_id AND
                    o1.ticker = o2.ticker AND
                    o1.operation = o2.operation AND
                    o1.quantity = o2.quantity AND
                    o1.id < o2.id
                WHERE o1.usuario_id = %s
                    AND ABS(EXTRACT(days FROM (o1.date - o2.date))) <= %s
                    AND ABS(o1.price - o2.price) <= %s
                ORDER BY diff_dias, diff_preco
            ''', (usuario.id, tolerancia_dias, tolerancia_preco))
            
            duplicatas_potenciais = [dict(row) for row in cursor.fetchall()]
            
            # Agrupar por nível de suspeita
            suspeita_alta = [d for d in duplicatas_potenciais if d['diff_dias'] == 0 and d['diff_preco'] <= 0.001]
            suspeita_media = [d for d in duplicatas_potenciais if d['diff_dias'] <= 1 and d['diff_preco'] <= 0.01 and d not in suspeita_alta]
            suspeita_baixa = [d for d in duplicatas_potenciais if d not in suspeita_alta and d not in suspeita_media]
            
            return {
                'total_analisadas': len(duplicatas_potenciais),
                'suspeita_alta': suspeita_alta,
                'suspeita_media': suspeita_media,
                'suspeita_baixa': suspeita_baixa,
                'parametros': {
                    'tolerancia_preco': tolerancia_preco,
                    'tolerancia_dias': tolerancia_dias
                }
            }
            
    except Exception as e:
        logging.error(f"Error analyzing potential duplicates for user {usuario.id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro ao analisar duplicatas: {str(e)}")

@app.get("/api/operacoes/duplicatas/exatas", response_model=List[Dict[str, Any]], tags=["Análises"])
async def listar_duplicatas_exatas(
    usuario: UsuarioResponse = Depends(get_current_user)
):
    """
    Lista grupos de operações que são duplicatas exatas.
    """
    try:
        duplicatas = analisar_duplicatas_service(usuario.id)
        return duplicatas
    except Exception as e:
        logging.error(f"Error listing exact duplicates for user {usuario.id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro ao listar duplicatas exatas: {str(e)}")

# ==================== DEBUG ENDPOINTS (TEMPORARY) ====================

# ==================== UTILITY FUNCTIONS ====================

def preprocess_imported_operation(op: dict) -> dict:
    print(f"[RELOAD] [PREPROCESS] Processando operação: {op}")
    
    # Mapeamento de campos
    field_map = {
        "Data do Negócio": "date",
        "Código de Negociação": "ticker",
        "Tipo de Movimentação": "operation",
        "Quantidade": "quantity",
        "Preço": "price",
        "Instituição": "corretora_nome",
        # Outros campos podem ser mapeados conforme necessário
    }
    
    new_op = {}
    for k, v in op.items():
        key = field_map.get(k, k)
        new_op[key] = v
        print(f"[RELOAD] [PREPROCESS] Mapeando campo '{k}' -> '{key}' = '{v}'")
    
    print(f"[RELOAD] [PREPROCESS] Operação após mapeamento: {new_op}")
    
    # Conversão de valores
    if "price" in new_op and isinstance(new_op["price"], str):
        original_price = new_op["price"]
        try:
            # Remove R$, espaços e converte vírgula para ponto
            price_str = new_op["price"].replace("R$", "").replace(",", ".").strip()
            if price_str == "":
                print(f"[ERROR] [PREPROCESS] Preço vazio, definindo como 0.0")
                new_op["price"] = 0.0
            else:
                new_op["price"] = float(price_str)
            print(f"[MONEY] [PREPROCESS] Preço convertido: '{original_price}' -> {new_op['price']}")
        except (ValueError, TypeError) as e:
            print(f"[ERROR] [PREPROCESS] Erro ao converter preço '{original_price}': {e}")
            new_op["price"] = 0.0
        
    if "quantity" in new_op:
        original_quantity = new_op["quantity"]
        try:
            # Se for string, converte para int
            if isinstance(original_quantity, str):
                # Remove espaços e converte
                quantity_str = original_quantity.strip()
                if quantity_str == "":
                    print(f"[ERROR] [PREPROCESS] Quantidade vazia")
                    new_op["quantity"] = 0  # Será filtrado depois
                else:
                    new_op["quantity"] = int(quantity_str)
            else:
                new_op["quantity"] = int(original_quantity)
            print(f"[CHART] [PREPROCESS] Quantidade convertida: '{original_quantity}' -> {new_op['quantity']}")
        except (ValueError, TypeError) as e:
            print(f"[ERROR] [PREPROCESS] Erro ao converter quantidade '{original_quantity}': {e}")
            new_op["quantity"] = 0  # Será filtrado depois
        
    if "operation" in new_op:
        original_operation = new_op["operation"]
        if new_op["operation"].lower().startswith("compra"):
            new_op["operation"] = "buy"
        elif new_op["operation"].lower().startswith("venda"):
            new_op["operation"] = "sell"
        print(f"[CHART] [PREPROCESS] Operação convertida: '{original_operation}' -> '{new_op['operation']}'")
        
    if "ticker" in new_op:
        original_ticker = new_op["ticker"]
        # Remove 'F' final se houver (ex: VALE3F -> VALE3, mas BEEF3 continua BEEF3)
        ticker_str = str(new_op["ticker"]).upper().strip()
        if ticker_str.endswith('F') and len(ticker_str) > 1:
            ticker_str = ticker_str[:-1]
        new_op["ticker"] = ticker_str
        print(f"[EMOJI] [PREPROCESS] Ticker convertido: '{original_ticker}' -> '{new_op['ticker']}'")
        
    if "date" in new_op:
        original_date = new_op["date"]
        # Converte para ISO
        try:
            new_op["date"] = datetime.strptime(new_op["date"], "%d/%m/%Y").date().isoformat()
            print(f"[CALENDAR] [PREPROCESS] Data convertida: '{original_date}' -> '{new_op['date']}'")
        except Exception as e:
            print(f"[ERROR] [PREPROCESS] Erro ao converter data '{original_date}': {e}")
            pass
    
    # Taxas e fees default
    if "fees" not in new_op:
        new_op["fees"] = 0.0
        print(f"[MONEY_OUT] [PREPROCESS] Taxa padrão adicionada: {new_op['fees']}")
    
    print(f"[OK] [PREPROCESS] Operação final: {new_op}")
    return new_op

def _calcular_status_ir_para_frontend(op, resultado_mensal):
    """
    Calcula o status de IR correto para exibição no frontend
    CORREÇÃO: Detecta inconsistências entre day_trade e resultado mensal
    """
    resultado = op.get("resultado", 0)
    ticker = op.get("ticker", "N/A")
    
    # Casos simples
    if resultado == 0:
        return "Isento"
    
    if resultado < 0:
        return "Prejuízo Acumulado"
    
    # [OK] CORREÇÃO: Verificar day_trade mais robustamente
    day_trade_field = op.get("day_trade", False)
    
    # Converter valores do banco (0/1) para boolean
    if isinstance(day_trade_field, (int, str)):
        is_day_trade = bool(int(day_trade_field)) if str(day_trade_field).isdigit() else bool(day_trade_field)
    else:
        is_day_trade = bool(day_trade_field)
    
    # [OK] CORREÇÃO: Não forçar day_trade baseado no resultado mensal
    # O resultado mensal agrega TODAS as operações, não uma específica
    # Cada operação individual deve manter seu próprio tipo (day_trade ou swing)
    if resultado_mensal:
        ir_pagar_day = resultado_mensal.get("ir_pagar_day", 0)
        ir_pagar_swing = resultado_mensal.get("ir_pagar_swing", 0)
    
    # Para operações com lucro
    if is_day_trade:
        # Day Trade
        if resultado_mensal and resultado_mensal.get("ir_pagar_day", 0) > 0:
            return "Tributável Day Trade"
        else:
            return "Lucro Compensado"
    else:
        # Swing Trade
        if resultado_mensal and resultado_mensal.get("isento_swing", False):
            return "Isento"
        elif resultado_mensal and resultado_mensal.get("ir_pagar_swing", 0) > 0:
            return "Tributável Swing"
        else:
            return "Lucro Compensado"


def _deve_gerar_darf_para_frontend(op, resultado_mensal):
    """
    Verifica se a operação deve gerar DARF
    CORREÇÃO: Usa mesma lógica robusta de detecção Day Trade
    """
    # Só gera DARF para operações com lucro
    if op.get("resultado", 0) <= 0:
        return False
    
    # Deve ter resultado mensal
    if not resultado_mensal:
        return False
    
    # [OK] CORREÇÃO: Usar mesma lógica robusta de detecção Day Trade
    day_trade_field = op.get("day_trade", False)
    
    # Converter valores do banco (0/1) para boolean
    if isinstance(day_trade_field, (int, str)):
        is_day_trade = bool(int(day_trade_field)) if str(day_trade_field).isdigit() else bool(day_trade_field)
    else:
        is_day_trade = bool(day_trade_field)
    
    # [OK] CORREÇÃO: Não forçar day_trade baseado no resultado mensal
    # Usar o valor original da operação
    ir_pagar_day = resultado_mensal.get("ir_pagar_day", 0)
    ir_pagar_swing = resultado_mensal.get("ir_pagar_swing", 0)
    
    # Verificar por tipo de operação
    if is_day_trade:
        return ir_pagar_day > 0
    else:
        # Swing trade: não isento E há IR a pagar
        isento = resultado_mensal.get("isento_swing", False)
        return not isento and ir_pagar_swing > 0


def _obter_status_darf_para_frontend(op, resultado_mensal):
    """
    Obtém o status DARF para uma operação
    CORREÇÃO: Usa mesma lógica robusta de detecção Day Trade
    """
    if not resultado_mensal:
        return "Pendente"
    
    # [OK] CORREÇÃO: Usar mesma lógica robusta de detecção Day Trade
    day_trade_field = op.get("day_trade", False)
    
    # Converter valores do banco (0/1) para boolean
    if isinstance(day_trade_field, (int, str)):
        is_day_trade = bool(int(day_trade_field)) if str(day_trade_field).isdigit() else bool(day_trade_field)
    else:
        is_day_trade = bool(day_trade_field)
    
    # [OK] CORREÇÃO: Verificar consistência com dados mensais
    ir_pagar_day = resultado_mensal.get("ir_pagar_day", 0)
    
    # Se há IR Day mas operação não está marcada como Day Trade, corrigir
    if ir_pagar_day > 0 and not is_day_trade:
        is_day_trade = True
    
    if is_day_trade:
        return resultado_mensal.get("status_darf_day_trade", "Pendente")
    else:
        return resultado_mensal.get("status_darf_swing_trade", "Pendente")


def _obter_prejuizo_anterior(resultado_mensal, op):
    """
    Obtém o prejuízo anterior disponível para compensação
    CORREÇÃO: Usa mesma lógica robusta de detecção Day Trade
    """
    if not resultado_mensal:
        return 0
    
    # [OK] CORREÇÃO: Usar mesma lógica robusta de detecção Day Trade
    if isinstance(op, dict):
        day_trade_field = op.get("day_trade", False)
    else:
        day_trade_field = op
    
    # Converter valores do banco (0/1) para boolean
    if isinstance(day_trade_field, (int, str)):
        is_day_trade = bool(int(day_trade_field)) if str(day_trade_field).isdigit() else bool(day_trade_field)
    else:
        is_day_trade = bool(day_trade_field)
    
    # [OK] CORREÇÃO: Verificar consistência com dados mensais se op for dict
    if isinstance(op, dict):
        ir_pagar_day = resultado_mensal.get("ir_pagar_day", 0)
        
        # Se há IR Day mas operação não está marcada como Day Trade, corrigir
        if ir_pagar_day > 0 and not is_day_trade:
            is_day_trade = True
    
    if is_day_trade:
        return resultado_mensal.get("prejuizo_acumulado_day", 0)
    else:
        return resultado_mensal.get("prejuizo_acumulado_swing", 0)


def _calcular_valor_ir_devido(op, resultado_mensal):
    """
    Calcula o valor de IR devido para uma operação
    CORREÇÃO: Usa mesma lógica robusta de detecção Day Trade
    """
    if not _deve_gerar_darf_para_frontend(op, resultado_mensal):
        return 0
    
    if not resultado_mensal:
        return 0
    
    # [OK] CORREÇÃO: Usar mesma lógica robusta de detecção Day Trade
    day_trade_field = op.get("day_trade", False)
    
    # Converter valores do banco (0/1) para boolean
    if isinstance(day_trade_field, (int, str)):
        is_day_trade = bool(int(day_trade_field)) if str(day_trade_field).isdigit() else bool(day_trade_field)
    else:
        is_day_trade = bool(day_trade_field)
    
    # [OK] CORREÇÃO: Verificar consistência com dados mensais
    ir_pagar_day = resultado_mensal.get("ir_pagar_day", 0)
    
    # Se há IR Day mas operação não está marcada como Day Trade, corrigir
    if ir_pagar_day > 0 and not is_day_trade:
        is_day_trade = True
    
    if is_day_trade:
        return resultado_mensal.get("ir_devido_day", 0)
    else:
        return resultado_mensal.get("ir_devido_swing", 0)
def _calcular_valor_ir_pagar(op, resultado_mensal):
    """
    Calcula o valor de IR a pagar para uma operação
    CORREÇÃO: Usa mesma lógica robusta de detecção Day Trade
    """
    if not _deve_gerar_darf_para_frontend(op, resultado_mensal):
        return 0
    
    if not resultado_mensal:
        return 0
    
    # [OK] CORREÇÃO: Usar mesma lógica robusta de detecção Day Trade
    day_trade_field = op.get("day_trade", False)
    
    # Converter valores do banco (0/1) para boolean
    if isinstance(day_trade_field, (int, str)):
        is_day_trade = bool(int(day_trade_field)) if str(day_trade_field).isdigit() else bool(day_trade_field)
    else:
        is_day_trade = bool(day_trade_field)
    
    # [OK] CORREÇÃO: Verificar consistência com dados mensais
    ir_pagar_day = resultado_mensal.get("ir_pagar_day", 0)
    
    # Se há IR Day mas operação não está marcada como Day Trade, corrigir
    if ir_pagar_day > 0 and not is_day_trade:
        is_day_trade = True
    
    if is_day_trade:
        return resultado_mensal.get("ir_pagar_day", 0)
    else:
        return resultado_mensal.get("ir_pagar_swing", 0)

@app.get("/api/debug/operacoes-fechadas/{usuario_id}")
async def debug_operacoes_fechadas(usuario_id: int, admin: UsuarioResponse = Depends(get_admin_user)):
    """
    Endpoint de debug para verificar o estado das operações fechadas
    """
    try:
        from database import get_db
        
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Contar operações fechadas
            cursor.execute("SELECT COUNT(*) as count FROM operacoes_fechadas WHERE usuario_id = %s", (usuario_id,))
            count_op_fechadas = cursor.fetchone()['count']
            
            # Contar resultados mensais
            cursor.execute("SELECT COUNT(*) as count FROM resultados_mensais WHERE usuario_id = %s", (usuario_id,))
            count_resultados = cursor.fetchone()['count']
            
            # Buscar últimas operações fechadas
            cursor.execute("""
                SELECT ticker, data_fechamento, resultado, day_trade, status_ir 
                FROM operacoes_fechadas 
                WHERE usuario_id = %s 
                ORDER BY data_fechamento DESC 
                LIMIT 10
            """, (usuario_id,))
            ultimas_operacoes = cursor.fetchall()
            
            # Buscar resultados mensais
            cursor.execute("""
                SELECT mes, ir_pagar_swing, ir_pagar_day, status_darf_swing_trade, status_darf_day_trade
                FROM resultados_mensais 
                WHERE usuario_id = %s 
                ORDER BY mes DESC
            """, (usuario_id,))
            resultados_mensais = cursor.fetchall()
        
        return {
            "usuario_id": usuario_id,
            "operacoes_fechadas_count": count_op_fechadas,
            "resultados_mensais_count": count_resultados,
            "ultimas_operacoes": [dict(row) for row in ultimas_operacoes],
            "resultados_mensais": [dict(row) for row in resultados_mensais],
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro no debug: {str(e)}")


# [OK] ENDPOINT PARA FORÇAR RECÁLCULO COMPLETO
@app.post("/api/admin/recalcular-completo/{usuario_id}")
async def forcar_recalculo_completo(usuario_id: int, admin: UsuarioResponse = Depends(get_admin_user)):
    """
    Força um recálculo completo para um usuário específico
    """
    try:
        logging.info(f"[ADMIN] Iniciando recálculo completo para usuário {usuario_id}")
        
        # 1. Limpar dados antigos
        services.limpar_operacoes_fechadas_usuario(usuario_id=usuario_id)
        services.limpar_resultados_mensais_usuario_db(usuario_id=usuario_id)
        
        # 2. Recalcular tudo
        services.recalcular_carteira(usuario_id=usuario_id)
        operacoes_fechadas = services.calcular_operacoes_fechadas(usuario_id=usuario_id)
        services.recalcular_resultados_corrigido(usuario_id=usuario_id)
        
        # 3. Buscar dados finais
        resultados_mensais = services.obter_resultados_mensais(usuario_id=usuario_id)
        
        logging.info(f"[ADMIN] Recálculo completo finalizado para usuário {usuario_id}")
        
        return {
            "message": "Recálculo completo realizado com sucesso",
            "usuario_id": usuario_id,
            "operacoes_fechadas_geradas": len(operacoes_fechadas),
            "resultados_mensais_gerados": len(resultados_mensais),
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logging.error(f"Erro no recálculo completo para usuário {usuario_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro no recálculo: {str(e)}")

@app.post("/api/recalcular-irrf", tags=["Admin"])
async def recalcular_irrf_teste(usuario: UsuarioResponse = Depends(get_current_user)):
    """
    [WRENCH] Endpoint de TESTE para recalcular IRRF corretamente
    
    Usa a nova função que calcula Day Trade IRRF (1% sobre ganhos) 
    e Swing Trade IRRF (0.005% sobre vendas)
    """
    try:
        # Usar a nova função que calcula IRRF corretamente
        services.recalcular_resultados_corrigido(usuario_id=usuario.id)
        
        # Obter resultados para verificar os IRRFs
        resultados = services.calcular_resultados_mensais(usuario.id)
        
        # Verificar se há IRRFs calculados
        irrf_day_total = sum(r.get('irrf_day', 0) for r in resultados)
        irrf_swing_total = sum(r.get('irrf_swing', 0) for r in resultados)
        
        return {
            "message": "[OK] IRRF recalculado com sucesso",
            "usuario_id": usuario.id,
            "meses_processados": len(resultados),
            "irrf_day_total": round(irrf_day_total, 2),
            "irrf_swing_total": round(irrf_swing_total, 3),
            "timestamp": datetime.now().isoformat(),
            "detalhes_por_mes": [
                {
                    "mes": r['mes'],
                    "irrf_day": round(r.get('irrf_day', 0), 2),
                    "irrf_swing": round(r.get('irrf_swing', 0), 3),
                    "vendas_day": round(r.get('vendas_day_trade', 0), 2),
                    "vendas_swing": round(r.get('vendas_swing', 0), 2)
                }
                for r in resultados
            ]
        }
        
    except Exception as e:
        logging.error(f"Erro no teste de IRRF para usuário {usuario.id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro no teste de IRRF: {str(e)}")

@app.post("/api/recalcular-status-ir", tags=["Debug"])
async def recalcular_status_ir_endpoint(
    usuario: UsuarioResponse = Depends(get_current_user)
):
    """
    [WRENCH] ENDPOINT: Recalcula status IR das operações para o usuário logado
    """
    try:
        logging.info(f"[WRENCH] [STATUS IR] Recalculando para usuário {usuario.id}")
        
        # Recalcular resultados mensais primeiro
        recalcular_resultados_corrigido(usuario_id=usuario.id)
        
        # Atualizar status IR das operações
        atualizar_status_ir_operacoes_fechadas(usuario_id=usuario.id)
        
        # Verificar quantas operações foram atualizadas
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT COUNT(*) as total, 
                       COUNT(CASE WHEN status_ir IS NOT NULL THEN 1 END) as com_status
                FROM operacoes_fechadas 
                WHERE usuario_id = %s
            """, (usuario.id,))
            stats = cursor.fetchone()
        
        return {
            "status": "sucesso",
            "usuario_id": usuario.id,
            "operacoes_total": stats[0],
            "operacoes_com_status": stats[1],
            "message": "Status IR recalculado com sucesso"
        }
        
    except Exception as e:
        logging.error(f"[ERROR] [STATUS IR] Erro usuário {usuario.id}: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao recalcular status IR: {str(e)}")

@app.post("/api/recalcular-sistema-completo", tags=["Debug"])
async def recalcular_sistema_completo_endpoint(
    dry_run: bool = False,
    force: bool = False,
    usuario: UsuarioResponse = Depends(get_current_user)
):
    """
    [RELOAD] ENDPOINT: Recálculo completo e atômico do sistema
    
    Executa recálculo unificado de:
    - Carteira atual (com eventos corporativos)
    - Proventos recebidos (baseado em posições reais)
    - Resultados mensais (com IRRF correto)
    - Status IR das operações fechadas
    - Validações de integridade
    
    Args:
        dry_run: Se True, executa validações sem salvar
        force: Se True, pula validações de segurança
    
    Returns:
        Dict com métricas detalhadas do recálculo
    """
    try:
        logging.info(f"[RELOAD] [RECÁLCULO COMPLETO] Iniciando para usuário {usuario.id} (dry_run={dry_run}, force={force})")
        
        resultado = services.recalcular_usuario_endpoint_service(
            usuario_id=usuario.id,
            force=force
        )
        
        if dry_run:
            # Se for dry_run, forçar modo de validação
            resultado = services.validar_integridade_usuario(usuario.id)
        
        logging.info(f"[OK] [RECÁLCULO COMPLETO] Concluído para usuário {usuario.id}")
        return resultado
        
    except Exception as e:
        logging.error(f"[ERROR] [RECÁLCULO COMPLETO] Erro usuário {usuario.id}: {e}")
        raise HTTPException(status_code=500, detail=f"Erro no recálculo completo: {str(e)}")

@app.post("/api/validar-integridade", tags=["Debug"])
async def validar_integridade_endpoint(
    usuario: UsuarioResponse = Depends(get_current_user)
):
    """
    [SEARCH] ENDPOINT: Validação rápida de integridade dos dados
    
    Executa validações sem alterar dados para verificar:
    - Consistência entre operações e carteira
    - Integridade dos proventos calculados
    - Coherência dos resultados mensais
    
    Returns:
        Dict com resultados da validação
    """
    try:
        logging.info(f"[SEARCH] [VALIDAÇÃO] Iniciando para usuário {usuario.id}")
        
        resultado = services.validar_integridade_usuario(usuario.id)
        
        logging.info(f"[OK] [VALIDAÇÃO] Concluída para usuário {usuario.id}")
        return resultado
        
    except Exception as e:
        logging.error(f"[ERROR] [VALIDAÇÃO] Erro usuário {usuario.id}: {e}")
        raise HTTPException(status_code=500, detail=f"Erro na validação: {str(e)}")

# ============================================
# ROTAS PARA CONFIGURAÇÕES DE USUÁRIO
# ============================================

@app.get("/api/usuario/configuracoes", response_model=ConfiguracaoUsuarioResponse, tags=["Usuário"])
async def obter_configuracoes_usuario(
    usuario: UsuarioResponse = Depends(get_current_user)
):
    """
    Obtém as configurações pessoais do usuário logado.
    """
    try:
        configuracao = obter_configuracao_usuario(usuario.id)
        
        if not configuracao:
            # Se não existe configuração, criar uma padrão
            criar_configuracao_usuario_padrao(usuario.id)
            configuracao = obter_configuracao_usuario(usuario.id)
        
        return ConfiguracaoUsuarioResponse(**configuracao)
        
    except Exception as e:
        logging.error(f"Erro ao obter configurações usuário {usuario.id}: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao obter configurações: {str(e)}")

@app.put("/api/usuario/configuracoes", response_model=ConfiguracaoUsuarioResponse, tags=["Usuário"])
async def atualizar_configuracoes_usuario(
    configuracoes: ConfiguracaoUsuarioUpdate,
    usuario: UsuarioResponse = Depends(get_current_user)
):
    """
    Atualiza as configurações pessoais do usuário logado.
    """
    try:
        # Verificar se usuário já tem configuração
        config_existente = obter_configuracao_usuario(usuario.id)
        if not config_existente:
            criar_configuracao_usuario_padrao(usuario.id)
        
        # Converter para dict apenas com campos não-None
        dados_atualizacao = {
            campo: valor for campo, valor in configuracoes.dict().items() 
            if valor is not None
        }
        
        sucesso = atualizar_configuracao_usuario(usuario.id, dados_atualizacao)
        
        if not sucesso:
            raise HTTPException(status_code=400, detail="Nenhuma configuração foi atualizada")
        
        # Retornar configuração atualizada
        configuracao_atualizada = obter_configuracao_usuario(usuario.id)
        return ConfiguracaoUsuarioResponse(**configuracao_atualizada)
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Erro ao atualizar configurações usuário {usuario.id}: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao atualizar configurações: {str(e)}")

@app.get("/api/usuario/perfil", response_model=dict, tags=["Usuário"])
async def obter_perfil_usuario(
    usuario: UsuarioResponse = Depends(get_current_user)
):
    """
    Obtém o perfil completo do usuário (dados básicos + configurações).
    """
    try:
        configuracao = obter_configuracao_usuario(usuario.id)
        
        if not configuracao:
            criar_configuracao_usuario_padrao(usuario.id)
            configuracao = obter_configuracao_usuario(usuario.id)
        
        return {
            "usuario": {
                "id": usuario.id,
                "username": usuario.username,
                "email": usuario.email,
                "nome_completo": usuario.nome_completo,
                "cpf": formatar_cpf(usuario.cpf) if usuario.cpf else None,
                "funcoes": usuario.funcoes,
                "data_criacao": usuario.data_criacao,
                "ativo": usuario.ativo
            },
            "configuracoes": ConfiguracaoUsuarioResponse(**configuracao)
        }
        
    except Exception as e:
        logging.error(f"Erro ao obter perfil usuário {usuario.id}: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao obter perfil: {str(e)}")

@app.put("/api/usuario/dados", response_model=UsuarioResponse, tags=["Usuário"])
async def atualizar_dados_usuario(
    dados: UsuarioUpdate,
    usuario: UsuarioResponse = Depends(get_current_user)
):
    """
    Atualiza os dados básicos do usuário (nome, CPF, etc.).
    """
    try:
        # Validar CPF se fornecido
        if dados.cpf is not None:
            cpf_limpo = limpar_cpf(dados.cpf)
            if cpf_limpo and not validar_cpf(cpf_limpo):
                raise HTTPException(status_code=400, detail="CPF inválido")
            # Salvar CPF sem formatação no banco
            dados.cpf = cpf_limpo if cpf_limpo else None
        
        # Aqui você precisaria implementar a função de atualização no database.py
        # Por enquanto, vou simular uma resposta
        import auth
        usuario_atualizado = auth.obter_usuario(usuario.id)
        
        if not usuario_atualizado:
            raise HTTPException(status_code=404, detail="Usuário não encontrado")
        
        # TODO: Implementar atualização real no banco de dados
        # atualizar_usuario(usuario.id, dados.dict(exclude_unset=True))
        
        return UsuarioResponse(**usuario_atualizado)
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Erro ao atualizar dados usuário {usuario.id}: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao atualizar dados: {str(e)}")

# ============================================
# ROTAS PARA SISTEMA DE MENSAGERIA
# ============================================

@app.get("/api/mensagens", response_model=List[MensagemResponse], tags=["Mensagens"])
async def listar_mensagens(
    apenas_nao_lidas: bool = False,
    categoria: str = None,
    limite: int = 50,
    usuario: UsuarioResponse = Depends(get_current_user)
):
    """
    Lista as mensagens do usuário logado com filtros opcionais.
    """
    try:
        mensagens = obter_mensagens_usuario(
            usuario.id, 
            apenas_nao_lidas=apenas_nao_lidas, 
            categoria=categoria, 
            limite=limite
        )
        
        # Converter datas ISO para datetime objects
        for msg in mensagens:
            if msg.get('data_criacao'):
                msg['data_criacao'] = datetime.fromisoformat(msg['data_criacao'])
            if msg.get('data_leitura'):
                msg['data_leitura'] = datetime.fromisoformat(msg['data_leitura'])
            if msg.get('expirar_em'):
                msg['expirar_em'] = datetime.fromisoformat(msg['expirar_em'])
        
        return [MensagemResponse(**msg) for msg in mensagens]
        
    except Exception as e:
        logging.error(f"Erro ao listar mensagens usuário {usuario.id}: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao listar mensagens: {str(e)}")

@app.post("/api/mensagens", response_model=MensagemResponse, status_code=201, tags=["Mensagens"])
async def criar_nova_mensagem(
    mensagem: MensagemCreate,
    usuario: UsuarioResponse = Depends(get_current_user)
):
    """
    Cria uma nova mensagem (apenas admins podem criar mensagens para outros usuários).
    """
    try:
        # Por segurança, verificar se usuário tem permissão
        if mensagem.usuario_id != usuario.id and "admin" not in usuario.funcoes:
            raise HTTPException(status_code=403, detail="Sem permissão para criar mensagens para outros usuários")
        
        mensagem_id = criar_mensagem(
            usuario_id=mensagem.usuario_id,
            titulo=mensagem.titulo,
            conteudo=mensagem.conteudo,
            tipo=mensagem.tipo,
            prioridade=mensagem.prioridade,
            categoria=mensagem.categoria,
            remetente=mensagem.remetente,
            acao_url=mensagem.acao_url,
            acao_texto=mensagem.acao_texto,
            expirar_em=mensagem.expirar_em.isoformat() if mensagem.expirar_em else None
        )
        
        # Buscar mensagem criada
        mensagens = obter_mensagens_usuario(mensagem.usuario_id, limite=1)
        if mensagens:
            msg = mensagens[0]
            if msg.get('data_criacao'):
                msg['data_criacao'] = datetime.fromisoformat(msg['data_criacao'])
            return MensagemResponse(**msg)
        
        raise HTTPException(status_code=500, detail="Erro ao recuperar mensagem criada")
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Erro ao criar mensagem: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao criar mensagem: {str(e)}")

@app.put("/api/mensagens/{mensagem_id}/lida", tags=["Mensagens"])
async def marcar_como_lida(
    mensagem_id: int,
    usuario: UsuarioResponse = Depends(get_current_user)
):
    """
    Marca uma mensagem específica como lida.
    """
    try:
        sucesso = marcar_mensagem_como_lida(mensagem_id, usuario.id)
        
        if not sucesso:
            raise HTTPException(status_code=404, detail="Mensagem não encontrada")
        
        return {"message": "Mensagem marcada como lida", "mensagem_id": mensagem_id}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Erro ao marcar mensagem como lida: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao marcar como lida: {str(e)}")

@app.put("/api/mensagens/marcar-todas-lidas", tags=["Mensagens"])
async def marcar_todas_como_lidas(
    usuario: UsuarioResponse = Depends(get_current_user)
):
    """
    Marca todas as mensagens do usuário como lidas.
    """
    try:
        quantidade = marcar_todas_mensagens_como_lidas(usuario.id)
        
        return {
            "message": f"{quantidade} mensagens marcadas como lidas",
            "quantidade": quantidade
        }
        
    except Exception as e:
        logging.error(f"Erro ao marcar todas mensagens como lidas: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao marcar como lidas: {str(e)}")

@app.delete("/api/mensagens/{mensagem_id}", tags=["Mensagens"])
async def deletar_mensagem_endpoint(
    mensagem_id: int,
    usuario: UsuarioResponse = Depends(get_current_user)
):
    """
    Deleta uma mensagem específica.
    """
    try:
        sucesso = deletar_mensagem(mensagem_id, usuario.id)
        
        if not sucesso:
            raise HTTPException(status_code=404, detail="Mensagem não encontrada")
        
        return {"message": "Mensagem deletada com sucesso", "mensagem_id": mensagem_id}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Erro ao deletar mensagem: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao deletar mensagem: {str(e)}")

@app.get("/api/mensagens/estatisticas", response_model=EstatisticasMensagens, tags=["Mensagens"])
async def obter_estatisticas(
    usuario: UsuarioResponse = Depends(get_current_user)
):
    """
    Obtém estatísticas das mensagens do usuário.
    """
    try:
        stats = obter_estatisticas_mensagens(usuario.id)
        return EstatisticasMensagens(**stats)
        
    except Exception as e:
        logging.error(f"Erro ao obter estatísticas: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao obter estatísticas: {str(e)}")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
    
    