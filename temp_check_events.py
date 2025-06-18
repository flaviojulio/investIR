import sys
import os

# Add project root and backend directory to sys.path
sys.path.insert(0, os.path.abspath('.'))
sys.path.insert(0, os.path.abspath('./backend'))

from backend.database import obter_id_acao_por_ticker, obter_eventos_corporativos_por_acao_id, criar_tabelas
from datetime import date # To compare date objects if necessary

def main():
    # Ensure database and tables are created
    try:
        criar_tabelas()
        print("INFO: Chamada para criar_tabelas() concluída.")
    except Exception as e:
        print(f"ERRO: Falha ao chamar criar_tabelas(): {e}")
        # Depending on the error, might want to exit or try to continue if table already exists
        # For now, just print error and continue

    ticker_to_check = "BBAS3"
    id_acao = obter_id_acao_por_ticker(ticker_to_check)

    if id_acao is None:
        print(f"Ticker {ticker_to_check} não encontrado. Tentando adicionar...")
        from backend.database import get_db # Import get_db for direct DB access
        try:
            with get_db() as conn:
                cursor = conn.cursor()
                # Check if BBAS3 exists, to be absolutely sure before inserting
                cursor.execute("SELECT id FROM acoes WHERE ticker = ?", (ticker_to_check,))
                if cursor.fetchone() is None:
                    cursor.execute("INSERT INTO acoes (ticker, nome) VALUES (?, ?)", (ticker_to_check, "Banco do Brasil SA"))
                    conn.commit()
                    print(f"Ticker {ticker_to_check} adicionado.")
                else:
                    print(f"Ticker {ticker_to_check} já existia (encontrado em segunda verificação).")
                id_acao = obter_id_acao_por_ticker(ticker_to_check) # Try fetching ID again
        except Exception as e:
            print(f"Erro ao tentar adicionar/verificar {ticker_to_check}: {e}")
            id_acao = None # Ensure id_acao is None if error

    if id_acao is not None:
        print(f"ID da ação para {ticker_to_check}: {id_acao}")
        eventos = obter_eventos_corporativos_por_acao_id(id_acao)

        if eventos:
            print(f"\nEventos corporativos para {ticker_to_check} (ID: {id_acao}):")
            found_target_event = False
            for evento in eventos:
                print(f"  Evento: {dict(evento)}") # Convert sqlite3.Row to dict for cleaner printing

                # Check for the specific event
                # Note: data_ex from this function might be string if not type-hinted in SELECT
                # The database stores these as TEXT.
                # The custom date converter is triggered by "col_name [date]" alias in SELECT.
                # obter_eventos_corporativos_por_acao_id uses "SELECT *", so dates will be strings.

                data_ex_value = evento['data_ex']
                # Try to parse if it's a string, or use if already date object
                event_data_ex_obj = None
                if isinstance(data_ex_value, str):
                    try:
                        event_data_ex_obj = date.fromisoformat(data_ex_value)
                    except ValueError:
                        pass # Could not parse
                elif isinstance(data_ex_value, date):
                    event_data_ex_obj = data_ex_value

                if (evento['evento'] == "Desdobramento" and
                    event_data_ex_obj == date(2024, 4, 16) and
                    evento['razao'] == "1:2"):
                    found_target_event = True
                    print(f"  --> EVENTO ALVO ENCONTRADO: {dict(evento)}")

            if not found_target_event:
                print(f"\nEVENTO ALVO (Desdobramento BBAS3 2024-04-16 1:2) NÃO ENCONTRADO.")
        else:
            print(f"Nenhum evento corporativo encontrado para {ticker_to_check} (ID: {id_acao}).")
    else:
        print(f"Ticker {ticker_to_check} não encontrado.")

if __name__ == "__main__":
    main()
