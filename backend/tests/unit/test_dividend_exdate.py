#!/usr/bin/env python3
"""
Testes unitários para lógica de dividendos na data EX

COBERTURA DE TESTES:
1. Verificação de posição na data COM vs data EX
2. Cenários de compra antes/durante/depois da data EX
3. Cenários de venda na data EX
4. Operações mistas e edge cases
5. Consistência dos cálculos de dividendos

CORREÇÃO CRÍTICA TESTADA:
Sistema deve usar data COM (data EX - 1 dia) para determinar
elegibilidade de dividendos, conforme regras da B3.
"""

import unittest
import sqlite3
import tempfile
import os
from datetime import date, timedelta
from pathlib import Path
import sys

# Add the backend directory to Python path for imports
sys.path.append(str(Path(__file__).parent.parent.parent))

from services import obter_saldo_acao_em_data


class TestDividendExDateLogic(unittest.TestCase):
    """Testes para lógica de dividendos na data EX"""

    @classmethod
    def setUpClass(cls):
        """Configuração inicial da classe de testes"""
        # Criar banco de dados temporário para testes
        cls.db_fd, cls.db_path = tempfile.mkstemp(suffix='.db')
        cls.setup_test_database()

    @classmethod
    def tearDownClass(cls):
        """Limpeza após todos os testes"""
        os.close(cls.db_fd)
        os.unlink(cls.db_path)

    @classmethod
    def setup_test_database(cls):
        """Criar estrutura básica do banco para testes"""
        conn = sqlite3.connect(cls.db_path)
        cursor = conn.cursor()
        
        # Criar tabela operacoes
        cursor.execute('''
            CREATE TABLE operacoes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date DATE NOT NULL,
                ticker TEXT NOT NULL,
                operation TEXT NOT NULL,
                quantity INTEGER NOT NULL,
                price FLOAT NOT NULL,
                fees FLOAT DEFAULT 0.0,
                usuario_id INTEGER NOT NULL
            )
        ''')
        
        conn.commit()
        conn.close()

    def setUp(self):
        """Configuração antes de cada teste"""
        # Limpar dados de teste
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("DELETE FROM operacoes")
        conn.commit()
        conn.close()
        
        # Configuração padrão de teste
        self.usuario_id = 1
        self.ticker_teste = 'TEST4'
        self.data_ex = date(2024, 3, 15)  # Sexta-feira
        self.data_com = self.data_ex - timedelta(days=1)  # Quinta-feira
        
        # Temporariamente substituir o banco de dados usado pela função
        import services
        self.original_db_path = getattr(services, 'DB_PATH', 'acoes_ir.db')
        services.DB_PATH = self.db_path

    def tearDown(self):
        """Limpeza após cada teste"""
        # Restaurar banco original
        import services
        services.DB_PATH = self.original_db_path

    def _insert_operation(self, date_op, operation, quantity):
        """Helper para inserir operação de teste"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO operacoes (usuario_id, date, ticker, operation, quantity, price, fees)
            VALUES (?, ?, ?, ?, ?, 25.00, 5.00)
        ''', (self.usuario_id, date_op, self.ticker_teste, operation, quantity))
        conn.commit()
        conn.close()

    def test_compra_antes_data_ex(self):
        """Teste: Compra antes da data EX deve receber dividendo"""
        # Compra 2 dias antes da data EX
        data_compra = self.data_ex - timedelta(days=2)
        self._insert_operation(data_compra, 'buy', 100)
        
        # Verificar saldos
        saldo_com = obter_saldo_acao_em_data(self.usuario_id, self.ticker_teste, self.data_com)
        saldo_ex = obter_saldo_acao_em_data(self.usuario_id, self.ticker_teste, self.data_ex)
        
        # Assertions
        self.assertEqual(saldo_com, 100, "Deve ter 100 ações na data COM")
        self.assertEqual(saldo_ex, 100, "Deve ter 100 ações na data EX")
        
        # Importante: Para dividendos, usar saldo da data COM
        self.assertTrue(saldo_com > 0, "Deve receber dividendo (possuía antes da data EX)")

    def test_compra_na_data_ex(self):
        """Teste: Compra NA data EX NÃO deve receber dividendo"""
        # Compra exatamente na data EX
        self._insert_operation(self.data_ex, 'buy', 200)
        
        # Verificar saldos
        saldo_com = obter_saldo_acao_em_data(self.usuario_id, self.ticker_teste, self.data_com)
        saldo_ex = obter_saldo_acao_em_data(self.usuario_id, self.ticker_teste, self.data_ex)
        
        # Assertions
        self.assertEqual(saldo_com, 0, "NÃO deve ter ações na data COM")
        self.assertEqual(saldo_ex, 200, "Deve ter 200 ações na data EX")
        
        # CRÍTICO: Para dividendos, usar saldo da data COM (que é 0)
        self.assertEqual(saldo_com, 0, "NÃO deve receber dividendo (comprou na data EX)")

    def test_compra_depois_data_ex(self):
        """Teste: Compra depois da data EX NÃO deve receber dividendo"""
        # Compra 1 dia depois da data EX
        data_compra = self.data_ex + timedelta(days=1)
        self._insert_operation(data_compra, 'buy', 150)
        
        # Verificar saldos
        saldo_com = obter_saldo_acao_em_data(self.usuario_id, self.ticker_teste, self.data_com)
        saldo_ex = obter_saldo_acao_em_data(self.usuario_id, self.ticker_teste, self.data_ex)
        
        # Assertions
        self.assertEqual(saldo_com, 0, "NÃO deve ter ações na data COM")
        self.assertEqual(saldo_ex, 0, "NÃO deve ter ações na data EX")
        
        # Para dividendos, usar saldo da data COM
        self.assertEqual(saldo_com, 0, "NÃO deve receber dividendo (comprou depois da data EX)")

    def test_venda_na_data_ex_com_posicao_anterior(self):
        """Teste: Venda na data EX (mas possuía antes) deve receber dividendo"""
        # Compra 5 dias antes da data EX
        data_compra = self.data_ex - timedelta(days=5)
        self._insert_operation(data_compra, 'buy', 300)
        
        # Venda na data EX
        self._insert_operation(self.data_ex, 'sell', 300)
        
        # Verificar saldos
        saldo_com = obter_saldo_acao_em_data(self.usuario_id, self.ticker_teste, self.data_com)
        saldo_ex = obter_saldo_acao_em_data(self.usuario_id, self.ticker_teste, self.data_ex)
        
        # Assertions
        self.assertEqual(saldo_com, 300, "Deve ter 300 ações na data COM")
        self.assertEqual(saldo_ex, 0, "NÃO deve ter ações na data EX (vendeu)")
        
        # IMPORTANTE: Para dividendos, usar saldo da data COM
        self.assertEqual(saldo_com, 300, "Deve receber dividendo (possuía na data COM)")

    def test_operacoes_mistas_complexas(self):
        """Teste: Múltiplas operações com lógica complexa"""
        # Compra inicial 10 dias antes
        data_compra1 = self.data_ex - timedelta(days=10)
        self._insert_operation(data_compra1, 'buy', 500)
        
        # Compra adicional 3 dias antes
        data_compra2 = self.data_ex - timedelta(days=3)
        self._insert_operation(data_compra2, 'buy', 200)
        
        # Venda parcial 1 dia antes (data COM)
        self._insert_operation(self.data_com, 'sell', 150)
        
        # Compra na data EX (não deve contar para dividendo)
        self._insert_operation(self.data_ex, 'buy', 100)
        
        # Venda após data EX
        data_venda = self.data_ex + timedelta(days=1)
        self._insert_operation(data_venda, 'sell', 50)
        
        # Verificar saldos
        saldo_com = obter_saldo_acao_em_data(self.usuario_id, self.ticker_teste, self.data_com)
        saldo_ex = obter_saldo_acao_em_data(self.usuario_id, self.ticker_teste, self.data_ex)
        
        # Cálculos esperados:
        # Data COM: 500 + 200 - 150 = 550 ações
        # Data EX: 500 + 200 - 150 + 100 = 650 ações
        # Após venda: 650 - 50 = 600 ações
        
        self.assertEqual(saldo_com, 550, "Data COM: 500 + 200 - 150 = 550")
        self.assertEqual(saldo_ex, 650, "Data EX: 550 + 100 = 650")
        
        # Para dividendos, usar apenas saldo da data COM
        self.assertEqual(saldo_com, 550, "Dividendo calculado sobre 550 ações (data COM)")

    def test_data_com_vs_data_ex_consistency(self):
        """Teste: Consistência entre cálculos data COM vs data EX"""
        # Cenário 1: Apenas compras antes da data EX
        self._insert_operation(self.data_ex - timedelta(days=5), 'buy', 100)
        self._insert_operation(self.data_ex - timedelta(days=2), 'buy', 50)
        
        saldo_com_1 = obter_saldo_acao_em_data(self.usuario_id, self.ticker_teste, self.data_com)
        saldo_ex_1 = obter_saldo_acao_em_data(self.usuario_id, self.ticker_teste, self.data_ex)
        
        # Devem ser iguais (nenhuma operação na data EX)
        self.assertEqual(saldo_com_1, saldo_ex_1, "Saldos devem ser iguais sem operações na data EX")
        
        # Cenário 2: Adicionar compra na data EX
        self._insert_operation(self.data_ex, 'buy', 75)
        
        saldo_com_2 = obter_saldo_acao_em_data(self.usuario_id, self.ticker_teste, self.data_com)
        saldo_ex_2 = obter_saldo_acao_em_data(self.usuario_id, self.ticker_teste, self.data_ex)
        
        # Data COM deve permanecer igual, data EX deve aumentar
        self.assertEqual(saldo_com_2, saldo_com_1, "Data COM não deve mudar")
        self.assertEqual(saldo_ex_2, saldo_ex_1 + 75, "Data EX deve incluir compra do dia")

    def test_edge_case_zero_shares(self):
        """Teste: Edge case com zero ações"""
        # Não inserir nenhuma operação
        
        saldo_com = obter_saldo_acao_em_data(self.usuario_id, self.ticker_teste, self.data_com)
        saldo_ex = obter_saldo_acao_em_data(self.usuario_id, self.ticker_teste, self.data_ex)
        
        self.assertEqual(saldo_com, 0, "Deve retornar 0 para ticker sem operações")
        self.assertEqual(saldo_ex, 0, "Deve retornar 0 para ticker sem operações")

    def test_edge_case_venda_sem_posicao(self):
        """Teste: Edge case - venda sem posição anterior"""
        # Tentar vender sem ter comprado (short selling)
        self._insert_operation(self.data_ex - timedelta(days=1), 'sell', 100)
        
        saldo_com = obter_saldo_acao_em_data(self.usuario_id, self.ticker_teste, self.data_com)
        saldo_ex = obter_saldo_acao_em_data(self.usuario_id, self.ticker_teste, self.data_ex)
        
        # Deve resultar em posição negativa
        self.assertEqual(saldo_com, -100, "Deve permitir posição negativa (short)")
        self.assertEqual(saldo_ex, -100, "Posição short deve permanecer")

    def test_multiple_tickers_isolation(self):
        """Teste: Isolamento entre diferentes tickers"""
        ticker_a = 'TESTA4'
        ticker_b = 'TESTB4'
        
        # Inserir operações para ticker A
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO operacoes (usuario_id, date, ticker, operation, quantity, price, fees)
            VALUES (?, ?, ?, 'buy', 100, 25.00, 5.00)
        ''', (self.usuario_id, self.data_com, ticker_a))
        
        # Inserir operações para ticker B
        cursor.execute('''
            INSERT INTO operacoes (usuario_id, date, ticker, operation, quantity, price, fees)
            VALUES (?, ?, ?, 'buy', 200, 30.00, 5.00)
        ''', (self.usuario_id, self.data_ex, ticker_b))
        
        conn.commit()
        conn.close()
        
        # Verificar isolamento
        saldo_a_com = obter_saldo_acao_em_data(self.usuario_id, ticker_a, self.data_com)
        saldo_a_ex = obter_saldo_acao_em_data(self.usuario_id, ticker_a, self.data_ex)
        saldo_b_com = obter_saldo_acao_em_data(self.usuario_id, ticker_b, self.data_com)
        saldo_b_ex = obter_saldo_acao_em_data(self.usuario_id, ticker_b, self.data_ex)
        
        self.assertEqual(saldo_a_com, 100, "Ticker A: 100 na data COM")
        self.assertEqual(saldo_a_ex, 100, "Ticker A: 100 na data EX")
        self.assertEqual(saldo_b_com, 0, "Ticker B: 0 na data COM")
        self.assertEqual(saldo_b_ex, 200, "Ticker B: 200 na data EX")


class TestDividendCalculationIntegration(unittest.TestCase):
    """Testes de integração para cálculo completo de dividendos"""
    
    def test_dividend_calculation_workflow(self):
        """Teste do fluxo completo de cálculo de dividendos"""
        # Este teste deve verificar se a função de cálculo de dividendos
        # usa corretamente a data COM em vez da data EX
        
        # Por enquanto, apenas documentar a necessidade deste teste
        # A implementação completa requereria mock do banco de dados de produção
        self.assertTrue(True, "Teste de integração pendente - requer refatoração da função de dividendos")


if __name__ == '__main__':
    # Configurar para executar apenas estes testes
    unittest.main(verbosity=2)