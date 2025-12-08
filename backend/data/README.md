# Credentials Setup

## Place Your Service Account Key Here

1. Download your service account JSON key from Google Cloud Console
2. Rename it to `credentials.json`
3. Place it in this `data/` folder

**Important:** This file contains sensitive credentials and should NEVER be committed to version control.

The file structure should look like:

```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "your-service-account@your-project.iam.gserviceaccount.com",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "..."
}
```

## Setup Steps

1. Go to Google Cloud Console → IAM & Admin → Service Accounts
2. Create a service account (or use existing)
3. Create a JSON key for the service account
4. Download the JSON file
5. Place it here as `credentials.json`

