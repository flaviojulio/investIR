import yfinance as yf
from datetime import datetime, date as datetime_date, timedelta
from dateutil.relativedelta import relativedelta
from pydantic import BaseModel, validator, Field
from typing import List, Dict, Any, Optional

# Assuming database.py is in the root of the backend directory, adjust import if necessary
# For services within app/, to import from root backend/
import sys
import os
# Add the backend directory to sys.path to allow direct import of database
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))

from database import ( # Now this should work if backend/ is in sys.path
    obter_id_acao_por_ticker,
    obter_eventos_corporativos_por_id_acao_e_data_ex_anterior_a,
    get_db # Added for get_rendimentos_isentos_por_ano
)
from models import EventoCorporativoInfo
# Note: datetime is already imported, List, Dict, Any, Optional are from typing.
# datetime_date is an alias for date, which is fine.

# Updated Operacao model
class Operacao(BaseModel):
    ticker: str
    date: Any # Validator will convert to datetime_date
    operation_type: str  # 'buy' or 'sell'
    quantity: int
    price: float = Field(gt=0, description="Price per share at the time of operation")
    fees: float = Field(ge=0, description="Fees associated with the operation")

    @validator('date', pre=True, allow_reuse=True)
    def parse_date(cls, value):
        if isinstance(value, str):
            try:
                return datetime.strptime(value, "%Y-%m-%d").date()
            except ValueError:
                raise ValueError("Invalid date string format, expected YYYY-MM-DD")
        if isinstance(value, datetime_date):
            return value
        if isinstance(value, datetime): # Handle datetime objects by taking the date part
            return value.date()
        raise TypeError("Invalid type for date, expected str, datetime.date, or datetime.datetime")

    @validator('operation_type')
    def operation_type_must_be_buy_or_sell(cls, value):
        if value not in ['buy', 'sell']:
            raise ValueError("operation_type must be 'buy' or 'sell'")
        return value


def get_historical_prices(ticker: str, start_date: str, end_date: str) -> Dict[str, float]:
    """
    Fetches historical closing prices for a given stock ticker between two dates.

    Args:
        ticker (str): The stock ticker symbol (e.g., "AAPL").
        start_date (str): The start date in "YYYY-MM-DD" format.
        end_date (str): The end date in "YYYY-MM-DD" format.

    Returns:
        dict: A dictionary where keys are dates (as strings in "YYYY-MM-DD" format)
              and values are closing prices (float).
              Returns an empty dictionary if the ticker is not found, no data is available,
              or an error occurs.
    """
    try:
        # Append .SA for B3 tickers, conditionally if needed, or always if this service is B3 specific
        # For this task, we'll always append .SA as per request.
        # Consider making this conditional if the service should handle international tickers.
        ticker_sa = f"{ticker}.SA"

        stock = yf.Ticker(ticker_sa)
        history = stock.history(start=start_date, end=end_date)

        if history.empty:
            print(f"No data found for ticker {ticker_sa} between {start_date} and {end_date}.")
            return {}

        prices = {}
        for index, row in history.iterrows():
            prices[index.strftime('%Y-%m-%d')] = row['Close']

        return prices

    except Exception as e:
        # It's good to log the original ticker and the modified one if an error occurs.
        print(f"Error fetching data for ticker {ticker} (as {ticker_sa if 'ticker_sa' in locals() else 'N/A'}): {e}")
        return {}

if __name__ == '__main__':
    # Example usage:
    # Make sure to install yfinance: pip install yfinance
    # And to run from the backend directory if executing this directly for testing.

    # Test case 1: Valid ticker and date range
    print("Fetching ITUB4 data (should become ITUB4.SA)...") # Example: ITUB4 is a common Brazilian stock
    itub4_prices = get_historical_prices("ITUB4", "2023-01-01", "2023-01-10")
    if itub4_prices:
        for date, price in itub4_prices.items():
            print(f"Date: {date}, Closing Price: {price}")
    else:
        print("No data retrieved for ITUB4 or error occurred.")

    print("\nFetching PETR4 data (should become PETR4.SA)...")
    # Test case 2: Valid ticker (Brazilian stock) and date range
    petr4_prices = get_historical_prices("PETR4", "2023-01-01", "2023-01-10") # Input without .SA
    if petr4_prices:
        for date, price in petr4_prices.items():
            print(f"Date: {date}, Closing Price: {price}")
    else:
        print("No data retrieved for PETR4 or error occurred.")

    print("\nFetching NONEXISTENT data (should become NONEXISTENT.SA)...")
    # Test case 3: Invalid ticker
    invalid_prices = get_historical_prices("NONEXISTENT", "2023-01-01", "2023-01-10")
    if not invalid_prices:
        print("Correctly handled invalid ticker (NONEXISTENT.SA): No data retrieved.")
    else:
        print("Error: Data retrieved for invalid ticker.")

    print("\nFetching AAPL data for a future range (expecting empty)...")
    # Test case 4: Date range with no data (e.g., future dates or non-trading days only)
    # For yfinance, requesting a future start date might immediately return empty or error
    # depending on library version and how it handles such requests.
    # Let's test with a very recent period where data might not be fully populated yet, or a known non-trading period.
    # Or simply a range where a specific stock didn't trade.
    # For simplicity, using a very short future period.
    # Note: AAPL will become AAPL.SA which might not exist or have different data.
    # This test case might change behavior.
    print("\nFetching AAPL data (will try AAPL.SA) for a future range (expecting empty)...")
    future_prices = get_historical_prices("AAPL", "2030-01-01", "2030-01-10") # AAPL becomes AAPL.SA
    if not future_prices:
        print("Correctly handled future date range for AAPL.SA: No data retrieved.")
    else:
        print("Error: Data retrieved for AAPL.SA for future date range.")
        for date, price in future_prices.items():
            print(f"Date: {date}, Closing Price: {price}")

    print("\nFetching MGLU3 data (should become MGLU3.SA)...")
    # Test case with a known Brazilian ticker
    mglu3_prices = get_historical_prices("MGLU3", "2023-01-01", "2023-01-10") # Input without .SA
    if mglu3_prices:
        for date_str, price in mglu3_prices.items():
            print(f"Date: {date_str}, Closing Price: {price}")
    else:
        print("No data retrieved for MGLU3.SA or error occurred.")

def get_holdings_on_date(operations: List[Operacao], target_date_str: str) -> Dict[str, int]:
    """
    Calculates the net quantity of each stock held on a specific target date.

    Args:
        operations (List[Operacao]): A list of operation objects.
        target_date_str (str): The target date in "YYYY-MM-DD" format.

    Returns:
        Dict[str, int]: A dictionary where keys are tickers and values are the
                        net quantities held on the target_date.
    """
    target_d = datetime.strptime(target_date_str, "%Y-%m-%d").date()
    holdings: Dict[str, int] = {}

    # Validate and parse operations first if they are not already Pydantic models
    parsed_operations: List[Operacao] = []
    if operations and not isinstance(operations[0], Operacao):
        try:
            parsed_operations = [Operacao(**op_data) for op_data in operations]
        except Exception as e:
            print(f"Error parsing operations data: {e}")
            return {} # Or raise error
    else:
        parsed_operations = operations


    for op in parsed_operations:
        op_date = op.date # This is already a date object due to Pydantic validator

        if op_date <= target_d:
            current_quantity = holdings.get(op.ticker, 0)
            if op.operation_type == 'buy':
                holdings[op.ticker] = current_quantity + op.quantity
            elif op.operation_type == 'sell':
                holdings[op.ticker] = current_quantity - op.quantity
            else:
                print(f"Warning: Unknown operation type '{op.operation_type}' for ticker {op.ticker}")

    # Filter out tickers with zero or negative quantities if necessary,
    # or handle as per specific requirements (e.g., short selling).
