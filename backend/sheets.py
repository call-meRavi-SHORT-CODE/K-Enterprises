"""
Sheets Module - SQLite adapter (replacing Google Sheets API)

Provides the same interface as the old Google Sheets module
but backed by SQLite for better performance and reliability.
"""

import logging
from typing import Optional, List, Dict, Any
from database import (
    create_employee, get_employee_by_email, 
    delete_employee as db_delete_employee,
    list_all_employees, get_db_connection, update_employee as db_update_employee
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

SPREADSHEET_ID = "sqlite"
SHEET_NAME = "Employees"


def _get_sheets_service():
    """Mock function for compatibility - no longer needed with SQLite"""
    return None


def _get_actual_sheet_name():
    """Mock function for compatibility"""
    return SHEET_NAME


# ============================================================================
# EMPLOYEE OPERATIONS
# ============================================================================

def append_employee(data: Dict[str, Any]) -> Optional[int]:
    """Create an employee and return the row number (in this case, the ID)"""
    try:
        result = create_employee(
            email=data["email"],
            name=data["name"],
            position=data["position"],
            department=data["department"],
            contact=data["contact"],
            joining_date=data["joining_date"]
        )
        logger.info(f"Employee created: {data['email']}")
        return result["id"]
    except Exception as e:
        logger.error(f"Failed to create employee: {e}")
        return None


def find_employee_row(email: str) -> Optional[int]:
    """Find employee ID by email"""
    employee = get_employee_by_email(email)
    return employee["id"] if employee else None




def update_employee(email: str, updates: Dict[str, Any]) -> Optional[int]:
    """Update employee"""
    # Filter out photo_file_id if present
    filtered_updates = {k: v for k, v in updates.items() if k != "photo_file_id"}
    if filtered_updates:
        db_update_employee(email, filtered_updates)
    employee = get_employee_by_email(email)
    return employee["id"] if employee else None


def delete_employee(email: str) -> Dict[str, Any]:
    """Delete employee and return result"""
    employee = get_employee_by_email(email)
    if not employee:
        return {"row": None}
    
    row_deleted = db_delete_employee(email)
    
    return {
        "row": employee["id"] if row_deleted else None
    }


def list_employees() -> List[Dict[str, Any]]:
    """List all employees"""
    employees = list_all_employees()
    # Remove internal photo_file_id from API responses
    for e in employees:
        if "photo_file_id" in e:
            del e["photo_file_id"]
    return employees
