"""
Stock Ledger - Tracks all stock movements with running balances.
This is the heart of the inventory system for accurate stock tracking.
"""
import logging
from datetime import date, datetime, timedelta
from auth import get_credentials
from googleapiclient.discovery import build
from config import SPREADSHEET_ID
import re
import threading

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Constants
STOCK_LEDGER_SHEET_NAME = "Stock Ledger"

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


def _ensure_stock_ledger_sheet_exists():
    """Ensure the Stock Ledger sheet exists with proper headers."""
    svc = _get_sheets_service()
    try:
        meta = svc.get(spreadsheetId=SPREADSHEET_ID).execute()
        sheet_titles = [s["properties"]["title"] for s in meta.get("sheets", [])]
        
        if STOCK_LEDGER_SHEET_NAME not in sheet_titles:
            logger.info(f"Creating {STOCK_LEDGER_SHEET_NAME} sheet...")
            svc.batchUpdate(
                spreadsheetId=SPREADSHEET_ID,
                body={"requests": [{"addSheet": {"properties": {"title": STOCK_LEDGER_SHEET_NAME}}}]}
            ).execute()
            
            # Add headers
            svc.values().update(
                spreadsheetId=SPREADSHEET_ID,
                range=f"{STOCK_LEDGER_SHEET_NAME}!A:H",
                valueInputOption="USER_ENTERED",
                body={"values": [[
                    "id",
                    "product_id",
                    "transaction_type",
                    "transaction_id",
                    "quantity_in",
                    "quantity_out",
                    "balance_quantity",
                    "transaction_date",
                    "created_at"
                ]]}
            ).execute()
            logger.info(f"Created {STOCK_LEDGER_SHEET_NAME} sheet with headers")
    except Exception as e:
        logger.exception(f"Failed to ensure stock ledger sheet exists: {e}")


def _get_next_ledger_id() -> int:
    """Get the next available ledger ID."""
    _ensure_stock_ledger_sheet_exists()
    svc = _get_sheets_service()
    
    try:
        resp = svc.values().get(
            spreadsheetId=SPREADSHEET_ID,
            range=f"{STOCK_LEDGER_SHEET_NAME}!A:A"
        ).execute()
        rows = resp.get("values", [])
        
        max_id = 0
        for row in rows[1:]:  # Skip header
            if row and row[0]:
                try:
                    ledger_id = int(row[0]) if str(row[0]).isdigit() else 0
                    if ledger_id > max_id:
                        max_id = ledger_id
                except (ValueError, TypeError):
                    continue
        
        return max_id + 1
    except Exception as e:
        logger.exception(f"Failed to get next ledger ID: {e}")
        return 1


def _get_last_balance(product_id: int, before_date: date = None) -> float:
    """
    Get the last balance quantity for a product before a given date.
    If before_date is None, returns the most recent balance.
    
    Args:
        product_id: Product ID
        before_date: Optional date to get balance before this date
        
    Returns:
        Last balance quantity (0 if no previous entries)
    """
    _ensure_stock_ledger_sheet_exists()
    svc = _get_sheets_service()
    
    try:
        resp = svc.values().get(
            spreadsheetId=SPREADSHEET_ID,
            range=f"{STOCK_LEDGER_SHEET_NAME}!A:I"
        ).execute()
        rows = resp.get("values", [])
        
        last_balance = 0.0
        last_date = None
        
        for row in rows[1:]:  # Skip header
            if len(row) < 8:
                continue
            
            try:
                row_product_id = int(row[1]) if row[1] else None
                if row_product_id != product_id:
                    continue
                
                row_date_str = row[7] if len(row) > 7 and row[7] else None
                if not row_date_str:
                    continue
                
                # Parse date (could be ISO format or serial number)
                try:
                    if re.match(r"^\d{4}-\d{2}-\d{2}$", str(row_date_str).strip()):
                        row_date = datetime.strptime(row_date_str.strip(), "%Y-%m-%d").date()
                    else:
                        # Try to parse as serial number
                        n = int(float(row_date_str))
                        row_date = date(1899, 12, 30) + timedelta(days=n)
                except:
                    continue
                
                # Check if this entry is before the specified date
                if before_date and row_date >= before_date:
                    continue
                
                # Get balance quantity
                balance = float(row[6]) if len(row) > 6 and row[6] else 0.0
                
                # Keep track of the most recent entry
                if last_date is None or row_date > last_date:
                    last_date = row_date
                    last_balance = balance
                    
            except (ValueError, TypeError, IndexError) as e:
                logger.warning(f"Failed to parse ledger row: {row} - {e}")
                continue
        
        return last_balance
    except Exception as e:
        logger.exception(f"Failed to get last balance for product {product_id}: {e}")
        return 0.0