def get_holdings_on_date(operations: List[Operacao], target_date_str: str) -> Dict[str, int]:
    try:
        # Validator for date string format, using datetime.date for target_d
        target_d = datetime.strptime(target_date_str, "%Y-%m-%d").date()
    except ValueError:
        # Handle invalid date string format for target_date_str
        # This case should ideally be validated before calling this function,
        # but as a safeguard:
        print(f"Error: Invalid target_date_str format '{target_date_str}'. Expected YYYY-MM-DD.")
        return {}


    # Ensure operations are parsed if they are raw dicts (existing logic in some versions)
    # The Operacao model in this file has its own parser for date.
    parsed_operations: List[Operacao] = []
    if not operations: # Handle empty operations list
            parsed_operations = []
    elif operations and not isinstance(operations[0], Operacao): # Check if parsing is needed
        try:
            # Assuming Operacao model expects price and fees if they are part of its definition
            # The local Operacao model does define price and fees.
            parsed_operations = [Operacao(**op_data) for op_data in operations]
        except Exception as e: # Catch potential Pydantic validation errors
            print(f"Error parsing operations data in get_holdings_on_date: {e}")
            return {}
    else: # operations is already List[Operacao]
        parsed_operations = operations

    # --- START NEW LOGIC FOR CORPORATE EVENTS ---

    # 1. Collect unique tickers and fetch their corporate events
    unique_tickers = list(set(op.ticker for op in parsed_operations))
    events_by_ticker: Dict[str, List[EventoCorporativoInfo]] = {}

    for ticker_symbol in unique_tickers:
        id_acao = obter_id_acao_por_ticker(ticker_symbol)
        if id_acao:
            raw_events_data = obter_eventos_corporativos_por_id_acao_e_data_ex_anterior_a(id_acao, target_d)
            print(f"Eventos retornados para {ticker_symbol} até {target_d}: {raw_events_data}")
            # raw_events_data returns List[Dict[str, Any]], suitable for EventoCorporativoInfo(**event_data)
            events_by_ticker[ticker_symbol] = [EventoCorporativoInfo(**event_data) for event_data in raw_events_data]

    # 2. Define helper to apply events to a single operation
    def _apply_events_to_operation(operation: Operacao, ticker_events: List[EventoCorporativoInfo]) -> Operacao:
        adjusted_op = operation

        # ticker_events are already sorted by data_ex ASC from the database function.
        for event_info in ticker_events:
            if event_info.data_ex is None:
                continue

            if adjusted_op.date < event_info.data_ex:
                if event_info.evento and event_info.evento.lower().startswith("bonific"):
                    bonus_increase = event_info.get_bonus_quantity_increase(float(adjusted_op.quantity))
                    new_quantity = float(adjusted_op.quantity) + bonus_increase
                    # Preço por ação é diluído: novo_preco = (preco_antigo * quantidade_antiga) / quantidade_nova
                    if new_quantity > 0:
                        new_price = float(adjusted_op.price) * float(adjusted_op.quantity) / new_quantity
                    else:
                        new_price = float(adjusted_op.price)
                    update_data = {
                        'quantity': int(round(new_quantity)),
                        'price': new_price
                    }
                    adjusted_op = adjusted_op.copy(update=update_data)
                    continue
                factor = event_info.get_adjustment_factor()
                if factor == 1.0:
                    continue

                new_quantity_float = float(adjusted_op.quantity)
                new_price_float = float(adjusted_op.price)

                new_quantity_float = new_quantity_float * factor
                if factor != 0.0:
                    new_price_float = new_price_float / factor

                update_data = {
                    'quantity': int(round(new_quantity_float)),
                    'price': new_price_float
                }
                adjusted_op = adjusted_op.copy(update=update_data)
        return adjusted_op

    # 3. Create a list of adjusted operations
    adjusted_operations_list: List[Operacao] = []
    for op in parsed_operations:
        ticker_events_for_op = events_by_ticker.get(op.ticker, [])
        adjusted_op = _apply_events_to_operation(op, ticker_events_for_op)
        adjusted_operations_list.append(adjusted_op)
    # --- END NEW LOGIC FOR CORPORATE EVENTS ---

    holdings: Dict[str, int] = {}
    # Use adjusted_operations_list for calculating holdings
    for op_adj in adjusted_operations_list:
        # op_adj.date is already a datetime.date object due to Pydantic validator
        if op_adj.date <= target_d: # Filter operations up to the target date
            current_quantity = holdings.get(op_adj.ticker, 0)
            if op_adj.operation_type == 'buy':
                holdings[op_adj.ticker] = current_quantity + op_adj.quantity
            elif op_adj.operation_type == 'sell':
                holdings[op_adj.ticker] = current_quantity - op_adj.quantity
            # Pydantic validator on Operacao model handles unknown operation_type

    # Filter out tickers with zero or negative quantities if necessary,
    # or handle as per specific requirements (e.g., short selling).
    # Current: return only those with quantity > 0
    return {ticker: quantity for ticker, quantity in holdings.items() if quantity > 0}

