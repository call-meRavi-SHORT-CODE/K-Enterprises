"""
FastAPI entry point for Kokila Enterprises ERP System.
"""
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import EmailStr
import logging
from typing import Optional

from config.settings import API_TITLE, API_VERSION
from services.sheets_service import get_last_employee_id, append_employee_row
from services.drive_service import upload_profile_photo
from services.utils import generate_next_employee_id, format_date

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(title=API_TITLE, version=API_VERSION)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "status": "success",
        "message": "Kokila Enterprises API is running",
        "version": API_VERSION
    }


@app.post("/add-employee")
async def add_employee(
    name: str = Form(...),
    email: EmailStr = Form(...),
    position: str = Form(...),
    department: str = Form(...),
    contact: str = Form(...),
    joining_date: str = Form(...),
    profile_photo: Optional[UploadFile] = File(None)
):
    """
    Add a new employee to the system.
    
    Steps:
    1. Get last employee ID from Google Sheet
    2. Generate new employee ID
    3. Upload profile photo to Google Drive (if provided)
    4. Append employee data to Google Sheet
    5. Return success response
    """
    try:
        # Step 1: Get last employee ID
        logger.info("Fetching last employee ID from Google Sheet...")
        last_empid = get_last_employee_id()
        
        # Step 2: Generate new employee ID
        new_empid = generate_next_employee_id(last_empid)
        logger.info(f"Generated new employee ID: {new_empid}")
        
        # Step 3: Upload profile photo (if provided)
        photo_uploaded = False
        if profile_photo:
            logger.info(f"Uploading profile photo for {new_empid}...")
            file_content = await profile_photo.read()
            upload_profile_photo(file_content, profile_photo.filename, new_empid)
            photo_uploaded = True
        
        # Step 4: Format joining date
        formatted_date = format_date(joining_date)
        
        # Step 5: Prepare employee data row
        employee_data = [
            new_empid,
            name,
            email,
            position,
            department,
            contact,
            formatted_date
        ]
        
        # Step 6: Append to Google Sheet
        logger.info(f"Appending employee data to Google Sheet...")
        append_employee_row(employee_data)
        
        # Step 7: Return success response
        return {
            "status": "success",
            "empid": new_empid,
            "photo_uploaded": photo_uploaded,
            "message": f"Employee {new_empid} added successfully"
        }
        
    except FileNotFoundError as e:
        logger.error(f"Configuration error: {e}")
        raise HTTPException(
            status_code=500,
            detail="Server configuration error. Please ensure credentials.json is set up correctly."
        )
    except Exception as e:
        logger.error(f"Error adding employee: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to add employee: {str(e)}"
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

