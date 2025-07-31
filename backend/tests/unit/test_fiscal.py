"""
Testes unitários para cálculos fiscais e de Imposto de Renda
Cobre day trade, swing trade, compensação de prejuízos, DARF e isenções
"""
import pytest
from datetime import date, datetime
from decimal import Decimal

from services import (
    recalcular_resultados_corrigido, calcular_ir_devido_mes,
    aplicar_compensacao_prejuizo, calcular_irrf_day_trade,
    calcular_irrf_swing_trade, verificar_isencao_swing_trade,
    gerar_darf_automatico
)


@pytest.mark.fiscal
class TestCalculosIR:
    """Testes para cálculos de Imposto de Renda"""
    
    def test_calculo_ir_day_trade_lucro(self):
        """Teste cálculo IR day trade com lucro"""
        ganho_liquido = 1000.00
        irrf_pago = 10.00  # 1% sobre ganhos
        
        ir_devido = calcular_ir_devido_mes(ganho_liquido, "day_trade", irrf_pago)
        
        # Day trade: 20% sobre ganho líquido - IRRF
        ir_esperado = (1000.00 * 0.20) - 10.00  # 200 - 10 = 190
        assert abs(ir_devido - ir_esperado) < 0.01
    
    def test_calculo_ir_swing_trade_lucro(self):
        """Teste cálculo IR swing trade com lucro"""
        ganho_liquido = 5000.00
        irrf_pago = 25.00  # 0.005% sobre vendas
        
        ir_devido = calcular_ir_devido_mes(ganho_liquido, "swing_trade", irrf_pago)
        
        # Swing trade: 15% sobre ganho líquido - IRRF
        ir_esperado = (5000.00 * 0.15) - 25.00  # 750 - 25 = 725
        assert abs(ir_devido - ir_esperado) < 0.01
    
    def test_calculo_ir_prejuizo(self):
        """Teste cálculo IR com prejuízo"""
        ganho_liquido = -2000.00  # Prejuízo
        irrf_pago = 0.00
        
        ir_devido = calcular_ir_devido_mes(ganho_liquido, "day_trade", irrf_pago)
        
        # Com prejuízo, IR devido é zero
        assert ir_devido == 0.00
    
    def test_calculo_irrf_day_trade(self):
        """Teste cálculo IRRF day trade"""
        operacoes_day_trade = [
            {"resultado": 500.00, "day_trade": True},
            {"resultado": 300.00, "day_trade": True},
            {"resultado": -100.00, "day_trade": True}  # Prejuízo
        ]
        
        irrf = calcular_irrf_day_trade(operacoes_day_trade)
        
        # IRRF: 1% sobre ganhos positivos apenas
        # 500 + 300 = 800 * 0.01 = 8.00
        assert abs(irrf - 8.00) < 0.01
    
    def test_calculo_irrf_swing_trade(self):
        """Teste cálculo IRRF swing trade"""
        vendas_mes = 100000.00  # R$ 100k em vendas
        
        irrf = calcular_irrf_swing_trade(vendas_mes)
        
        # IRRF: 0.005% sobre vendas
        irrf_esperado = 100000.00 * 0.00005  # 5.00
        assert abs(irrf - irrf_esperado) < 0.01
    
    def test_verificar_isencao_swing_trade_elegivel(self):
        """Teste verificação de isenção swing trade (elegível)"""
        vendas_mes = 15000.00  # Abaixo de R$ 20k
        
        isento = verificar_isencao_swing_trade(vendas_mes)
        
        assert isento is True
    
    def test_verificar_isencao_swing_trade_nao_elegivel(self):
        """Teste verificação de isenção swing trade (não elegível)"""
        vendas_mes = 25000.00  # Acima de R$ 20k
        
        isento = verificar_isencao_swing_trade(vendas_mes)
        
        assert isento is False