if __name__ == '__main__':
    # (Previous example usage for get_historical_prices remains)

    print("\n--- Testing get_holdings_on_date ---")

    # Example operations (raw dicts, will be parsed by Pydantic model)
    sample_ops_data = [
        {'ticker': 'AAPL', 'date': '2023-01-01', 'operation_type': 'buy', 'quantity': 100},
        {'ticker': 'MSFT', 'date': '2023-01-05', 'operation_type': 'buy', 'quantity': 50},
        {'ticker': 'AAPL', 'date': '2023-01-10', 'operation_type': 'sell', 'quantity': 30},
        {'ticker': 'GOOG', 'date': '2023-01-15', 'operation_type': 'buy', 'quantity': 20},
        {'ticker': 'MSFT', 'date': '2023-01-20', 'operation_type': 'sell', 'quantity': 20},
        {'ticker': 'AAPL', 'date': '2023-01-25', 'operation_type': 'buy', 'quantity': 10}, # This buy is after target_date_test1
    ]

    # Convert raw dicts to Operacao model instances
    sample_ops = [Operacao(**op_data) for op_data in sample_ops_data]

    # Test case 1: Holdings on 2023-01-12
    target_date_test1 = "2023-01-12"
    holdings_test1 = get_holdings_on_date(sample_ops, target_date_test1)
    print(f"Holdings on {target_date_test1}: {holdings_test1}")
    # Expected: {'AAPL': 70, 'MSFT': 50} (AAPL: 100-30=70, MSFT: 50)

    # Test case 2: Holdings on 2023-01-03 (before MSFT buy and AAPL sell)
    target_date_test2 = "2023-01-03"
    holdings_test2 = get_holdings_on_date(sample_ops, target_date_test2)
    print(f"Holdings on {target_date_test2}: {holdings_test2}")
    # Expected: {'AAPL': 100}

    # Test case 3: Holdings on 2023-01-30 (all operations included)
    target_date_test3 = "2023-01-30"
    holdings_test3 = get_holdings_on_date(sample_ops, target_date_test3)
    print(f"Holdings on {target_date_test3}: {holdings_test3}")
    # Expected: {'AAPL': 80, 'MSFT': 30, 'GOOG': 20} (AAPL: 100-30+10=80, MSFT: 50-20=30, GOOG: 20)

    # Test case 4: Holdings on a date before any operations
    target_date_test4 = "2022-12-31"
    holdings_test4 = get_holdings_on_date(sample_ops, target_date_test4)
    print(f"Holdings on {target_date_test4}: {holdings_test4}")
    # Expected: {}

    # Test case 5: Operations list is empty
    empty_ops: List[Operacao] = []
    holdings_test5 = get_holdings_on_date(empty_ops, "2023-01-15")
    print(f"Holdings with empty operations list: {holdings_test5}")
    # Expected: {}

    # Test case 6: Sell operation making quantity zero
    sample_ops_data_sell_all = [
        {'ticker': 'XYZ', 'date': '2023-01-01', 'operation_type': 'buy', 'quantity': 100},
        {'ticker': 'XYZ', 'date': '2023-01-10', 'operation_type': 'sell', 'quantity': 100},
    ]
    sample_ops_sell_all = [Operacao(**op_data) for op_data in sample_ops_data_sell_all]
    holdings_test6 = get_holdings_on_date(sample_ops_sell_all, "2023-01-15")
    print(f"Holdings after selling all XYZ: {holdings_test6}")
    # Expected: {} (because the filter `if quantity > 0` is applied)

    # Test case 7: Input operations as raw dictionaries
    # Add price and fees for this test case to be valid with the updated Operacao model
    raw_ops_data_for_parsing_test = [
        {'ticker': 'RAW', 'date': '2024-01-01', 'operation_type': 'buy', 'quantity': 10, 'price': 15.0, 'fees': 1.0},
    ]
    # Ensure Operacao model is used for parsing
    parsed_ops_for_test7 = [Operacao(**op_data) for op_data in raw_ops_data_for_parsing_test]
    holdings_test7 = get_holdings_on_date(parsed_ops_for_test7, "2024-01-05")
    print(f"Holdings from raw dict operations (parsed): {holdings_test7}")
    # Expected: {'RAW': 10}


# --- Main new function and helpers ---

def _generate_date_series(start_date: datetime_date, end_date: datetime_date, frequency: str) -> List[datetime_date]:
    dates = []
    current_date = start_date
    while current_date <= end_date:
        if frequency == 'daily':
            dates.append(current_date)
            current_date += timedelta(days=1)
        elif frequency == 'monthly':
            # Add the last day of the current month or end_date if it's sooner
            last_day_of_month = current_date + relativedelta(day=31)
            dates.append(min(last_day_of_month, end_date))
            current_date = last_day_of_month + timedelta(days=1) # Move to first day of next month
            if current_date.day != 1 and current_date <= end_date : # Ensure we are at the start of a new month if not past end_date
                # This can happen if end_date was the last day of a month.
                # Advance to next month to avoid duplicate or incorrect month start.
                current_date = (current_date + relativedelta(months=1)).replace(day=1)

        else:
            raise ValueError("Unsupported frequency. Choose 'daily' or 'monthly'.")

    # Ensure the series includes the start_date if it wasn't added (e.g. monthly starting mid-month)
    # and the end_date if it wasn't captured precisely.
    # For monthly, the first date point should be the last day of the start_date's month,
    # or start_date itself if frequency is 'daily'.
    # The logic above for monthly already tries to capture last day of month.
    # Let's refine the monthly date generation to be more precise.

    dates = []
    current_date = start_date
    if frequency == 'daily':
        while current_date <= end_date:
            dates.append(current_date)
            current_date += timedelta(days=1)
    elif frequency == 'monthly':
        # Start with the first period end: last day of start_date's month, or end_date if earlier
        current_period_end = min(start_date + relativedelta(day=31), end_date)
        if current_period_end >= start_date : # ensure first period end is not before start_date
             dates.append(current_period_end)

        # Iterate by month starts
        next_month_start = (start_date + relativedelta(months=1)).replace(day=1)
        while next_month_start <= end_date:
            current_period_end = min(next_month_start + relativedelta(day=31), end_date)
            if not dates or (dates and current_period_end > dates[-1]): # Avoid duplicates if end_date is last day of month
                 dates.append(current_period_end)
            next_month_start += relativedelta(months=1)

        # Ensure start_date is represented by a point if it's not already the end of a month
        # This might mean the "equity curve" for monthly starts at the end of the first month.
        # Usually, for monthly, we report at month-ends.
        # If start_date is, e.g., Jan 15, first report point is Jan 31.

        # Ensure distinct dates and sorted
        if dates:
            dates = sorted(list(set(dates)))
            # Filter out dates before start_date that might be generated by month logic
            # And ensure end_date is included if it was a month-end itself.
            # The min(..., end_date) should handle this.
            # The current logic should be okay, but worth double checking in tests.


    if not dates: # e.g. if start_date > end_date initially or very short period for monthly
        if start_date <= end_date: # if start_date and end_date are same, include it.
            return [start_date]
        return []

    return dates


