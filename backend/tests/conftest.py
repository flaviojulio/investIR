"""
Configurações e fixtures globais para testes
"""
import pytest
import sqlite3
import tempfile
import os
from datetime import date, datetime, timedelta
from typing import Generator
from contextlib import contextmanager

# Importar módulos do projeto
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import get_db, criar_tabelas
from models import UsuarioCreate, UsuarioResponse


@pytest.fixture(scope="session")
def temp_db():
    """Cria um banco de dados temporário para os testes"""
    temp_db_file = tempfile.NamedTemporaryFile(delete=False, suffix=".db")
    temp_db_path = temp_db_file.name
    temp_db_file.close()
    
    # Configurar o caminho do banco para os testes
    import database
    original_db_file = database.DATABASE_FILE
    database.DATABASE_FILE = temp_db_path
    
    # Criar as tabelas
    criar_tabelas()
    
    yield temp_db_path
    
    # Cleanup
    database.DATABASE_FILE = original_db_file
    if os.path.exists(temp_db_path):
        os.unlink(temp_db_path)


@pytest.fixture
def db_session(temp_db):
    """Fornece uma sessão de banco limpa para cada teste"""
    # Limpar todas as tabelas antes de cada teste
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Obter lista de tabelas
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = cursor.fetchall()
        
        # Limpar cada tabela
        for table in tables:
            if table[0] != 'sqlite_sequence':
                cursor.execute(f"DELETE FROM {table[0]}")
        
        conn.commit()
    
    yield
    
    # Cleanup após cada teste
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = cursor.fetchall()
        
        for table in tables:
            if table[0] != 'sqlite_sequence':
                cursor.execute(f"DELETE FROM {table[0]}")
        
        conn.commit()


@pytest.fixture
def sample_user(db_session):
    """Cria um usuário de teste"""
    from database import inserir_usuario
    
    usuario_data = {
        "username": "testuser",
        "email": "test@example.com",
        "nome_completo": "Usuário de Teste",
        "cpf": "12345678901",
        "senha": "senha123"
    }
    
    user_id = inserir_usuario(usuario_data)
    
    return UsuarioResponse(
        id=user_id,
        username=usuario_data["username"],
        email=usuario_data["email"],
        nome_completo=usuario_data["nome_completo"],
        cpf=usuario_data["cpf"],
        funcoes=["user"],
        ativo=True,
        data_criacao=datetime.now()
    )


@pytest.fixture
def sample_stocks(db_session):
    """Cria ações de exemplo no banco"""
    from database import get_db
    
    stocks = [
        {"ticker": "PETR4", "nome": "PETROBRAS PN N2", "cnpj": "33000167000101"},
        {"ticker": "VALE3", "nome": "VALE ON NM", "cnpj": "33592510000154"},
        {"ticker": "ITUB4", "nome": "ITAUUNIBANCO PN N1", "cnpj": "60701190000104"},
        {"ticker": "BBAS3", "nome": "BRASIL ON NM", "cnpj": "00000000000191"},
        {"ticker": "WEGE3", "nome": "WEG ON NM", "cnpj": "84429695000111"},
    ]
    
    with get_db() as conn:
        cursor = conn.cursor()
        for stock in stocks:
            cursor.execute("""
                INSERT OR IGNORE INTO acoes (ticker, nome, cnpj)
                VALUES (?, ?, ?)
            """, (stock["ticker"], stock["nome"], stock["cnpj"]))
        conn.commit()
    
    return stocks


