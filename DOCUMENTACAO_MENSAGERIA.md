# 📬 Sistema de Mensageria - investIR

## Visão Geral

O Sistema de Mensageria do investIR é uma funcionalidade completa que permite comunicação entre o sistema e os usuários através de notificações inteligentes, organizadas e categorizadas.

## 🎯 Características Principais

- **Notificações em tempo real** com contadores visuais
- **Categorização inteligente** de mensagens
- **Sistema de prioridades** com cores diferenciadas
- **Ações personalizáveis** com botões de direcionamento
- **Expiração automática** de mensagens
- **Interface responsiva** e intuitiva
- **Filtragem avançada** por status e categoria

---

## 📋 Estrutura do Sistema

### Tabela do Banco de Dados

```sql
CREATE TABLE mensagens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL,
    titulo TEXT NOT NULL,
    conteudo TEXT NOT NULL,
    tipo TEXT DEFAULT 'info',                    -- info, success, warning, error
    prioridade TEXT DEFAULT 'normal',            -- baixa, normal, alta, critica
    lida BOOLEAN DEFAULT 0,
    data_criacao TEXT DEFAULT CURRENT_TIMESTAMP,
    data_leitura TEXT NULL,
    remetente TEXT DEFAULT 'sistema',
    categoria TEXT DEFAULT 'geral',              -- geral, fiscal, atualizacao, boas-vindas, etc.
    acao_url TEXT NULL,                          -- Link opcional para ação
    acao_texto TEXT NULL,                        -- Texto do botão de ação
    expirar_em TEXT NULL,                        -- Data de expiração
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
);
```

### Tipos de Mensagem

| Tipo | Ícone | Cor | Uso |
|------|-------|-----|-----|
| `info` | ℹ️ | Azul | Informações gerais |
| `success` | ✅ | Verde | Confirmações e sucessos |
| `warning` | ⚠️ | Amarelo | Avisos importantes |
| `error` | ❌ | Vermelho | Erros e problemas |

### Níveis de Prioridade

| Prioridade | Cor da Borda | Fundo | Uso |
|------------|--------------|-------|-----|
| `baixa` | Cinza | Cinza claro | Informações opcionais |
| `normal` | Azul | Azul claro | Mensagens padrão |
| `alta` | Laranja | Laranja claro | Avisos importantes |
| `critica` | Vermelho | Vermelho claro | Ações urgentes |

---

## 🚀 Guia do Usuário

### Como Acessar

1. **Localização**: No header do Dashboard, ao lado do botão "Configurações"
2. **Ícone**: Sino (🔔) com badge de contagem quando há mensagens não lidas
3. **Clique**: Abre o modal da Central de Notificações

### Interface da Central de Notificações

#### Cabeçalho
- **Título**: "Central de Notificações"
- **Badge**: Mostra quantidade de mensagens não lidas
- **Controles**: Botões de atualizar e marcar todas como lidas

#### Abas de Filtro
1. **Todas**: Exibe todas as mensagens
2. **Não Lidas**: Apenas mensagens não visualizadas
3. **Importantes**: Mensagens com prioridade alta ou crítica
4. **Sistema**: Mensagens da categoria sistema

#### Ações Disponíveis

##### Por Mensagem
- **Marcar como lida**: Ícone ✓ (só aparece em mensagens não lidas)
- **Deletar**: Ícone ✗ (remove a mensagem permanentemente)
- **Ação personalizada**: Botão com link quando disponível

##### Ações em Lote
- **Atualizar**: Recarrega as mensagens do servidor
- **Marcar Todas como Lidas**: Remove o status "não lida" de todas as mensagens

### Elementos Visuais

#### Card de Mensagem
```
┌─────────────────────────────────────────────┐
│ [ÍCONE] Título da Mensagem          [Nova]  │ ← Cabeçalho
│                                    [✓] [✗]  │ ← Ações
├─────────────────────────────────────────────┤
│ Conteúdo detalhado da mensagem...           │ ← Corpo
│                                             │
│ há 2h • fiscal • alta    [Ver DARF] →      │ ← Rodapé
└─────────────────────────────────────────────┘
```

#### Indicadores Visuais
- **Barra lateral colorida**: Indica prioridade
- **Badge "Nova"**: Aparece em mensagens não lidas
- **Opacidade reduzida**: Mensagens já lidas ficam mais transparentes
- **Timestamps relativos**: "há 5 min", "há 2h", "há 3 dias"

---

## 💻 Guia do Desenvolvedor

### APIs Disponíveis

#### 1. Listar Mensagens
```http
GET /api/mensagens
```

**Parâmetros de Query:**
- `apenas_nao_lidas`: boolean (default: false)
- `categoria`: string (opcional)
- `limite`: number (default: 50)

**Resposta:**
```json
[
  {
    "id": 1,
    "usuario_id": 2,
    "titulo": "Bem-vindo ao investIR!",
    "conteudo": "Seja bem-vindo ao sistema...",
    "tipo": "success",
    "prioridade": "alta",
    "lida": false,
    "data_criacao": "2024-01-15T10:30:00",
    "data_leitura": null,
    "remetente": "sistema",
    "categoria": "boas-vindas",
    "acao_url": "/configuracoes",
    "acao_texto": "Configurar Perfil",
    "expirar_em": null
  }
]
```

