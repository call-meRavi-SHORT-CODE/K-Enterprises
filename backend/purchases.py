import logging
from datetime import date, timedelta
from auth import get_credentials
from googleapiclient.discovery import build
from config import SPREADSHEET_ID
import re
import threading
from stock import update_stock
from stock_ledger import add_ledger_entry
from stock import update_stock
from stock_ledger import add_ledger_entry

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Constants
PURCHASES_SHEET_NAME = "Purchases"
PURCHASE_ITEMS_SHEET_NAME = "Purchase Items"

# Cache for services
_sheets_service_cache = None
_sheets_service_lock = threading.Lock()


def _get_sheets_service():
    """Get cached Sheets service or create new one. Thread-safe."""
    global _sheets_service_cache
    
    with _sheets_service_lock:
        if _sheets_service_cache is not None:
            return _sheets_service_cache
        
        creds = get_credentials()
        _sheets_service_cache = build("sheets", "v4", credentials=creds, cache_discovery=False).spreadsheets()
        return _sheets_service_cache


def _ensure_sheets_exist():
    """Ensure Purchases and Purchase Items sheets exist."""
    svc = _get_sheets_service()
    try:
        meta = svc.get(spreadsheetId=SPREADSHEET_ID).execute()
        sheets = meta.get('sheets', [])
        sheet_titles = [s['properties']['title'] for s in sheets]
        
        # Create Purchases sheet if it doesn't exist
        if PURCHASES_SHEET_NAME not in sheet_titles:
            logger.info(f"Creating {PURCHASES_SHEET_NAME} sheet...")
            svc.batchUpdate(
                spreadsheetId=SPREADSHEET_ID,
                body={"requests": [{"addSheet": {"properties": {"title": PURCHASES_SHEET_NAME}}}]}
            ).execute()
            # Add headers
            headers = [["ID", "Vendor Name", "Invoice Number", "Purchase Date", "Total Amount", "Notes"]]
            svc.values().append(
                spreadsheetId=SPREADSHEET_ID,
                range=f"{PURCHASES_SHEET_NAME}!A:F",
                valueInputOption="USER_ENTERED",
                body={"values": headers}
            ).execute()
        
        # Create Purchase Items sheet if it doesn't exist
        if PURCHASE_ITEMS_SHEET_NAME not in sheet_titles:
            logger.info(f"Creating {PURCHASE_ITEMS_SHEET_NAME} sheet...")
            svc.batchUpdate(
                spreadsheetId=SPREADSHEET_ID,
                body={"requests": [{"addSheet": {"properties": {"title": PURCHASE_ITEMS_SHEET_NAME}}}]}
            ).execute()
            # Add headers
            headers = [["ID", "Purchase ID", "Product ID", "Product Name", "Quantity", "Unit Price", "Total Price"]]
            svc.values().append(
                spreadsheetId=SPREADSHEET_ID,
                range=f"{PURCHASE_ITEMS_SHEET_NAME}!A:G",
                valueInputOption="USER_ENTERED",
                body={"values": headers}
            ).execute()
    except Exception as e:
        logger.exception(f"Failed to ensure sheets exist: {e}")
        raise