def calculate_portfolio_history(
    operations_data: List[Dict[str, Any]], # Expect raw dicts
    start_date_str: str,
    end_date_str: str,
    period_frequency: str = 'monthly'
) -> Dict[str, Any]:

    try:
        start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
        end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()
    except ValueError:
        raise ValueError("Invalid start_date_str or end_date_str format. Expected YYYY-MM-DD.")

    if start_date > end_date:
        return {"equity_curve": [], "profitability": {"absolute": 0, "percentage": 0, "details": "Start date after end date."}}

    # Parse operations from dicts to Pydantic models
    operations: List[Operacao] = []
    if operations_data:
        try:
            operations = [Operacao(**op_data) for op_data in operations_data]
        except Exception as e:
            # Consider how to handle parsing errors, maybe raise or return error state
            print(f"Error parsing operations data: {e}") # Or log
            # Depending on requirements, might return error or empty results
            raise ValueError(f"Error parsing operations data: {e}")


    date_series = _generate_date_series(start_date, end_date, period_frequency)
    equity_curve = []

    # Pre-fetch all historical prices needed to minimize API calls
    # Collect all unique tickers and the overall date range for yfinance
    all_tickers = list(set(op.ticker for op in operations))

    # Store all historical prices in a nested dict: {ticker: {date_str: price}}
    all_historical_prices: Dict[str, Dict[str, float]] = {}

    if all_tickers and date_series:
        # Fetch prices for the entire range needed for the equity curve
        # Note: yfinance fetches up to, but not including, end_date for daily.
        # For our purpose, we need data *on* end_date of series.
        # So, fetch from series_start_date to series_end_date + 1 day if daily.
        # Or, rely on get_historical_prices to fetch for specific start/end.
        # Let's fetch for each ticker for the whole period of the date_series.
        series_first_date = date_series[0]
        series_last_date = date_series[-1]

        for ticker in all_tickers:
            # Fetch from the first date in our series to the last.
            # get_historical_prices returns prices for dates within this range.
            prices = get_historical_prices(ticker, series_first_date.strftime("%Y-%m-%d"), series_last_date.strftime("%Y-%m-%d"))
            all_historical_prices[ticker] = prices


    # Cache for last known prices to handle missing data points (e.g. weekends, holidays)
    last_known_prices: Dict[str, float] = {}

    for current_eval_date in date_series:
        current_eval_date_str = current_eval_date.strftime("%Y-%m-%d")
        holdings_on_eval_date = get_holdings_on_date(operations, current_eval_date_str)

        current_portfolio_value = 0.0
        for ticker, quantity in holdings_on_eval_date.items():
            ticker_prices = all_historical_prices.get(ticker, {})
            price_on_eval_date = ticker_prices.get(current_eval_date_str)

            if price_on_eval_date is not None:
                current_portfolio_value += price_on_eval_date * quantity
                last_known_prices[ticker] = price_on_eval_date # Update cache
            elif ticker in last_known_prices:
                # Price not found for current_eval_date, use last known price
                # print(f"Warning: Price for {ticker} on {current_eval_date_str} not found. Using last known price: {last_known_prices[ticker]}")
                current_portfolio_value += last_known_prices[ticker] * quantity
            # else:
                # print(f"Warning: Price for {ticker} on {current_eval_date_str} not found, and no prior price cached. Assuming value 0 for this holding.")

        equity_curve.append({'date': current_eval_date_str, 'value': round(current_portfolio_value, 2)})

    # Profitability Calculation
    if not equity_curve: # No data points generated
        return {"equity_curve": [], "profitability": {"absolute": 0, "percentage": 0, "details": "No data for equity curve."}}

    initial_portfolio_value = equity_curve[0]['value']
    final_portfolio_value = equity_curve[-1]['value']

    cash_invested_in_period = 0.0
    cash_returned_in_period = 0.0

    for op in operations:
        op_date = op.date # This is a date object
        # Operations must be within the overall analysis period [start_date, end_date]
        # NOT the equity curve dates, which might be month ends.
        if start_date <= op_date <= end_date:
            operation_value = op.price * op.quantity
            if op.operation_type == 'buy':
                cash_invested_in_period += operation_value + op.fees
            elif op.operation_type == 'sell':
                # For sells, price * quantity is cash received, fees reduce this.
                cash_returned_in_period += operation_value - op.fees

    net_investment_change = cash_invested_in_period - cash_returned_in_period
    capital_gain_loss = (final_portfolio_value - initial_portfolio_value) - net_investment_change

    # Denominator for percentage calculation:
    # Use initial portfolio value plus any *new* cash invested during the period.
    # This is a simplification; true time-weighted or money-weighted returns are more complex.
    denominator_for_percentage = initial_portfolio_value + cash_invested_in_period
    # What if initial_portfolio_value was from assets bought *before* start_date?
    # A more common denominator for portfolio return is (Beginning Value + Net Additions/Withdrawals weighted or just Beginning Value).
    # Let's use: (FPV - IPV - NetFlows) / (IPV + Sum of Buys in period) -- this is still not standard.
    # Simpler: Capital Gain / (IPV + Cash Invested from Buys during period)
    # If IPV is 0 (started with no portfolio), then denominator is just cash_invested_in_period.

    # Let's use: IPV + cash_invested_in_period. If IPV is from before base, it's part of base.
    # If an operation (buy) happened on start_date, its value is part of IPV *and* cash_invested_in_period.
    # This needs to be careful.
    # Let's consider IPV as the value of holdings *at the start of start_date*.
    # Cash flows are for operations *during* [start_date, end_date].

    # Recalculate IPV based on holdings just before any operations on start_date,
    # or simply use equity_curve[0]['value'] which is value at end of the first period (e.g., end of start_date or end of start_month).
    # The current IPV (equity_curve[0]['value']) is at the end of the first period (e.g., end of start_date or end of start_month).
    # This is fine.

    profit_percentage = 0.0
    if abs(denominator_for_percentage) > 1e-6: # Avoid division by zero or near-zero
        profit_percentage = (capital_gain_loss / denominator_for_percentage) * 100
    elif abs(capital_gain_loss) > 1e-6 : # Non-zero profit with zero effective investment (e.g. gifted shares sold)
        profit_percentage = float('inf') if capital_gain_loss > 0 else float('-inf')


    return {
        "equity_curve": equity_curve,
        "profitability": {
            "absolute": round(capital_gain_loss, 2),
            "percentage": round(profit_percentage, 2),
            "initial_portfolio_value": round(initial_portfolio_value,2),
            "final_portfolio_value": round(final_portfolio_value,2),
            "cash_invested_in_period":round(cash_invested_in_period,2),
            "cash_returned_in_period":round(cash_returned_in_period,2),
            "net_investment_change": round(net_investment_change,2)
        }
    }


