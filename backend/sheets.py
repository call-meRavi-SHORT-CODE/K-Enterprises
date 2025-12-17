import logging
from datetime import date
from auth import get_credentials
from googleapiclient.discovery import build
from config import SPREADSHEET_ID, SHEET_NAME
import re
import threading

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Cache for services and sheet name
_sheets_service_cache = None
_sheets_service_lock = threading.Lock()
_sheet_name_cache = None
_sheet_name_lock = threading.Lock()

def _get_sheets_service():
    """Get cached Sheets service or create new one. Thread-safe."""
    global _sheets_service_cache
    
    with _sheets_service_lock:
        if _sheets_service_cache is not None:
            return _sheets_service_cache
        
        creds = get_credentials()
        _sheets_service_cache = build("sheets", "v4", credentials=creds, cache_discovery=False).spreadsheets()
        return _sheets_service_cache


def _get_actual_sheet_name() -> str:
    """
    Get the actual sheet name to use. Cached for performance.
    If configured SHEET_NAME doesn't exist, use the first sheet.
    
    Returns:
        str: Sheet name to use
    """
    global _sheet_name_cache
    
    with _sheet_name_lock:
        if _sheet_name_cache is not None:
            return _sheet_name_cache
        
        try:
            svc = _get_sheets_service()
            
            # Get spreadsheet metadata to check available sheets
            meta = svc.get(spreadsheetId=SPREADSHEET_ID).execute()
            sheets = meta.get('sheets', [])
            
            if not sheets:
                # If no sheets exist, return default name
                _sheet_name_cache = SHEET_NAME
                return _sheet_name_cache
            
            # Check if configured sheet name exists (case-insensitive)
            for sheet in sheets:
                sheet_title = sheet['properties']['title']
                if sheet_title.lower() == SHEET_NAME.lower():
                    _sheet_name_cache = sheet_title  # Return actual case
                    return _sheet_name_cache
            
            # If configured name doesn't exist, use the first sheet
            first_sheet_name = sheets[0]['properties']['title']
            logger.info(f"Sheet '{SHEET_NAME}' not found, using first sheet: '{first_sheet_name}'")
            _sheet_name_cache = first_sheet_name
            return _sheet_name_cache
            
        except Exception as e:
            logger.warning(f"Could not determine sheet name, using default '{SHEET_NAME}': {e}")
            _sheet_name_cache = SHEET_NAME
            return _sheet_name_cache

def append_employee(data: dict) -> int:
    """
    Appends a row to the sheet. Returns the new row number.
    Sheet columns are:
      A: Timestamp
      B: Email
      C: Name
      D: Position
      E: Department
      F: Contact
      G: Joining Date
      H: Photo File ID
    """
    svc = _get_sheets_service()

    joining = data.get("joining_date")
    if isinstance(joining, date):
        joining_str = joining.isoformat()
    else:
        joining_str = str(joining)

    # Build exactly 9 columns (added Emp ID as column B, photo moved to I)
    emp_id = _get_next_emp_id()
    values = [[
        "=NOW()",            # A: Timestamp
        emp_id,               # B: Emp ID (auto-generated)
        data["email"],       # C
        data["name"],        # D
        data["position"],    # E
        data["department"],  # F
        data["contact"],     # G
        joining_str,          # H
        ""                   # I: Photo File ID placeholder
    ]]

    try:
        actual_sheet_name = _get_actual_sheet_name()
        append_resp = svc.values().append(
            spreadsheetId=SPREADSHEET_ID,
            range=f"{actual_sheet_name}!A:H",
            valueInputOption="USER_ENTERED",
            insertDataOption="INSERT_ROWS",
            body={"values": values}
        ).execute()

        # The response contains the updatedRange (e.g., "Employee!A2:J2").
        updated_range = append_resp.get("updates", {}).get("updatedRange")
        if not updated_range:
            raise ValueError("Missing updatedRange in append response")

        # Extract the starting cell reference (everything after ! and before :)
        start_cell = updated_range.split("!")[1].split(":")[0]  # e.g., "A2"

        # Grab the numeric row portion (strip leading letters)
        row_str = re.sub(r"[A-Z]", "", start_cell, flags=re.IGNORECASE)
        if not row_str.isdigit():
            raise ValueError(f"Unable to parse row number from '{start_cell}'")

        row_no = int(row_str)
        logger.info(f"Appended employee at row {row_no}")
        return row_no

    except Exception as e:
        logger.exception("Failed to append row to Google Sheets")
        raise