def create_purchase(vendor_name: str, invoice_number: str, purchase_date: date, notes: str, items_data: list) -> dict:
    """
    Create a purchase with items.
    
    Args:
        vendor_name: Vendor name
        invoice_number: Invoice number
        purchase_date: Purchase date
        notes: Optional notes
        items_data: List of dicts with product_id, quantity, unit_price
    
    Returns:
        dict with purchase_id, items, total_amount
    """
    _ensure_sheets_exist()
    svc = _get_sheets_service()
    
    # Calculate next ID
    resp = svc.values().get(
        spreadsheetId=SPREADSHEET_ID,
        range=f"{PURCHASES_SHEET_NAME}!A:A"
    ).execute()
    values = resp.get("values", [])
    
    max_id = 0
    for row in values[1:]:  # Skip header
        if row and row[0]:
            try:
                m = re.search(r"(\d+)$", str(row[0]))
                n = int(m.group(1)) if m else None
                if n and n > max_id:
                    max_id = n
            except:
                continue
    
    purchase_id = max_id + 1
    
    # Calculate total amount
    total_amount = sum(
        float(item.get("quantity", 0)) * float(item.get("unit_price", 0))
        for item in items_data
    )
    
    # Add purchase header
    purchase_values = [[
        f"PUR_{purchase_id}",
        vendor_name,
        invoice_number,
        str(purchase_date),
        total_amount,
        notes or ""
    ]]
    
    try:
        svc.values().append(
            spreadsheetId=SPREADSHEET_ID,
            range=f"{PURCHASES_SHEET_NAME}!A:F",
            valueInputOption="USER_ENTERED",
            insertDataOption="INSERT_ROWS",
            body={"values": purchase_values}
        ).execute()
        
        # Get max item ID for auto-increment
        resp_items = svc.values().get(
            spreadsheetId=SPREADSHEET_ID,
            range=f"{PURCHASE_ITEMS_SHEET_NAME}!A:A"
        ).execute()
        item_values_list = resp_items.get("values", [])
        
        max_item_id = 0
        for row in item_values_list[1:]:  # Skip header
            if row and row[0]:
                try:
                    m = re.search(r"(\d+)$", str(row[0]))
                    n = int(m.group(1)) if m else None
                    if n and n > max_item_id:
                        max_item_id = n
                except:
                    continue
        
        # Add purchase items
        for idx, item in enumerate(items_data):
            item_id = max_item_id + idx + 1
            quantity = float(item.get("quantity", 0))
            unit_price = float(item.get("unit_price", 0))
            total_price = quantity * unit_price
            
            item_values = [[
                f"ITEM_{item_id}",
                f"PUR_{purchase_id}",
                item.get("product_id", ""),
                item.get("product_name", ""),
                quantity,
                unit_price,
                total_price
            ]]
            
            svc.values().append(
                spreadsheetId=SPREADSHEET_ID,
                range=f"{PURCHASE_ITEMS_SHEET_NAME}!A:G",
                valueInputOption="USER_ENTERED",
                insertDataOption="INSERT_ROWS",
                body={"values": item_values}
            ).execute()
            
            # Add stock for purchased items
            try:
                update_stock(
                    product_id=item.get("product_id"),
                    product_name=item.get("product_name", ""),
                    quantity_change=quantity  # Add quantity to stock
                )
                
                # Add ledger entry for purchase
                try:
                    add_ledger_entry(
                        product_id=item.get("product_id"),
                        transaction_type="purchase",
                        transaction_id=purchase_id,
                        quantity_in=quantity,
                        quantity_out=0.0,
                        transaction_date=purchase_date
                    )
                except Exception as e:
                    logger.warning(f"Failed to add ledger entry for purchase: {e}")
            except Exception as e:
                logger.warning(f"Failed to update stock for product {item.get('product_id')}: {e}")
        
        logger.info(f"Created purchase PUR_{purchase_id} with {len(items_data)} items")
        return {
            "purchase_id": purchase_id,
            "vendor_name": vendor_name,
            "purchase_date": str(purchase_date),
            "total_amount": total_amount,
            "notes": notes,
            "items_count": len(items_data)
        }
        
    except Exception as e:
        logger.exception(f"Failed to create purchase: {e}")
        raise


def _parse_sheet_date_value(val):
    """Convert Google Sheets/Excel date serials to ISO string when applicable."""
    if val is None:
        return ''
    # If already ISO-like yyyy-mm-dd
    try:
        s = str(val).strip()
        if re.match(r"^\d{4}-\d{2}-\d{2}$", s):
            return s
        # Numeric serial (e.g., 46004)
        if re.match(r"^\d+(?:\.\d+)?$", s):
            n = int(float(s))
            dt = date(1899, 12, 30) + timedelta(days=n)
            return dt.isoformat()
    except Exception:
        pass
    return str(val)


