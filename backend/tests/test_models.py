import pytest
from datetime import date
from pydantic import ValidationError
from backend.models import EventoCorporativoBase

# Removed test_evento_corporativo_base_date_parsing_dmy as the custom DMY validator was removed.

def test_evento_corporativo_base_date_parsing_none_and_empty():
    # Test with None: should be allowed
    data_none = {
        "id_acao": 1, "evento": "TestEvent",
        "data_aprovacao": None,
        "razao": "1:1"
    }
    event_none = EventoCorporativoBase(**data_none)
    assert event_none.data_aprovacao is None

    # Test with empty string: Pydantic's default for Optional[date] should raise ValidationError
    data_empty_str = {
        "id_acao": 1, "evento": "TestEvent",
        "data_registro": "",
        "razao": "1:1"
    }
    with pytest.raises(ValidationError):
        EventoCorporativoBase(**data_empty_str)

    # Test with whitespace string: Pydantic's default for Optional[date] should raise ValidationError
    data_whitespace_str = {
        "id_acao": 1, "evento": "TestEvent",
        "data_ex": "   ",
        "razao": "1:1"
    }
    with pytest.raises(ValidationError):
        EventoCorporativoBase(**data_whitespace_str)

def test_evento_corporativo_base_date_parsing_already_date_object():
    d_aprov = date(2024, 1, 1)
    data = {
        "id_acao": 1, "evento": "TestEvent",
        "data_aprovacao": d_aprov,
        "razao": "1:1"
    }
    event = EventoCorporativoBase(**data)
    assert event.data_aprovacao == d_aprov

def test_evento_corporativo_base_date_parsing_iso_string():
    # Validator should allow Pydantic's default ISO parsing if DMY fails
    data = {
        "id_acao": 1, "evento": "TestEvent",
        "data_ex": "2024-03-03", # ISO format
        "razao": "1:1"
    }
    event = EventoCorporativoBase(**data)
    assert event.data_ex == date(2024, 3, 3)

def test_evento_corporativo_base_invalid_date_string():
    # Expect Pydantic's default behavior (ValidationError) for truly invalid date strings
    # that are not empty and not DMY.
    data = {
        "id_acao": 1, "evento": "TestEvent",
        "data_ex": "invalid-date-string", # Not DMY, not ISO
        "razao": "1:1"
    }
    with pytest.raises(ValidationError):
        EventoCorporativoBase(**data)

def test_evento_corporativo_base_invalid_date_string_almost_dmy():
    # Test a string that looks a bit like DMY but is invalid
    data = {
        "id_acao": 1, "evento": "TestEvent",
        "data_ex": "32/01/2024", # Invalid day
        "razao": "1:1"
    }
    # The custom validator tries dmy, fails, returns original string.
    # Pydantic then tries to parse "32/01/2024" and should fail.
    with pytest.raises(ValidationError):
        EventoCorporativoBase(**data)

def test_evento_corporativo_base_partial_dmy_then_valid_iso():
    # This case tests the sequence:
    # 1. Input "01/20/2024" (ambiguous or not strictly DD/MM/YYYY)
    # 2. Custom validator tries "%d/%m/%Y", fails.
    # 3. Original string "01/20/2024" is returned to Pydantic.
    # 4. Pydantic's default parsing for `Optional[date]` then tries to parse.
    #    If Pydantic's default can handle "MM/DD/YYYY" (depends on Pydantic version & settings)
    #    or if it's strict ISO, this might pass or fail.
    #    The current validator returns the original string if DMY fails.
    #    Pydantic's default for `date` usually expects ISO "YYYY-MM-DD".
    # So, "01/20/2024" (which is not ISO) will likely cause ValidationError by Pydantic.
    data_not_iso_format = {
        "id_acao": 1, "evento": "TestEvent",
        "data_ex": "01/20/2024", # Not ISO
        "razao": "1:1"
    }
    with pytest.raises(ValidationError):
         EventoCorporativoBase(**data_not_iso_format)

    # Test that ISO format still works alongside other valid inputs (like None or date objects)
    data_mixed_valid = {
        "id_acao": 1, "evento": "TestEvent",
        "data_aprovacao": None,
        "data_ex": "2024-03-03",      # ISO
        "razao": "1:1"
    }
    event_mixed = EventoCorporativoBase(**data_mixed_valid)
    assert event_mixed.data_aprovacao is None
    assert event_mixed.data_ex == date(2024, 3, 3)


