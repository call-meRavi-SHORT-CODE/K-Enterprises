"""
Google Sheets Service for reading and writing employee data.
"""
from googleapiclient.errors import HttpError
import logging

from config.auth import get_sheets_service
from config.settings import SHEET_ID, SHEET_NAME, DATA_RANGE

logger = logging.getLogger(__name__)


def get_last_employee_id() -> str:
    """
    Get the last employee ID from the Google Sheet.
    
    Returns:
        str: Last employee ID (e.g., "KP012") or empty string if sheet is empty
    """
    try:
        service = get_sheets_service()
        
        # Read all rows from the sheet
        result = service.spreadsheets().values().get(
            spreadsheetId=SHEET_ID,
            range=DATA_RANGE
        ).execute()
        
        values = result.get("values", [])
        
        if not values:
            logger.info("Sheet is empty, starting with KP001")
            return ""
        
        # Get the last row's employee ID (first column, index 0)
        last_row = values[-1]
        if len(last_row) > 0:
            last_empid = last_row[0].strip()
            logger.info(f"Last employee ID found: {last_empid}")
            return last_empid
        else:
            logger.info("Last row is empty, starting with KP001")
            return ""
            
    except HttpError as error:
        logger.error(f"Error reading from Google Sheet: {error}")
        raise
    except Exception as error:
        logger.error(f"Unexpected error reading from Google Sheet: {error}")
        raise


def append_employee_row(employee_data: list) -> bool:
    """
    Append a new employee row to the Google Sheet.
    
    Args:
        employee_data: List of employee data in order:
            [empid, name, email, position, department, contact, joining_date]
    
    Returns:
        bool: True if successful
    """
    try:
        service = get_sheets_service()
        
        # Prepare the row data
        body = {
            "values": [employee_data]
        }
        
        # Append the row
        result = service.spreadsheets().values().append(
            spreadsheetId=SHEET_ID,
            range=f"{SHEET_NAME}!A:G",
            valueInputOption="USER_ENTERED",
            insertDataOption="INSERT_ROWS",
            body=body
        ).execute()
        
        logger.info(f"Employee row appended successfully: {employee_data[0]}")
        return True
        
    except HttpError as error:
        logger.error(f"Error writing to Google Sheet: {error}")
        raise
    except Exception as error:
        logger.error(f"Unexpected error writing to Google Sheet: {error}")
        raise

