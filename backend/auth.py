import pickle
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from config import CREDENTIALS_FILE, TOKEN_FILE, SCOPES


def _scopes_missing(creds) -> bool:
    """Return True if the credentials are missing any required scopes."""
    if creds is None:
        return True
    if creds.scopes is None:
        
        return False  # None usually indicates all scopes; assume ok
    return not set(SCOPES).issubset(set(creds.scopes))


def get_credentials():
    creds = None

    # Load existing token if available
    if TOKEN_FILE.exists():
        with open(TOKEN_FILE, "rb") as token:
            creds = pickle.load(token)

    # Determine if we need to re-authenticate
    missing_scopes = _scopes_missing(creds)

    if not creds or not creds.valid or missing_scopes:
        # If only expired (and scopes are sufficient) → refresh; else full flow
        if creds and creds.expired and creds.refresh_token and not missing_scopes:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(
                CREDENTIALS_FILE, SCOPES
            )
            # Force fixed port to match Google Cloud registered redirect URI
            creds = flow.run_local_server(port=8080)

        # Save the (new/refreshed) credentials for future use
        with open(TOKEN_FILE, "wb") as token:
            pickle.dump(creds, token)

    return creds