@pytest.mark.fiscal
class TestCompensacaoPrejuizo:
    """Testes para compensação de prejuízos"""
    
    def test_compensacao_prejuizo_disponivel(self):
        """Teste compensação com prejuízo disponível"""
        ganho_mes = 3000.00
        prejuizo_acumulado = 1500.00
        
        resultado_tributavel, novo_prejuizo = aplicar_compensacao_prejuizo(
            ganho_mes, prejuizo_acumulado
        )
        
        # Resultado tributável: 3000 - 1500 = 1500
        # Novo prejuízo: 0 (foi totalmente utilizado)
        assert abs(resultado_tributavel - 1500.00) < 0.01
        assert novo_prejuizo == 0.00
    
    def test_compensacao_prejuizo_insuficiente(self):
        """Teste compensação com prejuízo maior que ganho"""
        ganho_mes = 1000.00
        prejuizo_acumulado = 2500.00
        
        resultado_tributavel, novo_prejuizo = aplicar_compensacao_prejuizo(
            ganho_mes, prejuizo_acumulado
        )
        
        # Resultado tributável: 0 (ganho foi totalmente compensado)
        # Novo prejuízo: 2500 - 1000 = 1500
        assert resultado_tributavel == 0.00
        assert abs(novo_prejuizo - 1500.00) < 0.01
    
    def test_compensacao_sem_prejuizo(self):
        """Teste sem prejuízo acumulado"""
        ganho_mes = 2000.00
        prejuizo_acumulado = 0.00
        
        resultado_tributavel, novo_prejuizo = aplicar_compensacao_prejuizo(
            ganho_mes, prejuizo_acumulado
        )
        
        # Resultado tributável: todo o ganho
        # Novo prejuízo: continua zero
        assert abs(resultado_tributavel - 2000.00) < 0.01
        assert novo_prejuizo == 0.00
    
    def test_mes_com_prejuizo_acumula(self):
        """Teste mês com prejuízo acumula com anterior"""
        ganho_mes = -800.00  # Prejuízo no mês
        prejuizo_acumulado = 1200.00
        
        resultado_tributavel, novo_prejuizo = aplicar_compensacao_prejuizo(
            ganho_mes, prejuizo_acumulado
        )
        
        # Resultado tributável: 0 (prejuízo no mês)
        # Novo prejuízo: 1200 + 800 = 2000
        assert resultado_tributavel == 0.00
        assert abs(novo_prejuizo - 2000.00) < 0.01


@pytest.mark.fiscal
class TestGeracaoDARF:
    """Testes para geração de DARF"""
    
    def test_gerar_darf_day_trade(self):
        """Teste geração DARF day trade"""
        resultado_mensal = {
            "mes": "2024-01",
            "ganho_liquido_day": 2000.00,
            "irrf_day": 20.00,
            "ir_devido_day": 400.00,
            "ir_pagar_day": 380.00
        }
        
        darf = gerar_darf_automatico(resultado_mensal, "day_trade")
        
        assert darf is not None
        assert darf["codigo"] == "6015"
        assert darf["competencia"] == "01/2024"
        assert abs(darf["valor"] - 380.00) < 0.01
        assert darf["vencimento"] == "2024-02-29"  # Último dia útil de fevereiro
    
    def test_gerar_darf_swing_trade(self):
        """Teste geração DARF swing trade"""
        resultado_mensal = {
            "mes": "2024-03",
            "ganho_liquido_swing": 10000.00,
            "irrf_swing": 50.00,
            "ir_devido_swing": 1500.00,
            "ir_pagar_swing": 1450.00
        }
        
        darf = gerar_darf_automatico(resultado_mensal, "swing_trade")
        
        assert darf is not None
        assert darf["codigo"] == "6015"
        assert darf["competencia"] == "03/2024"
        assert abs(darf["valor"] - 1450.00) < 0.01
        assert darf["vencimento"] == "2024-04-30"
    
    def test_gerar_darf_valor_minimo(self):
        """Teste geração DARF abaixo do valor mínimo"""
        resultado_mensal = {
            "mes": "2024-02",
            "ganho_liquido_day": 40.00,
            "irrf_day": 0.40,
            "ir_devido_day": 8.00,
            "ir_pagar_day": 7.60  # Abaixo de R$ 10
        }
        
        darf = gerar_darf_automatico(resultado_mensal, "day_trade")
        
        # Não deve gerar DARF para valores abaixo de R$ 10
        assert darf is None
    
    def test_gerar_darf_prejuizo(self):
        """Teste tentativa de gerar DARF com prejuízo"""
        resultado_mensal = {
            "mes": "2024-04",
            "ganho_liquido_swing": -1000.00,
            "irrf_swing": 0.00,
            "ir_devido_swing": 0.00,
            "ir_pagar_swing": 0.00
        }
        
        darf = gerar_darf_automatico(resultado_mensal, "swing_trade")
        
        # Não deve gerar DARF para prejuízo
        assert darf is None