#### 2. Criar Mensagem
```http
POST /api/mensagens
```

**Body:**
```json
{
  "usuario_id": 2,
  "titulo": "Nova Funcionalidade",
  "conteudo": "Descrição detalhada...",
  "tipo": "info",
  "prioridade": "normal",
  "categoria": "atualizacao",
  "acao_url": "/nova-funcionalidade",
  "acao_texto": "Explorar"
}
```

#### 3. Marcar como Lida
```http
PUT /api/mensagens/{mensagem_id}/lida
```

#### 4. Marcar Todas como Lidas
```http
PUT /api/mensagens/marcar-todas-lidas
```

#### 5. Deletar Mensagem
```http
DELETE /api/mensagens/{mensagem_id}
```

#### 6. Obter Estatísticas
```http
GET /api/mensagens/estatisticas
```

**Resposta:**
```json
{
  "total": 15,
  "nao_lidas": 3,
  "por_tipo": {
    "info": 2,
    "warning": 1
  },
  "por_prioridade": {
    "normal": 2,
    "alta": 1
  },
  "por_categoria": {
    "fiscal": 1,
    "sistema": 2
  }
}
```

### Funções de Banco de Dados

#### Criar Mensagem
```python
from database import criar_mensagem

mensagem_id = criar_mensagem(
    usuario_id=2,
    titulo="Lembrete Importante",
    conteudo="Não esqueça de verificar seus DARFs pendentes.",
    tipo="warning",
    prioridade="alta",
    categoria="fiscal",
    acao_url="/impostos",
    acao_texto="Ver DARFs"
)
```

#### Obter Mensagens
```python
from database import obter_mensagens_usuario

# Todas as mensagens do usuário
mensagens = obter_mensagens_usuario(usuario_id=2)

# Apenas não lidas
nao_lidas = obter_mensagens_usuario(usuario_id=2, apenas_nao_lidas=True)

# Por categoria
fiscais = obter_mensagens_usuario(usuario_id=2, categoria="fiscal")

# Com limite
recentes = obter_mensagens_usuario(usuario_id=2, limite=10)
```

#### Outras Funções
```python
from database import (
    marcar_mensagem_como_lida,
    marcar_todas_mensagens_como_lidas,
    deletar_mensagem,
    obter_estatisticas_mensagens,
    limpar_mensagens_expiradas
)

# Marcar como lida
sucesso = marcar_mensagem_como_lida(mensagem_id=1, usuario_id=2)

# Marcar todas como lidas
quantidade = marcar_todas_mensagens_como_lidas(usuario_id=2)

# Deletar mensagem
sucesso = deletar_mensagem(mensagem_id=1, usuario_id=2)

# Obter estatísticas
stats = obter_estatisticas_mensagens(usuario_id=2)

# Limpeza automática (executar periodicamente)
removidas = limpar_mensagens_expiradas()
```

---

## 🎨 Customização e Integração

### Adicionando Novas Categorias

Para criar uma nova categoria de mensagens:

```python
# 1. Criar mensagem com nova categoria
criar_mensagem(
    usuario_id=user_id,
    titulo="Análise de Carteira",
    conteudo="Sua carteira foi analisada com sucesso.",
    categoria="analise",  # Nova categoria
    tipo="success"
)

# 2. Adicionar filtro no frontend (se necessário)
# Em NotificationCenter.tsx, adicione uma nova aba:
<TabsTrigger value="analise">Análises</TabsTrigger>
```

### Mensagens com Expiração

```python
from datetime import datetime, timedelta

# Mensagem que expira em 7 dias
data_expiracao = (datetime.now() + timedelta(days=7)).isoformat()

criar_mensagem(
    usuario_id=user_id,
    titulo="Oferta Limitada",
    conteudo="Aproveite nossa promoção especial!",
    tipo="info",
    prioridade="normal",
    expirar_em=data_expiracao
)
```

### Mensagens Automáticas do Sistema

Exemplos de quando criar mensagens automaticamente:

```python
# Após importação de dados
def on_importacao_concluida(usuario_id, arquivo):
    criar_mensagem(
        usuario_id=usuario_id,
        titulo="Importação Concluída",
        conteudo=f"Arquivo {arquivo} foi importado com sucesso!",
        tipo="success",
        categoria="importacao"
    )

# Lembrete de DARF
def criar_lembrete_darf(usuario_id, mes_vencimento):
    criar_mensagem(
        usuario_id=usuario_id,
        titulo="Lembrete: DARF Pendente",
        conteudo=f"Você tem DARFs pendentes para {mes_vencimento}",
        tipo="warning",
        prioridade="alta",
        categoria="fiscal",
        acao_url="/impostos",
        acao_texto="Ver DARFs"
    )

# Novo usuário cadastrado
def mensagem_boas_vindas(usuario_id):
    criar_mensagem(
        usuario_id=usuario_id,
        titulo="Bem-vindo ao investIR!",
        conteudo="Configure seu perfil para uma experiência personalizada.",
        tipo="success",
        prioridade="alta",
        categoria="boas-vindas",
        acao_url="/configuracoes",
        acao_texto="Configurar Perfil"
    )
```

