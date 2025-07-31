def migrar_operacoes_fechadas():
    """
    Adiciona colunas na tabela operacoes_fechadas se não existirem, de forma segura para SQLite.
    Exemplo de uso: migrar_operacoes_fechadas() ao iniciar o app.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        # Descobre as colunas existentes
        cursor.execute("PRAGMA table_info(operacoes_fechadas)")
        colunas = [row[1] for row in cursor.fetchall()]

        # Defina aqui as colunas que deseja garantir na tabela
        colunas_necessarias = [
            ("preco_medio_compra", "REAL"),
            ("preco_medio_venda", "REAL"),
            ("status_ir", "TEXT")
        ]

        for nome_col, tipo_col in colunas_necessarias:
            if nome_col not in colunas:
                try:
                    cursor.execute(f"ALTER TABLE operacoes_fechadas ADD COLUMN {nome_col} {tipo_col}")
                except Exception as e:
                    print(f"[DB MIGRATION] Erro ao adicionar coluna {nome_col}: {e}")
        conn.commit()

def migrar_resultados_mensais():
    """
    Adiciona a coluna irrf_swing na tabela resultados_mensais se não existir.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        # Verifica se a coluna irrf_swing já existe
        cursor.execute("PRAGMA table_info(resultados_mensais)")
        colunas = [row[1] for row in cursor.fetchall()]
        
        if "irrf_swing" not in colunas:
            try:
                cursor.execute("ALTER TABLE resultados_mensais ADD COLUMN irrf_swing REAL DEFAULT 0.0")
                print("[DB MIGRATION] Coluna irrf_swing adicionada à tabela resultados_mensais")
                conn.commit()
            except Exception as e:
                print(f"[DB MIGRATION] Erro ao adicionar coluna irrf_swing: {e}")
        else:
            print("[DB MIGRATION] Coluna irrf_swing ja existe")

def migrar_acoes_logo():
    """
    Adiciona a coluna logo na tabela acoes se não existir.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        # Verifica se a coluna logo já existe
        cursor.execute("PRAGMA table_info(acoes)")
        colunas = [row[1] for row in cursor.fetchall()]
        
        if "logo" not in colunas:
            try:
                cursor.execute("ALTER TABLE acoes ADD COLUMN logo TEXT")
                print("[DB MIGRATION] Coluna logo adicionada à tabela acoes")
                conn.commit()
            except Exception as e:
                print(f"[DB MIGRATION] Erro ao adicionar coluna logo: {e}")
        else:
            print("[DB MIGRATION] Coluna logo ja existe")

def migrar_feedback_usuario():
    """
    Cria a tabela feedback_usuario se não existir.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        # Verifica se a tabela já existe
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='feedback_usuario'")
        exists = cursor.fetchone()
        
        if not exists:
            try:
                cursor.execute("""
                    CREATE TABLE feedback_usuario (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        usuario_id INTEGER NOT NULL,
                        categoria VARCHAR(50) NOT NULL DEFAULT 'geral',
                        pagina_atual VARCHAR(100),
                        mensagem TEXT(1000) NOT NULL,
                        prioridade VARCHAR(10) DEFAULT 'media',
                        data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        status VARCHAR(20) DEFAULT 'pendente',
                        FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
                    )
                """)
                print("[DB MIGRATION] Tabela feedback_usuario criada com sucesso")
                conn.commit()
            except Exception as e:
                print(f"[DB MIGRATION] Erro ao criar tabela feedback_usuario: {e}")
        else:
            print("[DB MIGRATION] Tabela feedback_usuario ja existe")
import sqlite3
from datetime import date, datetime
from contextlib import contextmanager
from typing import Dict, List, Any, Optional
import hashlib
import time
import logging
# Unused imports json, Union, defaultdict removed

# Caminho para o banco de dados SQLite
DATABASE_FILE = "acoes_ir.db"  # Arquivo no diretório atual (backend)

def obter_acao_info_por_ticker(ticker: str) -> Optional[Dict[str, Any]]:
    """
    Obtém informações de uma ação (ticker, nome, cnpj) pelo ticker.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        # Seleciona ticker, nome, cnpj da tabela acoes
        cursor.execute("SELECT ticker, nome, cnpj FROM acoes WHERE ticker = ?", (ticker,))
        row = cursor.fetchone()
        return dict(row) if row else None


# Convert datetime.date objects to ISO format string (YYYY-MM-DD) when writing to DB
sqlite3.register_adapter(date, lambda val: val.isoformat())

# Convert DATE column string (YYYY-MM-DD) from DB to datetime.date objects when reading
sqlite3.register_converter("date", lambda val: datetime.strptime(val.decode(), "%Y-%m-%d").date())



@contextmanager
def get_db():
    """
    Contexto para conexão com o banco de dados.
    """
    conn = sqlite3.connect(DATABASE_FILE, detect_types=sqlite3.PARSE_DECLTYPES|sqlite3.PARSE_COLNAMES)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

def criar_tabelas():
    """
    Cria as tabelas necessárias para a aplicação, usando o schema final.
    Esta versão é simplificada para ser idempotente e segura para testes.
    """
    schema = """
    CREATE TABLE IF NOT EXISTS acoes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticker TEXT NOT NULL UNIQUE,
        nome TEXT,
        razao_social TEXT,
        cnpj TEXT,
        ri TEXT,
        classificacao TEXT,
        isin TEXT,
        logo TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_acoes_ticker ON acoes(ticker);

    CREATE TABLE IF NOT EXISTS operacoes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date DATE NOT NULL,
        ticker TEXT NOT NULL,
        operation TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        price REAL NOT NULL,
        fees REAL NOT NULL DEFAULT 0.0,
        usuario_id INTEGER,
        corretora_id INTEGER,
        importacao_id INTEGER,
        FOREIGN KEY(corretora_id) REFERENCES corretoras(id),
        FOREIGN KEY(importacao_id) REFERENCES importacoes(id)
    );
    CREATE INDEX IF NOT EXISTS idx_operacoes_usuario_id ON operacoes(usuario_id);
    CREATE INDEX IF NOT EXISTS idx_operacoes_ticker ON operacoes(ticker);
    CREATE INDEX IF NOT EXISTS idx_operacoes_date ON operacoes(date);

    CREATE TABLE IF NOT EXISTS resultados_mensais (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mes TEXT NOT NULL,
        vendas_swing REAL DEFAULT 0.0,
        custo_swing REAL DEFAULT 0.0,
        ganho_liquido_swing REAL DEFAULT 0.0,
        isento_swing INTEGER DEFAULT 0,
        irrf_swing REAL DEFAULT 0.0,
        ir_devido_swing REAL DEFAULT 0.0,
        ir_pagar_swing REAL DEFAULT 0.0,
        darf_codigo_swing TEXT,
        darf_competencia_swing TEXT,
        darf_valor_swing REAL,
        darf_vencimento_swing DATE,
        status_darf_swing_trade TEXT,
        vendas_day_trade REAL DEFAULT 0.0,
        custo_day_trade REAL DEFAULT 0.0,
        ganho_liquido_day REAL DEFAULT 0.0,
        ir_devido_day REAL DEFAULT 0.0,
        irrf_day REAL DEFAULT 0.0,
        ir_pagar_day REAL DEFAULT 0.0,
        darf_codigo_day TEXT,
        darf_competencia_day TEXT,
        darf_valor_day REAL,
        darf_vencimento_day DATE,
        status_darf_day_trade TEXT,
        prejuizo_acumulado_swing REAL DEFAULT 0.0,
        prejuizo_acumulado_day REAL DEFAULT 0.0,
        usuario_id INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_resultados_mensais_usuario_id ON resultados_mensais(usuario_id);

    CREATE TABLE IF NOT EXISTS carteira_atual (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticker TEXT NOT NULL,
        quantidade INTEGER NOT NULL,
        custo_total REAL NOT NULL,
        preco_medio REAL NOT NULL,
        usuario_id INTEGER,
        preco_editado_pelo_usuario BOOLEAN DEFAULT 0,
        UNIQUE(ticker, usuario_id)
    );
    CREATE INDEX IF NOT EXISTS idx_carteira_atual_usuario_id ON carteira_atual(usuario_id);

    CREATE TABLE IF NOT EXISTS operacoes_fechadas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        data_abertura DATE NOT NULL,
        data_fechamento DATE NOT NULL,
        ticker TEXT NOT NULL,
        quantidade INTEGER NOT NULL,
        valor_compra REAL NOT NULL,
        valor_venda REAL NOT NULL,
        resultado REAL NOT NULL,
        percentual_lucro REAL NOT NULL,
        day_trade BOOLEAN DEFAULT 0,
        usuario_id INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_operacoes_fechadas_usuario_id ON operacoes_fechadas(usuario_id);

    CREATE TABLE IF NOT EXISTS proventos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        id_acao INTEGER,
        tipo TEXT,
        valor REAL,
        data_registro DATE,
        data_ex DATE,
        dt_pagamento DATE,
        FOREIGN KEY(id_acao) REFERENCES acoes(id)
    );
    CREATE INDEX IF NOT EXISTS idx_proventos_id_acao ON proventos(id_acao);

    CREATE TABLE IF NOT EXISTS eventos_corporativos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        id_acao INTEGER NOT NULL,
        evento TEXT NOT NULL,
        data_aprovacao DATE,
        data_registro DATE,
        data_ex DATE,
        razao TEXT,
        FOREIGN KEY(id_acao) REFERENCES acoes(id)
    );
    CREATE INDEX IF NOT EXISTS idx_eventos_corporativos_id_acao ON eventos_corporativos(id_acao);

    CREATE TABLE IF NOT EXISTS usuario_proventos_recebidos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER NOT NULL,
        provento_global_id INTEGER NOT NULL,
        id_acao INTEGER NOT NULL,
        ticker_acao TEXT NOT NULL,
        nome_acao TEXT,
        tipo_provento TEXT NOT NULL,
        data_ex DATE NOT NULL,
        dt_pagamento DATE,
        valor_unitario_provento REAL NOT NULL,
        quantidade_possuida_na_data_ex INTEGER NOT NULL,
        valor_total_recebido REAL NOT NULL,
        data_calculo DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(usuario_id) REFERENCES usuarios(id),
        FOREIGN KEY(provento_global_id) REFERENCES proventos(id),
        FOREIGN KEY(id_acao) REFERENCES acoes(id)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_usr_prov_rec_usr_prov_glob ON usuario_proventos_recebidos(usuario_id, provento_global_id);

    CREATE TABLE IF NOT EXISTS corretoras (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        cnpj TEXT UNIQUE
    );

    CREATE TABLE IF NOT EXISTS importacoes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER NOT NULL,
        nome_arquivo TEXT NOT NULL,
        nome_arquivo_original TEXT,
        tamanho_arquivo INTEGER,
        data_importacao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        total_operacoes_arquivo INTEGER NOT NULL,
        total_operacoes_importadas INTEGER NOT NULL DEFAULT 0,
        total_operacoes_duplicadas INTEGER NOT NULL DEFAULT 0,
        total_operacoes_erro INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'em_andamento',
        hash_arquivo TEXT,
        observacoes TEXT,
        tempo_processamento_ms INTEGER,
        FOREIGN KEY(usuario_id) REFERENCES usuarios(id)
    );
    CREATE INDEX IF NOT EXISTS idx_importacoes_usuario_id ON importacoes(usuario_id);

    CREATE TABLE IF NOT EXISTS historico_preco_medio (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticker TEXT NOT NULL,
        usuario_id INTEGER NOT NULL,
        preco_medio_anterior REAL NOT NULL,
        preco_medio_novo REAL NOT NULL,
        data_alteracao TEXT NOT NULL,
        observacao TEXT,
        FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS cotacao_acoes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        acao_id INTEGER NOT NULL,
        data DATE NOT NULL,
        abertura DECIMAL(10,2),
        maxima DECIMAL(10,2),
        minima DECIMAL(10,2),
        fechamento DECIMAL(10,2),
        fechamento_ajustado DECIMAL(10,2),
        volume BIGINT,
        dividendos DECIMAL(10,4),
        splits DECIMAL(10,4),
        FOREIGN KEY (acao_id) REFERENCES acoes(id),
        UNIQUE(acao_id, data)
    );
    CREATE INDEX IF NOT EXISTS idx_cotacao_acao_data ON cotacao_acoes(acao_id, data);
    CREATE INDEX IF NOT EXISTS idx_cotacao_data ON cotacao_acoes(data);
    CREATE INDEX IF NOT EXISTS idx_cotacao_acao_id ON cotacao_acoes(acao_id);
    
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.executescript(schema)
        conn.commit()
    # Garante que a tabela operacoes_fechadas tenha as colunas extras necessárias
    migrar_operacoes_fechadas()
    
    


