import pytest
from unittest.mock import patch, MagicMock
from datetime import date, datetime

# Adjust import paths for testing environment
import sys
import os
# Add the backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../')))


# Imports from your project
from app.services.portfolio_analysis_service import get_holdings_on_date, calculate_portfolio_history, Operacao as ServiceOperacao, get_rendimentos_isentos_por_ano, RendimentoIsento
from models import EventoCorporativoInfo # For testing get_adjustment_factor

# --- Tests for EventoCorporativoInfo.get_adjustment_factor ---
# Added dummy id to EventoCorporativoInfo calls

def test_get_adjustment_factor_desdobramento():
    event = EventoCorporativoInfo(id=1, id_acao=1, evento="Desdobramento", razao="1:5")
    assert event.get_adjustment_factor() == 5.0

def test_get_adjustment_factor_agrupamento():
    event = EventoCorporativoInfo(id=1, id_acao=1, evento="Agrupamento", razao="10:1")
    assert event.get_adjustment_factor() == 0.1

def test_get_adjustment_factor_fracionado():
    event = EventoCorporativoInfo(id=1, id_acao=1, evento="Desdobramento", razao="2:3")
    assert event.get_adjustment_factor() == 1.5

def test_get_adjustment_factor_none_razao():
    event = EventoCorporativoInfo(id=1, id_acao=1, evento="Evento Qualquer", razao=None)
    assert event.get_adjustment_factor() == 1.0

def test_get_adjustment_factor_empty_razao():
    event = EventoCorporativoInfo(id=1, id_acao=1, evento="Evento Qualquer", razao="")
    assert event.get_adjustment_factor() == 1.0

def test_get_adjustment_factor_invalid_razao_format():
    event = EventoCorporativoInfo(id=1, id_acao=1, evento="Evento Qualquer", razao="invalid")
    assert event.get_adjustment_factor() == 1.0

def test_get_adjustment_factor_non_numeric_parts():
    event_a = EventoCorporativoInfo(id=1, id_acao=1, evento="Evento Qualquer", razao="A:5")
    assert event_a.get_adjustment_factor() == 1.0
    event_b = EventoCorporativoInfo(id=1, id_acao=1, evento="Evento Qualquer", razao="5:B")
    assert event_b.get_adjustment_factor() == 1.0

def test_get_adjustment_factor_division_by_zero_a():
    # "A:B", factor is B/A. If A is 0.
    event = EventoCorporativoInfo(id=1, id_acao=1, evento="Evento Qualquer", razao="0:5")
    assert event.get_adjustment_factor() == 1.0 # Handled by returning 1.0 if a == 0

def test_get_adjustment_factor_zero_b():
    # "A:B", factor is B/A. If B is 0.
    event = EventoCorporativoInfo(id=1, id_acao=1, evento="Evento Qualquer", razao="5:0")
    assert event.get_adjustment_factor() == 0.0

# --- Fixtures and Tests for get_holdings_on_date ---

@pytest.fixture
def sample_operations():
    # Default operations for general use
    return [
        ServiceOperacao(ticker="PETR4", date=date(2023, 1, 10), operation_type="buy", quantity=100, price=20.0, fees=1.0),
        ServiceOperacao(ticker="VALE3", date=date(2023, 1, 12), operation_type="buy", quantity=200, price=80.0, fees=1.0),
        ServiceOperacao(ticker="PETR4", date=date(2023, 1, 15), operation_type="sell", quantity=50, price=22.0, fees=1.0),
    ]

@pytest.fixture
def mock_db_calls():
    # Using a dictionary to hold multiple mocks if needed, or just return a tuple
    # Corrected patch paths to target 'database' module directly as used by the service
    with patch('database.obter_id_acao_por_ticker') as mock_get_id, \
         patch('database.obter_eventos_corporativos_por_id_acao_e_data_ex_anterior_a') as mock_get_events:
        yield mock_get_id, mock_get_events


def test_get_holdings_no_events(mock_db_calls, sample_operations):
    mock_get_id_acao, mock_get_events = mock_db_calls

    mock_get_id_acao.return_value = 1 # Dummy ID, actual value doesn't matter if events list is empty
    mock_get_events.return_value = [] # No corporate events

    target_date = "2023-01-20"
    holdings = get_holdings_on_date(sample_operations, target_date)

    assert holdings.get("PETR4") == 50  # 100 buy - 50 sell
    assert holdings.get("VALE3") == 200
    assert len(holdings) == 2
    # Check if it was called for each unique ticker present in sample_operations
    # Call count should be number of unique tickers if all return a valid id_acao
    # Here, PETR4 and VALE3.
    assert mock_get_id_acao.call_count == 2
    mock_get_id_acao.assert_any_call("PETR4")
    mock_get_id_acao.assert_any_call("VALE3")


