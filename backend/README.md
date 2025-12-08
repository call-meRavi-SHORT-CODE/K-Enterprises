# Kokila Enterprises ERP - Backend API

FastAPI backend with Google Sheets and Google Drive integration for employee management.

**Uses OAuth Delegation** - Files are uploaded to YOUR Google Drive (not service account), solving storage quota issues.

## 📁 Project Structure

```
backend/
├── main.py                 # FastAPI entry point
├── generate_token.py       # One-time script to generate OAuth tokens
├── config/
│   ├── settings.py         # Google credentials, paths, configs
│   └── auth.py             # Google OAuth auth + service creation
├── services/
│   ├── sheets_service.py   # Logic to read/write Google Sheets
│   ├── drive_service.py    # Logic to upload profile photos
│   └── utils.py            # Helper: autoincrement KP001 → KP002
├── data/
│   └── oauth_client.json   # OAuth client credentials (downloaded)
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

#### 2.3 Configure OAuth Consent Screen

**IMPORTANT:** This is required even for personal apps.

1. Go to **APIs & Services** → **OAuth consent screen**
2. Choose **User Type**: External
3. Fill in:
   - **App name**: K-Enterprises Backend
   - **Support email**: Your Gmail address
4. Click **Save and Continue**
5. **Add Scopes**:
   - Click **Add Scopes**
   - Add these scopes manually:
     - `https://www.googleapis.com/auth/drive`
     - `https://www.googleapis.com/auth/spreadsheets`
6. Click **Save and Continue**
7. **Add Test Users**:
   - Click **Add Users**
   - Add **YOUR Gmail account** (the one that owns your Google Drive)
   - Click **Add**
8. Click **Save and Continue** → **Back to Dashboard**

#### 2.4 Create OAuth Client ID

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth Client ID**
3. Choose **Application Type**: Desktop App
4. **Name**: K-Enterprises OAuth
5. Click **Create**
6. **Download the JSON file**
7. **Save it as**: `backend/data/oauth_client.json`

### Step 3: Generate OAuth Tokens (ONE TIME)

Run the token generation script:

```bash
cd backend
python generate_token.py
```

**What happens:**
1. A browser window opens
2. Sign in with **YOUR Google account** (the one that owns your Drive)
3. Click **Allow** to grant permissions
4. The script will display your tokens

**Copy these values** - you'll need them for Step 4.

### Step 4: Configure Environment Variables

Create a `.env` file in the `backend/` directory:

```bash
# Google Sheet and Drive IDs
GOOGLE_SHEET_ID=your_sheet_id_here
GOOGLE_ROOT_FOLDER_ID=your_root_folder_id_here
GOOGLE_PROFILE_FOLDER_ID=your_profile_folder_id_here

# OAuth Credentials (from generate_token.py output)
GOOGLE_OAUTH_CLIENT_ID=your_client_id_here
GOOGLE_OAUTH_CLIENT_SECRET=your_client_secret_here
GOOGLE_OAUTH_REFRESH_TOKEN=your_refresh_token_here
```

**⚠️ IMPORTANT:** Never commit `.env` to Git!

### Step 5: Get Folder and Sheet IDs

Extract IDs from URLs:

**For Google Sheet:**
```
https://docs.google.com/spreadsheets/d/<SHEET_ID>/edit
```

**For Folders:**
- Open the folder in Google Drive
- The URL contains the folder ID:
```
https://drive.google.com/drive/folders/<FOLDER_ID>
```

### Step 6: Prepare Google Sheet

Create a Google Sheet (can be named anything, e.g., "Sheet1" or "employees") with these columns:

| Column A | Column B | Column C | Column D | Column E | Column F | Column G |
|----------|----------|----------|----------|----------|----------|----------|
| Employee ID | Name | Email | Position | Department | Contact | Joining Date |

**Note:** The first row can be headers. The API will automatically detect and use the correct sheet tab.

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
- `joining_date` (string, required): Joining date (YYYY-MM-DD from date picker)
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
  -F "joining_date=2024-01-15" \
  -F "profile_photo=@/path/to/photo.jpg"
```

## 🔧 How It Works

1. **OAuth Authentication**: Uses YOUR Google account (not service account)
2. **Get Last Employee ID**: Reads the last row from Google Sheet
3. **Generate New ID**: Increments the ID (e.g., KP012 → KP013)
4. **Upload Photo**: Converts image to PNG and uploads to YOUR Google Drive
5. **Write to Sheet**: Appends new employee row to Google Sheet
6. **Return Response**: Returns success status with new employee ID

## ✅ Why OAuth Instead of Service Account?

- ✅ **No Storage Quota Issues**: Files are uploaded to YOUR Drive (not service account)
- ✅ **No Sharing Required**: Files are owned by you automatically
- ✅ **No Shared Drive Needed**: Works with regular Google Drive
- ✅ **Refresh Token Never Expires**: One-time setup, works forever
- ✅ **Automatic Token Refresh**: Backend handles token renewal automatically

## 🐛 Troubleshooting

### Error: "OAuth credentials not configured"
- Ensure `.env` file exists with all required OAuth variables
- Run `generate_token.py` if you haven't generated tokens yet

### Error: "Invalid OAuth credentials"
- Regenerate tokens using `generate_token.py`
- Make sure you're using the correct Gmail account (the one that owns your Drive)

### Error: "Permission denied" or "Insufficient permissions"
- Ensure OAuth consent screen is configured
- Add your Gmail as a test user
- Make sure required scopes are added

### Error: "Sheet ID not found"
- Check that `GOOGLE_SHEET_ID` in `.env` is correct
- Verify the sheet exists and is accessible

### Error: "Folder ID not found"
- Check that `GOOGLE_PROFILE_FOLDER_ID` in `.env` is correct
- Verify the folder exists in your Drive

### Error: "storageQuotaExceeded" (403)
- This should NOT happen with OAuth (only with service accounts)
- If you see this, verify you're using OAuth credentials, not service account

## 📝 Notes

- Employee IDs follow the format: `KP001`, `KP002`, etc.
- Profile photos are automatically converted to PNG format
- Dates from HTML date picker (YYYY-MM-DD) are converted to dd-mm-yyyy for Google Sheets
- The API automatically detects the correct sheet tab name
- Header rows are automatically skipped when reading employee IDs
- Refresh token never expires - you only need to authenticate once
- Access tokens are automatically refreshed by the backend

## 🔐 Security

- Never commit `.env` file to version control
- Never commit `oauth_client.json` to version control
- Keep your refresh token secure
- The refresh token allows access to your Google Drive and Sheets
