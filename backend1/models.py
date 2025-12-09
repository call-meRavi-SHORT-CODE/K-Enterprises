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