@pytest.mark.fiscal
class TestCenariosComplexos:
    """Testes para cenários fiscais complexos"""
    
    def test_cenario_misto_lucro_prejuizo(self, sample_user):
        """Teste cenário com lucros e prejuízos alternados"""
        operacoes = [
            # Janeiro - Day trade com lucro
            {"date": date(2024, 1, 15), "ticker": "PETR4", "operation": "buy", "quantity": 100, "price": 30.00, "fees": 5.00, "usuario_id": sample_user.id},
            {"date": date(2024, 1, 15), "ticker": "PETR4", "operation": "sell", "quantity": 100, "price": 32.00, "fees": 6.00, "usuario_id": sample_user.id},
            
            # Fevereiro - Day trade com prejuízo
            {"date": date(2024, 2, 10), "ticker": "VALE3", "operation": "buy", "quantity": 200, "price": 65.00, "fees": 10.00, "usuario_id": sample_user.id},
            {"date": date(2024, 2, 10), "ticker": "VALE3", "operation": "sell", "quantity": 200, "price": 63.00, "fees": 12.00, "usuario_id": sample_user.id},
            
            # Março - Day trade com lucro (deve compensar prejuízo anterior)
            {"date": date(2024, 3, 5), "ticker": "ITUB4", "operation": "buy", "quantity": 500, "price": 25.00, "fees": 15.00, "usuario_id": sample_user.id},
            {"date": date(2024, 3, 5), "ticker": "ITUB4", "operation": "sell", "quantity": 500, "price": 27.00, "fees": 18.00, "usuario_id": sample_user.id}
        ]
        
        # Simular processamento mensal
        with patch('database.obter_todas_operacoes') as mock_operacoes:
            mock_operacoes.return_value = operacoes
            
            resultados = recalcular_resultados_corrigido(sample_user.id)
            
            assert len(resultados) == 3  # 3 meses
            
            # Janeiro: deve ter lucro e IR devido
            jan = next(r for r in resultados if r["mes"] == "2024-01")
            assert jan["ganho_liquido_day"] > 0
            assert jan["ir_devido_day"] > 0
            
            # Fevereiro: deve ter prejuízo
            fev = next(r for r in resultados if r["mes"] == "2024-02")
            assert fev["ganho_liquido_day"] < 0
            assert fev["prejuizo_acumulado_day"] > 0
            
            # Março: deve compensar prejuízo anterior
            mar = next(r for r in resultados if r["mes"] == "2024-03")
            assert mar["ganho_liquido_day"] > 0
            assert mar["prejuizo_acumulado_day"] < fev["prejuizo_acumulado_day"]
    
    def test_cenario_isencao_swing_trade(self, sample_user, sample_stocks):
        """Teste cenário de isenção em swing trade"""
        from database import inserir_operacao
        
        # Operações swing trade com vendas abaixo do limite de isenção
        operacoes = [
            {"date": date(2024, 1, 10), "ticker": "PETR4", "operation": "buy", "quantity": 100, "price": 30.00, "fees": 5.00},
            {"date": date(2024, 1, 25), "ticker": "PETR4", "operation": "sell", "quantity": 100, "price": 32.00, "fees": 6.00}  # Venda: R$ 3.200
        ]
        
        for op in operacoes:
            inserir_operacao(op, sample_user.id)
        
        resultados = recalcular_resultados_corrigido(sample_user.id)
        
        resultado_jan = next(r for r in resultados if r["mes"] == "2024-01")
        
        # Deve estar isento (vendas < R$ 20k)
        assert resultado_jan["isento_swing"] is True
        assert resultado_jan["ir_devido_swing"] == 0.00
        assert resultado_jan["ir_pagar_swing"] == 0.00
    
    def test_cenario_venda_descoberto_day_trade(self, sample_user, sample_stocks):
        """Teste day trade com venda descoberto"""
        from database import inserir_operacao
        
        operacoes = [
            {"date": date(2024, 1, 15), "ticker": "WEGE3", "operation": "sell", "quantity": 200, "price": 42.00, "fees": 10.00},
            {"date": date(2024, 1, 15), "ticker": "WEGE3", "operation": "buy", "quantity": 200, "price": 40.00, "fees": 9.00}
        ]
        
        for op in operacoes:
            inserir_operacao(op, sample_user.id)
        
        resultados = recalcular_resultados_corrigido(sample_user.id)
        
        resultado_jan = next(r for r in resultados if r["mes"] == "2024-01")
        
        # Deve calcular lucro corretamente na venda descoberto
        # Receita: 200 * 42 - 10 = 8390
        # Custo: 200 * 40 + 9 = 8009  
        # Lucro: 8390 - 8009 = 381
        assert resultado_jan["ganho_liquido_day"] > 0
        assert abs(resultado_jan["ganho_liquido_day"] - 381.00) < 1.00
    
    def test_cenario_multiplas_acoes_mesmo_mes(self, sample_user, sample_stocks):
        """Teste múltiplas ações operadas no mesmo mês"""
        from database import inserir_operacao
        
        operacoes = [
            # PETR4 - Day trade com lucro
            {"date": date(2024, 1, 5), "ticker": "PETR4", "operation": "buy", "quantity": 100, "price": 30.00, "fees": 5.00},
            {"date": date(2024, 1, 5), "ticker": "PETR4", "operation": "sell", "quantity": 100, "price": 32.00, "fees": 6.00},
            
            # VALE3 - Day trade com prejuízo
            {"date": date(2024, 1, 10), "ticker": "VALE3", "operation": "buy", "quantity": 150, "price": 65.00, "fees": 8.00},
            {"date": date(2024, 1, 10), "ticker": "VALE3", "operation": "sell", "quantity": 150, "price": 63.00, "fees": 9.00},
            
            # ITUB4 - Swing trade
            {"date": date(2024, 1, 8), "ticker": "ITUB4", "operation": "buy", "quantity": 400, "price": 25.00, "fees": 12.00},
            {"date": date(2024, 2, 15), "ticker": "ITUB4", "operation": "sell", "quantity": 400, "price": 27.00, "fees": 15.00}
        ]
        
        for op in operacoes:
            inserir_operacao(op, sample_user.id)
        
        resultados = recalcular_resultados_corrigido(sample_user.id)
        
        # Janeiro deve consolidar day trades de PETR4 e VALE3
        jan = next(r for r in resultados if r["mes"] == "2024-01")
        
        # Deve haver atividade de day trade
        assert jan["vendas_day_trade"] > 0
        
        # Fevereiro deve ter o swing trade de ITUB4
        fev = next(r for r in resultados if r["mes"] == "2024-02")
        assert fev["vendas_swing"] > 0


