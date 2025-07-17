import unittest
from datetime import date
from decimal import Decimal

from ..models import Operacao
from ..calculos import (
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
        """Testa o agrupamento de operações por ticker."""
        operacoes_dia = [
            Operacao(id=1, ticker="PETR4", date=date(2023, 1, 10), operation="buy", quantity=100, price=Decimal("25.00"), fees=Decimal("5.00"), usuario_id=1, importacao_id=1),
            Operacao(id=2, ticker="PETR4", date=date(2023, 1, 10), operation="sell", quantity=50, price=Decimal("26.00"), fees=Decimal("3.00"), usuario_id=1, importacao_id=1),
            Operacao(id=3, ticker="VALE3", date=date(2023, 1, 10), operation="buy", quantity=200, price=Decimal("90.00"), fees=Decimal("10.00"), usuario_id=1, importacao_id=1),
        ]

        agrupadas = classificar_operacoes_por_dia(operacoes_dia)

        self.assertEqual(len(agrupadas["PETR4"]), 2)
        self.assertEqual(len(agrupadas["VALE3"]), 1)

    def test_calcular_resultado_day_trade(self):
        """Testa o cálculo consolidado de um resultado de day trade."""
        operacoes_dt = [
            Operacao(id=1, ticker="PETR4", date=date(2023, 1, 10), operation="buy", quantity=100, price=Decimal("25.00"), fees=Decimal("5.00"), usuario_id=1, importacao_id=1),
            Operacao(id=2, ticker="PETR4", date=date(2023, 1, 10), operation="sell", quantity=100, price=Decimal("25.50"), fees=Decimal("5.00"), usuario_id=1, importacao_id=1),
        ]

        resultado = calcular_resultado_day_trade(operacoes_dt)["resultado_dt"]

        self.assertIsNotNone(resultado)
        self.assertTrue(resultado.day_trade)
        self.assertEqual(resultado.quantidade, 100)
        self.assertAlmostEqual(resultado.preco_medio_compra, 25.05)
        self.assertAlmostEqual(resultado.preco_medio_venda, 25.45)
        self.assertAlmostEqual(resultado.resultado, 40.0)

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

    def test_day_trade_com_preco_medio_ponderado(self):
        """
        Testa o cenário de day trade com múltiplas compras, onde o custo de
        aquisição deve ser o preço médio ponderado das compras do dia.
        """
        operacoes = [
            Operacao(id=1, ticker="VALE3", date=date(2024, 5, 15), operation="buy", quantity=5000, price=Decimal("30.00"), fees=Decimal("0"), usuario_id=1, importacao_id=1),
            Operacao(id=2, ticker="VALE3", date=date(2024, 5, 15), operation="buy", quantity=5000, price=Decimal("32.00"), fees=Decimal("0"), usuario_id=1, importacao_id=1),
            Operacao(id=3, ticker="VALE3", date=date(2024, 5, 15), operation="sell", quantity=5000, price=Decimal("31.00"), fees=Decimal("0"), usuario_id=1, importacao_id=1),
        ]

        resultados = calcular_resultados_operacoes(operacoes)
        ops_fechadas = resultados['operacoes_fechadas']

        # Esperamos uma única operação de day trade fechada
        self.assertEqual(len(ops_fechadas), 1)
        op_dt = ops_fechadas[0]

        self.assertTrue(op_dt.day_trade)
        self.assertEqual(op_dt.quantidade, 5000)

        # PM de compra: ((5000*30)+(5000*32)) / 10000 = 31.00
        self.assertAlmostEqual(op_dt.preco_medio_compra, 31.00)

        # PM de venda: 31.00 (só houve uma venda)
        self.assertAlmostEqual(op_dt.preco_medio_venda, 31.00)

        # Resultado: (5000 * 31) - (5000 * 31) = 0
        self.assertAlmostEqual(op_dt.resultado, 0.0)

if __name__ == '__main__':
    unittest.main()
