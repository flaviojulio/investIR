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
