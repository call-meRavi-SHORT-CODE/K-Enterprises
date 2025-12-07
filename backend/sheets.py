# ---------------------------------------------------------------------------
# Timesheet project deletion helper
# ---------------------------------------------------------------------------

def delete_project_entries(project_name: str) -> int:
    """
    Delete all timesheet rows for the given project (case-insensitive).
    Returns the number of rows deleted.
    """
    svc = _get_sheets_service()
    # Get all timesheet rows
    resp = svc.values().get(
        spreadsheetId=SPREADSHEET_ID,
        range=f"'{TIMESHEET_SHEET_NAME}'!A:G"
    ).execute()
    rows = resp.get("values", [])
    # Find all row indices (1-based) where project matches
    to_delete = []
    for idx, row in enumerate(rows, start=1):
        padded = row + [""] * (7 - len(row))
        proj = padded[3]
        if proj and proj.strip().lower() == project_name.strip().lower():
            to_delete.append(idx)
    if not to_delete:
        return 0
    # Get sheet id
    meta = svc.get(spreadsheetId=SPREADSHEET_ID).execute()
    sheet_id = None
    for sht in meta.get("sheets", []):
        props = sht.get("properties", {})
        if props.get("title") == TIMESHEET_SHEET_NAME:
            sheet_id = props.get("sheetId")
            break
    if sheet_id is None:
        raise ValueError(f"Sheet '{TIMESHEET_SHEET_NAME}' not found")
    # Delete rows in reverse order to avoid shifting
    requests = []
    for row_idx in sorted(to_delete, reverse=True):
        requests.append({
            "deleteDimension": {
                "range": {
                    "sheetId": sheet_id,
                    "dimension": "ROWS",
                    "startIndex": row_idx - 1,
                    "endIndex": row_idx
                }
            }
        })
    svc.batchUpdate(
        spreadsheetId=SPREADSHEET_ID,
        body={"requests": requests}
    ).execute()
    return len(to_delete)
