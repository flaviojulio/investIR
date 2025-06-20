from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional

from backend import database as db # Alias to avoid conflict
from backend.models import Corretora, CorretoraCreate, CorretoraUpdate, UsuarioResponse
from backend.auth import get_current_active_user

router = APIRouter(
    prefix="/corretoras",
    tags=["corretoras"],
    responses={404: {"description": "Não encontrado"}},
)

@router.post("/", response_model=Corretora, status_code=status.HTTP_201_CREATED)
async def criar_nova_corretora(
    corretora_data: CorretoraCreate,
    current_user: UsuarioResponse = Depends(get_current_active_user),
):
    """
    Cria uma nova corretora para o usuário logado.
    """
    try:
        corretora_id = db.inserir_corretora(corretora_data.model_dump(), current_user.id)
        # Buscar a corretora recém-criada para retornar todos os dados, incluindo o ID.
        db_corretora = db.obter_corretora_por_id(corretora_id, current_user.id)
        if db_corretora is None:
            # Isso não deveria acontecer se inserir_corretora funcionou e retornou um ID
            raise HTTPException(status_code=500, detail="Erro ao criar a corretora.")
        return Corretora.model_validate(db_corretora) # Pydantic v2
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        # Log a exceção aqui
        print(f"Erro inesperado ao criar corretora: {e}")
        raise HTTPException(status_code=500, detail="Erro interno do servidor ao criar corretora.")


@router.get("/", response_model=List[Corretora])
async def listar_corretoras_do_usuario(
    current_user: UsuarioResponse = Depends(get_current_active_user),
):
    """
    Lista todas as corretoras cadastradas pelo usuário logado.
    """
    db_corretoras = db.obter_corretoras_por_usuario(current_user.id)
    return [Corretora.model_validate(row) for row in db_corretoras]


@router.get("/{corretora_id}", response_model=Corretora)
async def obter_detalhes_corretora(
    corretora_id: int,
    current_user: UsuarioResponse = Depends(get_current_active_user),
):
    """
    Obtém os detalhes de uma corretora específica do usuário logado.
    """
    db_corretora = db.obter_corretora_por_id(corretora_id, current_user.id)
    if db_corretora is None:
        raise HTTPException(status_code=404, detail="Corretora não encontrada")
    return Corretora.model_validate(db_corretora)


@router.put("/{corretora_id}", response_model=Corretora)
async def atualizar_dados_corretora(
    corretora_id: int,
    corretora_data: CorretoraUpdate,
    current_user: UsuarioResponse = Depends(get_current_active_user),
):
    """
    Atualiza os dados de uma corretora específica do usuário logado.
    """
    try:
        # model_dump(exclude_unset=True) garante que apenas os campos fornecidos sejam enviados para atualização
        dados_para_atualizar = corretora_data.model_dump(exclude_unset=True)
        if not dados_para_atualizar:
             raise HTTPException(status_code=400, detail="Nenhum dado fornecido para atualização.")

        sucesso = db.atualizar_corretora(
            corretora_id, dados_para_atualizar, current_user.id
        )
        if not sucesso:
            # Verificar se a corretora existe para dar um erro 404 mais específico
            if db.obter_corretora_por_id(corretora_id, current_user.id) is None:
                 raise HTTPException(status_code=404, detail="Corretora não encontrada.")
            # Se existe mas não atualizou, pode ser que os dados sejam os mesmos
            # ou outra falha na atualização que não seja erro de integridade
            # Para simplificar, vamos assumir que se `atualizar_corretora` retorna False e não ValueError, é 404 ou dados inalterados.
            # A função db.atualizar_corretora já lida com IntegrityError.
            # Se a corretora existe, mas os dados são idênticos, rowcount será 0.
            # Para diferenciar "não encontrado" de "dados inalterados que resultam em não atualização",
            # a lógica aqui pode ser mais granular.
            # No entanto, db.atualizar_corretora retorna True se rowcount > 0.
            # Se rowcount == 0, pode ser não encontrado ou dados idênticos.
            # A checagem de existência acima ajuda a distinguir.
            # Se chegou aqui e sucesso é False, mas a corretora existe, os dados podem ser os mesmos.
            # Vamos retornar a corretora existente neste caso, pois o estado desejado (dados atualizados)
            # é o mesmo que o estado atual. Ou, pode-se optar por um 304 Not Modified (não diretamente suportado por FastAPI).
            # Por simplicidade, vamos buscar e retornar. Se a intenção é erro para "dados inalterados", a lógica precisa mudar.
            db_corretora_atualizada = db.obter_corretora_por_id(corretora_id, current_user.id)
            if db_corretora_atualizada: # Se ainda existe, significa que os dados podem não ter mudado.
                return Corretora.model_validate(db_corretora_atualizada)
            raise HTTPException(status_code=404, detail="Corretora não encontrada ou dados inalterados.")

        db_corretora_atualizada = db.obter_corretora_por_id(corretora_id, current_user.id)
        if db_corretora_atualizada is None: # Segurança, não deveria acontecer se sucesso=True
             raise HTTPException(status_code=404, detail="Corretora não encontrada após atualização.")
        return Corretora.model_validate(db_corretora_atualizada)
    except ValueError as e: # Captura o ValueError de db.atualizar_corretora (duplicidade)
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        # Log a exceção aqui
        print(f"Erro inesperado ao atualizar corretora: {e}")
        raise HTTPException(status_code=500, detail="Erro interno do servidor ao atualizar corretora.")


@router.delete("/{corretora_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remover_corretora_existente(
    corretora_id: int,
    current_user: UsuarioResponse = Depends(get_current_active_user),
):
    """
    Remove uma corretora específica do usuário logado.
    Operações associadas a esta corretora NÃO serão removidas,
    mas o campo `corretora_id` nelas poderá ficar órfão se não for
    tratado (e.g. setado para NULL) na camada de banco ou pela constraint FOREIGN KEY.
    A constraint `ON DELETE CASCADE` na tabela `corretoras` para `usuario_id`
    refere-se à remoção do usuário, não da corretora em si afetando operações.
    """
    # Opcional: Adicionar lógica para desassociar corretora das operações antes de remover
    # db.desassociar_operacoes_da_corretora(corretora_id, current_user.id)

    removido = db.remover_corretora(corretora_id, current_user.id)
    if not removido:
        raise HTTPException(status_code=404, detail="Corretora não encontrada")
    return None # Retorna 204 No Content
