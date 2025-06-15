import unittest
from unittest.mock import patch, MagicMock
import sqlite3 # Import sqlite3 to allow mocking of its Row type if necessary

# Assuming database.py is in the parent directory relative to the tests directory
# Adjust the import path as necessary based on your project structure
from backend import database

class TestDatabaseFunctions(unittest.TestCase):

    @patch('backend.database.get_db')
    def test_obter_tickers_operados_por_usuario(self, mock_get_db):
        # Setup mock connection and cursor
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_get_db.return_value.__enter__.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cursor

        # Test case 1: User has operations with multiple unique tickers
        mock_cursor.fetchall.return_value = [{'ticker': 'PETR4'}, {'ticker': 'VALE3'}]
        tickers = database.obter_tickers_operados_por_usuario(usuario_id=1)
        self.assertEqual(tickers, ['PETR4', 'VALE3'])
        mock_cursor.execute.assert_called_once_with(
            '''
            SELECT DISTINCT ticker
            FROM operacoes
            WHERE usuario_id = ?
            ORDER BY ticker
        ''', (1,)
        )
        mock_cursor.reset_mock() # Reset mock for the next call

        # Test case 2: User has operations with only one ticker
        mock_cursor.fetchall.return_value = [{'ticker': 'MGLU3'}]
        tickers = database.obter_tickers_operados_por_usuario(usuario_id=2)
        self.assertEqual(tickers, ['MGLU3'])
        mock_cursor.execute.assert_called_once_with(
            '''
            SELECT DISTINCT ticker
            FROM operacoes
            WHERE usuario_id = ?
            ORDER BY ticker
        ''', (2,)
        )
        mock_cursor.reset_mock()

        # Test case 3: User has no operations
        mock_cursor.fetchall.return_value = []
        tickers = database.obter_tickers_operados_por_usuario(usuario_id=3)
        self.assertEqual(tickers, [])
        mock_cursor.execute.assert_called_once_with(
            '''
            SELECT DISTINCT ticker
            FROM operacoes
            WHERE usuario_id = ?
            ORDER BY ticker
        ''', (3,)
        )

    @patch('backend.database.get_db')
    def test_obter_proventos_por_ticker(self, mock_get_db):
        # Setup mock connection and cursor
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_get_db.return_value.__enter__.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cursor

        sql_query = '''
            SELECT
                p.id,
                p.id_acao,
                a.ticker as ticker_acao,
                a.nome as nome_acao,
                p.tipo,
                p.valor,
                p.data_registro,
                p.data_ex,
                p.dt_pagamento
            FROM proventos p
            JOIN acoes a ON p.id_acao = a.id
            WHERE a.ticker = ?
            ORDER BY p.data_ex DESC, p.dt_pagamento DESC
        '''

        # Test case 1: Ticker has multiple proventos
        mock_cursor.fetchall.return_value = [
            {'id': 1, 'id_acao': 10, 'ticker_acao': 'PETR4', 'nome_acao': 'Petrobras', 'tipo': 'DIVIDENDO', 'valor': 1.0, 'data_ex': '2023-01-15', 'dt_pagamento': '2023-02-28', 'data_registro': '2023-01-01'},
            {'id': 2, 'id_acao': 10, 'ticker_acao': 'PETR4', 'nome_acao': 'Petrobras', 'tipo': 'JCP', 'valor': 0.5, 'data_ex': '2022-12-10', 'dt_pagamento': '2023-01-20', 'data_registro': '2022-12-01'}
        ]
        proventos = database.obter_proventos_por_ticker(ticker='PETR4')
        self.assertEqual(len(proventos), 2)
        self.assertEqual(proventos[0]['ticker_acao'], 'PETR4')
        self.assertEqual(proventos[0]['valor'], 1.0)
        self.assertEqual(proventos[1]['tipo'], 'JCP')
        mock_cursor.execute.assert_called_once_with(sql_query, ('PETR4',))
        mock_cursor.reset_mock()

        # Test case 2: Ticker has one provento
        mock_cursor.fetchall.return_value = [
            {'id': 3, 'id_acao': 11, 'ticker_acao': 'VALE3', 'nome_acao': 'Vale', 'tipo': 'DIVIDENDO', 'valor': 2.0, 'data_ex': '2023-03-20', 'dt_pagamento': '2023-04-15', 'data_registro': '2023-03-01'}
        ]
        proventos = database.obter_proventos_por_ticker(ticker='VALE3')
        self.assertEqual(len(proventos), 1)
        self.assertEqual(proventos[0]['id'], 3)
        self.assertEqual(proventos[0]['nome_acao'], 'Vale')
        mock_cursor.execute.assert_called_once_with(sql_query, ('VALE3',))
        mock_cursor.reset_mock()

        # Test case 3: Ticker has no proventos
        mock_cursor.fetchall.return_value = []
        proventos = database.obter_proventos_por_ticker(ticker='MGLU3')
        self.assertEqual(len(proventos), 0)
        mock_cursor.execute.assert_called_once_with(sql_query, ('MGLU3',))
        mock_cursor.reset_mock()

        # Test case 4: Ticker does not exist (simulated by query returning empty list)
        mock_cursor.fetchall.return_value = []
        proventos = database.obter_proventos_por_ticker(ticker='XYZ99')
        self.assertEqual(len(proventos), 0)
        mock_cursor.execute.assert_called_once_with(sql_query, ('XYZ99',))

if __name__ == '__main__':
    unittest.main(argv=['first-arg-is-ignored'], exit=False)
