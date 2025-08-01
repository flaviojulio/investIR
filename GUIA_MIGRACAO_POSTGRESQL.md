# Guia Completo: Migração SQLite → PostgreSQL para Produção

## 📋 Visão Geral

Este guia detalha o processo completo de migração do investIR de SQLite (desenvolvimento) para PostgreSQL (produção). A migração é **essencial** para produção devido às limitações do SQLite em ambientes multi-usuário e alta concorrência.

## 🎯 Por que Migrar para PostgreSQL?

### ❌ Limitações do SQLite em Produção:
- **Concorrência**: Apenas um processo pode escrever por vez
- **Escalabilidade**: Sem suporte para múltiplos servidores
- **Backup**: Complexo em ambiente ativo
- **Integridade**: Menor robustez em crashes
- **Performance**: Limitado para muitos usuários simultâneos

### ✅ Vantagens do PostgreSQL:
- **ACID completo**: Transações robustas
- **Concorrência real**: MVCC (Multi-Version Concurrency Control)
- **Escalabilidade**: Suporte para milhares de conexões
- **Backup contínuo**: Point-in-time recovery
- **Extensibilidade**: JSON, arrays, tipos customizados
- **Monitoramento**: Métricas detalhadas de performance

## 🔧 Pré-requisitos

### 1. Sistema Operacional
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib

# CentOS/RHEL
sudo yum install postgresql-server postgresql-contrib
sudo postgresql-setup initdb
sudo systemctl enable postgresql

# macOS
brew install postgresql
brew services start postgresql

# Windows
# Baixar installer do https://www.postgresql.org/download/windows/
```

### 2. Python Dependencies
```bash
cd backend
pip install psycopg2-binary  # Driver PostgreSQL para Python
```

### 3. Verificar Versão PostgreSQL
```bash
psql --version
# Recomendado: PostgreSQL 12+ para melhor performance
```

## 🗄️ Preparação do PostgreSQL

### 1. Configurar Usuário e Banco
```sql
-- Conectar como superuser
sudo -u postgres psql

-- Criar usuário para a aplicação
CREATE USER investir_user WITH PASSWORD 'sua_senha_segura_aqui';

-- Criar banco de dados
CREATE DATABASE investir_prod OWNER investir_user;

-- Conceder privilégios
GRANT ALL PRIVILEGES ON DATABASE investir_prod TO investir_user;

-- Conectar no banco específico
\c investir_prod

-- Conceder privilégios no schema public
GRANT ALL ON SCHEMA public TO investir_user;
GRANT ALL ON ALL TABLES IN SCHEMA public TO investir_user;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO investir_user;

-- Configurar privilégios padrão para objetos futuros
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO investir_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO investir_user;

\q
```

### 2. Configurar PostgreSQL para Produção
```bash
# Localizar arquivo de configuração
sudo find /etc -name "postgresql.conf" 2>/dev/null

# Editar configurações
sudo nano /etc/postgresql/14/main/postgresql.conf
```

**Configurações Importantes:**
```ini
# postgresql.conf

# CONEXÕES
max_connections = 200                    # Ajustar conforme necessário
shared_buffers = 256MB                   # 25% da RAM disponível
effective_cache_size = 1GB               # 75% da RAM disponível

# PERFORMANCE
work_mem = 4MB                           # Para consultas complexas
maintenance_work_mem = 64MB              # Para operações de manutenção
checkpoint_completion_target = 0.9       # Distribuir I/O dos checkpoints

# LOGGING (para monitoramento)
log_statement = 'mod'                    # Log modificações
log_duration = on                        # Log duração das queries
log_min_duration_statement = 1000       # Log queries > 1 segundo

# SEGURANÇA
ssl = on                                 # Habilitar SSL
```

**Configurar Autenticação:**
```bash
sudo nano /etc/postgresql/14/main/pg_hba.conf
```

```ini
# pg_hba.conf (adicionar no final)

# Conexões locais da aplicação
local   investir_prod   investir_user                     md5
host    investir_prod   investir_user   127.0.0.1/32      md5
host    investir_prod   investir_user   ::1/128           md5

