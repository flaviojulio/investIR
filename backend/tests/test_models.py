import pytest
from datetime import date
from pydantic import ValidationError
from backend.models import EventoCorporativoBase

def test_evento_corporativo_base_date_parsing_dmy():
    data = {
        "id_acao": 1, "evento": "TestEvent",
        "data_aprovacao": "01/01/2024",
        "data_registro": "02/02/2024",
        "data_ex": "03/03/2024",
        "razao": "1:1"
        # id field is part of EventoCorporativoInfo, not Base.
        # If testing EventoCorporativoInfo, an 'id' would be needed.
        # For EventoCorporativoBase, this should be fine.
    }
    event = EventoCorporativoBase(**data)
    assert event.data_aprovacao == date(2024, 1, 1)
    assert event.data_registro == date(2024, 2, 2)
    assert event.data_ex == date(2024, 3, 3)

def test_evento_corporativo_base_date_parsing_none_and_empty():
    data = {
        "id_acao": 1, "evento": "TestEvent",
        "data_aprovacao": None,
        "data_registro": "", # Empty string
        "data_ex": "   ", # Whitespace string
        "razao": "1:1"
    }
    event = EventoCorporativoBase(**data)
    assert event.data_aprovacao is None
    assert event.data_registro is None
    assert event.data_ex is None

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
    #    So, "01/20/2024" (if not parsed by DMY) will likely cause ValidationError by Pydantic.
    data_ambiguous_dmy = {
        "id_acao": 1, "evento": "TestEvent",
        "data_ex": "01/20/2024", # Could be Jan 20 or (invalid) 20th month
        "razao": "1:1"
    }
    # Our validator fails %d/%m/%Y, returns "01/20/2024". Pydantic then fails to parse this as date.
    with pytest.raises(ValidationError):
         EventoCorporativoBase(**data_ambiguous_dmy)

    # Test with a valid ISO date after a field that was DMY
    data_mixed_formats = {
        "id_acao": 1, "evento": "TestEvent",
        "data_aprovacao": "01/01/2024", # DMY
        "data_ex": "2024-03-03",      # ISO
        "razao": "1:1"
    }
    event_mixed = EventoCorporativoBase(**data_mixed_formats)
    assert event_mixed.data_aprovacao == date(2024, 1, 1)
    assert event_mixed.data_ex == date(2024, 3, 3)