def inserir_operacao(operacao: Dict[str, Any], usuario_id: Optional[int] = None, importacao_id: Optional[int] = None) -> int:
    """
    Insere uma operação no banco de dados.
    Verifica se o ticker da operação existe na tabela `acoes`.
    
    Args:
        operacao: Dicionário com os dados da operação.
        usuario_id: ID do usuário que está criando a operação (opcional).
        importacao_id: ID da importação de origem (opcional).
        
    Returns:
        int: ID da operação inserida.

    Raises:
        ValueError: Se o ticker não for encontrado na tabela `acoes`.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Verifica se o ticker existe na tabela acoes
        ticker_value = operacao["ticker"]
        cursor.execute("SELECT 1 FROM acoes WHERE ticker = ?", (ticker_value,))
        if cursor.fetchone() is None:
            raise ValueError(f"Ticker {ticker_value} não encontrado na tabela de ações (acoes).")

        # Adiciona usuario_id, corretora_id e importacao_id ao INSERT
        cursor.execute('''
        INSERT INTO operacoes (date, ticker, operation, quantity, price, fees, usuario_id, corretora_id, importacao_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            operacao["date"].isoformat() if isinstance(operacao["date"], (datetime, date)) else operacao["date"],
            operacao["ticker"],
            operacao["operation"],
            operacao["quantity"],
            operacao["price"],
            operacao.get("fees", 0.0),
            usuario_id, # Garante que usuario_id seja passado
            operacao.get("corretora_id"), # Pode ser None
            importacao_id  # NOVA LINHA ADICIONADA
        ))
        
        conn.commit()
        return cursor.lastrowid

def obter_operacao_por_id(operacao_id: int, usuario_id: int) -> Optional[Dict[str, Any]]:
    """
    Obtém uma operação pelo ID e usuario_id, incluindo informações de importação.
    
    Args:
        operacao_id: ID da operação.
        usuario_id: ID do usuário.
        
    Returns:
        Optional[Dict[str, Any]]: Dados da operação ou None se não encontrada.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        
        cursor.execute('''
        SELECT o.id, o.date, o.ticker, o.operation, o.quantity, o.price, o.fees, o.usuario_id, o.importacao_id,
               i.data_importacao, i.nome_arquivo_original
        FROM operacoes o
        LEFT JOIN importacoes i ON o.importacao_id = i.id
        WHERE o.id = ? AND o.usuario_id = ?
        ''', (operacao_id, usuario_id))
        
        operacao = cursor.fetchone()
        
        if not operacao:
            return None
        
        return {
            "id": operacao["id"],
            "date": datetime.fromisoformat(operacao["date"].split("T")[0]).date() if isinstance(operacao["date"], str) else operacao["date"], # Standardize to date object
            "ticker": operacao["ticker"],
            "operation": operacao["operation"],
            "quantity": operacao["quantity"],
            "price": operacao["price"],
            "fees": operacao["fees"],
            "usuario_id": operacao["usuario_id"],
            "importacao_id": operacao["importacao_id"],
            "data_importacao": operacao["data_importacao"],
            "nome_arquivo_original": operacao["nome_arquivo_original"]
        }

def obter_todas_operacoes(usuario_id: int) -> List[Dict[str, Any]]:
    """
    Obtém todas as operações de um usuário específico, incluindo o nome da corretora e informações de importação.
    
    Args:
        usuario_id: ID do usuário para filtrar operações.
        
    Returns:
        List[Dict[str, Any]]: Lista de operações.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        # Agora faz join com corretoras e importacoes
        query = '''
        SELECT o.id, o.date, o.ticker, o.operation, o.quantity, o.price, o.fees, o.usuario_id, o.corretora_id, o.importacao_id,
               c.nome as corretora_nome,
               i.data_importacao, i.nome_arquivo_original
        FROM operacoes o
        LEFT JOIN corretoras c ON o.corretora_id = c.id
        LEFT JOIN importacoes i ON o.importacao_id = i.id
        WHERE o.usuario_id = ?
        ORDER BY o.date ASC, o.id ASC
        '''
        cursor.execute(query, (usuario_id,))
        operacoes = []
        for operacao in cursor.fetchall():
            operacoes.append({
                "id": operacao["id"],
                "date": datetime.fromisoformat(operacao["date"].split("T")[0]).date() if isinstance(operacao["date"], str) else operacao["date"],
                "ticker": operacao["ticker"],
                "operation": operacao["operation"],
                "quantity": operacao["quantity"],
                "price": operacao["price"],
                "fees": operacao["fees"],
                "usuario_id": operacao["usuario_id"],
                "corretora_id": operacao["corretora_id"],
                "corretora_nome": operacao["corretora_nome"],
                "importacao_id": operacao["importacao_id"],
                "data_importacao": operacao["data_importacao"],
                "nome_arquivo_original": operacao["nome_arquivo_original"]
            })
        return operacoes

def obter_tickers_operados_por_usuario(usuario_id: int) -> List[str]:
    """
    Obtém uma lista de tickers distintos operados por um usuário.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT DISTINCT ticker
            FROM operacoes
            WHERE usuario_id = ?
            ORDER BY ticker
        ''', (usuario_id,))
        rows = cursor.fetchall()
        return [row['ticker'] for row in rows]

def atualizar_operacao(operacao_id: int, operacao: Dict[str, Any], usuario_id: Optional[int] = None) -> bool:
    """
    Atualiza uma operação.
    
    Args:
        operacao_id: ID da operação.
        operacao: Dicionário com os novos dados.
        usuario_id: ID do usuário para verificação de permissão (opcional).
        
    Returns:
        bool: True se a operação foi atualizada, False caso contrário.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Verifica se a operação existe e pertence ao usuário
        cursor.execute('''
        SELECT id FROM operacoes
        WHERE id = ? AND usuario_id = ?
        ''', (operacao_id, usuario_id))
        
        if not cursor.fetchone():
            return False # Operação não encontrada ou não pertence ao usuário
        
        cursor.execute('''
        UPDATE operacoes
        SET date = ?, ticker = ?, operation = ?, quantity = ?, price = ?, fees = ?
        WHERE id = ? AND usuario_id = ? 
        ''', (
            operacao["date"].isoformat() if isinstance(operacao["date"], (datetime, date)) else operacao["date"],
            operacao["ticker"],
            operacao["operation"],
            operacao["quantity"],
            operacao["price"],
            operacao.get("fees", 0.0),
            operacao_id,
            usuario_id # Garante que a atualização seja no registro do usuário
        ))
        
        conn.commit()
        
        return cursor.rowcount > 0

def remover_operacao(operacao_id: int, usuario_id: int) -> bool:
    """
    Remove uma operação de um usuário específico.
    
    Args:
        operacao_id: ID da operação.
        usuario_id: ID do usuário.
        
    Returns:
        bool: True se a operação foi removida, False caso contrário.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Remove a operação apenas se pertencer ao usuário
        cursor.execute('DELETE FROM operacoes WHERE id = ? AND usuario_id = ?', (operacao_id, usuario_id))
        
        conn.commit()
        
        return cursor.rowcount > 0

# Comment about duplicate function already removed as the function itself was removed in prior step.

def atualizar_carteira(ticker: str, quantidade: int, preco_medio: float, custo_total: float, usuario_id: int, preco_editado_pelo_usuario: bool = False) -> None:
    """
    Atualiza ou insere um item na carteira atual de um usuário.
    
    Args:
        ticker: Código da ação.
        quantidade: Quantidade de ações.
        preco_medio: Preço médio das ações.
        custo_total: Custo total da posição.
        usuario_id: ID do usuário.
        preco_editado_pelo_usuario: Flag indicando se o preço foi editado manualmente pelo usuário.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Usa INSERT OR REPLACE para simplificar (considerando UNIQUE(ticker, usuario_id))
        # A tabela carteira_atual já deve ter a restrição UNIQUE(ticker, usuario_id)
        # e a coluna usuario_id, conforme definido em criar_tabelas e auth.modificar_tabelas_existentes
        cursor.execute('''
        INSERT OR REPLACE INTO carteira_atual (ticker, quantidade, custo_total, preco_medio, usuario_id, preco_editado_pelo_usuario)
        VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            ticker,
            quantidade,
            custo_total,
            preco_medio,
            usuario_id,
            preco_editado_pelo_usuario
        ))
        
        conn.commit()
        
