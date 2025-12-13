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
    default_price: float | None = None  # Used for purchases/sales (defaults to price_per_unit if not set)
    reorder_point: int | None = None


class ProductUpdate(BaseModel):
    name: str | None = None
    quantity_with_unit: str | None = None
    price_per_unit: float | None = None
    default_price: float | None = None
    reorder_point: int | None = None


# Purchase models
class PurchaseItemCreate(BaseModel):
    product_id: int
    quantity: float
    unit_price: float | None = None  # Auto-filled from default_price, user can override


class PurchaseCreate(BaseModel):
    vendor_name: str
    invoice_number: str
    purchase_date: date
    notes: str | None = None
    items: list[PurchaseItemCreate]


class PurchaseItemResponse(BaseModel):
    id: int
    product_id: int
    product_name: str
    quantity: float
    unit_price: float
    total_price: float


class PurchaseResponse(BaseModel):
    id: int
    vendor_name: str
    invoice_number: str
    purchase_date: date
    total_amount: float
    notes: str | None = None
    items: list[PurchaseItemResponse]


# Sales models
class SaleItemCreate(BaseModel):
    product_id: int
    quantity: float
    unit_price: float | None = None


class SaleCreate(BaseModel):
    customer_name: str
    sale_date: date
    notes: str | None = None
    items: list[SaleItemCreate]


class SaleItemResponse(BaseModel):
    id: int
    product_id: int
    product_name: str
    quantity: float
    unit_price: float
    total_price: float


class SaleResponse(BaseModel):
    id: int
    customer_name: str
    sale_date: date
    total_amount: float
    notes: str | None = None
    items: list[SaleItemResponse]

