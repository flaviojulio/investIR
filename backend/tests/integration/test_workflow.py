"""
Testes de integração para fluxos completos de trabalho
Cobre cenários end-to-end do sistema
"""
import pytest
from datetime import date, datetime, timedelta
import json
import tempfile
import os

from database import (
    inserir_operacao, obter_todas_operacoes, atualizar_carteira,
    obter_carteira_atual, salvar_resultado_mensal, obter_resultados_mensais
)
from services import (
    recalcular_resultados_corrigido, recalcular_carteira,
    processar_arquivo_importacao, calcular_operacoes_fechadas
)
from calculos import calcular_resultados_operacoes


@pytest.mark.integration
class TestFluxoCompletoOperacoes:
    """Testes para fluxo completo de operações"""
    
    def test_fluxo_upload_calculo_carteira(self, sample_user, sample_stocks, sample_corretora):
        """Teste fluxo completo: upload -> cálculo -> carteira"""
        
        # 1. Simular upload de operações
        operacoes_upload = [
            {"date": date(2024, 1, 10), "ticker": "PETR4", "operation": "buy", "quantity": 100, "price": 30.00, "fees": 5.00},
            {"date": date(2024, 1, 15), "ticker": "PETR4", "operation": "buy", "quantity": 200, "price": 31.00, "fees": 8.00},
            {"date": date(2024, 1, 20), "ticker": "VALE3", "operation": "buy", "quantity": 150, "price": 65.00, "fees": 10.00},
            {"date": date(2024, 2, 5), "ticker": "PETR4", "operation": "sell", "quantity": 150, "price": 32.50, "fees": 12.00}
        ]
        
        # Inserir operações
        for op in operacoes_upload:
            inserir_operacao(op, sample_user.id)
        
        # 2. Recalcular carteira
        recalcular_carteira(sample_user.id)
        
        # 3. Verificar carteira resultante
        carteira = obter_carteira_atual(sample_user.id)
        
        assert len(carteira) == 2  # PETR4 e VALE3
        
        # Verificar posição PETR4: 100 + 200 - 150 = 150 ações
        petr4 = next(item for item in carteira if item["ticker"] == "PETR4")
        assert petr4["quantidade"] == 150
        
        # Verificar posição VALE3: 150 ações
        vale3 = next(item for item in carteira if item["ticker"] == "VALE3")
        assert vale3["quantidade"] == 150
        
        # 4. Recalcular resultados
        resultados = recalcular_resultados_corrigido(sample_user.id)
        
        assert len(resultados) == 2  # Janeiro e fevereiro
        
        # Verificar que fevereiro tem operação fechada (venda parcial PETR4)
        fev = next(r for r in resultados if r["mes"] == "2024-02")
        assert fev["vendas_swing"] > 0
    
    def test_fluxo_day_trade_completo(self, sample_user, sample_stocks):
        """Teste fluxo completo de day trade"""
        
        # Day trade com múltiplas operações no mesmo dia
        operacoes_dt = [
            {"date": date(2024, 1, 15), "ticker": "BBAS3", "operation": "buy", "quantity": 100, "price": 45.00, "fees": 8.00},
            {"date": date(2024, 1, 15), "ticker": "BBAS3", "operation": "buy", "quantity": 200, "price": 46.00, "fees": 12.00},
            {"date": date(2024, 1, 15), "ticker": "BBAS3", "operation": "sell", "quantity": 300, "price": 47.50, "fees": 20.00}
        ]
        
        for op in operacoes_dt:
            inserir_operacao(op, sample_user.id)
        
        # Calcular operações fechadas
        operacoes_fechadas = calcular_operacoes_fechadas(sample_user.id)
        
        # Deve ter uma operação day trade fechada
        day_trades = [op for op in operacoes_fechadas if op.day_trade]
        assert len(day_trades) == 1
        
        dt = day_trades[0]
        assert dt.ticker == "BBAS3"
        assert dt.quantidade == 300
        assert dt.resultado > 0  # Deve ter lucro
        
        # Recalcular resultados mensais
        resultados = recalcular_resultados_corrigido(sample_user.id)
        
        jan = next(r for r in resultados if r["mes"] == "2024-01")
        assert jan["vendas_day_trade"] > 0
        assert jan["ganho_liquido_day"] > 0
        assert jan["ir_devido_day"] > 0
        assert jan["irrf_day"] > 0  # IRRF de 1% sobre ganhos
    
    def test_fluxo_venda_descoberto_completo(self, sample_user, sample_stocks):
        """Teste fluxo completo de venda descoberto"""
        
        operacoes_short = [
            {"date": date(2024, 1, 10), "ticker": "WEGE3", "operation": "sell", "quantity": 200, "price": 42.00, "fees": 10.00},
            {"date": date(2024, 1, 25), "ticker": "WEGE3", "operation": "buy", "quantity": 200, "price": 40.50, "fees": 9.00}
        ]
        
        for op in operacoes_short:
            inserir_operacao(op, sample_user.id)
        
        # Calcular operações fechadas
        operacoes_fechadas = calcular_operacoes_fechadas(sample_user.id)
        
        # Deve ter uma operação de venda descoberto fechada
        short_ops = [op for op in operacoes_fechadas if op.tipo == "venda-compra"]
        assert len(short_ops) == 1
        
        short = short_ops[0]
        assert short.ticker == "WEGE3"
        assert short.quantidade == 200
        assert short.resultado > 0  # Lucro na venda descoberto
        
        # Verificar carteira (deve estar zerada)
        carteira = obter_carteira_atual(sample_user.id)
        wege3_items = [item for item in carteira if item["ticker"] == "WEGE3"]
        assert len(wege3_items) == 0  # Posição fechada
    
    def test_fluxo_compensacao_prejuizo(self, sample_user, sample_stocks):
        """Teste fluxo completo com compensação de prejuízo"""
        
        # Janeiro: Day trade com prejuízo
        operacoes_jan = [
            {"date": date(2024, 1, 10), "ticker": "ITUB4", "operation": "buy", "quantity": 300, "price": 26.00, "fees": 12.00},
            {"date": date(2024, 1, 10), "ticker": "ITUB4", "operation": "sell", "quantity": 300, "price": 24.50, "fees": 15.00}
        ]
        
        # Março: Day trade com lucro
        operacoes_mar = [
            {"date": date(2024, 3, 5), "ticker": "PETR4", "operation": "buy", "quantity": 200, "price": 30.00, "fees": 10.00},
            {"date": date(2024, 3, 5), "ticker": "PETR4", "operation": "sell", "quantity": 200, "price": 33.00, "fees": 12.00}
        ]
        
        todas_operacoes = operacoes_jan + operacoes_mar
        for op in todas_operacoes:
            inserir_operacao(op, sample_user.id)
        
        # Recalcular resultados
        resultados = recalcular_resultados_corrigido(sample_user.id)
        
        # Janeiro deve ter prejuízo
        jan = next(r for r in resultados if r["mes"] == "2024-01")
        assert jan["ganho_liquido_day"] < 0
        assert jan["prejuizo_acumulado_day"] > 0
        
        # Março deve compensar prejuízo anterior
        mar = next(r for r in resultados if r["mes"] == "2024-03")
        assert mar["ganho_liquido_day"] > 0
        
        # O IR devido deve ser calculado após compensação
        if mar["ganho_liquido_day"] > jan["prejuizo_acumulado_day"]:
            assert mar["ir_devido_day"] > 0
        else:
            assert mar["ir_devido_day"] == 0


