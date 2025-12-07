# Project-App Backend

This project provides a RESTful backend built with **FastAPI** that manages employee data, public holidays and leave approvals, storing records in Google Sheets and files in Google Drive.  It can also send e-mail notifications via the Gmail API.

---

## 1. Prerequisites

| Item | Notes |
|------|-------|
| **Python 3.9 or newer** | Recommended: 3.10+ |
| **Google Cloud Project** | Enable: *Google Sheets API*, *Google Drive API*, *Gmail API* |
| **OAuth 2.0 Client ID** | Download the `client_secret_….json` file and place it in `backend/` |
| **Spreadsheet** | Create a Google Sheet and update `backend/config.py` → `SPREADSHEET_ID`, `SHEET_NAME`, etc. |
| **Drive root folder** | An existing Drive folder ID that will contain employee folders; set `DRIVE_ROOT_FOLDER` in `config.py`. |

> The first time you run the server it will open a browser window to complete OAuth consent.  A `backend/token.json` file will be generated and cached for subsequent runs.

---

## 2. Quick start

```bash
# Clone & enter the repo
$ git clone <your-repo-url>
$ cd Project-App/backend

# Create and activate a virtual environment (macOS/Linux)
$ python -m venv .venv
$ source .venv/bin/activate

# On Windows (PowerShell)
# python -m venv .venv ; .venv\Scripts\Activate.ps1

# Install dependencies
$ pip install fastapi uvicorn "google-api-python-client>=2.86.0" \
               google-auth google-auth-oauthlib google-auth-httplib2 \
               python-multipart pydantic

# Run the development server (reload on code change)
$ uvicorn main:app --reload
```

The API will now be live at **http://localhost:8000**.

---

## 3. Interactive API docs

FastAPI automatically serves Swagger UI at:

```
http://localhost:8000/docs   # Swagger UI
http://localhost:8000/redoc  # ReDoc alternative
```

Use these UIs to explore endpoints, send test requests and view models.

---

## 4. Useful endpoints (backend/main.py)

| Method | Path | Purpose |
|--------|------|---------|
| POST   | `/employees/` | Create an employee & Drive folders |
| PUT    | `/employees/{email}` | Update core employee fields |
| PUT    | `/employees/{email}/photo` | **Employee-side** – replace profile photo |
| DELETE | `/employees/{email}` | Remove employee & Drive folder |
| POST   | `/holidays/` | Add a public holiday |
| PATCH  | `/leaves/{employee}/{applied_date}` | Approve / reject leave & send email |

---

## 5. Running in production

Use a production ASGI server such as **gunicorn** with `uvicorn.workers.UvicornWorker`:

```bash
pip install gunicorn

gunicorn -k uvicorn.workers.UvicornWorker main:app -b 0.0.0.0:8000 --workers 4
```

Behind a reverse proxy (e.g. Nginx) you may also terminate TLS and forward traffic to gunicorn.

---

## 6. Troubleshooting

• **OAuth scope errors** – delete `backend/token.json` and restart; the consent screen will ask for the new scopes.

• **E-mail not arriving** – check Gmail "Sent" folder, Spam folders, and domain filters; the backend logs ‘[EMAIL] …’ on success / failure.

• **Drive / Sheets permissions** – ensure the Google account you authorised has access to the target Spreadsheet and Drive folder.

---

Happy coding! 🎉 