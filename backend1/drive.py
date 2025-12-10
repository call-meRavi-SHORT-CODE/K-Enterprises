import logging
from fastapi import UploadFile
from auth import get_credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload, MediaFileUpload
from googleapiclient.errors import HttpError
from config import PROFILE_FOLDER_ID
import threading
import time
import io

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

def upload_photo(file: UploadFile, max_retries: int = 3) -> str:
    """Upload a photo to Google Drive with retry logic and chunked upload.
    
    Args:
        file: The file to upload
        max_retries: Maximum number of retry attempts
        
    Returns:
        File ID of the uploaded file
    """
    svc = _get_drive_service()
    
    for attempt in range(max_retries):
        try:
            # Read file content into memory
            file.file.seek(0)
            file_content = file.file.read()
            file_bytes = io.BytesIO(file_content)
            
            # Use chunked upload for better reliability (256KB chunks)
            media = MediaIoBaseUpload(
                file_bytes,
                mimetype=file.content_type or 'application/octet-stream',
                resumable=True,
                chunksize=256 * 1024  # 256KB chunks
            )
            
            request = svc.files().create(
                body={"name": file.filename, "parents": [PROFILE_FOLDER_ID]},
                media_body=media,
                fields="id"
            )
            
            # Execute with exponential backoff
            resp = request.execute()
            logger.info(f"Uploaded photo {file.filename}: {resp['id']}")
            return resp['id']
            
        except HttpError as e:
            logger.warning(f"Upload attempt {attempt + 1}/{max_retries} failed with HttpError: {e.resp.status}")
            if e.resp.status == 403:  # Quota exceeded, don't retry
                logger.error("Google Drive quota exceeded")
                raise
            if attempt < max_retries - 1:
                wait_time = (2 ** attempt)  # Exponential backoff: 1s, 2s, 4s
                logger.info(f"Retrying in {wait_time}s...")
                time.sleep(wait_time)
            else:
                raise
                
        except (ConnectionAbortedError, ConnectionError, BrokenPipeError) as e:
            logger.warning(f"Upload attempt {attempt + 1}/{max_retries} failed with connection error: {e}")
            if attempt < max_retries - 1:
                wait_time = (2 ** attempt)
                logger.info(f"Retrying in {wait_time}s...")
                time.sleep(wait_time)
            else:
                logger.error(f"Failed to upload profile photo after {max_retries} attempts")
                raise
                
        except Exception as e:
            logger.exception(f"Unexpected error during upload attempt {attempt + 1}")
            if attempt == max_retries - 1:
                raise
            time.sleep(2 ** attempt)
    
    raise RuntimeError(f"Failed to upload {file.filename} after {max_retries} attempts")


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
