"""
One-time script to generate OAuth refresh token and access token.

Run this script ONCE to authenticate and get your refresh token.
After running, add the refresh token to your .env file.

Usage:
    python generate_token.py
"""
from google_auth_oauthlib.flow import InstalledAppFlow
from pathlib import Path
import json

# Scopes required for Drive and Sheets access
SCOPES = [
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/spreadsheets"
]

# Path to OAuth client credentials
OAUTH_CLIENT_PATH = Path(__file__).parent / "data" / "oauth_client.json"

def main():
    print("=" * 60)
    print("OAuth Token Generator for K-Enterprises Backend")
    print("=" * 60)
    print()
    
    # Check if oauth_client.json exists
    if not OAUTH_CLIENT_PATH.exists():
        print(f"❌ Error: OAuth client file not found at {OAUTH_CLIENT_PATH}")
        print()
        print("Please follow these steps:")
        print("1. Go to Google Cloud Console → APIs & Services → Credentials")
        print("2. Create OAuth Client ID → Desktop App")
        print("3. Download the JSON file")
        print("4. Save it as: data/oauth_client.json")
        return
    
    print(f"✓ Found OAuth client file: {OAUTH_CLIENT_PATH}")
    print()
    print("A browser window will open. Please:")
    print("1. Sign in with YOUR Google account (the one that owns your Drive)")
    print("2. Click 'Allow' to grant permissions")
    print()
    input("Press Enter to continue...")
    print()
    
    try:
        # Create OAuth flow
        flow = InstalledAppFlow.from_client_secrets_file(
            str(OAUTH_CLIENT_PATH),
            SCOPES
        )
        
        # Run local server to handle OAuth callback
        creds = flow.run_local_server(port=0)
        
        print()
        print("=" * 60)
        print("✅ SUCCESS! Tokens generated successfully")
        print("=" * 60)
        print()
        
        # Read client secrets to get client_id and client_secret
        with open(OAUTH_CLIENT_PATH, 'r') as f:
            client_data = json.load(f)
            client_id = client_data.get('installed', {}).get('client_id', '')
            client_secret = client_data.get('installed', {}).get('client_secret', '')
        
        print("Add these to your .env file:")
        print("-" * 60)
        print(f"GOOGLE_OAUTH_CLIENT_ID={client_id}")
        print(f"GOOGLE_OAUTH_CLIENT_SECRET={client_secret}")
        print(f"GOOGLE_OAUTH_REFRESH_TOKEN={creds.refresh_token}")
        print("-" * 60)
        print()
        print("⚠️  IMPORTANT:")
        print("- Never commit these values to GitHub")
        print("- The refresh token never expires")
        print("- Access tokens are auto-refreshed by the backend")
        print()
        print("Your backend will now upload files to YOUR Google Drive!")
        print("=" * 60)
        
    except Exception as e:
        print()
        print("❌ Error generating tokens:")
        print(str(e))
        print()
        print("Make sure:")
        print("1. OAuth consent screen is configured")
        print("2. Your email is added as a test user")
        print("3. Required APIs are enabled (Drive API, Sheets API)")

if __name__ == "__main__":
    main()

