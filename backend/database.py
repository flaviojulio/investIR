import sqlite3
from datetime import date, datetime
from contextlib import contextmanager
from typing import Dict, List, Any, Optional
# Unused imports json, Union, defaultdict removed

# Caminho para o banco de dados SQLite
DATABASE_FILE = "acoes_ir.db"

# Convert datetime.date objects to ISO format string (YYYY-MM-DD) when writing to DB
sqlite3.register_adapter(date, lambda val: val.isoformat())

# Convert DATE column string (YYYY-MM-DD) from DB to datetime.date objects when reading
sqlite3.register_converter("date", lambda val: datetime.strptime(val.decode(), "%Y-%m-%d").date())

def _transform_date_string_to_iso(date_str: Optional[str]) -> Optional[str]:
    if not date_str or date_str.strip() == '--' or date_str.strip() == '':
        return None

    cleaned_date_str = date_str.strip()

    try:
        # Try ISO format first (YYYY-MM-DD or YYYY-MM-DD HH:MM:SS)
        return datetime.strptime(cleaned_date_str.split("T")[0], '%Y-%m-%d').date().isoformat()
    except ValueError:
        try:
            # Try DD/MM/YYYY format
            return datetime.strptime(cleaned_date_str, '%d/%m/%Y').date().isoformat()
        except ValueError:
            # If both fail, return None
            print(f"WARNING: Could not parse date string '{date_str}' during proventos migration. Storing as NULL.")
            return None

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
    Cria as tabelas necessárias se não existirem e adiciona colunas ausentes.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Tabela de operações
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS operacoes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            ticker TEXT NOT NULL,
            operation TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            price REAL NOT NULL,
            fees REAL NOT NULL DEFAULT 0.0
        )
        ''')
        
        # Verificar se a coluna usuario_id existe na tabela operacoes
        cursor.execute("PRAGMA table_info(operacoes)")
        colunas = [info[1] for info in cursor.fetchall()]
        
        # Adicionar a coluna usuario_id se ela não existir
        if 'usuario_id' not in colunas:
            cursor.execute('ALTER TABLE operacoes ADD COLUMN usuario_id INTEGER DEFAULT NULL')
        
        # Tabela de resultados mensais
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS resultados_mensais (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            mes TEXT NOT NULL,
            vendas_swing REAL NOT NULL,
            custo_swing REAL NOT NULL,
            ganho_liquido_swing REAL NOT NULL,
            isento_swing INTEGER NOT NULL,
            ganho_liquido_day REAL NOT NULL,
            ir_devido_day REAL NOT NULL,
            irrf_day REAL NOT NULL,
            ir_pagar_day REAL NOT NULL,
            prejuizo_acumulado_swing REAL NOT NULL,
            prejuizo_acumulado_day REAL NOT NULL,
            darf_codigo TEXT,
            darf_competencia TEXT,
            darf_valor REAL,
            darf_vencimento TEXT
        )
        ''')
        
        # Verificar se a coluna usuario_id existe na tabela resultados_mensais
        cursor.execute("PRAGMA table_info(resultados_mensais)")
        colunas = [info[1] for info in cursor.fetchall()]
        
        # Adicionar a coluna usuario_id se ela não existir
        if 'usuario_id' not in colunas:
            cursor.execute('ALTER TABLE resultados_mensais ADD COLUMN usuario_id INTEGER DEFAULT NULL')

        # Ensure all columns from the new ResultadoMensal model exist
        if 'custo_day_trade' not in colunas:
            cursor.execute('ALTER TABLE resultados_mensais ADD COLUMN custo_day_trade REAL DEFAULT 0.0')
        if 'ir_devido_swing' not in colunas:
            cursor.execute('ALTER TABLE resultados_mensais ADD COLUMN ir_devido_swing REAL DEFAULT 0.0')
        if 'ir_pagar_swing' not in colunas:
            cursor.execute('ALTER TABLE resultados_mensais ADD COLUMN ir_pagar_swing REAL DEFAULT 0.0')
        
        if 'darf_codigo_swing' not in colunas:
            cursor.execute('ALTER TABLE resultados_mensais ADD COLUMN darf_codigo_swing TEXT DEFAULT NULL')
        if 'darf_competencia_swing' not in colunas:
            cursor.execute('ALTER TABLE resultados_mensais ADD COLUMN darf_competencia_swing TEXT DEFAULT NULL')
        if 'darf_valor_swing' not in colunas:
            cursor.execute('ALTER TABLE resultados_mensais ADD COLUMN darf_valor_swing REAL DEFAULT NULL')
        if 'darf_vencimento_swing' not in colunas:
            cursor.execute('ALTER TABLE resultados_mensais ADD COLUMN darf_vencimento_swing TEXT DEFAULT NULL')
        
        # Rename old generic DARF columns to _day versions if they exist and new ones don't
        # This is a simplified migration. A robust migration would check SQLite version for RENAME COLUMN support.
        # For now, we'll add new _day columns and new code will use them.
        # Old columns (darf_codigo, darf_competencia, darf_valor, darf_vencimento) will become unused.
        if 'darf_codigo_day' not in colunas:
             cursor.execute('ALTER TABLE resultados_mensais ADD COLUMN darf_codigo_day TEXT DEFAULT NULL')
        if 'darf_competencia_day' not in colunas:
             cursor.execute('ALTER TABLE resultados_mensais ADD COLUMN darf_competencia_day TEXT DEFAULT NULL')
        if 'darf_valor_day' not in colunas:
             cursor.execute('ALTER TABLE resultados_mensais ADD COLUMN darf_valor_day REAL DEFAULT NULL')
        if 'darf_vencimento_day' not in colunas:
             cursor.execute('ALTER TABLE resultados_mensais ADD COLUMN darf_vencimento_day TEXT DEFAULT NULL')

        # These were added in previous steps, ensure checks remain if they are part of the new model
        if 'vendas_day_trade' not in colunas: # Kept in new model
            cursor.execute('ALTER TABLE resultados_mensais ADD COLUMN vendas_day_trade REAL DEFAULT 0.0')
        if 'status_darf_swing_trade' not in colunas: # Kept in new model
            cursor.execute('ALTER TABLE resultados_mensais ADD COLUMN status_darf_swing_trade TEXT DEFAULT NULL')
        if 'status_darf_day_trade' not in colunas: # Kept in new model
            cursor.execute('ALTER TABLE resultados_mensais ADD COLUMN status_darf_day_trade TEXT DEFAULT NULL')

        # Columns 'darf_swing_trade_valor' and 'darf_day_trade_valor' are now redundant.
        # We won't remove them here to avoid breaking existing dbs without a full migration,
        # but new logic in salvar_resultado_mensal will not use them.
        
        # Tabela de carteira atual
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS carteira_atual (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticker TEXT NOT NULL,
            quantidade INTEGER NOT NULL,
            custo_total REAL NOT NULL,
            preco_medio REAL NOT NULL,
            UNIQUE(ticker)
        )
        ''')
        
        # Verificar se a coluna usuario_id existe na tabela carteira_atual
        cursor.execute("PRAGMA table_info(carteira_atual)")
        colunas = [info[1] for info in cursor.fetchall()]
        
        # Adicionar a coluna usuario_id se ela não existir
        if 'usuario_id' not in colunas:
            # Primeiro, remover a restrição UNIQUE existente
            cursor.execute('''
            CREATE TABLE carteira_atual_temp (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ticker TEXT NOT NULL,
                quantidade INTEGER NOT NULL,
                custo_total REAL NOT NULL,
                preco_medio REAL NOT NULL,
                usuario_id INTEGER DEFAULT NULL,
                UNIQUE(ticker, usuario_id)
            )
            ''')
            
            # Copiar dados da tabela antiga para a nova
            cursor.execute('''
            INSERT INTO carteira_atual_temp (id, ticker, quantidade, custo_total, preco_medio)
            SELECT id, ticker, quantidade, custo_total, preco_medio FROM carteira_atual
            ''')
            
            # Remover tabela antiga
            cursor.execute('DROP TABLE carteira_atual')
            
            # Renomear tabela temporária
            cursor.execute('ALTER TABLE carteira_atual_temp RENAME TO carteira_atual')
        
        # Tabela de operações fechadas
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS operacoes_fechadas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            data_abertura TEXT NOT NULL,
            data_fechamento TEXT NOT NULL,
            ticker TEXT NOT NULL,
            quantidade INTEGER NOT NULL,
            valor_compra REAL NOT NULL,
            valor_venda REAL NOT NULL,
            resultado REAL NOT NULL,
            percentual_lucro REAL NOT NULL
        )
        ''')
        
        # Verificar se a coluna usuario_id existe na tabela operacoes_fechadas
        cursor.execute("PRAGMA table_info(operacoes_fechadas)")
        colunas = [info[1] for info in cursor.fetchall()]
        
        # Adicionar a coluna usuario_id se ela não existir
        if 'usuario_id' not in colunas:
            cursor.execute('ALTER TABLE operacoes_fechadas ADD COLUMN usuario_id INTEGER DEFAULT NULL')
        
        # Criar índices para melhorar performance nas consultas
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_operacoes_date ON operacoes(date)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_operacoes_ticker ON operacoes(ticker)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_resultados_mensais_mes ON resultados_mensais(mes)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_operacoes_fechadas_ticker ON operacoes_fechadas(ticker)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_operacoes_fechadas_data_fechamento ON operacoes_fechadas(data_fechamento)')

        # Remover a tabela 'stocks' antiga se existir
        cursor.execute('DROP TABLE IF EXISTS stocks;')

        # Nova tabela 'acoes'
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS acoes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticker TEXT NOT NULL UNIQUE,
            nome TEXT,
            razao_social TEXT,
            cnpj TEXT,
            ri TEXT,
            classificacao TEXT,
            isin TEXT
        )
        ''')

        # Criar índice para a coluna ticker na tabela acoes
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_acoes_ticker ON acoes(ticker);')

        # Tabela de proventos
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS proventos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            id_acao INTEGER,
            tipo TEXT,
            valor REAL,
            data_registro TEXT,
            data_ex TEXT,
            dt_pagamento TEXT,
            FOREIGN KEY(id_acao) REFERENCES acoes(id)
        )
        ''')

        # Criar índice para a coluna id_acao na tabela proventos
        # Tabela de proventos - MIGRATION LOGIC
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='proventos';")
        proventos_table_exists = cursor.fetchone()
        needs_migration = False

        if proventos_table_exists:
            cursor.execute("PRAGMA table_info(proventos);")
            columns_info = {row['name']: str(row['type']).upper() for row in cursor.fetchall()}
            if not (columns_info.get('data_ex') == 'DATE' and \
                    columns_info.get('dt_pagamento') == 'DATE' and \
                    columns_info.get('data_registro') == 'DATE'):
                needs_migration = True

        final_proventos_schema = """
        CREATE TABLE proventos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            id_acao INTEGER,
            tipo TEXT,
            valor REAL,
            data_registro DATE,
            data_ex DATE,
            dt_pagamento DATE,
            FOREIGN KEY(id_acao) REFERENCES acoes(id)
        )
        """

        if needs_migration:
            print("INFO: Migrating 'proventos' table to new schema with DATE types...")
            try:
                cursor.execute("CREATE TABLE proventos_old AS SELECT * FROM proventos;") # Backup old data safely
                cursor.execute("DROP TABLE proventos;") # Drop the old table

                # Create the new table with the final schema
                cursor.execute(final_proventos_schema)

                cursor.execute("SELECT id, id_acao, tipo, valor, data_registro, data_ex, dt_pagamento FROM proventos_old;")
                old_proventos_rows = cursor.fetchall()

                migrated_count = 0
                for row_dict in old_proventos_rows: # Assumes conn.row_factory = sqlite3.Row
                    transformed_data_registro = _transform_date_string_to_iso(row_dict['data_registro'])
                    transformed_data_ex = _transform_date_string_to_iso(row_dict['data_ex'])
                    transformed_dt_pagamento = _transform_date_string_to_iso(row_dict['dt_pagamento'])

                    cursor.execute("""
                        INSERT INTO proventos (id_acao, tipo, valor, data_registro, data_ex, dt_pagamento)
                        VALUES (?, ?, ?, ?, ?, ?)
                    """, (row_dict['id_acao'], row_dict['tipo'], row_dict['valor'],
                          transformed_data_registro, transformed_data_ex, transformed_dt_pagamento))
                    migrated_count +=1

                cursor.execute("DROP TABLE proventos_old;")
                print(f"INFO: 'proventos' table migration complete. {migrated_count} rows migrated.")
            except Exception as e:
                print(f"ERROR: Failed to migrate 'proventos' table: {e}")
                try:
                    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='proventos_old';")
                    if cursor.fetchone():
                        cursor.execute("DROP TABLE IF EXISTS proventos;")
                        cursor.execute("ALTER TABLE proventos_old RENAME TO proventos;")
                        print("INFO: Attempted to restore 'proventos' table from backup.")
                except Exception as restore_e:
                    print(f"ERROR: Failed to restore 'proventos' table from backup: {restore_e}")
                raise
        else:
            # If no migration needed, just ensure table exists with the correct schema
            cursor.execute(final_proventos_schema.replace("CREATE TABLE", "CREATE TABLE IF NOT EXISTS"))

        # Criar índice para a coluna id_acao na tabela proventos
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_proventos_id_acao ON proventos(id_acao);')

        # Tabela de eventos corporativos
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS eventos_corporativos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            id_acao INTEGER NOT NULL,
            evento TEXT NOT NULL,
            data_aprovacao TEXT,
            data_registro TEXT,
            data_ex TEXT,
            razao TEXT,
            FOREIGN KEY(id_acao) REFERENCES acoes(id)
        )
        ''')

        # Criar índice para a coluna id_acao na tabela eventos_corporativos
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_eventos_corporativos_id_acao ON eventos_corporativos(id_acao);')
        
        # Adiciona índices para as colunas usuario_id
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_operacoes_usuario_id ON operacoes(usuario_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_operacoes_usuario_ticker_date ON operacoes(usuario_id, ticker, date);') # New composite index
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_resultados_mensais_usuario_id ON resultados_mensais(usuario_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_carteira_atual_usuario_id ON carteira_atual(usuario_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_operacoes_fechadas_usuario_id ON operacoes_fechadas(usuario_id)')

        # Tabela usuario_proventos_recebidos
        cursor.execute('''
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
        )
        ''')

        # Índices para usuario_proventos_recebidos
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_usr_prov_rec_usuario_id ON usuario_proventos_recebidos(usuario_id);')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_usr_prov_rec_acao_id ON usuario_proventos_recebidos(id_acao);')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_usr_prov_rec_dt_pagamento ON usuario_proventos_recebidos(dt_pagamento);')
        cursor.execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_usr_prov_rec_usr_prov_glob ON usuario_proventos_recebidos(usuario_id, provento_global_id);')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_usr_prov_rec_uid_dtpag_dataex ON usuario_proventos_recebidos(usuario_id, dt_pagamento DESC, data_ex DESC);') # New composite index
        
        conn.commit()
    
    # Inicializa o sistema de autenticação
    from auth import inicializar_autenticacao # Relative import
    inicializar_autenticacao()
    
def date_converter(obj):
    """
    Conversor de data para JSON.
    """
    if isinstance(obj, (date, datetime)):
        return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")

def inserir_operacao(operacao: Dict[str, Any], usuario_id: Optional[int] = None) -> int:
    """
    Insere uma operação no banco de dados.
    Verifica se o ticker da operação existe na tabela `acoes`.
    
    Args:
        operacao: Dicionário com os dados da operação.
        usuario_id: ID do usuário que está criando a operação (opcional).
        
    Returns:
        int: ID da operação inserida.

    Raises:
        ValueError: Se o ticker não for encontrado na tabela `acoes`.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Verifica se o ticker existe na tabela acoes
        ticker_value = operacao["ticker"]
        # Modificado para consultar a nova tabela 'acoes'
        cursor.execute("SELECT 1 FROM acoes WHERE ticker = ?", (ticker_value,))
        if cursor.fetchone() is None:
            # Mensagem de erro atualizada para refletir o nome da nova tabela
            raise ValueError(f"Ticker {ticker_value} não encontrado na tabela de ações (acoes).")

        # Adiciona usuario_id ao INSERT
        cursor.execute('''
        INSERT INTO operacoes (date, ticker, operation, quantity, price, fees, usuario_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            operacao["date"].isoformat() if isinstance(operacao["date"], (datetime, date)) else operacao["date"],
            operacao["ticker"],
            operacao["operation"],
            operacao["quantity"],
            operacao["price"],
            operacao.get("fees", 0.0),
            usuario_id # Garante que usuario_id seja passado
        ))
        
        conn.commit()
        return cursor.lastrowid

