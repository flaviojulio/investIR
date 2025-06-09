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

# Variável global para simular o banco de dados de operações
mock_db_operacoes = []
mock_db_carteira = defaultdict(lambda: {"quantidade": 0, "preco_medio": 0.0, "custo_total": 0.0})
mock_db_resultados_mensais = []

def mock_inserir_operacao(op_data, usuario_id):
    global mock_db_operacoes
    # Adiciona um ID simples para a operação, similar ao que o DB faria
    op_data['id'] = len(mock_db_operacoes) + 1
    op_data['usuario_id'] = usuario_id
    # Converte string de data para objeto date se necessário (o serviço espera objetos date)
    if isinstance(op_data['date'], str):
        op_data['date'] = datetime.strptime(op_data['date'], '%Y-%m-%d').date()
    mock_db_operacoes.append(op_data)
    return op_data['id']

def mock_obter_todas_operacoes(usuario_id):
    global mock_db_operacoes
    # Filtra por usuario_id e ordena por data e id (para estabilidade)
    user_ops = [op for op in mock_db_operacoes if op['usuario_id'] == usuario_id]
    user_ops.sort(key=lambda x: (x['date'], x['id']))
    return user_ops

def mock_limpar_carteira_usuario_db(usuario_id):
    global mock_db_carteira
    # Na verdade, a carteira é um dict com ticker como chave.
    # Precisamos limpar os itens pertencentes a este usuário.
    # Para simplificar o mock, vamos assumir que a carteira mockada é por usuário
    # ou que os testes usarão um usuario_id consistente e limparão globalmente.
    mock_db_carteira.clear()

def mock_atualizar_carteira(ticker, quantidade, preco_medio, usuario_id):
    global mock_db_carteira
    # Assume que usuario_id está implícito ou não é necessário para este mock simples de carteira
    if quantidade > 0:
        mock_db_carteira[ticker] = {
            "ticker": ticker, # Adicionado para corresponder ao modelo CarteiraAtual
            "quantidade": quantidade,
            "preco_medio": preco_medio,
            # Custo total não é diretamente salvo por atualizar_carteira, mas é parte do cálculo interno
            # e pode ser inferido se necessário: quantidade * preco_medio
            "custo_total": round(quantidade * preco_medio, 2) # Calculado para consistência
        }
    elif ticker in mock_db_carteira:
        # Se a quantidade for zero, removemos o ticker da carteira mockada
        del mock_db_carteira[ticker]


def mock_obter_carteira_atual(usuario_id):
    global mock_db_carteira
    # Retorna uma lista de dicts, como o DB faria
    return list(mock_db_carteira.values())

def mock_limpar_resultados_mensais_usuario_db(usuario_id):
    global mock_db_resultados_mensais
    mock_db_resultados_mensais = [] # Simplesmente limpa a lista global

def mock_salvar_resultado_mensal(resultado_data, usuario_id):
    global mock_db_resultados_mensais
    # Adiciona usuario_id para possível filtragem se necessário
    res_copy = resultado_data.copy()
    res_copy['usuario_id'] = usuario_id
    mock_db_resultados_mensais.append(res_copy)

def mock_obter_resultados_mensais(usuario_id):
    global mock_db_resultados_mensais
    return [res for res in mock_db_resultados_mensais if res['usuario_id'] == usuario_id]


