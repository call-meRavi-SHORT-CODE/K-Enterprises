
from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from sheets import append_employee, update_ids, update_employee, delete_employee, find_employee_row, list_employees
from products import append_product, update_product, delete_product, find_product_row, list_products
from purchases import create_purchase, list_purchases, update_purchase, delete_purchase, find_purchase_row
from sales import create_sale, list_sales, delete_sale, find_sale_row as find_sale_row_in_sheet
from stock import get_stock, list_all_stock, get_low_stock_alerts
from stock_ledger import add_ledger_entry, get_current_balance, get_opening_stock, get_closing_stock, list_ledger_entries
from drive import upload_photo
from fastapi.middleware.cors import CORSMiddleware
from models import EmployeeUpdate, ProductCreate, ProductUpdate, PurchaseCreate, SaleCreate
from api_utils import retry_api_call, is_network_error, get_user_friendly_error_message
import logging

# Timesheet helpers
from datetime import date, datetime, timedelta

# Email utility
#from drive import delete_drive_file
#from collections import Counter, defaultdict

logger = logging.getLogger(__name__)

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["*"],
)


@app.post("/employees/")
async def create_employee(
    email: str = Form(...),
    name: str = Form(...),
    position: str = Form(...),
    department: str = Form(...),
    contact: str = Form(...),
    joining_date: str = Form(...),
    profile_photo: UploadFile = File(None)
):

    data = {
        "email": email,
        "name": name,
        "position": position,
        "department": department,
        "contact": contact,
        "joining_date": joining_date
    }

    # Duplicate email check
    if find_employee_row(email):
        raise HTTPException(400, "Employee already exists")

    row_no = append_employee(data)
    if not row_no:
        raise HTTPException(500, "Could not append to sheet")

    # 2) Upload the photo to the shared profile folder (if provided)
    photo_id = None
    if profile_photo:
        try:
            photo_id = upload_photo(profile_photo)
            # 3) Update the sheet with photo ID
            if photo_id:
                update_ids(row_no, photo_id)
        except Exception as e:
            logger.warning(f"Failed to upload profile photo: {e}")
            # Continue without photo - employee is already created

    return {
        "row": row_no,
        "photo_file_id": photo_id,
        "status": "success",
        "message": "Employee created successfully"
    }


# ---------------------------------------------------------------------------
# Update employee endpoint
# ---------------------------------------------------------------------------


@app.put("/employees/{email}")
async def edit_employee(email: str, payload: EmployeeUpdate):
    # Find the existing row
    row = find_employee_row(email)
    if not row:
        raise HTTPException(404, "Employee not found")

    # Update row in Sheets
    update_employee(email, payload.dict(exclude_none=True))

    return {"status": "updated", "row": row}



# ---------------------------------------------------------------------------
# Get single employee endpoint
# ---------------------------------------------------------------------------


@app.get("/employees/{email}")
async def get_employee(email: str):
    """Return a single employee record looked-up by email (case-insensitive).

    The response mirrors an item from ``/employees/`` but adds a convenience
    ``photo_url`` field that can be embedded directly in an <img/> tag if the
    employee has a profile photo stored in Drive.
    """
    employees = list_employees()
    match = next((e for e in employees if e["email"].lower() == email.lower()), None)
    if not match:
        raise HTTPException(404, "Employee not found")

    photo_id = match.get("photo_file_id")
    if photo_id:
        match["photo_url"] = f"https://drive.google.com/uc?id={photo_id}"
    return match


# ---------------------------------------------------------------------------
# Delete employee endpoint
# ---------------------------------------------------------------------------


@app.delete("/employees/{email}")
async def remove_employee(email: str):
    row = find_employee_row(email)
    if not row:
        raise HTTPException(404, "Employee not found")

    # Delete row in Sheets and get photo_file_id
    result = delete_employee(email)
    photo_file_id = result.get("photo_file_id")

    # Delete profile photo from Drive if it exists
    if photo_file_id:
        from drive import delete_drive_file
        try:
            delete_drive_file(photo_file_id)
        except Exception as e:
            # Log error but don't fail the delete operation
            logger.warning(f"Failed to delete profile photo {photo_file_id}: {e}")

    return {"status": "deleted", "row": result["row"], "photo_deleted": photo_file_id is not None}

# ---------------------------------------------------------------------------
# List employees endpoint
# ---------------------------------------------------------------------------


@app.get("/employees/")
async def list_all_employees():
    return list_employees()



# ---------------------------------------------------------------------------
# Employee profile photo retrieval endpoint
# ---------------------------------------------------------------------------


