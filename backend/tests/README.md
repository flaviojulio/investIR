# 🧪 Testes Unitários - Sistema investIR

Suíte completa de testes para o sistema de gestão de investimentos, cobrindo os mais variados cenários de operações com ações.

## 📁 Estrutura dos Testes

```
tests/
├── conftest.py              # Configurações e fixtures globais
├── utils.py                 # Utilitários para testes
├── unit/                    # Testes unitários
│   ├── test_calculos.py     # Testes dos cálculos de operações
│   ├── test_database.py     # Testes das operações de banco
│   ├── test_api.py          # Testes dos endpoints da API
│   └── test_fiscal.py       # Testes dos cálculos fiscais/IR
├── integration/             # Testes de integração
│   └── test_workflow.py     # Testes de fluxos completos
└── README.md               # Esta documentação
```

## 🚀 Como Executar

### Instalação das Dependências

```bash
# Instalar dependências de teste
pip install -r requirements-test.txt

# Ou instalar individualmente
pip install pytest pytest-asyncio pytest-cov pytest-mock httpx factory-boy freezegun
```

### Executar Todos os Testes

```bash
# Executar todos os testes
python run_tests.py

# Ou usando pytest diretamente
pytest tests/
```

### Executar Tipos Específicos

```bash
# Apenas testes unitários
python run_tests.py --type unit

# Apenas testes de integração
python run_tests.py --type integration

# Com relatório de cobertura
python run_tests.py --coverage

# Modo verboso
python run_tests.py --verbose

# Pular testes lentos
python run_tests.py --fast
```

### Executar por Marcadores

```bash
# Apenas testes fiscais
python run_tests.py --markers fiscal

# Testes de operações e banco
python run_tests.py --markers "operations,database"

# Testes de API
python run_tests.py --markers api
```

### Executar Testes Específicos

```bash
# Testes com padrão no nome
python run_tests.py --pattern "day_trade"

# Arquivo específico
pytest tests/unit/test_calculos.py

# Função específica
pytest tests/unit/test_calculos.py::TestPosicaoAcao::test_adicionar_posicao_longa
```

## 🏷️ Marcadores de Teste

Os testes estão organizados com marcadores para facilitar a execução seletiva:

- `@pytest.mark.unit` - Testes unitários
- `@pytest.mark.integration` - Testes de integração
- `@pytest.mark.fiscal` - Testes relacionados a cálculos fiscais/IR
- `@pytest.mark.operations` - Testes de operações com ações
- `@pytest.mark.database` - Testes de operações de banco de dados
- `@pytest.mark.api` - Testes de endpoints da API
- `@pytest.mark.slow` - Testes que demoram mais para executar

## 📊 Cobertura de Testes

### Módulos Testados

#### 1. Cálculos de Operações (`test_calculos.py`)
- ✅ Classe `PosicaoAcao` - Gestão de posições longas e vendidas
- ✅ Cálculos de day trade com preço médio ponderado
- ✅ Processamento de swing trades
- ✅ Vendas a descoberto (short selling)
- ✅ Operações fracionadas e múltiplas
- ✅ Validações de operações fechadas

**Cenários Cobertos:**
- Day trade simples (lucro e prejuízo)
- Day trade com múltiplas operações
- Day trade com venda descoberto
- Swing trade com múltiplas compras
- Swing trade com vendas parciais
- Operações mistas no mesmo ticker
- Validações de consistência

#### 2. Operações de Banco (`test_database.py`)
- ✅ CRUD completo de operações
- ✅ Gestão de carteira atual
- ✅ Resultados mensais
- ✅ Sistema de importações
- ✅ Operações fechadas
- ✅ Gestão de usuários
- ✅ Testes de performance

**Cenários Cobertos:**
- Inserção/atualização/remoção de operações
- Isolamento entre usuários
- Carteira multi-ticker
- Persistência de resultados mensais
- Controle de importações duplicadas
- Performance com grandes volumes (1000+ operações)

#### 3. APIs e Endpoints (`test_api.py`)
- ✅ Autenticação e autorização
- ✅ CRUD de operações via API
- ✅ Endpoints de carteira
- ✅ Resultados e relatórios
- ✅ Sistema de mensageria
- ✅ Validação de entrada
- ✅ Tratamento de erros

**Cenários Cobertos:**
- Login com credenciais válidas/inválidas
- Acesso a endpoints protegidos
- Criação/listagem/deleção de operações
- Upload de arquivos
- Validações de dados de entrada
- Tratamento de erros HTTP
- Performance e concorrência

#### 4. Cálculos Fiscais (`test_fiscal.py`)
- ✅ Cálculo de IR para day trade (20%)
- ✅ Cálculo de IR para swing trade (15%)
- ✅ IRRF - day trade (1% sobre ganhos)
- ✅ IRRF - swing trade (0,005% sobre vendas)
- ✅ Compensação de prejuízos
- ✅ Isenção swing trade (< R$ 20k/mês)
- ✅ Geração de DARF
- ✅ Validações fiscais

**Cenários Cobertos:**
- Cálculo correto de alíquotas
- Compensação de prejuízos acumulados
- Verificação de isenção por volume
- Geração automática de DARF
- Valor mínimo de recolhimento (R$ 10)
- Cenários complexos com múltiplos tipos

