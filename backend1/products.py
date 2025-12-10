import logging
from datetime import date
from auth import get_credentials
from googleapiclient.discovery import build
from config import SPREADSHEET_ID, PRODUCTS_SHEET_NAME
import re
import threading

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Cache for services
_sheets_service_cache = None
_sheets_service_lock = threading.Lock()
_sheet_name_cache = None
_sheet_name_lock = threading.Lock()


def _get_sheets_service():
    """Get cached Sheets service or create new one. Thread-safe."""
    global _sheets_service_cache
    
    with _sheets_service_lock:
        if _sheets_service_cache is not None:
            return _sheets_service_cache
        
        creds = get_credentials()
        _sheets_service_cache = build("sheets", "v4", credentials=creds, cache_discovery=False).spreadsheets()
        return _sheets_service_cache


def _get_products_sheet_name() -> str:
    """
    Get the actual Products sheet name. Cached for performance.
    If configured PRODUCTS_SHEET_NAME doesn't exist, creates it.
    
    Returns:
        str: Sheet name to use
    """
    global _sheet_name_cache
    
    with _sheet_name_lock:
        if _sheet_name_cache is not None:
            return _sheet_name_cache
        
        try:
            svc = _get_sheets_service()
            
            # Get spreadsheet metadata to check available sheets
            meta = svc.get(spreadsheetId=SPREADSHEET_ID).execute()
            sheets = meta.get('sheets', [])
            
            # Check if Products sheet exists (case-insensitive)
            for sheet in sheets:
                sheet_title = sheet['properties']['title']
                if sheet_title.lower() == PRODUCTS_SHEET_NAME.lower():
                    _sheet_name_cache = sheet_title  # Return actual case
                    return _sheet_name_cache
            
            # If Products sheet doesn't exist, create it
            logger.info(f"Sheet '{PRODUCTS_SHEET_NAME}' not found, creating it...")
            _create_products_sheet()
            _sheet_name_cache = PRODUCTS_SHEET_NAME
            return _sheet_name_cache
            
        except Exception as e:
            logger.warning(f"Could not determine sheet name: {e}")
            _sheet_name_cache = PRODUCTS_SHEET_NAME
            return _sheet_name_cache


def _create_products_sheet():
    """Create the Products sheet with headers if it doesn't exist."""
    svc = _get_sheets_service()
    try:
        # First create the sheet
        svc.batchUpdate(
            spreadsheetId=SPREADSHEET_ID,
            body={
                "requests": [
                    {
                        "addSheet": {
                            "properties": {
                                "title": PRODUCTS_SHEET_NAME
                            }
                        }
                    }
                ]
            }
        ).execute()
        
        # Then add headers
        headers = [["ID", "Name", "Quantity", "Unit", "Price Per Unit"]]
        svc.values().append(
            spreadsheetId=SPREADSHEET_ID,
            range=f"{sheet_name}!A:E",
            valueInputOption="USER_ENTERED",
            body={"values": headers}
        ).execute()
        logger.info(f"Created Products sheet with headers")
    except Exception as e:
        logger.exception(f"Failed to create Products sheet: {e}")
        raise


def append_product(data: dict) -> int:
    """
    Appends a product row to the Products sheet. Returns the new row number.
    Sheet columns are:
      A: ID (auto-increment)
      B: Name (uppercase)
      C: Quantity
      D: Unit
      E: Price Per Unit
    """
    svc = _get_sheets_service()
    sheet_name = _get_products_sheet_name()
    
    # Get next ID (count non-header rows)
    resp = svc.values().get(
        spreadsheetId=SPREADSHEET_ID,
        range=f"{sheet_name}!A:A"
    ).execute()
    values = resp.get("values", [])
    next_id = len(values)  # Row count is the next ID (skip header row)

    values = [[
        next_id,                                    # A: ID
        data["name"].upper(),                      # B: Name (uppercase)
        data["quantity"],                          # C: Quantity
        data["unit"],                              # D: Unit
        data["pricePerUnit"]                       # E: Price Per Unit
    ]]

    try:
        append_resp = svc.values().append(
            spreadsheetId=SPREADSHEET_ID,
            range=f"{sheet_name}!A:E",
            valueInputOption="USER_ENTERED",
            insertDataOption="INSERT_ROWS",
            body={"values": values}
        ).execute()

        updated_range = append_resp.get("updates", {}).get("updatedRange")
        if not updated_range:
            raise ValueError("Missing updatedRange in append response")

        start_cell = updated_range.split("!")[1].split(":")[0]
        row_str = re.sub(r"[A-Z]", "", start_cell, flags=re.IGNORECASE)
        if not row_str.isdigit():
            raise ValueError(f"Unable to parse row number from '{start_cell}'")

        row_no = int(row_str)
        logger.info(f"Appended product at row {row_no}")
        return row_no

    except Exception as e:
        logger.exception("Failed to append product row to Google Sheets")
        raise