@pytest.fixture
def sample_corretora(db_session):
    """Cria uma corretora de exemplo"""
    from database import get_db
    
    corretora_data = {
        "nome": "Corretora Teste",
        "codigo": "001",
        "ativa": True
    }
    
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO corretoras (nome, codigo, ativa)
            VALUES (?, ?, ?)
        """, (corretora_data["nome"], corretora_data["codigo"], corretora_data["ativa"]))
        corretora_id = cursor.lastrowid
        conn.commit()
    
    return {"id": corretora_id, **corretora_data}


@pytest.fixture
def sample_importacao(db_session, sample_user):
    """Cria uma importação de exemplo"""
    from database import get_db
    
    importacao_data = {
        "usuario_id": sample_user.id,
        "nome_arquivo": "operacoes_teste.json",
        "nome_arquivo_original": "operacoes_teste.json",
        "tamanho_arquivo": 1024,
        "data_importacao": datetime.now(),
        "total_operacoes_arquivo": 5,
        "total_operacoes_importadas": 5,
        "total_operacoes_duplicadas": 0,
        "total_operacoes_erro": 0,
        "status": "concluida",
        "hash_arquivo": "abc123",
        "tempo_processamento_ms": 1500
    }
    
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO importacoes (
                usuario_id, nome_arquivo, nome_arquivo_original, tamanho_arquivo,
                data_importacao, total_operacoes_arquivo, total_operacoes_importadas,
                total_operacoes_duplicadas, total_operacoes_erro, status, hash_arquivo,
                tempo_processamento_ms
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            importacao_data["usuario_id"], importacao_data["nome_arquivo"],
            importacao_data["nome_arquivo_original"], importacao_data["tamanho_arquivo"],
            importacao_data["data_importacao"], importacao_data["total_operacoes_arquivo"],
            importacao_data["total_operacoes_importadas"], importacao_data["total_operacoes_duplicadas"],
            importacao_data["total_operacoes_erro"], importacao_data["status"],
            importacao_data["hash_arquivo"], importacao_data["tempo_processamento_ms"]
        ))
        importacao_id = cursor.lastrowid
        conn.commit()
    
    return {"id": importacao_id, **importacao_data}


@pytest.fixture
def sample_operations(db_session, sample_user, sample_stocks, sample_corretora, sample_importacao):
    """Cria operações de exemplo para testes"""
    from database import inserir_operacao
    
    base_date = date(2024, 1, 1)
    operations = []
    
    # Sequência de operações realistas
    operations_data = [
        # Day Trade PETR4
        {"date": base_date, "ticker": "PETR4", "operation": "buy", "quantity": 100, "price": 30.50, "fees": 5.20},
        {"date": base_date, "ticker": "PETR4", "operation": "sell", "quantity": 100, "price": 31.20, "fees": 5.30},
        
        # Swing Trade VALE3 - Compras
        {"date": base_date + timedelta(days=1), "ticker": "VALE3", "operation": "buy", "quantity": 200, "price": 65.80, "fees": 10.50},
        {"date": base_date + timedelta(days=5), "ticker": "VALE3", "operation": "buy", "quantity": 100, "price": 67.20, "fees": 5.80},
        
        # Swing Trade VALE3 - Venda parcial
        {"date": base_date + timedelta(days=10), "ticker": "VALE3", "operation": "sell", "quantity": 150, "price": 69.50, "fees": 8.20},
        
        # Compra ITUB4
        {"date": base_date + timedelta(days=15), "ticker": "ITUB4", "operation": "buy", "quantity": 500, "price": 25.40, "fees": 12.80},
        
        # Day Trade BBAS3
        {"date": base_date + timedelta(days=20), "ticker": "BBAS3", "operation": "buy", "quantity": 300, "price": 45.60, "fees": 15.20},
        {"date": base_date + timedelta(days=20), "ticker": "BBAS3", "operation": "sell", "quantity": 300, "price": 46.80, "fees": 16.10},
        
        # Venda descoberto WEGE3
        {"date": base_date + timedelta(days=25), "ticker": "WEGE3", "operation": "sell", "quantity": 200, "price": 42.30, "fees": 9.80},
        {"date": base_date + timedelta(days=30), "ticker": "WEGE3", "operation": "buy", "quantity": 200, "price": 40.50, "fees": 9.20},
    ]
    
    created_operations = []
    for i, op_data in enumerate(operations_data):
        # Algumas operações são importadas, outras manuais
        importacao_id = sample_importacao["id"] if i < 6 else None
        
        op_data_with_ids = {
            **op_data,
            "corretora_id": sample_corretora["id"] if i % 2 == 0 else None
        }
        
        op_id = inserir_operacao(
            operacao=op_data_with_ids,
            usuario_id=sample_user.id,
            importacao_id=importacao_id
        )
        
        created_operations.append({
            "id": op_id,
            **op_data_with_ids,
            "usuario_id": sample_user.id,
            "importacao_id": importacao_id
        })
    
    return created_operations


# Fixtures para cenários específicos de teste

@pytest.fixture
def day_trade_scenario(db_session, sample_user, sample_stocks):
    """Cenário específico para day trade"""
    from database import inserir_operacao
    
    operations = [
        {"date": date(2024, 1, 15), "ticker": "PETR4", "operation": "buy", "quantity": 1000, "price": 28.50, "fees": 15.20},
        {"date": date(2024, 1, 15), "ticker": "PETR4", "operation": "sell", "quantity": 1000, "price": 29.80, "fees": 16.40},
    ]
    
    created_ops = []
    for op in operations:
        op_id = inserir_operacao(operacao=op, usuario_id=sample_user.id)
        created_ops.append({"id": op_id, **op, "usuario_id": sample_user.id})
    
    return created_ops


@pytest.fixture
def swing_trade_scenario(db_session, sample_user, sample_stocks):
    """Cenário específico para swing trade"""
    from database import inserir_operacao
    
    operations = [
        {"date": date(2024, 1, 10), "ticker": "VALE3", "operation": "buy", "quantity": 300, "price": 60.00, "fees": 12.00},
        {"date": date(2024, 1, 12), "ticker": "VALE3", "operation": "buy", "quantity": 200, "price": 62.50, "fees": 8.50},
        {"date": date(2024, 2, 15), "ticker": "VALE3", "operation": "sell", "quantity": 500, "price": 68.80, "fees": 18.20},
    ]
    
    created_ops = []
    for op in operations:
        op_id = inserir_operacao(operacao=op, usuario_id=sample_user.id)
        created_ops.append({"id": op_id, **op, "usuario_id": sample_user.id})
    
    return created_ops


@pytest.fixture
def short_selling_scenario(db_session, sample_user, sample_stocks):
    """Cenário específico para venda descoberto"""
    from database import inserir_operacao
    
    operations = [
        {"date": date(2024, 1, 20), "ticker": "ITUB4", "operation": "sell", "quantity": 400, "price": 27.30, "fees": 14.80},
        {"date": date(2024, 1, 25), "ticker": "ITUB4", "operation": "buy", "quantity": 400, "price": 25.60, "fees": 13.20},
    ]
    
    created_ops = []
    for op in operations:
        op_id = inserir_operacao(operacao=op, usuario_id=sample_user.id)
        created_ops.append({"id": op_id, **op, "usuario_id": sample_user.id})
    
    return created_ops


@pytest.fixture
def complex_scenario(db_session, sample_user, sample_stocks):
    """Cenário complexo com múltiplas ações e tipos de operação"""
    from database import inserir_operacao
    
    operations = [
        # PETR4 - Day trade com lucro
        {"date": date(2024, 1, 5), "ticker": "PETR4", "operation": "buy", "quantity": 500, "price": 32.00, "fees": 12.80},
        {"date": date(2024, 1, 5), "ticker": "PETR4", "operation": "sell", "quantity": 500, "price": 33.50, "fees": 13.40},
        
        # VALE3 - Swing trade com múltiplas compras
        {"date": date(2024, 1, 8), "ticker": "VALE3", "operation": "buy", "quantity": 200, "price": 58.20, "fees": 9.30},
        {"date": date(2024, 1, 15), "ticker": "VALE3", "operation": "buy", "quantity": 300, "price": 60.80, "fees": 14.60},
        {"date": date(2024, 2, 10), "ticker": "VALE3", "operation": "sell", "quantity": 250, "price": 65.40, "fees": 13.10},
        
        # ITUB4 - Venda descoberto
        {"date": date(2024, 1, 12), "ticker": "ITUB4", "operation": "sell", "quantity": 600, "price": 26.70, "fees": 12.80},
        {"date": date(2024, 1, 18), "ticker": "ITUB4", "operation": "buy", "quantity": 600, "price": 24.90, "fees": 11.90},
        
        # BBAS3 - Day trade com prejuízo
        {"date": date(2024, 1, 22), "ticker": "BBAS3", "operation": "buy", "quantity": 400, "price": 48.50, "fees": 15.50},
        {"date": date(2024, 1, 22), "ticker": "BBAS3", "operation": "sell", "quantity": 400, "price": 47.20, "fees": 15.10},
    ]
    
    created_ops = []
    for op in operations:
        op_id = inserir_operacao(operacao=op, usuario_id=sample_user.id)
        created_ops.append({"id": op_id, **op, "usuario_id": sample_user.id})
    
    return created_ops