def obter_carteira_atual(usuario_id: int) -> List[Dict[str, Any]]:
    """
    Obtém a carteira atual de ações de um usuário.
    
    Args:
        usuario_id: ID do usuário.
        
    Returns:
        List[Dict[str, Any]]: Lista de itens da carteira.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Modificado para incluir o nome da ação da tabela 'acoes' e o flag de edição
        query = """
        SELECT
            ca.ticker,
            ca.quantidade,
            ca.custo_total,
            ca.preco_medio,
            ca.preco_editado_pelo_usuario,
            a.nome
        FROM carteira_atual ca
        LEFT JOIN acoes a ON ca.ticker = a.ticker
        WHERE ca.usuario_id = ? AND ca.quantidade <> 0
        ORDER BY ca.ticker
        """
        cursor.execute(query, (usuario_id,))
        
        # Converte os resultados para dicionários
        carteira = [dict(row) for row in cursor.fetchall()]
        
        return carteira

def salvar_resultado_mensal(resultado: Dict[str, Any], usuario_id: int) -> int:
    """
    Salva um resultado mensal no banco de dados para um usuário.
    
    Args:
        resultado: Dicionário com os dados do resultado mensal.
        usuario_id: ID do usuário.
        
    Returns:
        int: ID do resultado inserido ou atualizado.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Verifica se já existe um resultado para o mês e usuário
        cursor.execute('SELECT id FROM resultados_mensais WHERE mes = ? AND usuario_id = ?', 
                       (resultado["mes"], usuario_id))
        existente = cursor.fetchone()
        
        darf_vencimento_iso = None
        if resultado.get("darf_vencimento"):
            if isinstance(resultado["darf_vencimento"], (datetime, date)):
                darf_vencimento_iso = resultado["darf_vencimento"].isoformat()
            else: # Assume que já é uma string no formato ISO
                darf_vencimento_iso = resultado["darf_vencimento"]

        if existente:
            # Se já existe, atualiza
            cursor.execute('''
            UPDATE resultados_mensais
            SET mes = ?, 
                vendas_swing = ?, custo_swing = ?, ganho_liquido_swing = ?, isento_swing = ?,
                irrf_swing = ?, ir_devido_swing = ?, ir_pagar_swing = ?, darf_codigo_swing = ?, darf_competencia_swing = ?,
                darf_valor_swing = ?, darf_vencimento_swing = ?, status_darf_swing_trade = ?,
                vendas_day_trade = ?, custo_day_trade = ?, ganho_liquido_day = ?, ir_devido_day = ?,
                irrf_day = ?, ir_pagar_day = ?, darf_codigo_day = ?, darf_competencia_day = ?,
                darf_valor_day = ?, darf_vencimento_day = ?, status_darf_day_trade = ?,
                prejuizo_acumulado_swing = ?, prejuizo_acumulado_day = ?
            WHERE id = ? AND usuario_id = ? 
            ''', (
                resultado["mes"], 
                resultado["vendas_swing"], resultado["custo_swing"], resultado["ganho_liquido_swing"],
                1 if resultado["isento_swing"] else 0,
                resultado.get("irrf_swing", 0), resultado["ir_devido_swing"], resultado["ir_pagar_swing"],
                resultado.get("darf_codigo_swing"), resultado.get("darf_competencia_swing"),
                resultado.get("darf_valor_swing"), 
                resultado.get("darf_vencimento_swing").isoformat() if resultado.get("darf_vencimento_swing") else None,
                resultado.get("status_darf_swing_trade"),
                resultado["vendas_day_trade"], resultado["custo_day_trade"], resultado["ganho_liquido_day"],
                resultado["ir_devido_day"], resultado["irrf_day"], resultado["ir_pagar_day"],
                resultado.get("darf_codigo_day"), resultado.get("darf_competencia_day"),
                resultado.get("darf_valor_day"),
                resultado.get("darf_vencimento_day").isoformat() if resultado.get("darf_vencimento_day") else None,
                resultado.get("status_darf_day_trade"),
                resultado["prejuizo_acumulado_swing"], resultado["prejuizo_acumulado_day"],
                existente["id"], 
                usuario_id
            ))
            conn.commit()
            return existente["id"]
        else:
            # Se não existe, insere
            # Note: The old generic darf_codigo, darf_competencia, darf_valor, darf_vencimento columns are omitted here
            # as they are replaced by specific _swing and _day versions in the new model.
            # Also, darf_swing_trade_valor and darf_day_trade_valor are omitted as they are redundant.
            cursor.execute('''
            INSERT INTO resultados_mensais (
                mes, vendas_swing, custo_swing, ganho_liquido_swing, isento_swing,
                irrf_swing, ir_devido_swing, ir_pagar_swing, darf_codigo_swing, darf_competencia_swing,
                darf_valor_swing, darf_vencimento_swing, status_darf_swing_trade,
                vendas_day_trade, custo_day_trade, ganho_liquido_day, ir_devido_day,
                irrf_day, ir_pagar_day, darf_codigo_day, darf_competencia_day,
                darf_valor_day, darf_vencimento_day, status_darf_day_trade,
                prejuizo_acumulado_swing, prejuizo_acumulado_day, usuario_id
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                resultado["mes"], resultado["vendas_swing"], resultado["custo_swing"], resultado["ganho_liquido_swing"],
                1 if resultado["isento_swing"] else 0,
                resultado.get("irrf_swing", 0), resultado["ir_devido_swing"], resultado["ir_pagar_swing"],
                resultado.get("darf_codigo_swing"), resultado.get("darf_competencia_swing"),
                resultado.get("darf_valor_swing"),
                resultado.get("darf_vencimento_swing").isoformat() if resultado.get("darf_vencimento_swing") else None,
                resultado.get("status_darf_swing_trade"),
                resultado["vendas_day_trade"], resultado["custo_day_trade"], resultado["ganho_liquido_day"],
                resultado["ir_devido_day"], resultado["irrf_day"], resultado["ir_pagar_day"],
                resultado.get("darf_codigo_day"), resultado.get("darf_competencia_day"),
                resultado.get("darf_valor_day"),
                resultado.get("darf_vencimento_day").isoformat() if resultado.get("darf_vencimento_day") else None,
                resultado.get("status_darf_day_trade"),
                resultado["prejuizo_acumulado_swing"], resultado["prejuizo_acumulado_day"], usuario_id
            ))
            
            conn.commit()
            return cursor.lastrowid
        
def obter_resultados_mensais(usuario_id: int) -> List[Dict[str, Any]]:
    """
    Obtém todos os resultados mensais de um usuário do banco de dados.
    
    Args:
        usuario_id: ID do usuário.
        
    Returns:
        List[Dict[str, Any]]: Lista de resultados mensais.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM resultados_mensais WHERE usuario_id = ? ORDER BY mes', (usuario_id,))
        
        # Converte os resultados para dicionários
        resultados = []
        for row in cursor.fetchall():
            resultado = dict(row)
            resultado["isento_swing"] = bool(resultado["isento_swing"])
            if resultado["darf_vencimento"]:
                # Tenta converter de string ISO para date, se necessário
                if isinstance(resultado["darf_vencimento"], str):
                    try:
                        resultado["darf_vencimento"] = datetime.fromisoformat(resultado["darf_vencimento"].split("T")[0]).date()
                    except ValueError: # Se já for YYYY-MM-DD
                        resultado["darf_vencimento"] = datetime.strptime(resultado["darf_vencimento"], "%Y-%m-%d").date()
            resultados.append(resultado)
            
        return resultados

def limpar_banco_dados_usuario(usuario_id: int) -> None:
    """
    Remove todos os dados de um usuário específico do banco de dados.
    Não reseta os contadores de autoincremento globais.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Limpa todas as tabelas relacionadas ao usuário
        cursor.execute('DELETE FROM operacoes WHERE usuario_id = ?', (usuario_id,))
        cursor.execute('DELETE FROM resultados_mensais WHERE usuario_id = ?', (usuario_id,))
        cursor.execute('DELETE FROM carteira_atual WHERE usuario_id = ?', (usuario_id,))
        cursor.execute('DELETE FROM operacoes_fechadas WHERE usuario_id = ?', (usuario_id,)) # Adicionado
        cursor.execute('DELETE FROM historico_preco_medio WHERE usuario_id = ?', (usuario_id,)) # Adicionado
        
        # Não reseta sqlite_sequence aqui, pois é global.
        # Se precisar resetar para um usuário, seria mais complexo e geralmente não é feito.
        
        conn.commit()

def limpar_banco_dados() -> None:
    """
    Remove todos os dados de TODAS as tabelas (usado por admin).
    """
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Limpa todas as tabelas
        cursor.execute('DELETE FROM operacoes')
        cursor.execute('DELETE FROM resultados_mensais')
        cursor.execute('DELETE FROM carteira_atual')
        cursor.execute('DELETE FROM operacoes_fechadas') # Adicionado
        cursor.execute('DELETE FROM historico_preco_medio') # Adicionado
        
        # Reseta os contadores de autoincremento
        cursor.execute('DELETE FROM sqlite_sequence WHERE name IN ("operacoes", "resultados_mensais", "carteira_atual", "operacoes_fechadas", "historico_preco_medio")')
        
        conn.commit()


def obter_operacoes_para_calculo_fechadas(usuario_id: int) -> List[Dict[str, Any]]:
    """
    Obtém operações fechadas para cálculo de IR.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT 
                id, ticker, quantidade, data_abertura, data_fechamento,
                valor_compra, valor_venda,
                resultado, day_trade, percentual_lucro,
                status_ir, preco_medio_compra, preco_medio_venda
            FROM operacoes_fechadas 
            WHERE usuario_id = ?
            ORDER BY data_fechamento, ticker
        ''', (usuario_id,))
        
        resultados = cursor.fetchall()
        operacoes = [dict(row) for row in resultados]
        
        return operacoes


def salvar_operacao_fechada(operacao_fechada_dict: Dict[str, Any], usuario_id: int) -> int:
    """
    Salva uma operação fechada no banco de dados.
    
    Args:
        operacao_fechada_dict: Dicionário com os dados da operação fechada
        usuario_id: ID do usuário
        
    Returns:
        int: ID da operação fechada inserida
    """
    import logging
    
    # Garantir que day_trade seja tratado corretamente
    day_trade_value = operacao_fechada_dict.get('day_trade', False)
    
    # Garantir que data_abertura não seja None
    data_abertura = operacao_fechada_dict.get('data_abertura')
    data_fechamento = operacao_fechada_dict.get('data_fechamento')
    
    if data_abertura is None:
        data_abertura = data_fechamento
    
    if data_fechamento is None:
        from datetime import date
        data_fechamento = date.today().isoformat()
    
    # Converter datas para string se necessário
    if hasattr(data_abertura, 'isoformat'):
        data_abertura = data_abertura.isoformat()
    if hasattr(data_fechamento, 'isoformat'):
        data_fechamento = data_fechamento.isoformat()
    
    with get_db() as conn:
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO operacoes_fechadas (
                usuario_id,
                ticker,
                data_abertura,
                data_fechamento,
                quantidade,
                valor_compra,
                valor_venda,
                resultado,
                percentual_lucro,
                day_trade,
                status_ir,
                preco_medio_compra,
                preco_medio_venda
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            usuario_id,
            operacao_fechada_dict.get('ticker', ''),
            data_abertura,
            data_fechamento,
            operacao_fechada_dict.get('quantidade', 0),
            operacao_fechada_dict.get('valor_compra', 0.0),
            operacao_fechada_dict.get('valor_venda', 0.0),
            operacao_fechada_dict.get('resultado', 0.0),
            operacao_fechada_dict.get('percentual_lucro', 0.0),
            1 if day_trade_value else 0,
            operacao_fechada_dict.get('status_ir'),
            operacao_fechada_dict.get('preco_medio_compra', 0.0),
            operacao_fechada_dict.get('preco_medio_venda', 0.0)
        ))
        
        new_id = cursor.lastrowid
        conn.commit()
        
        return new_id