@patch('database.obter_id_acao_por_ticker')
@patch('database.obter_eventos_corporativos_por_id_acao_e_data_ex_anterior_a')
def test_get_holdings_with_split(mock_get_events, mock_get_id_acao): # Order of args matters for patch
    # mock_get_id_acao, mock_get_events = mock_db_calls # Not using fixture directly

    operations = [
        ServiceOperacao(ticker="TICK1", date=date(2023, 1, 1), operation_type="buy", quantity=10, price=100.0, fees=0)
    ]

    mock_get_id_acao.return_value = 1 # TICK1 -> id_acao = 1

    split_event_data = {
        "id": 100, "id_acao": 1, "evento": "Desdobramento", "razao": "1:2",
        "data_ex": date(2023, 1, 5), "data_aprovacao": date(2023,1,4), "data_registro": date(2023,1,4)
    }
    mock_get_events.return_value = [split_event_data]

    target_date_obj = date(2023,1,10)
    holdings = get_holdings_on_date(operations, target_date_obj.isoformat())

    assert holdings.get("TICK1") == 20 # 10 shares * 2 (split factor)
    mock_get_id_acao.assert_called_once_with("TICK1")
    mock_get_events.assert_called_once_with(1, target_date_obj)


@patch('database.obter_id_acao_por_ticker')
@patch('database.obter_eventos_corporativos_por_id_acao_e_data_ex_anterior_a')
def test_get_holdings_with_reverse_split(mock_get_events, mock_get_id_acao):
    # mock_get_id_acao, mock_get_events = mock_db_calls

    operations = [
        ServiceOperacao(ticker="TICK2", date=date(2023, 1, 1), operation_type="buy", quantity=20, price=50.0, fees=0)
    ]
    mock_get_id_acao.return_value = 2 # TICK2 -> id_acao = 2

    reverse_split_event_data = {
        "id": 101, "id_acao": 2, "evento": "Agrupamento", "razao": "2:1",
        "data_ex": date(2023, 1, 5), "data_aprovacao": date(2023,1,4), "data_registro": date(2023,1,4)
    }
    mock_get_events.return_value = [reverse_split_event_data]

    target_date_obj = date(2023,1,10)
    holdings = get_holdings_on_date(operations, target_date_obj.isoformat())

    assert holdings.get("TICK2") == 10 # 20 shares * 0.5 (reverse split factor)
    mock_get_id_acao.assert_called_once_with("TICK2")
    mock_get_events.assert_called_once_with(2, target_date_obj)


@patch('database.obter_id_acao_por_ticker')
@patch('database.obter_eventos_corporativos_por_id_acao_e_data_ex_anterior_a')
def test_get_holdings_multiple_events_split_then_reverse(mock_get_events, mock_get_id_acao):
    # mock_get_id_acao, mock_get_events = mock_db_calls

    operations = [
        ServiceOperacao(ticker="TICK3", date=date(2023, 1, 1), operation_type="buy", quantity=10, price=100.0, fees=0)
    ]
    mock_get_id_acao.return_value = 3

    events_data = [
        {
            "id": 200, "id_acao": 3, "evento": "Desdobramento", "razao": "1:2", # factor 2
            "data_ex": date(2023, 1, 5), "data_aprovacao": date(2023,1,4), "data_registro": date(2023,1,4)
        },
        {
            "id": 201, "id_acao": 3, "evento": "Agrupamento", "razao": "2:1", # factor 0.5
            "data_ex": date(2023, 1, 8), "data_aprovacao": date(2023,1,7), "data_registro": date(2023,1,7)
        }
    ]
    mock_get_events.return_value = events_data # DB function sorts these by data_ex ASC

    target_date_obj = date(2023,1,10)
    holdings = get_holdings_on_date(operations, target_date_obj.isoformat())

    assert holdings.get("TICK3") == 10
    mock_get_id_acao.assert_called_once_with("TICK3")
    mock_get_events.assert_called_once_with(3, target_date_obj)