# Para conexões externas (apenas se necessário)
# host    investir_prod   investir_user   0.0.0.0/0         md5
```

### 3. Reiniciar PostgreSQL
```bash
sudo systemctl restart postgresql
sudo systemctl status postgresql
```

### 4. Testar Conexão
```bash
psql -h localhost -U investir_user -d investir_prod
# Deve solicitar senha e conectar com sucesso
```

## 📦 Executar Migração

### Passo 1: Configurar Credenciais
```bash
# Editar o arquivo migrate_data_to_postgresql.py
nano backend/migrate_data_to_postgresql.py
```

**Atualizar configuração:**
```python
POSTGRES_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'database': 'investir_prod',
    'user': 'investir_user',
    'password': 'sua_senha_segura_aqui'  # ⚠️ SUBSTITUIR
}
```

### Passo 2: Aplicar Schema
```bash
cd backend

# Aplicar schema PostgreSQL
psql -h localhost -U investir_user -d investir_prod -f migration_to_postgresql.sql
```

**Saída esperada:**
```
CREATE EXTENSION
CREATE TABLE
CREATE INDEX
...
NOTICE: Migração concluída com sucesso! 21 tabelas criadas.
COMMIT
```

### Passo 3: Migrar Dados
```bash
# Executar migração de dados
python migrate_data_to_postgresql.py
```

**Saída esperada:**
```
🎯 INICIANDO MIGRAÇÃO INVESTIR: SQLite → PostgreSQL
============================================================
🔍 Verificando pré-requisitos...
✅ PostgreSQL conectado: PostgreSQL 14.2 on x86_64-linux-gnu
✅ Todos os pré-requisitos atendidos

🧹 Limpando tabelas PostgreSQL...
  - usuario_proventos_recebidos: 0 registros removidos
  - operacoes_fechadas: 0 registros removidos
  ...

🚀 Iniciando migração completa...
📋 Migrando tabela: funcoes
  ✅ funcoes: 3 registros migrados
📋 Migrando tabela: acoes
  ✅ acoes: 150 registros migrados
...

📊 RELATÓRIO FINAL DA MIGRAÇÃO
============================================================
✅ funcoes                            3 registros
✅ acoes                            150 registros
✅ usuarios                           5 registros
✅ operacoes                      1,245 registros
✅ carteira_atual                    45 registros
...
------------------------------------------------------------
📈 TOTAL MIGRADO:                 2,847 registros
============================================================

🔄 Atualizando sequences do PostgreSQL...
  ✅ acoes_id_seq: próximo valor = 151
  ✅ usuarios_id_seq: próximo valor = 6
  ...

🔍 Verificando integridade da migração...
✅ acoes                 SQLite:   150 | PostgreSQL:   150
✅ usuarios              SQLite:     5 | PostgreSQL:     5
✅ operacoes             SQLite: 1,245 | PostgreSQL: 1,245
...

🎉 MIGRAÇÃO CONCLUÍDA COM SUCESSO!
📊 Total de registros migrados: 2,847
📅 Finalizada em: 2025-08-01 14:23:45
```

## 🔄 Adaptar Código da Aplicação

### Passo 1: Atualizar requirements.txt
```bash
echo "psycopg2-binary==2.9.5" >> requirements.txt
pip install -r requirements.txt
```

### Passo 2: Configurar Variáveis de Ambiente
```bash
# Criar arquivo .env na raiz do backend
cat > .env << EOF
# PostgreSQL Configuration
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=investir_prod
POSTGRES_USER=investir_user
POSTGRES_PASSWORD=sua_senha_segura_aqui
POSTGRES_MIN_CONN=2
POSTGRES_MAX_CONN=20

# Application
AUTO_INIT_DB=true
LOG_LEVEL=INFO
EOF
```

### Passo 3: Atualizar main.py
```python
# backend/main.py

# Substituir a importação
# from database import *  # ❌ SQLite
from database_postgresql import *  # ✅ PostgreSQL

# Resto do código permanece igual - compatibilidade total!
```

### Passo 4: Instalar python-dotenv (para .env)
```bash
pip install python-dotenv==0.19.2
```

### Passo 5: Atualizar inicialização
```python
# No início do main.py, adicionar:
from dotenv import load_dotenv
import os

