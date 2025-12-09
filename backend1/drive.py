import logging
from fastapi import UploadFile
from auth import get_credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload
from config import PROFILE_FOLDER_ID
import threading

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Cache for Drive service
_drive_service_cache = None
_drive_service_lock = threading.Lock()

def _get_drive_service():
    """Get cached Drive service or create new one. Thread-safe."""
    global _drive_service_cache
    
    with _drive_service_lock:
        if _drive_service_cache is not None:
            return _drive_service_cache
        
        creds = get_credentials()
        _drive_service_cache = build("drive", "v3", credentials=creds, cache_discovery=False)
        return _drive_service_cache

def upload_photo(file: UploadFile) -> str:
    svc = _get_drive_service()
    try:
        media = MediaIoBaseUpload(file.file, mimetype=file.content_type)
        resp = svc.files().create(
            body={"name": file.filename, "parents": [PROFILE_FOLDER_ID]},
            media_body=media,
            fields="id"
        ).execute()
        logger.info(f"Uploaded photo {file.filename}: {resp['id']}")
        return resp['id']
    except Exception:
        logger.exception("Failed to upload profile photo")
        raise


def delete_drive_file(file_id: str):
    """Delete a file from Google Drive by its file ID."""
    svc = _get_drive_service()
    try:
        svc.files().delete(fileId=file_id).execute()
        logger.info(f"Deleted file {file_id} from Drive")
    except Exception as exc:
        # Ignore 404 errors (file already deleted)
        if hasattr(exc, "status") and getattr(exc, "status", None) == 404:
            logger.warning(f"File {file_id} already deleted or not found")
        else:
            logger.exception(f"Failed to delete file {file_id}")
            raise


# ---------------------------------------------------------------------------
# All folder-management helpers removed; only profile photo upload is kept.