# Tests for OperacaoBase
from backend.models import OperacaoBase

def test_operacao_base_successful_parse_new_format_with_aliases_and_extra_fields():
    """
    Test successful parsing with all new fields (Portuguese aliases)
    and that extra fields are ignored.
    """
    data = {
        "Data do Negócio": "10/04/2025",
        "Tipo de Movimentação": "Compra",
        "Mercado": "Mercado à Vista", # Extra field to be ignored
        "Código de Negociação": "VALE3F ", # Note trailing space
        "Quantidade": 100,
        "Preço": "R$5.198,00",
        "Valor": "R$5.198,00", # Extra field (Valor total da operacao, not unit price)
        "Instituição": "XP INVESTIMENTOS CCTVM S.A." # Extra field
    }
    op = OperacaoBase(**data)
    assert op.date == date(2025, 4, 10)
    assert op.operation == "buy"
    assert op.ticker == "VALE3F" # Uppercase and stripped
    assert op.quantity == 100
    assert op.price == 5198.0
    assert op.fees == 0.0 # Default value
    assert op.corretora_id is None # Default value

def test_operacao_base_fees_omitted():
    """Test successful parsing when fees is omitted, ensuring it defaults to 0.0."""
    data = {
        "Data do Negócio": "11/05/2025",
        "Tipo de Movimentação": "Venda",
        "Código de Negociação": "PETR4",
        "Quantidade": 50,
        "Preço": "R$30,00",
    }
    op = OperacaoBase(**data)
    assert op.fees == 0.0

def test_operacao_base_fees_provided():
    """Test successful parsing when fees is provided."""
    data = {
        "Data do Negócio": "12/06/2025",
        "Tipo de Movimentação": "Compra",
        "Código de Negociação": "MGLU3",
        "Quantidade": 200,
        "Preço": "R$2,50",
        "fees": 1.50
    }
    op = OperacaoBase(**data)
    assert op.fees == 1.50

def test_operacao_base_corretora_id_provided():
    """Test successful parsing when corretora_id is provided."""
    data = {
        "Data do Negócio": "12/06/2025",
        "Tipo de Movimentação": "Compra",
        "Código de Negociação": "MGLU3",
        "Quantidade": 200,
        "Preço": "R$2,50",
        "corretora_id": 123
    }
    op = OperacaoBase(**data)
    assert op.corretora_id == 123

@pytest.mark.parametrize("price_str, expected_float", [
    ("52,54", 52.54),
    ("R$52,54", 52.54),
    ("1293,98", 1293.98), # No R$, implies thousands dot by context of comma decimal
    ("R$1.293,98", 1293.98), # With R$, with thousands dot
    ("R$ 1.234.567,89", 1234567.89), # Multiple thousand separators
    ("55.75", 55.75), # Dot as decimal (string)
    ("0,05", 0.05), # Small value
    ("R$0,05", 0.05)
])
def test_operacao_base_valid_price_string_formats(price_str, expected_float):
    data = {
        "Data do Negócio": "10/04/2025", "Tipo de Movimentação": "Compra",
        "Código de Negociação": "TEST3", "Quantidade": 10, "Preço": price_str
    }
    op = OperacaoBase(**data)
    assert op.price == expected_float

@pytest.mark.parametrize("price_numeric", [52, 52.54, 0, 1000])
def test_operacao_base_valid_price_numeric_formats(price_numeric):
    data = {
        "Data do Negócio": "10/04/2025", "Tipo de Movimentação": "Compra",
        "Código de Negociação": "TEST3", "Quantidade": 10, "Preço": price_numeric
    }
    op = OperacaoBase(**data)
    assert op.price == float(price_numeric)


@pytest.mark.parametrize("date_str, expected_date_obj", [
    ("10/04/2025", date(2025, 4, 10)),
    ("2025-01-10", date(2025, 1, 10)),
    ("01/01/2023", date(2023, 1, 1)),
    ("31/12/2023", date(2023, 12, 31)),
])
def test_operacao_base_valid_date_string_formats(date_str, expected_date_obj):
    data = {
        "Data do Negócio": date_str, "Tipo de Movimentação": "Venda",
        "Código de Negociação": "ANY4", "Quantidade": 1, "Preço": "1,00"
    }
    op = OperacaoBase(**data)
    assert op.date == expected_date_obj