def add_ledger_entry(
    product_id: int,
    transaction_type: str,
    transaction_id: int,
    quantity_in: float = 0.0,
    quantity_out: float = 0.0,
    transaction_date: date = None
) -> dict:
    """
    Add a new entry to the stock ledger.
    
    Args:
        product_id: Product ID
        transaction_type: 'purchase', 'sale', or 'adjustment'
        transaction_id: Purchase ID or Sale ID
        quantity_in: Quantity added (for purchases)
        quantity_out: Quantity removed (for sales)
        transaction_date: Date of the transaction (defaults to today)
        
    Returns:
        dict with ledger entry details including new balance
    """
    _ensure_stock_ledger_sheet_exists()
    svc = _get_sheets_service()
    
    if transaction_date is None:
        transaction_date = date.today()
    
    # Get the last balance before this transaction
    last_balance = _get_last_balance(product_id, before_date=transaction_date)
    
    # Calculate new balance
    new_balance = last_balance + quantity_in - quantity_out
    
    # Ensure stock never goes negative
    if new_balance < 0:
        raise ValueError(
            f"Insufficient stock for product {product_id}. "
            f"Available: {last_balance}, Requested: {quantity_out}"
        )
    
    # Get next ledger ID
    ledger_id = _get_next_ledger_id()
    
    # Create entry
    created_at = datetime.now().isoformat()
    entry_values = [[
        ledger_id,
        product_id,
        transaction_type,
        transaction_id,
        quantity_in,
        quantity_out,
        new_balance,
        transaction_date.isoformat(),
        created_at
    ]]
    
    try:
        svc.values().append(
            spreadsheetId=SPREADSHEET_ID,
            range=f"{STOCK_LEDGER_SHEET_NAME}!A:I",
            valueInputOption="USER_ENTERED",
            insertDataOption="INSERT_ROWS",
            body={"values": entry_values}
        ).execute()
        
        logger.info(
            f"Added ledger entry: product {product_id}, type {transaction_type}, "
            f"balance: {last_balance} -> {new_balance}"
        )
        
        return {
            "id": ledger_id,
            "product_id": product_id,
            "transaction_type": transaction_type,
            "transaction_id": transaction_id,
            "quantity_in": quantity_in,
            "quantity_out": quantity_out,
            "balance_quantity": new_balance,
            "transaction_date": transaction_date.isoformat(),
            "created_at": created_at
        }
    except Exception as e:
        logger.exception(f"Failed to add ledger entry: {e}")
        raise


def get_current_balance(product_id: int) -> float:
    """
    Get the current balance quantity for a product from the ledger.
    
    Args:
        product_id: Product ID
        
    Returns:
        Current balance quantity
    """
    return _get_last_balance(product_id)


def get_opening_stock(product_id: int, month: int, year: int) -> float:
    """
    Get opening stock (first balance) for a product in a given month.
    
    Args:
        product_id: Product ID
        month: Month (1-12)
        year: Year
        
    Returns:
        Opening stock balance
    """
    from datetime import date
    first_day = date(year, month, 1)
    return _get_last_balance(product_id, before_date=first_day)


def get_closing_stock(product_id: int, month: int, year: int) -> float:
    """
    Get closing stock (last balance) for a product in a given month.
    
    Args:
        product_id: Product ID
        month: Month (1-12)
        year: Year
        
    Returns:
        Closing stock balance
    """
    from datetime import date
    from calendar import monthrange
    
    last_day = date(year, month, monthrange(year, month)[1])
    return _get_last_balance(product_id, before_date=date(year, month + 1, 1) if month < 12 else date(year + 1, 1, 1))


def list_ledger_entries(product_id: int = None, limit: int = 100) -> list[dict]:
    """
    List ledger entries, optionally filtered by product_id.
    
    Args:
        product_id: Optional product ID to filter by
        limit: Maximum number of entries to return
        
    Returns:
        List of ledger entry dicts
    """
    _ensure_stock_ledger_sheet_exists()
    svc = _get_sheets_service()
    
    try:
        resp = svc.values().get(
            spreadsheetId=SPREADSHEET_ID,
            range=f"{STOCK_LEDGER_SHEET_NAME}!A:I"
        ).execute()
        rows = resp.get("values", [])
        
        entries = []
        for row in rows[1:]:  # Skip header
            if len(row) < 8:
                continue
            
            try:
                row_product_id = int(row[1]) if row[1] else None
                
                # Filter by product_id if specified
                if product_id is not None and row_product_id != product_id:
                    continue
                
                entries.append({
                    "id": int(row[0]) if row[0] else 0,
                    "product_id": row_product_id,
                    "transaction_type": row[2] if len(row) > 2 else "",
                    "transaction_id": int(row[3]) if len(row) > 3 and row[3] else 0,
                    "quantity_in": float(row[4]) if len(row) > 4 and row[4] else 0.0,
                    "quantity_out": float(row[5]) if len(row) > 5 and row[5] else 0.0,
                    "balance_quantity": float(row[6]) if len(row) > 6 and row[6] else 0.0,
                    "transaction_date": row[7] if len(row) > 7 else "",
                    "created_at": row[8] if len(row) > 8 else ""
                })
            except (ValueError, TypeError, IndexError) as e:
                logger.warning(f"Failed to parse ledger entry: {row} - {e}")
                continue
        
        # Sort by date descending and limit
        entries.sort(key=lambda x: x.get("transaction_date", ""), reverse=True)
        return entries[:limit]
    except Exception as e:
        logger.exception(f"Failed to list ledger entries: {e}")
        return []

