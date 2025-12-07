from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from sheets import append_employee, update_ids, update_employee, delete_employee, find_employee_row, list_employees, append_holiday, find_holiday, list_holidays, update_holiday, delete_holiday, append_leave, list_leaves, update_leave_status, find_leave_row
from drive import setup_employee_folders, upload_photo, rename_employee_folder, delete_employee_folder
from fastapi.middleware.cors import CORSMiddleware
from models import EmployeeUpdate, HolidayCreate, LeaveCreate, LeaveUpdate, LeaveStatus, DocumentRequest
from models import HolidayUpdate
from models import TimesheetEntryCreate
# Timesheet helpers
from sheets import append_timesheet_entry, list_timesheets, summarize_timesheets, delete_project_entries, delete_timesheet_entry
from email_utils import send_timesheet_reminder_email
from datetime import date, datetime, timedelta

# Email utility
from email_utils import send_leave_status_email
from drive import _get_or_create_profile_folder, delete_drive_file
from drive import upload_file_to_folder, _get_or_create_documents_folder
from collections import Counter, defaultdict

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["*"],
)


@app.post("/employees/")
async def create_employee(
    email: str = Form(...),
    name: str = Form(...),
    position: str = Form(...),
    department: str = Form(...),
    contact: str = Form(...),
    joining_date: str = Form(...),
    profile_photo: UploadFile = File(...)
):

    data = {
        "email": email,
        "name": name,
        "position": position,
        "department": department,
        "contact": contact,
        "joining_date": joining_date
    }

    # Duplicate email check
    if find_employee_row(email):
        raise HTTPException(400, "Employee already exists")

    row_no = append_employee(data)
    if not row_no:
        raise HTTPException(500, "Could not append to sheet")

    # 2) Make Drive folders
    folders = setup_employee_folders(email)

    # 3) Upload the photo
    photo_id = upload_photo(profile_photo, folders["photo"])

    # 4) Update the sheet with IDs
    update_ids(row_no, photo_id, folders["base"])

    return {
        "row": row_no,
        "folder_id": folders["base"],
        "photo_file_id": photo_id
    }


# ---------------------------------------------------------------------------
# Update employee endpoint
# ---------------------------------------------------------------------------


@app.put("/employees/{email}")
async def edit_employee(email: str, payload: EmployeeUpdate):
    # Find the existing row and folder information first
    row = find_employee_row(email)
    if not row:
        raise HTTPException(404, "Employee not found")

    # Read folder id from sheet (columns H/I). Fetch row values
    from sheets import _get_sheets_service, SPREADSHEET_ID, SHEET_NAME  # type: ignore
    svc = _get_sheets_service()
    resp = svc.values().get(spreadsheetId=SPREADSHEET_ID, range=f"{SHEET_NAME}!H{row}:I{row}").execute()
    vals = resp.get("values", [[]])
    photo_id = vals[0][0] if vals and len(vals[0]) > 0 else None
    folder_id = vals[0][1] if vals and len(vals[0]) > 1 else None

    # Update row in Sheets
    update_employee(email, payload.dict(exclude_none=True))

    # If email is changed, rename Drive folder
    if payload.email and folder_id:
        rename_employee_folder(folder_id, payload.email)

    return {"status": "updated", "row": row}



# ---------------------------------------------------------------------------
# Get single employee endpoint
# ---------------------------------------------------------------------------


@app.get("/employees/{email}")
async def get_employee(email: str):
    """Return a single employee record looked-up by email (case-insensitive).

    The response mirrors an item from ``/employees/`` but adds a convenience
    ``photo_url`` field that can be embedded directly in an <img/> tag if the
    employee has a profile photo stored in Drive.
    """
    employees = list_employees()
    match = next((e for e in employees if e["email"].lower() == email.lower()), None)
    if not match:
        raise HTTPException(404, "Employee not found")

    photo_id = match.get("photo_file_id")
    if photo_id:
        match["photo_url"] = f"https://drive.google.com/uc?id={photo_id}"
    return match