if __name__ == '__main__':
    # (Previous example usage for get_historical_prices and get_holdings_on_date remains)
    # Update sample_ops_data for get_holdings_on_date to include price and fees
    # This is a bit messy as Operacao model is now stricter.
    # The old tests for get_holdings_on_date might need adjustment if they pass raw dicts.
    # For now, focusing on calculate_portfolio_history tests.

    print("\n--- Testing calculate_portfolio_history ---")

    # Mock operations data including price and fees
    # Prices for AAPL around Jan 2023: ~125-145
    # Prices for MSFT around Jan 2023: ~220-240
    # Prices for GOOG around Jan 2023: ~85-95
    sample_portfolio_ops_data = [
        {'ticker': 'AAPL', 'date': '2023-01-02', 'operation_type': 'buy', 'quantity': 10, 'price': 130.0, 'fees': 5.0}, # Invest: 1305
        {'ticker': 'MSFT', 'date': '2023-01-02', 'operation_type': 'buy', 'quantity': 5, 'price': 230.0, 'fees': 5.0},   # Invest: 1155
        # Total invested early Jan: 1305 + 1155 = 2460
        {'ticker': 'AAPL', 'date': '2023-01-16', 'operation_type': 'sell', 'quantity': 3, 'price': 140.0, 'fees': 3.0},  # Return: 3*140 - 3 = 417
        {'ticker': 'GOOG', 'date': '2023-01-20', 'operation_type': 'buy', 'quantity': 8, 'price': 90.0, 'fees': 4.0},    # Invest: 8*90 + 4 = 724
    ]

    # For yfinance, use common tickers that have data for these dates.
    # AAPL, MSFT, GOOGL are good.
    # Need to ensure yfinance can fetch these.
    # To run this test, yfinance must be able to connect and get data.

    # Test 1: Monthly frequency
    print("\nTest 1: Monthly frequency (Jan 2023)")
    history_monthly = calculate_portfolio_history(sample_portfolio_ops_data, "2023-01-01", "2023-01-31", "monthly")
    if history_monthly and history_monthly['equity_curve']:
        print(f"Equity Curve (Monthly): {history_monthly['equity_curve']}")
        print(f"Profitability (Monthly): {history_monthly['profitability']}")
    else:
        print("Failed to get monthly history or empty result.")
        print(f"Result: {history_monthly}")

    # Test 2: Daily frequency (short period to avoid too much output/API calls)
    print("\nTest 2: Daily frequency (Jan 1 to Jan 10, 2023)")
    history_daily = calculate_portfolio_history(sample_portfolio_ops_data, "2023-01-01", "2023-01-10", "daily")
    if history_daily and history_daily['equity_curve']:
        print(f"Equity Curve (Daily):")
        for entry in history_daily['equity_curve']:
            print(entry)
        print(f"Profitability (Daily): {history_daily['profitability']}")
    else:
        print("Failed to get daily history or empty result.")
        print(f"Result: {history_daily}")

    # Test 3: No operations
    print("\nTest 3: No operations")
    history_no_ops = calculate_portfolio_history([], "2023-01-01", "2023-01-31", "monthly")
    print(f"Result (No Ops): {history_no_ops}")
    # Expected: Empty equity curve, zero profitability.

    # Test 4: Operations outside the requested period
    print("\nTest 4: Operations outside period")
    ops_outside_period = [
        {'ticker': 'AAPL', 'date': '2022-12-01', 'operation_type': 'buy', 'quantity': 10, 'price': 120.0, 'fees': 5.0}
    ]
    history_ops_outside = calculate_portfolio_history(ops_outside_period, "2023-01-01", "2023-01-31", "monthly")
    print(f"Result (Ops Outside): {history_ops_outside}")
     # Expected: Equity curve might show 0 if no holdings from before enter the period,
     # or if it reflects value of prior holdings. Profitability should be 0 for the period itself.
     # Current logic for IPV uses equity_curve[0]['value'], so if holdings exist from before start_date,
     # IPV will reflect that. NCF will be 0 for the period.

    # Test 5: Start date after end date
    print("\nTest 5: Start date after end date")
    history_bad_dates = calculate_portfolio_history(sample_portfolio_ops_data, "2023-02-01", "2023-01-01", "monthly")
    print(f"Result (Bad Dates): {history_bad_dates}")
    # Expected: Specific error message or empty result for equity curve.

    # Test 6: Very short period (e.g. one day) - daily
    print("\nTest 6: Single day period (daily)")
    history_one_day_daily = calculate_portfolio_history(sample_portfolio_ops_data, "2023-01-02", "2023-01-02", "daily")
    if history_one_day_daily and history_one_day_daily['equity_curve']:
        print(f"Equity Curve (One Day Daily): {history_one_day_daily['equity_curve']}")
        print(f"Profitability (One Day Daily): {history_one_day_daily['profitability']}")
    else:
        print("Failed to get one-day daily history or empty result.")

    # Test 7: Very short period (e.g. one day) - monthly
    # The date series generator should handle this by giving the last day of that month.
    print("\nTest 7: Single day period (monthly)")
    history_one_day_monthly = calculate_portfolio_history(sample_portfolio_ops_data, "2023-01-02", "2023-01-02", "monthly")
    if history_one_day_monthly and history_one_day_monthly['equity_curve']:
         print(f"Equity Curve (One Day Monthly): {history_one_day_monthly['equity_curve']}") # Should be value at 2023-01-31
         print(f"Profitability (One Day Monthly): {history_one_day_monthly['profitability']}")
    else:
        print("Failed to get one-day monthly history or empty result.")
        print(f"Result: {history_one_day_monthly}")

    # Test 8: Profitability with only sells (e.g. liquidating an old position not bought in period)
    print("\nTest 8: Profitability with only sells in period")
    ops_only_sells_in_period = [
        # Assume AAPL was bought before 2023-01-01
        {'ticker': 'AAPL', 'date': '2022-12-01', 'operation_type': 'buy', 'quantity': 10, 'price': 120.0, 'fees': 5.0}, # Outside period
        {'ticker': 'AAPL', 'date': '2023-01-16', 'operation_type': 'sell', 'quantity': 5, 'price': 140.0, 'fees': 3.0} # Sell in period
    ]
    history_only_sells = calculate_portfolio_history(ops_only_sells_in_period, "2023-01-01", "2023-01-31", "monthly")
    if history_only_sells and history_only_sells['equity_curve']:
        print(f"Equity Curve (Only Sells): {history_only_sells['equity_curve']}")
        print(f"Profitability (Only Sells): {history_only_sells['profitability']}")
    else:
        print("Failed to get 'only sells' history or empty result.")
        print(f"Result: {history_only_sells}")

    # Test 9: Ticker symbol that yfinance might not find for historical prices
    print("\nTest 9: Ticker with no historical price data from yfinance")
    ops_bad_ticker = [
        {'ticker': 'NONEXISTENTTICKERXYZ', 'date': '2023-01-02', 'operation_type': 'buy', 'quantity': 10, 'price': 10.0, 'fees': 1.0}
    ]
    history_bad_ticker = calculate_portfolio_history(ops_bad_ticker, "2023-01-01", "2023-01-05", "daily")
    if history_bad_ticker:
        print(f"Equity Curve (Bad Ticker): {history_bad_ticker['equity_curve']}") # Expect value 0 for this ticker
        print(f"Profitability (Bad Ticker): {history_bad_ticker['profitability']}")
    else:
        print("Failed to get 'bad ticker' history or empty result.")
        print(f"Result: {history_bad_ticker}")

    # Test 10: Operations that result in zero holdings by the end of a period.
    print("\nTest 10: Operations resulting in zero holdings")
    ops_zero_holdings = [
        {'ticker': 'AAPL', 'date': '2023-01-02', 'operation_type': 'buy', 'quantity': 10, 'price': 130.0, 'fees': 5.0},
        {'ticker': 'AAPL', 'date': '2023-01-10', 'operation_type': 'sell', 'quantity': 10, 'price': 135.0, 'fees': 5.0}
    ]
    history_zero_holdings = calculate_portfolio_history(ops_zero_holdings, "2023-01-01", "2023-01-15", "daily")
    if history_zero_holdings and 'equity_curve' in history_zero_holdings:
        print(f"Equity Curve (Zero Holdings by Jan 15):")
        for entry in history_zero_holdings['equity_curve']:
             print(entry)
        print(f"Profitability (Zero Holdings by Jan 15): {history_zero_holdings['profitability']}")
    else:
        print("Failed to get 'zero holdings' history or empty result.")
        print(f"Result: {history_zero_holdings}")

    # Test 11: Using datetime objects directly for dates in Operacao (if supported by model)
    print("\nTest 11: Using datetime.date objects in input operations")
    ops_with_date_objects = [
        {'ticker': 'MSFT', 'date': datetime_date(2023,1,5), 'operation_type': 'buy', 'quantity': 2, 'price': 220.0, 'fees': 1.0}
    ]
    history_date_obj = calculate_portfolio_history(ops_with_date_objects, "2023-01-01", "2023-01-10", "daily")
    if history_date_obj and history_date_obj['equity_curve']:
        print(f"Equity Curve (Date Objects):")
        for entry in history_date_obj['equity_curve']:
            print(entry)
        print(f"Profitability (Date Objects): {history_date_obj['profitability']}")
    else:
        print("Failed to get 'date objects' history or empty result.")
        print(f"Result: {history_date_obj}")


# --- Bens e Direitos ---

