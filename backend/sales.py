"""
Sales Module - SQLite backed

Handles all sales order operations using SQLite database.
"""

import logging
from typing import Optional, List, Dict, Any
from database import (
    create_sale as db_create_sale,
    get_sale_by_id,
    list_all_sales,
    delete_sale as db_delete_sale
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def create_sale(customer_name: str, invoice_number: str, sale_date: str,
               items_data: List[Dict[str, Any]], notes: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Create a new sale order"""
    try:
        result = db_create_sale(
            customer_name=customer_name,
            invoice_number=invoice_number,
            sale_date=sale_date,
            items_data=items_data,
            notes=notes
        )
        logger.info(f"Sale created: {invoice_number}")
        return result
    except Exception as e:
        logger.error(f"Failed to create sale: {e}")
        raise


def find_sale_row(sale_id: int) -> Optional[int]:
    """Find sale by ID"""
    sale = get_sale_by_id(sale_id)
    return sale["id"] if sale else None


def list_sales() -> List[Dict[str, Any]]:
    """List all sales"""
    try:
        sales = list_all_sales()
        return sales
    except Exception as e:
        logger.error(f"Failed to list sales: {e}")
        return []


def delete_sale(sale_id: int) -> bool:
    """Delete sale"""
    try:
        result = db_delete_sale(sale_id)
        logger.info(f"Sale {sale_id} deleted")
        return result
    except Exception as e:
        logger.error(f"Failed to delete sale {sale_id}: {e}")
        return False
