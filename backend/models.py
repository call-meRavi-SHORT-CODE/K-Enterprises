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
    unit: str  # kg, g, pack, pc, liter
    current_quantity: int
    default_cost_price: float
    default_selling_price: float
    reorder_point: int | None = None


class ProductUpdate(BaseModel):
    name: str | None = None
    unit: str | None = None
    current_quantity: int | None = None
    default_cost_price: float | None = None
    default_selling_price: float | None = None
    reorder_point: int | None = None