@patch('database.obter_id_acao_por_ticker')
@patch('database.obter_eventos_corporativos_por_id_acao_e_data_ex_anterior_a')
def test_get_holdings_event_data_ex_after_target_date(mock_get_events, mock_get_id_acao):
    # mock_get_id_acao, mock_get_events = mock_db_calls

    operations = [
        ServiceOperacao(ticker="TICK4", date=date(2023, 1, 1), operation_type="buy", quantity=10, price=100.0, fees=0)
    ]
    mock_get_id_acao.return_value = 4
    mock_get_events.return_value = [] # DB query filters out events after target_date

    target_date_obj = date(2023,1,10)
    holdings = get_holdings_on_date(operations, target_date_obj.isoformat())

    assert holdings.get("TICK4") == 10
    mock_get_id_acao.assert_called_once_with("TICK4")
    mock_get_events.assert_called_once_with(4, target_date_obj)


@patch('database.obter_id_acao_por_ticker')
@patch('database.obter_eventos_corporativos_por_id_acao_e_data_ex_anterior_a')
def test_get_holdings_operation_after_event_data_ex(mock_get_events, mock_get_id_acao):
    # mock_get_id_acao, mock_get_events = mock_db_calls

    operations = [
        ServiceOperacao(ticker="TICK5", date=date(2023, 1, 10), operation_type="buy", quantity=10, price=100.0, fees=0)
    ]
    mock_get_id_acao.return_value = 5

    event_data = {
        "id": 400, "id_acao": 5, "evento": "Desdobramento", "razao": "1:2",
        "data_ex": date(2023, 1, 5), "data_aprovacao": date(2023,1,4), "data_registro": date(2023,1,4)
    }
    mock_get_events.return_value = [event_data]

    target_date_obj = date(2023,1,15)
    holdings = get_holdings_on_date(operations, target_date_obj.isoformat())

    assert holdings.get("TICK5") == 10
    mock_get_id_acao.assert_called_once_with("TICK5")
    mock_get_events.assert_called_once_with(5, target_date_obj)


@patch('database.obter_id_acao_por_ticker')
@patch('database.obter_eventos_corporativos_por_id_acao_e_data_ex_anterior_a')
def test_get_holdings_operation_date_equals_event_data_ex(mock_get_events, mock_get_id_acao):
    # mock_get_id_acao, mock_get_events = mock_db_calls

    operations = [
        ServiceOperacao(ticker="TICK6", date=date(2023, 1, 5), operation_type="buy", quantity=10, price=100.0, fees=0)
    ]
    mock_get_id_acao.return_value = 6

    event_data = {
        "id": 500, "id_acao": 6, "evento": "Desdobramento", "razao": "1:2",
        "data_ex": date(2023, 1, 5), "data_aprovacao": date(2023,1,4), "data_registro": date(2023,1,4)
    }
    mock_get_events.return_value = [event_data]

    target_date_obj = date(2023,1,10)
    holdings = get_holdings_on_date(operations, target_date_obj.isoformat())

    assert holdings.get("TICK6") == 10
    mock_get_id_acao.assert_called_once_with("TICK6")
    mock_get_events.assert_called_once_with(6, target_date_obj)

# --- Basic Tests for calculate_portfolio_history ---

