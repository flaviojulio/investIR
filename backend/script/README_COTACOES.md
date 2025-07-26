# Sistema de Cotações - InvestIR Backend

Este documento explica como usar o novo sistema de cotações integrado ao backend do InvestIR.

## 📋 **Visão Geral**

O sistema de cotações permite:
- ✅ Armazenar cotações históricas de ações (6 anos de dados)
- ✅ Consultar cotações via API REST
- ✅ Importar dados do Yahoo Finance automaticamente
- ✅ Integração completa com o sistema de ações existente

## 🗃️ **Estrutura do Banco de Dados**

### Tabela `cotacao_acoes`
- `id` - Chave primária auto-incremento
- `acao_id` - ID da ação (FK para tabela acoes)
- `data` - Data da cotação (YYYY-MM-DD)
- `abertura` - Preço de abertura
- `maxima` - Preço máximo do dia
- `minima` - Preço mínimo do dia
- `fechamento` - Preço de fechamento
- `fechamento_ajustado` - Preço de fechamento ajustado
- `volume` - Volume negociado
- `dividendos` - Dividendos pagos na data
- `splits` - Desdobramentos de ações

## 🚀 **Como Usar**

### 1. **Importação de Cotações**

#### Via Script Integrado
```bash
# Navegar para o diretório do script
cd "C:\Projeto Fortuna\investIR\backend\script"

# Importar todas as ações (6 anos de histórico)
python gerenciador_cotacoes_backend.py importar

# Importar com período personalizado (ex: 3 anos)
python gerenciador_cotacoes_backend.py importar 3

# Atualizar cotações específicas
python gerenciador_cotacoes_backend.py atualizar PETR4,VALE3,ITUB4 1

# Ver estatísticas
python gerenciador_cotacoes_backend.py stats
```

#### Via Menu Interativo
```bash
python gerenciador_cotacoes_backend.py
```

### 2. **API REST Endpoints**

#### **Consultar Cotações por Ticker (Melhorado)**
```http
# Buscar cotações com filtros flexíveis
GET /api/cotacoes/ticker/PETR4

# Parâmetros disponíveis:
# - data_inicio: Data inicial (YYYY-MM-DD)
# - data_fim: Data final (YYYY-MM-DD) 
# - data_unica: Data específica (substitui range)
# - limite: Máximo de registros (padrão: 50)
# - ultimos_dias: Últimos N dias

# Exemplos práticos:
GET /api/cotacoes/ticker/PETR4?data_unica=2024-12-20
GET /api/cotacoes/ticker/PETR4?ultimos_dias=30&limite=20
GET /api/cotacoes/ticker/PETR4?data_inicio=2024-01-01&data_fim=2024-12-31
```

#### **Cotação de Data Específica**
```http
GET /api/cotacoes/ticker/PETR4/data/2024-12-20
```

#### **Últimas N Cotações**
```http
# Últimas 10 cotações
GET /api/cotacoes/ticker/PETR4/ultimas/10

# Apenas dias úteis (seg-sex)
GET /api/cotacoes/ticker/PETR4/ultimas/20?apenas_dias_uteis=true
```

#### **Cotações Múltiplas Ações**
```http
# Comparar múltiplas ações em um período
GET /api/cotacoes/range-datas?tickers=PETR4,VALE3,ITUB4&data_inicio=2024-01-01&limite_por_acao=10
```

#### **Resumo de Cotação**
```http
# Resumo completo com estatísticas
GET /api/cotacoes/resumo/PETR4
```

#### **Comparação de Performance**
```http
# Comparar performance entre ações
GET /api/cotacoes/comparacao?tickers=PETR4,VALE3,ITUB4&data_inicio=2024-01-01&data_fim=2024-12-31
```

#### **Cotação Mais Recente**
```http
GET /api/cotacoes/ticker/PETR4/mais-recente
```

#### **Estatísticas Gerais**
```http
GET /api/cotacoes/estatisticas
```

#### Criar Cotação (Requer Autenticação)
```http
POST /api/cotacoes/ticker/PETR4
Content-Type: application/json
Authorization: Bearer <token>

{
    "acao_id": 123,
    "data": "2024-01-15",
    "abertura": 25.50,
    "maxima": 26.10,
    "minima": 25.30,
    "fechamento": 25.90,
    "fechamento_ajustado": 25.85,
    "volume": 1500000,
    "dividendos": 0.0,
    "splits": 0.0
}
```