@pytest.mark.integration
class TestFluxoImportacao:
    """Testes para fluxo de importação de arquivos"""
    
    def test_importacao_arquivo_json_completo(self, sample_user, sample_stocks):
        """Teste importação completa de arquivo JSON"""
        
        # Criar arquivo temporário com operações
        operacoes_json = [
            {
                "Data do Negócio": "2024-01-15",
                "Código de Negociação": "PETR4",
                "Tipo de Movimentação": "C",
                "Quantidade": 100,
                "Preço": 30.50,
                "Taxas": 5.20
            },
            {
                "Data do Negócio": "2024-01-15",
                "Código de Negociação": "PETR4", 
                "Tipo de Movimentação": "V",
                "Quantidade": 100,
                "Preço": 32.00,
                "Taxas": 6.10
            }
        ]
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(operacoes_json, f, ensure_ascii=False, indent=2)
            arquivo_path = f.name
        
        try:
            # Processar importação
            resultado = processar_arquivo_importacao(
                usuario_id=sample_user.id,
                arquivo_path=arquivo_path,
                nome_original="test_operacoes.json"
            )
            
            assert resultado["operacoes_importadas"] == 2
            assert resultado["operacoes_erro"] == 0
            
            # Verificar se operações foram inseridas
            operacoes = obter_todas_operacoes(sample_user.id)
            assert len(operacoes) == 2
            
            # Verificar se operações têm ID de importação
            for op in operacoes:
                assert op["importacao_id"] is not None
                assert op["nome_arquivo_original"] == "test_operacoes.json"
                
        finally:
            os.unlink(arquivo_path)
    
    def test_importacao_operacoes_duplicadas(self, sample_user, sample_stocks):
        """Teste importação com operações duplicadas"""
        
        # Inserir operação manualmente primeiro
        operacao_existente = {
            "date": date(2024, 1, 15),
            "ticker": "VALE3",
            "operation": "buy",
            "quantity": 200,
            "price": 65.00,
            "fees": 10.00
        }
        inserir_operacao(operacao_existente, sample_user.id)
        
        # Tentar importar a mesma operação
        operacoes_json = [
            {
                "Data do Negócio": "2024-01-15",
                "Código de Negociação": "VALE3",
                "Tipo de Movimentação": "C",
                "Quantidade": 200,
                "Preço": 65.00,
                "Taxas": 10.00
            }
        ]
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(operacoes_json, f)
            arquivo_path = f.name
        
        try:
            resultado = processar_arquivo_importacao(
                usuario_id=sample_user.id,
                arquivo_path=arquivo_path,
                nome_original="duplicadas.json"
            )
            
            # Deve detectar duplicata
            assert resultado["operacoes_duplicadas"] == 1
            assert resultado["operacoes_importadas"] == 0
            
        finally:
            os.unlink(arquivo_path)