def obter_operacoes_fechadas_salvas(usuario_id: int) -> List[Dict[str, Any]]:
    """
    Obtém as operações fechadas já salvas no banco de dados para um usuário.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM operacoes_fechadas WHERE usuario_id = ? ORDER BY data_fechamento", (usuario_id,))
        ops_fechadas = []
        for row in cursor.fetchall():
            op = dict(row)
            if isinstance(op["data_abertura"], str):
                op["data_abertura"] = datetime.fromisoformat(op["data_abertura"].split("T")[0]).date()
            if isinstance(op["data_fechamento"], str):
                op["data_fechamento"] = datetime.fromisoformat(op["data_fechamento"].split("T")[0]).date()
            ops_fechadas.append(op)
        return ops_fechadas

def limpar_operacoes_fechadas_usuario(usuario_id: int) -> None:
    """
    Limpa as operações fechadas de um usuário antes de recalcular.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM operacoes_fechadas WHERE usuario_id = ?", (usuario_id,))
        conn.commit()

def remover_todas_operacoes_usuario(usuario_id: int) -> int:
    """
    Remove todas as operações de um usuário específico do banco de dados.

    Args:
        usuario_id: ID do usuário.

    Returns:
        int: Número de operações removidas.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('DELETE FROM operacoes WHERE usuario_id = ?', (usuario_id,))
        conn.commit()
        return cursor.rowcount

def atualizar_status_darf_db(usuario_id: int, year_month: str, darf_type: str, new_status: str) -> bool:
    """
    Atualiza o status de um DARF específico (swing ou daytrade) para um usuário e mês.

    Args:
        usuario_id: ID do usuário.
        year_month: Mês e ano no formato YYYY-MM.
        darf_type: Tipo de DARF ("swing" or "daytrade").
        new_status: Novo status para o DARF (e.g., 'Pago', 'Pendente').

    Returns:
        bool: True se a atualização foi bem-sucedida (1 linha afetada), False caso contrário.
    """
    if darf_type == "swing":
        status_column_name = "status_darf_swing_trade"
    elif darf_type == "daytrade":
        status_column_name = "status_darf_day_trade"
    else:
        return False # Tipo de DARF inválido

    with get_db() as conn:
        cursor = conn.cursor()
        try:
            # Usar f-string para o nome da coluna é seguro aqui, pois darf_type é validado.
            # No entanto, para valores, sempre use placeholders.
            query = f"UPDATE resultados_mensais SET {status_column_name} = ? WHERE usuario_id = ? AND mes = ?"
            cursor.execute(query, (new_status, usuario_id, year_month))
            conn.commit()
            return cursor.rowcount > 0
        except sqlite3.Error as e:
            # Logar o erro e.g., print(f"Database error: {e}") ou usar logging
            # Considerar se deve propagar o erro ou retornar False
            return False

def limpar_carteira_usuario_db(usuario_id: int) -> None:
    """
    Remove todos os registros da carteira de um usuário específico.

    Args:
        usuario_id: ID do usuário.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        try:
            cursor.execute('DELETE FROM carteira_atual WHERE usuario_id = ?', (usuario_id,))
            conn.commit()
        except sqlite3.Error as e:
            # Logar o erro e.g., print(f"Database error clearing portfolio for user {usuario_id}: {e}")
            # Decidir se deve propagar o erro ou não. Para esta operação,
            # pode ser aceitável não levantar uma exceção se a tabela estiver vazia
            # ou se houver algum problema que não impeça o fluxo principal de recálculo.
            # No entanto, para depuração, o log é importante.
            pass # Silenciosamente continua, mas idealmente logaria.

def limpar_resultados_mensais_usuario_db(usuario_id: int) -> None:
    """
    Remove todos os registros de resultados mensais de um usuário específico.

    Args:
        usuario_id: ID do usuário.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        try:
            cursor.execute('DELETE FROM resultados_mensais WHERE usuario_id = ?', (usuario_id,))
            conn.commit()
        except sqlite3.Error as e:
            # Logar o erro, e.g., print(f"Database error clearing monthly results for user {usuario_id}: {e}")
            # Similar à limpar_carteira_usuario_db, decidir sobre a propagação do erro.
            # O log é importante para a depuração.
            pass # Silenciosamente continua, mas idealmente logaria.

def remover_item_carteira_db(usuario_id: int, ticker: str) -> bool:
    """
    Remove um item específico (ticker) da carteira de um usuário.

    Args:
        usuario_id: ID do usuário.
        ticker: Ticker da ação a ser removida.

    Returns:
        bool: True se o item foi removido (1 linha afetada), False caso contrário.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        try:
            cursor.execute('DELETE FROM carteira_atual WHERE usuario_id = ? AND ticker = ?', (usuario_id, ticker))
            conn.commit()
            return cursor.rowcount > 0
        except sqlite3.Error as e:
            # Logar o erro e.g., print(f"Database error removing item {ticker} for user {usuario_id}: {e}")
            return False

def obter_operacoes_por_ticker_db(usuario_id: int, ticker: str) -> List[Dict[str, Any]]:
    """
    Obtém todas as operações de um usuário para um ticker específico.

    Args:
        usuario_id: ID do usuário.
        ticker: Ticker da ação.

    Returns:
        List[Dict[str, Any]]: Lista de operações para o ticker especificado.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT id, date, ticker, operation, quantity, price, fees, usuario_id
            FROM operacoes 
            WHERE usuario_id = ? AND ticker = ? 
            ORDER BY date
        ''', (usuario_id, ticker))
        
        operacoes = []
        for row in cursor.fetchall():
            operacao_dict = dict(row)
            # Standardize 'date' to date object
            if isinstance(operacao_dict["date"], str):
                try:
                    operacao_dict["date"] = datetime.fromisoformat(operacao_dict["date"].split("T")[0]).date()
                except ValueError: # Handle cases where date might already be YYYY-MM-DD
                    operacao_dict["date"] = datetime.strptime(operacao_dict["date"], "%Y-%m-%d").date()
            elif isinstance(operacao_dict["date"], datetime):
                 operacao_dict["date"] = operacao_dict["date"].date()
            operacoes.append(operacao_dict)
        return operacoes

def obter_operacoes_por_usuario_ticker_ate_data(usuario_id: int, ticker: str, data_ate_str: str) -> List[Dict[str, Any]]: # Renamed function and param
    """
    Obtém todas as operações de um usuário para um ticker específico até uma data específica (inclusive).
    Retorna todos os campos relevantes da operação para que possam ser parseados pelo modelo Operacao do serviço.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        # Adicionado fees e price, operation, date, quantity, id
        # data_ate_str deve estar no formato 'YYYY-MM-DD'
        cursor.execute('''
            SELECT id, date, ticker, operation, quantity, price, fees
            FROM operacoes
            WHERE usuario_id = ? AND ticker = ? AND date <= ?
            ORDER BY date, id
        ''', (usuario_id, ticker, data_ate_str)) # Use data_ate_str directly
        rows = cursor.fetchall()

        operacoes_list = []
        for row in rows:
            op_dict = dict(row)
            # Assegura que 'date' é um objeto date, não string, antes de retornar.
            # O conversor do SQLite já deve fazer isso se a coluna é DATE e detect_types está ativo.
            # Mas uma verificação/conversão explícita pode ser mais robusta se a coluna for TEXT.
            if isinstance(op_dict['date'], str):
                op_dict['date'] = datetime.strptime(op_dict['date'], '%Y-%m-%d').date()
            operacoes_list.append(op_dict)
        return operacoes_list

def obter_operacoes_por_ticker_ate_data_db(usuario_id: int, ticker: str, data_ate: str) -> List[Dict[str, Any]]:
    """
    Obtém operações de um ticker específico para um usuário até uma data específica.
    Retorna apenas os campos 'operation' e 'quantity'.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT date, operation, quantity, id
            FROM operacoes
            WHERE usuario_id = ? AND ticker = ? AND date <= ?
            ORDER BY date, id
        ''', (usuario_id, ticker, data_ate))
        rows = cursor.fetchall()
        # Embora a query selecione mais campos para ordenação e contexto,
        # a descrição original do subtask pedia para retornar dicts com 'operation' e 'quantity'.
        # Para flexibilidade, retornaremos o dict completo da linha.
        # Se for estritamente 'operation' e 'quantity':
        # return [{"operation": row["operation"], "quantity": row["quantity"]} for row in rows]
        return [dict(row) for row in rows]

def obter_id_acao_por_ticker(ticker: str) -> Optional[int]:
    """
    Obtém o ID de uma ação específica pelo seu ticker.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM acoes WHERE ticker = ?", (ticker,))
        row = cursor.fetchone()
        if row:
            return row['id']
        return None

def obter_acao_por_id(id_acao: int) -> Optional[Dict[str, Any]]:
    """
    Obtém uma ação específica pelo seu ID.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, ticker, nome FROM acoes WHERE id = ?", (id_acao,))
        row = cursor.fetchone()
        return dict(row) if row else None

def obter_todas_acoes() -> List[Dict[str, Any]]: # Renamed from obter_todos_stocks
    """
    Obtém todas as ações (stocks) da tabela `acoes`. # Modificado para refletir a nova tabela 'acoes'

    Returns:
        List[Dict[str, Any]]: Lista de dicionários, onde cada dicionário representa uma ação.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        # Modificado para consultar a nova tabela 'acoes' e seus campos
        cursor.execute("SELECT id, ticker, nome, razao_social, cnpj, ri, classificacao, isin FROM acoes ORDER BY ticker")
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

# --- Funções para usuario_proventos_recebidos ---

