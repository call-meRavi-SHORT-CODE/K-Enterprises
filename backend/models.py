from pydantic import BaseModel, EmailStr
from datetime import date
from typing import Optional
from enum import Enum

class EmployeeCreate(BaseModel):
    email: EmailStr
    name: str
    position: str
    department: str
    contact: str
    joining_date: date


class EmployeeUpdate(BaseModel):
    # All fields optional; email can be updated; joining_date cannot be changed
    email: EmailStr | None = None
    name: str | None = None
    position: str | None = None
    department: str | None = None
    contact: str | None = None


class HolidayCreate(BaseModel):
    name: str
    date: date  # date of holiday
    type: str
    description: str | None = None
    recurring: bool = False


class HolidayUpdate(BaseModel):
    name: str | None = None
    date: Optional[date] = None
    type: str | None = None
    description: str | None = None
    recurring: bool | None = None


class LeaveStatus(str, Enum):
    PENDING = "Pending"
    ACCEPTED = "Accepted"
    DENIED = "Denied"


class LeaveCreate(BaseModel):
    employee: EmailStr
    leave_type: str
    from_date: date
    to_date: date
    duration: str
    applied_date: date
    reason: str | None = None
    status: LeaveStatus = LeaveStatus.PENDING


class LeaveUpdate(BaseModel):
    status: LeaveStatus


class DocumentRequest(BaseModel):
    """Payload model for /documents/ endpoint.

    Fields:
    - email: Employee email requesting the document
    - document_type: Type of document requested (e.g., Certificate, ID card)
    - reason: Optional justification for the request
    """
    email: EmailStr
    document_type: str
    reason: str | None = None

# ---------------------------------------------------------------------------
# Timesheet models
# ---------------------------------------------------------------------------


class TimesheetEntryCreate(BaseModel):
    """Model for creating a new timesheet entry."""

    employee: EmailStr
    date: date
    project: str
    task_description: str
    duration_hours: float  # Total hours worked (excluding breaks)
    break_minutes: int = 0  # Break duration in minutes (optional, default 0)