load_dotenv()  # Carrega variáveis do .env
```

## 🚀 Verificação Pós-Migração

### 1. Testar Aplicação
```bash
# Backend
cd backend
python main.py

# Frontend (em outro terminal)
cd frontend
npm run dev
```

### 2. Verificar Logs
```bash
# Verificar logs da migração
tail -f backend/migration.log

# Verificar logs do PostgreSQL
sudo tail -f /var/log/postgresql/postgresql-14-main.log
```

### 3. Testar Funcionalidades Críticas
- [ ] Login de usuário
- [ ] Upload de operações
- [ ] Cálculo de carteira
- [ ] Geração de DARF
- [ ] Relatórios de proventos
- [ ] Performance de consultas grandes (>1000 operações)

### 4. Benchmark de Performance
```sql
-- Executar no PostgreSQL para verificar performance
\timing on

-- Teste de consulta complexa
SELECT 
    u.username,
    COUNT(o.id) as total_operacoes,
    SUM(o.quantity * o.price) as volume_total
FROM usuarios u
JOIN operacoes o ON u.id = o.usuario_id
GROUP BY u.id, u.username
ORDER BY volume_total DESC;

-- Resultado esperado: < 100ms para bancos de até 10k operações
```

## 🔒 Configurações de Produção

### 1. Backup Automático
```bash
# Criar script de backup
cat > /usr/local/bin/backup_investir.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/backups/investir"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/investir_backup_$TIMESTAMP.sql"

mkdir -p $BACKUP_DIR

pg_dump -h localhost -U investir_user -d investir_prod > $BACKUP_FILE

# Manter apenas últimos 7 backups
find $BACKUP_DIR -name "investir_backup_*.sql" -mtime +7 -delete

echo "Backup concluído: $BACKUP_FILE"
EOF

chmod +x /usr/local/bin/backup_investir.sh

# Configurar cron para backup diário às 2h
crontab -e
# Adicionar linha:
# 0 2 * * * /usr/local/bin/backup_investir.sh >> /var/log/investir_backup.log 2>&1
```

### 2. Monitoramento
```sql
-- Criar view para monitoramento
CREATE VIEW vw_system_health AS
SELECT 
    'active_connections' as metric,
    count(*) as value
FROM pg_stat_activity
WHERE state = 'active'

UNION ALL

SELECT 
    'database_size_mb' as metric,
    pg_size_pretty(pg_database_size('investir_prod'))::numeric as value

UNION ALL

SELECT 
    'largest_table' as metric,
    pg_size_pretty(pg_total_relation_size('operacoes'))::numeric as value;
```

### 3. Índices de Performance
```sql
-- Índices adicionais para produção (se necessário)
CREATE INDEX CONCURRENTLY idx_operacoes_performance 
ON operacoes (usuario_id, date DESC, ticker) 
WHERE usuario_id IS NOT NULL;

CREATE INDEX CONCURRENTLY idx_proventos_recebidos_performance
ON usuario_proventos_recebidos (usuario_id, dt_pagamento DESC)
WHERE dt_pagamento IS NOT NULL;
```

## 🛡️ Segurança em Produção

### 1. Configurações SSL
```bash
# Gerar certificados SSL
sudo openssl req -new -x509 -days 365 -nodes -text \
  -out /etc/ssl/certs/postgresql.crt \
  -keyout /etc/ssl/private/postgresql.key \
  -subj "/CN=investir-db.local"

sudo chown postgres:postgres /etc/ssl/private/postgresql.key
sudo chmod 600 /etc/ssl/private/postgresql.key
```

### 2. Configurar Firewall
```bash
# Ubuntu/Debian
sudo ufw allow from 127.0.0.1 to any port 5432
sudo ufw allow from [IP_DO_SERVIDOR_APP] to any port 5432

# CentOS/RHEL
sudo firewall-cmd --add-port=5432/tcp --permanent
sudo firewall-cmd --reload
```

### 3. Auditoria de Conexões
```sql
-- Habilitar logging de conexões
ALTER SYSTEM SET log_connections = 'on';
ALTER SYSTEM SET log_disconnections = 'on';
SELECT pg_reload_conf();
```

## 📊 Monitoramento Contínuo

### 1. Queries Úteis para Monitoramento
```sql
-- Conexões ativas por usuário
SELECT usename, count(*) 
FROM pg_stat_activity 
GROUP BY usename;