# ---------------------------------------------------------------------------
# Delete employee endpoint
# ---------------------------------------------------------------------------


@app.delete("/employees/{email}")
async def remove_employee(email: str):
    row = find_employee_row(email)
    if not row:
        raise HTTPException(404, "Employee not found")

    # Get folder id from sheet before deleting
    from sheets import _get_sheets_service, SPREADSHEET_ID, SHEET_NAME  # type: ignore
    svc = _get_sheets_service()
    resp = svc.values().get(spreadsheetId=SPREADSHEET_ID, range=f"{SHEET_NAME}!H{row}:I{row}").execute()
    vals = resp.get("values", [[]])
    folder_id = vals[0][1] if vals and len(vals[0]) > 1 else None

    # Delete row in Sheets
    delete_employee(email)

    # Delete Drive folder if present
    if folder_id:
        delete_employee_folder(folder_id)

    return {"status": "deleted", "row": row}

# ---------------------------------------------------------------------------
# List employees endpoint
# ---------------------------------------------------------------------------


@app.get("/employees/")
async def list_all_employees():
    return list_employees()



# ---------------------------------------------------------------------------
# Employee profile photo retrieval endpoint
# ---------------------------------------------------------------------------


from fastapi.responses import StreamingResponse
import io
from googleapiclient.http import MediaIoBaseDownload


@app.get("/employees/{email}/photo")
async def get_profile_photo(email: str):
    """Stream the employee's profile photo directly from Google Drive.

    Steps:
    1. Locate the employee row via email in the Sheet.
    2. Read the *photo_file_id* from column H.
    3. Download the binary from Drive and stream it back with the correct
       MIME type.
    """

    # 1) Find sheet row
    row = find_employee_row(email)
    if not row:
        raise HTTPException(404, "Employee not found")

    # 2) Fetch photo file id
    from sheets import _get_sheets_service, SPREADSHEET_ID, SHEET_NAME  # type: ignore

    svc_sheets = _get_sheets_service()
    resp = svc_sheets.values().get(
        spreadsheetId=SPREADSHEET_ID,
        range=f"{SHEET_NAME}!H{row}:H{row}"
    ).execute()
    vals = resp.get("values", [[]])
    photo_file_id = vals[0][0] if vals and len(vals[0]) > 0 else None

    if not photo_file_id:
        raise HTTPException(404, "Profile photo not set for this employee")

    # 3) Download from Drive
    from drive import _get_drive_service  # type: ignore

    drive_svc = _get_drive_service()

    # Retrieve mimeType first
    meta = drive_svc.files().get(fileId=photo_file_id, fields="mimeType,name").execute()
    mime_type = meta.get("mimeType", "application/octet-stream")

    # Download the file content into memory (photos are small)
    fh: io.BytesIO = io.BytesIO()
    request = drive_svc.files().get_media(fileId=photo_file_id)
    downloader = MediaIoBaseDownload(fh, request)
    done = False
    while not done:
        status, done = downloader.next_chunk()
    fh.seek(0)

    return StreamingResponse(fh, media_type=mime_type)

# ---------------------------------------------------------------------------
# Create holiday endpoint
# ---------------------------------------------------------------------------


@app.post("/holidays/")
async def create_holiday(payload: HolidayCreate):
    # Duplicate check
    date_str = payload.date.strftime("%d-%m-%Y")
    if find_holiday(payload.name, date_str):
        raise HTTPException(400, "Holiday already exists")

    append_holiday(payload.dict())
    return {"status": "holiday added"}


# ---------------------------------------------------------------------------
# Holiday list endpoint
# ---------------------------------------------------------------------------


@app.get("/holidays/")
async def get_holidays():
    return list_holidays()


# ---------------------------------------------------------------------------
# Holiday update endpoint
# ---------------------------------------------------------------------------