class TestServices(unittest.TestCase):

    def setUp(self):
        # Limpa os mocks do "banco de dados" antes de cada teste
        global mock_db_operacoes, mock_db_carteira, mock_db_resultados_mensais
        mock_db_operacoes = []
        mock_db_carteira = defaultdict(lambda: {"quantidade": 0, "preco_medio": 0.0, "custo_total": 0.0})
        mock_db_resultados_mensais = []
        self.usuario_id = 1 # Usuário padrão para os testes

    @patch('services.limpar_carteira_usuario_db', side_effect=mock_limpar_carteira_usuario_db)
    @patch('services.obter_todas_operacoes', side_effect=mock_obter_todas_operacoes)
    @patch('services.atualizar_carteira', side_effect=mock_atualizar_carteira)
    def test_recalcular_carteira_cenario_usuario(self, mock_atualizar, mock_obter_ops, mock_limpar_carteira):
        # Teste 1: Cenário do usuário
        # Compra de 1000 ações ITUB4 a R$19,00
        op1_data = {'date': date(2025, 1, 9), 'ticker': 'ITUB4', 'operation': 'buy', 'quantity': 1000, 'price': 19.00, 'fees': 0.0}
        mock_inserir_operacao(op1_data, self.usuario_id)

        recalcular_carteira(usuario_id=self.usuario_id)

        # Verificar se atualizar_carteira foi chamado com os valores corretos
        # A carteira_temp dentro de recalcular_carteira deve ter ITUB4 com PM 19.00
        # mock_atualizar.assert_called_with('ITUB4', 1000, 19.00, usuario_id=self.usuario_id)
        # Mais robusto: verificar o estado do mock_db_carteira
        self.assertEqual(mock_db_carteira['ITUB4']['quantidade'], 1000)
        self.assertAlmostEqual(mock_db_carteira['ITUB4']['preco_medio'], 19.00, places=2)

    @patch('services.limpar_resultados_mensais_usuario_db', side_effect=mock_limpar_resultados_mensais_usuario_db)
    @patch('services.obter_todas_operacoes', side_effect=mock_obter_todas_operacoes)
    @patch('services.obter_carteira_atual', side_effect=mock_obter_carteira_atual)
    @patch('services.salvar_resultado_mensal', side_effect=mock_salvar_resultado_mensal)
    def test_recalcular_resultados_cenario_usuario(self, mock_salvar_res, mock_obter_cart, mock_obter_ops, mock_limpar_res):
        # Teste 1 (continuação): Cenário do usuário para resultado
        # Setup inicial da carteira (compra)
        op1_data = {'date': date(2025, 1, 9), 'ticker': 'ITUB4', 'operation': 'buy', 'quantity': 1000, 'price': 19.00, 'fees': 0.0}
        mock_inserir_operacao(op1_data, self.usuario_id)
        # Simular que recalcular_carteira já rodou e populou mock_db_carteira
        mock_db_carteira['ITUB4'] = {'ticker': 'ITUB4', 'quantidade': 1000, 'preco_medio': 19.00, 'custo_total': 19000.0}

        # Venda
        op2_data = {'date': date(2025, 1, 24), 'ticker': 'ITUB4', 'operation': 'sell', 'quantity': 1000, 'price': 25.00, 'fees': 0.0}
        mock_inserir_operacao(op2_data, self.usuario_id)

        recalcular_resultados(usuario_id=self.usuario_id)

        self.assertTrue(len(mock_db_resultados_mensais) > 0, "Nenhum resultado mensal foi salvo.")
        resultado_jan_2025 = next((r for r in mock_db_resultados_mensais if r['mes'] == '2025-01'), None)
        self.assertIsNotNone(resultado_jan_2025, "Resultado para Jan/2025 não encontrado.")

        self.assertAlmostEqual(resultado_jan_2025['ganho_liquido_swing'], 6000.00, places=2)
        self.assertAlmostEqual(resultado_jan_2025['ir_pagar_swing'], 900.00, places=2)
        self.assertFalse(resultado_jan_2025['isento_swing'])

    @patch('services.limpar_carteira_usuario_db', side_effect=mock_limpar_carteira_usuario_db)
    @patch('services.obter_todas_operacoes', side_effect=mock_obter_todas_operacoes)
    @patch('services.atualizar_carteira', side_effect=mock_atualizar_carteira)
    @patch('services.limpar_resultados_mensais_usuario_db', side_effect=mock_limpar_resultados_mensais_usuario_db)
    @patch('services.obter_carteira_atual', side_effect=mock_obter_carteira_atual)
    @patch('services.salvar_resultado_mensal', side_effect=mock_salvar_resultado_mensal)
    def test_multiplas_compras_e_venda_total(self, mock_salvar_res, mock_obter_cart, mock_limpar_res_mensais, mock_atualizar_cart, mock_obter_ops, mock_limpar_cart):
        # Teste 2: Múltiplas Compras
        # Compra 1: 500 ITUB4 @ R$18,00
        mock_inserir_operacao({'date': date(2025, 1, 5), 'ticker': 'ITUB4', 'operation': 'buy', 'quantity': 500, 'price': 18.00, 'fees': 0.0}, self.usuario_id)
        recalcular_carteira(usuario_id=self.usuario_id)
        self.assertAlmostEqual(mock_db_carteira['ITUB4']['preco_medio'], 18.00, places=2)

        # Compra 2: 500 ITUB4 @ R$20,00
        mock_inserir_operacao({'date': date(2025, 1, 10), 'ticker': 'ITUB4', 'operation': 'buy', 'quantity': 500, 'price': 20.00, 'fees': 0.0}, self.usuario_id)
        recalcular_carteira(usuario_id=self.usuario_id)
        self.assertAlmostEqual(mock_db_carteira['ITUB4']['preco_medio'], 19.00, places=2) # (500*18 + 500*20) / 1000 = 19

        # Venda: 1000 ITUB4 @ R$25,00
        mock_inserir_operacao({'date': date(2025, 1, 15), 'ticker': 'ITUB4', 'operation': 'sell', 'quantity': 1000, 'price': 25.00, 'fees': 0.0}, self.usuario_id)
        # O mock_db_carteira agora reflete o PM de 19.00, que será usado por _calcular_resultado_dia via mock_obter_carteira_atual

        recalcular_resultados(usuario_id=self.usuario_id)
        resultado_jan_2025 = next((r for r in mock_db_resultados_mensais if r['mes'] == '2025-01'), None)
        self.assertIsNotNone(resultado_jan_2025)
        self.assertAlmostEqual(resultado_jan_2025['ganho_liquido_swing'], 6000.00, places=2) # (25-19)*1000
        self.assertAlmostEqual(resultado_jan_2025['ir_pagar_swing'], 900.00, places=2)

    @patch('services.limpar_carteira_usuario_db', side_effect=mock_limpar_carteira_usuario_db)
    @patch('services.obter_todas_operacoes', side_effect=mock_obter_todas_operacoes)
    @patch('services.atualizar_carteira', side_effect=mock_atualizar_carteira)
    @patch('services.limpar_resultados_mensais_usuario_db', side_effect=mock_limpar_resultados_mensais_usuario_db)
    @patch('services.obter_carteira_atual', side_effect=mock_obter_carteira_atual)
    @patch('services.salvar_resultado_mensal', side_effect=mock_salvar_resultado_mensal)
    def test_venda_parcial_e_novas_compras(self, mock_salvar_res, mock_obter_cart, mock_limpar_res_mensais, mock_atualizar_cart, mock_obter_ops, mock_limpar_cart):
        # Teste 3: Venda Parcial
        # Compra 1: 1000 ITUB4 @ R$19,00
        mock_inserir_operacao({'date': date(2025, 2, 1), 'ticker': 'ITUB4', 'operation': 'buy', 'quantity': 1000, 'price': 19.00, 'fees': 0.0}, self.usuario_id)
        recalcular_carteira(usuario_id=self.usuario_id)
        self.assertAlmostEqual(mock_db_carteira['ITUB4']['preco_medio'], 19.00, places=2)

        # Venda 1: 500 ITUB4 @ R$25,00 (Mês Fev)
        mock_inserir_operacao({'date': date(2025, 2, 10), 'ticker': 'ITUB4', 'operation': 'sell', 'quantity': 500, 'price': 25.00, 'fees': 0.0}, self.usuario_id)
        # Antes de recalcular_resultados, recalcular_carteira para atualizar o PM para a próxima compra/venda
        recalcular_carteira(usuario_id=self.usuario_id)
        self.assertAlmostEqual(mock_db_carteira['ITUB4']['preco_medio'], 19.00, places=2) # PM das restantes deve ser 19
        self.assertEqual(mock_db_carteira['ITUB4']['quantidade'], 500)


        # Compra 2: 500 ITUB4 @ R$22,00 (Mês Fev)
        mock_inserir_operacao({'date': date(2025, 2, 15), 'ticker': 'ITUB4', 'operation': 'buy', 'quantity': 500, 'price': 22.00, 'fees': 0.0}, self.usuario_id)
        recalcular_carteira(usuario_id=self.usuario_id)
        # (500*19 + 500*22) / 1000 = (9500 + 11000) / 1000 = 20500 / 1000 = 20.50
        self.assertAlmostEqual(mock_db_carteira['ITUB4']['preco_medio'], 20.50, places=2)
        self.assertEqual(mock_db_carteira['ITUB4']['quantidade'], 1000)

        # Venda 2: 500 ITUB4 @ R$26,00 (Mês Fev)
        mock_inserir_operacao({'date': date(2025, 2, 20), 'ticker': 'ITUB4', 'operation': 'sell', 'quantity': 500, 'price': 26.00, 'fees': 0.0}, self.usuario_id)
        # O mock_db_carteira agora reflete o PM de 20.50 para esta venda, que será usado por _calcular_resultado_dia
        # Mas recalcular_carteira precisa ser chamado após esta venda para que o PM da carteira final seja correto para obter_carteira_atual
        # No entanto, para recalcular_resultados, o importante é o PM *no momento da venda*.
        # Vamos garantir que mock_obter_carteira_atual reflita o PM de 20.50 para a Venda 2.
        # Isso é feito implicitamente porque recalcular_carteira (acima) atualizou mock_db_carteira para 20.50.

        recalcular_resultados(usuario_id=self.usuario_id)
        resultado_fev_2025 = next((r for r in mock_db_resultados_mensais if r['mes'] == '2025-02'), None)
        self.assertIsNotNone(resultado_fev_2025, "Resultado para Fev/2025 não encontrado.")

        # Lucro Venda 1: (25-19)*500 = 3000
        # Lucro Venda 2: (26-20.50)*500 = 2750
        # Total: 5750
        self.assertAlmostEqual(resultado_fev_2025['ganho_liquido_swing'], 5750.00, places=2)
        self.assertAlmostEqual(resultado_fev_2025['ir_pagar_swing'], 862.50, places=2) # 5750 * 0.15

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
            "tipo": "JCP", "valor": 1.0, "data_ex": "2023-01-15", "dt_pagamento": "2023-02-28"
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
        # Test with various unparseable date strings
        unparseable_dates = ["--", "invalid-date", "", None, "2023/01/15", "15-01-2023"]

        for i, invalid_date_str in enumerate(unparseable_dates):
            mock_limpar.reset_mock()
            mock_obter_tickers.reset_mock()
            mock_obter_proventos.reset_mock()
            mock_obter_saldo.reset_mock()
            mock_inserir.reset_mock()
            mock_logging.reset_mock()

            provento_id = 100 + i
            mock_provento_bad_date = {
                "id": provento_id, "id_acao": 11, "ticker_acao": "TICKER1", "nome_acao": "Empresa B",
                "tipo": "DIVIDENDO", "valor": 0.5, "data_ex": invalid_date_str, "dt_pagamento": "2023-03-10"
            }
            mock_obter_proventos.return_value = [mock_provento_bad_date]
            mock_obter_tickers.return_value = ["TICKER1"]


            result = recalcular_proventos_recebidos_rapido(self.usuario_id)

            mock_limpar.assert_called_once_with(self.usuario_id)
            mock_obter_tickers.assert_called_once_with(self.usuario_id)
            mock_obter_proventos.assert_called_once_with("TICKER1")
            mock_obter_saldo.assert_not_called()
            mock_inserir.assert_not_called()

            self.assertEqual(result, {"proventos_verificados": 1, "proventos_calculados": 0, "erros": 1, "mensagem": "Recálculo rápido de proventos concluído."},
                             msg=f"Failed for data_ex: '{invalid_date_str}'")
            mock_logging.warning.assert_any_call(
                f"[Proventos Rápido] Formato de data_ex inválido ou ausente ('{invalid_date_str}') para provento ID {provento_id}, ticker TICKER1. Pulando."
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
            "tipo": "RENDIMENTO", "valor": 1.2, "data_ex": "2023-04-05", "dt_pagamento": "2023-05-10"
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
            "tipo": "JCP", "valor": None, "data_ex": "2023-06-10", "dt_pagamento": "2023-07-15"
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


    @patch('services.inserir_usuario_provento_recebido_db')
    @patch('services.obter_saldo_acao_em_data')
    @patch('services.obter_proventos_por_ticker')
    @patch('services.obter_tickers_operados_por_usuario')
    @patch('services.limpar_usuario_proventos_recebidos_db')
    @patch('services.dt') # Mocking datetime.datetime
    def test_recalcular_proventos_rapido_date_conversion_if_string(
        self, mock_datetime, mock_limpar, mock_obter_tickers, mock_obter_proventos,
        mock_obter_saldo, mock_inserir
    ):
        from services import recalcular_proventos_recebidos_rapido
        from datetime import datetime as dt_real, date # Ensure date is imported for constructing expected_data_para_saldo

        mock_now = dt_real(2023, 1, 1, 12, 0, 0)
        mock_datetime.now.return_value = mock_now

        mock_obter_tickers.return_value = ["TICKER1"]
        # Test with data_ex as "YYYY-MM-DDTHH:MM:SS"
        mock_provento_datetime_str = {
            "id": 5, "id_acao": 14, "ticker_acao": "TICKER1", "nome_acao": "Empresa E",
            "tipo": "DIVIDENDO", "valor": 2.5, "data_ex": "2023-08-20T00:00:00", "dt_pagamento": "2023-09-25"
        }
        # Test with data_ex as "YYYY-MM-DD"
        mock_provento_date_str = {
            "id": 6, "id_acao": 15, "ticker_acao": "TICKER1", "nome_acao": "Empresa F",
            "tipo": "JCP", "valor": 1.5, "data_ex": "2023-10-10", "dt_pagamento": "2023-11-15"
        }
        mock_obter_proventos.return_value = [mock_provento_datetime_str, mock_provento_date_str]
        mock_obter_saldo.return_value = 50

        result = recalcular_proventos_recebidos_rapido(self.usuario_id)

        mock_limpar.assert_called_once_with(self.usuario_id)
        mock_obter_tickers.assert_called_once_with(self.usuario_id)
        mock_obter_proventos.assert_called_once_with("TICKER1")

        self.assertEqual(mock_obter_saldo.call_count, 2)
        # Check saldo call for first provento
        mock_obter_saldo.assert_any_call(self.usuario_id, "TICKER1", date(2023, 8, 19))
        # Check saldo call for second provento
        mock_obter_saldo.assert_any_call(self.usuario_id, "TICKER1", date(2023, 10, 9))

        self.assertEqual(mock_inserir.call_count, 2)
        expected_call_1_args = {
            'usuario_id': self.usuario_id, 'provento_global_id': 5, 'id_acao': 14, 'ticker_acao': 'TICKER1',
            'nome_acao': 'Empresa E', 'tipo_provento': 'DIVIDENDO', 'data_ex': '2023-08-20',
            'dt_pagamento': '2023-09-25', 'valor_unitario_provento': 2.5,
            'quantidade_possuida_na_data_ex': 50, 'valor_total_recebido': 125.0,
            'data_calculo': mock_now.isoformat()
        }
        expected_call_2_args = {
            'usuario_id': self.usuario_id, 'provento_global_id': 6, 'id_acao': 15, 'ticker_acao': 'TICKER1',
            'nome_acao': 'Empresa F', 'tipo_provento': 'JCP', 'data_ex': '2023-10-10',
            'dt_pagamento': '2023-11-15', 'valor_unitario_provento': 1.5,
            'quantidade_possuida_na_data_ex': 50, 'valor_total_recebido': 75.0,
            'data_calculo': mock_now.isoformat()
        }
        # Check that mock_inserir was called with these arguments, order doesn't matter for assert_any_call
        mock_inserir.assert_any_call(expected_call_1_args)
        mock_inserir.assert_any_call(expected_call_2_args)

        self.assertEqual(result, {"proventos_verificados": 2, "proventos_calculados": 2, "erros": 0, "mensagem": "Recálculo rápido de proventos concluído."})

    @patch('services.inserir_usuario_provento_recebido_db')
    @patch('services.obter_saldo_acao_em_data')
    @patch('services.obter_proventos_por_ticker')
    @patch('services.obter_tickers_operados_por_usuario')
    @patch('services.limpar_usuario_proventos_recebidos_db')
    @patch('services.dt') # Mocking datetime.datetime
    @patch('services.logging') # Mock logging for this specific test
    def test_recalcular_proventos_rapido_data_ex_ddmmyyyy_format(
        self, mock_logging, mock_datetime, mock_limpar, mock_obter_tickers, mock_obter_proventos,
        mock_obter_saldo, mock_inserir
    ):
        from services import recalcular_proventos_recebidos_rapido
        from datetime import datetime as dt_real, date

        mock_now = dt_real(2023, 1, 1, 12, 0, 0)
        mock_datetime.now.return_value = mock_now

        mock_obter_tickers.return_value = ["TICKER1"]
        mock_provento_ddmmyyyy = {
            "id": 8, "id_acao": 17, "ticker_acao": "TICKER1", "nome_acao": "Empresa H",
            "tipo": "DIVIDENDO", "valor": 3.0, "data_ex": "15/01/2023", "dt_pagamento": "28/02/2023"
        }
        mock_obter_proventos.return_value = [mock_provento_ddmmyyyy]
        mock_obter_saldo.return_value = 100

        result = recalcular_proventos_recebidos_rapido(self.usuario_id)

        mock_limpar.assert_called_once_with(self.usuario_id)
        mock_obter_tickers.assert_called_once_with(self.usuario_id)
        mock_obter_proventos.assert_called_once_with("TICKER1")

        expected_data_para_saldo = date(2023, 1, 14) # 15/01/2023 - 1 day
        mock_obter_saldo.assert_called_once_with(self.usuario_id, "TICKER1", expected_data_para_saldo)

        expected_dados_insercao = {
            'usuario_id': self.usuario_id,
            'provento_global_id': 8,
            'id_acao': 17,
            'ticker_acao': "TICKER1",
            'nome_acao': "Empresa H",
            'tipo_provento': "DIVIDENDO",
            'data_ex': "2023-01-15", # Assert ISO format
            'dt_pagamento': "2023-02-28", # Assuming dt_pagamento is also handled correctly
            'valor_unitario_provento': 3.0,
            'quantidade_possuida_na_data_ex': 100,
            'valor_total_recebido': 300.0,
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
    def test_recalcular_proventos_rapido_general_exception_handling(
        self, mock_logging, mock_limpar, mock_obter_tickers, mock_obter_proventos,
        mock_obter_saldo, mock_inserir
    ):
        from services import recalcular_proventos_recebidos_rapido
        mock_obter_tickers.return_value = ["TICKER1"]
        mock_provento_valido = {
            "id": 7, "id_acao": 16, "ticker_acao": "TICKER1", "nome_acao": "Empresa G",
            "tipo": "DIVIDENDO", "valor": 1.0, "data_ex": "2023-11-01", "dt_pagamento": "2023-12-01"
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