def find_product_row(product_id: int) -> int | None:
    """Return the 1-based row index (integer) for the given product ID or None if not found."""
    svc = _get_sheets_service()
    sheet_name = _get_products_sheet_name()
    resp = svc.values().get(
        spreadsheetId=SPREADSHEET_ID,
        range=f"{sheet_name}!A:A"
    ).execute()
    values = resp.get("values", [])
    for idx, row in enumerate(values, start=1):
        try:
            if row and str(row[0]).strip():
                # Convert to int, handling both numbers and string numbers
                cell_id = int(float(str(row[0])))
                if cell_id == product_id:
                    return idx
        except (ValueError, TypeError):
            pass
    return None


def update_product(product_id: int, data: dict):
    """Update a product row identified by ID with the provided data dict."""
    row = find_product_row(product_id)
    if not row:
        raise ValueError("Product not found")

    sheet_name = _get_products_sheet_name()
    
    # Get current product data
    svc = _get_sheets_service()
    resp = svc.values().get(
        spreadsheetId=SPREADSHEET_ID,
        range=f"{sheet_name}!A{row}:F{row}"
    ).execute()
    current = resp.get("values", [[]])[0] if resp.get("values") else []
    padded = current + [""] * (6 - len(current))

    # Update with new values
    values = [[
        padded[0],                                  # A: ID (unchanged)
        data.get("name", padded[1]).upper() if data.get("name") else padded[1],  # B: Name (uppercase if provided)
        data.get("quantity", padded[2]),           # C: Quantity
        data.get("unit", padded[3]),               # D: Unit
        data.get("pricePerUnit", padded[4])        # E: Price Per Unit
    ]]

    try:
        svc.values().update(
            spreadsheetId=SPREADSHEET_ID,
            range=f"{sheet_name}!A{row}:F{row}",
            valueInputOption="USER_ENTERED",
            body={"values": values}
        ).execute()
    except Exception:
        logger.exception("Failed to update product row")
        raise

    return row


def delete_product(product_id: int):
    """
    Delete a product row and return the row index.
    
    Returns:
        dict: {"row": int}
    """
    row = find_product_row(product_id)
    if not row:
        raise ValueError("Product not found")

    # Delete the row from sheet
    sheet_id = _get_product_sheet_id()
    sheet_name = _get_products_sheet_name()
    svc = _get_sheets_service()
    
    try:
        svc.batchUpdate(
            spreadsheetId=SPREADSHEET_ID,
            body={
                "requests": [
                    {
                        "deleteDimension": {
                            "range": {
                                "sheetId": sheet_id,
                                "dimension": "ROWS",
                                "startIndex": row - 1,  # zero-based, inclusive
                                "endIndex": row         # exclusive
                            }
                        }
                    }
                ]
            }
        ).execute()
    except Exception:
        logger.exception("Failed to delete product row")
        raise

    return {"row": row}


def _get_product_sheet_id() -> int:
    """Return the numeric sheetId for the Products sheet."""
    svc = _get_sheets_service()
    sheet_name = _get_products_sheet_name()
    meta = svc.get(spreadsheetId=SPREADSHEET_ID).execute()
    for sht in meta.get("sheets", []):
        props = sht.get("properties", {})
        if props.get("title") == sheet_name:
            return props.get("sheetId")
    raise ValueError(f"Sheet '{sheet_name}' not found in spreadsheet")


def list_products() -> list[dict]:
    """Return a list of product dicts from the sheet."""
    svc = _get_sheets_service()
    sheet_name = _get_products_sheet_name()
    resp = svc.values().get(
        spreadsheetId=SPREADSHEET_ID,
        range=f"{sheet_name}!A:E"
    ).execute()

    rows = resp.get("values", [])
    products = []
    
    # Determine if first row is a header by checking if first column is "ID"
    start_idx = 1
    if rows and len(rows) > 0:
        first_cell = str(rows[0][0]).strip() if rows[0] else ""
        if first_cell.upper() == "ID":
            start_idx = 2  # Skip header row
    
    for idx, row in enumerate(rows, start=1):
        # Skip header row if it exists
        if idx < start_idx:
            continue
            
        padded = row + [""] * (5 - len(row))
        (product_id, name, quantity, unit, price_per_unit) = padded
        
        # Skip empty rows - check if product_id is not empty
        if not product_id or product_id.strip() == "":
            continue
        
        try:
            # Handle formula results (they come as numbers)
            product_id_val = int(float(product_id)) if product_id else None
            quantity_val = int(float(quantity)) if quantity else 0
            price_val = float(price_per_unit) if price_per_unit else 0.0
            
            if product_id_val is None:
                continue
            
            products.append({
                "id": product_id_val,
                "name": name.strip() if name else "",
                "quantity": quantity_val,
                "unit": unit.strip() if unit else "",
                "pricePerUnit": price_val,
                "row": idx
            })
        except (ValueError, TypeError, AttributeError) as e:
            logger.warning(f"Failed to parse product row {idx}: {row} - {e}")
            continue
    
    return products