@app.put("/holidays/{name}/{date}")
async def edit_holiday(name: str, date: str, payload: HolidayUpdate):
    # date in path expected dd-mm-yyyy
    from sheets import find_holiday_row  # import inside to avoid circular
    if not find_holiday_row(name, date):
        raise HTTPException(404, "Holiday not found")

    update_holiday(name, date, payload.dict(exclude_none=True))
    return {"status": "holiday updated"}


# ---------------------------------------------------------------------------
# Holiday delete endpoint
# ---------------------------------------------------------------------------


@app.delete("/holidays/{name}/{date}")
async def remove_holiday(name: str, date: str):
    from sheets import find_holiday_row
    if not find_holiday_row(name, date):
        raise HTTPException(404, "Holiday not found")

    delete_holiday(name, date)
    return {"status": "holiday deleted"}

# ---------------------------------------------------------------------------
# Leave request endpoints
# ---------------------------------------------------------------------------





@app.get("/leaves/")
async def get_leaves():
    return list_leaves()

@app.post("/leaves/")
async def request_leave(payload: LeaveCreate):
    # Duplicate prevention: same employee + applied_date (today)
    applied_str = payload.applied_date.strftime("%d-%m-%Y")
    if find_leave_row(payload.employee, applied_str):
        raise HTTPException(400, "Leave request already exists for today")

    # Append to sheet
    row = append_leave(payload.dict())
    return {"row": row, "status": payload.status.value.lower()}


@app.patch("/leaves/{employee}/{applied_date}")
async def decide_leave(employee: str, applied_date: str, payload: LeaveUpdate):
    # applied_date expects dd-mm-yyyy
    row = find_leave_row(employee, applied_date)
    if not row:
        raise HTTPException(404, "Leave request not found")

    # Update status in the sheet
    update_leave_status(employee, applied_date, payload.status.value)

    # ------------------------------------------------------------------
    # Send email notification to the employee
    # ------------------------------------------------------------------
    try:
        # Fetch leave details for the row we just updated
        from sheets import _get_sheets_service, SPREADSHEET_ID, LEAVE_APPROVAL_SHEET_NAME, SHEET_NAME, find_employee_row  # type: ignore

        svc = _get_sheets_service()

        # Row numbers are 1-based
        leave_resp = svc.values().get(
            spreadsheetId=SPREADSHEET_ID,
            range=f"'{LEAVE_APPROVAL_SHEET_NAME}'!B{row}:F{row}"
        ).execute()

        leave_vals = leave_resp.get("values", [[]])[0]
        padded = leave_vals + ["", "", "", "", ""]
        emp_email, leave_type, duration, applied_dt, status_val = padded[:5]

        # Fetch employee name from Employee sheet
        emp_row = find_employee_row(emp_email)
        emp_name = emp_email  # fallback to email if name not found
        if emp_row:
            emp_resp = svc.values().get(
                spreadsheetId=SPREADSHEET_ID,
                range=f"{SHEET_NAME}!C{emp_row}"
            ).execute()
            row_vals = emp_resp.get("values", [[]])
            if row_vals and row_vals[0]:
                emp_name = row_vals[0][0]

        # Send email
        send_leave_status_email(
            to_email=emp_email,
            employee_name=emp_name,
            leave_type=leave_type,
            duration=duration,
            status=status_val or payload.status.value,
        )
    except Exception as exc:
        # Log but don't fail the API if email fails.
        print(f"[WARN] Failed to send leave status email: {exc}")

    return {"row": row, "status": payload.status.value}

# ---------------------------------------------------------------------------
# Leave Statistics endpoints
# ---------------------------------------------------------------------------

