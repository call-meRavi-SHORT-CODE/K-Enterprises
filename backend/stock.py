"""
Stock Module - SQLite backed

Handles all stock tracking operations using SQLite database.
"""

import logging
from typing import Optional, List, Dict, Any
from database import (
    get_stock,
    list_all_stock,
    get_low_stock_alerts
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def get_stock(product_id: int) -> float:
    """Get current stock for a product"""
    from database import get_stock as db_get_stock
    try:
        stock = db_get_stock(product_id)
        return stock
    except Exception as e:
        logger.error(f"Failed to get stock for product {product_id}: {e}")
        return 0.0


def list_all_stock() -> List[Dict[str, Any]]:
    """List all stock entries"""
    try:
        stock_entries = list_all_stock()
        return stock_entries
    except Exception as e:
        logger.error(f"Failed to list stock: {e}")
        return []


def get_low_stock_alerts() -> List[Dict[str, Any]]:
    """Get products below reorder point"""
    try:
        alerts = get_low_stock_alerts()
        return alerts
    except Exception as e:
        logger.error(f"Failed to get low stock alerts: {e}")
        return []
