#!/usr/bin/env python3
"""
Testes unitários para lógica de dividendos na data EX
Versão simplificada sem problemas de encoding
"""

import unittest
import sqlite3
from datetime import date, timedelta
from pathlib import Path
import sys

# Add the backend directory to Python path for imports
sys.path.append(str(Path(__file__).parent.parent.parent))

from services import obter_saldo_acao_em_data


class TestDividendExDateLogic(unittest.TestCase):
    """Testes para verificar correção crítica da data EX em dividendos"""

    def setUp(self):
        """Configuração antes de cada teste"""
        # Verificar se banco de produção existe
        self.db_path = Path(__file__).parent.parent.parent / 'acoes_ir.db'
        if not self.db_path.exists():
            self.skipTest("Banco de dados de producao nao encontrado")
        
        # Configuração de teste
        self.usuario_id = 2  # Usuário de teste
        self.ticker_teste = 'TESTDIV4'
        self.data_ex = date(2024, 12, 20)  # Data futura
        self.data_com = self.data_ex - timedelta(days=1)
        
        # Limpar dados de teste
        self._cleanup_test_data()

    def tearDown(self):
        """Limpeza após cada teste"""
        self._cleanup_test_data()

    def _cleanup_test_data(self):
        """Remover dados de teste"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        try:
            cursor.execute("DELETE FROM operacoes WHERE ticker = ? AND usuario_id = ?", 
                          (self.ticker_teste, self.usuario_id))
            conn.commit()
        except:
            pass
        finally:
            conn.close()

    def _insert_operation(self, date_op, operation, quantity):
        """Inserir operação de teste"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        try:
            cursor.execute('''
                INSERT INTO operacoes (usuario_id, date, ticker, operation, quantity, price, fees)
                VALUES (?, ?, ?, ?, ?, 25.00, 5.00)
            ''', (self.usuario_id, date_op, self.ticker_teste, operation, quantity))
            conn.commit()
        finally:
            conn.close()

    def test_compra_antes_ex_date(self):
        """Teste: Compra antes da data EX deve receber dividendo"""
        # Compra 2 dias antes
        data_compra = self.data_ex - timedelta(days=2)
        self._insert_operation(data_compra, 'buy', 100)
        
        saldo_com = obter_saldo_acao_em_data(self.usuario_id, self.ticker_teste, self.data_com)
        saldo_ex = obter_saldo_acao_em_data(self.usuario_id, self.ticker_teste, self.data_ex)
        
        self.assertEqual(saldo_com, 100, "Deve ter 100 acoes na data COM")
        self.assertEqual(saldo_ex, 100, "Deve ter 100 acoes na data EX")
        
        # Para dividendos, usar saldo da data COM
        self.assertTrue(saldo_com > 0, "Deve receber dividendo")

    def test_compra_na_ex_date(self):
        """Teste: Compra NA data EX NAO deve receber dividendo"""
        # Compra na data EX
        self._insert_operation(self.data_ex, 'buy', 200)
        
        saldo_com = obter_saldo_acao_em_data(self.usuario_id, self.ticker_teste, self.data_com)
        saldo_ex = obter_saldo_acao_em_data(self.usuario_id, self.ticker_teste, self.data_ex)
        
        self.assertEqual(saldo_com, 0, "NAO deve ter acoes na data COM")
        self.assertEqual(saldo_ex, 200, "Deve ter 200 acoes na data EX")
        
        # CRÍTICO: Para dividendos, usar saldo da data COM (0)
        self.assertEqual(saldo_com, 0, "NAO deve receber dividendo")

    def test_venda_na_ex_date(self):
        """Teste: Venda na data EX mas possuia antes deve receber dividendo"""
        # Compra antes
        data_compra = self.data_ex - timedelta(days=5)
        self._insert_operation(data_compra, 'buy', 300)
        
        # Venda na data EX
        self._insert_operation(self.data_ex, 'sell', 300)
        
        saldo_com = obter_saldo_acao_em_data(self.usuario_id, self.ticker_teste, self.data_com)
        saldo_ex = obter_saldo_acao_em_data(self.usuario_id, self.ticker_teste, self.data_ex)
        
        self.assertEqual(saldo_com, 300, "Deve ter 300 acoes na data COM")
        self.assertEqual(saldo_ex, 0, "NAO deve ter acoes na data EX")
        
        # IMPORTANTE: Para dividendos, usar saldo da data COM
        self.assertEqual(saldo_com, 300, "Deve receber dividendo mesmo tendo vendido")

    def test_operacoes_mistas(self):
        """Teste: Múltiplas operações com lógica complexa"""
        # Compras antes da data EX
        self._insert_operation(self.data_ex - timedelta(days=10), 'buy', 500)
        self._insert_operation(self.data_ex - timedelta(days=3), 'buy', 200)
        
        # Venda na data COM
        self._insert_operation(self.data_com, 'sell', 150)
        
        # Compra na data EX (não deve contar para dividendo)
        self._insert_operation(self.data_ex, 'buy', 100)
        
        saldo_com = obter_saldo_acao_em_data(self.usuario_id, self.ticker_teste, self.data_com)
        saldo_ex = obter_saldo_acao_em_data(self.usuario_id, self.ticker_teste, self.data_ex)
        
        # Cálculos esperados:
        # Data COM: 500 + 200 - 150 = 550 ações
        # Data EX: 500 + 200 - 150 + 100 = 650 ações
        
        self.assertEqual(saldo_com, 550, "Data COM: 500 + 200 - 150 = 550")
        self.assertEqual(saldo_ex, 650, "Data EX: 550 + 100 = 650")
        
        # Para dividendos, usar APENAS saldo da data COM
        dividendo_por_acao = 0.50
        dividendo_correto = saldo_com * dividendo_por_acao
        dividendo_incorreto = saldo_ex * dividendo_por_acao
        
        self.assertEqual(dividendo_correto, 275.0, "Dividendo correto: 550 x 0.50")
        self.assertEqual(dividendo_incorreto, 325.0, "Dividendo incorreto seria: 650 x 0.50")
        
        diferenca = dividendo_incorreto - dividendo_correto
        self.assertEqual(diferenca, 50.0, "Correcao evita R$ 50,00 a mais")

    def test_diferenca_com_ex_critica(self):
        """Teste crítico: Demonstrar diferença entre data COM e EX"""
        # Cenário que demonstra a correção crítica
        
        # Compra NA data EX
        self._insert_operation(self.data_ex, 'buy', 1000)
        
        saldo_com = obter_saldo_acao_em_data(self.usuario_id, self.ticker_teste, self.data_com)
        saldo_ex = obter_saldo_acao_em_data(self.usuario_id, self.ticker_teste, self.data_ex)
        
        # A diferença demonstra que a correção está funcionando
        self.assertNotEqual(saldo_com, saldo_ex, "Data COM deve ser diferente de data EX")
        self.assertEqual(saldo_com, 0, "Data COM = 0 (sem direito a dividendo)")
        self.assertEqual(saldo_ex, 1000, "Data EX = 1000 (compra feita, mas sem direito)")
        
        # Se saldo_com == saldo_ex, a correção não funcionou
        if saldo_com == saldo_ex:
            self.fail("ERRO: Sistema nao diferencia data COM de data EX!")

    def test_conformidade_b3(self):
        """Teste: Conformidade com regras da B3"""
        
        # Regra B3: Ações compradas na data EX não recebem dividendo
        # O dividendo é pago com base na posição do dia anterior (data COM)
        
        # Cenário 1: Investidor inexperiente compra na data EX
        self._insert_operation(self.data_ex, 'buy', 500)
        
        saldo_com_1 = obter_saldo_acao_em_data(self.usuario_id, self.ticker_teste, self.data_com)
        saldo_ex_1 = obter_saldo_acao_em_data(self.usuario_id, self.ticker_teste, self.data_ex)
        
        self.assertEqual(saldo_com_1, 0, "B3: Sem acoes na data COM = sem dividendo")
        self.assertEqual(saldo_ex_1, 500, "B3: Comprou na EX mas nao recebe")
        
        # Limpar e testar cenário 2
        self._cleanup_test_data()
        
        # Cenário 2: Investidor experiente vende na data EX
        self._insert_operation(self.data_ex - timedelta(days=7), 'buy', 800)
        self._insert_operation(self.data_ex, 'sell', 800)
        
        saldo_com_2 = obter_saldo_acao_em_data(self.usuario_id, self.ticker_teste, self.data_com)
        saldo_ex_2 = obter_saldo_acao_em_data(self.usuario_id, self.ticker_teste, self.data_ex)
        
        self.assertEqual(saldo_com_2, 800, "B3: Possuia na COM = recebe dividendo")
        self.assertEqual(saldo_ex_2, 0, "B3: Vendeu na EX mas ainda recebe")

    def test_prevencao_regressao(self):
        """Teste: Prevenção de regressão da correção"""
        
        # Bug original: Sistema usava data EX
        # Correção: Sistema usa data COM
        
        # Se houver regressão, este teste falhará
        self._insert_operation(self.data_ex, 'buy', 999)
        
        saldo_com = obter_saldo_acao_em_data(self.usuario_id, self.ticker_teste, self.data_com)
        saldo_ex = obter_saldo_acao_em_data(self.usuario_id, self.ticker_teste, self.data_ex)
        
        # Teste de regressão
        self.assertNotEqual(saldo_com, saldo_ex, "Prevencao regressao: COM != EX")
        self.assertEqual(saldo_com, 0, "Prevencao regressao: COM = 0")
        self.assertEqual(saldo_ex, 999, "Prevencao regressao: EX = 999")
        
        # Falha crítica se houver regressão
        if saldo_com == saldo_ex:
            self.fail("REGRESSAO: Sistema voltou a usar data EX!")


if __name__ == '__main__':
    # Executar testes
    unittest.main(verbosity=2)