@patch('app.services.portfolio_analysis_service.get_historical_prices') # Corrected patch path
@patch('database.obter_eventos_corporativos_por_id_acao_e_data_ex_anterior_a')
@patch('database.obter_id_acao_por_ticker')
def test_calculate_portfolio_history_with_split(
    mock_get_id_acao,
    mock_get_events,
    mock_get_historical_prices
):
    mock_get_id_acao.return_value = 1 # For TICK1

    split_event_data = [{
        "id": 600, "id_acao": 1, "evento": "Desdobramento", "razao": "1:2",
        "data_ex": date(2023, 1, 5), "data_aprovacao": date(2023,1,4), "data_registro": date(2023,1,4)
    }]
    # This mock is for the call inside get_holdings_on_date
    mock_get_events.return_value = split_event_data

    mock_get_historical_prices.return_value = {
        "2023-01-10": 11.0
    }

    operations_data_dicts = [
        {'ticker': 'TICK1', 'date': '2023-01-01', 'operation_type': 'buy', 'quantity': 10, 'price': 20.0, 'fees': 1.0},
    ]

    history = calculate_portfolio_history(
        operations_data_dicts, # calculate_portfolio_history expects List[Dict]
        start_date_str="2023-01-01", # Adjusted start_date_str to include the operation
        end_date_str="2023-01-10",
        period_frequency="daily"
    )

    assert len(history['equity_curve']) == 10 # Daily frequency from 2023-01-01 to 2023-01-10 is 10 days
    equity_point = history['equity_curve'][-1] # Check the last point for 2023-01-10
    assert equity_point['date'] == "2023-01-10"
    assert equity_point['value'] == 220.0 # Adjusted 20 shares * $11 market price

    assert history['profitability']['cash_invested_in_period'] == (10 * 20.0 + 1.0) # Original cost

    # get_historical_prices is called with the full series range
    mock_get_historical_prices.assert_called_once_with("TICK1", "2023-01-01", "2023-01-10")

    # mock_get_events is called multiple times by get_holdings_on_date for each day in the series.
    # We should check it was called for the specific day that matters for the split application
    # or check the last call / relevant call.
    # For this test, the split event is on 2023-01-05.
    # get_holdings_on_date is called for each date in date_series (01-01 to 01-10).
    # The split applies to operations before 01-05.
    # The call to mock_get_events for date 2023-01-10 is relevant for the final equity value.
    mock_get_events.assert_any_call(1, date(2023, 1, 10)) # Check one of the calls

# --- Additional get_holdings_on_date tests ---

def test_get_holdings_empty_operations_list():
    holdings = get_holdings_on_date([], "2023-01-01")
    assert holdings == {}

def test_get_holdings_invalid_target_date_str_format():
    operations = [
        ServiceOperacao(ticker="TICK1", date=date(2023, 1, 1), operation_type="buy", quantity=10, price=100.0, fees=0)
    ]
    holdings = get_holdings_on_date(operations, "invalid-date-format")
    assert holdings == {}

@patch('database.obter_eventos_corporativos_por_id_acao_e_data_ex_anterior_a') # Corrected patch path
@patch('database.obter_id_acao_por_ticker') # Corrected patch path
def test_get_holdings_bbas3_split_scenario(mock_obter_id_acao_por_ticker, mock_obter_eventos_corporativos):
    """Test BBAS3 split scenario: 1000 shares bought, then 1:2 split."""
    bbas3_ticker = "BBAS3"
    bbas3_id_acao = 123 # Dummy ID for BBAS3

    # Configure mocks
    mock_obter_id_acao_por_ticker.return_value = bbas3_id_acao

    bbas3_split_event = {
        'id': 99,
        'id_acao': bbas3_id_acao,
        'evento': "Desdobramento",
        'data_aprovacao': date(2024, 4, 1), # Reverted to date object
        'data_registro': date(2024, 4, 10), # Reverted to date object
        'data_ex': date(2024, 4, 16),       # Reverted to date object
        'razao': "1:2"
    }
    mock_obter_eventos_corporativos.return_value = [bbas3_split_event]

    # Initial operation
    operations = [
        ServiceOperacao(
            ticker=bbas3_ticker,
            date=date(2024, 1, 8), # Date before split data_ex
            operation_type="buy",
            quantity=1000,
            price=60.0, # Some dummy price
            fees=0
        )
    ]

    target_date_str = "2024-04-20" # Date after split data_ex
    target_date_obj = date(2024, 4, 20)

    holdings = get_holdings_on_date(operations, target_date_str)

    assert holdings.get(bbas3_ticker) == 2000 # 1000 shares * 2 (split factor)

    # Verify mocks were called as expected
    mock_obter_id_acao_por_ticker.assert_called_once_with(bbas3_ticker)
    mock_obter_eventos_corporativos.assert_called_once_with(bbas3_id_acao, target_date_obj)


@patch('database.obter_eventos_corporativos_por_id_acao_e_data_ex_anterior_a') # Corrected
@patch('database.obter_id_acao_por_ticker') # Corrected
def test_get_holdings_parses_raw_operations_data(mock_get_id_acao, mock_get_events):
    mock_get_id_acao.return_value = 1
    mock_get_events.return_value = []

    raw_operations_data = [
        {'ticker': 'RAW', 'date': '2024-01-01', 'operation_type': 'buy', 'quantity': 10, 'price': 15.0, 'fees': 1.0},
    ]
    holdings = get_holdings_on_date(raw_operations_data, "2024-01-05")
    assert holdings.get("RAW") == 10