def limpar_usuario_proventos_recebidos_db(usuario_id: int) -> None:
    """
    Remove todos os proventos recebidos calculados para um usuário específico.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        try:
            cursor.execute('DELETE FROM usuario_proventos_recebidos WHERE usuario_id = ?', (usuario_id,))
            conn.commit()
        except sqlite3.Error as e:
            # Logar o erro e.g., print(f"Database error clearing user received proventos for user {usuario_id}: {e}")
            # Decidir se deve propagar o erro ou não.
            # Para esta operação, pode ser aceitável não levantar uma exceção.
            pass # Silenciosamente continua, mas idealmente logaria.

def inserir_usuario_provento_recebido_db(usuario_id: int, provento_global_id: int, quantidade: float, valor_total: float) -> int:
    """
    Insere um registro de provento recebido por um usuário no banco de dados.
    🚨 PROTEGIDO CONTRA DUPLICATAS com INSERT OR IGNORE.
    """
    from datetime import datetime as dt
    with get_db() as conn:
        cursor = conn.cursor()

        # 🔧 VERIFICAR SE JÁ EXISTS - PREVENÇÃO DE DUPLICATAS
        cursor.execute('''
            SELECT id FROM usuario_proventos_recebidos 
            WHERE usuario_id = ? AND provento_global_id = ? AND quantidade_possuida_na_data_ex = ?
        ''', (usuario_id, provento_global_id, quantidade))
        
        existing = cursor.fetchone()
        if existing:
            return existing['id']  # Retorna ID existente, não insere duplicata

        # Buscar informações do provento global para preencher os campos necessários
        cursor.execute('''SELECT id_acao, tipo, data_ex, dt_pagamento, valor as valor_unitario FROM proventos WHERE id = ?''', (provento_global_id,))
        prov = cursor.fetchone()
        if not prov:
            raise ValueError(f"Provento global com id {provento_global_id} não encontrado.")

        # Buscar ticker e nome da ação na tabela acoes
        cursor.execute('SELECT ticker, nome FROM acoes WHERE id = ?', (prov['id_acao'],))
        acao = cursor.fetchone()
        if not acao:
            raise ValueError(f"Ação com id {prov['id_acao']} não encontrada.")

        # Converter valor_unitario de string com vírgula para float se necessário
        valor_unitario = prov['valor_unitario']
        if isinstance(valor_unitario, str):
            try:
                valor_unitario = float(valor_unitario.replace(',', '.'))
            except (ValueError, AttributeError):
                valor_unitario = 0.0

        campos = [
            'usuario_id', 'provento_global_id', 'id_acao', 'ticker_acao',
            'nome_acao', 'tipo_provento', 'data_ex', 'dt_pagamento',
            'valor_unitario_provento', 'quantidade_possuida_na_data_ex',
            'valor_total_recebido', 'data_calculo'
        ]
        valores = [
            usuario_id,
            provento_global_id,
            prov['id_acao'],
            acao['ticker'],
            acao['nome'],
            prov['tipo'],
            prov['data_ex'],
            prov['dt_pagamento'],
            valor_unitario,  # Usando o valor convertido
            quantidade,
            valor_total,
            dt.now().isoformat()
        ]
        placeholders = ', '.join(['?'] * len(campos))
        try:
            cursor.execute(f'''
                INSERT INTO usuario_proventos_recebidos ({', '.join(campos)})
                VALUES ({placeholders})
            ''', tuple(valores))
            conn.commit()
            return cursor.lastrowid
        except sqlite3.IntegrityError as e:
            raise
        except Exception as e:
            raise

# Mantém a versão antiga para compatibilidade, mas recomenda-se migrar para a nova assinatura
# def inserir_usuario_provento_recebido_db(dados: Dict[str, Any]) -> int:
#     ...
def obter_proventos_recebidos_por_usuario_db(usuario_id: int) -> List[Dict[str, Any]]:
    """
    Obtém todos os proventos recebidos por um usuário, ordenados por data de pagamento e data ex.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM usuario_proventos_recebidos
            WHERE usuario_id = ?
            ORDER BY dt_pagamento DESC, data_ex DESC
        ''', (usuario_id,))
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

def obter_resumo_anual_proventos_recebidos_db(usuario_id: int) -> List[Dict[str, Any]]:
    """
    Obtém um resumo anual dos proventos recebidos por um usuário, agrupados.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT
                SUBSTR(dt_pagamento, 1, 4) as ano_pagamento,
                ticker_acao,
                nome_acao,
                tipo_provento,
                SUM(valor_total_recebido) as total_recebido_ticker_tipo_ano
            FROM usuario_proventos_recebidos
            WHERE usuario_id = ? AND dt_pagamento IS NOT NULL
            GROUP BY ano_pagamento, ticker_acao, nome_acao, tipo_provento
            ORDER BY ano_pagamento DESC, ticker_acao ASC;
        ''', (usuario_id,))
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

def obter_resumo_mensal_proventos_recebidos_db(usuario_id: int, ano: int) -> List[Dict[str, Any]]:
    """
    Obtém um resumo mensal dos proventos recebidos por um usuário para um ano específico, agrupados.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT
                SUBSTR(dt_pagamento, 1, 7) as mes_pagamento, -- YYYY-MM
                ticker_acao,
                nome_acao,
                tipo_provento,
                SUM(valor_total_recebido) as total_recebido_ticker_tipo_mes
            FROM usuario_proventos_recebidos
            WHERE usuario_id = ? AND SUBSTR(dt_pagamento, 1, 4) = ? AND dt_pagamento IS NOT NULL
            GROUP BY mes_pagamento, ticker_acao, nome_acao, tipo_provento
            ORDER BY mes_pagamento DESC, ticker_acao ASC;
        ''', (usuario_id, str(ano)))
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

def obter_resumo_por_acao_proventos_recebidos_db(usuario_id: int) -> List[Dict[str, Any]]:
    """
    Obtém um resumo dos proventos recebidos por um usuário, agrupados por ação e tipo de provento.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT
                ticker_acao,
                nome_acao,
                tipo_provento,
                SUM(valor_total_recebido) as total_recebido_ticker_tipo
            FROM usuario_proventos_recebidos
            WHERE usuario_id = ?
            GROUP BY ticker_acao, nome_acao, tipo_provento
            ORDER BY ticker_acao ASC, tipo_provento ASC;
        ''', (usuario_id,))
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

# Funções para Proventos

def inserir_provento(provento_data: Dict[str, Any]) -> int:
    """
    Ins
    Espera que as datas já estejam no formato YYYY-MM-DD e valor como float.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO proventos (id_acao, tipo, valor, data_registro, data_ex, dt_pagamento)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            provento_data['id_acao'],
            provento_data['tipo'],
            provento_data['valor'],
            provento_data['data_registro'], # Espera YYYY-MM-DD
            provento_data['data_ex'],       # Espera YYYY-MM-DD
            provento_data['dt_pagamento']   # Espera YYYY-MM-DD
        ))
        conn.commit()
        return cursor.lastrowid

def obter_proventos_por_acao_id(id_acao: int) -> List[Dict[str, Any]]:
    """
    Obtém todos os proventos para uma ação específica, ordenados por data_ex e dt_pagamento descendente.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM proventos WHERE id_acao = ? ORDER BY data_ex DESC, dt_pagamento DESC", (id_acao,))
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

def obter_provento_por_id(provento_id: int) -> Optional[Dict[str, Any]]:
    """
    Obtém um provento específico pelo seu ID.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM proventos WHERE id = ?", (provento_id,))
        row = cursor.fetchone()
        return dict(row) if row else None

def obter_todos_proventos() -> List[Dict[str, Any]]:
    """
    Obtém todos os proventos cadastrados, ordenados por data_ex e dt_pagamento descendente.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM proventos ORDER BY data_ex DESC, dt_pagamento DESC")
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

def obter_proventos_por_ticker(ticker: str) -> List[Dict[str, Any]]:
    """
    Obtém todos os proventos para um ticker específico, incluindo nome e ticker da ação,
    ordenados por data_ex e dt_pagamento descendente.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT
                p.id,
                p.id_acao,
                a.ticker as ticker_acao,
                a.nome as nome_acao,
                p.tipo,
                p.valor,
                p.data_registro,
                p.data_ex,
                p.dt_pagamento
            FROM proventos p
            JOIN acoes a ON p.id_acao = a.id
            WHERE a.ticker = ?
            ORDER BY p.data_ex DESC, p.dt_pagamento DESC
        ''', (ticker,))
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

def obter_primeira_data_operacao_usuario(usuario_id: int, ticker: str) -> date | None:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            '''
            SELECT MIN(date) as primeira_data
            FROM operacoes
            WHERE usuario_id = ? AND (ticker = ? OR ticker = ? || 'F')
            ''',
            (usuario_id, ticker, ticker)
        )
        row = cursor.fetchone()
        if row and row["primeira_data"]:
            return date.fromisoformat(row["primeira_data"])
        return None

# Funções para Eventos Corporativos

def inserir_evento_corporativo(evento_data: Dict[str, Any]) -> int:
    """
    Insere um novo evento corporativo no banco de dados.
    Espera que as datas já estejam no formato YYYY-MM-DD ou None.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO eventos_corporativos (id_acao, evento, data_aprovacao, data_registro, data_ex, razao)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            evento_data['id_acao'],
            evento_data['evento'],
            evento_data.get('data_aprovacao'), # Pode ser None
            evento_data.get('data_registro'),  # Pode ser None
            evento_data.get('data_ex'),        # Pode ser None
            evento_data.get('razao')           # Pode ser None
        ))
        conn.commit()
        return cursor.lastrowid

def obter_eventos_corporativos_por_acao_id(id_acao: int) -> List[Dict[str, Any]]:
    """
    Obtém todos os eventos corporativos para uma ação específica,
    ordenados por data_ex e data_registro descendente.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM eventos_corporativos
            WHERE id_acao = ?
            ORDER BY
                CASE WHEN data_ex IS NULL THEN 1 ELSE 0 END, data_ex DESC,
                CASE WHEN data_registro IS NULL THEN 1 ELSE 0 END, data_registro DESC
        """, (id_acao,))
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

def obter_evento_corporativo_por_id(evento_id: int) -> Optional[Dict[str, Any]]:
    """
    Obtém um evento corporativo específico pelo seu ID.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM eventos_corporativos WHERE id = ?", (evento_id,))
        row = cursor.fetchone()
        return dict(row) if row else None

def obter_todos_eventos_corporativos() -> List[Dict[str, Any]]:
    """
    Obtém todos os eventos corporativos cadastrados,
    ordenados por data_ex e data_registro descendente.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM eventos_corporativos
            ORDER BY
                CASE WHEN data_ex IS NULL THEN 1 ELSE 0 END, data_ex DESC,
                CASE WHEN data_registro IS NULL THEN 1 ELSE 0 END, data_registro DESC
        """)
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