def test_operacao_base_date_object_input():
    """Test with date and datetime objects directly."""
    date_obj = date(2023, 5, 15)
    op = OperacaoBase(**{
        "Data do Negócio": date_obj, "Tipo de Movimentação": "Compra",
        "Código de Negociação": "TEST3", "Quantidade": 10, "Preço": "10,00"
    })
    assert op.date == date_obj

    from datetime import datetime
    datetime_obj = datetime(2023, 6, 20, 10, 30)
    op_dt = OperacaoBase(**{
        "Data do Negócio": datetime_obj, "Tipo de Movimentação": "Compra",
        "Código de Negociação": "TEST3", "Quantidade": 10, "Preço": "10,00"
    })
    assert op_dt.date == datetime_obj.date()


@pytest.mark.parametrize("operation_str, expected_value", [
    ("compra", "buy"),
    ("VENDA", "sell"),
    (" Compra ", "buy"), # With spaces
    (" Venda ", "sell"), # With spaces
    ("buy", "buy"), # Direct value
    ("sell", "sell"), # Direct value
])
def test_operacao_base_operation_type_variations(operation_str, expected_value):
    data = {
        "Data do Negócio": "01/01/2024", "Tipo de Movimentação": operation_str,
        "Código de Negociação": "OPTEST", "Quantidade": 10, "Preço": "5,00"
    }
    op = OperacaoBase(**data)
    assert op.operation == expected_value

@pytest.mark.parametrize("invalid_date_str", [
    "10-04-2025", "2025/04/10", "invalid-date", "32/01/2025", "01/32/2025", "02/29/2023" # Not a leap year
])
def test_operacao_base_invalid_date_formats(invalid_date_str):
    with pytest.raises(ValidationError) as excinfo:
        OperacaoBase(**{
            "Data do Negócio": invalid_date_str, "Tipo de Movimentação": "Compra",
            "Código de Negociação": "DATEFAIL", "Quantidade": 10, "Preço": "1,00"
        })
    assert "Formato de data inválido" in str(excinfo.value) or "Input should be a valid date or datetime" in str(excinfo.value)


def test_operacao_base_invalid_date_type():
    with pytest.raises(ValidationError) as excinfo:
        OperacaoBase(**{
            "Data do Negócio": 12345, "Tipo de Movimentação": "Compra",
            "Código de Negociação": "DATEFAIL", "Quantidade": 10, "Preço": "1,00"
        })
    assert "Tipo inválido para 'Data do Negócio'" in str(excinfo.value)


@pytest.mark.parametrize("invalid_op_str", ["Comprar", "Unknown", " vender", "buy sell"])
def test_operacao_base_invalid_operation_types(invalid_op_str):
    with pytest.raises(ValidationError) as excinfo:
        OperacaoBase(**{
            "Data do Negócio": "01/01/2024", "Tipo de Movimentação": invalid_op_str,
            "Código de Negociação": "OPFAIL", "Quantidade": 10, "Preço": "1,00"
        })
    assert "Valor inválido para 'Tipo de Movimentação'" in str(excinfo.value)

def test_operacao_base_invalid_operation_type_non_string():
    with pytest.raises(ValidationError) as excinfo:
        OperacaoBase(**{
            "Data do Negócio": "01/01/2024", "Tipo de Movimentação": 123,
            "Código de Negociação": "OPFAIL", "Quantidade": 10, "Preço": "1,00"
        })
    assert "'Tipo de Movimentação' deve ser uma string" in str(excinfo.value)


@pytest.mark.parametrize("invalid_price_str", [
    "R$invalid,00", "R$1.2.3,45", "1,2,3.45", "R$ 1.000.00", # dot as decimal with pt-BR thousands
    "R$1,000,00", # comma as thousands and decimal
])
def test_operacao_base_invalid_price_formats(invalid_price_str):
    with pytest.raises(ValidationError) as excinfo:
        OperacaoBase(**{
            "Data do Negócio": "01/01/2024", "Tipo de Movimentação": "Compra",
            "Código de Negociação": "PRICEFAIL", "Quantidade": 10, "Preço": invalid_price_str
        })
    assert "Formato de preço inválido para 'Preço'" in str(excinfo.value)

