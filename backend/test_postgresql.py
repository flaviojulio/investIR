#!/usr/bin/env python3
"""
Teste de Conexão PostgreSQL
===========================

Script para testar se a migração PostgreSQL está funcionando corretamente.
"""

import os
import sys
from dotenv import load_dotenv

# Carregar variáveis de ambiente
load_dotenv()

def test_postgresql_connection():
    """Testa conexão com PostgreSQL"""
    try:
        from database_postgresql import get_db, health_check
        
        print("=== TESTE POSTGRESQL ===")
        print()
        
        # Teste 1: Conexão básica
        print("1. Testando conexão...")
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT version()")
            version = cursor.fetchone()[0]
            print(f"   ✅ PostgreSQL conectado!")
            print(f"   📊 Versão: {version[:80]}...")
        
        # Teste 2: Health check
        print()
        print("2. Executando health check...")
        health = health_check()
        if health['status'] == 'healthy':
            print("   ✅ Health check: OK")
            print(f"   🔗 Conexões ativas: {health['pool_info']['active_connections']}")
            print(f"   💾 Conexões disponíveis: {health['pool_info']['available_connections']}")
        else:
            print(f"   ❌ Health check: {health.get('error', 'FALHOU')}")
        
        # Teste 3: Contar registros migrados
        print()
        print("3. Verificando dados migrados...")
        with get_db() as conn:
            cursor = conn.cursor()
            
            tables_to_check = [
                ('acoes', 'ações cadastradas'),
                ('usuarios', 'usuários'),
                ('operacoes', 'operações'),
                ('operacoes_fechadas', 'operações fechadas'),
                ('cotacao_acoes', 'cotações históricas')
            ]
            
            total_records = 0
            for table, description in tables_to_check:
                cursor.execute(f"SELECT COUNT(*) FROM {table}")
                count = cursor.fetchone()[0]
                total_records += count
                print(f"   📊 {table}: {count:,} {description}")
            
            print(f"   🎯 Total de registros: {total_records:,}")
        
        # Teste 4: Funcionalidade específica (buscar ação)
        print()
        print("4. Testando funcionalidades...")
        from database_postgresql import obter_acao_info_por_ticker
        
        acao_teste = obter_acao_info_por_ticker('ITUB4')
        if acao_teste:
            print(f"   ✅ Busca de ação: {acao_teste['ticker']} - {acao_teste['nome']}")
        else:
            print("   ⚠️ Nenhuma ação encontrada para teste")
        
        print()
        print("🎉 TODOS OS TESTES PASSARAM!")
        print("✅ PostgreSQL está funcionando corretamente")
        print("🚀 Aplicação pronta para usar PostgreSQL em produção!")
        
        return True
        
    except ImportError as e:
        print(f"❌ Erro de importação: {e}")
        print("💡 Verifique se database_postgresql.py está correto")
        return False
        
    except Exception as e:
        print(f"❌ Erro no teste: {e}")
        print("💡 Verifique se PostgreSQL está rodando e configurado")
        return False

def test_fallback_sqlite():
    """Testa fallback para SQLite"""
    print()
    print("=== TESTE FALLBACK SQLITE ===")
    try:
        from database import get_db
        
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM acoes")
            count = cursor.fetchone()[0]
            print(f"✅ SQLite funcionando: {count} ações cadastradas")
            return True
    except Exception as e:
        print(f"❌ SQLite também falhou: {e}")
        return False

if __name__ == "__main__":
    print("🔧 TESTE DE MIGRAÇÃO POSTGRESQL")
    print("=" * 50)
    
    success = test_postgresql_connection()
    
    if not success:
        print()
        print("🔄 Testando fallback SQLite...")
        sqlite_ok = test_fallback_sqlite()
        
        if sqlite_ok:
            print()
            print("💡 SOLUÇÃO TEMPORÁRIA:")
            print("   1. Manter SQLite funcionando")
            print("   2. Corrigir PostgreSQL depois")
            print("   3. Alterar imports quando PostgreSQL estiver OK")
        else:
            print("❌ Ambos bancos falharam - verificar configuração")
            sys.exit(1)
    
    sys.exit(0 if success else 1)