def update_ids(row: int, photo_file_id: str):
    svc = _get_sheets_service()
    actual_sheet_name = _get_actual_sheet_name()
    try:
        svc.values().update(
            spreadsheetId=SPREADSHEET_ID,
            range=f"{actual_sheet_name}!I{row}:I{row}",
            valueInputOption="RAW",
            body={"values": [[photo_file_id]]}
        ).execute()
    except Exception:
        logger.exception(f"Failed to update IDs on row {row}")
        raise

# ---------------------------------------------------------------------------
# Additional helpers for update / delete
# ---------------------------------------------------------------------------

def _get_sheet_id() -> int:
    """Return the numeric sheetId for the actual sheet name within the spreadsheet."""
    svc = _get_sheets_service()
    actual_sheet_name = _get_actual_sheet_name()
    # svc is already the spreadsheets() resource; call .get directly
    meta = svc.get(spreadsheetId=SPREADSHEET_ID).execute()
    for sht in meta.get("sheets", []):
        props = sht.get("properties", {})
        if props.get("title") == actual_sheet_name:
            return props.get("sheetId")
    raise ValueError(f"Sheet '{actual_sheet_name}' not found in spreadsheet")


def find_employee_row(email: str) -> int | None:
    """Return the 1-based row index (integer) for the given email or None if not found."""
    svc = _get_sheets_service()
    actual_sheet_name = _get_actual_sheet_name()
    resp = svc.values().get(
        spreadsheetId=SPREADSHEET_ID,
        range=f"{actual_sheet_name}!C:C"
    ).execute()
    values = resp.get("values", [])
    for idx, row in enumerate(values, start=1):
        if row and row[0].strip().lower() == email.strip().lower():
            return idx
    return None


def update_employee(email: str, data: dict):
    """Update an employee row identified by email with the provided data dict."""
    row = find_employee_row(email)
    if not row:
        raise ValueError("Employee not found")

    # Need to preserve Emp ID (column B). Build A-G (Timestamp, EmpID, Email, Name, Position, Department, Contact)
    svc = _get_sheets_service()
    actual_sheet_name = _get_actual_sheet_name()

    # Fetch existing Emp ID to preserve it
    resp = svc.values().get(
        spreadsheetId=SPREADSHEET_ID,
        range=f"{actual_sheet_name}!B{row}:B{row}"
    ).execute()
    emp_vals = resp.get("values", [[]])
    emp_id = emp_vals[0][0] if emp_vals and len(emp_vals[0]) > 0 else ""

    values = [[
        "=NOW()",                        # A Timestamp (refresh)
        emp_id,                           # B Emp ID (preserve)
        data.get("email", email),       # C Email (may change)
        data.get("name", ""),         # D Name
        data.get("position", ""),     # E Position
        data.get("department", ""),   # F Department
        data.get("contact", "")       # G Contact
    ]]

    try:
        svc.values().update(
            spreadsheetId=SPREADSHEET_ID,
            range=f"{actual_sheet_name}!A{row}:G{row}",
            valueInputOption="USER_ENTERED",
            body={"values": values}
        ).execute()
    except Exception:
        logger.exception("Failed to update employee row")
        raise

    return row