@pytest.mark.fiscal
class TestValidacoesFiscais:
    """Testes para validações fiscais"""
    
    def test_validacao_periodo_apuracao(self):
        """Teste validação de período de apuração"""
        # Periods devem estar no formato YYYY-MM
        periodos_validos = ["2024-01", "2024-12", "2023-06"]
        periodos_invalidos = ["2024", "24-01", "2024-13", "2024-00"]
        
        from services import validar_periodo_apuracao
        
        for periodo in periodos_validos:
            assert validar_periodo_apuracao(periodo) is True
        
        for periodo in periodos_invalidos:
            assert validar_periodo_apuracao(periodo) is False
    
    def test_validacao_valor_minimo_darf(self):
        """Teste validação valor mínimo DARF"""
        from services import validar_valor_minimo_darf
        
        assert validar_valor_minimo_darf(15.00) is True   # Acima de R$ 10
        assert validar_valor_minimo_darf(10.00) is True   # Exatamente R$ 10
        assert validar_valor_minimo_darf(9.99) is False   # Abaixo de R$ 10
        assert validar_valor_minimo_darf(0.00) is False   # Zero
    
    def test_validacao_aliquotas(self):
        """Teste validação de alíquotas corretas"""
        from services import obter_aliquota_ir
        
        # Day trade: 20%
        assert obter_aliquota_ir("day_trade") == 0.20
        
        # Swing trade: 15%
        assert obter_aliquota_ir("swing_trade") == 0.15
        
        # Tipo inválido deve retornar None ou erro
        with pytest.raises(ValueError):
            obter_aliquota_ir("tipo_invalido")
    
    def test_validacao_data_vencimento_darf(self):
        """Teste validação de data de vencimento DARF"""
        from services import calcular_data_vencimento_darf
        
        # Janeiro -> vencimento em fevereiro
        vencimento_jan = calcular_data_vencimento_darf("2024-01")
        assert vencimento_jan == date(2024, 2, 29)  # 2024 é bissexto
        
        # Dezembro -> vencimento em janeiro seguinte
        vencimento_dez = calcular_data_vencimento_darf("2024-12")
        assert vencimento_dez == date(2025, 1, 31)
        
        # Setembro -> vencimento em outubro
        vencimento_set = calcular_data_vencimento_darf("2024-09")
        assert vencimento_set == date(2024, 10, 31)