from schemas import BemDireitoAcaoSchema # Corrected import path
from database import obter_operacoes_por_usuario_ticker_ate_data, obter_acao_info_por_ticker # Corrected import path
from models import Operacao as OperacaoModel # Import from models.py for consistency

def calculate_average_price_up_to_date(
    user_id: int,
    ticker: str,
    target_date: datetime_date,
    operations_for_ticker: Optional[List[Operacao]] = None
) -> float:
    """
    Calculates the average purchase price of a stock for a user up to a target date.
    This function needs to be robust and handle corporate actions if they affect cost basis.
    The provided `get_holdings_on_date` already adjusts quantity for splits/bonuses.
    This average price calculation should ideally reflect the cost basis for the *adjusted* quantity.

    Args:
        user_id (int): The ID of the user.
        ticker (str): The stock ticker.
        target_date (datetime_date): The date up to which to calculate the average price.
        operations_for_ticker (Optional[List[OperacaoModel]]): Pre-fetched operations for the ticker.

    Returns:
        float: The average price, or 0.0 if no purchase operations are found or quantity becomes zero.
    """
    if operations_for_ticker is None:
        # Fetch operations if not provided. Ensure these are raw dicts that OperacaoModel can parse.
        # The database function should return data that can be parsed by OperacaoModel.
        # Let's assume obter_operacoes_por_usuario_ticker_ate_data returns list of dicts.
        raw_ops = obter_operacoes_por_usuario_ticker_ate_data(user_id, ticker, target_date.isoformat())
        # Parse into OperacaoModel instances. Note: OperacaoModel is from `models.py`
        # The Operacao model in this file is for yfinance and portfolio history.
        # We need to be careful about which Operacao model we are using.
        # For consistency, let's use the one from `models.py` if it's suitable.
        # The main `Operacao` model from `models.py` has aliases like 'Data do Negócio'.
        # The `Operacao` model in `portfolio_analysis_service.py` is simpler.
        # Let's use the local Operacao model for this service internal calculations for now,
        # assuming operations_for_ticker would conform to it if passed.
        # If fetching from DB, ensure transformation matches this service's Operacao.

        # Correct approach: Use the Operacao model defined in *this* service,
        # and ensure data fetched from DB is transformed to match it if necessary.
        # The `obter_operacoes_por_usuario_ticker_ate_data` in `database.py` likely returns
        # dicts that might need transformation.
        # For now, this part is a placeholder for actual data fetching and parsing.
        # Placeholder:
        # ops_data_dicts = get_operations_for_ticker_up_to_date(user_id, ticker, target_date)
        # operations = [Operacao(**op_data) for op_data in ops_data_dicts]

        # Given the current structure, it's better if the caller (get_bens_e_direitos_acoes)
        # fetches all user operations once and filters them.
        # This function will then receive the filtered list.
        # This avoids repeated DB calls if this function is called for multiple tickers.
        # So, if operations_for_ticker is None, it's an issue or requires a different strategy.
        # For now, let's assume operations_for_ticker will always be provided.
        if operations_for_ticker is None:
             # This path should ideally not be taken if called from get_bens_e_direitos_acoes
             # which should pre-fetch and pass operations.
             # If direct use is intended, a DB call would be here.
             # For now, returning 0.0 if not provided to avoid error.
             print(f"Warning: operations_for_ticker not provided for {ticker} on {target_date}. Avg price calc might be incorrect.")
             return 0.0


    # Sort operations by date to process them chronologically
    # The Operacao model in this service uses 'date' as datetime_date after validation.
    sorted_ops = sorted(operations_for_ticker, key=lambda op: op.date)

    current_quantity = 0
    total_cost = 0.0

    # --- Incorporate Corporate Event Adjustments for Average Price ---
    # This logic needs to be similar to how get_holdings_on_date adjusts quantities.
    # If get_holdings_on_date already provides the *final adjusted quantity* for target_date,
    # then this average price calculation must also account for how splits/bonuses affect cost basis.
    #
    # A common way:
    # - Splits (e.g., 2-for-1): quantity doubles, price halves. Total cost remains same.
    # - Bonus (e.g., 10%): quantity increases by 10%, price dilutes. Total cost remains same.
    #
    # The `get_holdings_on_date` in this service already has logic to apply events
    # to operations using `_apply_events_to_operation`. We should leverage that.
    # The operations passed to `calculate_average_price_up_to_date` should ideally be
    # *already adjusted* up to the `target_date` if we want the average price to match
    # the adjusted quantity from `get_holdings_on_date`.

    # Let's assume `operations_for_ticker` ARE *NOT* pre-adjusted by corporate events here.
    # We need to apply adjustments as we calculate the average price.
    # This makes the function self-contained for price calculation.

    id_acao = obter_id_acao_por_ticker(ticker) # Fetch from DB
    raw_events_data = []
    if id_acao:
        raw_events_data = obter_eventos_corporativos_por_id_acao_e_data_ex_anterior_a(id_acao, target_date)

    ticker_events: List[EventoCorporativoInfo] = []
    if raw_events_data:
        ticker_events = [EventoCorporativoInfo(**event_data) for event_data in raw_events_data]

    # Sort events by date_ex (already sorted from DB function)
    # ticker_events.sort(key=lambda ev: ev.data_ex if ev.data_ex else datetime_date.min)


    # Helper to apply events to a running quantity and average price
    # This is complex. A simpler way for average price is to track total_cost and total_quantity.
    # Corporate events that don't change total cost (splits, bonus) mean new_avg_price = total_cost / new_total_quantity.

    processed_ops_for_avg_price: List[Operacao] = []
    for op_original in sorted_ops:
        if op_original.date > target_date: # Ensure op is within target_date
            continue

        adjusted_op = op_original
        # Apply events that occurred *before or on* this operation's date,
        # but *after* the previous operation's date if we were iterating through time.
        # Simpler: apply all events *up to* the operation's date to this single operation's quantity and price.
        # This is what _apply_events_to_operation in get_holdings_on_date does.

        # We need to adjust the *historical* operations themselves based on subsequent events
        # if we are calculating a historical average price that reflects future splits.
        # Example: Buy 10 AAPL @ $100. Split 2:1. Now have 20 AAPL @ $50. Avg price is $50.
        # If calculating avg price *for Dec 31st*, and split happened in June, then ops before June
        # need to be seen as adjusted.

        # The `_apply_events_to_operation` adjusts an op based on events *after* op.date but *before* target_date (implicit).
        # Let's use it here:

        # Filter events relevant for *this specific operation op_original*
        # These are events whose ex-date is AFTER op_original.date but BEFORE or ON target_date
        relevant_events_for_op = [
            ev for ev in ticker_events
            if ev.data_ex and op_original.date < ev.data_ex <= target_date
        ]
        # Sort these relevant events by their ex-date
        relevant_events_for_op.sort(key=lambda ev: ev.data_ex if ev.data_ex else datetime_date.min)


        # Apply these relevant events to the op_original
        op_to_process = op_original
        for event_info in relevant_events_for_op:
            # This logic is from _apply_events_to_operation
            if event_info.evento and event_info.evento.lower().startswith("bonific"):
                bonus_increase = event_info.get_bonus_quantity_increase(float(op_to_process.quantity))
                new_quantity = float(op_to_process.quantity) + bonus_increase
                if new_quantity > 0:
                    new_price = float(op_to_process.price) * float(op_to_process.quantity) / new_quantity
                else:
                    new_price = float(op_to_process.price)
                op_to_process = op_to_process.copy(update={'quantity': int(round(new_quantity)), 'price': new_price})
                continue

            factor = event_info.get_adjustment_factor()
            if factor != 1.0:
                new_quantity_float = float(op_to_process.quantity) * factor
                new_price_float = float(op_to_process.price) / factor if factor != 0 else float(op_to_process.price)
                op_to_process = op_to_process.copy(update={
                    'quantity': int(round(new_quantity_float)),
                    'price': new_price_float
                })

        # Now use op_to_process for avg price calculation
        if op_to_process.operation_type == 'buy':
            total_cost += op_to_process.quantity * op_to_process.price
            current_quantity += op_to_process.quantity
        elif op_to_process.operation_type == 'sell':
            # For FIFO/average cost, selling reduces quantity at the current average cost.
            # The cost of goods sold (COGS) would be sell_quantity * current_avg_price.
            # total_cost is then reduced by this COGS.
            if current_quantity > 0: # Cannot sell if quantity is zero
                avg_price_before_sell = total_cost / current_quantity if current_quantity > 0 else 0
                cost_of_sold_shares = op_to_process.quantity * avg_price_before_sell
                total_cost -= cost_of_sold_shares
            current_quantity -= op_to_process.quantity

            if current_quantity < 0: # Should not happen with proper sell logic if not shorting
                current_quantity = 0 # Or handle as error
                total_cost = 0 # Reset cost if quantity goes to or below zero through selling

        # Ensure total_cost doesn't go negative if sells are valued higher than avg cost (profit)
        # or if quantity becomes zero.
        if current_quantity == 0:
            total_cost = 0.0

    if current_quantity <= 0:
        return 0.0

    return total_cost / current_quantity


