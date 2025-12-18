import logging
from auth import get_credentials
from googleapiclient.discovery import build
from config import SPREADSHEET_ID
import re
import threading

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Constants
STOCK_SHEET_NAME = "Stock"

# Cache for service
_sheets_service_cache = None
_sheets_service_lock = threading.Lock()


def _get_sheets_service():
    global _sheets_service_cache
    with _sheets_service_lock:
        if _sheets_service_cache is not None:
            return _sheets_service_cache
        creds = get_credentials()
        _sheets_service_cache = build("sheets", "v4", credentials=creds, cache_discovery=False).spreadsheets()
        return _sheets_service_cache


def _ensure_stock_sheet_exists():
    """Ensure the Stock sheet exists with proper headers."""
    svc = _get_sheets_service()
    try:
        meta = svc.get(spreadsheetId=SPREADSHEET_ID).execute()
        sheet_titles = [s["properties"]["title"] for s in meta.get("sheets", [])]
        
        if STOCK_SHEET_NAME not in sheet_titles:
            logger.info(f"Creating {STOCK_SHEET_NAME} sheet...")
            svc.batchUpdate(
                spreadsheetId=SPREADSHEET_ID,
                body={"requests": [{"addSheet": {"properties": {"title": STOCK_SHEET_NAME}}}]}
            ).execute()
            
            # Add headers
            svc.values().update(
                spreadsheetId=SPREADSHEET_ID,
                range=f"{STOCK_SHEET_NAME}!A:C",
                valueInputOption="USER_ENTERED",
                body={"values": [["product_id", "product_name", "available_stock"]]}
            ).execute()
            logger.info(f"Created {STOCK_SHEET_NAME} sheet with headers")
    except Exception as e:
        logger.exception(f"Failed to ensure stock sheet exists: {e}")


def get_stock(product_id: int) -> float:
    """
    Get available stock for a product.
    
    Args:
        product_id: Product ID
        
    Returns:
        Available stock (numeric, no unit) or 0 if not found
    """
    _ensure_stock_sheet_exists()
    svc = _get_sheets_service()
    
    try:
        resp = svc.values().get(
            spreadsheetId=SPREADSHEET_ID,
            range=f"{STOCK_SHEET_NAME}!A:C"
        ).execute()
        rows = resp.get("values", [])
        
        # Skip header row
        for row in rows[1:]:
            if len(row) >= 3:
                try:
                    row_product_id = int(row[0]) if row[0] else None
                    if row_product_id == product_id:
                        available_stock = float(row[2]) if row[2] else 0.0
                        return available_stock
                except (ValueError, TypeError):
                    continue
        
        return 0.0
    except Exception as e:
        logger.exception(f"Failed to get stock for product {product_id}: {e}")
        return 0.0


def update_stock(product_id: int, product_name: str, quantity_change: float) -> float:
    """
    Update stock for a product (add or subtract).
    
    Args:
        product_id: Product ID
        product_name: Product name
        quantity_change: Quantity to add (positive) or subtract (negative)
        
    Returns:
        New available stock
    """
    _ensure_stock_sheet_exists()
    svc = _get_sheets_service()
    
    try:
        resp = svc.values().get(
            spreadsheetId=SPREADSHEET_ID,
            range=f"{STOCK_SHEET_NAME}!A:C"
        ).execute()
        rows = resp.get("values", [])
        
        # Find existing row
        row_index = None
        for idx, row in enumerate(rows[1:], start=2):  # Start from row 2 (skip header)
            if len(row) >= 1:
                try:
                    row_product_id = int(row[0]) if row[0] else None
                    if row_product_id == product_id:
                        row_index = idx
                        break
                except (ValueError, TypeError):
                    continue
        
        if row_index:
            # Update existing row
            current_stock = float(rows[row_index - 1][2]) if len(rows[row_index - 1]) >= 3 and rows[row_index - 1][2] else 0.0
            new_stock = max(0.0, current_stock + quantity_change)  # Ensure non-negative
            
            svc.values().update(
                spreadsheetId=SPREADSHEET_ID,
                range=f"{STOCK_SHEET_NAME}!A{row_index}:C{row_index}",
                valueInputOption="USER_ENTERED",
                body={"values": [[product_id, product_name, new_stock]]}
            ).execute()
            
            logger.info(f"Updated stock for product {product_id}: {current_stock} + {quantity_change} = {new_stock}")
            return new_stock
        else:
            # Add new row
            new_stock = max(0.0, quantity_change)  # Ensure non-negative
            svc.values().append(
                spreadsheetId=SPREADSHEET_ID,
                range=f"{STOCK_SHEET_NAME}!A:C",
                valueInputOption="USER_ENTERED",
                insertDataOption="INSERT_ROWS",
                body={"values": [[product_id, product_name, new_stock]]}
            ).execute()
            
            logger.info(f"Added stock for product {product_id}: {new_stock}")
            return new_stock
            
    except Exception as e:
        logger.exception(f"Failed to update stock for product {product_id}: {e}")
        raise


