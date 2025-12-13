import logging
from datetime import date
from auth import get_credentials
from googleapiclient.discovery import build
from config import SPREADSHEET_ID
import re
import threading

from products import find_product_row, list_products, update_product, parse_quantity_with_unit, format_quantity_with_unit

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Constants
SALES_SHEET_NAME = "Sales"
SALES_ITEMS_SHEET_NAME = "Sales Items"

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


def _ensure_sheets_exist():
    svc = _get_sheets_service()
    try:
        meta = svc.get(spreadsheetId=SPREADSHEET_ID).execute()
        sheets = meta.get('sheets', [])
        sheet_titles = [s['properties']['title'] for s in sheets]

        if SALES_SHEET_NAME not in sheet_titles:
            logger.info(f"Creating {SALES_SHEET_NAME} sheet...")
            svc.batchUpdate(
                spreadsheetId=SPREADSHEET_ID,
                body={"requests": [{"addSheet": {"properties": {"title": SALES_SHEET_NAME}}}]}
            ).execute()
            headers = [["ID", "Customer Name", "Sale Date", "Total Amount", "Notes"]]
            svc.values().append(
                spreadsheetId=SPREADSHEET_ID,
                range=f"{SALES_SHEET_NAME}!A:E",
                valueInputOption="USER_ENTERED",
                body={"values": headers}
            ).execute()

        if SALES_ITEMS_SHEET_NAME not in sheet_titles:
            logger.info(f"Creating {SALES_ITEMS_SHEET_NAME} sheet...")
            svc.batchUpdate(
                spreadsheetId=SPREADSHEET_ID,
                body={"requests": [{"addSheet": {"properties": {"title": SALES_ITEMS_SHEET_NAME}}}]}
            ).execute()
            headers = [["ID", "Sale ID", "Product ID", "Product Name", "Quantity", "Unit Price", "Total Price"]]
            svc.values().append(
                spreadsheetId=SPREADSHEET_ID,
                range=f"{SALES_ITEMS_SHEET_NAME}!A:G",
                valueInputOption="USER_ENTERED",
                body={"values": headers}
            ).execute()
    except Exception as e:
        logger.exception(f"Failed to ensure sales sheets exist: {e}")
        raise


def _get_sales_sheet_id():
    svc = _get_sheets_service()
    meta = svc.get(spreadsheetId=SPREADSHEET_ID).execute()
    for sht in meta.get('sheets', []):
        props = sht.get('properties', {})
        if props.get('title') == SALES_ITEMS_SHEET_NAME:
            return props.get('sheetId')
    raise ValueError("Sales Items sheet not found")


def create_sale(customer_name: str, sale_date: date, notes: str, items_data: list) -> dict:
    _ensure_sheets_exist()
    svc = _get_sheets_service()

    # next sale id
    resp = svc.values().get(spreadsheetId=SPREADSHEET_ID, range=f"{SALES_SHEET_NAME}!A:A").execute()
    rows = resp.get('values', [])
    max_id = 0
    for row in rows[1:]:
        if row and row[0]:
            m = re.search(r"(\d+)$", str(row[0]))
            n = int(m.group(1)) if m else None
            if n and n > max_id:
                max_id = n
    sale_id = max_id + 1

    # calculate total
    total_amount = sum(float(it.get('quantity', 0)) * float(it.get('unit_price', 0)) for it in items_data)

    sale_values = [[f"SAL_{sale_id}", customer_name, str(sale_date), total_amount, notes or ""]]

    try:
        svc.values().append(
            spreadsheetId=SPREADSHEET_ID,
            range=f"{SALES_SHEET_NAME}!A:E",
            valueInputOption="USER_ENTERED",
            insertDataOption="INSERT_ROWS",
            body={"values": sale_values}
        ).execute()

        # get max item id
        resp_items = svc.values().get(spreadsheetId=SPREADSHEET_ID, range=f"{SALES_ITEMS_SHEET_NAME}!A:A").execute()
        item_rows = resp_items.get('values', [])
        max_item = 0
        for r in item_rows[1:]:
            if r and r[0]:
                m = re.search(r"(\d+)$", str(r[0]))
                n = int(m.group(1)) if m else None
                if n and n > max_item:
                    max_item = n

        # append items and deduct stock
        for idx, it in enumerate(items_data):
            item_id = max_item + idx + 1
            quantity = float(it.get('quantity', 0))
            unit_price = float(it.get('unit_price', 0))
            total_price = quantity * unit_price

            # Deduct from stock
            prod_id = int(it.get('product_id'))
            prod_row = find_product_row(prod_id)
            if not prod_row:
                raise ValueError(f"Product {prod_id} not found")
            # fetch product current quantity via list_products
            products = list_products()
            prod = next((p for p in products if p['id'] == prod_id), None)
            if not prod:
                raise ValueError(f"Product {prod_id} not found")

            try:
                curr_qty, unit = parse_quantity_with_unit(prod['quantity_with_unit'])
            except Exception as e:
                raise ValueError(f"Product {prod_id} has invalid quantity_with_unit: {e}")

            # Units must match
            # Assume quantity provided is numeric matching the unit
            if quantity > curr_qty:
                raise ValueError(f"Insufficient stock for product {prod['name']} (have {curr_qty}{unit}, need {quantity}{unit})")

            new_qty = curr_qty - quantity
            new_q_str = format_quantity_with_unit(new_qty, unit)
            update_product(prod_id, {"quantity_with_unit": new_q_str})

            item_values = [[f"ITEM_{item_id}", f"SAL_{sale_id}", prod_id, prod['name'], quantity, unit_price, total_price]]
            svc.values().append(
                spreadsheetId=SPREADSHEET_ID,
                range=f"{SALES_ITEMS_SHEET_NAME}!A:G",
                valueInputOption="USER_ENTERED",
                insertDataOption="INSERT_ROWS",
                body={"values": item_values}
            ).execute()

        logger.info(f"Created sale SAL_{sale_id} with {len(items_data)} items")
        return {"sale_id": sale_id, "customer_name": customer_name, "sale_date": str(sale_date), "total_amount": total_amount, "notes": notes, "items_count": len(items_data)}

    except Exception as e:
        logger.exception(f"Failed to create sale: {e}")
        raise