from fastapi.responses import StreamingResponse
import io
from googleapiclient.http import MediaIoBaseDownload


@app.get("/employees/{email}/photo")
async def get_profile_photo(email: str):
    """Stream the employee's profile photo directly from Google Drive.

    Steps:
    1. Locate the employee row via email in the Sheet.
    2. Read the *photo_file_id* from column H.
    3. Download the binary from Drive and stream it back with the correct
       MIME type.
    """

    # 1) Find sheet row
    row = find_employee_row(email)
    if not row:
        raise HTTPException(404, "Employee not found")

    # 2) Fetch photo file id
    from sheets import _get_sheets_service, SPREADSHEET_ID, _get_actual_sheet_name  # type: ignore

    svc_sheets = _get_sheets_service()
    actual_sheet_name = _get_actual_sheet_name()
    resp = svc_sheets.values().get(
        spreadsheetId=SPREADSHEET_ID,
        range=f"{actual_sheet_name}!I{row}:I{row}"
    ).execute()
    vals = resp.get("values", [[]])
    photo_file_id = vals[0][0] if vals and len(vals[0]) > 0 else None

    if not photo_file_id:
        raise HTTPException(404, "Profile photo not set for this employee")

    # 3) Download from Drive
    from drive import _get_drive_service  # type: ignore

    drive_svc = _get_drive_service()

    # Retrieve mimeType first
    meta = drive_svc.files().get(fileId=photo_file_id, fields="mimeType,name").execute()
    mime_type = meta.get("mimeType", "application/octet-stream")

    # Download the file content into memory (photos are small)
    fh: io.BytesIO = io.BytesIO()
    request = drive_svc.files().get_media(fileId=photo_file_id)
    downloader = MediaIoBaseDownload(fh, request)
    done = False
    while not done:
        status, done = downloader.next_chunk()
    fh.seek(0)

    return StreamingResponse(fh, media_type=mime_type)


# ---------------------------------------------------------------------------
# Product endpoints
# ---------------------------------------------------------------------------


@app.post("/products/")
async def create_product(payload: ProductCreate):
    """Create a new product."""
    data = {
        "name": payload.name,
        "quantity_with_unit": payload.quantity_with_unit,
        "price_per_unit": payload.price_per_unit,
        "reorder_point": payload.reorder_point
    }

    try:
        result = append_product(data)
        if not result:
            raise HTTPException(500, "Could not append to sheet")

        return {
            "id": result["id"],
            "row": result["row"],
            "status": "success",
            "message": "Product created successfully"
        }
    except Exception as e:
        logger.exception("Failed to create product")
        raise HTTPException(500, f"Failed to create product: {str(e)}")


@app.get("/products/")
async def list_all_products():
    """Get all products."""
    try:
        return list_products()
    except Exception as e:
        logger.exception("Failed to list products")
        raise HTTPException(500, f"Failed to list products: {str(e)}")


@app.get("/products/{product_id}")
async def get_product(product_id: int):
    """Get a single product by ID."""
    try:
        products = list_products()
        product = next((p for p in products if p["id"] == product_id), None)
        if not product:
            raise HTTPException(404, "Product not found")
        return product
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to get product")
        raise HTTPException(500, f"Failed to get product: {str(e)}")


@app.put("/products/{product_id}")
async def edit_product(product_id: int, payload: ProductUpdate):
    """Update a product."""
    try:
        row = find_product_row(product_id)
        if not row:
            raise HTTPException(404, "Product not found")

        update_data = payload.dict(exclude_none=True)
        update_product(product_id, update_data)

        # Return updated product with combined format
        updated_product = next((p for p in list_products() if p["id"] == product_id), None)
        if updated_product:
            return updated_product
        
        return {
            "id": product_id,
            "status": "success",
            "message": "Product updated successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to update product")
        raise HTTPException(500, f"Failed to update product: {str(e)}")


@app.delete("/products/{product_id}")
async def remove_product(product_id: int):
    """Delete a product."""
    try:
        row = find_product_row(product_id)
        if not row:
            raise HTTPException(404, "Product not found")

        result = delete_product(product_id)
        return {
            "id": product_id,
            "status": "success",
            "message": "Product deleted successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to delete product")
        raise HTTPException(500, f"Failed to delete product: {str(e)}")


# ---------------------------------------------------------------------------
# Purchase endpoints
# ---------------------------------------------------------------------------