def list_all_stock() -> list[dict]:
    """
    List all stock entries.
    
    Returns:
        List of dicts with product_id, product_name, available_stock
    """
    _ensure_stock_sheet_exists()
    svc = _get_sheets_service()
    
    try:
        resp = svc.values().get(
            spreadsheetId=SPREADSHEET_ID,
            range=f"{STOCK_SHEET_NAME}!A:C"
        ).execute()
        rows = resp.get("values", [])
        
        stock_list = []
        for row in rows[1:]:  # Skip header
            if len(row) >= 3:
                try:
                    product_id = int(row[0]) if row[0] else None
                    product_name = row[1] if row[1] else ""
                    available_stock = float(row[2]) if row[2] else 0.0
                    
                    if product_id is not None:
                        stock_list.append({
                            "product_id": product_id,
                            "product_name": product_name,
                            "available_stock": available_stock
                        })
                except (ValueError, TypeError) as e:
                    logger.warning(f"Failed to parse stock row: {row} - {e}")
                    continue
        
        return stock_list
    except Exception as e:
        logger.exception(f"Failed to list stock: {e}")
        return []


def get_low_stock_alerts() -> list[dict]:
    """
    Get products that are below their reorder point (low stock alert).
    Uses Stock sheet as the primary source for stock values.
    
    Returns:
        List of dicts with product_id, product_name, available_stock, reorder_point, shortage
    """
    from products import list_products
    
    try:
        # Get all products with their reorder points
        products = list_products()
        
        # Get stock from Stock sheet (primary source - most reliable)
        stock_list = list_all_stock()
        stock_map = {item["product_id"]: item["available_stock"] for item in stock_list}
        
        # Log for debugging if stock_map is empty
        if not stock_map:
            logger.warning("Stock map is empty - Stock sheet may be unavailable or empty")
        
        # Check for low stock
        low_stock_alerts = []
        for product in products:
            product_id = product.get("id")
            reorder_point = product.get("reorder_point")
            
            # Skip if no reorder point is set
            if reorder_point is None or reorder_point <= 0:
                continue
            
            # Get current stock from Stock sheet (same source as table)
            current_stock = stock_map.get(product_id, 0.0)
            
            # Debug log for products with reorder points
            if product_id not in stock_map:
                logger.debug(f"Product {product_id} ({product.get('name', '')}) not found in Stock sheet, using 0.0")
            
            # Check if stock is below reorder point
            if current_stock < reorder_point:
                low_stock_alerts.append({
                    "product_id": product_id,
                    "product_name": product.get("name", ""),
                    "available_stock": current_stock,
                    "reorder_point": reorder_point,
                    "shortage": reorder_point - current_stock
                })
        
        # Sort by shortage (most critical first)
        low_stock_alerts.sort(key=lambda x: x["shortage"], reverse=True)
        
        return low_stock_alerts
    except Exception as e:
        logger.exception(f"Failed to get low stock alerts: {e}")
        return []

