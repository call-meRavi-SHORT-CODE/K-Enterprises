from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from sheets import append_employee, update_ids, update_employee, delete_employee, find_employee_row, list_employees
from drive import upload_photo
from fastapi.middleware.cors import CORSMiddleware
from models import EmployeeUpdate
import logging

# Timesheet helpers
from datetime import date, datetime, timedelta

# Email utility
#from drive import delete_drive_file
#from collections import Counter, defaultdict

logger = logging.getLogger(__name__)

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
    profile_photo: UploadFile = File(None)
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

    # 2) Upload the photo to the shared profile folder (if provided)
    photo_id = None
    if profile_photo:
        try:
            photo_id = upload_photo(profile_photo)
            # 3) Update the sheet with photo ID
            if photo_id:
                update_ids(row_no, photo_id)
        except Exception as e:
            logger.warning(f"Failed to upload profile photo: {e}")
            # Continue without photo - employee is already created

    return {
        "row": row_no,
        "photo_file_id": photo_id,
        "status": "success",
        "message": "Employee created successfully"
    }


# ---------------------------------------------------------------------------
# Update employee endpoint
# ---------------------------------------------------------------------------


@app.put("/employees/{email}")
async def edit_employee(email: str, payload: EmployeeUpdate):
    # Find the existing row
    row = find_employee_row(email)
    if not row:
        raise HTTPException(404, "Employee not found")

    # Update row in Sheets
    update_employee(email, payload.dict(exclude_none=True))

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

    # Delete row in Sheets and get photo_file_id
    result = delete_employee(email)
    photo_file_id = result.get("photo_file_id")

    # Delete profile photo from Drive if it exists
    if photo_file_id:
        from drive import delete_drive_file
        try:
            delete_drive_file(photo_file_id)
        except Exception as e:
            # Log error but don't fail the delete operation
            logger.warning(f"Failed to delete profile photo {photo_file_id}: {e}")

    return {"status": "deleted", "row": result["row"], "photo_deleted": photo_file_id is not None}

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
    from sheets import _get_sheets_service, SPREADSHEET_ID, _get_actual_sheet_name  # type: ignore

    svc_sheets = _get_sheets_service()
    actual_sheet_name = _get_actual_sheet_name()
    resp = svc_sheets.values().get(
        spreadsheetId=SPREADSHEET_ID,
        range=f"{actual_sheet_name}!H{row}:H{row}"
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
