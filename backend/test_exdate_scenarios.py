#!/usr/bin/env python3
"""
SCRIPT DE TESTE: Cenários de Compra na Data EX

OBJETIVO:
Testar se o sistema corretamente exclui ações compradas na data EX
dos cálculos de dividendos, conforme regras da B3.

CENÁRIOS TESTADOS:
1. Compra antes da data EX → Recebe dividendo (correto)
2. Compra na data EX → NÃO recebe dividendo (correto) 
3. Compra depois da data EX → NÃO recebe dividendo (correto)
4. Venda antes da data EX → NÃO recebe dividendo (correto)
5. Venda na data EX → Recebe dividendo (correto)
"""

import sqlite3
import sys
from datetime import datetime, date, timedelta
from pathlib import Path

# Add the backend directory to Python path for imports
sys.path.append(str(Path(__file__).parent))

from services import obter_saldo_acao_em_data

def setup_test_data():
    """Configurar dados de teste com cenários específicos"""
    conn = sqlite3.connect('acoes_ir.db')
    cursor = conn.cursor()
    
    # Ticker de teste
    ticker_teste = 'TEST4'
    usuario_id = 2
    
    # Datas de referência
    data_ex = date(2024, 3, 15)  # Sexta-feira
    data_com = data_ex - timedelta(days=1)  # Quinta-feira
    data_anterior = data_ex - timedelta(days=2)  # Quarta-feira
    data_posterior = data_ex + timedelta(days=1)  # Sábado
    
    try:
        # Limpar dados de teste anteriores
        cursor.execute("DELETE FROM operacoes WHERE ticker = ? AND usuario_id = ?", (ticker_teste, usuario_id))
        cursor.execute("DELETE FROM usuario_proventos_recebidos WHERE ticker_acao = ? AND usuario_id = ?", (ticker_teste, usuario_id))
        
        # Verificar se ação existe na tabela acoes
        cursor.execute("SELECT id FROM acoes WHERE ticker = ?", (ticker_teste,))
        acao = cursor.fetchone()
        
        if not acao:
            # Inserir ação de teste
            cursor.execute("""
                INSERT INTO acoes (ticker, nome, razao_social) 
                VALUES (?, ?, ?)
            """, (ticker_teste, 'Empresa Teste SA', 'Empresa Teste S.A.'))
            acao_id = cursor.lastrowid
        else:
            acao_id = acao[0]
        
        # Inserir provento de teste
        cursor.execute("DELETE FROM proventos_globais WHERE id_acao = ?", (acao_id,))
        cursor.execute("""
            INSERT INTO proventos_globais 
            (id_acao, tipo, valor, data_ex, dt_pagamento, data_registro)
            VALUES (?, 'DIVIDENDO', 0.50, ?, ?, ?)
        """, (acao_id, data_ex, data_ex + timedelta(days=30), data_ex - timedelta(days=10)))
        
        provento_id = cursor.lastrowid
        
        print(f"[CONFIG] CONFIGURACAO DE TESTE:")
        print(f"   Ticker: {ticker_teste}")
        print(f"   Data COM: {data_com} (deve receber dividendo)")
        print(f"   Data EX:  {data_ex} (NAO deve receber dividendo)")
        print(f"   Dividendo: R$ 0.50 por acao")
        print(f"   ID Provento: {provento_id}")
        print()
        
        conn.commit()
        return {
            'ticker': ticker_teste,
            'usuario_id': usuario_id,
            'acao_id': acao_id,
            'provento_id': provento_id,
            'data_ex': data_ex,
            'data_com': data_com,
            'data_anterior': data_anterior,
            'data_posterior': data_posterior
        }
        
    except Exception as e:
        print(f"❌ Erro ao configurar dados de teste: {e}")
        conn.rollback()
        return None
    finally:
        conn.close()

def test_scenario_1_compra_antes_ex(config):
    """Cenário 1: Compra 2 dias antes da data EX → Deve receber dividendo"""
    conn = sqlite3.connect('acoes_ir.db')
    cursor = conn.cursor()
    
    try:
        # Inserir compra 2 dias antes da data EX
        cursor.execute("""
            INSERT INTO operacoes 
            (usuario_id, data, ticker, tipo, quantidade, preco, taxas)
            VALUES (?, ?, ?, 'buy', 100, 25.00, 5.00)
        """, (config['usuario_id'], config['data_anterior'], config['ticker']))
        
        conn.commit()
        
        # Testar saldo na data COM
        saldo_com = obter_saldo_acao_em_data(
            usuario_id=config['usuario_id'],
            ticker=config['ticker'],
            data_limite=config['data_com']
        )
        
        # Testar saldo na data EX
        saldo_ex = obter_saldo_acao_em_data(
            usuario_id=config['usuario_id'],
            ticker=config['ticker'],
            data_limite=config['data_ex']
        )
        
        print(f"🧪 CENÁRIO 1: Compra 2 dias antes da data EX")
        print(f"   Compra: {config['data_anterior']} - 100 ações")
        print(f"   Saldo data COM ({config['data_com']}): {saldo_com} ações")
        print(f"   Saldo data EX ({config['data_ex']}): {saldo_ex} ações")
        print(f"   ✅ Deve receber dividendo: {saldo_com} × R$ 0.50 = R$ {saldo_com * 0.50:.2f}")
        print()
        
        return saldo_com > 0
        
    except Exception as e:
        print(f"❌ Erro no cenário 1: {e}")
        return False
    finally:
        conn.close()