@app.get("/leaves/statistics")
async def get_leave_statistics():
    """Get overall leave statistics including most requested type, approval rate, and peak month."""
    leaves = list_leaves()
    
    if not leaves:
        return {
            "most_requested": None,
            "approval_rate": 0,
            "peak_month": None
        }

    # Calculate most requested leave type
    leave_types = [leave["leave_type"] for leave in leaves]
    type_counter = Counter(leave_types)
    most_requested = type_counter.most_common(1)[0][0] if type_counter else None

    # Calculate approval rate
    total_decided = sum(1 for leave in leaves if leave["status"].lower() in ["accepted", "denied"])
    total_approved = sum(1 for leave in leaves if leave["status"].lower() == "accepted")
    approval_rate = (total_approved / total_decided * 100) if total_decided > 0 else 0

    # Calculate peak month
    month_counter = Counter()
    for leave in leaves:
        try:
            # Convert dd-mm-yyyy to datetime
            from_date = datetime.strptime(leave["from_date"], "%d-%m-%Y")
            month_counter[from_date.strftime("%B")] += 1
        except (ValueError, KeyError):
            continue
    
    peak_month = month_counter.most_common(1)[0][0] if month_counter else None

    return {
        "most_requested": most_requested,
        "approval_rate": round(approval_rate, 1),
        "peak_month": peak_month
    }

@app.get("/leaves/department-breakdown")
async def get_department_breakdown():
    """Get leave distribution by department."""
    leaves = list_leaves()
    employees = list_employees()
    
    if not leaves or not employees:
        return []

    # Create email to department mapping
    email_to_dept = {emp["email"]: emp["department"] for emp in employees}
    
    # Count leaves by department
    dept_counter = defaultdict(int)
    total_leaves = 0
    
    for leave in leaves:
        dept = email_to_dept.get(leave["employee"])
        if dept:
            dept_counter[dept] += 1
            total_leaves += 1

    # Calculate percentages
    if total_leaves > 0:
        breakdown = [
            {
                "department": dept,
                "percentage": round((count / total_leaves) * 100, 1)
            }
            for dept, count in dept_counter.items()
        ]
    else:
        breakdown = []

    # Sort by percentage descending
    breakdown.sort(key=lambda x: x["percentage"], reverse=True)
    
    return breakdown

# ---------------------------------------------------------------------------
# Document request endpoint
# ---------------------------------------------------------------------------


@app.post("/documents/")
async def request_document(payload: DocumentRequest):
    """Employees submit a request for an official document.

    The request is appended to the ``Documents`` sheet. Initial status is *Pending*.
    Returns the new row number and status.
    """
    try:
        from sheets import append_document_request  # type: ignore
        row = append_document_request(payload.dict())
        return {"row": row, "status": "pending"}
    except Exception as exc:
        raise HTTPException(500, str(exc))

# List document requests (admin or user-facing)


@app.get("/documents/")
async def get_document_requests():
    """Return all document requests from the Documents sheet."""
    try:
        from sheets import list_document_requests  # type: ignore
        return list_document_requests()
    except Exception as exc:
        raise HTTPException(500, str(exc))

# ---------------------------------------------------------------------------
# Employee update: profile photo (employee-facing)
# ---------------------------------------------------------------------------


@app.put("/employees/{email}/photo")
async def update_profile_photo(email: str, photo: UploadFile = File(...)):
    """Allow an employee to replace their profile photo.

    1) Find the employee row via email.
    2) Locate (or create) the 'Profile Photo' subfolder in Drive.
    3) Delete the existing photo file (if any).
    4) Upload the new photo and update column H in the sheet.
    """

    # Find employee row
    row = find_employee_row(email)
    if not row:
        raise HTTPException(404, "Employee not found")

    # Fetch existing photo file id and base folder id from sheet
    from sheets import _get_sheets_service, SPREADSHEET_ID, SHEET_NAME  # type: ignore

    svc = _get_sheets_service()
    resp = svc.values().get(
        spreadsheetId=SPREADSHEET_ID,
        range=f"{SHEET_NAME}!H{row}:I{row}"
    ).execute()
    vals = resp.get("values", [[]])
    photo_file_id = vals[0][0] if vals and len(vals[0]) > 0 else None
    base_folder_id = vals[0][1] if vals and len(vals[0]) > 1 else None

    if not base_folder_id:
        raise HTTPException(500, "Employee Drive folder not set for this employee")

    # Ensure we have profile photo folder
    profile_folder_id = _get_or_create_profile_folder(base_folder_id)

    # Delete old photo (ignore if missing)
    if photo_file_id:
        delete_drive_file(photo_file_id)

    # Upload new photo
    new_photo_id = upload_photo(photo, profile_folder_id)

    # Update sheet column H with new photo id
    svc.values().update(
        spreadsheetId=SPREADSHEET_ID,
        range=f"{SHEET_NAME}!H{row}",
        valueInputOption="RAW",
        body={"values": [[new_photo_id]]}
    ).execute()

    return {"status": "photo updated", "photo_file_id": new_photo_id}


