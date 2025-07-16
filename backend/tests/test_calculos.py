import unittest
from datetime import date
from decimal import Decimal
import sys
import os

# Adiciona o diretório raiz do projeto ao sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from backend.models import Operacao
from backend.calculos import (
    PosicaoAcao,
    classificar_operacoes_por_dia,
    processar_operacao_swing_trade,
    calcular_resultado_day_trade,
    calcular_resultados_operacoes,
)

class TestCalculos(unittest.TestCase):

    def test_compra_simples(self):
        """Testa uma única compra, que deve apenas atualizar a posição."""
        posicao = PosicaoAcao(ticker="PETR4")
        operacao = Operacao(
            id=1,
            ticker="PETR4",
            date=date(2023, 1, 10),
            operation="buy",
            quantity=100,
            price=Decimal("25.00"),
            fees=Decimal("5.25"),
            importacao_id=1,
            usuario_id=1
        )

        resultado = processar_operacao_swing_trade(posicao, operacao)

        self.assertIsNone(resultado) # Nenhuma operação fechada
        self.assertEqual(posicao.quantidade, 100)
        self.assertEqual(posicao.custo_total, 2505.25)
        self.assertAlmostEqual(posicao.preco_medio, 25.0525)

    def test_venda_parcial_com_lucro(self):
        """Testa uma venda parcial que realiza lucro."""
        posicao = PosicaoAcao(ticker="PETR4", quantidade=100, custo_total=2505.25, preco_medio=25.0525)
        operacao = Operacao(
            id=2,
            ticker="PETR4",
            date=date(2023, 1, 11),
            operation="sell",
            quantity=50,
            price=Decimal("28.00"),
            fees=Decimal("3.00"),
            importacao_id=1,
            usuario_id=1
        )

        resultado = processar_operacao_swing_trade(posicao, operacao)

        self.assertIsNotNone(resultado)
        self.assertEqual(resultado.quantidade, 50)
        self.assertAlmostEqual(resultado.resultado, 144.375) # (50 * 28) - 3 - (50 * 25.0525)

        self.assertEqual(posicao.quantidade, 50)
        self.assertAlmostEqual(posicao.custo_total, 1252.625)

    def test_classificacao_operacoes_mistas(self):
        """Testa a classificação de um dia com day trade e swing trade."""
        operacoes_dia = [
            Operacao(id=1, ticker="PETR4", date=date(2023, 1, 10), operation="buy", quantity=100, price=Decimal("25.00"), fees=Decimal("5.00"), usuario_id=1, importacao_id=1),
            Operacao(id=2, ticker="PETR4", date=date(2023, 1, 10), operation="sell", quantity=50, price=Decimal("26.00"), fees=Decimal("3.00"), usuario_id=1, importacao_id=1),
            Operacao(id=3, ticker="VALE3", date=date(2023, 1, 10), operation="buy", quantity=200, price=Decimal("90.00"), fees=Decimal("10.00"), usuario_id=1, importacao_id=1),
        ]

        classificadas = classificar_operacoes_por_dia(operacoes_dia)

        self.assertEqual(len(classificadas['day_trade']), 2)
        self.assertEqual(len(classificadas['swing_trade']), 2)

        # PETR4: 50 DT, 50 ST
        op_dt_petr_compra = next(op for op in classificadas['day_trade'] if op.ticker == 'PETR4' and op.operation == 'buy')
        op_dt_petr_venda = next(op for op in classificadas['day_trade'] if op.ticker == 'PETR4' and op.operation == 'sell')
        op_st_petr_compra = next(op for op in classificadas['swing_trade'] if op.ticker == 'PETR4' and op.operation == 'buy')

        self.assertEqual(op_dt_petr_compra.quantity, 50)
        self.assertEqual(op_dt_petr_venda.quantity, 50)
        self.assertEqual(op_st_petr_compra.quantity, 50)

        # VALE3: 200 ST
        op_st_vale = next(op for op in classificadas['swing_trade'] if op.ticker == 'VALE3')
        self.assertEqual(op_st_vale.quantity, 200)

    def test_calcular_resultado_day_trade(self):
        """Testa o cálculo consolidado de um resultado de day trade."""
        operacoes_dt = [
            Operacao(id=1, ticker="PETR4", date=date(2023, 1, 10), operation="buy", quantity=100, price=Decimal("25.00"), fees=Decimal("5.00"), usuario_id=1, importacao_id=1),
            Operacao(id=2, ticker="PETR4", date=date(2023, 1, 10), operation="sell", quantity=100, price=Decimal("25.50"), fees=Decimal("5.00"), usuario_id=1, importacao_id=1),
        ]

        resultado = calcular_resultado_day_trade(operacoes_dt)

        self.assertIsNotNone(resultado)
        self.assertTrue(resultado.day_trade)
        self.assertEqual(resultado.quantidade, 100)
        self.assertAlmostEqual(resultado.preco_medio_compra, 25.05)
        self.assertAlmostEqual(resultado.preco_medio_venda, 25.45)
        self.assertAlmostEqual(resultado.resultado, 40.0) # (25.45 - 25.05) * 100

    def test_orquestrador_geral(self):
        """Testa a função orquestradora com um cenário completo."""
        operacoes = [
            # Dia 1: Compra ST
            Operacao(id=1, ticker="MGLU3", date=date(2023, 1, 10), operation="buy", quantity=200, price=Decimal("3.00"), fees=Decimal("2.00"), usuario_id=1, importacao_id=1),
            # Dia 2: Compra e Venda DT
            Operacao(id=2, ticker="MGLU3", date=date(2023, 1, 11), operation="buy", quantity=100, price=Decimal("3.10"), fees=Decimal("1.00"), usuario_id=1, importacao_id=1),
            Operacao(id=3, ticker="MGLU3", date=date(2023, 1, 11), operation="sell", quantity=100, price=Decimal("3.30"), fees=Decimal("1.00"), usuario_id=1, importacao_id=1),
            # Dia 3: Venda ST
            Operacao(id=4, ticker="MGLU3", date=date(2023, 1, 12), operation="sell", quantity=100, price=Decimal("3.50"), fees=Decimal("1.00"), usuario_id=1, importacao_id=1),
        ]

        resultados = calcular_resultados_operacoes(operacoes)

        ops_fechadas = resultados['operacoes_fechadas']
        carteira = resultados['carteira_final']

        self.assertEqual(len(ops_fechadas), 2)

        op_dt = next(op for op in ops_fechadas if op.day_trade)
        self.assertAlmostEqual(op_dt.resultado, 18.0) # (3.29 - 3.11) * 100

        op_st = next(op for op in ops_fechadas if not op.day_trade)
        self.assertAlmostEqual(op_st.resultado, 48.0) # (3.49 * 100) - (3.01 * 100)

        self.assertEqual(carteira['MGLU3'].quantidade, 100)
        self.assertAlmostEqual(carteira['MGLU3'].preco_medio, 3.01)

if __name__ == '__main__':
    unittest.main()