def list_purchases() -> list[dict]:
    """List all purchases with their items."""
    _ensure_sheets_exist()
    svc = _get_sheets_service()
    
    try:
        # Get purchases
        resp = svc.values().get(
            spreadsheetId=SPREADSHEET_ID,
            range=f"{PURCHASES_SHEET_NAME}!A:F"
        ).execute()
        
        purchases_rows = resp.get("values", [])
        purchases = []
        
        # Skip header row
        for idx, row in enumerate(purchases_rows[1:], start=2):
            padded = row + [""] * (6 - len(row))
            purchase_id, vendor_name, invoice_number, purchase_date, total_amount, notes = padded
            
            if not purchase_id or purchase_id.strip() == "":
                continue
            
            try:
                m = re.search(r"(\d+)$", str(purchase_id))
                purchase_id_val = int(m.group(1)) if m else None
                
                # Get items for this purchase
                items_resp = svc.values().get(
                    spreadsheetId=SPREADSHEET_ID,
                    range=f"{PURCHASE_ITEMS_SHEET_NAME}!A:G"
                ).execute()
                
                items_rows = items_resp.get("values", [])
                items = []
                
                for item_row in items_rows[1:]:  # Skip header
                    item_padded = item_row + [""] * (7 - len(item_row))
                    item_id, pur_id, prod_id, prod_name, quantity, unit_price, total_price = item_padded
                    
                    if str(pur_id).strip() == str(purchase_id):
                        items.append({
                            "product_id": prod_id,
                            "product_name": prod_name,
                            "quantity": float(quantity) if quantity else 0,
                            "unit_price": float(unit_price) if unit_price else 0,
                            "total_price": float(total_price) if total_price else 0
                        })

                # Normalize purchase date (handle sheet serial numbers)
                parsed_date = _parse_sheet_date_value(purchase_date)
                
                purchases.append({
                    "id": purchase_id_val,
                    "vendor_name": vendor_name,
                    "invoice_number": invoice_number,
                    "purchase_date": parsed_date,
                    "total_amount": float(total_amount) if total_amount else 0,
                    "notes": notes,
                    "items": items
                })
                
            except Exception as e:
                logger.warning(f"Failed to parse purchase row {idx}: {e}")
                continue
        
        return purchases
        
    except Exception as e:
        logger.exception("Failed to list purchases")
        raise

def find_purchase_row(purchase_id: int) -> int | None:
    """Return the row number for a purchase ID or None if not found."""
    _ensure_sheets_exist()
    svc = _get_sheets_service()
    try:
        resp = svc.values().get(
            spreadsheetId=SPREADSHEET_ID,
            range=f"{PURCHASES_SHEET_NAME}!A:A"
        ).execute()
        values = resp.get("values", [])
        
        for idx, row in enumerate(values, start=1):
            if row and row[0]:
                try:
                    m = re.search(r"(\d+)$", str(row[0]))
                    purchase_id_val = int(m.group(1)) if m else None
                    if purchase_id_val == purchase_id:
                        return idx
                except:
                    continue
        return None
    except Exception as e:
        logger.exception(f"Failed to find purchase row: {e}")
        return None


def update_purchase(purchase_id: int, vendor_name: str, invoice_number: str, purchase_date: str, notes: str, items_data: list):
    """Update a purchase and its items."""
    _ensure_sheets_exist()
    svc = _get_sheets_service()
    
    row = find_purchase_row(purchase_id)
    if not row:
        raise ValueError("Purchase not found")
    
    try:
        # Update purchase header
        total_amount = sum(
            float(item.get("quantity", 0)) * float(item.get("unit_price", 0))
            for item in items_data
        )
        
        purchase_values = [[
            f"PUR_{purchase_id}",
            vendor_name,
            invoice_number,
            purchase_date,
            total_amount,
            notes or ""
        ]]
        
        svc.values().update(
            spreadsheetId=SPREADSHEET_ID,
            range=f"{PURCHASES_SHEET_NAME}!A{row}:F{row}",
            valueInputOption="USER_ENTERED",
            body={"values": purchase_values}
        ).execute()
        
        # Delete old items for this purchase
        resp_items = svc.values().get(
            spreadsheetId=SPREADSHEET_ID,
            range=f"{PURCHASE_ITEMS_SHEET_NAME}!A:B"
        ).execute()
        items_rows = resp_items.get("values", [])
        
        rows_to_delete = []
        for idx, item_row in enumerate(items_rows[1:], start=2):  # Skip header
            if item_row and len(item_row) > 1 and str(item_row[1]).strip() == f"PUR_{purchase_id}":
                rows_to_delete.append(idx)
        
        # Delete rows in reverse order to maintain indices
        for del_row in sorted(rows_to_delete, reverse=True):
            sheet_id = _get_purchase_items_sheet_id()
            svc.batchUpdate(
                spreadsheetId=SPREADSHEET_ID,
                body={
                    "requests": [
                        {
                            "deleteDimension": {
                                "range": {
                                    "sheetId": sheet_id,
                                    "dimension": "ROWS",
                                    "startIndex": del_row - 1,
                                    "endIndex": del_row
                                }
                            }
                        }
                    ]
                }
            ).execute()
        
        # Add new items
        resp_items = svc.values().get(
            spreadsheetId=SPREADSHEET_ID,
            range=f"{PURCHASE_ITEMS_SHEET_NAME}!A:A"
        ).execute()
        item_values_list = resp_items.get("values", [])
        
        max_item_id = 0
        for item_row in item_values_list[1:]:
            if item_row and item_row[0]:
                try:
                    m = re.search(r"(\d+)$", str(item_row[0]))
                    n = int(m.group(1)) if m else None
                    if n and n > max_item_id:
                        max_item_id = n
                except:
                    continue
        
        for idx, item in enumerate(items_data):
            item_id = max_item_id + idx + 1
            quantity = float(item.get("quantity", 0))
            unit_price = float(item.get("unit_price", 0))
            total_price = quantity * unit_price
            
            item_values = [[
                f"ITEM_{item_id}",
                f"PUR_{purchase_id}",
                item.get("product_id", ""),
                item.get("product_name", ""),
                quantity,
                unit_price,
                total_price
            ]]
            
            svc.values().append(
                spreadsheetId=SPREADSHEET_ID,
                range=f"{PURCHASE_ITEMS_SHEET_NAME}!A:G",
                valueInputOption="USER_ENTERED",
                insertDataOption="INSERT_ROWS",
                body={"values": item_values}
            ).execute()
        
        logger.info(f"Updated purchase PUR_{purchase_id}")
        return {"purchase_id": purchase_id, "status": "updated"}
        
    except Exception as e:
        logger.exception(f"Failed to update purchase: {e}")
        raise