def test_operacao_base_negative_price_string():
    with pytest.raises(ValidationError) as excinfo:
        OperacaoBase(**{
            "Data do Negócio": "01/01/2024", "Tipo de Movimentação": "Compra",
            "Código de Negociação": "PRICEFAIL", "Quantidade": 10, "Preço": "-100,00"
        })
    assert "Preço ('Preço') não pode ser negativo" in str(excinfo.value) # Message from after parsing

def test_operacao_base_negative_price_numeric():
    with pytest.raises(ValidationError) as excinfo:
        OperacaoBase(**{
            "Data do Negócio": "01/01/2024", "Tipo de Movimentação": "Compra",
            "Código de Negociação": "PRICEFAIL", "Quantidade": 10, "Preço": -100.00
        })
    assert "Preço ('Preço') não pode ser negativo." in str(excinfo.value) # Message from initial check

def test_operacao_base_invalid_price_type():
    with pytest.raises(ValidationError) as excinfo:
        OperacaoBase(**{
            "Data do Negócio": "01/01/2024", "Tipo de Movimentação": "Compra",
            "Código de Negociação": "PRICEFAIL", "Quantidade": 10, "Preço": {"value": 100}
        })
    assert "Tipo inválido para 'Preço'" in str(excinfo.value)


@pytest.mark.parametrize("invalid_quantity", [0, -10, "abc", 10.5, "10.5"])
def test_operacao_base_invalid_quantity(invalid_quantity):
    with pytest.raises(ValidationError) as excinfo:
        OperacaoBase(**{
            "Data do Negócio": "01/01/2024", "Tipo de Movimentação": "Compra",
            "Código de Negociação": "QTYFAIL", "Quantidade": invalid_quantity, "Preço": "1,00"
        })
    if isinstance(invalid_quantity, str) and not invalid_quantity.isdigit():
        assert "Quantidade ('Quantidade') deve ser um número inteiro." in str(excinfo.value)
    elif not isinstance(invalid_quantity, int):
         assert "Quantidade ('Quantidade') deve ser um inteiro ou uma string que possa ser convertida para inteiro." in str(excinfo.value)
    else: # Covers 0 and -10
        assert "Quantidade ('Quantidade') deve ser um número positivo." in str(excinfo.value)

def test_operacao_base_invalid_ticker_type():
    """Test validation error for non-string ticker."""
    with pytest.raises(ValidationError) as excinfo:
        OperacaoBase(**{
            "Data do Negócio": "01/01/2024", "Tipo de Movimentação": "Compra",
            "Código de Negociação": 123, "Quantidade": 10, "Preço": "1,00"
        })
    # The error comes from Pydantic's initial type check before the validator, or from the validator itself
    assert "Input should be a valid string" in str(excinfo.value) or "Ticker ('Código de Negociação') deve ser uma string." in str(excinfo.value)

def test_operacao_base_ticker_strip_uppercase():
    """Test ticker is stripped and uppercased."""
    data = {
        "Data do Negócio": "10/04/2025",
        "Tipo de Movimentação": "Compra",
        "Código de Negociação": "  vale3f  ", # Ticker with spaces and lowercase
        "Quantidade": 100,
        "Preço": "R$51,98",
    }
    op = OperacaoBase(**data)
    assert op.ticker == "VALE3F"

def test_operacao_base_empty_ticker_string():
    """Test that an empty or whitespace-only ticker string raises validation error if not allowed by model (Pydantic default is usually to allow empty strings)."""
    # The current validator for ticker is just upper().strip(). An empty string becomes "".
    # Pydantic's default for a `str` field is to allow empty strings.
    # If an empty ticker is not desired, an additional validator `min_length=1` or custom check would be needed.
    # For now, testing current behavior.
    data = {
        "Data do Negócio": "10/04/2025",
        "Tipo de Movimentação": "Compra",
        "Código de Negociação": "   ",
        "Quantidade": 100,
        "Preço": "R$51,98",
    }
    op = OperacaoBase(**data)
    assert op.ticker == "" # Current behavior

    data_explicit_empty = {
        "Data do Negócio": "10/04/2025",
        "Tipo de Movimentação": "Compra",
        "Código de Negociação": "",
        "Quantidade": 100,
        "Preço": "R$51,98",
    }
    op_empty = OperacaoBase(**data_explicit_empty)
    assert op_empty.ticker == "" # Current behavior