### 3. **Uso Programático**

#### Importar Funções do Database
```python
from database import (
    obter_cotacoes_por_ticker,
    obter_cotacao_mais_recente_por_ticker,
    inserir_cotacao,
    obter_estatisticas_cotacoes
)

# Buscar cotações de uma ação
cotacoes = obter_cotacoes_por_ticker("PETR4", "2024-01-01", "2024-12-31")

# Cotação mais recente
cotacao_atual = obter_cotacao_mais_recente_por_ticker("PETR4")

# Estatísticas
stats = obter_estatisticas_cotacoes()
```

## 📊 **Exemplos de Uso**

### Exemplo 1: Importação Completa
```bash
# 1. Navegar para o diretório
cd "C:\Projeto Fortuna\investIR\backend\script"

# 2. Executar importação
python gerenciador_cotacoes_backend.py importar

# Saída esperada:
# 🚀 Iniciando importação de cotações para o backend
# 📊 Encontradas 150 ações para processar
# 📈 [1/150] Processando PETR4 - Petrobras
# ✅ PETR4: 1,547 cotações inseridas
# ...
# 📋 RELATÓRIO FINAL DA IMPORTAÇÃO
# ✅ Sucessos: 145
# ❌ Falhas: 5
# 📊 Total de cotações inseridas: 220,550
```

### Exemplo 2: Consulta via API (Melhorada)
```python
import requests

# 1. Buscar cotação de uma data específica
response = requests.get("http://localhost:8000/api/cotacoes/ticker/PETR4/data/2024-12-20")
cotacao = response.json()
print(f"PETR4 em 20/12/2024: R$ {cotacao['fechamento']}")

# 2. Buscar últimas 10 cotações apenas de dias úteis
response = requests.get("http://localhost:8000/api/cotacoes/ticker/PETR4/ultimas/10?apenas_dias_uteis=true")
cotacoes = response.json()

# 3. Comparar múltiplas ações
response = requests.get("http://localhost:8000/api/cotacoes/range-datas?tickers=PETR4,VALE3,ITUB4&ultimos_dias=30")
comparacao = response.json()

# 4. Obter resumo com estatísticas
response = requests.get("http://localhost:8000/api/cotacoes/resumo/PETR4")
resumo = response.json()
print(f"Performance 30 dias: {resumo['resumo_30_dias']['variacao_periodo']}%")

# 5. Comparação de performance
response = requests.get("http://localhost:8000/api/cotacoes/comparacao?tickers=PETR4,VALE3&data_inicio=2024-01-01")
ranking = response.json()
print("Ranking de performance:", ranking['ranking_performance'])
```

### Exemplo 3: Integração com Frontend (Avançada)
```javascript
// 1. Buscar dados para gráfico de candlestick
const fetchCandlestickData = async (ticker, dias = 30) => {
  const response = await fetch(`/api/cotacoes/ticker/${ticker}/ultimas/${dias}?apenas_dias_uteis=true`);
  const cotacoes = await response.json();
  
  return cotacoes.map(c => ({
    x: new Date(c.data),
    o: c.abertura,  // open
    h: c.maxima,    // high
    l: c.minima,    // low
    c: c.fechamento // close
  }));
};

// 2. Comparar múltiplas ações para dashboard
const compararAcoes = async (tickers, periodo = 90) => {
  const tickersList = tickers.join(',');
  const response = await fetch(`/api/cotacoes/comparacao?tickers=${tickersList}&data_inicio=${getDateBefore(periodo)}`);
  const comparacao = await response.json();
  
  // Dados prontos para gráficos de linha comparativa
  return comparacao.resultados;
};

// 3. Widget de cotação em tempo real (simulado)
const criarWidgetCotacao = async (ticker) => {
  const response = await fetch(`/api/cotacoes/resumo/${ticker}`);
  const resumo = await response.json();
  
  const widget = document.createElement('div');
  widget.innerHTML = `
    <h3>${ticker}</h3>
    <div class="preco">R$ ${resumo.cotacao_atual.fechamento}</div>
    <div class="variacao ${resumo.resumo_30_dias.variacao_periodo >= 0 ? 'positiva' : 'negativa'}">
      ${resumo.resumo_30_dias.variacao_periodo}% (30d)
    </div>
  `;
  
  return widget;
};

// 4. Filtros inteligentes para análise
const buscarCotacoesFiltradas = async (ticker, filtro) => {
  let url = `/api/cotacoes/ticker/${ticker}`;
  
  switch(filtro) {
    case 'semana':
      url += '/ultimas/5?apenas_dias_uteis=true';
      break;
    case 'mes':
      url += '?ultimos_dias=30';
      break;
    case 'trimestre':
      url += '?ultimos_dias=90';
      break;
    case 'ano':
      url += '?ultimos_dias=365';
      break;
    default:
      url += '?limite=50';
  }
  
  const response = await fetch(url);
  return await response.json();
};
```