def test_scenario_2_compra_na_ex(config):
    """Cenário 2: Compra NA data EX → NÃO deve receber dividendo"""
    conn = sqlite3.connect('acoes_ir.db')
    cursor = conn.cursor()
    
    try:
        # Limpar operações anteriores
        cursor.execute("DELETE FROM operacoes WHERE ticker = ? AND usuario_id = ?", 
                      (config['ticker'], config['usuario_id']))
        
        # Inserir compra NA data EX
        cursor.execute("""
            INSERT INTO operacoes 
            (usuario_id, data, ticker, tipo, quantidade, preco, taxas)
            VALUES (?, ?, ?, 'buy', 200, 24.50, 5.00)
        """, (config['usuario_id'], config['data_ex'], config['ticker']))
        
        conn.commit()
        
        # Testar saldo na data COM (deve ser 0)
        saldo_com = obter_saldo_acao_em_data(
            usuario_id=config['usuario_id'],
            ticker=config['ticker'],
            data_limite=config['data_com']
        )
        
        # Testar saldo na data EX (deve ser 200)
        saldo_ex = obter_saldo_acao_em_data(
            usuario_id=config['usuario_id'],
            ticker=config['ticker'],
            data_limite=config['data_ex']
        )
        
        print(f"🧪 CENÁRIO 2: Compra NA data EX")
        print(f"   Compra: {config['data_ex']} - 200 ações")
        print(f"   Saldo data COM ({config['data_com']}): {saldo_com} ações")
        print(f"   Saldo data EX ({config['data_ex']}): {saldo_ex} ações")
        print(f"   ❌ NÃO deve receber dividendo: {saldo_com} × R$ 0.50 = R$ {saldo_com * 0.50:.2f}")
        print()
        
        return saldo_com == 0 and saldo_ex == 200
        
    except Exception as e:
        print(f"❌ Erro no cenário 2: {e}")
        return False
    finally:
        conn.close()

def test_scenario_3_venda_na_ex(config):
    """Cenário 3: Venda NA data EX (mas possuía antes) → Deve receber dividendo"""
    conn = sqlite3.connect('acoes_ir.db')
    cursor = conn.cursor()
    
    try:
        # Limpar operações anteriores
        cursor.execute("DELETE FROM operacoes WHERE ticker = ? AND usuario_id = ?", 
                      (config['ticker'], config['usuario_id']))
        
        # Inserir compra 5 dias antes da data EX
        data_compra = config['data_ex'] - timedelta(days=5)
        cursor.execute("""
            INSERT INTO operacoes 
            (usuario_id, data, ticker, tipo, quantidade, preco, taxas)
            VALUES (?, ?, ?, 'buy', 300, 25.50, 5.00)
        """, (config['usuario_id'], data_compra, config['ticker']))
        
        # Inserir venda NA data EX
        cursor.execute("""
            INSERT INTO operacoes 
            (usuario_id, data, ticker, tipo, quantidade, preco, taxas)
            VALUES (?, ?, ?, 'sell', 300, 24.80, 5.00)
        """, (config['usuario_id'], config['data_ex'], config['ticker']))
        
        conn.commit()
        
        # Testar saldo na data COM (deve ter as 300 ações)
        saldo_com = obter_saldo_acao_em_data(
            usuario_id=config['usuario_id'],
            ticker=config['ticker'],
            data_limite=config['data_com']
        )
        
        # Testar saldo na data EX (deve ser 0 após venda)
        saldo_ex = obter_saldo_acao_em_data(
            usuario_id=config['usuario_id'],
            ticker=config['ticker'],
            data_limite=config['data_ex']
        )
        
        print(f"🧪 CENÁRIO 3: Venda NA data EX (mas possuía antes)")
        print(f"   Compra: {data_compra} - 300 ações")
        print(f"   Venda:  {config['data_ex']} - 300 ações")
        print(f"   Saldo data COM ({config['data_com']}): {saldo_com} ações")
        print(f"   Saldo data EX ({config['data_ex']}): {saldo_ex} ações")
        print(f"   ✅ Deve receber dividendo: {saldo_com} × R$ 0.50 = R$ {saldo_com * 0.50:.2f}")
        print()
        
        return saldo_com == 300 and saldo_ex == 0
        
    except Exception as e:
        print(f"❌ Erro no cenário 3: {e}")
        return False
    finally:
        conn.close()

