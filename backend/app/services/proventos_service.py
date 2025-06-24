from datetime import datetime, date
from dateutil.relativedelta import relativedelta
from typing import List, Dict

from pydantic import BaseModel
from sqlalchemy.orm import Session # Keep for type hint consistency if routers expect it

# Corrected model import based on file structure
from backend.models import UsuarioProventoRecebidoDB # This model is for reference if needed, not directly queried here.
# Import the new database function
from backend.database import get_sum_proventos_by_month_for_user


class MonthlyEarnings(BaseModel):
    month: str  # YYYY-MM
    total_earnings: float


def get_sum_earnings_last_12_months(db: Session, user_id: int) -> List[MonthlyEarnings]:
    # db parameter is kept for type hint consistency with how services might be called,
    # but it's not directly used by this service function anymore.
    # The actual database connection is handled by get_db() in backend.database.

    # Calculate start and end dates
    current_date = datetime.now().date() # Use date object for consistency

    # Start date is the first day of the month 11 months ago
    # (e.g., if current is July 2024, start_month_calc will be August 2023)
    start_month_calc = current_date.replace(day=1) - relativedelta(months=11)

    # The query period for the database will be from start_month_calc (YYYY-MM-01)
    # up to current_date (today). The DB query will group by month.

    # Fetch summed earnings from the database function
    # get_sum_proventos_by_month_for_user expects date objects
    results_from_db = get_sum_proventos_by_month_for_user(
        user_id=user_id,
        start_date=start_month_calc,
        end_date=current_date
    )

    earnings_by_month: Dict[str, float] = {row["month"]: float(row["total"]) for row in results_from_db}

    all_months_data: List[MonthlyEarnings] = []

    # Iterate from 11 months ago to the current month to generate the 12-month list
    # The first month in our list should be start_month_calc
    for i in range(12):
        iter_date_month_start = start_month_calc + relativedelta(months=i)
        month_str = iter_date_month_start.strftime('%Y-%m')
        total = earnings_by_month.get(month_str, 0.0)
        all_months_data.append(MonthlyEarnings(month=month_str, total_earnings=total))

    return all_months_data

# Example usage (for testing purposes, typically not in the service file)
# if __name__ == '__main__':
#     # This part requires setting up a mock DB session and data
#     # For now, it's commented out.
#     # To test this, you would need a way to mock get_db() or run against a test DB.
#
#     # Mocking get_sum_proventos_by_month_for_user for a conceptual test:
#     def mock_get_sum_proventos_by_month_for_user(user_id: int, start_date: date, end_date: date):
#         print(f"Mock DB call for user {user_id} from {start_date} to {end_date}")
#         # Simulate some data that might come from the DB
#         # For July 2024 run: start_date=2023-08-01, end_date=2024-07-DD
#         return [
#             {"month": "2023-10", "total": 100.50},
#             {"month": "2023-12", "total": 50.25},
#             {"month": "2024-01", "total": 75.00},
#             {"month": "2024-07", "total": 120.00},
#         ]
#
#     # Replace the actual DB call with the mock for this test
#     original_db_call = get_sum_proventos_by_month_for_user
#     get_sum_proventos_by_month_for_user = mock_get_sum_proventos_by_month_for_user
#
#     # Simulate a Session object (None, as it's not used by the service directly anymore)
#     mock_db_session = None
#
#     print(f"Current date (for context): {datetime.now().date()}")
#     earnings = get_sum_earnings_last_12_months(db=mock_db_session, user_id=1)
#     for entry in earnings:
#         print(entry)
#
#     # Restore original function if multiple tests were to be run
#     get_sum_proventos_by_month_for_user = original_db_call
