import os
from pathlib import Path

BASE = Path(__file__).parent
CREDENTIALS_FILE = BASE / "google_cred.json"
TOKEN_FILE       = BASE / "token.json"
EMPLOYEES_SHEET_NAME = "Employees"
PRODUCTS_SHEET_NAME = "Products"
SPREADSHEET_ID = "15Pjd_QwNm-P7tIRePhWP7xlGwKqpDrssEn-pwZZcWug"
SHEET_NAME           = "Employees"


SCOPES = [
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/gmail.send"
]