def delete_purchase(purchase_id: int):
    """Delete a purchase and its items."""
    _ensure_sheets_exist()
    svc = _get_sheets_service()
    
    row = find_purchase_row(purchase_id)
    if not row:
        raise ValueError("Purchase not found")
    
    try:
        # Delete purchase header row
        sheet_id = _get_purchases_sheet_id()
        svc.batchUpdate(
            spreadsheetId=SPREADSHEET_ID,
            body={
                "requests": [
                    {
                        "deleteDimension": {
                            "range": {
                                "sheetId": sheet_id,
                                "dimension": "ROWS",
                                "startIndex": row - 1,
                                "endIndex": row
                            }
                        }
                    }
                ]
            }
        ).execute()
        
        # Delete purchase items
        resp_items = svc.values().get(
            spreadsheetId=SPREADSHEET_ID,
            range=f"{PURCHASE_ITEMS_SHEET_NAME}!A:B"
        ).execute()
        items_rows = resp_items.get("values", [])
        
        rows_to_delete = []
        for idx, item_row in enumerate(items_rows[1:], start=2):
            if item_row and len(item_row) > 1 and str(item_row[1]).strip() == f"PUR_{purchase_id}":
                rows_to_delete.append(idx)
        
        sheet_id_items = _get_purchase_items_sheet_id()
        for del_row in sorted(rows_to_delete, reverse=True):
            svc.batchUpdate(
                spreadsheetId=SPREADSHEET_ID,
                body={
                    "requests": [
                        {
                            "deleteDimension": {
                                "range": {
                                    "sheetId": sheet_id_items,
                                    "dimension": "ROWS",
                                    "startIndex": del_row - 1,
                                    "endIndex": del_row
                                }
                            }
                        }
                    ]
                }
            ).execute()
        
        logger.info(f"Deleted purchase PUR_{purchase_id}")
        return {"purchase_id": purchase_id, "status": "deleted"}
        
    except Exception as e:
        logger.exception(f"Failed to delete purchase: {e}")
        raise


def _get_purchases_sheet_id() -> int:
    """Return the numeric sheetId for the Purchases sheet."""
    svc = _get_sheets_service()
    meta = svc.get(spreadsheetId=SPREADSHEET_ID).execute()
    for sht in meta.get("sheets", []):
        props = sht.get("properties", {})
        if props.get("title") == PURCHASES_SHEET_NAME:
            return props.get("sheetId")
    raise ValueError(f"Sheet '{PURCHASES_SHEET_NAME}' not found")


def _get_purchase_items_sheet_id() -> int:
    """Return the numeric sheetId for the Purchase Items sheet."""
    svc = _get_sheets_service()
    meta = svc.get(spreadsheetId=SPREADSHEET_ID).execute()
    for sht in meta.get("sheets", []):
        props = sht.get("properties", {})
        if props.get("title") == PURCHASE_ITEMS_SHEET_NAME:
            return props.get("sheetId")
    raise ValueError(f"Sheet '{PURCHASE_ITEMS_SHEET_NAME}' not found")