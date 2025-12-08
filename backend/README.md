# Kokila Enterprises ERP - Backend API

FastAPI backend with Google Sheets and Google Drive integration for employee management.

## 📁 Project Structure

```
backend/
├── main.py                 # FastAPI entry point
├── config/
│   ├── settings.py         # Google credentials, paths, configs
│   └── auth.py             # Google auth + service creation
├── services/
│   ├── sheets_service.py   # Logic to read/write Google Sheets
│   ├── drive_service.py    # Logic to upload profile photos
│   └── utils.py            # Helper: autoincrement KP001 → KP002
├── data/
│   └── credentials.json    # Service account key (downloaded)
├── requirements.txt
└── README.md
```

## 🚀 Setup Instructions

### Step 1: Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### Step 2: Google Cloud Setup

#### 2.1 Create Google Cloud Project

1. Visit [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (e.g., "Kokila-ERP-System")

#### 2.2 Enable APIs

Enable these 2 APIs in your project:

- **Google Drive API**
- **Google Sheets API**

To enable:
1. Go to **APIs & Services** → **Library**
2. Search for each API and click **Enable**

#### 2.3 Create Service Account

1. Go to **IAM & Admin** → **Service Accounts**
2. Click **Create Service Account**
3. Name it: `kokila-backend-sa`
4. Click **Create and Continue**
5. Skip role assignment (optional)
6. Click **Done**

#### 2.4 Create Service Account Key

1. Click on the created service account
2. Go to **Keys** tab
3. Click **Add Key** → **Create new key**
4. Select **JSON** format
5. Download the JSON file
6. **Place it in `backend/data/credentials.json`**

#### 2.5 Get Service Account Email

After creating the service account, note the email address:
```
xxxx@xxxx.iam.gserviceaccount.com
```

### Step 3: Google Drive Setup

#### 3.1 Create Folder Structure

In your Google Drive, create:

```
Kokila Enterprises/
│
├── employees (Google Sheet)
│
└── profile/            # For storing profile images
```

#### 3.2 Share with Service Account

**IMPORTANT:** Share these items with your service account email:

1. **Root folder**: `Kokila Enterprises`
2. **Google Sheet**: `employees`
3. **Profile folder**: `profile`

**Permission:** Editor

To share:
1. Right-click on the item
2. Click **Share**
3. Enter the service account email
4. Set permission to **Editor**
5. Click **Send**

#### 3.3 Get Folder and Sheet IDs

You need to extract IDs from URLs:

**For Google Sheet:**
```
https://docs.google.com/spreadsheets/d/<SHEET_ID>/edit
```

**For Folders:**
- Open the folder in Google Drive
- The URL will contain the folder ID:
```
https://drive.google.com/drive/folders/<FOLDER_ID>
```

### Step 4: Configure Settings

Edit `backend/config/settings.py` and update:

```python
SHEET_ID = "YOUR_SHEET_ID_HERE"
ROOT_FOLDER_ID = "YOUR_ROOT_FOLDER_ID_HERE"
PROFILE_FOLDER_ID = "YOUR_PROFILE_FOLDER_ID_HERE"
```

Or set them as environment variables:

```bash
export GOOGLE_SHEET_ID="your_sheet_id"
export GOOGLE_ROOT_FOLDER_ID="your_root_folder_id"
export GOOGLE_PROFILE_FOLDER_ID="your_profile_folder_id"
```

### Step 5: Prepare Google Sheet

Create a Google Sheet named `employees` with these columns:

| Column A | Column B | Column C | Column D | Column E | Column F | Column G |
|----------|----------|----------|----------|----------|----------|----------|
| Employee ID | Name | Email | Position | Department | Contact | Joining Date |

**Note:** The first row can be headers, but the API will append data starting from the next available row.

## 🏃 Running the Server

```bash
cd backend
uvicorn main:app --reload
```

The API will be available at: `http://localhost:8000`

API Documentation: `http://localhost:8000/docs`

## 📡 API Endpoints

### POST `/add-employee`

Add a new employee to the system.

**Request (multipart/form-data):**

- `name` (string, required): Employee name
- `email` (string, required): Employee email
- `position` (string, required): Job position
- `department` (string, required): Department
- `contact` (string, required): Contact number
- `joining_date` (string, required): Joining date (dd-mm-yyyy or yyyy-mm-dd)
- `profile_photo` (file, optional): Profile photo image

**Response:**

```json
{
  "status": "success",
  "empid": "KP013",
  "photo_uploaded": true,
  "message": "Employee KP013 added successfully"
}
```

**Example using curl:**

```bash
curl -X POST "http://localhost:8000/add-employee" \
  -F "name=John Doe" \
  -F "email=john.doe@example.com" \
  -F "position=Software Engineer" \
  -F "department=IT" \
  -F "contact=1234567890" \
  -F "joining_date=15-01-2024" \
  -F "profile_photo=@/path/to/photo.jpg"
```

## 🔧 How It Works

1. **Get Last Employee ID**: Reads the last row from Google Sheet to get the most recent employee ID
2. **Generate New ID**: Increments the ID (e.g., KP012 → KP013)
3. **Upload Photo**: Converts image to PNG and uploads to Google Drive profile folder
4. **Write to Sheet**: Appends new employee row to Google Sheet
5. **Return Response**: Returns success status with new employee ID

## 🐛 Troubleshooting

### Error: "Credentials file not found"
- Ensure `data/credentials.json` exists and contains your service account key

### Error: "Permission denied" or "Insufficient permissions"
- Verify that you've shared the Google Sheet and folders with the service account email
- Ensure the service account has **Editor** permission

### Error: "Sheet ID not found"
- Check that `SHEET_ID` in `settings.py` is correct
- Verify the sheet exists and is shared with the service account

### Error: "Folder ID not found"
- Check that `PROFILE_FOLDER_ID` in `settings.py` is correct
- Verify the folder exists and is shared with the service account

## 📝 Notes

- Employee IDs follow the format: `KP001`, `KP002`, etc.
- Profile photos are automatically converted to PNG format
- Dates are formatted as `dd-mm-yyyy` in the sheet
- The API handles empty sheets and will start with `KP001`

