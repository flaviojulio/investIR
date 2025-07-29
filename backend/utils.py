"""
Utilitários para manipulação de datas e outros helpers.
"""

from datetime import datetime, date
from typing import Union
import re

def extrair_mes_data_seguro(data_input: Union[str, date, datetime]) -> str:
    """
    Extrai o mês no formato YYYY-MM de qualquer tipo de data de forma segura.
    
    Args:
        data_input: Pode ser string, date ou datetime
        
    Returns:
        str: Data no formato YYYY-MM
    """
    if data_input is None:
        return None
    
    # Se já é uma string
    if isinstance(data_input, str):
        # Se está no formato YYYY-MM-DD ou YYYY-MM-DD HH:MM:SS
        if len(data_input) >= 7:
            return data_input[:7]  # Pega os primeiros 7 caracteres (YYYY-MM)
        else:
            return data_input
    
    # Se é um objeto date ou datetime
    elif hasattr(data_input, 'strftime'):
        return data_input.strftime("%Y-%m")
    
    # Se for outro tipo, tentar converter para string primeiro
    else:
        try:
            data_str = str(data_input)
            return data_str[:7] if len(data_str) >= 7 else data_str
        except:
            return None

def converter_data_para_objeto_seguro(data_input: Union[str, date, datetime]) -> Union[date, None]:
    """
    Converte qualquer formato de data para objeto date de forma segura.
    
    Args:
        data_input: Pode ser string, date ou datetime
        
    Returns:
        date: Objeto date ou None se conversão falhar
    """
    if data_input is None:
        return None
    
    # Se já é um objeto date
    if isinstance(data_input, date):
        return data_input
    
    # Se é datetime, extrair apenas a data
    elif isinstance(data_input, datetime):
        return data_input.date()
    
    # Se é string, tentar converter
    elif isinstance(data_input, str):
        try:
            # Remover parte do tempo se existir
            data_str = data_input.split('T')[0].split(' ')[0]
            
            # Tentar converter YYYY-MM-DD
            return datetime.strptime(data_str, '%Y-%m-%d').date()
        except ValueError:
            try:
                # Tentar converter DD/MM/YYYY
                return datetime.strptime(data_str, '%d/%m/%Y').date()
            except ValueError:
                print(f"⚠️ Não foi possível converter data: {data_input}")
                return None
    
    return None

# ============================================
# UTILITÁRIOS PARA CPF
# ============================================

def validar_cpf(cpf: str) -> bool:
    """
    Valida se um CPF é válido usando o algoritmo oficial.
    
    Args:
        cpf: String do CPF (com ou sem formatação)
        
    Returns:
        bool: True se CPF válido, False caso contrário
    """
    if not cpf:
        return False
    
    # Remove caracteres não numéricos
    cpf_numeros = re.sub(r'\D', '', cpf)
    
    # Verifica se tem 11 dígitos
    if len(cpf_numeros) != 11:
        return False
    
    # Verifica se não são todos os dígitos iguais
    if cpf_numeros == cpf_numeros[0] * 11:
        return False
    
    # Calcula o primeiro dígito verificador
    soma = 0
    for i in range(9):
        soma += int(cpf_numeros[i]) * (10 - i)
    
    resto = soma % 11
    primeiro_digito = 0 if resto < 2 else 11 - resto
    
    # Verifica primeiro dígito
    if int(cpf_numeros[9]) != primeiro_digito:
        return False
    
    # Calcula o segundo dígito verificador
    soma = 0
    for i in range(10):
        soma += int(cpf_numeros[i]) * (11 - i)
    
    resto = soma % 11
    segundo_digito = 0 if resto < 2 else 11 - resto
    
    # Verifica segundo dígito
    return int(cpf_numeros[10]) == segundo_digito

def formatar_cpf(cpf: str) -> str:
    """
    Formata um CPF no padrão brasileiro xxx.xxx.xxx-xx.
    
    Args:
        cpf: String do CPF (apenas números)
        
    Returns:
        str: CPF formatado ou string original se inválido
    """
    if not cpf:
        return cpf
    
    # Remove caracteres não numéricos
    cpf_numeros = re.sub(r'\D', '', cpf)
    
    # Verifica se tem 11 dígitos
    if len(cpf_numeros) != 11:
        return cpf
    
    # Aplica formatação xxx.xxx.xxx-xx
    return f"{cpf_numeros[:3]}.{cpf_numeros[3:6]}.{cpf_numeros[6:9]}-{cpf_numeros[9:]}"

def limpar_cpf(cpf: str) -> str:
    """
    Remove formatação do CPF, deixando apenas números.
    
    Args:
        cpf: String do CPF (com ou sem formatação)
        
    Returns:
        str: CPF apenas com números
    """
    if not cpf:
        return ""
    
    return re.sub(r'\D', '', cpf)