@patch('database.obter_eventos_corporativos_por_id_acao_e_data_ex_anterior_a') # Corrected
@patch('database.obter_id_acao_por_ticker') # Corrected
def test_get_holdings_ticker_id_not_found(mock_get_id_acao, mock_get_events):
    mock_get_id_acao.return_value = None

    operations = [
        ServiceOperacao(ticker="UNKNOWN", date=date(2023,1,1), operation_type="buy", quantity=10, price=10.0, fees=0.0)
    ]
    target_date_obj = date(2023,1,10)
    holdings = get_holdings_on_date(operations, target_date_obj.isoformat())

    assert holdings.get("UNKNOWN") == 10
    mock_get_id_acao.assert_called_once_with("UNKNOWN")
    mock_get_events.assert_not_called()

@patch('database.obter_eventos_corporativos_por_id_acao_e_data_ex_anterior_a') # Corrected
@patch('database.obter_id_acao_por_ticker') # Corrected
def test_get_holdings_quantity_rounding(mock_get_id_acao, mock_get_events):
    mock_get_id_acao.return_value = 1 # For ticker "ROUND"

    # Test case 1: Round down (e.g., 3.33 -> 3)
    event_data_round_down = {
        "id": 1, "id_acao": 1, "evento": "Agrupamento", "razao": "3:1", # factor 1/3
        "data_ex": date(2023, 1, 5), "data_aprovacao":date(2023,1,4), "data_registro":date(2023,1,4)
    }
    mock_get_events.return_value = [event_data_round_down]
    operations_round_down = [
        ServiceOperacao(ticker="ROUND", date=date(2023, 1, 1), operation_type="buy", quantity=10, price=30.0, fees=0)
    ]
    target_date_rd = date(2023,1,10)
    holdings_rd = get_holdings_on_date(operations_round_down, target_date_rd.isoformat())
    assert holdings_rd.get("ROUND") == 3 # 10 * (1/3) = 3.33... -> round(3.33...) is 3

    # Test case 2: Round half to even (e.g., 16.5 -> 16)
    # Ratio 100:165 -> factor 1.65.  10 * 1.65 = 16.5. round(16.5) = 16.
    mock_get_id_acao.return_value = 2 # For ticker "ROUNDHALF"
    event_data_round_half = {
        "id": 2, "id_acao": 2, "evento": "Desdobramento", "razao": "100:165",
        "data_ex": date(2023, 1, 15), "data_aprovacao":date(2023,1,14), "data_registro":date(2023,1,14)
    }
    mock_get_events.return_value = [event_data_round_half]
    operations_round_half = [
         ServiceOperacao(ticker="ROUNDHALF", date=date(2023, 1, 12), operation_type="buy", quantity=10, price=10.0, fees=0)
    ]
    target_date_rh = date(2023,1,20)
    holdings_rh = get_holdings_on_date(operations_round_half, target_date_rh.isoformat())
    assert holdings_rh.get("ROUNDHALF") == 16 # 10 * 1.65 = 16.5 -> int(round(16.5)) = 16

    # Test case 3: Round up (e.g., 16.6 -> 17)
    # Ratio 100:166 -> factor 1.66. 10 * 1.66 = 16.6. round(16.6) = 17.
    mock_get_id_acao.return_value = 3 # For ticker "ROUNDUP"
    event_data_round_up = {
        "id": 3, "id_acao": 3, "evento": "Desdobramento", "razao": "100:166",
        "data_ex": date(2023, 1, 25), "data_aprovacao":date(2023,1,24), "data_registro":date(2023,1,24)
    }
    mock_get_events.return_value = [event_data_round_up]
    operations_round_up = [
         ServiceOperacao(ticker="ROUNDUP", date=date(2023, 1, 22), operation_type="buy", quantity=10, price=10.0, fees=0)
    ]
    target_date_ru = date(2023,1,30)
    holdings_ru = get_holdings_on_date(operations_round_up, target_date_ru.isoformat())
    assert holdings_ru.get("ROUNDUP") == 17


# --- Tests for get_rendimentos_isentos_por_ano ---

# from backend.app.services.portfolio_analysis_service import get_rendimentos_isentos_por_ano, RendimentoIsento # Already imported