def obter_eventos_corporativos_por_id_acao_e_data_ex_anterior_a(id_acao: int, data_limite: date) -> List[Dict[str, Any]]:
    """
    Obtém eventos corporativos para uma ação específica onde data_ex é anterior ou igual à data_limite.
    As datas na tabela eventos_corporativos (data_aprovacao, data_registro, data_ex) são armazenadas como TEXT no formato YYYY-MM-DD.
    A conversão para objetos date é feita automaticamente pelo sqlite3.register_converter se as colunas forem selecionadas com o tipo [date].
    """
    with get_db() as conn:
        cursor = conn.cursor()
        # Formata a data_limite para string 'YYYY-MM-DD' para comparação no SQL
        data_limite_str = data_limite.isoformat()

        # Note: data_aprovacao, data_registro, data_ex são TEXT.
        # O alias "data_ex [date]" etc., instrui o sqlite3 a usar o conversor 'date'.
        query = """
            SELECT
                id,
                id_acao,
                evento,
                data_aprovacao AS "data_aprovacao [date]",
                data_registro AS "data_registro [date]",
                data_ex AS "data_ex [date]",
                razao
            FROM eventos_corporativos
            WHERE id_acao = ?
              AND data_ex IS NOT NULL
              AND data_ex <= ?
            ORDER BY data_ex ASC
        """
        cursor.execute(query, (id_acao, data_limite_str))
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

def inserir_corretora_se_nao_existir(nome: str) -> int:
    """
Insere uma corretora apenas com o nome, se não existir. Retorna o id.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM corretoras WHERE nome = ?", (nome,))
        row = cursor.fetchone()
        if row:
            return row["id"]
        cursor.execute("INSERT INTO corretoras (nome) VALUES (?)", (nome,))
        conn.commit()
        return cursor.lastrowid

def obter_data_primeira_operacao_usuario_ticker(usuario_id: int, ticker: str) -> Optional[date]:
    """
    Retorna a data da primeira operação do usuário para o ticker informado.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT MIN(date) as primeira_data
            FROM operacoes
            WHERE usuario_id = ? AND ticker = ?
        ''', (usuario_id, ticker))
        row = cursor.fetchone()
        if row and row['primeira_data']:
            # Pode vir como string ou date, garantir date
            if isinstance(row['primeira_data'], str):
                return datetime.strptime(row['primeira_data'].split('T')[0], '%Y-%m-%d').date()
            return row['primeira_data']
        return None

# Funções para Importações

def criar_tabela_importacoes():
    """Cria a tabela de importações e adiciona a coluna importacao_id em operacoes"""
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Criar tabela importacoes
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS importacoes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER NOT NULL,
            nome_arquivo TEXT NOT NULL,
            nome_arquivo_original TEXT,
            tamanho_arquivo INTEGER,
            data_importacao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            total_operacoes_arquivo INTEGER NOT NULL,
            total_operacoes_importadas INTEGER NOT NULL DEFAULT 0,
            total_operacoes_duplicadas INTEGER NOT NULL DEFAULT 0,
            total_operacoes_erro INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'em_andamento',
            hash_arquivo TEXT,
            observacoes TEXT,
            tempo_processamento_ms INTEGER,
            FOREIGN KEY(usuario_id) REFERENCES usuarios(id)
        )
        ''')
        
        # Verificar se a coluna importacao_id existe na tabela operacoes
        cursor.execute("PRAGMA table_info(operacoes)")
        colunas = [info[1] for info in cursor.fetchall()]
        
        if 'importacao_id' not in colunas:
            cursor.execute('ALTER TABLE operacoes ADD COLUMN importacao_id INTEGER REFERENCES importacoes(id)')
        
        # Criar índices
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_importacoes_usuario_id ON importacoes(usuario_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_importacoes_data ON importacoes(data_importacao)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_importacoes_status ON importacoes(status)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_importacoes_hash ON importacoes(hash_arquivo)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_operacoes_importacao_id ON operacoes(importacao_id)')
        
        conn.commit()

def calcular_hash_arquivo(conteudo_bytes: bytes) -> str:
    """Calcula hash SHA256 do conteúdo do arquivo"""
    return hashlib.sha256(conteudo_bytes).hexdigest()

def verificar_arquivo_ja_importado(usuario_id: int, hash_arquivo: str) -> Optional[Dict[str, Any]]:
    """Verifica se um arquivo com o mesmo hash já foi importado pelo usuário"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM importacoes 
            WHERE usuario_id = ? AND hash_arquivo = ? AND status = 'concluida'
            ORDER BY data_importacao DESC LIMIT 1
        ''', (usuario_id, hash_arquivo))
        row = cursor.fetchone()
        return dict(row) if row else None

def inserir_importacao(
    usuario_id: int, 
    nome_arquivo: str, 
    total_operacoes_arquivo: int,
    nome_arquivo_original: Optional[str] = None,
    tamanho_arquivo: Optional[int] = None,
    hash_arquivo: Optional[str] = None
) -> int:
    """Registra uma nova importação e retorna o ID"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO importacoes (
                usuario_id, nome_arquivo, nome_arquivo_original, tamanho_arquivo,
                total_operacoes_arquivo, hash_arquivo
            ) VALUES (?, ?, ?, ?, ?, ?)
        ''', (usuario_id, nome_arquivo, nome_arquivo_original, tamanho_arquivo, 
              total_operacoes_arquivo, hash_arquivo))
        conn.commit()
        return cursor.lastrowid

def atualizar_status_importacao(
    importacao_id: int,
    status: str,
    total_importadas: int = 0,
    total_duplicadas: int = 0,
    total_erro: int = 0,
    observacoes: Optional[str] = None,
    tempo_processamento_ms: Optional[int] = None
) -> bool:
    """Atualiza o status e estatísticas de uma importação"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE importacoes SET
                status = ?,
                total_operacoes_importadas = ?,
                total_operacoes_duplicadas = ?,
                total_operacoes_erro = ?,
                observacoes = ?,
                tempo_processamento_ms = ?
            WHERE id = ?
        ''', (status, total_importadas, total_duplicadas, total_erro, 
              observacoes, tempo_processamento_ms, importacao_id))
        conn.commit()
        return cursor.rowcount > 0

def obter_importacao_por_id(importacao_id: int) -> Optional[Dict[str, Any]]:
    """Obtém uma importação pelo ID"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM importacoes WHERE id = ?', (importacao_id,))
        row = cursor.fetchone()
        return dict(row) if row else None

def listar_importacoes_usuario(usuario_id: int, limite: int = 50) -> List[Dict[str, Any]]:
    """Lista as importações de um usuário, ordenadas por data (mais recentes primeiro)"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM importacoes 
            WHERE usuario_id = ? 
            ORDER BY data_importacao DESC 
            LIMIT ?
        ''', (usuario_id, limite))
        return [dict(row) for row in cursor.fetchall()]

def detectar_operacao_duplicada(
    usuario_id: int, 
    data: str, 
    ticker: str, 
    operacao: str, 
    quantidade: int, 
    preco: float,
    tolerancia_preco: float = 0.01
) -> Optional[Dict[str, Any]]:
    """
    Detecta se uma operação já existe no banco de dados
    Considera duplicata se todos os campos principais são iguais
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT id, date, ticker, operation, quantity, price 
            FROM operacoes 
            WHERE usuario_id = ? 
                AND date = ? 
                AND ticker = ? 
                AND operation = ? 
                AND quantity = ?
                AND ABS(price - ?) <= ?
        ''', (usuario_id, data, ticker, operacao, quantidade, preco, tolerancia_preco))
        row = cursor.fetchone()
        return dict(row) if row else None

def obter_operacoes_por_importacao(importacao_id: int) -> List[Dict[str, Any]]:
    """Obtém todas as operações de uma importação específica"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT o.*, i.nome_arquivo_original, i.data_importacao
            FROM operacoes o
            JOIN importacoes i ON o.importacao_id = i.id
            WHERE o.importacao_id = ?
            ORDER BY o.date, o.id
        ''', (importacao_id,))
        return [dict(row) for row in cursor.fetchall()]

def remover_operacoes_por_importacao(importacao_id: int, usuario_id: int) -> int:
    """Remove todas as operações de uma importação específica (para reverter)"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            DELETE FROM operacoes 
            WHERE importacao_id = ? AND usuario_id = ?
        ''', (importacao_id, usuario_id))
        conn.commit()
        return cursor.rowcount

def get_sum_proventos_by_month_for_user(user_id: int, start_date: date, end_date: date) -> List[Dict[str, Any]]:
    """
    Calcula a soma total de proventos recebidos por mês para um usuário dentro de um período.

    Args:
        user_id: ID do usuário.
        start_date: Data de início do período (inclusive).
        end_date: Data de fim do período (inclusive).

    Returns:
        List[Dict[str, Any]]: Lista de dicionários, cada um contendo 'month' (YYYY-MM) e 'total' (float).
    """
    with get_db() as conn:
        cursor = conn.cursor()
        query = """
            SELECT
                strftime('%Y-%m', dt_pagamento) as month,
                SUM(valor_total_recebido) as total
            FROM usuario_proventos_recebidos
            WHERE usuario_id = ?
              AND dt_pagamento >= ?
              AND dt_pagamento <= ?
              AND dt_pagamento IS NOT NULL
            GROUP BY month
            ORDER BY month ASC;
        """
        # Convert date objects to ISO format strings for the query
        start_date_str = start_date.isoformat()
        end_date_str = end_date.isoformat()

        cursor.execute(query, (user_id, start_date_str, end_date_str))
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

def analisar_duplicatas_usuario(usuario_id: int) -> List[Dict[str, Any]]:
    """
    Analisa todas as operações de um usuário para encontrar possíveis duplicatas.
    Retorna grupos de operações que podem ser duplicatas.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        # Busca operações agrupadas por características similares
        cursor.execute('''
            SELECT 
                ticker, date, operation, quantity, price, fees,
                GROUP_CONCAT(id) as ids,
                GROUP_CONCAT(importacao_id) as importacao_ids,
                COUNT(*) as count
            FROM operacoes 
            WHERE usuario_id = ?
            GROUP BY ticker, date, operation, quantity, price, fees
            HAVING COUNT(*) > 1
            ORDER BY date DESC, ticker
        ''', (usuario_id,))
        
        grupos_duplicatas = []
        for row in cursor.fetchall():
            ids = [int(id_str) for id_str in row["ids"].split(",")]
            importacao_ids = [int(imp_id) if imp_id else None for imp_id in row["importacao_ids"].split(",")]
            
            # Busca detalhes completos de cada operação duplicata
            operacoes_detalhes = []
            for op_id in ids:
                cursor.execute('''
                    SELECT o.*, i.nome_arquivo_original, i.data_importacao
                    FROM operacoes o
                    LEFT JOIN importacoes i ON o.importacao_id = i.id
                    WHERE o.id = ?
                ''', (op_id,))
                op_detalhe = cursor.fetchone()
                if op_detalhe:
                    operacoes_detalhes.append(dict(op_detalhe))
            
            grupos_duplicatas.append({
                "ticker": row["ticker"],
                "date": row["date"],
                "operation": row["operation"],
                "quantity": row["quantity"],
                "price": row["price"],
                "fees": row["fees"],
                "count": row["count"],
                "operacoes": operacoes_detalhes
            })
        
        return grupos_duplicatas

def verificar_estrutura_importacao() -> Dict[str, Any]:
    """
    Verifica se a tabela importacoes e coluna importacao_id existem.
    Função temporária para debug.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Verifica se tabela importacoes existe
        cursor.execute('''
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='importacoes'
        ''')
        tabela_importacoes_existe = cursor.fetchone() is not None
        
        # Verifica se coluna importacao_id existe na tabela operacoes
        cursor.execute("PRAGMA table_info(operacoes)")
        colunas_operacoes = [col[1] for col in cursor.fetchall()]
        coluna_importacao_id_existe = 'importacao_id' in colunas_operacoes
        
        # Conta registros nas tabelas
        cursor.execute("SELECT COUNT(*) as count FROM operacoes")
        total_operacoes = cursor.fetchone()["count"]
        
        total_importacoes = 0
        if tabela_importacoes_existe:
            cursor.execute("SELECT COUNT(*) as count FROM importacoes")
            total_importacoes = cursor.fetchone()["count"]
        
        return {
            "tabela_importacoes_existe": tabela_importacoes_existe,
            "coluna_importacao_id_existe": coluna_importacao_id_existe,
            "total_operacoes": total_operacoes,
            "total_importacoes": total_importacoes,
            "colunas_operacoes": colunas_operacoes
        }

def limpar_importacoes_usuario(usuario_id: int) -> int:
    """
    Remove todas as importações de um usuário específico.
    Isso permite reutilizar os mesmos arquivos de importação no futuro.
    
    Args:
        usuario_id: ID do usuário cujas importações serão removidas.
        
    Returns:
        int: Número de importações removidas.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            DELETE FROM importacoes 
            WHERE usuario_id = ?
        ''', (usuario_id,))
        conn.commit()
        return cursor.rowcount