@app.post("/purchases/")
async def create_purchase_order(payload: PurchaseCreate):
    """Create a new purchase order with items."""
    try:
        # Prepare items data
        items_data = []
        for item in payload.items:
            # Get product info to include product name
            products = list_products()
            product = next((p for p in products if p["id"] == item.product_id), None)
            if not product:
                raise HTTPException(404, f"Product {item.product_id} not found")
            
            # Use provided unit_price or default to product's default_price
            unit_price = item.unit_price if item.unit_price else product.get("default_price", product.get("price_per_unit", 0))
            
            items_data.append({
                "product_id": item.product_id,
                "product_name": product["name"],
                "quantity": item.quantity,
                "unit_price": unit_price
            })
        
        result = create_purchase(
            vendor_name=payload.vendor_name,
            invoice_number=payload.invoice_number,
            purchase_date=payload.purchase_date,
            notes=payload.notes,
            items_data=items_data
        )
        
        return {
            "status": "success",
            "data": result,
            "message": "Purchase order created successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to create purchase")
        raise HTTPException(500, f"Failed to create purchase: {str(e)}")


# ---------------------------------------------------------------------------
# Sales endpoints
# ---------------------------------------------------------------------------


@app.post("/sales/")
async def create_sale_order(payload: SaleCreate):
    try:
        # Prepare items data with retry logic for API calls
        items_data = []
        
        # Fetch products with retry logic
        try:
            products_all = retry_api_call(list_products, max_retries=3, delay=1.0)
        except Exception as e:
            if is_network_error(e):
                logger.error("Network error while fetching products", exc_info=True)
                raise HTTPException(
                    status_code=503,
                    detail=get_user_friendly_error_message(e)
                )
            raise
        for item in payload.items:
            product = next((p for p in products_all if p["id"] == item.product_id), None)
            if not product:
                raise HTTPException(404, f"Product {item.product_id} not found")

            unit_price = item.unit_price if item.unit_price else product.get("default_price", product.get("price_per_unit", 0))
            items_data.append({
                "product_id": item.product_id,
                "product_name": product["name"],
                "quantity": item.quantity,
                "unit_price": unit_price
            })

        # Create sale with retry logic
        try:
            result = retry_api_call(
                lambda: create_sale(
            customer_name=payload.customer_name,
            invoice_number=payload.invoice_number,
            sale_date=payload.sale_date,
            notes=payload.notes,
            items_data=items_data
                ),
                max_retries=3,
                delay=1.0
            )
        except Exception as e:
            if is_network_error(e):
                logger.error("Network error while creating sale", exc_info=True)
                raise HTTPException(
                    status_code=503,
                    detail=get_user_friendly_error_message(e)
                )
            raise

        return {"status": "success", "data": result, "message": "Sale created successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to create sale")
        # Check if it's a network error that wasn't caught
        if is_network_error(e):
            raise HTTPException(
                status_code=503,
                detail=get_user_friendly_error_message(e)
            )
        raise HTTPException(500, f"Failed to create sale: {str(e)}")


@app.get("/sales/")
async def list_all_sales():
    try:
        return list_sales()
    except Exception as e:
        logger.exception("Failed to list sales")
        raise HTTPException(500, f"Failed to list sales: {str(e)}")


@app.get("/sales/{sale_id}")
async def get_sale(sale_id: int):
    try:
        sales = list_sales()
        match = next((s for s in sales if s["id"] == sale_id), None)
        if not match:
            raise HTTPException(404, "Sale not found")
        return match
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to fetch sale")
        raise HTTPException(500, f"Failed to fetch sale: {str(e)}")


@app.get("/stock/")
async def list_stock():
    """Get all stock entries."""
    try:
        return list_all_stock()
    except Exception as e:
        logger.exception("Failed to list stock")
        raise HTTPException(500, f"Failed to list stock: {str(e)}")


@app.get("/stock/{product_id}")
async def get_product_stock(product_id: int):
    """Get stock for a specific product."""
    try:
        stock = get_stock(product_id)
        return {"product_id": product_id, "available_stock": stock}
    except Exception as e:
        logger.exception(f"Failed to get stock for product {product_id}")
        raise HTTPException(500, f"Failed to get stock: {str(e)}")


@app.get("/stock-ledger/")
async def list_stock_ledger(product_id: int = None, limit: int = 100):
    """Get stock ledger entries, optionally filtered by product_id."""
    try:
        from stock_ledger import list_ledger_entries
        entries = list_ledger_entries(product_id=product_id, limit=limit)
        return entries
    except Exception as e:
        logger.exception("Failed to list stock ledger")
        raise HTTPException(500, f"Failed to list stock ledger: {str(e)}")