@pytest.mark.integration
class TestFluxoComplexo:
    """Testes para cenários complexos integrados"""
    
    def test_cenario_investidor_ativo_completo(self, sample_user, sample_stocks, sample_corretora):
        """Teste cenário completo de investidor ativo"""
        
        # Simular 6 meses de operações variadas
        operacoes_complexas = [
            # Janeiro - Day trades e início de posições
            {"date": date(2024, 1, 5), "ticker": "PETR4", "operation": "buy", "quantity": 100, "price": 28.00, "fees": 5.00},
            {"date": date(2024, 1, 5), "ticker": "PETR4", "operation": "sell", "quantity": 100, "price": 29.50, "fees": 6.00},
            {"date": date(2024, 1, 10), "ticker": "VALE3", "operation": "buy", "quantity": 200, "price": 60.00, "fees": 12.00},
            
            # Fevereiro - Swing trade e day trade
            {"date": date(2024, 2, 1), "ticker": "VALE3", "operation": "sell", "quantity": 100, "price": 65.00, "fees": 8.00},
            {"date": date(2024, 2, 15), "ticker": "ITUB4", "operation": "buy", "quantity": 400, "price": 25.00, "fees": 15.00},
            {"date": date(2024, 2, 15), "ticker": "ITUB4", "operation": "sell", "quantity": 400, "price": 26.50, "fees": 18.00},
            
            # Março - Venda descoberto e recompra
            {"date": date(2024, 3, 5), "ticker": "BBAS3", "operation": "sell", "quantity": 300, "price": 48.00, "fees": 20.00},
            {"date": date(2024, 3, 20), "ticker": "BBAS3", "operation": "buy", "quantity": 300, "price": 45.50, "fees": 18.00},
            
            # Abril - Múltiplas operações day trade
            {"date": date(2024, 4, 10), "ticker": "WEGE3", "operation": "buy", "quantity": 150, "price": 40.00, "fees": 10.00},
            {"date": date(2024, 4, 10), "ticker": "WEGE3", "operation": "sell", "quantity": 150, "price": 42.00, "fees": 12.00},
            {"date": date(2024, 4, 15), "ticker": "PETR4", "operation": "buy", "quantity": 200, "price": 32.00, "fees": 8.00},
            {"date": date(2024, 4, 15), "ticker": "PETR4", "operation": "sell", "quantity": 200, "price": 31.00, "fees": 9.00},
            
            # Maio - Liquidação de posições
            {"date": date(2024, 5, 5), "ticker": "VALE3", "operation": "sell", "quantity": 100, "price": 68.00, "fees": 10.00},
            
            # Junho - Novas posições
            {"date": date(2024, 6, 1), "ticker": "ITUB4", "operation": "buy", "quantity": 500, "price": 24.00, "fees": 20.00}
        ]
        
        # Inserir todas as operações
        for op in operacoes_complexas:
            inserir_operacao(op, sample_user.id, corretora_id=sample_corretora["id"] if op["ticker"] == "PETR4" else None)
        
        # Executar recálculos completos
        recalcular_carteira(sample_user.id)
        resultados = recalcular_resultados_corrigido(sample_user.id)
        operacoes_fechadas = calcular_operacoes_fechadas(sample_user.id)
        
        # Verificações gerais
        assert len(resultados) == 6  # 6 meses
        assert len(operacoes_fechadas) > 0  # Deve ter operações fechadas
        
        # Verificar carteira final
        carteira = obter_carteira_atual(sample_user.id)
        carteira_dict = {item["ticker"]: item["quantidade"] for item in carteira}
        
        # VALE3: 200 - 100 - 100 = 0 (zerada)
        assert carteira_dict.get("VALE3", 0) == 0
        
        # ITUB4: 500 (última compra)
        assert carteira_dict.get("ITUB4", 0) == 500
        
        # Verificar que há day trades e swing trades
        day_trades = [op for op in operacoes_fechadas if op.day_trade]
        swing_trades = [op for op in operacoes_fechadas if not op.day_trade]
        
        assert len(day_trades) > 0
        assert len(swing_trades) > 0
        
        # Verificar cálculos fiscais
        total_ir_devido = 0
        for resultado in resultados:
            total_ir_devido += resultado.get("ir_pagar_day", 0) + resultado.get("ir_pagar_swing", 0)
        
        # Deve haver algum IR devido ao longo do período
        assert total_ir_devido >= 0
        
        # Verificar consolidação de prejuízos (se houver)
        for i, resultado in enumerate(resultados[1:], 1):
            # Prejuízo acumulado não deve crescer infinitamente
            prejuizo_anterior = resultados[i-1].get("prejuizo_acumulado_day", 0)
            prejuizo_atual = resultado.get("prejuizo_acumulado_day", 0)
            
            # Se houve ganho no mês, prejuízo deve diminuir ou zerar
            if resultado.get("ganho_liquido_day", 0) > 0:
                assert prejuizo_atual <= prejuizo_anterior
    
    def test_recuperacao_apos_erro(self, sample_user, sample_stocks):
        """Teste recuperação do sistema após erros"""
        
        # Inserir operações válidas
        operacoes_validas = [
            {"date": date(2024, 1, 10), "ticker": "PETR4", "operation": "buy", "quantity": 100, "price": 30.00, "fees": 5.00},
            {"date": date(2024, 1, 15), "ticker": "PETR4", "operation": "sell", "quantity": 100, "price": 32.00, "fees": 6.00}
        ]
        
        for op in operacoes_validas:
            inserir_operacao(op, sample_user.id)
        
        # Simular erro durante recálculo (com mock que falha)
        with pytest.raises(Exception):
            with patch('calculos.calcular_resultados_operacoes') as mock_calc:
                mock_calc.side_effect = Exception("Erro simulado")
                recalcular_resultados_corrigido(sample_user.id)
        
        # Sistema deve se recuperar em nova tentativa
        resultados = recalcular_resultados_corrigido(sample_user.id)
        
        assert len(resultados) == 1
        assert resultados[0]["mes"] == "2024-01"
        
        # Carteira deve permanecer consistente
        carteira = obter_carteira_atual(sample_user.id)
        petr4_items = [item for item in carteira if item["ticker"] == "PETR4"]
        assert len(petr4_items) == 0  # Posição fechada
    
    @pytest.mark.slow
    def test_performance_grandes_volumes(self, sample_user, sample_stocks):
        """Teste performance com grandes volumes de operações"""
        import time
        
        # Gerar 2000 operações distribuídas em 12 meses
        operacoes_volume = []
        base_date = date(2024, 1, 1)
        
        for i in range(2000):
            dia = (i % 30) + 1
            mes = ((i // 30) % 12) + 1
            
            operacao = {
                "date": date(2024, mes, min(dia, 28)),  # Evitar dias inválidos
                "ticker": ["PETR4", "VALE3", "ITUB4", "BBAS3"][i % 4],
                "operation": "buy" if i % 2 == 0 else "sell",
                "quantity": 100,
                "price": 30.00 + (i % 50) * 0.1,
                "fees": 5.00 + (i % 20) * 0.1
            }
            operacoes_volume.append(operacao)
        
        # Medir tempo de inserção
        start_time = time.time()
        
        for op in operacoes_volume:
            inserir_operacao(op, sample_user.id)
        
        insert_time = time.time() - start_time
        
        # Medir tempo de recálculo
        start_time = time.time()
        
        recalcular_carteira(sample_user.id)
        resultados = recalcular_resultados_corrigido(sample_user.id)
        
        calc_time = time.time() - start_time
        
        # Verificar performance (tempos razoáveis)
        assert insert_time < 120.0  # Menos de 2 minutos para inserir 2000 operações
        assert calc_time < 60.0     # Menos de 1 minuto para recálculos
        
        # Verificar resultados
        assert len(resultados) == 12  # 12 meses
        
        # Verificar que todas as operações foram processadas
        total_operacoes = obter_todas_operacoes(sample_user.id)
        assert len(total_operacoes) == 2000