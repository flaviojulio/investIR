-- ============================================================================
-- MIGRAÇÃO INVESTIR: SQLite → PostgreSQL
-- ============================================================================
-- Este arquivo contém o schema completo para recriar o banco no PostgreSQL
-- Equivale exatamente à estrutura atual do SQLite, mas otimizado para produção

-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. TABELA ACOES
-- ============================================================================
CREATE TABLE acoes (
    id SERIAL PRIMARY KEY,
    ticker VARCHAR(20) NOT NULL UNIQUE,
    nome VARCHAR(255),
    razao_social VARCHAR(255),
    cnpj VARCHAR(18),
    ri TEXT,
    classificacao VARCHAR(100),
    isin VARCHAR(12),
    logo VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_acoes_ticker ON acoes(ticker);
CREATE INDEX idx_acoes_nome ON acoes(nome);

-- ============================================================================
-- 2. TABELA CORRETORAS
-- ============================================================================
CREATE TABLE corretoras (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    cnpj VARCHAR(18) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 3. TABELA USUARIOS (Sistema de Autenticação)
-- ============================================================================
CREATE TABLE funcoes (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(50) NOT NULL UNIQUE,
    descricao TEXT
);

CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    senha_hash VARCHAR(255) NOT NULL,
    senha_salt VARCHAR(255) NOT NULL,
    nome_completo VARCHAR(255),
    cpf VARCHAR(14),
    data_criacao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    data_atualizacao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ultimo_login TIMESTAMP,
    ativo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE usuario_funcoes (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    funcao_id INTEGER NOT NULL REFERENCES funcoes(id) ON DELETE CASCADE,
    UNIQUE(usuario_id, funcao_id)
);

CREATE TABLE tokens (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL UNIQUE,
    tipo VARCHAR(50) NOT NULL,
    expira_em TIMESTAMP NOT NULL,
    usado BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE redefinicao_senha (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL UNIQUE,
    expira_em TIMESTAMP NOT NULL,
    usado BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE usuario_configuracoes (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL UNIQUE REFERENCES usuarios(id) ON DELETE CASCADE,
    configuracoes JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 4. TABELA IMPORTACOES (Rastreamento de Uploads)
-- ============================================================================
CREATE TABLE importacoes (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    nome_arquivo VARCHAR(255) NOT NULL,
    nome_arquivo_original VARCHAR(255),
    tamanho_arquivo BIGINT,
    data_importacao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    total_operacoes_arquivo INTEGER NOT NULL,
    total_operacoes_importadas INTEGER NOT NULL DEFAULT 0,
    total_operacoes_duplicadas INTEGER NOT NULL DEFAULT 0,
    total_operacoes_erro INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'em_andamento' CHECK (status IN ('em_andamento', 'concluida', 'erro')),
    hash_arquivo VARCHAR(64),
    observacoes TEXT,
    tempo_processamento_ms INTEGER
);

CREATE INDEX idx_importacoes_usuario_id ON importacoes(usuario_id);
CREATE INDEX idx_importacoes_data ON importacoes(data_importacao);
CREATE INDEX idx_importacoes_status ON importacoes(status);

-- ============================================================================
-- 5. TABELA OPERACOES (Core do Sistema)
-- ============================================================================
CREATE TABLE operacoes (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    ticker VARCHAR(20) NOT NULL,
    operation VARCHAR(10) NOT NULL CHECK (operation IN ('buy', 'sell')),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price DECIMAL(15,8) NOT NULL CHECK (price > 0),
    fees DECIMAL(15,8) NOT NULL DEFAULT 0.0,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    corretora_id INTEGER REFERENCES corretoras(id),
    importacao_id INTEGER REFERENCES importacoes(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Garantir referência à tabela acoes
    CONSTRAINT fk_operacoes_ticker FOREIGN KEY (ticker) REFERENCES acoes(ticker)
);

CREATE INDEX idx_operacoes_usuario_id ON operacoes(usuario_id);
CREATE INDEX idx_operacoes_ticker ON operacoes(ticker);
CREATE INDEX idx_operacoes_date ON operacoes(date);
CREATE INDEX idx_operacoes_usuario_ticker ON operacoes(usuario_id, ticker);
CREATE INDEX idx_operacoes_date_ticker ON operacoes(date, ticker);

-- ============================================================================
-- 6. TABELA CARTEIRA_ATUAL (Posições Consolidadas)
-- ============================================================================
CREATE TABLE carteira_atual (
    id SERIAL PRIMARY KEY,
    ticker VARCHAR(20) NOT NULL,
    quantidade INTEGER NOT NULL CHECK (quantidade >= 0),
    custo_total DECIMAL(15,2) NOT NULL DEFAULT 0,
    preco_medio DECIMAL(15,8) NOT NULL DEFAULT 0,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    preco_editado_pelo_usuario BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(ticker, usuario_id),
    CONSTRAINT fk_carteira_ticker FOREIGN KEY (ticker) REFERENCES acoes(ticker)
);

CREATE INDEX idx_carteira_atual_usuario_id ON carteira_atual(usuario_id);
CREATE INDEX idx_carteira_atual_ticker ON carteira_atual(ticker);

-- ============================================================================
-- 7. TABELA OPERACOES_FECHADAS (Realizações de Lucro/Prejuízo)
-- ============================================================================
CREATE TABLE operacoes_fechadas (
    id SERIAL PRIMARY KEY,
    data_abertura DATE NOT NULL,
    data_fechamento DATE NOT NULL,
    ticker VARCHAR(20) NOT NULL,
    quantidade INTEGER NOT NULL CHECK (quantidade > 0),
    valor_compra DECIMAL(15,2) NOT NULL,
    valor_venda DECIMAL(15,2) NOT NULL,
    resultado DECIMAL(15,2) NOT NULL,
    percentual_lucro DECIMAL(8,4) NOT NULL,
    day_trade BOOLEAN DEFAULT FALSE,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    status_ir VARCHAR(20) DEFAULT 'pendente' CHECK (status_ir IN ('pendente', 'pago', 'isento')),
    preco_medio_compra DECIMAL(15,8) DEFAULT 0,
    preco_medio_venda DECIMAL(15,8) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_operacoes_fechadas_ticker FOREIGN KEY (ticker) REFERENCES acoes(ticker),
    CONSTRAINT chk_data_fechamento CHECK (data_fechamento >= data_abertura)
);

CREATE INDEX idx_operacoes_fechadas_usuario_id ON operacoes_fechadas(usuario_id);
CREATE INDEX idx_operacoes_fechadas_ticker ON operacoes_fechadas(ticker);
CREATE INDEX idx_operacoes_fechadas_data_fechamento ON operacoes_fechadas(data_fechamento);
CREATE INDEX idx_operacoes_fechadas_day_trade ON operacoes_fechadas(day_trade);
CREATE INDEX idx_operacoes_fechadas_status_ir ON operacoes_fechadas(status_ir);

-- ============================================================================
-- 8. TABELA RESULTADOS_MENSAIS (Apuração Fiscal)
-- ============================================================================
CREATE TABLE resultados_mensais (
    id SERIAL PRIMARY KEY,
    mes VARCHAR(7) NOT NULL, -- Format: YYYY-MM
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    
    -- SWING TRADE
    vendas_swing DECIMAL(15,2) DEFAULT 0.0,
    custo_swing DECIMAL(15,2) DEFAULT 0.0,
    ganho_liquido_swing DECIMAL(15,2) DEFAULT 0.0,
    isento_swing BOOLEAN DEFAULT FALSE,
    irrf_swing DECIMAL(15,2) DEFAULT 0.0,
    ir_devido_swing DECIMAL(15,2) DEFAULT 0.0,
    ir_pagar_swing DECIMAL(15,2) DEFAULT 0.0,
    darf_codigo_swing VARCHAR(10),
    darf_competencia_swing VARCHAR(7),
    darf_valor_swing DECIMAL(15,2),
    darf_vencimento_swing DATE,
    status_darf_swing_trade VARCHAR(20) DEFAULT 'pendente' CHECK (status_darf_swing_trade IN ('pendente', 'pago', 'isento')),
    
    -- DAY TRADE
    vendas_day_trade DECIMAL(15,2) DEFAULT 0.0,
    custo_day_trade DECIMAL(15,2) DEFAULT 0.0,
    ganho_liquido_day DECIMAL(15,2) DEFAULT 0.0,
    ir_devido_day DECIMAL(15,2) DEFAULT 0.0,
    irrf_day DECIMAL(15,2) DEFAULT 0.0,
    ir_pagar_day DECIMAL(15,2) DEFAULT 0.0,
    darf_codigo_day VARCHAR(10),
    darf_competencia_day VARCHAR(7),
    darf_valor_day DECIMAL(15,2),
    darf_vencimento_day DATE,
    status_darf_day_trade VARCHAR(20) DEFAULT 'pendente' CHECK (status_darf_day_trade IN ('pendente', 'pago', 'isento')),
    
    -- PREJUÍZOS ACUMULADOS
    prejuizo_acumulado_swing DECIMAL(15,2) DEFAULT 0.0,
    prejuizo_acumulado_day DECIMAL(15,2) DEFAULT 0.0,
    
    -- CAMPOS LEGADOS (manter compatibilidade)
    darf_codigo VARCHAR(10),
    darf_competencia VARCHAR(7),
    darf_valor DECIMAL(15,2),
    darf_vencimento DATE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(mes, usuario_id)
);

CREATE INDEX idx_resultados_mensais_usuario_id ON resultados_mensais(usuario_id);
CREATE INDEX idx_resultados_mensais_mes ON resultados_mensais(mes);
CREATE INDEX idx_resultados_mensais_usuario_mes ON resultados_mensais(usuario_id, mes);

-- ============================================================================
-- 9. TABELA PROVENTOS (Dividendos/JCP Globais)
-- ============================================================================
CREATE TABLE proventos (
    id SERIAL PRIMARY KEY,
    id_acao INTEGER NOT NULL REFERENCES acoes(id) ON DELETE CASCADE,
    tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('dividendo', 'jcp', 'jscp', 'bonificacao')),
    valor DECIMAL(15,8) NOT NULL CHECK (valor > 0),
    data_registro DATE,
    data_ex DATE NOT NULL,
    dt_pagamento DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_proventos_id_acao ON proventos(id_acao);
CREATE INDEX idx_proventos_data_ex ON proventos(data_ex);
CREATE INDEX idx_proventos_dt_pagamento ON proventos(dt_pagamento);
CREATE INDEX idx_proventos_tipo ON proventos(tipo);

-- ============================================================================
-- 10. TABELA USUARIO_PROVENTOS_RECEBIDOS (Cálculos Personalizados)
-- ============================================================================
CREATE TABLE usuario_proventos_recebidos (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    provento_global_id INTEGER NOT NULL REFERENCES proventos(id) ON DELETE CASCADE,
    id_acao INTEGER NOT NULL REFERENCES acoes(id) ON DELETE CASCADE,
    ticker_acao VARCHAR(20) NOT NULL,
    nome_acao VARCHAR(255),
    tipo_provento VARCHAR(10) NOT NULL,
    data_ex DATE NOT NULL,
    dt_pagamento DATE,
    valor_unitario_provento DECIMAL(15,8) NOT NULL,
    quantidade_possuida_na_data_ex INTEGER NOT NULL CHECK (quantidade_possuida_na_data_ex >= 0),
    valor_total_recebido DECIMAL(15,2) NOT NULL,
    data_calculo TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(usuario_id, provento_global_id),
    CONSTRAINT fk_usuario_proventos_ticker FOREIGN KEY (ticker_acao) REFERENCES acoes(ticker)
);

CREATE INDEX idx_usr_prov_rec_usuario_id ON usuario_proventos_recebidos(usuario_id);
CREATE INDEX idx_usr_prov_rec_ticker ON usuario_proventos_recebidos(ticker_acao);
CREATE INDEX idx_usr_prov_rec_data_ex ON usuario_proventos_recebidos(data_ex);
CREATE INDEX idx_usr_prov_rec_dt_pagamento ON usuario_proventos_recebidos(dt_pagamento);

-- ============================================================================
-- 11. TABELA EVENTOS_CORPORATIVOS
-- ============================================================================
CREATE TABLE eventos_corporativos (
    id SERIAL PRIMARY KEY,
    id_acao INTEGER NOT NULL REFERENCES acoes(id) ON DELETE CASCADE,
    evento VARCHAR(50) NOT NULL,
    data_aprovacao DATE,
    data_registro DATE,
    data_ex DATE,
    razao VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_eventos_corporativos_id_acao ON eventos_corporativos(id_acao);
CREATE INDEX idx_eventos_corporativos_data_ex ON eventos_corporativos(data_ex);

-- ============================================================================
-- 12. TABELA HISTORICO_PRECO_MEDIO (Auditoria)
-- ============================================================================
CREATE TABLE historico_preco_medio (
    id SERIAL PRIMARY KEY,
    ticker VARCHAR(20) NOT NULL,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    preco_medio_anterior DECIMAL(15,8) NOT NULL,
    preco_medio_novo DECIMAL(15,8) NOT NULL,
    data_alteracao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    observacao TEXT,
    
    CONSTRAINT fk_hist_pm_ticker FOREIGN KEY (ticker) REFERENCES acoes(ticker)
);

CREATE INDEX idx_historico_preco_medio_usuario_id ON historico_preco_medio(usuario_id);
CREATE INDEX idx_historico_preco_medio_ticker ON historico_preco_medio(ticker);

-- ============================================================================
-- 13. TABELA COTACAO_ACOES (Dados de Mercado)
-- ============================================================================
CREATE TABLE cotacao_acoes (
    id SERIAL PRIMARY KEY,
    acao_id INTEGER NOT NULL REFERENCES acoes(id) ON DELETE CASCADE,
    data DATE NOT NULL,
    abertura DECIMAL(15,8),
    maxima DECIMAL(15,8),
    minima DECIMAL(15,8),
    fechamento DECIMAL(15,8),
    fechamento_ajustado DECIMAL(15,8),
    volume BIGINT,
    dividendos DECIMAL(15,8),
    splits DECIMAL(15,8),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(acao_id, data)
);

CREATE INDEX idx_cotacao_acao_data ON cotacao_acoes(acao_id, data);
CREATE INDEX idx_cotacao_data ON cotacao_acoes(data);
CREATE INDEX idx_cotacao_acao_id ON cotacao_acoes(acao_id);

-- ============================================================================
-- 14. TABELA FEEDBACK_USUARIO (Sistema de Feedback)
-- ============================================================================
CREATE TABLE feedback_usuario (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    categoria VARCHAR(50) NOT NULL DEFAULT 'geral',
    pagina_atual VARCHAR(100),
    mensagem TEXT NOT NULL,
    prioridade VARCHAR(10) DEFAULT 'media' CHECK (prioridade IN ('baixa', 'media', 'alta', 'critica')),
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pendente' CHECK (status IN ('pendente', 'analisando', 'resolvido', 'fechado'))
);

CREATE INDEX idx_feedback_usuario_id ON feedback_usuario(usuario_id);
CREATE INDEX idx_feedback_status ON feedback_usuario(status);
CREATE INDEX idx_feedback_prioridade ON feedback_usuario(prioridade);

-- ============================================================================
-- 15. TABELA MENSAGENS (Sistema de Notificações)
-- ============================================================================
CREATE TABLE mensagens (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
    titulo VARCHAR(255) NOT NULL,
    conteudo TEXT NOT NULL,
    tipo VARCHAR(20) DEFAULT 'info' CHECK (tipo IN ('info', 'aviso', 'erro', 'sucesso')),
    lida BOOLEAN DEFAULT FALSE,
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    data_expiracao TIMESTAMP
);

CREATE INDEX idx_mensagens_usuario_id ON mensagens(usuario_id);
CREATE INDEX idx_mensagens_lida ON mensagens(lida);
CREATE INDEX idx_mensagens_tipo ON mensagens(tipo);

-- ============================================================================
-- TRIGGERS PARA UPDATED_AT
-- ============================================================================

-- Função genérica para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Aplicar triggers nas tabelas relevantes
CREATE TRIGGER update_acoes_updated_at BEFORE UPDATE ON acoes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_usuarios_updated_at BEFORE UPDATE ON usuarios FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_usuario_configuracoes_updated_at BEFORE UPDATE ON usuario_configuracoes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_carteira_atual_updated_at BEFORE UPDATE ON carteira_atual FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_resultados_mensais_updated_at BEFORE UPDATE ON resultados_mensais FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_proventos_updated_at BEFORE UPDATE ON proventos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VIEWS ÚTEIS PARA PRODUÇÃO
-- ============================================================================

-- View: Carteira com informações das ações
CREATE VIEW vw_carteira_completa AS
SELECT 
    c.id,
    c.ticker,
    a.nome as nome_acao,
    a.razao_social,
    c.quantidade,
    c.preco_medio,
    c.custo_total,
    c.quantidade * c.preco_medio as valor_posicao,
    c.usuario_id,
    c.updated_at
FROM carteira_atual c
JOIN acoes a ON c.ticker = a.ticker
WHERE c.quantidade > 0;

-- View: Resumo de proventos por usuário
CREATE VIEW vw_proventos_usuario_resumo AS
SELECT 
    usuario_id,
    ticker_acao,
    COUNT(*) as total_proventos,
    SUM(valor_total_recebido) as total_recebido,
    MAX(dt_pagamento) as ultimo_pagamento,
    MIN(data_ex) as primeiro_provento
FROM usuario_proventos_recebidos
GROUP BY usuario_id, ticker_acao;

-- View: Performance por ticker
CREATE VIEW vw_performance_ticker AS
SELECT 
    of.ticker,
    of.usuario_id,
    a.nome as nome_acao,
    COUNT(*) as total_operacoes,
    SUM(CASE WHEN of.resultado > 0 THEN 1 ELSE 0 END) as operacoes_lucro,
    SUM(CASE WHEN of.resultado < 0 THEN 1 ELSE 0 END) as operacoes_prejuizo,
    SUM(of.resultado) as resultado_total,
    AVG(of.percentual_lucro) as percentual_lucro_medio
FROM operacoes_fechadas of
JOIN acoes a ON of.ticker = a.ticker
GROUP BY of.ticker, of.usuario_id, a.nome;

-- ============================================================================
-- COMENTÁRIOS E DOCUMENTAÇÃO
-- ============================================================================

COMMENT ON TABLE acoes IS 'Cadastro de ações e ativos negociáveis na B3';
COMMENT ON TABLE operacoes IS 'Registro de todas as operações de compra e venda';
COMMENT ON TABLE carteira_atual IS 'Posição consolidada atual do usuário em cada ativo';
COMMENT ON TABLE operacoes_fechadas IS 'Operações que foram fechadas (lucro/prejuízo realizado)';
COMMENT ON TABLE resultados_mensais IS 'Apuração mensal para fins de Imposto de Renda';
COMMENT ON TABLE proventos IS 'Proventos globais (dividendos, JCP) das ações';
COMMENT ON TABLE usuario_proventos_recebidos IS 'Cálculo personalizado de proventos por usuário';

-- ============================================================================
-- DADOS INICIAIS (SEEDS)
-- ============================================================================

-- Inserir funções padrão do sistema
INSERT INTO funcoes (nome, descricao) VALUES
('admin', 'Administrador do sistema'),
('user', 'Usuário padrão'),
('readonly', 'Usuário somente leitura');

-- ============================================================================
-- VERIFICAÇÕES DE INTEGRIDADE
-- ============================================================================

-- Verificar se todas as tabelas foram criadas
DO $$
DECLARE
    table_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO table_count 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
    AND table_name NOT LIKE 'pg_%';
    
    IF table_count >= 15 THEN
        RAISE NOTICE 'Migração concluída com sucesso! % tabelas criadas.', table_count;
    ELSE
        RAISE WARNING 'Migração pode estar incompleta. Apenas % tabelas encontradas.', table_count;
    END IF;
END $$;

COMMIT;