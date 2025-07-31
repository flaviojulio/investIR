"""
Testes unitários para cálculos de operações com ações
Cobre day trade, swing trade, vendas a descoberto e preço médio ponderado
"""
import pytest
from datetime import date, datetime
from decimal import Decimal

from calculos import (
    PosicaoAcao, OperacaoFechada, calcular_resultado_day_trade,
    processar_operacao_swing_trade, calcular_resultados_operacoes,
    validar_operacao_fechada
)


class TestPosicaoAcao:
    """Testes para a classe PosicaoAcao"""
    
    def test_init_posicao_vazia(self):
        """Teste inicialização de posição vazia"""
        posicao = PosicaoAcao("PETR4")
        
        assert posicao.ticker == "PETR4"
        assert posicao.quantidade_longa == 0
        assert posicao.custo_total_longo == 0.0
        assert posicao.quantidade_vendida == 0
        assert posicao.receita_total_vendida == 0.0
        assert posicao.preco_medio_longo == 0.0
        assert posicao.preco_medio_vendido == 0.0
    
    def test_adicionar_posicao_longa(self):
        """Teste adição de posição longa"""
        posicao = PosicaoAcao("VALE3")
        
        posicao.adicionar_longa(100, 50.00, 5.00)
        
        assert posicao.quantidade_longa == 100
        assert posicao.custo_total_longo == 5005.00  # 100 * 50 + 5
        assert posicao.preco_medio_longo == 50.05
    
    def test_adicionar_multiplas_posicoes_longas(self):
        """Teste adição de múltiplas posições longas (preço médio ponderado)"""
        posicao = PosicaoAcao("ITUB4")
        
        posicao.adicionar_longa(100, 25.00, 5.00)  # Custo: 2505
        posicao.adicionar_longa(200, 26.00, 8.00)  # Custo: 5208
        
        assert posicao.quantidade_longa == 300
        assert posicao.custo_total_longo == 7713.00  # 2505 + 5208
        assert abs(posicao.preco_medio_longo - 25.71) < 0.01  # 7713 / 300
    
    def test_remover_posicao_longa_total(self):
        """Teste remoção total de posição longa"""
        posicao = PosicaoAcao("BBAS3")
        posicao.adicionar_longa(150, 45.00, 7.50)
        
        resultado = posicao.remover_longa(150, 47.00, 8.00)
        
        assert posicao.quantidade_longa == 0
        assert posicao.custo_total_longo == 0.0
        assert resultado["quantidade"] == 150
        assert resultado["custo_venda"] == 7058.00  # 150 * 47 - 8
        assert resultado["custo_compra"] == 6757.50  # 150 * 45.05
        assert abs(resultado["resultado"] - 300.50) < 0.01
    
    def test_remover_posicao_longa_parcial(self):
        """Teste remoção parcial de posição longa"""
        posicao = PosicaoAcao("WEGE3")
        posicao.adicionar_longa(300, 40.00, 12.00)  # PM: 40.04
        
        resultado = posicao.remover_longa(100, 42.00, 5.00)
        
        assert posicao.quantidade_longa == 200
        assert abs(posicao.custo_total_longo - 8008.00) < 0.01  # 200 * 40.04
        assert abs(posicao.preco_medio_longo - 40.04) < 0.01
        assert resultado["quantidade"] == 100
    
    def test_adicionar_posicao_vendida(self):
        """Teste adição de posição vendida (venda descoberto)"""
        posicao = PosicaoAcao("PETR4")
        
        posicao.adicionar_vendida(200, 35.00, 10.00)
        
        assert posicao.quantidade_vendida == 200
        assert posicao.receita_total_vendida == 6990.00  # 200 * 35 - 10
        assert posicao.preco_medio_vendido == 34.95
    
    def test_cobrir_posicao_vendida(self):
        """Teste cobertura de posição vendida"""
        posicao = PosicaoAcao("VALE3")
        posicao.adicionar_vendida(100, 60.00, 5.00)  # PM vendido: 59.95
        
        resultado = posicao.cobrir_vendida(100, 58.00, 6.00)
        
        assert posicao.quantidade_vendida == 0
        assert posicao.receita_total_vendida == 0.0
        assert resultado["quantidade"] == 100
        assert resultado["receita_venda"] == 5995.00  # 100 * 59.95
        assert resultado["custo_cobertura"] == 5806.00  # 100 * 58 + 6
        assert abs(resultado["resultado"] - 189.00) < 0.01
    
    def test_posicao_zerada(self):
        """Teste verificação de posição zerada"""
        posicao = PosicaoAcao("ITUB4")
        
        assert posicao.esta_zerada()
        
        posicao.adicionar_longa(100, 25.00, 5.00)
        assert not posicao.esta_zerada()
        
        posicao.remover_longa(100, 26.00, 6.00)
        assert posicao.esta_zerada()