def obter_preco_medio_carteira(ticker: str, usuario_id: int) -> Optional[Dict[str, Any]]:
    """
    Obtém o preço médio e informações de edição de um ticker na carteira atual.
    
    Args:
        ticker: Código da ação.
        usuario_id: ID do usuário.
        
    Returns:
        Dict com preco_medio, preco_editado_pelo_usuario ou None se não encontrado.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        
        cursor.execute('''
        SELECT preco_medio, preco_editado_pelo_usuario
        FROM carteira_atual 
        WHERE ticker = ? AND usuario_id = ?
        ''', (ticker, usuario_id))
        
        result = cursor.fetchone()
        if result:
            return {
                'preco_medio': result[0],
                'preco_editado_pelo_usuario': bool(result[1])
            }
        return None

def registrar_alteracao_preco_medio(ticker: str, usuario_id: int, preco_anterior: float, preco_novo: float, observacao: str = None) -> None:
    """
    Registra uma alteração de preço médio no histórico.
    
    Args:
        ticker: Código da ação.
        usuario_id: ID do usuário.
        preco_anterior: Preço médio anterior.
        preco_novo: Novo preço médio.
        observacao: Observação opcional sobre a alteração.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        
        from datetime import datetime
        data_alteracao = datetime.now().isoformat()
        
        cursor.execute('''
        INSERT INTO historico_preco_medio (
            ticker, usuario_id, preco_medio_anterior, preco_medio_novo, 
            data_alteracao, observacao
        ) VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            ticker, usuario_id, preco_anterior, preco_novo, 
            data_alteracao, observacao
        ))
        
        conn.commit()

def limpar_historico_preco_medio_usuario(usuario_id: int) -> int:
    """
    Remove todo o histórico de alterações de preço médio de um usuário específico.
    
    Args:
        usuario_id: ID do usuário cujo histórico será removido.
        
    Returns:
        int: Número de registros removidos.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            DELETE FROM historico_preco_medio 
            WHERE usuario_id = ?
        ''', (usuario_id,))
        conn.commit()
        return cursor.rowcount

# --- Funções para Cotações de Ações ---

def inserir_cotacao(cotacao_data: Dict[str, Any]) -> int:
    """
    Insere uma cotação de ação no banco de dados.
    
    Args:
        cotacao_data: Dicionário com os dados da cotação
        
    Returns:
        int: ID da cotação inserida
    """
    with get_db() as conn:
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT OR REPLACE INTO cotacao_acoes (
                acao_id, data, abertura, maxima, minima, fechamento,
                fechamento_ajustado, volume, dividendos, splits
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            cotacao_data['acao_id'],
            cotacao_data['data'],
            cotacao_data.get('abertura'),
            cotacao_data.get('maxima'),
            cotacao_data.get('minima'),
            cotacao_data.get('fechamento'),
            cotacao_data.get('fechamento_ajustado'),
            cotacao_data.get('volume'),
            cotacao_data.get('dividendos', 0.0),
            cotacao_data.get('splits', 0.0)
        ))
        
        conn.commit()
        return cursor.lastrowid

def inserir_cotacoes_lote(cotacoes_lista: List[Dict[str, Any]]) -> int:
    """
    Insere múltiplas cotações em lote para melhor performance.
    
    Args:
        cotacoes_lista: Lista de dicionários com dados das cotações
        
    Returns:
        int: Número de cotações inseridas
    """
    with get_db() as conn:
        cursor = conn.cursor()
        
        dados_para_inserir = []
        for cotacao in cotacoes_lista:
            dados_para_inserir.append((
                cotacao['acao_id'],
                cotacao['data'],
                cotacao.get('abertura'),
                cotacao.get('maxima'),
                cotacao.get('minima'),
                cotacao.get('fechamento'),
                cotacao.get('fechamento_ajustado'),
                cotacao.get('volume'),
                cotacao.get('dividendos', 0.0),
                cotacao.get('splits', 0.0)
            ))
        
        cursor.executemany('''
            INSERT OR REPLACE INTO cotacao_acoes (
                acao_id, data, abertura, maxima, minima, fechamento,
                fechamento_ajustado, volume, dividendos, splits
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', dados_para_inserir)
        
        conn.commit()
        return len(dados_para_inserir)

def inserir_feedback_usuario(feedback_data: Dict[str, Any]) -> int:
    """
    Insere um novo feedback do usuário no banco de dados.
    
    Args:
        feedback_data: Dicionário com dados do feedback contendo:
            - usuario_id: int
            - categoria: str ('bug', 'duvida_fiscal', 'sugestao', 'geral')
            - pagina_atual: str (opcional)
            - mensagem: str
            - prioridade: str ('baixa', 'media', 'alta') (opcional, padrão: 'media')
    
    Returns:
        int: ID do feedback inserido
    """
    with get_db() as conn:
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO feedback_usuario (
                usuario_id, categoria, pagina_atual, mensagem, prioridade
            ) VALUES (?, ?, ?, ?, ?)
        ''', (
            feedback_data['usuario_id'],
            feedback_data.get('categoria', 'geral'),
            feedback_data.get('pagina_atual'),
            feedback_data['mensagem'],
            feedback_data.get('prioridade', 'media')
        ))
        
        feedback_id = cursor.lastrowid
        conn.commit()
        return feedback_id

def obter_cotacoes_por_acao_id(acao_id: int, data_inicio: str = None, data_fim: str = None) -> List[Dict[str, Any]]:
    """
    Obtém cotações de uma ação específica, opcionalmente filtradas por período.
    
    Args:
        acao_id: ID da ação
        data_inicio: Data inicial no formato YYYY-MM-DD (opcional)
        data_fim: Data final no formato YYYY-MM-DD (opcional)
        
    Returns:
        List[Dict[str, Any]]: Lista de cotações
    """
    with get_db() as conn:
        cursor = conn.cursor()
        
        query = "SELECT * FROM cotacao_acoes WHERE acao_id = ?"
        params = [acao_id]
        
        if data_inicio:
            query += " AND data >= ?"
            params.append(data_inicio)
            
        if data_fim:
            query += " AND data <= ?"
            params.append(data_fim)
            
        query += " ORDER BY data DESC"
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

def obter_cotacoes_por_ticker(ticker: str, data_inicio: str = None, data_fim: str = None) -> List[Dict[str, Any]]:
    """
    Obtém cotações de uma ação específica pelo ticker, opcionalmente filtradas por período.
    
    Args:
        ticker: Ticker da ação
        data_inicio: Data inicial no formato YYYY-MM-DD (opcional)
        data_fim: Data final no formato YYYY-MM-DD (opcional)
        
    Returns:
        List[Dict[str, Any]]: Lista de cotações com informações da ação
    """
    with get_db() as conn:
        cursor = conn.cursor()
        
        query = '''
            SELECT c.*, a.ticker, a.nome 
            FROM cotacao_acoes c
            JOIN acoes a ON c.acao_id = a.id
            WHERE a.ticker = ?
        '''
        params = [ticker]
        
        if data_inicio:
            query += " AND c.data >= ?"
            params.append(data_inicio)
            
        if data_fim:
            query += " AND c.data <= ?"
            params.append(data_fim)
            
        query += " ORDER BY c.data DESC"
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

