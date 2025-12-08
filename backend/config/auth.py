"""
Google Authentication and Service Creation using OAuth Delegation.
"""
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
import logging
from google.auth.transport.requests import Request

from config.settings import (
    GOOGLE_OAUTH_CLIENT_ID,
    GOOGLE_OAUTH_CLIENT_SECRET,
    GOOGLE_OAUTH_REFRESH_TOKEN,
    SCOPES
)

logger = logging.getLogger(__name__)


def get_user_oauth_credentials():
    """
    Get OAuth credentials using refresh token.
    This uses YOUR Google account (not service account) to access Drive and Sheets.
    
    Returns:
        google.oauth2.credentials.Credentials: Authenticated credentials
    """
    if not GOOGLE_OAUTH_CLIENT_ID or not GOOGLE_OAUTH_CLIENT_SECRET or not GOOGLE_OAUTH_REFRESH_TOKEN:
        raise ValueError(
            "OAuth credentials not configured. Please set the following environment variables:\n"
            "- GOOGLE_OAUTH_CLIENT_ID\n"
            "- GOOGLE_OAUTH_CLIENT_SECRET\n"
            "- GOOGLE_OAUTH_REFRESH_TOKEN\n\n"
            "Run generate_token.py to generate the refresh token."
        )
    
    # Create credentials from refresh token
    creds = Credentials(
        token=None,  # Will be refreshed automatically
        refresh_token=GOOGLE_OAUTH_REFRESH_TOKEN,
        client_id=GOOGLE_OAUTH_CLIENT_ID,
        client_secret=GOOGLE_OAUTH_CLIENT_SECRET,
        token_uri="https://oauth2.googleapis.com/token",
        scopes=SCOPES
    )
    
    # Refresh the token if needed
    if not creds.valid:
        if creds.expired and creds.refresh_token:
            logger.info("Refreshing OAuth access token...")
            creds.refresh(Request())
            logger.info("Access token refreshed successfully")
        else:
            raise ValueError("Invalid OAuth credentials. Please regenerate tokens using generate_token.py")
    
    return creds


def get_sheets_service():
    """
    Create and return Google Sheets API service client using OAuth.
    
    Returns:
        googleapiclient.discovery.Resource: Sheets API service
    """
    try:
        creds = get_user_oauth_credentials()
        service = build("sheets", "v4", credentials=creds)
        logger.info("Google Sheets service created successfully (OAuth)")
        return service
    except HttpError as error:
        logger.error(f"Error creating Sheets service: {error}")
        raise
    except Exception as error:
        logger.error(f"Unexpected error creating Sheets service: {error}")
        raise


def get_drive_service():
    """
    Create and return Google Drive API service client using OAuth.
    Files will be owned by YOUR Google account (not service account).
    
    Returns:
        googleapiclient.discovery.Resource: Drive API service
    """
    try:
        creds = get_user_oauth_credentials()
        service = build("drive", "v3", credentials=creds)
        logger.info("Google Drive service created successfully (OAuth)")
        return service
    except HttpError as error:
        logger.error(f"Error creating Drive service: {error}")
        raise
    except Exception as error:
        logger.error(f"Unexpected error creating Drive service: {error}")
        raise