class TestCalculoResultadoDayTrade:
    """Testes para cálculos de day trade"""
    
    def test_day_trade_simples_lucro(self):
        """Teste day trade simples com lucro"""
        operacoes = [
            {"date": date(2024, 1, 15), "ticker": "PETR4", "operation": "buy", "quantity": 100, "price": 30.00, "fees": 5.00},
            {"date": date(2024, 1, 15), "ticker": "PETR4", "operation": "sell", "quantity": 100, "price": 32.00, "fees": 6.00}
        ]
        
        resultado = calcular_resultado_day_trade(operacoes)
        
        assert len(resultado) == 1
        op_fechada = resultado[0]
        assert op_fechada.ticker == "PETR4"
        assert op_fechada.day_trade == True
        assert op_fechada.quantidade == 100
        assert op_fechada.valor_compra == 3005.00  # 100 * 30 + 5
        assert op_fechada.valor_venda == 3194.00   # 100 * 32 - 6
        assert abs(op_fechada.resultado - 189.00) < 0.01
        assert abs(op_fechada.percentual_lucro - 6.29) < 0.01
    
    def test_day_trade_simples_prejuizo(self):
        """Teste day trade simples com prejuízo"""
        operacoes = [
            {"date": date(2024, 1, 20), "ticker": "VALE3", "operation": "buy", "quantity": 200, "price": 65.00, "fees": 10.00},
            {"date": date(2024, 1, 20), "ticker": "VALE3", "operation": "sell", "quantity": 200, "price": 63.50, "fees": 12.00}
        ]
        
        resultado = calcular_resultado_day_trade(operacoes)
        
        assert len(resultado) == 1
        op_fechada = resultado[0]
        assert op_fechada.day_trade == True
        assert op_fechada.resultado < 0
        assert abs(op_fechada.resultado - (-322.00)) < 0.01  # (63.50*200-12) - (65*200+10)
    
    def test_day_trade_multiplas_operacoes(self):
        """Teste day trade com múltiplas operações no mesmo dia"""
        operacoes = [
            {"date": date(2024, 1, 10), "ticker": "BBAS3", "operation": "buy", "quantity": 100, "price": 45.00, "fees": 8.00},
            {"date": date(2024, 1, 10), "ticker": "BBAS3", "operation": "buy", "quantity": 200, "price": 46.00, "fees": 12.00},
            {"date": date(2024, 1, 10), "ticker": "BBAS3", "operation": "sell", "quantity": 300, "price": 47.00, "fees": 18.00}
        ]
        
        resultado = calcular_resultado_day_trade(operacoes)
        
        assert len(resultado) == 1
        op_fechada = resultado[0]
        assert op_fechada.quantidade == 300
        # Preço médio compra: (100*45 + 200*46 + 8+12) / 300 = 45.73
        # Valor venda: 300*47 - 18 = 13,082
        # Resultado deve ser positivo
        assert op_fechada.resultado > 0
    
    def test_day_trade_venda_descoberto(self):
        """Teste day trade com venda descoberto"""
        operacoes = [
            {"date": date(2024, 1, 25), "ticker": "WEGE3", "operation": "sell", "quantity": 150, "price": 42.00, "fees": 9.00},
            {"date": date(2024, 1, 25), "ticker": "WEGE3", "operation": "buy", "quantity": 150, "price": 40.50, "fees": 8.50}
        ]
        
        resultado = calcular_resultado_day_trade(operacoes)
        
        assert len(resultado) == 1
        op_fechada = resultado[0]
        assert op_fechada.day_trade == True
        assert op_fechada.tipo == "venda-compra"
        assert op_fechada.resultado > 0  # Lucro na venda descoberto
        # Receita: 150*42 - 9 = 6291
        # Custo: 150*40.50 + 8.50 = 6083.50
        assert abs(op_fechada.resultado - 207.50) < 0.01


