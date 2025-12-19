"""
Stock Ledger Module - SQLite backed

Handles all stock ledger operations using SQLite database.
"""

import logging
from typing import Optional, List, Dict, Any
from database import (
    list_ledger_entries,
    get_current_balance,
    get_opening_stock,
    get_closing_stock
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def list_ledger_entries(product_id: Optional[int] = None, limit: int = 100) -> List[Dict[str, Any]]:
    """List stock ledger entries"""
    try:
        entries = list_ledger_entries(product_id=product_id, limit=limit)
        return entries
    except Exception as e:
        logger.error(f"Failed to list ledger entries: {e}")
        return []


def get_current_balance(product_id: int) -> float:
    """Get current stock balance for product"""
    try:
        balance = get_current_balance(product_id)
        return balance
    except Exception as e:
        logger.error(f"Failed to get current balance for product {product_id}: {e}")
        return 0.0


def get_opening_stock(product_id: int, year: int, month: int) -> float:
    """Get opening stock for a month"""
    try:
        opening = get_opening_stock(product_id, year, month)
        return opening
    except Exception as e:
        logger.error(f"Failed to get opening stock for product {product_id}: {e}")
        return 0.0


def get_closing_stock(product_id: int, year: int, month: int) -> float:
    """Get closing stock for a month"""
    try:
        closing = get_closing_stock(product_id, year, month)
        return closing
    except Exception as e:
        logger.error(f"Failed to get closing stock for product {product_id}: {e}")
        return 0.0