## 🎯 **Novos Recursos de Filtragem**

### **Parâmetros de Data Flexíveis**
- `data_unica`: Busca cotação de uma data específica
- `data_inicio`/`data_fim`: Range de datas tradicional
- `ultimos_dias`: Últimos N dias automaticamente
- `limite`: Controle de quantidade de resultados (padrão: 50)

### **Filtros Especiais**
- `apenas_dias_uteis`: Filtra segunda a sexta-feira
- `limite_por_acao`: Em consultas múltiplas, limita por ação
- Validação automática de ranges de data
- Ordenação inteligente (mais recente primeiro)

### **Endpoints de Análise**
- `/resumo/{ticker}`: Estatísticas dos últimos 30 e 365 dias
- `/comparacao`: Ranking de performance entre ações
- `/range-datas`: Múltiplas ações em uma consulta
- `/ultimas/{quantidade}`: Últimas N cotações

### **Benefícios da Filtragem**
- ✅ **Performance**: Menos dados transferidos
- ✅ **Precisão**: Dados exatos para análise
- ✅ **Flexibilidade**: Múltiplas formas de consulta
- ✅ **Eficiência**: Reduz tráfego de rede

### Variáveis de Ambiente
```bash
# Não são necessárias configurações adicionais
# O sistema usa o banco de dados padrão: acoes_ir.db
```

### Dependências
```bash
# Instalar dependências do backend (se ainda não instaladas)
pip install yfinance pandas fastapi uvicorn

# Ou usar o requirements.txt existente
pip install -r requirements.txt
```

## 📝 **Logs e Monitoramento**

### Logs de Importação
- ✅ Sucessos e falhas são logados
- 📊 Estatísticas detalhadas
- ⚠️ Avisos para ações sem dados
- ❌ Erros com detalhes

### Monitoramento via API
```http
GET /api/cotacoes/estatisticas
```
Retorna:
- Total de registros
- Número de ações com cotações
- Período de dados disponível
- Top ações por volume de dados

## 🛠️ **Manutenção**

### Limpeza de Dados
```python
from database import limpar_cotacoes_acao

# Remover todas as cotações de uma ação
registros_removidos = limpar_cotacoes_acao(acao_id=123)
```

### Verificação de Integridade
```python
from database import verificar_cotacoes_existentes

# Verificar se existem dados para um período
existe = verificar_cotacoes_existentes(123, "2024-01-01", "2024-12-31")
```

## 🔍 **Troubleshooting**

### Problemas Comuns

1. **Erro: "Ticker não encontrado"**
   - Verificar se a ação está cadastrada na tabela `acoes`
   - Usar o endpoint `/api/acoes` para listar ações disponíveis

2. **Erro: "Nenhuma cotação encontrada"**
   - Verificar se o ticker existe no Yahoo Finance
   - Alguns tickers podem ter sufixo `.SA` automaticamente adicionado

3. **Erro de importação em massa**
   - Verificar conexão com internet
   - API do Yahoo Finance pode ter limites de rate

4. **Performance lenta**
   - Os índices são criados automaticamente
   - Para grandes volumes, considerar batch imports

### Debug
```python
import logging
logging.basicConfig(level=logging.DEBUG)

# Executar importação com logs detalhados
```

## 📈 **Próximos Passos**

- [ ] Cache de cotações em Redis para performance
- [ ] Atualização automática via scheduled tasks
- [ ] WebSocket para cotações em tempo real
- [ ] Integração com outros provedores de dados
- [ ] Indicadores técnicos calculados (RSI, médias móveis, etc.)

## 🤝 **Contribuição**

Para adicionar novas funcionalidades:

1. Adicionar funções em `database.py`
2. Criar endpoints em `cotacoes_router.py`
3. Adicionar schemas em `schemas.py`
4. Atualizar documentação

---

📧 **Suporte**: Entre em contato para dúvidas ou sugestões sobre o sistema de cotações.