@app.get("/stock-ledger/{product_id}/balance")
async def get_product_balance_from_ledger(product_id: int):
    """Get current balance for a product from the ledger."""
    try:
        from stock_ledger import get_current_balance
        balance = get_current_balance(product_id)
        return {"product_id": product_id, "balance_quantity": balance}
    except Exception as e:
        logger.exception(f"Failed to get balance for product {product_id}")
        raise HTTPException(500, f"Failed to get balance: {str(e)}")


@app.get("/stock-ledger/{product_id}/opening/{year}/{month}")
async def get_opening_stock_for_month(product_id: int, year: int, month: int):
    """Get opening stock for a product in a given month."""
    try:
        from stock_ledger import get_opening_stock
        opening = get_opening_stock(product_id, month, year)
        return {"product_id": product_id, "month": month, "year": year, "opening_stock": opening}
    except Exception as e:
        logger.exception(f"Failed to get opening stock for product {product_id}")
        raise HTTPException(500, f"Failed to get opening stock: {str(e)}")


@app.get("/stock-ledger/{product_id}/closing/{year}/{month}")
async def get_closing_stock_for_month(product_id: int, year: int, month: int):
    """Get closing stock for a product in a given month."""
    try:
        from stock_ledger import get_closing_stock
        closing = get_closing_stock(product_id, month, year)
        return {"product_id": product_id, "month": month, "year": year, "closing_stock": closing}
    except Exception as e:
        logger.exception(f"Failed to get closing stock for product {product_id}")
        raise HTTPException(500, f"Failed to get closing stock: {str(e)}")


@app.get("/stock/alerts/low-stock")
async def get_low_stock_alerts_endpoint():
    """Get products that are below their reorder point (low stock alerts)."""
    try:
        alerts = get_low_stock_alerts()
        return {
            "alerts": alerts,
            "count": len(alerts),
            "has_alerts": len(alerts) > 0
        }
    except Exception as e:
        logger.exception("Failed to get low stock alerts")
        raise HTTPException(500, f"Failed to get low stock alerts: {str(e)}")


@app.delete("/sales/{sale_id}")
async def remove_sale_order(sale_id: int):
    try:
        row = find_sale_row_in_sheet(sale_id)
        if not row:
            raise HTTPException(404, "Sale not found")

        delete_sale(sale_id)
        return {"id": sale_id, "status": "success", "message": "Sale deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to delete sale")
        raise HTTPException(500, f"Failed to delete sale: {str(e)}")


@app.get("/purchases/")
async def list_all_purchases():
    """Get all purchases with their items."""
    try:
        return list_purchases()
    except Exception as e:
        logger.exception("Failed to list purchases")
        raise HTTPException(500, f"Failed to list purchases: {str(e)}")


@app.put("/purchases/{purchase_id}")
async def edit_purchase_order(purchase_id: int, payload: PurchaseCreate):
    """Update a purchase order."""
    try:
        row = find_purchase_row(purchase_id)
        if not row:
            raise HTTPException(404, "Purchase not found")

        # Prepare items data
        items_data = []
        for item in payload.items:
            # Get product info to include product name
            products = list_products()
            product = next((p for p in products if p["id"] == item.product_id), None)
            if not product:
                raise HTTPException(404, f"Product {item.product_id} not found")
            
            # Use provided unit_price or default to product's default_price
            unit_price = item.unit_price if item.unit_price else product.get("default_price", product.get("price_per_unit", 0))
            
            items_data.append({
                "product_id": item.product_id,
                "product_name": product["name"],
                "quantity": item.quantity,
                "unit_price": unit_price
            })
        
        result = update_purchase(
            purchase_id=purchase_id,
            vendor_name=payload.vendor_name,
            invoice_number=payload.invoice_number,
            purchase_date=str(payload.purchase_date),
            notes=payload.notes,
            items_data=items_data
        )
        
        # Return updated purchase
        updated_purchase = next((p for p in list_purchases() if p["id"] == purchase_id), None)
        if updated_purchase:
            return updated_purchase
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to update purchase")
        raise HTTPException(500, f"Failed to update purchase: {str(e)}")


@app.delete("/purchases/{purchase_id}")
async def remove_purchase_order(purchase_id: int):
    """Delete a purchase order."""
    try:
        row = find_purchase_row(purchase_id)
        if not row:
            raise HTTPException(404, "Purchase not found")

        result = delete_purchase(purchase_id)
        return {
            "id": purchase_id,
            "status": "success",
            "message": "Purchase deleted successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to delete purchase")
        raise HTTPException(500, f"Failed to delete purchase: {str(e)}")
