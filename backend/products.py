"""
Products Module - SQLite backed

Handles all product CRUD operations using SQLite database.
"""

import logging
import re
from typing import Optional, List, Dict, Any
from database import (
    create_product as db_create_product,
    get_product_by_id,
    update_product as db_update_product,
    delete_product as db_delete_product,
    list_all_products,
    get_db_connection
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def parse_quantity_with_unit(quantity_with_unit: str) -> tuple[float, str]:
    """
    Parse combined quantity_with_unit string (e.g., '1kg', '500g', '2pack')
    into (quantity, unit).
    
    Returns:
        tuple: (quantity: float, unit: str)
    """
    match = re.match(r'^(\d+\.?\d*)\s*([a-zA-Z]+)$', quantity_with_unit.strip())
    if not match:
        raise ValueError(f"Invalid quantity format: {quantity_with_unit}. Expected format like '1kg', '500g'")
    quantity = float(match.group(1))
    unit = match.group(2).lower()
    return quantity, unit


def format_quantity_with_unit(quantity: float | int, unit: str) -> str:
    """
    Format quantity and unit into combined string (e.g., '1kg', '500g').
    
    Returns:
        str: Combined format
    """
    if isinstance(quantity, float) and quantity.is_integer():
        quantity = int(quantity)
    return f"{quantity}{unit}"


def append_product(data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Create a new product"""
    try:
        result = db_create_product(
            name=data["name"],
            quantity_with_unit=data["quantity_with_unit"],
            purchase_unit_price=data["purchase_unit_price"],
            sales_unit_price=data["sales_unit_price"],
            reorder_point=data.get("reorder_point")
        )
        logger.info(f"Product created: {data['name']} (ID: {result['id']})")
        return result
    except Exception as e:
        logger.error(f"Failed to create product: {e}")
        return None


def find_product_row(product_id: int) -> Optional[int]:
    """Find product row number by ID"""
    product = get_product_by_id(product_id)
    return product["id"] if product else None


def update_product(product_id: int, updates: Dict[str, Any]) -> bool:
    """Update product"""
    try:
        result = db_update_product(product_id, updates)
        logger.info(f"Product {product_id} updated")
        return result
    except Exception as e:
        logger.error(f"Failed to update product {product_id}: {e}")
        return False


def delete_product(product_id: int) -> bool:
    """Delete product"""
    try:
        result = db_delete_product(product_id)
        logger.info(f"Product {product_id} deleted")
        return result
    except Exception as e:
        logger.error(f"Failed to delete product {product_id}: {e}")
        return False


def list_products() -> List[Dict[str, Any]]:
    """List all products"""
    try:
        products = list_all_products()
        return products
    except Exception as e:
        logger.error(f"Failed to list products: {e}")
        return []
