import os
from pathlib import Path

BASE = Path(__file__).parent
CREDENTIALS_FILE = BASE / "google_cred.json"
TOKEN_FILE       = BASE / "token.json"
EMPLOYEES_SHEET_NAME = "Employees"
PRODUCTS_SHEET_NAME = "Products"
SPREADSHEET_ID = "15Pjd_QwNm-P7tIRePhWP7xlGwKqpDrssEn-pwZZcWug"
SHEET_NAME           = "Employees"

# Folder in Drive where all profile photos will be stored.
# Set this to the ID of /root_folder/profile
PROFILE_FOLDER_ID = "1WgIBopRwEVGglb9shwvE9oS1n72WEla1"

SCOPES = [
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/gmail.send"
]

