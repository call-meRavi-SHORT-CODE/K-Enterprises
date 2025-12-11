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
        
        # Then add headers (updated schema)
        headers = [[
            "ID",
            "Name",
            "Current Quantity",
            "Unit",
            "Default Cost Price",
            "Default Selling Price",
            "Reorder Point"
        ]]
        svc.values().append(
            spreadsheetId=SPREADSHEET_ID,
            range=f"{PRODUCTS_SHEET_NAME}!A:G",
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
    
    # Compute next numeric ID by scanning existing IDs (handles deleted rows).
    resp = svc.values().get(
        spreadsheetId=SPREADSHEET_ID,
        range=f"{sheet_name}!A:A"
    ).execute()
    values = resp.get("values", [])
    # Extract numeric suffix from IDs like 'P0_1' or plain numbers
    def _extract_num(cell_val: str) -> int | None:
        if not cell_val:
            return None
        import re
        m = re.search(r"(\d+)$", str(cell_val))
        return int(m.group(1)) if m else None

    max_id = 0
    for row in values:
        if row and row[0]:
            try:
                n = _extract_num(row[0])
                if n and n > max_id:
                    max_id = n
            except Exception:
                continue
    next_id = max_id + 1

    values = [[
        f"P0_{next_id}",                            # A: ID stored with prefix
        data["name"].upper(),                      # B: Name (uppercase)
        data.get("current_quantity", 0),           # C: Current Quantity
        data.get("unit", ""),                    # D: Unit
        data.get("default_cost_price", 0.0),       # E: Default Cost Price
        data.get("default_selling_price", 0.0),    # F: Default Selling Price
        data.get("reorder_point", "")            # G: Reorder Point (optional)
    ]]

    try:
        append_resp = svc.values().append(
            spreadsheetId=SPREADSHEET_ID,
            range=f"{sheet_name}!A:G",
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
        return {"row": row_no, "id": next_id}

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
    import re
    for idx, row in enumerate(values, start=1):
        try:
            if row and str(row[0]).strip():
                # support IDs like 'P0_1' or plain numeric
                m = re.search(r"(\d+)$", str(row[0]))
                if not m:
                    continue
                cell_id = int(m.group(1))
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
        range=f"{sheet_name}!A{row}:G{row}"
    ).execute()
    current = resp.get("values", [[]])[0] if resp.get("values") else []
    padded = current + [""] * (7 - len(current))

    # Update with new values (preserve existing if not provided)
    values = [[
        padded[0],
        data.get("name", padded[1]).upper() if data.get("name") else padded[1],  # Name
        data.get("current_quantity", padded[2]),          # Current Quantity
        data.get("unit", padded[3]),                      # Unit
        data.get("default_cost_price", padded[4]),        # Default Cost Price
        data.get("default_selling_price", padded[5]),     # Default Selling Price
        data.get("reorder_point", padded[6])              # Reorder Point
    ]]

    try:
        svc.values().update(
            spreadsheetId=SPREADSHEET_ID,
            range=f"{sheet_name}!A{row}:G{row}",
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
        range=f"{sheet_name}!A:G"
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
            
        padded = row + [""] * (7 - len(row))
        (product_id, name, current_quantity, unit, default_cost_price, default_selling_price, reorder_point) = padded
        
        # Skip empty rows - check if product_id is not empty
        if not product_id or product_id.strip() == "":
            continue
        
        try:
            # Handle formula results (they come as numbers)
            # Handle IDs like 'P0_1' or plain numeric values by extracting trailing number
            m = re.search(r"(\d+)$", str(product_id))
            product_id_val = int(m.group(1)) if m else None
            quantity_val = int(float(current_quantity)) if current_quantity else 0
            cost_val = float(default_cost_price) if default_cost_price else 0.0
            selling_val = float(default_selling_price) if default_selling_price else 0.0
            reorder_val = int(float(reorder_point)) if reorder_point and str(reorder_point).strip() != "" else None
            
            if product_id_val is None:
                continue
            
            products.append({
                "id": product_id_val,
                "name": name.strip() if name else "",
                "current_quantity": quantity_val,
                "unit": unit.strip() if unit else "",
                "default_cost_price": cost_val,
                "default_selling_price": selling_val,
                "reorder_point": reorder_val,
                "row": idx
            })
        except (ValueError, TypeError, AttributeError) as e:
            logger.warning(f"Failed to parse product row {idx}: {row} - {e}")
            continue
    
    return products