def get_bens_e_direitos_acoes(
    user_id: int,
    target_date_str: str
) -> List[BemDireitoAcaoSchema]:
    """
    Retrieves the list of stock assets (ações) held by the user on a specific date,
    formatted for "Bens e Direitos" tax declaration.
    Now also returns valor_total_ano_anterior (valor total em 31/12 do ano anterior ao filtrado).
    """
    try:
        target_date = datetime.strptime(target_date_str, "%Y-%m-%d").date()
    except ValueError:
        raise ValueError("Invalid target_date_str format. Expected YYYY-MM-DD.")

    # Calcular data de 31/12 do ano anterior
    ano_anterior = target_date.year - 1
    data_ano_anterior = datetime.strptime(f"{ano_anterior}-12-31", "%Y-%m-%d").date()
    data_ano_anterior_str = f"{ano_anterior}-12-31"

    from services import listar_operacoes_service
    user_operations_raw_dicts: List[Dict[str, Any]] = listar_operacoes_service(usuario_id=user_id)

    operations_for_service: List[Operacao] = []
    for op_raw in user_operations_raw_dicts:
        try:
            transformed_op_data = {
                'ticker': op_raw['ticker'],
                'date': op_raw['date'],
                'operation_type': op_raw['operation'],
                'quantity': op_raw['quantity'],
                'price': op_raw['price'],
                'fees': op_raw.get('fees', 0.0)
            }
            operations_for_service.append(Operacao(**transformed_op_data))
        except Exception as e:
            print(f"Skipping operation due to parsing error: {op_raw}. Error: {e}")
            continue

    # Holdings em target_date
    ops_up_to_target_date = [op for op in operations_for_service if op.date <= target_date]
    holdings_on_target_date: Dict[str, int] = get_holdings_on_date(ops_up_to_target_date, target_date_str)

    # Holdings em 31/12 do ano anterior
    ops_up_to_ano_anterior = [op for op in operations_for_service if op.date <= data_ano_anterior]
    holdings_on_ano_anterior: Dict[str, int] = get_holdings_on_date(ops_up_to_ano_anterior, data_ano_anterior_str)

    bens_e_direitos_list: List[BemDireitoAcaoSchema] = []

    for ticker, quantity in holdings_on_target_date.items():
        if quantity <= 0:
            continue
        acao_info_dict = obter_acao_info_por_ticker(ticker)
        nome_empresa = acao_info_dict.get('nome') if acao_info_dict else None
        cnpj = acao_info_dict.get('cnpj') if acao_info_dict else None
        ops_for_ticker_up_to_target_date = [op for op in operations_for_service if op.ticker == ticker and op.date <= target_date]
        preco_medio = calculate_average_price_up_to_date(user_id, ticker, target_date, operations_for_ticker=ops_for_ticker_up_to_target_date)
        valor_total_data_base = round(quantity * preco_medio, 2)

        # Calcular valor total em 31/12 do ano anterior
        quantidade_ano_anterior = holdings_on_ano_anterior.get(ticker, 0)
        if quantidade_ano_anterior > 0:
            ops_for_ticker_up_to_ano_anterior = [op for op in operations_for_service if op.ticker == ticker and op.date <= data_ano_anterior]
            preco_medio_ano_anterior = calculate_average_price_up_to_date(user_id, ticker, data_ano_anterior, operations_for_ticker=ops_for_ticker_up_to_ano_anterior)
            valor_total_ano_anterior = round(quantidade_ano_anterior * preco_medio_ano_anterior, 2)
        else:
            valor_total_ano_anterior = 0.0

        bens_e_direitos_list.append(
            BemDireitoAcaoSchema(
                ticker=ticker,
                nome_empresa=nome_empresa,
                cnpj=cnpj,
                quantidade=quantity,
                preco_medio=round(preco_medio, 2),
                valor_total_data_base=valor_total_data_base,
                valor_total_ano_anterior=valor_total_ano_anterior,
            )
        )

    return bens_e_direitos_list

