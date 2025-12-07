import logging
from fastapi import UploadFile
from auth import get_credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload
from config import DRIVE_ROOT_FOLDER

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def _get_drive_service():
    creds = get_credentials()
    return build("drive", "v3", credentials=creds)

def setup_employee_folders(email: str) -> dict:
    """
    Creates:
      /Company Documents/Employees/{email}/
        - Profile Photo
        - Payslips
        - Documents
    Returns dict with keys 'base' and 'photo'.
    """
    svc = _get_drive_service()

    # 1) Create base employee folder
    try:
        resp = svc.files().create(
            body={
                "name": email,
                "mimeType": "application/vnd.google-apps.folder",
                "parents": [DRIVE_ROOT_FOLDER]
            },
            fields="id"
        ).execute()
        base_id = resp["id"]
        logger.info(f"Created employee folder: {base_id}")
    except Exception:
        logger.exception("Failed to create base folder")
        raise

    # 2) Create subfolders
    def _mk(name):
        r = svc.files().create(
            body={"name": name, "mimeType": "application/vnd.google-apps.folder", "parents": [base_id]},
            fields="id"
        ).execute()
        logger.info(f"  Created subfolder {name}: {r['id']}")
        return r["id"]

    photo_id    = _mk("Profile Photo")
    _mk("Payslips")
    _mk("Documents")

    return {"base": base_id, "photo": photo_id}

def upload_photo(file: UploadFile, folder_id: str) -> str:
    svc = _get_drive_service()
    try:
        media = MediaIoBaseUpload(file.file, mimetype=file.content_type)
        resp = svc.files().create(
            body={"name": file.filename, "parents": [folder_id]},
            media_body=media,
            fields="id"
        ).execute()
        logger.info(f"Uploaded photo {file.filename}: {resp['id']}")
        return resp['id']
    except Exception:
        logger.exception("Failed to upload profile photo")
        raise


# ---------------------------------------------------------------------------
# Helpers for editing / deleting employee folders
# ---------------------------------------------------------------------------


def rename_employee_folder(folder_id: str, new_email: str):
    """Rename the employee's base Drive folder to match the new email."""
    svc = _get_drive_service()
    try:
        svc.files().update(fileId=folder_id, body={"name": new_email}).execute()
        logger.info(f"Renamed folder {folder_id} to {new_email}")
    except Exception:
        logger.exception("Failed to rename employee folder")
        raise


def delete_employee_folder(folder_id: str):
    """Delete the employee base folder (and its contents)."""
    svc = _get_drive_service()
    try:
        svc.files().delete(fileId=folder_id).execute()
        logger.info(f"Deleted folder {folder_id}")
    except Exception:
        logger.exception("Failed to delete employee folder")
        raise


# ---------------------------------------------------------------------------
# Photo update helpers
# ---------------------------------------------------------------------------


def _get_or_create_profile_folder(base_folder_id: str) -> str:
    """Return the id of the 'Profile Photo' subfolder inside base_folder_id, creating it if absent."""
    svc = _get_drive_service()

    # 1) Search for existing folder
    query = (
        f"'{base_folder_id}' in parents and "
        "mimeType = 'application/vnd.google-apps.folder' and "
        "trashed = false and name = 'Profile Photo'"
    )
    resp = svc.files().list(q=query, spaces="drive", fields="files(id, name)").execute()
    files = resp.get("files", [])
    if files:
        return files[0]["id"]

    # 2) Create if not found
    create_resp = svc.files().create(
        body={
            "name": "Profile Photo",
            "mimeType": "application/vnd.google-apps.folder",
            "parents": [base_folder_id],
        },
        fields="id",
    ).execute()
    new_id = create_resp["id"]
    logger.info(f"Created missing 'Profile Photo' folder: {new_id}")
    return new_id


def _get_or_create_documents_folder(base_folder_id: str) -> str:
    """Return id of 'Documents' subfolder, creating if absent."""
    svc = _get_drive_service()
    query = (
        f"'{base_folder_id}' in parents and "
        "mimeType = 'application/vnd.google-apps.folder' and "
        "trashed = false and name = 'Documents'"
    )
    resp = svc.files().list(q=query, spaces="drive", fields="files(id, name)").execute()
    files = resp.get("files", [])
    if files:
        return files[0]["id"]
    create_resp = svc.files().create(
        body={
            "name": "Documents",
            "mimeType": "application/vnd.google-apps.folder",
            "parents": [base_folder_id],
        },
        fields="id",
    ).execute()
    return create_resp["id"]


def upload_file_to_folder(file: UploadFile, folder_id: str) -> str:
    """Upload any file to a Drive folder and return file ID."""
    svc = _get_drive_service()
    media = MediaIoBaseUpload(file.file, mimetype=file.content_type)
    resp = svc.files().create(
        body={"name": file.filename, "parents": [folder_id]},
        media_body=media,
        fields="id",
    ).execute()
    return resp["id"]


def delete_drive_file(file_id: str):
    """Delete a single file in Drive; ignore 404 errors."""
    svc = _get_drive_service()
    try:
        svc.files().delete(fileId=file_id).execute()
        logger.info(f"Deleted file {file_id}")
    except Exception as exc:
        # Ignore not found; else raise
        if hasattr(exc, "status") and getattr(exc, "status", None) == 404:
            logger.warning(f"File {file_id} already gone")
        else:
            logger.exception("Failed to delete file")
            raise


def list_employee_documents(base_folder_id: str) -> list:
    """List all documents in an employee's Documents folder."""
    svc = _get_drive_service()
    logger.info(f"Listing documents for base folder: {base_folder_id}")
    
    # Get Documents folder ID
    docs_folder_id = _get_or_create_documents_folder(base_folder_id)
    logger.info(f"Documents folder ID: {docs_folder_id}")
    
    # List files in Documents folder
    query = (
        f"'{docs_folder_id}' in parents and "
        "trashed = false"
    )
    logger.info(f"Using query: {query}")
    
    try:
        results = []
        page_token = None
        while True:
            logger.info("Fetching page of results...")
            response = svc.files().list(
                q=query,
                spaces="drive",
                fields="nextPageToken, files(id, name, mimeType, size, createdTime, modifiedTime)",
                pageToken=page_token
            ).execute()
            
            files = response.get('files', [])
            logger.info(f"Found {len(files)} files in this page")
            
            for file in files:
                logger.info(f"Processing file: {file['name']} ({file['id']})")
                results.append({
                    'id': file['id'],
                    'name': file['name'],
                    'type': file['mimeType'],
                    'size': file.get('size', '0'),  # in bytes
                    'created': file['createdTime'],
                    'modified': file['modifiedTime']
                })
                
            page_token = response.get('nextPageToken')
            if not page_token:
                break
                
        logger.info(f"Total documents found: {len(results)}")
        return results
        
    except Exception as e:
        logger.exception(f"Failed to list employee documents: {str(e)}")
        raise
