# Importações existentes
from fastapi import FastAPI, HTTPException, Depends, Path, Query, Header
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Optional

# Novas importações para autenticação
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from models import (
    UsuarioCreate, UsuarioUpdate, UsuarioResponse, LoginRequest, 
    LoginResponse, FuncaoCreate, FuncaoResponse
)
import auth

# Configuração do OAuth2
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

# Função para obter o usuário atual
async def get_current_user(token: str = Depends(oauth2_scheme)) -> Dict:
    payload = auth.verificar_token(token)
    if not payload:
        raise HTTPException(
            status_code=401,
            detail="Token inválido ou expirado",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    usuario_id = payload.get("sub")
    if not usuario_id:
        raise HTTPException(
            status_code=401,
            detail="Token inválido",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    usuario = auth.obter_usuario(usuario_id)
    if not usuario:
        raise HTTPException(
            status_code=401,
            detail="Usuário não encontrado",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return usuario

# Função para verificar se o usuário é administrador
async def get_admin_user(usuario: Dict = Depends(get_current_user)) -> Dict:
    if "admin" not in usuario.get("funcoes", []):
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

@app.post("/api/auth/login", response_model=LoginResponse)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """
    Autentica um usuário e retorna um token JWT.
    """
    usuario = auth.verificar_credenciais(form_data.username, form_data.password)
    
    if not usuario:
        raise HTTPException(
            status_code=401,
            detail="Credenciais inválidas",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = auth.gerar_token(usuario["id"])
    
    return {
        "usuario": usuario,
        "token": token
    }

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
async def get_me(usuario: Dict = Depends(get_current_user)):
    """
    Retorna os dados do usuário autenticado.
    """
    return usuario

# Endpoints de administração de usuários (apenas para administradores)
@app.get("/api/usuarios", response_model=List[UsuarioResponse])
async def listar_usuarios(admin: Dict = Depends(get_admin_user)):
    """
    Lista todos os usuários do sistema.
    Requer permissão de administrador.
    """
    return auth.obter_todos_usuarios()

@app.get("/api/usuarios/{usuario_id}", response_model=UsuarioResponse)
async def obter_usuario_por_id(
    usuario_id: int = Path(..., description="ID do usuário"),
    admin: Dict = Depends(get_admin_user)
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
    admin: Dict = Depends(get_admin_user)
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
    admin: Dict = Depends(get_admin_user)
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
    admin: Dict = Depends(get_admin_user)
):
    """
    Adiciona uma função a um usuário.
    Requer permissão de administrador.
    """
    success = auth.adicionar_funcao_usuario(usuario_id, funcao_nome)
    
    if not success:
        raise HTTPException(status_code=404, detail="Usuário ou função não encontrados")
    
    return {"mensagem": f"Função {funcao_nome} adicionada ao usuário {usuario_id}"}

@app.delete("/api/usuarios/{usuario_id}/funcoes/{funcao_nome}")
async def remover_funcao_de_usuario(
    usuario_id: int = Path(..., description="ID do usuário"),
    funcao_nome: str = Path(..., description="Nome da função"),
    admin: Dict = Depends(get_admin_user)
):
    """
    Remove uma função de um usuário.
    Requer permissão de administrador.
    """
    success = auth.remover_funcao_usuario(usuario_id, funcao_nome)
    
    if not success:
        raise HTTPException(status_code=404, detail="Usuário ou função não encontrados")
    
    return {"mensagem": f"Função {funcao_nome} removida do usuário {usuario_id}"}

# Endpoints para gerenciar funções
@app.get("/api/funcoes", response_model=List[FuncaoResponse])
async def listar_funcoes(admin: Dict = Depends(get_admin_user)):
    """
    Lista todas as funções do sistema.
    Requer permissão de administrador.
    """
    return auth.obter_todas_funcoes()

@app.post("/api/funcoes", response_model=FuncaoResponse)
async def criar_nova_funcao(
    funcao: FuncaoCreate,
    admin: Dict = Depends(get_admin_user)
):
    """
    Cria uma nova função no sistema.
    Requer permissão de administrador.
    """
    try:
        funcao_id = auth.criar_funcao(funcao.nome, funcao.descricao)
        
        # Obtém a função criada
        with auth.get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT id, nome, descricao FROM funcoes WHERE id = ?', (funcao_id,))
            return dict(cursor.fetchone())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao criar função: {str(e)}")

# Modificar os endpoints existentes para usar autenticação
# Por exemplo:

@app.get("/api/operacoes", response_model=List[Operacao])
async def listar_operacoes(usuario: Dict = Depends(get_current_user)):
    """
    Lista todas as operações do usuário.
    """
    try:
        operacoes = obter_todas_operacoes(usuario_id=usuario["id"])
        return operacoes
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao listar operações: {str(e)}")

# Continuar modificando os outros endpoints...