class TestProcessarOperacaoSwingTrade:
    """Testes para processamento de swing trade"""
    
    def test_swing_trade_simples(self):
        """Teste swing trade simples"""
        operacoes = [
            {"date": date(2024, 1, 10), "ticker": "PETR4", "operation": "buy", "quantity": 200, "price": 28.00, "fees": 10.00},
            {"date": date(2024, 2, 15), "ticker": "PETR4", "operation": "sell", "quantity": 200, "price": 31.50, "fees": 12.00}
        ]
        
        resultado = processar_operacao_swing_trade(operacoes)
        
        assert len(resultado) == 1
        op_fechada = resultado[0]
        assert op_fechada.day_trade == False
        assert op_fechada.quantidade == 200
        assert op_fechada.data_abertura == date(2024, 1, 10)
        assert op_fechada.data_fechamento == date(2024, 2, 15)
        # Resultado: (200*31.50 - 12) - (200*28 + 10) = 6288 - 5610 = 678
        assert abs(op_fechada.resultado - 678.00) < 0.01
    
    def test_swing_trade_compras_multiplas(self):
        """Teste swing trade com múltiplas compras"""
        operacoes = [
            {"date": date(2024, 1, 5), "ticker": "VALE3", "operation": "buy", "quantity": 100, "price": 60.00, "fees": 8.00},
            {"date": date(2024, 1, 12), "ticker": "VALE3", "operation": "buy", "quantity": 150, "price": 62.00, "fees": 12.00},
            {"date": date(2024, 2, 10), "ticker": "VALE3", "operation": "sell", "quantity": 250, "price": 65.00, "fees": 20.00}
        ]
        
        resultado = processar_operacao_swing_trade(operacoes)
        
        assert len(resultado) == 1
        op_fechada = resultado[0]
        assert op_fechada.quantidade == 250
        # Custo total: (100*60 + 8) + (150*62 + 12) = 6008 + 9312 = 15320
        # Receita: 250*65 - 20 = 16230
        # Resultado: 16230 - 15320 = 910
        assert abs(op_fechada.resultado - 910.00) < 0.01
    
    def test_swing_trade_venda_parcial(self):
        """Teste swing trade com venda parcial"""
        operacoes = [
            {"date": date(2024, 1, 8), "ticker": "ITUB4", "operation": "buy", "quantity": 500, "price": 25.00, "fees": 15.00},
            {"date": date(2024, 1, 22), "ticker": "ITUB4", "operation": "sell", "quantity": 300, "price": 27.00, "fees": 18.00}
        ]
        
        resultado = processar_operacao_swing_trade(operacoes)
        
        assert len(resultado) == 1
        op_fechada = resultado[0]
        assert op_fechada.quantidade == 300
        # Preço médio compra: (500*25 + 15) / 500 = 25.03
        # Custo para 300: 300 * 25.03 = 7509
        # Receita: 300*27 - 18 = 7982
        # Resultado: 7982 - 7509 = 473
        assert abs(op_fechada.resultado - 473.00) < 0.01
    
    def test_swing_trade_venda_descoberto(self):
        """Teste operação de venda descoberto (swing)"""
        operacoes = [
            {"date": date(2024, 1, 15), "ticker": "BBAS3", "operation": "sell", "quantity": 400, "price": 48.00, "fees": 20.00},
            {"date": date(2024, 2, 5), "ticker": "BBAS3", "operation": "buy", "quantity": 400, "price": 45.50, "fees": 18.00}
        ]
        
        resultado = processar_operacao_swing_trade(operacoes)
        
        assert len(resultado) == 1
        op_fechada = resultado[0]
        assert op_fechada.tipo == "venda-compra"
        assert op_fechada.day_trade == False
        # Receita: 400*48 - 20 = 19180
        # Custo cobertura: 400*45.50 + 18 = 18218
        # Resultado: 19180 - 18218 = 962
        assert abs(op_fechada.resultado - 962.00) < 0.01


