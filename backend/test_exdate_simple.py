#!/usr/bin/env python3
"""
SCRIPT DE TESTE: Cenarios de Compra na Data EX (Versao Simples)

OBJETIVO:
Testar se o sistema corretamente exclui acoes compradas na data EX
dos calculos de dividendos, conforme regras da B3.
"""

import sqlite3
import sys
from datetime import datetime, date, timedelta
from pathlib import Path

# Add the backend directory to Python path for imports
sys.path.append(str(Path(__file__).parent))

from services import obter_saldo_acao_em_data

def main():
    """Funcao principal de teste"""
    print("TESTE DE CENARIOS: Compras na Data EX")
    print("="*50)
    
    # Verificar se arquivo existe
    if not Path('acoes_ir.db').exists():
        print("ERRO: Arquivo acoes_ir.db nao encontrado!")
        print("   Execute este script na pasta backend/")
        return False
    
    # Configuracao de teste
    ticker_teste = 'TEST4'
    usuario_id = 2
    data_ex = date(2024, 3, 15)  # Sexta-feira
    data_com = data_ex - timedelta(days=1)  # Quinta-feira
    data_anterior = data_ex - timedelta(days=2)  # Quarta-feira
    
    conn = sqlite3.connect('acoes_ir.db')
    cursor = conn.cursor()
    
    try:
        # Limpar dados de teste anteriores
        cursor.execute("DELETE FROM operacoes WHERE ticker = ? AND usuario_id = ?", (ticker_teste, usuario_id))
        conn.commit()
        
        print(f"CONFIGURACAO:")
        print(f"   Ticker: {ticker_teste}")
        print(f"   Data COM: {data_com}")
        print(f"   Data EX:  {data_ex}")
        print()
        
        # CENARIO 1: Compra antes da data EX
        print("CENARIO 1: Compra 2 dias antes da data EX")
        cursor.execute("""
            INSERT INTO operacoes 
            (usuario_id, date, ticker, operation, quantity, price, fees)
            VALUES (?, ?, ?, 'buy', 100, 25.00, 5.00)
        """, (usuario_id, data_anterior, ticker_teste))
        conn.commit()
        
        saldo_com_1 = obter_saldo_acao_em_data(usuario_id, ticker_teste, data_com)
        saldo_ex_1 = obter_saldo_acao_em_data(usuario_id, ticker_teste, data_ex)
        
        print(f"   Compra: {data_anterior} - 100 acoes")
        print(f"   Saldo data COM: {saldo_com_1} acoes")
        print(f"   Saldo data EX: {saldo_ex_1} acoes")
        print(f"   Resultado: {'CORRETO' if saldo_com_1 == 100 else 'ERRO'}")
        print()
        
        # CENARIO 2: Compra NA data EX
        print("CENARIO 2: Compra NA data EX")
        cursor.execute("DELETE FROM operacoes WHERE ticker = ? AND usuario_id = ?", (ticker_teste, usuario_id))
        cursor.execute("""
            INSERT INTO operacoes 
            (usuario_id, date, ticker, operation, quantity, price, fees)
            VALUES (?, ?, ?, 'buy', 200, 24.50, 5.00)
        """, (usuario_id, data_ex, ticker_teste))
        conn.commit()
        
        saldo_com_2 = obter_saldo_acao_em_data(usuario_id, ticker_teste, data_com)
        saldo_ex_2 = obter_saldo_acao_em_data(usuario_id, ticker_teste, data_ex)
        
        print(f"   Compra: {data_ex} - 200 acoes")
        print(f"   Saldo data COM: {saldo_com_2} acoes")
        print(f"   Saldo data EX: {saldo_ex_2} acoes")
        print(f"   Resultado: {'CORRETO' if saldo_com_2 == 0 and saldo_ex_2 == 200 else 'ERRO'}")
        print()
        
        # CENARIO 3: Operacoes mistas
        print("CENARIO 3: Operacoes mistas")
        cursor.execute("DELETE FROM operacoes WHERE ticker = ? AND usuario_id = ?", (ticker_teste, usuario_id))
        
        # Compra 5 dias antes
        data_compra = data_ex - timedelta(days=5)
        cursor.execute("""
            INSERT INTO operacoes 
            (usuario_id, date, ticker, operation, quantity, price, fees)
            VALUES (?, ?, ?, 'buy', 300, 25.50, 5.00)
        """, (usuario_id, data_compra, ticker_teste))
        
        # Venda parcial 1 dia antes (data COM)
        cursor.execute("""
            INSERT INTO operacoes 
            (usuario_id, date, ticker, operation, quantity, price, fees)
            VALUES (?, ?, ?, 'sell', 100, 25.80, 5.00)
        """, (usuario_id, data_com, ticker_teste))
        
        # Compra na data EX (nao deve contar)
        cursor.execute("""
            INSERT INTO operacoes 
            (usuario_id, date, ticker, operation, quantity, price, fees)
            VALUES (?, ?, ?, 'buy', 50, 24.20, 5.00)
        """, (usuario_id, data_ex, ticker_teste))
        
        conn.commit()
        
        saldo_com_3 = obter_saldo_acao_em_data(usuario_id, ticker_teste, data_com)
        saldo_ex_3 = obter_saldo_acao_em_data(usuario_id, ticker_teste, data_ex)
        
        print(f"   Compra: {data_compra} - 300 acoes")
        print(f"   Venda:  {data_com} - 100 acoes")
        print(f"   Compra: {data_ex} - 50 acoes (nao conta)")
        print(f"   Saldo data COM: {saldo_com_3} acoes")
        print(f"   Saldo data EX: {saldo_ex_3} acoes")
        print(f"   Esperado COM: 200 acoes (300-100)")
        print(f"   Esperado EX: 250 acoes (300-100+50)")
        print(f"   Resultado: {'CORRETO' if saldo_com_3 == 200 and saldo_ex_3 == 250 else 'ERRO'}")
        print()
        
        # Resumo
        print("RESUMO DOS TESTES:")
        print("="*30)
        
        teste1_ok = saldo_com_1 == 100
        teste2_ok = saldo_com_2 == 0 and saldo_ex_2 == 200
        teste3_ok = saldo_com_3 == 200 and saldo_ex_3 == 250
        
        print(f"   1. Compra antes da data EX: {'PASSOU' if teste1_ok else 'FALHOU'}")
        print(f"   2. Compra NA data EX: {'PASSOU' if teste2_ok else 'FALHOU'}")
        print(f"   3. Operacoes mistas: {'PASSOU' if teste3_ok else 'FALHOU'}")
        print()
        
        all_passed = teste1_ok and teste2_ok and teste3_ok
        
        if all_passed:
            print("SUCESSO: Todos os testes passaram!")
            print("A logica de data COM esta funcionando corretamente")
        else:
            print("ATENCAO: Alguns testes falharam")
            print("Verifique a implementacao da logica de dividendos")
        
        return all_passed
        
    except Exception as e:
        print(f"ERRO durante teste: {e}")
        return False
    finally:
        # Limpar dados de teste
        cursor.execute("DELETE FROM operacoes WHERE ticker = ? AND usuario_id = ?", (ticker_teste, usuario_id))
        conn.commit()
        conn.close()

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)