# ---------------------------------------------------------------------------
# Timesheet endpoints
# ---------------------------------------------------------------------------

@app.post("/timesheets/")
async def create_timesheet_entry(payload: TimesheetEntryCreate):
    """Employee submits a new timesheet entry."""
    try:
        row = append_timesheet_entry(payload.dict())
        return {"row": row, "status": "created"}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

@app.get("/timesheets/")
async def get_timesheet_entries(
    employee: str | None = None,
    start_date: str | None = None,  # dd-mm-yyyy
    end_date: str | None = None,  # dd-mm-yyyy
    project: str | None = None,
):
    """Return timesheet entries with optional filters."""
    from datetime import datetime
    def _parse(d: str | None):
        if d:
            return datetime.strptime(d, "%d-%m-%Y").date()
        return None
    start_dt = _parse(start_date)
    end_dt = _parse(end_date)
    try:
        return list_timesheets(
            employee=employee,
            start_date=start_dt,
            end_date=end_dt,
            project=project,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

@app.delete("/timesheets/{row_id}")
async def delete_timesheet_entry_endpoint(row_id: str):
    """Delete a single timesheet entry by row id."""
    try:
        deleted = delete_timesheet_entry(row_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Entry not found")
        return {"status": "deleted", "row": row_id}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

@app.delete("/projects/{project_name}")
async def delete_project_and_entries(project_name: str):
    """
    Delete all timesheet entries for a given project (case-insensitive) from the sheet.
    """
    try:
        deleted_count = delete_project_entries(project_name)
        return {"status": "deleted", "deleted_count": deleted_count}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

@app.get("/timesheets/summary")
async def get_timesheet_summary(employee: str, period: str = "week"):
    """Return aggregated summary (hours per project) for current week/month."""
    today = date.today()
    period = period.lower()
    from datetime import timedelta
    if period == "week":
        start = today - timedelta(days=today.weekday())
        end = start + timedelta(days=6)
    elif period == "month":
        start = today.replace(day=1)
        from calendar import monthrange
        end = today.replace(day=monthrange(today.year, today.month)[1])
    else:
        raise HTTPException(status_code=400, detail="Invalid period")
    try:
        return summarize_timesheets(employee, start, end)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

@app.post("/timesheets/reminders/send")
async def send_timesheet_reminders(target_date: str | None = None):
    # Not implemented
    return {"status": "not implemented"}

@app.post("/documents/{row}/file")
async def upload_completed_document(row: int, file: UploadFile = File(...)):
    """Admin uploads completed document for a request identified by its sheet row number."""
    # Fetch request row to get employee email
    from sheets import _get_sheets_service, SPREADSHEET_ID, DOCUMENTS_SHEET_NAME, SHEET_NAME  # type: ignore
    svc = _get_sheets_service()
    resp = svc.values().get(
        spreadsheetId=SPREADSHEET_ID,
        range=f"'{DOCUMENTS_SHEET_NAME}'!B{row}:B{row}",
    ).execute()
    vals = resp.get("values", [[]])
    if not vals or not vals[0]:
        raise HTTPException(404, "Document request not found")
    email = vals[0][0]

    # Find employee folder id from employee sheet
    emp_row = find_employee_row(email)
    if not emp_row:
        raise HTTPException(404, "Employee not found")
    emp_resp = svc.values().get(
        spreadsheetId=SPREADSHEET_ID,
        range=f"{SHEET_NAME}!I{emp_row}:I{emp_row}",
    ).execute()
    folder_id = emp_resp.get("values", [[]])[0][0] if emp_resp.get("values") else None
    if not folder_id:
        raise HTTPException(500, "Employee Drive folder missing")

    # Ensure Documents subfolder
    docs_folder_id = _get_or_create_documents_folder(folder_id)

    # Upload file
    file_id = upload_file_to_folder(file, docs_folder_id)

    # Update sheet status to Completed and store file id
    from sheets import complete_document_request  # type: ignore
    complete_document_request(row, file_id)

    return {"status": "uploaded", "file_id": file_id}

@app.get("/employee/documents/{email}")
async def list_employee_documents(email: str):
    """List all documents in an employee's Drive folder."""
    import logging
    logger = logging.getLogger(__name__)
    
    logger.info(f"Listing documents for employee: {email}")
    
    # Find employee row to get folder ID
    row = find_employee_row(email)
    if not row:
        logger.error(f"Employee not found: {email}")
        raise HTTPException(404, "Employee not found")
    
    logger.info(f"Found employee at row: {row}")
    
    # Get folder ID from sheet
    from sheets import _get_sheets_service, SPREADSHEET_ID, SHEET_NAME
    svc = _get_sheets_service()
    resp = svc.values().get(
        spreadsheetId=SPREADSHEET_ID,
        range=f"{SHEET_NAME}!I{row}:I{row}"
    ).execute()
    vals = resp.get("values", [[]])
    folder_id = vals[0][0] if vals and len(vals[0]) > 0 else None
    
    logger.info(f"Retrieved folder ID: {folder_id}")
    
    if not folder_id:
        logger.error(f"Employee folder not found for {email}")
        raise HTTPException(404, "Employee folder not found")
    
    # List documents from Drive
    from drive import list_employee_documents
    try:
        logger.info("Calling list_employee_documents...")
        documents = list_employee_documents(folder_id)
        logger.info(f"Found {len(documents)} documents")
        return documents
    except Exception as e:
        logger.error(f"Failed to list documents: {str(e)}")
        raise HTTPException(500, f"Failed to list documents: {str(e)}")

@app.get("/employee/documents/{email}/{file_id}/view")
async def view_document(email: str, file_id: str):
    """Get a view URL for a document."""
    # Verify employee exists
    if not find_employee_row(email):
        raise HTTPException(404, "Employee not found")
    
    # Return Google Drive viewer URL
    return {
        "url": f"https://drive.google.com/file/d/{file_id}/view"
    }

@app.get("/employee/documents/{email}/{file_id}/download")
async def download_document(email: str, file_id: str):
    """Download a document directly from Drive."""
    # Verify employee exists
    if not find_employee_row(email):
        raise HTTPException(404, "Employee not found")
    
    try:
        # Get Drive service
        from drive import _get_drive_service
        service = _get_drive_service()
        
        # Get file metadata first to get the filename and mime type
        file_metadata = service.files().get(fileId=file_id, fields="name,mimeType").execute()
        
        # Create request to download the file
        request = service.files().get_media(fileId=file_id)
        file_stream = io.BytesIO()
        downloader = MediaIoBaseDownload(file_stream, request)
        
        # Download the file
        done = False
        while not done:
            _, done = downloader.next_chunk()
        
        # Reset stream position
        file_stream.seek(0)
        
        # Return the file as a streaming response
        return StreamingResponse(
            file_stream,
            media_type=file_metadata['mimeType'],
            headers={
                'Content-Disposition': f'attachment; filename="{file_metadata["name"]}"'
            }
        )
        
    except Exception as e:
        logger.exception("Failed to download file")
        raise HTTPException(500, f"Failed to download file: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