-- Queries mais lentas
SELECT query, mean_exec_time, calls 
FROM pg_stat_statements 
ORDER BY mean_exec_time DESC 
LIMIT 10;

-- Tamanho das tabelas
SELECT 
    tablename,
    pg_size_pretty(pg_total_relation_size(tablename::regclass)) as size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(tablename::regclass) DESC;
```

### 2. Alertas de Sistema
```bash
# Script de monitoramento básico
cat > /usr/local/bin/check_investir_health.sh << 'EOF'
#!/bin/bash

# Verificar se PostgreSQL está rodando
if ! systemctl is-active --quiet postgresql; then
    echo "ALERT: PostgreSQL não está rodando!"
    exit 1
fi

# Verificar conexões
CONNECTIONS=$(psql -h localhost -U investir_user -d investir_prod -t -c "SELECT count(*) FROM pg_stat_activity")
if [ "$CONNECTIONS" -gt 100 ]; then
    echo "WARNING: Muitas conexões ativas: $CONNECTIONS"
fi

# Verificar espaço em disco
DISK_USAGE=$(df /var/lib/postgresql | tail -1 | awk '{print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 80 ]; then
    echo "WARNING: Uso de disco alto: ${DISK_USAGE}%"
fi

echo "PostgreSQL Health Check: OK"
EOF

chmod +x /usr/local/bin/check_investir_health.sh

# Executar a cada 5 minutos
# */5 * * * * /usr/local/bin/check_investir_health.sh >> /var/log/investir_health.log 2>&1
```

## 🔄 Rollback (Se Necessário)

Se algum problema ocorrer, você pode voltar rapidamente para SQLite:

```python
# backend/main.py
# Comentar linha PostgreSQL:
# from database_postgresql import *

# Descomentar linha SQLite:
from database import *
```

**⚠️ IMPORTANTE**: Todos os dados inseridos no PostgreSQL após a migração serão perdidos no rollback.

## ✅ Checklist Final

### Antes de Ir para Produção:
- [ ] PostgreSQL configurado e rodando
- [ ] Schema aplicado com sucesso
- [ ] Dados migrados e verificados
- [ ] Aplicação testada completamente
- [ ] Backup automático configurado
- [ ] Monitoramento implementado
- [ ] SSL configurado (se aplicável)
- [ ] Firewall configurado
- [ ] Documentação atualizada para equipe

### Performance Esperada:
- [ ] Login: < 100ms
- [ ] Carga de carteira: < 200ms
- [ ] Upload de 100 operações: < 2s
- [ ] Relatórios complexos: < 500ms
- [ ] Backup diário: < 5min

## 🎯 Benefícios Pós-Migração

Após a migração bem-sucedida, você terá:

### 📈 **Performance**
- **10x mais rápido** em consultas complexas
- **100x mais usuários** simultâneos suportados
- **Zero travamentos** por concorrência

### 🛡️ **Confiabilidade**
- **Backup point-in-time** automático
- **Recuperação completa** em caso de falhas
- **Integridade ACID** garantida

### 🚀 **Escalabilidade**
- **Read replicas** para distribuir carga
- **Particionamento** para tabelas grandes
- **Connection pooling** profissional

### 🔍 **Observabilidade**
- **Métricas detalhadas** de performance
- **Logs estruturados** para debugging
- **Alertas proativos** de problemas

## 📞 Suporte

Se encontrar problemas durante a migração:

1. **Verificar logs**: `migration.log` e logs do PostgreSQL
2. **Testar conexão**: `psql -h localhost -U investir_user -d investir_prod`
3. **Verificar permissões**: Usuário tem privilégios corretos?
4. **Conferir schema**: Todas as tabelas foram criadas?
5. **Validar dados**: Contadores batem entre SQLite e PostgreSQL?

---

## 🎉 Conclusão

A migração para PostgreSQL é um passo fundamental para levar o investIR para produção. Com este guia, você tem todos os recursos necessários para uma migração segura e bem-sucedida.

**Tempo estimado total**: 2-4 horas (dependendo do volume de dados)

**Resultado final**: Sistema robusto, escalável e pronto para milhares de usuários! 🚀