class TestCalcularResultadosOperacoes:
    """Testes para a função principal de cálculo de resultados"""
    
    def test_calcular_resultados_mixtos(self, day_trade_scenario):
        """Teste cálculo com operações mistas (day trade + swing)"""
        # day_trade_scenario já contém operações do mesmo dia
        operacoes_swing = [
            {"date": date(2024, 1, 10), "ticker": "VALE3", "operation": "buy", "quantity": 200, "price": 55.00, "fees": 10.00},
            {"date": date(2024, 2, 15), "ticker": "VALE3", "operation": "sell", "quantity": 200, "price": 58.00, "fees": 12.00}
        ]
        
        todas_operacoes = day_trade_scenario + operacoes_swing
        
        resultado = calcular_resultados_operacoes(todas_operacoes)
        
        # Deve ter pelo menos 2 operações fechadas (day trade + swing)
        assert len(resultado) >= 2
        
        # Verificar que existem ambos os tipos
        day_trades = [op for op in resultado if op.day_trade]
        swing_trades = [op for op in resultado if not op.day_trade]
        
        assert len(day_trades) >= 1
        assert len(swing_trades) >= 1
    
    def test_calcular_resultados_sem_operacoes(self):
        """Teste cálculo sem operações"""
        resultado = calcular_resultados_operacoes([])
        assert resultado == []
    
    def test_calcular_resultados_operacao_aberta(self):
        """Teste cálculo com operação não fechada"""
        operacoes = [
            {"date": date(2024, 1, 10), "ticker": "PETR4", "operation": "buy", "quantity": 100, "price": 30.00, "fees": 5.00}
        ]
        
        resultado = calcular_resultados_operacoes(operacoes)
        
        # Não deve gerar operações fechadas
        assert len(resultado) == 0


class TestValidarOperacaoFechada:
    """Testes para validação de operações fechadas"""
    
    def test_validar_operacao_valida(self):
        """Teste validação de operação válida"""
        operacao = OperacaoFechada(
            ticker="PETR4",
            data_abertura=date(2024, 1, 10),
            data_fechamento=date(2024, 1, 15),
            tipo="compra-venda",
            quantidade=100,
            valor_compra=3005.00,
            valor_venda=3200.00,
            taxas_total=11.00,
            resultado=195.00,
            percentual_lucro=6.49,
            day_trade=False,
            operacoes_relacionadas=[]
        )
        
        # Não deve lançar exceção
        validar_operacao_fechada(operacao)
    
    def test_validar_operacao_quantidade_zero(self):
        """Teste validação com quantidade zero"""
        operacao = OperacaoFechada(
            ticker="PETR4",
            data_abertura=date(2024, 1, 10),
            data_fechamento=date(2024, 1, 15),
            tipo="compra-venda",
            quantidade=0,  # Inválido
            valor_compra=3005.00,
            valor_venda=3200.00,
            taxas_total=11.00,
            resultado=195.00,
            percentual_lucro=6.49,
            day_trade=False,
            operacoes_relacionadas=[]
        )
        
        with pytest.raises(ValueError, match="Quantidade deve ser maior que zero"):
            validar_operacao_fechada(operacao)
    
    def test_validar_operacao_data_inconsistente(self):
        """Teste validação com datas inconsistentes"""
        operacao = OperacaoFechada(
            ticker="PETR4",
            data_abertura=date(2024, 1, 15),  # Depois do fechamento
            data_fechamento=date(2024, 1, 10),
            tipo="compra-venda",
            quantidade=100,
            valor_compra=3005.00,
            valor_venda=3200.00,
            taxas_total=11.00,
            resultado=195.00,
            percentual_lucro=6.49,
            day_trade=False,
            operacoes_relacionadas=[]
        )
        
        with pytest.raises(ValueError, match="Data de abertura deve ser anterior ou igual"):
            validar_operacao_fechada(operacao)


