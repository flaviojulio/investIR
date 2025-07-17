import unittest
from unittest.mock import patch, MagicMock, call
from datetime import date, datetime
from collections import defaultdict

# Supondo que services.py está em backend/services.py e models.py em backend/models.py
# Ajuste os imports conforme a estrutura real do seu projeto.
# É preciso garantir que o PYTHONPATH esteja configurado para encontrar 'services' e 'models'
# ou usar imports relativos se test_services.py estiver em uma estrutura de pacote.
# Para este exemplo, vamos assumir que pode ser importado diretamente.
# Se services.py estiver em app/services.py, o import seria from app import services
# No entanto, o arquivo lido foi backend/services.py
# Tentar importar diretamente as funções do módulo 'services' que está em backend/
# Adicione o diretório 'backend' ao sys.path para permitir a importação direta.
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from services import (
    recalcular_carteira,
    recalcular_resultados,
    _calcular_resultado_dia # Para possível teste direto ou para entender seu comportamento.
)
# Mock das OperacaoCreate e outros modelos se necessário, ou use dicts simples para operações.

from .test_utils import setup_test_database
from backend.database import inserir_operacao, obter_carteira_atual, obter_resultados_mensais

class TestServices(unittest.TestCase):

    def setUp(self):
        self.conn = setup_test_database()
        self.db_patcher = patch('backend.database.get_db', return_value=self.conn)
        self.mock_get_db = self.db_patcher.start()
        self.usuario_id = 1

    def tearDown(self):
        self.db_patcher.stop()
        self.conn.close()

    def test_recalcular_carteira_cenario_usuario(self):
        # Teste 1: Cenário do usuário
        # Compra de 1000 ações ITUB4 a R$19,00
        op1_data = {'date': date(2025, 1, 9), 'ticker': 'ITUB4', 'operation': 'buy', 'quantity': 1000, 'price': 19.00, 'fees': 0.0}
        inserir_operacao(op1_data, self.usuario_id)

        recalcular_carteira(usuario_id=self.usuario_id)

        carteira = obter_carteira_atual(self.usuario_id)
        self.assertEqual(len(carteira), 1)
        self.assertEqual(carteira[0]['ticker'], 'ITUB4')
        self.assertEqual(carteira[0]['quantidade'], 1000)
        self.assertAlmostEqual(carteira[0]['preco_medio'], 19.00, places=2)

    def test_recalcular_resultados_cenario_usuario(self):
        op1_data = {'date': date(2025, 1, 9), 'ticker': 'ITUB4', 'operation': 'buy', 'quantity': 1000, 'price': 19.00, 'fees': 0.0}
        inserir_operacao(op1_data, self.usuario_id)

        op2_data = {'date': date(2025, 1, 24), 'ticker': 'ITUB4', 'operation': 'sell', 'quantity': 1000, 'price': 25.00, 'fees': 0.0}
        inserir_operacao(op2_data, self.usuario_id)

        recalcular_resultados(usuario_id=self.usuario_id)

        resultados = obter_resultados_mensais(self.usuario_id)
        self.assertEqual(len(resultados), 1)
        resultado_jan_2025 = resultados[0]

        self.assertEqual(resultado_jan_2025['mes'], '2025-01')
        self.assertAlmostEqual(resultado_jan_2025['ganho_liquido_swing'], 6000.00, places=2)
        self.assertAlmostEqual(resultado_jan_2025['ir_pagar_swing'], 900.00, places=2)
        self.assertFalse(resultado_jan_2025['isento_swing'])

    def test_multiplas_compras_e_venda_total(self):
        inserir_operacao({'date': date(2025, 1, 5), 'ticker': 'ITUB4', 'operation': 'buy', 'quantity': 500, 'price': 18.00, 'fees': 0.0}, self.usuario_id)
        inserir_operacao({'date': date(2025, 1, 10), 'ticker': 'ITUB4', 'operation': 'buy', 'quantity': 500, 'price': 20.00, 'fees': 0.0}, self.usuario_id)
        inserir_operacao({'date': date(2025, 1, 15), 'ticker': 'ITUB4', 'operation': 'sell', 'quantity': 1000, 'price': 25.00, 'fees': 0.0}, self.usuario_id)

        recalcular_resultados(usuario_id=self.usuario_id)

        resultados = obter_resultados_mensais(self.usuario_id)
        self.assertEqual(len(resultados), 1)
        resultado_jan_2025 = resultados[0]

        self.assertAlmostEqual(resultado_jan_2025['ganho_liquido_swing'], 6000.00, places=2)
        self.assertAlmostEqual(resultado_jan_2025['ir_pagar_swing'], 900.00, places=2)

    def test_venda_parcial_e_novas_compras(self):
        inserir_operacao({'date': date(2025, 2, 1), 'ticker': 'ITUB4', 'operation': 'buy', 'quantity': 1000, 'price': 19.00, 'fees': 0.0}, self.usuario_id)
        inserir_operacao({'date': date(2025, 2, 10), 'ticker': 'ITUB4', 'operation': 'sell', 'quantity': 500, 'price': 25.00, 'fees': 0.0}, self.usuario_id)
        inserir_operacao({'date': date(2025, 2, 15), 'ticker': 'ITUB4', 'operation': 'buy', 'quantity': 500, 'price': 22.00, 'fees': 0.0}, self.usuario_id)
        inserir_operacao({'date': date(2025, 2, 20), 'ticker': 'ITUB4', 'operation': 'sell', 'quantity': 500, 'price': 26.00, 'fees': 0.0}, self.usuario_id)

        recalcular_resultados(usuario_id=self.usuario_id)

        resultados = obter_resultados_mensais(self.usuario_id)
        self.assertEqual(len(resultados), 1)
        resultado_fev_2025 = resultados[0]

        self.assertAlmostEqual(resultado_fev_2025['ganho_liquido_swing'], 5750.00, places=2)
        self.assertAlmostEqual(resultado_fev_2025['ir_pagar_swing'], 862.50, places=2)

