"""
Google Authentication and Service Creation.
"""
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from pathlib import Path
import logging

from config.settings import CREDENTIALS_PATH, SCOPES

logger = logging.getLogger(__name__)


def get_google_credentials():
    """
    Load service account credentials from JSON file.
    
    Returns:
        google.oauth2.service_account.Credentials: Authenticated credentials
    """
    if not CREDENTIALS_PATH.exists():
        raise FileNotFoundError(
            f"Credentials file not found at {CREDENTIALS_PATH}. "
            "Please download your service account key and place it in data/credentials.json"
        )
    
    credentials = service_account.Credentials.from_service_account_file(
        str(CREDENTIALS_PATH),
        scopes=SCOPES
    )
    
    return credentials


def get_sheets_service():
    """
    Create and return Google Sheets API service client.
    
    Returns:
        googleapiclient.discovery.Resource: Sheets API service
    """
    try:
        creds = get_google_credentials()
        service = build("sheets", "v4", credentials=creds)
        logger.info("Google Sheets service created successfully")
        return service
    except HttpError as error:
        logger.error(f"Error creating Sheets service: {error}")
        raise
    except Exception as error:
        logger.error(f"Unexpected error creating Sheets service: {error}")
        raise


def get_drive_service():
    """
    Create and return Google Drive API service client.
    
    Returns:
        googleapiclient.discovery.Resource: Drive API service
    """
    try:
        creds = get_google_credentials()
        service = build("drive", "v3", credentials=creds)
        logger.info("Google Drive service created successfully")
        return service
    except HttpError as error:
        logger.error(f"Error creating Drive service: {error}")
        raise
    except Exception as error:
        logger.error(f"Unexpected error creating Drive service: {error}")
        raise

