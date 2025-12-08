"""
Configuration settings for Google Sheets and Drive integration.
"""
import os
from pathlib import Path
from dotenv import load_dotenv


# Load .env file
load_dotenv()

# Base directory
BASE_DIR = Path(__file__).resolve().parent.parent

# Google OAuth Credentials Path (for token generation)
OAUTH_CLIENT_PATH = BASE_DIR / "data" / "oauth_client.json"

# Google OAuth Credentials (from .env)
GOOGLE_OAUTH_CLIENT_ID = os.getenv("GOOGLE_OAUTH_CLIENT_ID", "")
GOOGLE_OAUTH_CLIENT_SECRET = os.getenv("GOOGLE_OAUTH_CLIENT_SECRET", "")
GOOGLE_OAUTH_REFRESH_TOKEN = os.getenv("GOOGLE_OAUTH_REFRESH_TOKEN", "")

# Google Sheet and Drive IDs
# TODO: Replace these with your actual IDs from Google Drive URLs
# https://docs.google.com/spreadsheets/d/15Pjd_QwNm-P7tIRePhWP7xlGwKqpDrssEn-pwZZcWug/edit?usp=drive_link
# https://drive.google.com/drive/folders/1WgIBopRwEVGglb9shwvE9oS1n72WEla1?usp=sharing
# https://drive.google.com/drive/folders/1raXMZmd3APVGfGuNPNaHGrjzbL3nEikg?usp=drive_link
SHEET_ID = os.getenv("GOOGLE_SHEET_ID", "")
ROOT_FOLDER_ID = os.getenv("GOOGLE_ROOT_FOLDER_ID", "")
PROFILE_FOLDER_ID = os.getenv("GOOGLE_PROFILE_FOLDER_ID", "")

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
API_TITLE = "Kokila Enterprises"
API_VERSION = "1.0.0"