if __name__ == '__main__':
    unittest.main(argv=['first-arg-is-ignored'], exit=False)


class TestRecalcularProventosRapido(unittest.TestCase):

    def setUp(self):
        self.usuario_id = 123
        # It's good practice to ensure mocks are reset for each test method,
        # @patch decorator handles this for functions/methods it decorates.

    @patch('services.inserir_usuario_provento_recebido_db')
    @patch('services.obter_saldo_acao_em_data')
    @patch('services.obter_proventos_por_ticker')
    @patch('services.obter_tickers_operados_por_usuario')
    @patch('services.limpar_usuario_proventos_recebidos_db')
    def test_recalcular_proventos_rapido_no_operations(
        self, mock_limpar, mock_obter_tickers, mock_obter_proventos,
        mock_obter_saldo, mock_inserir
    ):
        from services import recalcular_proventos_recebidos_rapido
        mock_obter_tickers.return_value = [] # No tickers operated

        result = recalcular_proventos_recebidos_rapido(self.usuario_id)

        mock_limpar.assert_called_once_with(self.usuario_id)
        mock_obter_tickers.assert_called_once_with(self.usuario_id)
        mock_obter_proventos.assert_not_called()
        mock_obter_saldo.assert_not_called()
        mock_inserir.assert_not_called()
        self.assertEqual(result, {"proventos_verificados": 0, "proventos_calculados": 0, "erros": 0, "mensagem": "Nenhum ticker operado pelo usuário. Nenhum provento a calcular."})

    @patch('services.inserir_usuario_provento_recebido_db')
    @patch('services.obter_saldo_acao_em_data')
    @patch('services.obter_proventos_por_ticker')
    @patch('services.obter_tickers_operados_por_usuario')
    @patch('services.limpar_usuario_proventos_recebidos_db')
    @patch('services.dt') # Mocking datetime.datetime within services.py
    def test_recalcular_proventos_rapido_with_operations_and_proventos(
        self, mock_datetime, mock_limpar, mock_obter_tickers, mock_obter_proventos,
        mock_obter_saldo, mock_inserir
    ):
        from services import recalcular_proventos_recebidos_rapido
        from datetime import date, datetime as dt_real # For creating date objects

        # Setup mock for dt.now()
        mock_now = dt_real(2023, 1, 1, 12, 0, 0)
        mock_datetime.now.return_value = mock_now

        mock_obter_tickers.return_value = ["TICKER1"]
        mock_provento = {
            "id": 1, "id_acao": 10, "ticker_acao": "TICKER1", "nome_acao": "Empresa 1",
            "tipo": "JCP", "valor": 1.0,
            "data_ex": date(2023, 1, 15), # Changed to date object
            "dt_pagamento": date(2023, 2, 28) # Changed to date object
        }
        mock_obter_proventos.return_value = [mock_provento]
        mock_obter_saldo.return_value = 100 # 100 shares

        result = recalcular_proventos_recebidos_rapido(self.usuario_id)

        mock_limpar.assert_called_once_with(self.usuario_id)
        mock_obter_tickers.assert_called_once_with(self.usuario_id)
        mock_obter_proventos.assert_called_once_with("TICKER1")

        # Expected data_ex_obj is date(2023, 1, 15)
        # Expected data_para_saldo is date(2023, 1, 14)
        expected_data_para_saldo = date(2023, 1, 14)
        mock_obter_saldo.assert_called_once_with(self.usuario_id, "TICKER1", expected_data_para_saldo)

        expected_dados_insercao = {
            'usuario_id': self.usuario_id,
            'provento_global_id': 1,
            'id_acao': 10,
            'ticker_acao': "TICKER1",
            'nome_acao': "Empresa 1",
            'tipo_provento': "JCP",
            'data_ex': "2023-01-15",
            'dt_pagamento': "2023-02-28",
            'valor_unitario_provento': 1.0,
            'quantidade_possuida_na_data_ex': 100,
            'valor_total_recebido': 100.0,
            'data_calculo': mock_now.isoformat()
        }
        mock_inserir.assert_called_once_with(expected_dados_insercao)
        self.assertEqual(result, {"proventos_verificados": 1, "proventos_calculados": 1, "erros": 0, "mensagem": "Recálculo rápido de proventos concluído."})

    @patch('services.inserir_usuario_provento_recebido_db')
    @patch('services.obter_saldo_acao_em_data')
    @patch('services.obter_proventos_por_ticker')
    @patch('services.obter_tickers_operados_por_usuario')
    @patch('services.limpar_usuario_proventos_recebidos_db')
    @patch('services.logging') # Mock logging
    def test_recalcular_proventos_rapido_unparseable_date_format_increments_errors(
        self, mock_logging, mock_limpar, mock_obter_tickers, mock_obter_proventos,
        mock_obter_saldo, mock_inserir
    ):
        from services import recalcular_proventos_recebidos_rapido
        mock_obter_tickers.return_value = ["TICKER1"]
        # Test with data_ex: None
        mock_provento_bad_date = {
            "id": 100, "id_acao": 11, "ticker_acao": "TICKER1", "nome_acao": "Empresa B",
            "tipo": "DIVIDENDO", "valor": 0.5,
            "data_ex": None, # data_ex is None
            "dt_pagamento": date(2023, 3, 10)
        }
        mock_obter_proventos.return_value = [mock_provento_bad_date]
        mock_obter_tickers.return_value = ["TICKER1"] # Ensure this is set for this specific iteration

        result = recalcular_proventos_recebidos_rapido(self.usuario_id)

        mock_limpar.assert_called_once_with(self.usuario_id) # Called once for the test method
        mock_obter_tickers.assert_called_once_with(self.usuario_id) # Called once for the test method
        mock_obter_proventos.assert_called_once_with("TICKER1")
        mock_obter_saldo.assert_not_called()
        mock_inserir.assert_not_called()

        self.assertEqual(result, {"proventos_verificados": 1, "proventos_calculados": 0, "erros": 1, "mensagem": "Recálculo rápido de proventos concluído."})
        mock_logging.warning.assert_any_call(
             f"[Proventos Rápido] data_ex inválida ou ausente (tipo: {type(None)}, valor: 'None') para provento ID {mock_provento_bad_date.get('id')}, ticker TICKER1. Pulando."
        )

    @patch('services.inserir_usuario_provento_recebido_db')
    @patch('services.obter_saldo_acao_em_data')
    @patch('services.obter_proventos_por_ticker')
    @patch('services.obter_tickers_operados_por_usuario')
    @patch('services.limpar_usuario_proventos_recebidos_db')
    def test_recalcular_proventos_rapido_saldo_zero(
        self, mock_limpar, mock_obter_tickers, mock_obter_proventos,
        mock_obter_saldo, mock_inserir
    ):
        from services import recalcular_proventos_recebidos_rapido
        mock_obter_tickers.return_value = ["TICKER1"]
        mock_provento_valido = {
            "id": 3, "id_acao": 12, "ticker_acao": "TICKER1", "nome_acao": "Empresa C",
            "tipo": "RENDIMENTO", "valor": 1.2,
            "data_ex": date(2023, 4, 5), # Changed to date object
            "dt_pagamento": date(2023, 5, 10) # Changed to date object
        }
        mock_obter_proventos.return_value = [mock_provento_valido]
        mock_obter_saldo.return_value = 0 # Saldo zero

        result = recalcular_proventos_recebidos_rapido(self.usuario_id)

        mock_limpar.assert_called_once_with(self.usuario_id)
        mock_obter_tickers.assert_called_once_with(self.usuario_id)
        mock_obter_proventos.assert_called_once_with("TICKER1")
        mock_obter_saldo.assert_called_once() # Check it was called
        mock_inserir.assert_not_called()
        self.assertEqual(result, {"proventos_verificados": 1, "proventos_calculados": 0, "erros": 0, "mensagem": "Recálculo rápido de proventos concluído."})

    @patch('services.inserir_usuario_provento_recebido_db')
    @patch('services.obter_saldo_acao_em_data')
    @patch('services.obter_proventos_por_ticker')
    @patch('services.obter_tickers_operados_por_usuario')
    @patch('services.limpar_usuario_proventos_recebidos_db')
    @patch('services.dt') # Mocking datetime.datetime
    @patch('services.logging') # Mock logging
    def test_recalcular_proventos_rapido_provento_valor_none(
        self, mock_logging, mock_datetime, mock_limpar, mock_obter_tickers, mock_obter_proventos,
        mock_obter_saldo, mock_inserir
    ):
        from services import recalcular_proventos_recebidos_rapido
        from datetime import datetime as dt_real

        mock_now = dt_real(2023, 1, 1, 12, 0, 0)
        mock_datetime.now.return_value = mock_now

        mock_obter_tickers.return_value = ["TICKER1"]
        mock_provento_valor_none = {
            "id": 4, "id_acao": 13, "ticker_acao": "TICKER1", "nome_acao": "Empresa D",
            "tipo": "JCP", "valor": None,
            "data_ex": date(2023, 6, 10), # Changed to date object
            "dt_pagamento": date(2023, 7, 15) # Changed to date object
        }
        mock_obter_proventos.return_value = [mock_provento_valor_none]
        mock_obter_saldo.return_value = 100

        result = recalcular_proventos_recebidos_rapido(self.usuario_id)

        mock_limpar.assert_called_once_with(self.usuario_id)
        mock_obter_tickers.assert_called_once_with(self.usuario_id)
        mock_obter_proventos.assert_called_once_with("TICKER1")
        mock_obter_saldo.assert_called_once()

        expected_dados_insercao = {
            'usuario_id': self.usuario_id,
            'provento_global_id': 4,
            'id_acao': 13,
            'ticker_acao': "TICKER1",
            'nome_acao': "Empresa D",
            'tipo_provento': "JCP",
            'data_ex': "2023-06-10",
            'dt_pagamento': "2023-07-15",
            'valor_unitario_provento': 0.0, # Valor deve ser 0.0
            'quantidade_possuida_na_data_ex': 100,
            'valor_total_recebido': 0.0, # 100 * 0.0 = 0.0
            'data_calculo': mock_now.isoformat()
        }
        mock_inserir.assert_called_once_with(expected_dados_insercao)
        self.assertEqual(result, {"proventos_verificados": 1, "proventos_calculados": 1, "erros": 0, "mensagem": "Recálculo rápido de proventos concluído."})
        mock_logging.warning.assert_any_call(f"[Proventos Rápido] Provento ID {mock_provento_valor_none.get('id')} para ticker TICKER1 não possui 'valor'. Assumindo 0.0.")

    # Removed test_recalcular_proventos_rapido_date_conversion_if_string and
    # test_recalcular_proventos_rapido_data_ex_ddmmyyyy_format as the service
    # now expects date objects from the layer below (obter_proventos_por_ticker)
    # due to SQLite date converters. The remaining tests cover None and valid date objects.

    @patch('services.inserir_usuario_provento_recebido_db')
    @patch('services.obter_saldo_acao_em_data')
    @patch('services.obter_proventos_por_ticker')
    @patch('services.obter_tickers_operados_por_usuario')
    @patch('services.limpar_usuario_proventos_recebidos_db')
    @patch('services.logging') # Mock logging
    def test_recalcular_proventos_rapido_general_exception_handling(
        self, mock_logging, mock_limpar, mock_obter_tickers, mock_obter_proventos,
        mock_obter_saldo, mock_inserir
    ):
        from services import recalcular_proventos_recebidos_rapido
        mock_obter_tickers.return_value = ["TICKER1"]
        mock_provento_valido = {
            "id": 7, "id_acao": 16, "ticker_acao": "TICKER1", "nome_acao": "Empresa G",
            "tipo": "DIVIDENDO", "valor": 1.0,
            "data_ex": date(2023, 11, 1), # Changed to date object
            "dt_pagamento": date(2023, 12, 1) # Changed to date object
        }
        mock_obter_proventos.return_value = [mock_provento_valido]
        # Simulate an error during obter_saldo_acao_em_data
        mock_obter_saldo.side_effect = Exception("Simulated DB error")

        result = recalcular_proventos_recebidos_rapido(self.usuario_id)

        mock_limpar.assert_called_once_with(self.usuario_id)
        mock_obter_tickers.assert_called_once_with(self.usuario_id)
        mock_obter_proventos.assert_called_once_with("TICKER1")
        mock_obter_saldo.assert_called_once() # It was called
        mock_inserir.assert_not_called() # Should not be called due to the error

        self.assertEqual(result, {"proventos_verificados": 1, "proventos_calculados": 0, "erros": 1, "mensagem": "Recálculo rápido de proventos concluído."})
        # Check that a warning was logged
        mock_logging.warning.assert_any_call(
            f"[Proventos Rápido] Falha no cálculo do provento ID {mock_provento_valido.get('id')} para o ticker TICKER1 (usuário {self.usuario_id}): Simulated DB error",
            exc_info=True
        )

if __name__ == '__main__':
    unittest.main(argv=['first-arg-is-ignored'], exit=False)