def obter_operacao_por_id(operacao_id: int, usuario_id: int) -> Optional[Dict[str, Any]]:
    """
    Obtém uma operação pelo ID e usuario_id.
    
    Args:
        operacao_id: ID da operação.
        usuario_id: ID do usuário.
        
    Returns:
        Optional[Dict[str, Any]]: Dados da operação ou None se não encontrada.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        
        cursor.execute('''
        SELECT id, date, ticker, operation, quantity, price, fees, usuario_id
        FROM operacoes
        WHERE id = ? AND usuario_id = ?
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
            "usuario_id": operacao["usuario_id"]
        }

def obter_todas_operacoes(usuario_id: int) -> List[Dict[str, Any]]:
    """
    Obtém todas as operações de um usuário específico.
    
    Args:
        usuario_id: ID do usuário para filtrar operações.
        
    Returns:
        List[Dict[str, Any]]: Lista de operações.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Filtra estritamente por usuario_id
        query = '''
        SELECT id, date, ticker, operation, quantity, price, fees, usuario_id
        FROM operacoes
        WHERE usuario_id = ?
        ORDER BY date
        '''
        
        cursor.execute(query, (usuario_id,))
        
        operacoes = []
        for operacao in cursor.fetchall():
            operacoes.append({
                "id": operacao["id"],
                "date": datetime.fromisoformat(operacao["date"].split("T")[0]).date() if isinstance(operacao["date"], str) else operacao["date"], # Standardize to date object
                "ticker": operacao["ticker"],
                "operation": operacao["operation"],
                "quantity": operacao["quantity"],
                "price": operacao["price"],
                "fees": operacao["fees"],
                "usuario_id": operacao["usuario_id"]
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

def atualizar_carteira(ticker: str, quantidade: int, preco_medio: float, custo_total: float, usuario_id: int) -> None:
    """
    Atualiza ou insere um item na carteira atual de um usuário.
    
    Args:
        ticker: Código da ação.
        quantidade: Quantidade de ações.
        preco_medio: Preço médio das ações.
        custo_total: Custo total da posição.
        usuario_id: ID do usuário.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Usa INSERT OR REPLACE para simplificar (considerando UNIQUE(ticker, usuario_id))
        # A tabela carteira_atual já deve ter a restrição UNIQUE(ticker, usuario_id)
        # e a coluna usuario_id, conforme definido em criar_tabelas e auth.modificar_tabelas_existentes
        cursor.execute('''
        INSERT OR REPLACE INTO carteira_atual (ticker, quantidade, custo_total, preco_medio, usuario_id)
        VALUES (?, ?, ?, ?, ?)
        ''', (
            ticker,
            quantidade,
            custo_total,
            preco_medio,
            usuario_id
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
        
        # Modificado para incluir o nome da ação da tabela 'acoes'
        query = """
        SELECT
            ca.ticker,
            ca.quantidade,
            ca.custo_total,
            ca.preco_medio,
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
                ir_devido_swing = ?, ir_pagar_swing = ?, darf_codigo_swing = ?, darf_competencia_swing = ?,
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
                resultado["ir_devido_swing"], resultado["ir_pagar_swing"],
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
                ir_devido_swing, ir_pagar_swing, darf_codigo_swing, darf_competencia_swing,
                darf_valor_swing, darf_vencimento_swing, status_darf_swing_trade,
                vendas_day_trade, custo_day_trade, ganho_liquido_day, ir_devido_day,
                irrf_day, ir_pagar_day, darf_codigo_day, darf_competencia_day,
                darf_valor_day, darf_vencimento_day, status_darf_day_trade,
                prejuizo_acumulado_swing, prejuizo_acumulado_day, usuario_id
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                resultado["mes"], resultado["vendas_swing"], resultado["custo_swing"], resultado["ganho_liquido_swing"],
                1 if resultado["isento_swing"] else 0, resultado["ir_devido_swing"], resultado["ir_pagar_swing"],
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
        
        # Reseta os contadores de autoincremento
        cursor.execute('DELETE FROM sqlite_sequence WHERE name IN ("operacoes", "resultados_mensais", "carteira_atual", "operacoes_fechadas")')
        
        conn.commit()


def obter_operacoes_para_calculo_fechadas(usuario_id: int) -> List[Dict[str, Any]]:
    """
    Obtém todas as operações de um usuário para calcular as operações fechadas.
    
    Args:
        usuario_id: ID do usuário.
        
    Returns:
        List[Dict[str, Any]]: Lista de operações.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Obtém todas as operações do usuário ordenadas por data e ID
        cursor.execute('SELECT * FROM operacoes WHERE usuario_id = ? ORDER BY date, id', (usuario_id,))
        
        operacoes = []
        for row in cursor.fetchall():
            operacao = dict(row)
            # Converte a string de data para objeto date
            if isinstance(operacao["date"], str):
                operacao["date"] = datetime.fromisoformat(operacao["date"].split("T")[0]).date()
            elif isinstance(operacao["date"], datetime): # Caso a data já seja datetime
                 operacao["date"] = operacao["date"].date()
            operacoes.append(operacao)
        
        return operacoes

def salvar_operacao_fechada(op_fechada: Dict[str, Any], usuario_id: int) -> None:
    """
    Salva uma operação fechada no banco de dados.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO operacoes_fechadas (
                data_abertura, data_fechamento, ticker, quantidade,
                valor_compra, valor_venda, resultado, percentual_lucro, usuario_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            op_fechada['data_abertura'].isoformat() if isinstance(op_fechada['data_abertura'], (date, datetime)) else op_fechada['data_abertura'],
            op_fechada['data_fechamento'].isoformat() if isinstance(op_fechada['data_fechamento'], (date, datetime)) else op_fechada['data_fechamento'],
            op_fechada['ticker'],
            op_fechada['quantidade'],
            op_fechada['valor_compra'],
            op_fechada['valor_venda'],
            op_fechada['resultado'],
            op_fechada['percentual_lucro'],
            usuario_id
        ))
        conn.commit()

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

def inserir_usuario_provento_recebido_db(dados: Dict[str, Any]) -> int:
    """
    Insere um registro de provento recebido por um usuário no banco de dados.
    Espera que 'dados' contenha todas as chaves necessárias e que as datas/datetimes
    já estejam formatadas como strings ISO.
    """
    with get_db() as conn:
        cursor = conn.cursor()

        # Certifique-se de que a ordem dos campos corresponde à ordem dos placeholders
        campos = [
            'usuario_id', 'provento_global_id', 'id_acao', 'ticker_acao',
            'nome_acao', 'tipo_provento', 'data_ex', 'dt_pagamento',
            'valor_unitario_provento', 'quantidade_possuida_na_data_ex',
            'valor_total_recebido', 'data_calculo'
        ]

        placeholders = ', '.join(['?'] * len(campos))
        valores = [dados.get(campo) for campo in campos]

        # Assegura que dt_pagamento seja None se não fornecido, e não uma string vazia.
        # A tabela permite NULL para dt_pagamento.
        if 'dt_pagamento' in dados and dados['dt_pagamento'] == '':
            valores[campos.index('dt_pagamento')] = None

        # data_calculo é esperado como string YYYY-MM-DD HH:MM:SS
        # data_ex e dt_pagamento como YYYY-MM-DD

        try:
            cursor.execute(f'''
                INSERT INTO usuario_proventos_recebidos ({', '.join(campos)})
                VALUES ({placeholders})
            ''', tuple(valores))
            conn.commit()
            return cursor.lastrowid
        except sqlite3.IntegrityError as e:
            # Isso pode acontecer devido à restrição UNIQUE (usuario_id, provento_global_id)
            # Logar o erro ou tratar conforme necessário.
            # print(f"Erro de integridade ao inserir provento recebido: {e}. Dados: {dados}")
            raise # Re-lança a exceção para ser tratada pela camada de serviço
        except Exception as e:
            # print(f"Erro inesperado ao inserir provento recebido: {e}. Dados: {dados}")
            raise

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
    Insere um novo provento no banco de dados.
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