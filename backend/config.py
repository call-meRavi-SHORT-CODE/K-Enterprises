import os
from pathlib import Path

BASE = Path(__file__).parent
CREDENTIALS_FILE = BASE / "google_cred.json"
TOKEN_FILE       = BASE / "token.json"
EMPLOYEES_SHEET_NAME = "Employee"
SPREADSHEET_ID     = "1nu-gLOt-oxYqHxsBKgZLRlg2gPtxHpvMyxC7vU9fT4w"
SHEET_NAME         = "Employee"
PUBLIC_HOLIDAYS_SHEET_NAME = "PublicHoliday"
LEAVE_APPROVAL_SHEET_NAME = "LeaveApproval"
DOCUMENTS_SHEET_NAME = "Documents"
TIMESHEET_SHEET_NAME = "Timesheet"
WORKING_TIMESHEET_SHEET_NAME = "WorkingTimeSheet"
DRIVE_ROOT_FOLDER  = "1ez41e3mGE20CZj97840q69Oxe3fs3mlp"
SCOPES = [
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/gmail.send"
]
