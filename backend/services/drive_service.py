"""
Google Drive Service for uploading profile photos.
"""
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaFileUpload, MediaIoBaseUpload
from io import BytesIO
import logging
from PIL import Image

from config.auth import get_drive_service
from config.settings import PROFILE_FOLDER_ID

logger = logging.getLogger(__name__)


def upload_profile_photo(file_content: bytes, filename: str, empid: str) -> bool:
    """
    Upload profile photo to Google Drive profile folder.
    
    Args:
        file_content: Binary content of the image file
        filename: Original filename
        empid: Employee ID to use as filename (e.g., "KP013")
    
    Returns:
        bool: True if successful
    """
    try:
        service = get_drive_service()
        
        # Convert image to PNG if needed
        image = Image.open(BytesIO(file_content))
        
        # Convert to RGB if necessary (handles RGBA, P, etc.)
        if image.mode in ("RGBA", "P"):
            rgb_image = Image.new("RGB", image.size, (255, 255, 255))
            if image.mode == "RGBA":
                rgb_image.paste(image, mask=image.split()[3])  # Use alpha channel as mask
            else:
                rgb_image.paste(image)
            image = rgb_image
        
        # Convert to PNG format
        png_buffer = BytesIO()
        image.save(png_buffer, format="PNG")
        png_buffer.seek(0)
        
        # Prepare file metadata
        file_metadata = {
            "name": f"{empid}.png",
            "parents": [PROFILE_FOLDER_ID]
        }
        
        # Create media upload object
        media = MediaIoBaseUpload(
            png_buffer,
            mimetype="image/png",
            resumable=True
        )
        
        # Upload file
        file = service.files().create(
            body=file_metadata,
            media_body=media,
            fields="id"
        ).execute()
        
        logger.info(f"Profile photo uploaded successfully: {empid}.png (File ID: {file.get('id')})")
        return True
        
    except HttpError as error:
        logger.error(f"Error uploading to Google Drive: {error}")
        raise
    except Exception as error:
        logger.error(f"Unexpected error uploading to Google Drive: {error}")
        raise

