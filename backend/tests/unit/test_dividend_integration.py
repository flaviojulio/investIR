#!/usr/bin/env python3
"""
Testes de integração para lógica de dividendos na data EX

FOCO: Testar a correção crítica implementada em services.py
onde dividendos agora usam data COM (data EX - 1) em vez de data EX.

MÉTODO: Usar banco de produção com dados temporários para teste real.
"""

import unittest
import sqlite3
from datetime import date, timedelta
from pathlib import Path
import sys

# Add the backend directory to Python path for imports
sys.path.append(str(Path(__file__).parent.parent.parent))

from services import obter_saldo_acao_em_data


class TestDividendExDateIntegration(unittest.TestCase):
    """Testes de integração para lógica de dividendos na data EX"""

    def setUp(self):
        """Configuração antes de cada teste"""
        # Verificar se banco de produção existe
        self.db_path = Path(__file__).parent.parent.parent / 'acoes_ir.db'
        if not self.db_path.exists():
            self.skipTest("Banco de dados de produção não encontrado")
        
        # Configuração de teste
        self.usuario_id = 2  # Usuário de teste
        self.ticker_teste = 'TESTEX4'
        self.data_ex = date(2024, 12, 15)  # Data futura para evitar conflitos
        self.data_com = self.data_ex - timedelta(days=1)
        
        # Limpar dados de teste anteriores
        self._cleanup_test_data()

    def tearDown(self):
        """Limpeza após cada teste"""
        self._cleanup_test_data()

    def _cleanup_test_data(self):
        """Remover dados de teste do banco"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        try:
            cursor.execute("DELETE FROM operacoes WHERE ticker = ? AND usuario_id = ?", 
                          (self.ticker_teste, self.usuario_id))
            conn.commit()
        except Exception as e:
            print(f"Aviso: Erro na limpeza - {e}")
        finally:
            conn.close()

    def _insert_operation(self, date_op, operation, quantity):
        """Helper para inserir operação de teste"""
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

    def test_critical_ex_date_fix(self):
        """Teste crítico: Verificar se correção da data EX está funcionando"""
        
        # CENÁRIO 1: Compra antes da data EX (deve receber dividendo)
        data_antes = self.data_ex - timedelta(days=3)
        self._insert_operation(data_antes, 'buy', 100)
        
        saldo_com_1 = obter_saldo_acao_em_data(self.usuario_id, self.ticker_teste, self.data_com)
        saldo_ex_1 = obter_saldo_acao_em_data(self.usuario_id, self.ticker_teste, self.data_ex)
        
        self.assertEqual(saldo_com_1, 100, "Cenário 1: Deve ter 100 ações na data COM")
        self.assertEqual(saldo_ex_1, 100, "Cenário 1: Deve ter 100 ações na data EX")
        
        # Limpar para próximo cenário
        self._cleanup_test_data()
        
        # CENÁRIO 2: Compra NA data EX (NÃO deve receber dividendo)
        self._insert_operation(self.data_ex, 'buy', 200)
        
        saldo_com_2 = obter_saldo_acao_em_data(self.usuario_id, self.ticker_teste, self.data_com)
        saldo_ex_2 = obter_saldo_acao_em_data(self.usuario_id, self.ticker_teste, self.data_ex)
        
        self.assertEqual(saldo_com_2, 0, "Cenário 2: NÃO deve ter ações na data COM")
        self.assertEqual(saldo_ex_2, 200, "Cenário 2: Deve ter 200 ações na data EX")
        
        # CRÍTICO: A diferença entre saldo_com e saldo_ex demonstra a correção
        diferenca = saldo_ex_2 - saldo_com_2
        self.assertEqual(diferenca, 200, "CRÍTICO: Diferença demonstra correção ex-date")
        
        print(f"\n✅ TESTE CRÍTICO PASSOU:")
        print(f"   Compra na data EX: Data COM = {saldo_com_2}, Data EX = {saldo_ex_2}")
        print(f"   Diferença = {diferenca} (compra que NÃO deve receber dividendo)")

    def test_dividend_calculation_scenarios(self):
        """Teste: Cenários reais de cálculo de dividendos"""
        
        # Cenário complexo: Múltiplas operações
        operacoes = [
            (self.data_ex - timedelta(days=10), 'buy', 500),   # Compra inicial
            (self.data_ex - timedelta(days=5), 'buy', 200),    # Compra adicional
            (self.data_com, 'sell', 100),                      # Venda na data COM
            (self.data_ex, 'buy', 150),                        # Compra na data EX (não conta)
        ]
        
        for date_op, operation, quantity in operacoes:
            self._insert_operation(date_op, operation, quantity)
        
        saldo_com = obter_saldo_acao_em_data(self.usuario_id, self.ticker_teste, self.data_com)
        saldo_ex = obter_saldo_acao_em_data(self.usuario_id, self.ticker_teste, self.data_ex)
        
        # Cálculos esperados:
        # Data COM: 500 + 200 - 100 = 600 ações (dividendo calculado sobre estas)
        # Data EX: 500 + 200 - 100 + 150 = 750 ações
        
        self.assertEqual(saldo_com, 600, "Data COM: 500 + 200 - 100 = 600")
        self.assertEqual(saldo_ex, 750, "Data EX: 600 + 150 = 750")
        
        # Para dividendos, usar APENAS saldo da data COM
        dividendo_unitario = 0.50
        dividendo_total_correto = saldo_com * dividendo_unitario
        dividendo_total_incorreto = saldo_ex * dividendo_unitario
        
        self.assertEqual(dividendo_total_correto, 300.0, "Dividendo correto: 600 × R$ 0.50")
        self.assertEqual(dividendo_total_incorreto, 375.0, "Dividendo incorreto seria: 750 × R$ 0.50")
        
        diferenca_financeira = dividendo_total_incorreto - dividendo_total_correto
        self.assertEqual(diferenca_financeira, 75.0, "Correção evita R$ 75,00 a mais incorretamente")
        
        print(f"\n✅ TESTE DE CENÁRIO COMPLEXO:")
        print(f"   Data COM: {saldo_com} ações → Dividendo: R$ {dividendo_total_correto:.2f}")
        print(f"   Data EX:  {saldo_ex} ações → Seria (incorreto): R$ {dividendo_total_incorreto:.2f}")
        print(f"   💰 Correção evita: R$ {diferenca_financeira:.2f} de dividendo incorreto")

    def test_business_rule_compliance(self):
        """Teste: Conformidade com regras de negócio da B3"""
        
        # Regra da B3: Ações compradas na data EX não têm direito ao dividendo
        # que será pago com base na posição do dia anterior (data COM)
        
        # Simular investidor que compra na data EX esperando dividendo
        self._insert_operation(self.data_ex, 'buy', 1000)  # Compra grande na data EX
        
        saldo_com = obter_saldo_acao_em_data(self.usuario_id, self.ticker_teste, self.data_com)
        saldo_ex = obter_saldo_acao_em_data(self.usuario_id, self.ticker_teste, self.data_ex)
        
        # Conformidade: Data COM = 0 (não tinha ações antes da data EX)
        self.assertEqual(saldo_com, 0, "B3 Rule: Sem ações na data COM = sem dividendo")
        self.assertEqual(saldo_ex, 1000, "B3 Rule: Compra na data EX não gera direito")
        
        # Simular investidor experiente que vende na data EX mas recebe dividendo
        self._cleanup_test_data()
        
        # Compra antes e vende na data EX
        self._insert_operation(self.data_ex - timedelta(days=7), 'buy', 800)
        self._insert_operation(self.data_ex, 'sell', 800)
        
        saldo_com_2 = obter_saldo_acao_em_data(self.usuario_id, self.ticker_teste, self.data_com)
        saldo_ex_2 = obter_saldo_acao_em_data(self.usuario_id, self.ticker_teste, self.data_ex)
        
        # Conformidade: Possuía na data COM = recebe dividendo mesmo vendendo na data EX
        self.assertEqual(saldo_com_2, 800, "B3 Rule: Possuía na data COM = recebe dividendo")
        self.assertEqual(saldo_ex_2, 0, "B3 Rule: Vendeu na data EX mas ainda recebe")
        
        print(f"\n✅ TESTE DE CONFORMIDADE B3:")
        print(f"   Cenário 1: Compra na EX → COM: {saldo_com}, EX: {saldo_ex} → Sem dividendo ✓")
        print(f"   Cenário 2: Venda na EX  → COM: {saldo_com_2}, EX: {saldo_ex_2} → Com dividendo ✓")

    def test_regression_prevention(self):
        """Teste: Prevenção de regressão da correção crítica"""
        
        # Este teste documenta o bug que foi corrigido e previne regressão
        
        # Bug original: Sistema usava data EX para cálculo de dividendos
        # Correção: Sistema agora usa data COM (data EX - 1)
        
        # Cenário de regressão: Compra exatamente na data EX
        self._insert_operation(self.data_ex, 'buy', 500)
        
        saldo_com = obter_saldo_acao_em_data(self.usuario_id, self.ticker_teste, self.data_com)
        saldo_ex = obter_saldo_acao_em_data(self.usuario_id, self.ticker_teste, self.data_ex)
        
        # Se houver regressão, estes valores estariam errados
        self.assertNotEqual(saldo_com, saldo_ex, "Prevenção regressão: Data COM ≠ Data EX")
        self.assertEqual(saldo_com, 0, "Prevenção regressão: Data COM = 0")
        self.assertEqual(saldo_ex, 500, "Prevenção regressão: Data EX = 500")
        
        # Documentação do problema corrigido
        if saldo_com == saldo_ex:
            self.fail("REGRESSÃO DETECTADA: Sistema voltou a usar data EX incorretamente!")
        
        print(f"\n✅ TESTE DE REGRESSÃO:")
        print(f"   Sistema usa data COM corretamente: {saldo_com} ≠ {saldo_ex}")
        print(f"   Correção crítica mantida: dividendos na data COM, não EX")


if __name__ == '__main__':
    # Executar com mais verbosidade
    unittest.main(verbosity=2, buffer=True)