import logging
from datetime import date
from auth import get_credentials
from googleapiclient.discovery import build
from config import SPREADSHEET_ID, SHEET_NAME, TIMESHEET_SHEET_NAME
import re

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def _get_sheets_service():
    creds = get_credentials()
    return build("sheets", "v4", credentials=creds).spreadsheets()

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
      I: Folder ID
    """
    svc = _get_sheets_service()

    joining = data.get("joining_date")
    if isinstance(joining, date):
        joining_str = joining.isoformat()
    else:
        joining_str = str(joining)

    # Build exactly 10 columns
    values = [[
        "=NOW()",            # A: Timestamp
        data["email"],       # B
        data["name"],        # C
        data["position"],    # D
        data["department"],  # E
        data["contact"],     # F
        joining_str,           # G
        "",                  # H: Photo File ID placeholder
        ""                   # I: Folder ID placeholder
    ]]

    try:
        append_resp = svc.values().append(
            spreadsheetId=SPREADSHEET_ID,
            range=f"{SHEET_NAME}!A:I",
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

def update_ids(row: int, photo_file_id: str, folder_id: str):
    svc = _get_sheets_service()
    try:
        svc.values().update(
            spreadsheetId=SPREADSHEET_ID,
            range=f"{SHEET_NAME}!H{row}:I{row}",
            valueInputOption="RAW",
            body={"values": [[photo_file_id, folder_id]]}
        ).execute()
    except Exception:
        logger.exception(f"Failed to update IDs on row {row}")
        raise

# ---------------------------------------------------------------------------
# Additional helpers for update / delete
# ---------------------------------------------------------------------------

def _get_sheet_id() -> int:
    """Return the numeric sheetId for SHEET_NAME within the spreadsheet."""
    svc = _get_sheets_service()
    # svc is already the spreadsheets() resource; call .get directly
    meta = svc.get(spreadsheetId=SPREADSHEET_ID).execute()
    for sht in meta.get("sheets", []):
        props = sht.get("properties", {})
        if props.get("title") == SHEET_NAME:
            return props.get("sheetId")
    raise ValueError(f"Sheet '{SHEET_NAME}' not found in spreadsheet")


def find_employee_row(email: str) -> int | None:
    """Return the 1-based row index (integer) for the given email or None if not found."""
    svc = _get_sheets_service()
    resp = svc.values().get(
        spreadsheetId=SPREADSHEET_ID,
        range=f"{SHEET_NAME}!B:B"
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

    # Build 6-column list for A-F (joining date untouched)
    values = [[
        "=NOW()",                        # A Timestamp (refresh)
        data.get("email", email),        # B Email (may change)
        data.get("name", ""),          # C Name
        data.get("position", ""),      # D Position
        data.get("department", ""),    # E Department
        data.get("contact", "")         # F Contact
    ]]

    svc = _get_sheets_service()
    try:
        svc.values().update(
            spreadsheetId=SPREADSHEET_ID,
            range=f"{SHEET_NAME}!A{row}:F{row}",
            valueInputOption="USER_ENTERED",
            body={"values": values}
        ).execute()
    except Exception:
        logger.exception("Failed to update employee row")
        raise

    return row


def delete_employee(email: str):
    """Delete an employee row and return the row index that was removed."""
    row = find_employee_row(email)
    if not row:
        raise ValueError("Employee not found")

    svc = _get_sheets_service()
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

    return row

def list_employees() -> list[dict]:
    """Return a list of employee dicts from the sheet."""
    svc = _get_sheets_service()
    resp = svc.values().get(
        spreadsheetId=SPREADSHEET_ID,
        range=f"{SHEET_NAME}!A:I"
    ).execute()

    rows = resp.get("values", [])
    employees = []
    for idx, row in enumerate(rows, start=1):
        # Ensure length to 9 columns
        padded = row + [""] * (9 - len(row))
        (timestamp, email, name, position, department, contact, joining_date, photo_id, folder_id) = padded
        if not email:
            continue  # skip blank lines
        employees.append({
            "row": idx,
            "timestamp": timestamp,
            "email": email,
            "name": name,
            "position": position,
            "department": department,
            "contact": contact,
            "joining_date": joining_date,
            "photo_file_id": photo_id,
            "folder_id": folder_id
        })
    return employees

# ---------------------------------------------------------------------------
# Public Holidays helpers
# ---------------------------------------------------------------------------

from config import PUBLIC_HOLIDAYS_SHEET_NAME
from config import LEAVE_APPROVAL_SHEET_NAME
from config import DOCUMENTS_SHEET_NAME
# Timesheet sheet constant


def find_holiday(name: str, date_str: str) -> bool:
    """Return True if holiday with same name and date exists."""
    svc = _get_sheets_service()
    resp = svc.values().get(
        spreadsheetId=SPREADSHEET_ID,
        range=f"'{PUBLIC_HOLIDAYS_SHEET_NAME}'!B:C"  # handle spaces in sheet name
    ).execute()
    rows = resp.get("values", [])
    for row in rows:
        if len(row) >= 2 and row[0].strip().lower() == name.strip().lower() and row[1].strip() == date_str:
            return True
    return False


def append_holiday(data: dict):
    """Append a new holiday row to the Public Holidays sheet."""
    svc = _get_sheets_service()

    # Ensure date string isoformat
    dt = data["date"]
    if isinstance(dt, date):
        date_str = dt.strftime("%d-%m-%Y")
    else:
        date_str = str(dt)

    values = [[
        "=NOW()",        # A Timestamp
        data["name"],    # B Name
        date_str,         # C Date
        data["type"],    # D Type
        data.get("description", ""),  # E Description
        "TRUE" if data.get("recurring") else "FALSE"  # F Recurring
    ]]

    svc.values().append(
        spreadsheetId=SPREADSHEET_ID,
        range=f"'{PUBLIC_HOLIDAYS_SHEET_NAME}'!A:F",
        valueInputOption="USER_ENTERED",
        insertDataOption="INSERT_ROWS",
        body={"values": values}
    ).execute()


def find_holiday_row(name: str, date_str: str) -> int | None:
    """Return the 1-based row index for a holiday with given name and date."""
    svc = _get_sheets_service()
    resp = svc.values().get(
        spreadsheetId=SPREADSHEET_ID,
        range=f"'{PUBLIC_HOLIDAYS_SHEET_NAME}'!B:C"
    ).execute()
    rows = resp.get("values", [])
    for idx, row in enumerate(rows, start=1):
        # row[0]=name, row[1]=date
        if len(row) >= 2 and row[0].strip().lower() == name.strip().lower() and row[1].strip() == date_str:
            return idx
    return None


def update_holiday(orig_name: str, orig_date_str: str, data: dict):
    row = find_holiday_row(orig_name, orig_date_str)
    if not row:
        raise ValueError("Holiday not found")

    # Use existing values if not provided
    # Fetch current row values to fill missing data
    svc = _get_sheets_service()
    resp = svc.values().get(
        spreadsheetId=SPREADSHEET_ID,
        range=f"'{PUBLIC_HOLIDAYS_SHEET_NAME}'!A{row}:F{row}"
    ).execute()
    current = resp.get("values", [[]])[0]
    padded = current + ["", "", "", "", "", ""]
    _, cur_name, cur_date, cur_type, cur_desc, cur_rec = padded[:6]

    new_name = data.get("name", cur_name)

    date_val = data.get("date")
    if date_val is None:
        new_date_str = cur_date
    elif isinstance(date_val, date):
        new_date_str = date_val.strftime("%d-%m-%Y")
    else:
        new_date_str = str(date_val)

    new_type = data.get("type", cur_type)
    new_desc = data.get("description", cur_desc)

    if "recurring" in data and data["recurring"] is not None:
        new_rec_bool = bool(data["recurring"])
    else:
        new_rec_bool = cur_rec.upper() == "TRUE"

    new_rec = "TRUE" if new_rec_bool else "FALSE"

    values = [[
        "=NOW()",      # timestamp
        new_name,
        new_date_str,
        new_type,
        new_desc,
        new_rec
    ]]

    svc.values().update(
        spreadsheetId=SPREADSHEET_ID,
        range=f"'{PUBLIC_HOLIDAYS_SHEET_NAME}'!A{row}:F{row}",
        valueInputOption="USER_ENTERED",
        body={"values": values}
    ).execute()

    return row


def _get_public_sheet_id() -> int:
    svc = _get_sheets_service()
    meta = svc.get(spreadsheetId=SPREADSHEET_ID).execute()
    for sht in meta.get("sheets", []):
        props = sht.get("properties", {})
        if props.get("title") == PUBLIC_HOLIDAYS_SHEET_NAME:
            return props.get("sheetId")
    raise ValueError("Public holiday sheet not found")


def delete_holiday(name: str, date_str: str):
    row = find_holiday_row(name, date_str)
    if not row:
        raise ValueError("Holiday not found")

    svc = _get_sheets_service()
    sheet_id = _get_public_sheet_id()
    svc.batchUpdate(
        spreadsheetId=SPREADSHEET_ID,
        body={
            "requests": [
                {
                    "deleteDimension": {
                        "range": {
                            "sheetId": sheet_id,
                            "dimension": "ROWS",
                            "startIndex": row - 1,
                            "endIndex": row
                        }
                    }
                }
            ]
        }
    ).execute()

    return row


def list_holidays() -> list[dict]:
    svc = _get_sheets_service()
    resp = svc.values().get(
        spreadsheetId=SPREADSHEET_ID,
        range=f"'{PUBLIC_HOLIDAYS_SHEET_NAME}'!A:F"
    ).execute()
    rows = resp.get("values", [])
    holidays = []
    for idx, row in enumerate(rows, start=1):
        padded = row + [""] * (6 - len(row))
        ts, name, date_s, h_type, desc, rec = padded

        # Compute weekday name (e.g., Monday) from date string dd-mm-yyyy
        weekday = ""
        if date_s:
            try:
                from datetime import datetime
                dt_obj = datetime.strptime(date_s, "%d-%m-%Y")
                weekday = dt_obj.strftime("%A")
            except ValueError:
                # leave weekday blank if parsing fails
                weekday = ""
        holidays.append({
            "row": idx,
            "name": name,
            "date": date_s,
            "type": h_type,
            "day": weekday,
            "description": desc,
            "recurring": rec.upper() == "TRUE"
        })
    return holidays

# ---------------------------------------------------------------------------
# Leave Approval helpers
# ---------------------------------------------------------------------------


def append_leave(data: dict) -> int:
    """Append a new leave request to the LeaveApproval sheet and return its row number.

    Columns (A-H):
      A Timestamp
      B Employee email
      C Leave Type
      D From Date (dd-mm-yyyy)
      E To Date   (dd-mm-yyyy)
      F Duration  (integer days)
      G Reason
      H Status
    """
    svc = _get_sheets_service()

    # Parse / format dates
    from_dt = data.get("from_date")
    to_dt = data.get("to_date")
    applied_dt = data.get("applied_date", date.today())

    if isinstance(from_dt, date):
        from_str = from_dt.strftime("%d-%m-%Y")
    else:
        from_str = str(from_dt)

    if isinstance(to_dt, date):
        to_str = to_dt.strftime("%d-%m-%Y")
    else:
        to_str = str(to_dt)

    # Calculate duration in days (inclusive)
    try:
        duration_days = (to_dt - from_dt).days + 1 if from_dt and to_dt else 0
    except Exception:
        duration_days = data.get("duration", "")  # fallback

    applied_str = applied_dt.strftime("%d-%m-%Y") if isinstance(applied_dt, date) else str(applied_dt)

    values = [[
        "=NOW()",                # A Timestamp
        data["employee"],        # B Employee email
        data["leave_type"],      # C Leave Type
        from_str,                 # D From Date
        to_str,                   # E To Date
        str(duration_days),       # F Duration days
        applied_str,              # G Applied Date
        data.get("reason", ""), # H Reason
        data["status"]           # I Status
    ]]

    resp = svc.values().append(
        spreadsheetId=SPREADSHEET_ID,
        range=f"'{LEAVE_APPROVAL_SHEET_NAME}'!A:I",
        valueInputOption="USER_ENTERED",
        insertDataOption="INSERT_ROWS",
        body={"values": values}
    ).execute()

    updated_range = resp.get("updates", {}).get("updatedRange")
    row_no = int(updated_range.split("!")[1].split(":")[0][1:]) if updated_range else None
    return row_no or 0


def list_leaves() -> list[dict]:
    svc = _get_sheets_service()
    resp = svc.values().get(
        spreadsheetId=SPREADSHEET_ID,
        range=f"'{LEAVE_APPROVAL_SHEET_NAME}'!A:I"
    ).execute()
    leaves = []
    for idx, row in enumerate(resp.get("values", []), start=1):
        padded = row + [""] * (9 - len(row))
        ts, emp, ltype, from_dt, to_dt, dur, applied, reason, status = padded
        if not emp:
            continue
        leaves.append({
            "row": idx,
            "employee": emp,
            "leave_type": ltype,
            "from_date": from_dt,
            "to_date": to_dt,
            "duration": dur,
            "applied_date": applied,
            "reason": reason,
            "status": status
        })
    return leaves


def find_leave_row(employee: str, applied_date_str: str) -> int | None:
    """Return row index where employee & applied_date match (columns B & G)."""
    svc = _get_sheets_service()
    resp = svc.values().get(
        spreadsheetId=SPREADSHEET_ID,
        range=f"'{LEAVE_APPROVAL_SHEET_NAME}'!B:I"  # grab all relevant columns
    ).execute()
    for idx, row in enumerate(resp.get("values", []), start=1):
        # Ensure row has at least 7 elements for applied date at index 6 (G)
        padded = row + [""] * (7 - len(row))
        emp_val = padded[0]
        applied_val = padded[5]  # since we appended up to index 6? Wait index mapping: B index=0, C=1, D=2, E=3, F=4, G=5 -> applied date.
        if emp_val.strip().lower() == employee.strip().lower() and applied_val.strip() == applied_date_str:
            return idx
    return None


def update_leave_status(employee: str, applied_date_str: str, status: str):
    row = find_leave_row(employee, applied_date_str)
    if not row:
        raise ValueError("Leave request not found")

    svc = _get_sheets_service()
    svc.values().update(
        spreadsheetId=SPREADSHEET_ID,
        range=f"'{LEAVE_APPROVAL_SHEET_NAME}'!I{row}",
        valueInputOption="RAW",
        body={"values": [[status]]}
    ).execute()
    return row

# ---------------------------------------------------------------------------
# Document Requests helpers
# ---------------------------------------------------------------------------


def append_document_request(data: dict) -> int:
    """Append a document request row and return new row number.

    Columns:
    A Timestamp
    B Email
    C Document Type
    D Reason
    E Status (Defaults Pending)
    """
    svc = _get_sheets_service()

    values = [[
        "=NOW()",          # Timestamp
        data["email"],     # Email
        data["document_type"],
        data.get("reason", ""),
        "Pending",         # Initial status
    ]]

    resp = svc.values().append(
        spreadsheetId=SPREADSHEET_ID,
        range=f"'{DOCUMENTS_SHEET_NAME}'!A:E",
        valueInputOption="USER_ENTERED",
        insertDataOption="INSERT_ROWS",
        body={"values": values}
    ).execute()

    updated_range = resp.get("updates", {}).get("updatedRange")
    row_no = int(updated_range.split("!")[1].split(":")[0][1:]) if updated_range else None
    return row_no or 0


def list_document_requests() -> list[dict]:
    svc = _get_sheets_service()
    resp = svc.values().get(
        spreadsheetId=SPREADSHEET_ID,
        range=f"'{DOCUMENTS_SHEET_NAME}'!A:E"
    ).execute()
    results = []
    for idx, row in enumerate(resp.get("values", []), start=1):
        padded = row + ["", "", "", "", ""]
        ts, email, doc_type, reason, status = padded[:5]
        if not email:
            continue
        results.append({
            "row": idx,
            "email": email,
            "document_type": doc_type,
            "reason": reason,
            "status": status,
            "timestamp": ts,
        })
    return results

def complete_document_request(row: int, file_id: str):
    """Update Documents sheet row (1-based) to Completed and store file id in column F."""
    svc = _get_sheets_service()
    # Ensure row exists
    svc.values().update(
        spreadsheetId=SPREADSHEET_ID,
        range=f"'{DOCUMENTS_SHEET_NAME}'!E{row}:F{row}",
        valueInputOption="RAW",
        body={"values": [["Completed", file_id]]},
    ).execute()

# ---------------------------------------------------------------------------
# Timesheet helpers
# ---------------------------------------------------------------------------

from datetime import datetime


def append_timesheet_entry(data: dict) -> int:
    """Append a new timesheet row and return the row number created.

    Expected dict keys:
    - employee (str): employee email
    - date (date | str): entry date
    - project (str)
    - task_description (str)
    - duration_hours (float | str)
    - break_minutes (int | str)
    """

    svc = _get_sheets_service()

    dt_val = data.get("date")
    if isinstance(dt_val, date):
        date_str = dt_val.strftime("%d-%m-%Y")
    else:
        date_str = str(dt_val)

    # Ensure numeric strings
    duration_hours = str(data.get("duration_hours", ""))
    break_minutes = str(data.get("break_minutes", "0"))

    values = [[
        "=NOW()",  # A Timestamp
        data["employee"],  # B Employee
        date_str,  # C Date
        data["project"],  # D Project
        data.get("task_description", ""),  # E Task description
        duration_hours,  # F Duration hours
        break_minutes,  # G Break minutes
    ]]

    resp = svc.values().append(
        spreadsheetId=SPREADSHEET_ID,
        range=f"'{TIMESHEET_SHEET_NAME}'!A:G",
        valueInputOption="USER_ENTERED",
        insertDataOption="INSERT_ROWS",
        body={"values": values},
    ).execute()

    updated_range = resp.get("updates", {}).get("updatedRange")
    row_no = int(updated_range.split("!")[1].split(":")[0][1:]) if updated_range else None
    return row_no or 0


def list_timesheets(
    *,
    employee: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    project: str | None = None,
) -> list[dict]:
    """Return list of timesheet dicts filtered by optional parameters."""

    svc = _get_sheets_service()
    resp = svc.values().get(
        spreadsheetId=SPREADSHEET_ID,
        range=f"'{TIMESHEET_SHEET_NAME}'!A:G",
    ).execute()

    rows = resp.get("values", [])
    results: list[dict] = []

    for idx, row in enumerate(rows, start=1):
        padded = row + [""] * (7 - len(row))
        (
            ts,
            emp,
            date_s,
            proj,
            task_desc,
            dur_hours,
            brk_mins,
        ) = padded[:7]

        if not emp:
            continue  # skip empty rows

        # Parse date
        try:
            date_obj = datetime.strptime(date_s, "%d-%m-%Y").date() if date_s else None
        except ValueError:
            date_obj = None

        # Filter conditions
        if employee and emp.lower() != employee.lower():
            continue
        if project and proj.lower() != project.lower():
            continue
        if start_date and date_obj and date_obj < start_date:
            continue
        if end_date and date_obj and date_obj > end_date:
            continue

        try:
            dur_val = float(dur_hours) if dur_hours else 0.0
        except ValueError:
            dur_val = 0.0

        try:
            brk_val = int(brk_mins) if brk_mins else 0
        except ValueError:
            brk_val = 0

        results.append(
            {
                "row": idx,
                "timestamp": ts,
                "employee": emp,
                "date": date_s,
                "project": proj,
                "task_description": task_desc,
                "duration_hours": dur_val,
                "break_minutes": brk_val,
            }
        )

    return results
# ---------------------------------------------------------------------------
# Timesheet project deletion helper
# ---------------------------------------------------------------------------

def delete_project_entries(project_name: str) -> int:
    """
    Delete all timesheet rows for the given project (case-insensitive).
    Returns the number of rows deleted.
    """
    svc = _get_sheets_service()
    # Get all timesheet rows
    resp = svc.values().get(
        spreadsheetId=SPREADSHEET_ID,
        range=f"'{TIMESHEET_SHEET_NAME}'!A:G"
    ).execute()
    rows = resp.get("values", [])
    # Find all row indices (1-based) where project matches
    to_delete = []
    for idx, row in enumerate(rows, start=1):
        padded = row + [""] * (7 - len(row))
        proj = padded[3]
        if proj and proj.strip().lower() == project_name.strip().lower():
            to_delete.append(idx)
    if not to_delete:
        return 0
    # Get sheet id
    meta = svc.get(spreadsheetId=SPREADSHEET_ID).execute()
    sheet_id = None
    for sht in meta.get("sheets", []):
        props = sht.get("properties", {})
        if props.get("title") == TIMESHEET_SHEET_NAME:
            sheet_id = props.get("sheetId")
            break
    if sheet_id is None:
        raise ValueError(f"Sheet '{TIMESHEET_SHEET_NAME}' not found")
    # Delete rows in reverse order to avoid shifting
    requests = []
    for row_idx in sorted(to_delete, reverse=True):
        requests.append({
            "deleteDimension": {
                "range": {
                    "sheetId": sheet_id,
                    "dimension": "ROWS",
                    "startIndex": row_idx - 1,
                    "endIndex": row_idx
                }
            }
        })
    svc.batchUpdate(
        spreadsheetId=SPREADSHEET_ID,
        body={"requests": requests}
    ).execute()
    return len(to_delete)


def summarize_timesheets(employee: str, start_date: date, end_date: date) -> dict:
    """Aggregate total hours per project for the employee between dates."""

    entries = list_timesheets(
        employee=employee, start_date=start_date, end_date=end_date
    )

    project_totals: dict[str, float] = {}
    for item in entries:
        proj = item["project"]
        hrs = item["duration_hours"]
        project_totals[proj] = project_totals.get(proj, 0.0) + hrs

    total_hours = sum(project_totals.values())

    return {
        "employee": employee,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "projects": project_totals,
        "total_hours": total_hours,
        "entries": len(entries),
    }

def delete_timesheet_entry(row_id: str) -> bool:
    """
    Delete a single timesheet row by its 1-based row id (as string or int).
    Returns True if deleted, False if not found.
    """
    try:
        row_idx = int(row_id)
    except Exception:
        return False
    svc = _get_sheets_service()
    # Get sheet id
    meta = svc.get(spreadsheetId=SPREADSHEET_ID).execute()
    sheet_id = None
    for sht in meta.get("sheets", []):
        props = sht.get("properties", {})
        if props.get("title") == TIMESHEET_SHEET_NAME:
            sheet_id = props.get("sheetId")
            break
    if sheet_id is None:
        return False
    # Delete the row
    svc.batchUpdate(
        spreadsheetId=SPREADSHEET_ID,
        body={
            "requests": [
                {
                    "deleteDimension": {
                        "range": {
                            "sheetId": sheet_id,
                            "dimension": "ROWS",
                            "startIndex": row_idx - 1,
                            "endIndex": row_idx
                        }
                    }
                }
            ]
        }
    ).execute()
    return True