def delete_employee(email: str):
    """
    Delete an employee row and return a dict with row index and photo_file_id.
    
    Returns:
        dict: {"row": int, "photo_file_id": str | None}
    """
    row = find_employee_row(email)
    if not row:
        raise ValueError("Employee not found")

    # Get photo_file_id before deleting the row
    svc = _get_sheets_service()
    actual_sheet_name = _get_actual_sheet_name()
    resp = svc.values().get(
        spreadsheetId=SPREADSHEET_ID,
        range=f"{actual_sheet_name}!I{row}:I{row}"
    ).execute()
    vals = resp.get("values", [[]])
    photo_file_id = vals[0][0].strip() if vals and len(vals[0]) > 0 and vals[0][0] else None

    # Delete the row from sheet
    sheet_id = _get_sheet_id()
    try:
        svc.batchUpdate(
            spreadsheetId=SPREADSHEET_ID,
            body={
                "requests": [
                    {
                        "deleteDimension": {
                            "range": {
                                "sheetId": sheet_id,
                                "dimension": "ROWS",
                                "startIndex": row - 1,  # zero-based, inclusive
                                "endIndex": row         # exclusive
                            }
                        }
                    }
                ]
            }
        ).execute()
    except Exception:
        logger.exception("Failed to delete employee row")
        raise

    return {"row": row, "photo_file_id": photo_file_id}

def list_employees() -> list[dict]:
    """Return a list of employee dicts from the sheet."""
    svc = _get_sheets_service()
    actual_sheet_name = _get_actual_sheet_name()
    resp = svc.values().get(
        spreadsheetId=SPREADSHEET_ID,
        range=f"{actual_sheet_name}!A:I"
    ).execute()

    rows = resp.get("values", [])
    employees = []
    
    # Skip header row - check if first row looks like a header
    start_idx = 1
    if rows and len(rows) > 0:
        first_row = rows[0]
        if first_row and len(first_row) > 0:
            first_cell = str(first_row[0]).strip().upper()
            # Check if first row is a header by looking for common header patterns
            header_patterns = ["TIMESTAMP", "EMAIL", "NAME", "EMPLOYEE", "ID", "EMP_ID"]
            is_header = any(pattern in first_cell for pattern in header_patterns)
            if is_header:
                start_idx = 2  # Skip header row
    
    for idx, row in enumerate(rows, start=1):
        # Skip header row
        if idx < start_idx:
            continue
            
        # Ensure length to 9 columns
        padded = row + [""] * (9 - len(row))
        (timestamp, emp_id, email, name, position, department, contact, joining_date, photo_id) = padded
        if not email:
            continue  # skip blank lines
        employees.append({
            "row": idx,
            "timestamp": timestamp,
            "emp_id": emp_id,
            "email": email,
            "name": name,
            "position": position,
            "department": department,
            "contact": contact,
            "joining_date": joining_date,
            "photo_file_id": photo_id
        })
    return employees


def _get_next_emp_id() -> str:
    """Scan existing Emp IDs in column B and return the next ID in format empNN (zero-padded 2 digits)."""
    svc = _get_sheets_service()
    actual_sheet_name = _get_actual_sheet_name()
    resp = svc.values().get(
        spreadsheetId=SPREADSHEET_ID,
        range=f"{actual_sheet_name}!B:B"
    ).execute()
    values = resp.get("values", [])
    max_n = 0
    # Also backfill missing emp IDs (empty cells) to keep rows consistent
    missing_rows = []
    for idx, row in enumerate(values, start=1):
        if not row or not row[0].strip():
            missing_rows.append(idx)
            continue
        val = row[0].strip().lower()
        m = re.match(r"emp0*(\d+)$", val)
        if m:
            try:
                n = int(m.group(1))
                if n > max_n:
                    max_n = n
            except Exception:
                continue

    # Assign emp IDs for missing rows sequentially after current max
    next_n = max_n + 1
    if missing_rows:
        for r in missing_rows:
            new_id = f"emp{next_n:02d}"
            try:
                svc.values().update(
                    spreadsheetId=SPREADSHEET_ID,
                    range=f"{actual_sheet_name}!B{r}:B{r}",
                    valueInputOption="RAW",
                    body={"values": [[new_id]]}
                ).execute()
                next_n += 1
            except Exception:
                logger.exception(f"Failed to backfill emp id for row {r}")

    return f"emp{next_n:02d}"