@pytest.mark.fiscal
@pytest.mark.integration
class TestIntegracaoFiscal:
    """Testes de integração para fluxo fiscal completo"""
    
    def test_fluxo_completo_calculo_ir(self, complex_scenario):
        """Teste fluxo completo de cálculo de IR"""
        user_id = complex_scenario[0]["usuario_id"]
        
        # Executar recálculo completo
        resultados = recalcular_resultados_corrigido(user_id)
        
        assert len(resultados) > 0
        
        for resultado in resultados:
            # Verificar campos obrigatórios
            assert "mes" in resultado
            assert "vendas_swing" in resultado
            assert "vendas_day_trade" in resultado
            assert "ir_devido_swing" in resultado
            assert "ir_devido_day" in resultado
            
            # Verificar consistência dos cálculos
            if resultado["ganho_liquido_swing"] > 0 and not resultado["isento_swing"]:
                assert resultado["ir_devido_swing"] > 0
            
            if resultado["ganho_liquido_day"] > 0:
                assert resultado["ir_devido_day"] > 0
            
            # IRRF não pode ser maior que IR devido
            assert resultado["irrf_day"] <= resultado["ir_devido_day"]
            assert resultado["irrf_swing"] <= resultado["ir_devido_swing"]
    
    def test_persistencia_resultados_mensais(self, sample_user, db_session):
        """Teste persistência de resultados mensais no banco"""
        from database import salvar_resultado_mensal, obter_resultado_mensal
        
        resultado = {
            "mes": "2024-01",
            "vendas_swing": 30000.00,
            "custo_swing": 28000.00,
            "ganho_liquido_swing": 2000.00,
            "isento_swing": False,
            "prejuizo_acumulado_swing": 0.00,
            "ir_devido_swing": 300.00,
            "ir_pagar_swing": 300.00,
            "vendas_day_trade": 15000.00,
            "custo_day_trade": 14000.00,
            "ganho_liquido_day": 1000.00,
            "prejuizo_acumulado_day": 0.00,
            "irrf_day": 10.00,
            "ir_devido_day": 200.00,
            "ir_pagar_day": 190.00,
            "irrf_swing": 15.00
        }
        
        # Salvar
        salvar_resultado_mensal(sample_user.id, resultado)
        
        # Recuperar
        resultado_recuperado = obter_resultado_mensal(sample_user.id, "2024-01")
        
        assert resultado_recuperado is not None
        assert float(resultado_recuperado["ganho_liquido_swing"]) == 2000.00
        assert float(resultado_recuperado["ir_devido_day"]) == 200.00