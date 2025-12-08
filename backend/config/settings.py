"""
Configuration settings for Google Sheets and Drive integration.
"""
import os
from pathlib import Path

# Base directory
BASE_DIR = Path(__file__).resolve().parent.parent

# Google Service Account Credentials Path
CREDENTIALS_PATH = BASE_DIR / "data" / "credentials.json"

# Google Sheet and Drive IDs
# TODO: Replace these with your actual IDs from Google Drive URLs
SHEET_ID = os.getenv("GOOGLE_SHEET_ID", "YOUR_SHEET_ID_HERE")
ROOT_FOLDER_ID = os.getenv("GOOGLE_ROOT_FOLDER_ID", "YOUR_ROOT_FOLDER_ID_HERE")
PROFILE_FOLDER_ID = os.getenv("GOOGLE_PROFILE_FOLDER_ID", "YOUR_PROFILE_FOLDER_ID_HERE")

# Google Sheet Configuration
SHEET_NAME = "employees"  # Name of the sheet tab
EMPLOYEE_ID_COLUMN = "A"  # Column for employee IDs
DATA_RANGE = f"{SHEET_NAME}!A:G"  # Range: A (empid) through G (joining_date)

# Google API Scopes
SCOPES = [
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/spreadsheets"
]

# FastAPI Configuration
API_TITLE = "Kokila Enterprises ERP API"
API_VERSION = "1.0.0"