def list_sales() -> list[dict]:
    _ensure_sheets_exist()
    svc = _get_sheets_service()
    try:
        resp = svc.values().get(spreadsheetId=SPREADSHEET_ID, range=f"{SALES_SHEET_NAME}!A:E").execute()
        rows = resp.get('values', [])
        sales = []
        for idx, row in enumerate(rows[1:], start=2):
            padded = row + [""] * (5 - len(row))
            sale_id, customer_name, sale_date, total_amount, notes = padded
            if not sale_id or sale_id.strip() == "":
                continue
            try:
                m = re.search(r"(\d+)$", str(sale_id))
                sale_id_val = int(m.group(1)) if m else None

                # get items
                items_resp = svc.values().get(spreadsheetId=SPREADSHEET_ID, range=f"{SALES_ITEMS_SHEET_NAME}!A:G").execute()
                items_rows = items_resp.get('values', [])
                items = []
                for item_row in items_rows[1:]:
                    item_padded = item_row + [""] * (7 - len(item_row))
                    item_id, s_id, prod_id, prod_name, quantity, unit_price, total_price = item_padded
                    if str(s_id).strip() == str(sale_id):
                        items.append({
                            "product_id": int(prod_id) if prod_id else 0,
                            "product_name": prod_name,
                            "quantity": float(quantity) if quantity else 0,
                            "unit_price": float(unit_price) if unit_price else 0,
                            "total_price": float(total_price) if total_price else 0
                        })

                sales.append({
                    "id": sale_id_val,
                    "customer_name": customer_name,
                    "sale_date": sale_date,
                    "total_amount": float(total_amount) if total_amount else 0,
                    "notes": notes,
                    "items": items
                })
            except Exception:
                continue
        return sales
    except Exception as e:
        logger.exception("Failed to list sales")
        raise


def find_sale_row(sale_id: int) -> int | None:
    _ensure_sheets_exist()
    svc = _get_sheets_service()
    try:
        resp = svc.values().get(spreadsheetId=SPREADSHEET_ID, range=f"{SALES_SHEET_NAME}!A:A").execute()
        values = resp.get('values', [])
        for idx, row in enumerate(values, start=1):
            if row and row[0]:
                try:
                    m = re.search(r"(\d+)$", str(row[0]))
                    val = int(m.group(1)) if m else None
                    if val == sale_id:
                        return idx
                except:
                    continue
        return None
    except Exception as e:
        logger.exception(f"Failed to find sale row: {e}")
        return None


def delete_sale(sale_id: int):
    _ensure_sheets_exist()
    svc = _get_sheets_service()
    row = find_sale_row(sale_id)
    if not row:
        raise ValueError("Sale not found")

    # Revert stock from items
    items_resp = svc.values().get(spreadsheetId=SPREADSHEET_ID, range=f"{SALES_ITEMS_SHEET_NAME}!A:G").execute()
    items_rows = items_resp.get('values', [])
    rows_to_delete = []
    for idx, item_row in enumerate(items_rows[1:], start=2):
        if item_row and len(item_row) > 1 and str(item_row[1]).strip() == f"SAL_{sale_id}":
            # add back stock
            prod_id = int(item_row[2]) if item_row[2] else None
            qty = float(item_row[4]) if item_row[4] else 0
            if prod_id:
                products = list_products()
                prod = next((p for p in products if p['id'] == prod_id), None)
                if prod:
                    try:
                        curr_qty, unit = parse_quantity_with_unit(prod['quantity_with_unit'])
                        new_qty = curr_qty + qty
                        update_product(prod_id, {"quantity_with_unit": format_quantity_with_unit(new_qty, unit)})
                    except Exception:
                        logger.warning(f"Failed to revert stock for product {prod_id}")
            rows_to_delete.append(idx)

    # Delete item rows in reverse
    for del_row in sorted(rows_to_delete, reverse=True):
        sheet_id = _get_sales_sheet_id()
        svc.batchUpdate(
            spreadsheetId=SPREADSHEET_ID,
            body={"requests": [{"deleteDimension": {"range": {"sheetId": sheet_id, "dimension": "ROWS", "startIndex": del_row - 1, "endIndex": del_row}}}]}
        ).execute()

    # Delete sale header row
    sheet_id = None
    meta = svc.get(spreadsheetId=SPREADSHEET_ID).execute()
    for sht in meta.get('sheets', []):
        props = sht.get('properties', {})
        if props.get('title') == SALES_SHEET_NAME:
            sheet_id = props.get('sheetId')
            break
    if sheet_id is None:
        raise ValueError('Sales sheet not found')

    svc.batchUpdate(
        spreadsheetId=SPREADSHEET_ID,
        body={"requests": [{"deleteDimension": {"range": {"sheetId": sheet_id, "dimension": "ROWS", "startIndex": row - 1, "endIndex": row}}}]}
    ).execute()

    return {"row": row}