@pytest.mark.fiscal
class TestCenariosFiscais:
    """Testes para cenários específicos de cálculo fiscal"""
    
    def test_prejuizo_day_trade(self):
        """Teste cálculo de prejuízo em day trade"""
        operacoes = [
            {"date": date(2024, 1, 15), "ticker": "PETR4", "operation": "buy", "quantity": 100, "price": 32.00, "fees": 5.00},
            {"date": date(2024, 1, 15), "ticker": "PETR4", "operation": "sell", "quantity": 100, "price": 30.00, "fees": 6.00}
        ]
        
        resultado = calcular_resultado_day_trade(operacoes)
        
        assert len(resultado) == 1
        op_fechada = resultado[0]
        assert op_fechada.resultado < 0  # Prejuízo
        assert abs(op_fechada.resultado - (-211.00)) < 0.01  # (30*100-6) - (32*100+5)
    
    def test_isencao_swing_trade_pequeno(self):
        """Teste para verificar se swing trades pequenos são elegíveis para isenção"""
        operacoes = [
            {"date": date(2024, 1, 10), "ticker": "PETR4", "operation": "buy", "quantity": 50, "price": 30.00, "fees": 3.00},
            {"date": date(2024, 2, 15), "ticker": "PETR4", "operation": "sell", "quantity": 50, "price": 32.00, "fees": 4.00}
        ]
        
        resultado = processar_operacao_swing_trade(operacoes)
        
        assert len(resultado) == 1
        op_fechada = resultado[0]
        # Valor de venda: 50*32 - 4 = 1596 (abaixo do limite de isenção mensal de R$ 20.000)
        assert op_fechada.valor_venda == 1596.00
        # Pode ser elegível para isenção dependendo do volume mensal total
    
    def test_day_trade_mesmo_ticker_datas_diferentes(self):
        """Teste que operações do mesmo ticker em datas diferentes não são day trade"""
        operacoes = [
            {"date": date(2024, 1, 10), "ticker": "VALE3", "operation": "buy", "quantity": 100, "price": 60.00, "fees": 5.00},
            {"date": date(2024, 1, 11), "ticker": "VALE3", "operation": "sell", "quantity": 100, "price": 62.00, "fees": 6.00}
        ]
        
        # Deve ser processado como swing trade, não day trade
        resultado_day = calcular_resultado_day_trade(operacoes)
        resultado_swing = processar_operacao_swing_trade(operacoes)
        
        assert len(resultado_day) == 0  # Não é day trade
        assert len(resultado_swing) == 1  # É swing trade
        assert resultado_swing[0].day_trade == False


@pytest.mark.operations
class TestCenariosComplexos:
    """Testes para cenários complexos de operações"""
    
    def test_multiplos_tickers_mesmo_dia(self):
        """Teste day trades de múltiplos tickers no mesmo dia"""
        operacoes = [
            {"date": date(2024, 1, 15), "ticker": "PETR4", "operation": "buy", "quantity": 100, "price": 30.00, "fees": 5.00},
            {"date": date(2024, 1, 15), "ticker": "PETR4", "operation": "sell", "quantity": 100, "price": 32.00, "fees": 6.00},
            {"date": date(2024, 1, 15), "ticker": "VALE3", "operation": "buy", "quantity": 200, "price": 65.00, "fees": 10.00},
            {"date": date(2024, 1, 15), "ticker": "VALE3", "operation": "sell", "quantity": 200, "price": 67.00, "fees": 12.00}
        ]
        
        resultado = calcular_resultado_day_trade(operacoes)
        
        assert len(resultado) == 2  # Dois day trades diferentes
        tickers = {op.ticker for op in resultado}
        assert tickers == {"PETR4", "VALE3"}
    
    def test_operacoes_fracionadas(self):
        """Teste operações com quantidades fracionadas"""
        operacoes = [
            {"date": date(2024, 1, 10), "ticker": "PETR4", "operation": "buy", "quantity": 150, "price": 30.00, "fees": 8.00},
            {"date": date(2024, 1, 15), "ticker": "PETR4", "operation": "sell", "quantity": 75, "price": 32.00, "fees": 5.00},
            {"date": date(2024, 1, 20), "ticker": "PETR4", "operation": "sell", "quantity": 75, "price": 31.50, "fees": 5.00}
        ]
        
        resultado = processar_operacao_swing_trade(operacoes)
        
        # Deve gerar duas operações fechadas (vendas parciais)
        assert len(resultado) == 2
        assert all(op.quantidade == 75 for op in resultado)
    
    def test_recompra_apos_venda_total(self):
        """Teste recompra após venda total da posição"""
        operacoes = [
            {"date": date(2024, 1, 5), "ticker": "ITUB4", "operation": "buy", "quantity": 200, "price": 25.00, "fees": 8.00},
            {"date": date(2024, 1, 15), "ticker": "ITUB4", "operation": "sell", "quantity": 200, "price": 27.00, "fees": 10.00},
            {"date": date(2024, 1, 25), "ticker": "ITUB4", "operation": "buy", "quantity": 300, "price": 26.50, "fees": 12.00}
        ]
        
        resultado = processar_operacao_swing_trade(operacoes)
        
        # Deve gerar apenas uma operação fechada (primeira posição)
        assert len(resultado) == 1
        assert resultado[0].quantidade == 200