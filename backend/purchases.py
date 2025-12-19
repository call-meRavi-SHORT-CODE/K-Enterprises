"""
Purchases Module - SQLite backed

Handles all purchase order operations using SQLite database.
"""

import logging
from typing import Optional, List, Dict, Any
from database import (
    create_purchase as db_create_purchase,
    get_purchase_by_id,
    list_all_purchases,
    update_purchase as db_update_purchase,
    delete_purchase as db_delete_purchase
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def create_purchase(vendor_name: str, invoice_number: str, purchase_date: str,
                   items_data: List[Dict[str, Any]], notes: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Create a new purchase order"""
    try:
        result = db_create_purchase(
            vendor_name=vendor_name,
            invoice_number=invoice_number,
            purchase_date=purchase_date,
            items_data=items_data,
            notes=notes
        )
        logger.info(f"Purchase created: {invoice_number}")
        return result
    except Exception as e:
        logger.error(f"Failed to create purchase: {e}")
        raise


def find_purchase_row(purchase_id: int) -> Optional[int]:
    """Find purchase by ID"""
    purchase = get_purchase_by_id(purchase_id)
    return purchase["id"] if purchase else None


def list_purchases() -> List[Dict[str, Any]]:
    """List all purchases"""
    try:
        purchases = list_all_purchases()
        return purchases
    except Exception as e:
        logger.error(f"Failed to list purchases: {e}")
        return []


def update_purchase(purchase_id: int, updates: Dict[str, Any]) -> bool:
    """Update purchase"""
    try:
        result = db_update_purchase(purchase_id, updates)
        logger.info(f"Purchase {purchase_id} updated")
        return result
    except Exception as e:
        logger.error(f"Failed to update purchase {purchase_id}: {e}")
        return False


def delete_purchase(purchase_id: int) -> bool:
    """Delete purchase"""
    try:
        result = db_delete_purchase(purchase_id)
        logger.info(f"Purchase {purchase_id} deleted")
        return result
    except Exception as e:
        logger.error(f"Failed to delete purchase {purchase_id}: {e}")
        return False
