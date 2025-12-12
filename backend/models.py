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


# Product models
class ProductCreate(BaseModel):
    name: str
    quantity_with_unit: str  # Combined format: "1kg", "500g", "2pack", etc.
    price_per_unit: float
    reorder_point: int | None = None


class ProductUpdate(BaseModel):
    name: str | None = None
    quantity_with_unit: str | None = None
    price_per_unit: float | None = None
    reorder_point: int | None = None