@patch('app.services.portfolio_analysis_service.get_db') # Corrected patch path
def test_get_rendimentos_isentos_por_ano_success(mock_get_db):
    # Mock database connection and cursor
    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_get_db.return_value.__enter__.return_value = mock_conn
    mock_conn.cursor.return_value = mock_cursor

    # Sample data returned by the database query
    db_rows = [
        {"ticker_acao": "ITSA4", "nome_empresa": "ITAUSA S.A.", "cnpj": "61.532.644/0001-15", "total_valor_ano": 150.75},
        {"ticker_acao": "PETR4", "nome_empresa": "PETROBRAS", "cnpj": "33.000.167/0001-01", "total_valor_ano": 300.50},
        {"ticker_acao": "VALE3", "nome_empresa": "VALE S.A.", "cnpj": "33.592.510/0001-54", "total_valor_ano": 0.0}, # Test case with zero value
    ]
    mock_cursor.fetchall.return_value = db_rows

    user_id = 1
    year = 2023
    result = get_rendimentos_isentos_por_ano(user_id, year)

    # Assertions
    assert len(result) == 3
    assert isinstance(result[0], RendimentoIsento)
    assert result[0].ticker == "ITSA4"
    assert result[0].empresa == "ITAUSA S.A."
    assert result[0].cnpj == "61.532.644/0001-15"
    assert result[0].valor_total_recebido_no_ano == 150.75

    assert result[1].ticker == "PETR4"
    assert result[1].valor_total_recebido_no_ano == 300.50

    assert result[2].ticker == "VALE3"
    assert result[2].valor_total_recebido_no_ano == 0.0

    # Verify the SQL query
    expected_query = """
            SELECT
                upr.ticker_acao,
                a.nome as nome_empresa,
                a.cnpj,
                SUM(upr.valor_total_recebido) as total_valor_ano
            FROM usuario_proventos_recebidos upr
            JOIN acoes a ON upr.id_acao = a.id
            WHERE upr.usuario_id = ?
              AND strftime('%Y', upr.dt_pagamento) = ?
              AND upr.tipo_provento IN ('Dividendo', 'Rendimento')
              AND upr.dt_pagamento IS NOT NULL
            GROUP BY upr.ticker_acao, a.nome, a.cnpj
            ORDER BY upr.ticker_acao;
        """
    mock_cursor.execute.assert_called_once_with(expected_query, (user_id, str(year)))

@patch('app.services.portfolio_analysis_service.get_db') # Corrected patch path
def test_get_rendimentos_isentos_por_ano_no_data(mock_get_db):
    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_get_db.return_value.__enter__.return_value = mock_conn
    mock_conn.cursor.return_value = mock_cursor
    mock_cursor.fetchall.return_value = [] # No data from DB

    user_id = 2
    year = 2022
    result = get_rendimentos_isentos_por_ano(user_id, year)

    assert len(result) == 0
    mock_cursor.execute.assert_called_once()

@patch('app.services.portfolio_analysis_service.get_db') # Corrected patch path
def test_get_rendimentos_isentos_por_ano_db_error(mock_get_db):
    # Simulate a database error during context management or query execution
    mock_get_db.return_value.__enter__.side_effect = Exception("DB connection error")

    user_id = 3
    year = 2021
    with pytest.raises(Exception, match="DB connection error"):
        get_rendimentos_isentos_por_ano(user_id, year)

@patch('app.services.portfolio_analysis_service.get_db') # Corrected patch path
def test_get_rendimentos_isentos_por_ano_includes_only_dividendos_rendimentos(mock_get_db):
    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_get_db.return_value.__enter__.return_value = mock_conn
    mock_conn.cursor.return_value = mock_cursor

    # Query from the function:
    # AND upr.tipo_provento IN ('Dividendo', 'Rendimento')
    # This is implicitly tested by the expected_query check in test_get_rendimentos_isentos_por_ano_success.
    # We can explicitly check the args of the execute call again if needed.

    mock_cursor.fetchall.return_value = [
        {"ticker_acao": "JCPTICKER", "nome_empresa": "JCP Corp", "cnpj": "123", "total_valor_ano": 50.0},
    ] # Simulate if DB somehow returned JCP despite the query (it shouldn't)
      # More accurately, the query itself should filter.

    get_rendimentos_isentos_por_ano(1, 2023)

    args, _ = mock_cursor.execute.call_args
    query_string = args[0]

    assert "AND upr.tipo_provento IN ('Dividendo', 'Rendimento')" in query_string.replace("\n", " ")
    # This confirms the SQL query itself is constructed to filter correctly.