#### 5. Fluxos de Integração (`test_workflow.py`)
- ✅ Fluxo completo: upload → cálculo → carteira
- ✅ Processamento de day trades end-to-end
- ✅ Fluxo de venda descoberto completo
- ✅ Compensação de prejuízos entre meses
- ✅ Importação de arquivos JSON
- ✅ Cenário de investidor ativo (6 meses)
- ✅ Recuperação após erros
- ✅ Performance com grandes volumes

## 🎯 Cenários de Teste Específicos

### Cenários Fiscais Complexos

1. **Investidor com Múltiplos Tipos de Operação**
   - Day trades com lucro e prejuízo
   - Swing trades isentos e tributáveis
   - Vendas descoberto
   - Compensação de prejuízos entre meses

2. **Cenário de Compensação**
   - Janeiro: prejuízo em day trade
   - Março: lucro que compensa prejuízo anterior
   - Verificação correta do IR devido

3. **Cenário de Isenção**
   - Swing trades com vendas < R$ 20.000/mês
   - Verificação de não tributação
   - IRRF ainda aplicado sobre vendas

### Cenários de Operações Complexas

1. **Day Trade com Múltiplas Operações**
   - Várias compras e uma venda
   - Preço médio ponderado correto
   - Cálculo de resultado preciso

2. **Swing Trade com Vendas Parciais**
   - Compra de 500, venda de 300, depois 200
   - Preço médio mantido corretamente
   - Duas operações fechadas geradas

3. **Venda Descoberto Complexa**
   - Venda sem posição prévia
   - Cobertura parcial ou total
   - Cálculo correto do resultado

## 🔍 Fixtures e Utilitários

### Fixtures Principais (`conftest.py`)

- `temp_db` - Banco de dados temporário para testes
- `db_session` - Sessão limpa para cada teste
- `sample_user` - Usuário de teste padrão
- `sample_stocks` - Ações cadastradas
- `sample_operations` - Conjunto de operações variadas
- `day_trade_scenario` - Cenário específico de day trade
- `swing_trade_scenario` - Cenário específico de swing trade
- `complex_scenario` - Cenário complexo multi-ticker

### Utilitários (`utils.py`)

- `gerar_operacoes_aleatorias()` - Gera operações para testes de volume
- `gerar_day_trades_aleatorios()` - Gera pares compra-venda mesmo dia
- `gerar_swing_trades_aleatorios()` - Gera operações em datas diferentes
- `validar_operacao_fechada()` - Valida consistência de operação fechada
- `calcular_estatisticas_operacoes()` - Estatísticas de conjunto de operações
- `criar_cenario_fiscal_complexo()` - Cenário com múltiplos tipos e meses

## ⚡ Performance e Otimização

### Benchmarks Incluídos

- **Inserção em massa**: 1000 operações em < 30 segundos
- **Consultas**: 100 consultas de operações em < 5 segundos
- **Cálculos complexos**: Processamento de 2000 operações em < 2 minutos
- **Recálculos**: Carteira + resultados em < 1 minuto

### Testes de Stress

- Volume alto de operações (2000+)
- Múltiplos usuários simultâneos
- Cenários de recuperação após erro
- Performance de consultas com grandes datasets

## 🐛 Debugging e Troubleshooting

### Executar com Debug

```bash
# Manter bancos de teste para inspeção
pytest --pdb-trace

# Saída detalhada de falhas
pytest --tb=long

# Mostrar print statements
pytest -s

# Executar apenas testes que falharam
pytest --lf
```

### Logs e Saídas

Os testes incluem funções de debug como `imprimir_resumo_teste()` que mostram:
- Número de operações processadas
- Volume financeiro total
- Resultados mensais calculados
- Estatísticas de performance

### Problemas Comuns

1. **Erro de Banco de Dados**
   - Verificar se `acoes_ir.db` está acessível
   - Rodar `criar_tabelas()` se necessário

2. **Falhas de Cálculo**
   - Verificar precisão decimal em comparações
   - Usar `assert_valores_proximos()` para comparações de float

3. **Timeouts em Testes Lentos**
   - Usar `--fast` para pular testes lentos
   - Ajustar timeout se necessário

## 📈 Métricas de Qualidade

### Cobertura de Código
- **Meta**: > 90% cobertura geral
- **Crítico**: 100% cobertura em cálculos fiscais
- **Relatório**: `htmlcov/index.html` após `--coverage`

### Tipos de Validação
- ✅ Validação de entrada (API)
- ✅ Consistência de dados (Database)
- ✅ Precisão de cálculos (Fiscal)
- ✅ Performance (Stress tests)
- ✅ Segurança (Isolamento de usuários)

## 🤝 Contribuindo

### Adicionando Novos Testes

1. **Testes Unitários**: Adicionar em `tests/unit/`
2. **Testes de Integração**: Adicionar em `tests/integration/`
3. **Usar Marcadores**: Aplicar `@pytest.mark.*` apropriados
4. **Documentar Cenários**: Incluir docstrings descritivas
5. **Validar Coverage**: Garantir que código novo está coberto

### Padrões de Código

- Nomes descritivos para testes: `test_cenario_especifico`
- Documentação em português para cenários de negócio
- Usar fixtures para setup comum
- Validar tanto casos positivos quanto negativos
- Incluir testes de edge cases

---

**Última atualização**: Julho 2025  
**Versão dos testes**: 1.0  
**Compatibilidade**: Python 3.11+, pytest 7.4+