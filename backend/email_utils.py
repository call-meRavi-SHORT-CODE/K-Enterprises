import base64
from datetime import datetime
from email.mime.text import MIMEText
from typing import Optional

from googleapiclient.discovery import build

from auth import get_credentials
from config import SPREADSHEET_ID, SHEET_NAME


def _build_gmail_service():
    """Return an authorized Gmail API service instance."""
    creds = get_credentials()
    return build("gmail", "v1", credentials=creds)


def _parse_duration(duration: str) -> tuple[Optional[str], Optional[str]]:
    """Attempt to split a duration string into (start_date, end_date) strings.

    Accepts formats like "dd-mm-yyyy to dd-mm-yyyy" or "yyyy-mm-dd to yyyy-mm-dd".
    Returns (None, None) if parsing fails.
    """
    if not duration:
        return None, None

    lower = duration.lower()
    if "to" in lower:
        parts = [p.strip() for p in lower.split("to", 1)]
        if len(parts) == 2 and parts[0] and parts[1]:
            return parts[0], parts[1]
    return None, None


def send_leave_status_email(
    to_email: str,
    employee_name: str,
    leave_type: str,
    duration: str,
    status: str,
    admin_name: str = "Admin",
    admin_position: str = "HR Manager",
):
    """Compose and send a leave request status email to the employee.

    Args:
        to_email: Recipient's email address.
        employee_name: Recipient's full name.
        leave_type: Type of leave (e.g., Sick Leave).
        duration: Duration string; attempts to parse start & end dates.
        status: Leave status string (Accepted / Denied).
        admin_name: Name to show in closing.
        admin_position: Position/title to show in closing.
    """
    start_date, end_date = _parse_duration(duration)

    # Build email body
    subject = f"Leave Request - {status}"

    lines: list[str] = [
        f"Dear {employee_name},",
        "",
        f"This is to inform you that your leave request has been **{status}**.",
        "",
        "Here are the details of your leave request:",
        f"- **Employee Email:** {to_email}",
        f"- **Leave Type:** {leave_type}",
    ]

    if start_date:
        lines.append(f"- **Start Date:** {start_date}")
    if end_date:
        lines.append(f"- **End Date:** {end_date}")

    lines.append(f"- **Leave Status:** {status}")
    lines.extend(
        [
            "",
            "Please plan your work accordingly. Let us know if you have any further queries.",
            "",
            "Thank you.",
            "",
            "Best regards,",
            f"{admin_name}",
            f"{admin_position}",
        ]
    )

    body = "\n".join(lines)

    message = MIMEText(body, "plain")
    message["to"] = to_email
    message["subject"] = subject

    raw = base64.urlsafe_b64encode(message.as_bytes()).decode()

    service = _build_gmail_service()
    try:
        response = service.users().messages().send(userId="me", body={"raw": raw}).execute()
        msg_id = response.get("id")
        print(f"[EMAIL] Sent leave status email to {to_email} – Gmail ID {msg_id}")
    except Exception as exc:
        print(f"[EMAIL] FAILED to send to {to_email}: {exc}") 


# ---------------------------------------------------------------------------
# Timesheet reminder email helper
# ---------------------------------------------------------------------------


def send_timesheet_reminder_email(to_email: str, target_date: str):
    """Send a reminder email to the employee to fill their timesheet for target_date.

    Args:
        to_email: Recipient's email address.
        target_date: Date string in dd-mm-yyyy format representing the day that
            does not yet have a timesheet entry.
    """

    subject = "Timesheet Reminder – Action Required"

    body_lines = [
        f"Dear Employee,",
        "",
        f"Our records indicate that you have not submitted your timesheet for {target_date}.",
        "Please complete your timesheet as soon as possible to ensure accurate project tracking and billing.",
        "",
        "If you have already filled in your timesheet, kindly ignore this message.",
        "",
        "Thank you for your prompt attention.",
        "",
        "Best regards,",
        "HR / Admin Team",
    ]

    message = MIMEText("\n".join(body_lines), "plain")
    message["to"] = to_email
    message["subject"] = subject

    raw = base64.urlsafe_b64encode(message.as_bytes()).decode()

    service = _build_gmail_service()
    try:
        response = service.users().messages().send(userId="me", body={"raw": raw}).execute()
        msg_id = response.get("id")
        print(f"[EMAIL] Sent timesheet reminder to {to_email} – Gmail ID {msg_id}")
    except Exception as exc:
        print(f"[EMAIL] FAILED to send reminder to {to_email}: {exc}") 