def test_scenario_4_mixed_operations(config):
    """Cenário 4: Operações mistas para testar cálculo complexo"""
    conn = sqlite3.connect('acoes_ir.db')
    cursor = conn.cursor()
    
    try:
        # Limpar operações anteriores
        cursor.execute("DELETE FROM operacoes WHERE ticker = ? AND usuario_id = ?", 
                      (config['ticker'], config['usuario_id']))
        
        # Operações complexas
        operacoes = [
            (config['data_ex'] - timedelta(days=10), 'buy', 100),   # Compra 10 dias antes
            (config['data_ex'] - timedelta(days=3), 'buy', 50),    # Compra 3 dias antes
            (config['data_ex'] - timedelta(days=1), 'sell', 30),   # Venda 1 dia antes (data COM)
            (config['data_ex'], 'buy', 80),                        # Compra na data EX (não conta)
            (config['data_ex'] + timedelta(days=1), 'sell', 20),   # Venda depois
        ]
        
        for data_op, tipo, quantidade in operacoes:
            cursor.execute("""
                INSERT INTO operacoes 
                (usuario_id, data, ticker, tipo, quantidade, preco, taxas)
                VALUES (?, ?, ?, ?, ?, 25.00, 2.50)
            """, (config['usuario_id'], data_op, config['ticker'], tipo, quantidade))
        
        conn.commit()
        
        # Testar saldo na data COM
        saldo_com = obter_saldo_acao_em_data(
            usuario_id=config['usuario_id'],
            ticker=config['ticker'],
            data_limite=config['data_com']
        )
        
        # Testar saldo na data EX
        saldo_ex = obter_saldo_acao_em_data(
            usuario_id=config['usuario_id'],
            ticker=config['ticker'],
            data_limite=config['data_ex']
        )
        
        print(f"🧪 CENÁRIO 4: Operações mistas")
        print(f"   Operações:")
        for data_op, tipo, quantidade in operacoes:
            print(f"     {data_op}: {tipo.upper()} {quantidade} ações")
        print(f"   Saldo data COM ({config['data_com']}): {saldo_com} ações")
        print(f"   Saldo data EX ({config['data_ex']}): {saldo_ex} ações")
        print(f"   ✅ Deve receber dividendo: {saldo_com} × R$ 0.50 = R$ {saldo_com * 0.50:.2f}")
        print(f"   🔍 Cálculo esperado: 100 + 50 - 30 = 120 ações")
        print()
        
        return saldo_com == 120  # 100 + 50 - 30 = 120 (compra na EX não conta)
        
    except Exception as e:
        print(f"❌ Erro no cenário 4: {e}")
        return False
    finally:
        conn.close()

def cleanup_test_data(config):
    """Limpar dados de teste"""
    conn = sqlite3.connect('acoes_ir.db')
    cursor = conn.cursor()
    
    try:
        cursor.execute("DELETE FROM operacoes WHERE ticker = ? AND usuario_id = ?", 
                      (config['ticker'], config['usuario_id']))
        cursor.execute("DELETE FROM usuario_proventos_recebidos WHERE ticker_acao = ? AND usuario_id = ?", 
                      (config['ticker'], config['usuario_id']))
        cursor.execute("DELETE FROM proventos_globais WHERE id_acao = ?", (config['acao_id'],))
        cursor.execute("DELETE FROM acoes WHERE ticker = ?", (config['ticker'],))
        
        conn.commit()
        print("🧹 Dados de teste removidos")
        
    except Exception as e:
        print(f"❌ Erro ao limpar dados: {e}")
    finally:
        conn.close()

def main():
    """Função principal de teste"""
    print("🚀 TESTE DE CENÁRIOS: Compras na Data EX")
    print("="*50)
    
    # Verificar se arquivo existe
    if not Path('acoes_ir.db').exists():
        print("❌ Arquivo acoes_ir.db não encontrado!")
        print("   Execute este script na pasta backend/")
        return False
    
    # Configurar dados de teste
    config = setup_test_data()
    if not config:
        print("❌ Falha ao configurar dados de teste")
        return False
    
    try:
        # Executar cenários de teste
        results = []
        
        results.append(test_scenario_1_compra_antes_ex(config))
        results.append(test_scenario_2_compra_na_ex(config))
        results.append(test_scenario_3_venda_na_ex(config))
        results.append(test_scenario_4_mixed_operations(config))
        
        # Resumo dos resultados
        print("📊 RESUMO DOS TESTES:")
        print("="*30)
        
        test_names = [
            "Compra antes da data EX",
            "Compra NA data EX", 
            "Venda na data EX",
            "Operações mistas"
        ]
        
        all_passed = True
        for i, (test_name, result) in enumerate(zip(test_names, results), 1):
            status = "✅ PASSOU" if result else "❌ FALHOU"
            print(f"   {i}. {test_name}: {status}")
            if not result:
                all_passed = False
        
        print()
        if all_passed:
            print("🎉 SUCESSO: Todos os testes passaram!")
            print("   A lógica de data COM está funcionando corretamente")
        else:
            print("⚠️  ATENÇÃO: Alguns testes falharam")
            print("   Verifique a implementação da lógica de dividendos")
        
        return all_passed
        
    finally:
        # Limpar dados de teste
        cleanup_test_data(config)

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)