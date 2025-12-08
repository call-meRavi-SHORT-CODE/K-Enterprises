"""
Google Sheets Service for reading and writing employee data.
"""
from googleapiclient.errors import HttpError
import logging

from config.auth import get_sheets_service
from config.settings import SHEET_ID, SHEET_NAME, DATA_RANGE

logger = logging.getLogger(__name__)


def get_sheet_name() -> str:
    """
    Get the actual sheet name to use. If 'employees' tab doesn't exist, use the first sheet.
    
    Returns:
        str: Sheet name to use
    """
    try:
        service = get_sheets_service()
        
        # Get spreadsheet metadata to check available sheets
        spreadsheet = service.spreadsheets().get(spreadsheetId=SHEET_ID).execute()
        sheets = spreadsheet.get('sheets', [])
        
        if not sheets:
            # If no sheets exist, return default name
            return SHEET_NAME
        
        # Check if 'employees' sheet exists
        for sheet in sheets:
            if sheet['properties']['title'].lower() == SHEET_NAME.lower():
                return sheet['properties']['title']
        
        # If 'employees' doesn't exist, use the first sheet
        first_sheet_name = sheets[0]['properties']['title']
        logger.info(f"Sheet '{SHEET_NAME}' not found, using first sheet: '{first_sheet_name}'")
        return first_sheet_name
        
    except Exception as e:
        logger.warning(f"Could not determine sheet name, using default '{SHEET_NAME}': {e}")
        return SHEET_NAME


def get_last_employee_id() -> str:
    """
    Get the last employee ID from the Google Sheet.
    
    Returns:
        str: Last employee ID (e.g., "KP012") or empty string if sheet is empty
    """
    try:
        service = get_sheets_service()
        actual_sheet_name = get_sheet_name()
        
        # Use column A to get all employee IDs (more flexible than A:G)
        range_to_read = f"{actual_sheet_name}!A:A"
        
        # Read all rows from column A
        result = service.spreadsheets().values().get(
            spreadsheetId=SHEET_ID,
            range=range_to_read
        ).execute()
        
        values = result.get("values", [])
        
        if not values:
            logger.info("Sheet is empty, starting with KP001")
            return ""
        
        # Filter out empty rows and header rows (skip if first row looks like header)
        employee_ids = []
        for row in values:
            if row and len(row) > 0:
                empid = row[0].strip()
                # Skip header rows (common headers: "Employee ID", "ID", "Emp ID", etc.)
                if empid and empid.upper() not in ["EMPLOYEE ID", "ID", "EMP ID", "EMPLOYEEID", "EMPID"]:
                    employee_ids.append(empid)
        
        if not employee_ids:
            logger.info("No employee IDs found in sheet, starting with KP001")
            return ""
        
        # Get the last employee ID
        last_empid = employee_ids[-1]
        logger.info(f"Last employee ID found: {last_empid}")
        return last_empid
            
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
        actual_sheet_name = get_sheet_name()
        
        # Prepare the row data
        body = {
            "values": [employee_data]
        }
        
        # Append the row to columns A through G
        result = service.spreadsheets().values().append(
            spreadsheetId=SHEET_ID,
            range=f"{actual_sheet_name}!A:G",
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