def obter_cotacao_mais_recente_por_ticker(ticker: str) -> Optional[Dict[str, Any]]:
    """
    Obtém a cotação mais recente de uma ação pelo ticker.
    
    Args:
        ticker: Ticker da ação
        
    Returns:
        Optional[Dict[str, Any]]: Dados da cotação mais recente ou None
    """
    with get_db() as conn:
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT c.*, a.ticker, a.nome 
            FROM cotacao_acoes c
            JOIN acoes a ON c.acao_id = a.id
            WHERE a.ticker = ?
            ORDER BY c.data DESC
            LIMIT 1
        ''', (ticker,))
        
        row = cursor.fetchone()
        return dict(row) if row else None

def obter_estatisticas_cotacoes() -> Dict[str, Any]:
    """
    Obtém estatísticas gerais sobre as cotações armazenadas.
    
    Returns:
        Dict[str, Any]: Estatísticas das cotações
    """
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Estatísticas gerais
        cursor.execute('''
            SELECT 
                COUNT(*) as total_registros,
                COUNT(DISTINCT acao_id) as total_acoes,
                MIN(data) as data_inicial,
                MAX(data) as data_final
            FROM cotacao_acoes
        ''')
        
        stats = dict(cursor.fetchone())
        
        # Registros por ação
        cursor.execute('''
            SELECT 
                a.ticker,
                a.nome,
                COUNT(*) as total_cotacoes,
                MIN(c.data) as primeira_data,
                MAX(c.data) as ultima_data
            FROM cotacao_acoes c
            JOIN acoes a ON c.acao_id = a.id
            GROUP BY a.id, a.ticker, a.nome
            ORDER BY total_cotacoes DESC
        ''')
        
        por_acao = [dict(row) for row in cursor.fetchall()]
        
        return {
            'estatisticas_gerais': stats,
            'por_acao': por_acao
        }

def limpar_cotacoes_acao(acao_id: int) -> int:
    """
    Remove todas as cotações de uma ação específica.
    
    Args:
        acao_id: ID da ação
        
    Returns:
        int: Número de registros removidos
    """
    with get_db() as conn:
        cursor = conn.cursor()
        
        cursor.execute('DELETE FROM cotacao_acoes WHERE acao_id = ?', (acao_id,))
        conn.commit()
        
        return cursor.rowcount

def verificar_cotacoes_existentes(acao_id: int, data_inicio: str, data_fim: str) -> bool:
    """
    Verifica se já existem cotações para uma ação em um período específico.
    
    Args:
        acao_id: ID da ação
        data_inicio: Data inicial no formato YYYY-MM-DD
        data_fim: Data final no formato YYYY-MM-DD
        
    Returns:
        bool: True se existem cotações no período
    """
    with get_db() as conn:
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT COUNT(*) as total
            FROM cotacao_acoes
            WHERE acao_id = ? AND data >= ? AND data <= ?
        ''', (acao_id, data_inicio, data_fim))
        
        result = cursor.fetchone()
        return result['total'] > 0

# ============================================
# FUNÇÕES PARA CONFIGURAÇÕES DE USUÁRIO
# ============================================

def obter_configuracao_usuario(usuario_id: int) -> Dict[str, Any]:
    """
    Obtém as configurações de um usuário específico.
    
    Args:
        usuario_id: ID do usuário
        
    Returns:
        Dict[str, Any]: Configurações do usuário ou None se não encontrado
    """
    with get_db() as conn:
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT * FROM usuario_configuracoes
            WHERE usuario_id = ?
        ''', (usuario_id,))
        
        result = cursor.fetchone()
        if result:
            config = dict(result)
            # Converter configuracoes_dashboard de JSON string para dict
            if config.get('configuracoes_dashboard'):
                import json
                config['configuracoes_dashboard'] = json.loads(config['configuracoes_dashboard'])
            else:
                config['configuracoes_dashboard'] = {}
            return config
        return None

def atualizar_configuracao_usuario(usuario_id: int, configuracoes: Dict[str, Any]) -> bool:
    """
    Atualiza as configurações de um usuário.
    
    Args:
        usuario_id: ID do usuário
        configuracoes: Dicionário com as configurações a serem atualizadas
        
    Returns:
        bool: True se atualizou com sucesso, False caso contrário
    """
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Campos válidos para atualização
        campos_validos = [
            'nome_exibicao', 'avatar_url', 'tema', 'idioma', 'moeda_preferida',
            'notificacoes_email', 'notificacoes_push', 'exibir_valores_totais',
            'formato_data', 'precisao_decimal', 'configuracoes_dashboard'
        ]
        
        updates = []
        valores = []
        
        for campo, valor in configuracoes.items():
            if campo in campos_validos and valor is not None:
                updates.append(f"{campo} = ?")
                if campo == 'configuracoes_dashboard':
                    import json
                    valores.append(json.dumps(valor))
                else:
                    valores.append(valor)
        
        if not updates:
            return False
        
        # Adicionar data_atualizacao
        updates.append("data_atualizacao = CURRENT_TIMESTAMP")
        valores.append(usuario_id)
        
        query = f'''
            UPDATE usuario_configuracoes 
            SET {', '.join(updates)}
            WHERE usuario_id = ?
        '''
        
        cursor.execute(query, valores)
        conn.commit()
        
        return cursor.rowcount > 0

def criar_configuracao_usuario_padrao(usuario_id: int) -> int:
    """
    Cria configuração padrão para um usuário novo.
    
    Args:
        usuario_id: ID do usuário
        
    Returns:
        int: ID da configuração criada
    """
    with get_db() as conn:
        cursor = conn.cursor()
        
        import json
        configuracoes_dashboard = json.dumps({
            'widgets_visiveis': ['carteira', 'resultados', 'operacoes_recentes', 'darfs'],
            'ordem_widgets': ['carteira', 'resultados', 'operacoes_recentes', 'darfs'],
            'modo_visualizacao': 'cards'
        })
        
        cursor.execute('''
            INSERT INTO usuario_configuracoes 
            (usuario_id, tema, idioma, moeda_preferida, 
             notificacoes_email, notificacoes_push, exibir_valores_totais, 
             formato_data, precisao_decimal, configuracoes_dashboard)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (usuario_id, 'light', 'pt-br', 'BRL', 1, 1, 1, 'dd/mm/yyyy', 2, configuracoes_dashboard))
        
        conn.commit()
        return cursor.lastrowid

def deletar_configuracao_usuario(usuario_id: int) -> bool:
    """
    Remove as configurações de um usuário.
    
    Args:
        usuario_id: ID do usuário
        
    Returns:
        bool: True se removeu com sucesso, False caso contrário
    """
    with get_db() as conn:
        cursor = conn.cursor()
        
        cursor.execute('''
            DELETE FROM usuario_configuracoes
            WHERE usuario_id = ?
        ''', (usuario_id,))
        
        conn.commit()
        return cursor.rowcount > 0

# ============================================
# FUNÇÕES PARA SISTEMA DE MENSAGERIA
# ============================================

def criar_mensagem(usuario_id: int, titulo: str, conteudo: str, 
                   tipo: str = "info", prioridade: str = "normal", 
                   categoria: str = "geral", remetente: str = "sistema",
                   acao_url: str = None, acao_texto: str = None, 
                   expirar_em: str = None) -> int:
    """
    Cria uma nova mensagem para um usuário.
    
    Returns:
        int: ID da mensagem criada
    """
    with get_db() as conn:
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO mensagens 
            (usuario_id, titulo, conteudo, tipo, prioridade, categoria, 
             remetente, acao_url, acao_texto, expirar_em)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (usuario_id, titulo, conteudo, tipo, prioridade, categoria,
              remetente, acao_url, acao_texto, expirar_em))
        
        conn.commit()
        return cursor.lastrowid

def obter_mensagens_usuario(usuario_id: int, apenas_nao_lidas: bool = False, 
                           categoria: str = None, limite: int = None) -> List[Dict[str, Any]]:
    """
    Obtém mensagens de um usuário com filtros opcionais.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        
        query = '''
            SELECT * FROM mensagens 
            WHERE usuario_id = ?
        '''
        params = [usuario_id]
        
        if apenas_nao_lidas:
            query += " AND lida = 0"
        
        if categoria:
            query += " AND categoria = ?"
            params.append(categoria)
            
        # Filtrar mensagens expiradas
        query += " AND (expirar_em IS NULL OR expirar_em > datetime('now'))"
        
        query += " ORDER BY data_criacao DESC"
        
        if limite:
            query += f" LIMIT {limite}"
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

def marcar_mensagem_como_lida(mensagem_id: int, usuario_id: int) -> bool:
    """
    Marca uma mensagem como lida.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        
        cursor.execute('''
            UPDATE mensagens 
            SET lida = 1, data_leitura = datetime('now')
            WHERE id = ? AND usuario_id = ?
        ''', (mensagem_id, usuario_id))
        
        conn.commit()
        return cursor.rowcount > 0

def marcar_todas_mensagens_como_lidas(usuario_id: int) -> int:
    """
    Marca todas as mensagens de um usuário como lidas.
    
    Returns:
        int: Número de mensagens marcadas como lidas
    """
    with get_db() as conn:
        cursor = conn.cursor()
        
        cursor.execute('''
            UPDATE mensagens 
            SET lida = 1, data_leitura = datetime('now')
            WHERE usuario_id = ? AND lida = 0
        ''', (usuario_id,))
        
        conn.commit()
        return cursor.rowcount

def deletar_mensagem(mensagem_id: int, usuario_id: int) -> bool:
    """
    Deleta uma mensagem específica.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        
        cursor.execute('''
            DELETE FROM mensagens 
            WHERE id = ? AND usuario_id = ?
        ''', (mensagem_id, usuario_id))
        
        conn.commit()
        return cursor.rowcount > 0

def obter_estatisticas_mensagens(usuario_id: int) -> Dict[str, Any]:
    """
    Obtém estatísticas das mensagens de um usuário.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Total e não lidas
        cursor.execute('''
            SELECT 
                COUNT(*) as total,
                COALESCE(SUM(CASE WHEN lida = 0 THEN 1 ELSE 0 END), 0) as nao_lidas
            FROM mensagens 
            WHERE usuario_id = ?
            AND (expirar_em IS NULL OR expirar_em > datetime('now'))
        ''', (usuario_id,))
        totals = cursor.fetchone()
        
        # Por tipo
        cursor.execute('''
            SELECT tipo, COUNT(*) as count
            FROM mensagens 
            WHERE usuario_id = ? AND lida = 0
            AND (expirar_em IS NULL OR expirar_em > datetime('now'))
            GROUP BY tipo
        ''', (usuario_id,))
        por_tipo = {row['tipo']: row['count'] for row in cursor.fetchall()}
        
        # Por prioridade
        cursor.execute('''
            SELECT prioridade, COUNT(*) as count
            FROM mensagens 
            WHERE usuario_id = ? AND lida = 0
            AND (expirar_em IS NULL OR expirar_em > datetime('now'))
            GROUP BY prioridade
        ''', (usuario_id,))
        por_prioridade = {row['prioridade']: row['count'] for row in cursor.fetchall()}
        
        # Por categoria
        cursor.execute('''
            SELECT categoria, COUNT(*) as count
            FROM mensagens 
            WHERE usuario_id = ? AND lida = 0
            AND (expirar_em IS NULL OR expirar_em > datetime('now'))
            GROUP BY categoria
        ''', (usuario_id,))
        por_categoria = {row['categoria']: row['count'] for row in cursor.fetchall()}
        
        return {
            'total': totals['total'],
            'nao_lidas': totals['nao_lidas'],
            'por_tipo': por_tipo,
            'por_prioridade': por_prioridade,
            'por_categoria': por_categoria
        }

def limpar_mensagens_expiradas() -> int:
    """
    Remove mensagens expiradas do banco de dados.
    
    Returns:
        int: Número de mensagens removidas
    """
    with get_db() as conn:
        cursor = conn.cursor()
        
        cursor.execute('''
            DELETE FROM mensagens 
            WHERE expirar_em IS NOT NULL 
            AND expirar_em <= datetime('now')
        ''')
        
        conn.commit()
        return cursor.rowcount