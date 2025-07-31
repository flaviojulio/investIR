# 🤖 Agentes Claude - Projeto investIR

Este diretório contém agentes especializados do Claude para auxiliar no desenvolvimento, manutenção e evolução do sistema investIR. Cada agente possui conhecimento específico do projeto e está otimizado para tarefas particulares.

## 📋 Agentes Disponíveis

### 🔧 **code-refactorer** 
**Especialista em refatoração e melhoria de código**

- **Uso**: Melhorar estrutura, legibilidade e manutenibilidade do código
- **Conhece**: Arquitetura investIR, padrões do projeto, anti-padrões específicos
- **Foco**: `services.py` (2700+ linhas), componentes React complexos, duplicação de código
- **Comando**: `/code-refactorer`

**Exemplo de uso:**
```
"O arquivo services.py está muito grande e difícil de manter. Pode ajudar a refatorar?"
```

### 🎨 **frontend-designer**
**Arquiteto de design e UX especializado em fintech**

- **Uso**: Converter designs em especificações técnicas, criar sistemas de design
- **Conhece**: Stack completo (Next.js, TypeScript, Tailwind, shadcn/ui), padrões UX fiscais
- **Foco**: Interfaces educativas, design system consistente, componentes acessíveis
- **Comando**: `/frontend-designer`

**Exemplo de uso:**
```
"Preciso redesenhar a tela de resultados mensais para ser mais didática e intuitiva"
```

### 🔒 **security-auditor**
**Auditor de segurança especializado em dados financeiros**

- **Uso**: Realizar auditorias de segurança, identificar vulnerabilidades
- **Conhece**: Endpoints críticos, dados sensíveis (CPF, operações), compliance LGPD
- **Foco**: Autenticação JWT, isolamento de usuários, proteção de dados fiscais
- **Comando**: `/security-auditor`

**Exemplo de uso:**
```
"Pode fazer uma auditoria de segurança completa da nossa API de operações?"
```

### 💰 **tax-accounting-advisor**
**Consultor tributário especialista em mercado de capitals brasileiro**

- **Uso**: Orientação fiscal, validação de cálculos, compliance com Receita Federal
- **Conhece**: Legislação brasileira, regras B3/CVM, sistema fiscal do investIR
- **Foco**: Day trade vs swing trade, DARF, compensação de prejuízos, IRRF
- **Comando**: `/tax-accounting-advisor`

**Exemplo de uso:**
```
"Os cálculos de day trade estão corretos? Preciso validar a compensação de prejuízos"
```

## 🚀 Como Usar os Agentes

### Via Claude Code CLI
```bash
# Exemplo usando agente de refatoração
/code-refactorer "Ajude-me a refatorar o componente Dashboard.tsx que está muito complexo"

# Exemplo usando consultor fiscal  
/tax-accounting-advisor "Preciso revisar se os cálculos de IRRF estão conformes com a legislação"
```

### Via Task Tool
```typescript
// No contexto do Claude
Task({
  description: "Refatorar código complexo",
  prompt: "/code-refactorer Quebrar o arquivo services.py em módulos menores", 
  subagent_type: "general-purpose"
})
```

## 📚 Conhecimento Específico Compartilhado

### Arquitetura do Sistema
- **Frontend**: Next.js 14+ + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Python FastAPI + SQLAlchemy + SQLite (migrando para PostgreSQL)
- **Autenticação**: JWT custom em `auth.py`
- **Banco**: `acoes_ir.db` com 10+ tabelas principais

### Regras de Negócio Fiscais
- **Day Trade**: 20% IR + 1% IRRF sobre ganhos
- **Swing Trade**: 15% IR + 0,005% IRRF sobre vendas, isenção ≤ R$ 20k/mês
- **Compensação**: Prejuízos acumulados por tipo de operação
- **DARF**: Código 6015, vencimento último dia útil do mês seguinte

### Padrões de Código
- **Backend**: Prefixos `calcular_`, `obter_`, `validar_` para funções
- **Frontend**: PascalCase para componentes, hooks com `use`
- **Tipagem**: TypeScript rigoroso, interfaces bem definidas
- **Estilo**: Tailwind classes, mobile-first, componentes reutilizáveis

## 🎯 Casos de Uso por Agente

### 🔧 Code Refactorer
- [ ] Quebrar `services.py` em módulos especializados
- [ ] Simplificar componentes React complexos (>200 linhas) 
- [ ] Eliminar duplicação de lógica fiscal
- [ ] Padronizar tratamento de erros
- [ ] Otimizar queries de banco de dados

### 🎨 Frontend Designer  
- [ ] Redesign do modal DARF para ser mais educativo
- [ ] Sistema de design consistente para badges fiscais
- [ ] Melhoria da UX mobile nas tabelas complexas
- [ ] Interface de onboarding para novos usuários
- [ ] Padrão visual para estados de loading/erro

### 🔒 Security Auditor
- [ ] Auditoria completa de autenticação JWT
- [ ] Verificação de isolamento entre usuários  
- [ ] Análise de endpoints expostos
- [ ] Compliance LGPD (portabilidade, exclusão)
- [ ] Proteção contra SQL injection

### 💰 Tax Accounting Advisor
- [ ] Validação de fórmulas de IR e IRRF
- [ ] Conformidade com atualizações da Receita Federal
- [ ] Otimização de estratégias fiscais legais
- [ ] Auditoria de cálculos de day trade/swing trade
- [ ] Orientação sobre declaração de IR

## 📖 Documentação Relacionada

### Arquivos de Referência
- `CLAUDE.md`: Instruções principais do projeto
- `changelog.md`: Histórico de atualizações
- `tests/README.md`: Documentação de testes
- `DOCUMENTACAO_MENSAGERIA.md`: Sistema de notificações

### Conhecimento Fiscal
- Lei 11.033/2004: Tributação mercado financeiro
- IN RFB 1.585/2015: Operações financeiras
- Consultas RFB: Soluções oficiais
- B3/CVM: Normas operacionais

## 🔄 Atualizações e Manutenção

Os agentes são atualizados regularmente com:
- **Mudanças na legislação fiscal**: Novas regras da Receita Federal
- **Evolução do código**: Novos padrões e arquiteturas implementadas  
- **Feedback dos desenvolvedores**: Melhorias baseadas no uso real
- **Boas práticas**: Incorporação de novos conhecimentos técnicos

### Última Atualização
**Data**: Julho 2025  
**Versão**: 1.0  
**Principais melhorias**:
- Conhecimento específico do projeto investIR
- Padrões fiscais brasileiros
- Stack tecnológico completo
- Casos de uso práticos

---

## 💡 Dicas de Uso

### Máxima Eficiência
1. **Seja específico**: "Refatorar Dashboard.tsx" > "Melhorar código"
2. **Contextualize**: Mencione arquivos e funcionalidades específicas
3. **Combine agentes**: Use security-auditor após code-refactorer
4. **Teste sempre**: Valide sugestões com dados reais do sistema

### Casos Complexos
Para situações que envolvem múltiplas especialidades:
```bash
# 1. Primeiro o consultor fiscal
/tax-accounting-advisor "Validar regras de negócio"

# 2. Depois o refatorador  
/code-refactorer "Implementar melhorias na lógica fiscal"

# 3. Por último a segurança
/security-auditor "Auditar mudanças implementadas"
```

**Resultado**: Solução completa validada sob múltiplas perspectivas especializadas.