---

## 🔧 Manutenção e Administração

### Tarefas Periódicas

#### Limpeza de Mensagens Expiradas
Execute periodicamente (sugestão: cron job diário):

```python
from database import limpar_mensagens_expiradas

# Remove mensagens que passaram da data de expiração
mensagens_removidas = limpar_mensagens_expiradas()
print(f"Removidas {mensagens_removidas} mensagens expiradas")
```

#### Monitoramento de Uso
```python
from database import obter_estatisticas_mensagens

# Para todos os usuários ativos
usuarios_ativos = [1, 2, 3, 4, 5]  # IDs dos usuários

for user_id in usuarios_ativos:
    stats = obter_estatisticas_mensagens(user_id)
    if stats['nao_lidas'] > 10:
        print(f"Usuário {user_id} tem {stats['nao_lidas']} mensagens não lidas")
```

### Segurança

- ✅ **Isolamento por usuário**: Cada usuário só vê suas próprias mensagens
- ✅ **Validação de permissões**: APIs verificam autenticação
- ✅ **Sanitização**: Conteúdo das mensagens é tratado como texto puro
- ✅ **Rate limiting**: Considere implementar para criação de mensagens

---

## 📊 Métricas e Análise

### KPIs Importantes

1. **Taxa de Leitura**: `mensagens_lidas / total_mensagens`
2. **Tempo de Resposta**: Tempo entre criação e leitura
3. **Efetividade de CTAs**: Cliques em botões de ação
4. **Distribuição por Categoria**: Quais tipos são mais utilizados

### Queries Úteis

```sql
-- Mensagens mais lidas por categoria
SELECT categoria, AVG(CASE WHEN lida = 1 THEN 1.0 ELSE 0.0 END) as taxa_leitura
FROM mensagens 
GROUP BY categoria 
ORDER BY taxa_leitura DESC;

-- Usuários com mais mensagens não lidas
SELECT usuario_id, COUNT(*) as nao_lidas
FROM mensagens 
WHERE lida = 0 
GROUP BY usuario_id 
ORDER BY nao_lidas DESC;

-- Mensagens por período
SELECT DATE(data_criacao) as data, COUNT(*) as total
FROM mensagens 
WHERE data_criacao >= date('now', '-30 days')
GROUP BY DATE(data_criacao)
ORDER BY data DESC;
```

---

## 🚨 Solução de Problemas

### Problemas Comuns

#### Mensagens não aparecem
1. Verificar se o usuário está autenticado
2. Conferir se as mensagens não expiraram
3. Verificar logs do backend para erros de API

#### Contador não atualiza
1. Força refresh da página
2. Verificar se `onUnreadCountChange` está sendo chamado
3. Conferir estado do componente `NotificationCenter`

#### Performance lenta
1. Implementar paginação para usuários com muitas mensagens
2. Considerar cache no frontend
3. Otimizar queries do banco de dados

### Debug

#### Verificar mensagens via backend
```python
from database import obter_mensagens_usuario, obter_estatisticas_mensagens

usuario_id = 2  # ID do usuário
mensagens = obter_mensagens_usuario(usuario_id)
stats = obter_estatisticas_mensagens(usuario_id)

print(f"Total: {len(mensagens)}")
print(f"Estatísticas: {stats}")
```

#### Logs importantes
- `Erro ao listar mensagens usuário X`: Problema na API de listagem
- `Erro ao marcar mensagem como lida`: Problema de permissão ou ID inválido
- `Token inválido`: Problema de autenticação

---

## 🎯 Roadmap e Melhorias Futuras

### Funcionalidades Planejadas

1. **Push Notifications**: Notificações do navegador
2. **Email Integration**: Envio de mensagens importantes por email
3. **Rich Content**: Suporte a HTML básico nas mensagens
4. **Mensagens em Lote**: Envio para múltiplos usuários
5. **Templates**: Modelos pré-definidos de mensagens
6. **Analytics Dashboard**: Painel de métricas detalhado

### Otimizações Técnicas

1. **Cache Redis**: Para melhor performance
2. **WebSocket**: Atualizações em tempo real
3. **Queue System**: Para processamento assíncrono
4. **API Pagination**: Para grandes volumes de dados

---

## 📞 Suporte

Para dúvidas ou problemas com o sistema de mensageria:

1. **Consulte os logs** do backend para erros específicos
2. **Verifique o banco de dados** usando as queries de debug
3. **Teste as APIs** diretamente usando ferramentas como Postman
4. **Analise o código** nos arquivos principais:
   - Backend: `main.py`, `database.py`, `models.py`
   - Frontend: `NotificationCenter.tsx`, `Dashboard.tsx`

---

*Documentação criada em Janeiro 2025 - Sistema de Mensageria investIR v1.0*