if __name__ == '__main__':
    # (Previous example usage for get_historical_prices, get_holdings_on_date, calculate_portfolio_history remains)

    print("\n--- Testing calculate_average_price_up_to_date ---")
    # Mock data for calculate_average_price_up_to_date
    # This requires mocking database interactions (obter_id_acao_por_ticker, obter_eventos_corporativos_por_id_acao_e_data_ex_anterior_a)
    # and operations data.
    # For simplicity, assume events are handled and focus on buy/sell logic.

    mock_ops_for_avg_price = [
        Operacao(ticker='TEST', date='2023-01-01', operation_type='buy', quantity=10, price=10.0, fees=0), # Cost 100, Qty 10, Avg 10
        Operacao(ticker='TEST', date='2023-01-05', operation_type='buy', quantity=10, price=12.0, fees=0), # Cost 120, Qty 20, TotalCost 220, Avg 11
        Operacao(ticker='TEST', date='2023-01-10', operation_type='sell', quantity=5, price=15.0, fees=0), # Sell 5. CostOfSold = 5*11=55. TotalCost 220-55=165. Qty 15. Avg 11.
        Operacao(ticker='TEST', date='2023-01-15', operation_type='buy', quantity=10, price=9.0, fees=0),  # Cost 90. Qty 25. TotalCost 165+90=255. Avg 10.2
    ]

    # Mocking obter_id_acao_por_ticker and obter_eventos_corporativos...
    # This is complex to do inline. For a real test, use unittest.mock.
    # Assuming no corporate events for this simple test:

    # Monkey patch (not ideal for production code, but for simple __main__ test)
    _original_obter_id_acao = obter_id_acao_por_ticker
    _original_obter_eventos = obter_eventos_corporativos_por_id_acao_e_data_ex_anterior_a

    def mock_obter_id_acao_por_ticker(ticker: str): return 1 if ticker == 'TEST' else None
    def mock_obter_eventos_corporativos(id_acao: int, data_limite: datetime_date): return []

    obter_id_acao_por_ticker = mock_obter_id_acao_por_ticker
    obter_eventos_corporativos_por_id_acao_e_data_ex_anterior_a = mock_obter_eventos_corporativos

    avg_price1 = calculate_average_price_up_to_date(1, 'TEST', datetime_date(2023,1,1), mock_ops_for_avg_price[0:1])
    print(f"Avg price on 2023-01-01 (after 1st buy): {avg_price1}") # Expected: 10.0

    avg_price2 = calculate_average_price_up_to_date(1, 'TEST', datetime_date(2023,1,5), mock_ops_for_avg_price[0:2])
    print(f"Avg price on 2023-01-05 (after 2nd buy): {avg_price2}") # Expected: 11.0

    avg_price3 = calculate_average_price_up_to_date(1, 'TEST', datetime_date(2023,1,10), mock_ops_for_avg_price[0:3])
    print(f"Avg price on 2023-01-10 (after 1st sell): {avg_price3}") # Expected: 11.0

    avg_price4 = calculate_average_price_up_to_date(1, 'TEST', datetime_date(2023,1,15), mock_ops_for_avg_price[0:4])
    print(f"Avg price on 2023-01-15 (after 3rd buy): {avg_price4}") # Expected: 10.2

    # Restore original functions
    obter_id_acao_por_ticker = _original_obter_id_acao
    obter_eventos_corporativos_por_id_acao_e_data_ex_anterior_a = _original_obter_eventos

    # Test get_bens_e_direitos_acoes would require more extensive mocking of DB and services.
    # Example structure:
    # print("\n--- Testing get_bens_e_direitos_acoes ---")
    # Mock listar_operacoes_service
    # Mock obter_acao_info_por_ticker
    # bens_list = get_bens_e_direitos_acoes(user_id=1, target_date_str="2023-12-31")
    # print(f"Bens e Direitos List for 2023-12-31: {bens_list}")
    pass # End of __main__


# --- Rendimentos Isentos e Não Tributáveis ---

from database import get_db # Required for the new service function

# Define a Pydantic model for the response structure, matching RendimentoIsentoResponse in the router
class RendimentoIsento(BaseModel):
    ticker: str
    empresa: Optional[str] = None
    cnpj: Optional[str] = None
    valor_total_recebido_no_ano: float

def get_rendimentos_isentos_por_ano(user_id: int, year: int) -> List[RendimentoIsento]:
    """
    Busca os rendimentos isentos e não tributáveis (Dividendos e Rendimentos)
    recebidos pelo usuário em um determinado ano, agrupados por ticker.
    """
    rendimentos_por_ticker: Dict[str, Dict[str, Any]] = {}

    with get_db() as conn:
        cursor = conn.cursor()
        # Query to sum 'valor_total_recebido' for relevant 'tipo_provento'
        # Group by ticker, and get associated 'nome_acao' and 'cnpj' from 'acoes' table.
        # Filter by year of 'dt_pagamento'.
        query = """
            SELECT
                upr.ticker_acao,
                a.razao_social as razao_social,
                a.cnpj,
                SUM(upr.valor_total_recebido) as total_valor_ano
            FROM usuario_proventos_recebidos upr
            JOIN acoes a ON upr.id_acao = a.id
            WHERE upr.usuario_id = ?
              AND strftime('%Y', upr.dt_pagamento) = ?
              AND upr.tipo_provento IN ('Dividendo', 'Rendimento')
              AND upr.dt_pagamento IS NOT NULL
            GROUP BY upr.ticker_acao, a.razao_social, a.cnpj
            ORDER BY upr.ticker_acao;
        """
        cursor.execute(query, (user_id, str(year)))
        rows = cursor.fetchall()

        for row in rows:
            rendimentos_por_ticker[row["ticker_acao"]] = {
                "ticker": row["ticker_acao"],
                "empresa": row["razao_social"],
                "cnpj": row["cnpj"],
                "valor_total_recebido_no_ano": row["total_valor_ano"]
            }

    # Convert the dictionary to a list of RendimentoIsento objects
    result_list = [RendimentoIsento(**data) for data in rendimentos_por_ticker.values()]

    return result_list


def calcular_lucro_mensal_por_ano(user_id: int, year: int) -> Dict[str, float]:
    """
    Calcula o lucro líquido total de operações (venda - compra - taxas) por mês do ano para o usuário.
    Retorna um dicionário: { '01': valor, '02': valor, ..., '12': valor }
    """
    from collections import defaultdict
    lucro_por_mes = defaultdict(float)
    print(f"[DEBUG] calcular_lucro_mensal_por_ano called with user_id={user_id}, year={year}")
    with get_db() as conn:
        cursor = conn.cursor()
        query = '''
            SELECT date, operation, quantity, price, fees
            FROM operacoes
            WHERE usuario_id = ? AND strftime('%Y', date) = ?
            '''
        print(f"[DEBUG] Executing SQL: {query.strip()} with params: user_id={user_id}, year={year}")
        cursor.execute(query, (user_id, str(year)))
        rows = cursor.fetchall()
        print(f"[DEBUG] Rows fetched: {len(rows)}")
        for row in rows:
            dt = row["date"]
            op = row["operation"].lower()
            qtd = row["quantity"]
            preco = row["price"]
            taxas = row["fees"]
            mes = dt[5:7]  # 'YYYY-MM-DD' -> MM
            print(f"[DEBUG] Row: date={dt}, op={op}, qtd={qtd}, preco={preco}, taxas={taxas}, mes={mes}")
            if op == 'buy':
                lucro_por_mes[mes] -= qtd * preco + taxas
            elif op == 'sell':
                lucro_por_mes[mes] += qtd * preco - taxas
    # Garante todos os meses no resultado
    result = {f'{i:02d}': round(lucro_por_mes[f'{i:02d}'], 2) for i in range(1, 13)}
    print(f"[DEBUG] Monthly profit result: {result}")
    return result

if __name__ == '__main__':
    # (Previous example usage remains)
    print("\n--- Testing get_rendimentos_isentos_por_ano ---")
    # This test would require mocking get_db and database interactions.
    # Conceptual test:
    # mock_user_id = 1
    # mock_year = 2023
    # rendimentos = get_rendimentos_isentos_por_ano(mock_user_id, mock_year)
    # print(f"Rendimentos isentos para usuário {mock_user_id} em {mock_year}: {rendimentos}")
    # Example expected output:
    # [
    #     RendimentoIsento(ticker='ITSA4', empresa='ITAUSA S.A.', cnpj='61.532.644/0001-15', valor_total_recebido_no_ano=150.75),
    #     RendimentoIsento(ticker='PETR4', empresa='PETROLEO BRASILEIRO S.A. PETROBRAS', cnpj='33.000.167/0001-01', valor_total_recebido_no_ano=300.50)
    # ]
    pass
