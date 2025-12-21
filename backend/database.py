"""
SQLite Database Module - Replaces Google Sheets

Provides all database operations for:
- Employees
- Products
- Purchases & Purchase Items
- Sales & Sale Items
- Stock
- Stock Ledger
"""

import sqlite3
import os
import logging
from datetime import date, datetime, timedelta
from typing import Optional, List, Dict, Any
from contextlib import contextmanager
from pathlib import Path

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Database file path
DB_PATH = os.path.join(os.path.dirname(__file__), "enterprise.db")


@contextmanager
def get_db_connection():
    """Context manager for database connections.

    Uses a longer timeout to reduce "database is locked" errors under concurrent
    access. Ensures foreign keys are enabled for each connection.
    """
    # Increase timeout to allow SQLite to wait for locked connections
    conn = sqlite3.connect(DB_PATH, timeout=30)
    conn.row_factory = sqlite3.Row  # Access columns by name
    # Ensure foreign keys are enforced for each connection
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    except Exception as e:
        conn.rollback()
        logger.error(f"Database error: {e}")
        raise
    finally:
        conn.close()


def init_db():
    """Initialize database with all required tables"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    # Use Write-Ahead Logging to improve concurrent read/write performance
    try:
        cursor.execute("PRAGMA journal_mode = WAL")
    except Exception:
        pass
    
    # Create Employees table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS employees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        position TEXT NOT NULL,
        department TEXT NOT NULL,
        contact TEXT NOT NULL,
        joining_date TEXT NOT NULL,
        photo_file_id TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    # Create Products table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        quantity_with_unit TEXT NOT NULL,
        price_per_unit REAL NOT NULL,
        reorder_point INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    # Create Purchases table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS purchases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vendor_name TEXT NOT NULL,
        invoice_number TEXT NOT NULL,
        purchase_date TEXT NOT NULL,
        notes TEXT,
        total_amount REAL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    # Create Purchase Items table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS purchase_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        purchase_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        product_name TEXT NOT NULL,
        quantity REAL NOT NULL,
        unit_price REAL NOT NULL,
        total_price REAL,
        FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id)
    )
    """)
    
    # Create Sales table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_name TEXT NOT NULL,
        invoice_number TEXT NOT NULL,
        sale_date TEXT NOT NULL,
        notes TEXT,
        total_amount REAL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    # Create Sale Items table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS sale_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        product_name TEXT NOT NULL,
        quantity REAL NOT NULL,
        unit_price REAL NOT NULL,
        total_price REAL,
        FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id)
    )
    """)
    
    # Create Stock table (current stock levels)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS stock (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL UNIQUE,
        available_stock REAL NOT NULL DEFAULT 0,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id)
    )
    """)
    
    # Create Stock Ledger table (transaction history)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS stock_ledger (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        transaction_type TEXT NOT NULL,
        quantity REAL NOT NULL,
        reference_id TEXT,
        reference_type TEXT,
        notes TEXT,
        transaction_date TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id)
    )
    """)
    
    conn.commit()
    conn.close()
    logger.info(f"Database initialized at {DB_PATH}")


# ============================================================================
# EMPLOYEE OPERATIONS
# ============================================================================

def create_employee(email: str, name: str, position: str, department: str, 
                   contact: str, joining_date: str) -> Dict[str, Any]:
    """Create a new employee"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO employees (email, name, position, department, contact, joining_date)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (email, name, position, department, contact, joining_date))
        
        employee_id = cursor.lastrowid
        return {"id": employee_id, "email": email}


def get_employee_by_email(email: str) -> Optional[Dict[str, Any]]:
    """Get employee by email"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM employees WHERE LOWER(email) = LOWER(?)", (email,))
        row = cursor.fetchone()
        return dict(row) if row else None


def update_employee(email: str, updates: Dict[str, Any]) -> bool:
    """Update employee information"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        set_clause = ", ".join([f"{k} = ?" for k in updates.keys()])
        cursor.execute(
            f"UPDATE employees SET {set_clause}, updated_at = CURRENT_TIMESTAMP WHERE LOWER(email) = LOWER(?)",
            (*updates.values(), email)
        )
        return cursor.rowcount > 0


def delete_employee(email: str) -> Dict[str, Any]:
    """Delete employee and return info (row count and photo_file_id)"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        # Fetch photo_file_id before deleting so caller can remove Drive file if needed
        cursor.execute("SELECT photo_file_id FROM employees WHERE LOWER(email) = LOWER(?)", (email,))
        row = cursor.fetchone()
        photo_file_id = row["photo_file_id"] if row else None
        cursor.execute("DELETE FROM employees WHERE LOWER(email) = LOWER(?)", (email,))
        return {"row": cursor.rowcount, "photo_file_id": photo_file_id}


def list_all_employees() -> List[Dict[str, Any]]:
    """List all employees"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM employees ORDER BY name")
        return [dict(row) for row in cursor.fetchall()]


def update_employee_photo(email: str, photo_file_id: str) -> bool:
    """Update employee profile photo ID"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE employees SET photo_file_id = ?, updated_at = CURRENT_TIMESTAMP WHERE LOWER(email) = LOWER(?)",
            (photo_file_id, email)
        )
        return cursor.rowcount > 0


# ============================================================================
# PRODUCT OPERATIONS
# ============================================================================

def create_product(name: str, quantity_with_unit: str, price_per_unit: float, 
                   reorder_point: Optional[int] = None) -> Dict[str, Any]:
    """Create a new product"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO products (name, quantity_with_unit, price_per_unit, reorder_point)
            VALUES (?, ?, ?, ?)
        """, (name, quantity_with_unit, price_per_unit, reorder_point))
        
        product_id = cursor.lastrowid
        
        # Initialize stock for this product
        cursor.execute("""
            INSERT INTO stock (product_id, available_stock)
            VALUES (?, 0)
        """, (product_id,))
        
        return {"id": product_id, "name": name}


def get_product_by_id(product_id: int) -> Optional[Dict[str, Any]]:
    """Get product by ID"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM products WHERE id = ?", (product_id,))
        row = cursor.fetchone()
        return dict(row) if row else None


def update_product(product_id: int, updates: Dict[str, Any]) -> bool:
    """Update product information"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        set_clause = ", ".join([f"{k} = ?" for k in updates.keys()])
        cursor.execute(
            f"UPDATE products SET {set_clause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (*updates.values(), product_id)
        )
        return cursor.rowcount > 0


def delete_product(product_id: int) -> bool:
    """Delete product"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        # Delete stock entries first
        cursor.execute("DELETE FROM stock WHERE product_id = ?", (product_id,))
        # Delete product
        cursor.execute("DELETE FROM products WHERE id = ?", (product_id,))
        return cursor.rowcount > 0


def list_all_products() -> List[Dict[str, Any]]:
    """List all products"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM products ORDER BY name")
        return [dict(row) for row in cursor.fetchall()]


# ============================================================================
# PURCHASE OPERATIONS
# ============================================================================

def create_purchase(vendor_name: str, invoice_number: str, purchase_date: str, 
                   items_data: List[Dict[str, Any]], notes: Optional[str] = None) -> Dict[str, Any]:
    """Create a new purchase order with items"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Calculate total
        total_amount = sum(item["quantity"] * item["unit_price"] for item in items_data)
        
        cursor.execute("""
            INSERT INTO purchases (vendor_name, invoice_number, purchase_date, notes, total_amount)
            VALUES (?, ?, ?, ?, ?)
        """, (vendor_name, invoice_number, purchase_date, notes, total_amount))
        
        purchase_id = cursor.lastrowid
        
        # Insert items and update stock
        for item in items_data:
            item_total = item["quantity"] * item["unit_price"]
            cursor.execute("""
                INSERT INTO purchase_items (purchase_id, product_id, product_name, quantity, unit_price, total_price)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (purchase_id, item["product_id"], item["product_name"], item["quantity"], 
                  item["unit_price"], item_total))
            
            # Update stock (use same DB connection to avoid nested transactions locking the DB)
            update_stock(item["product_id"], item["quantity"], "purchase", 
                        reference_id=str(purchase_id), notes=f"Purchase {invoice_number}", conn=conn)
        
        return {"id": purchase_id, "total_amount": total_amount}


def get_purchase_by_id(purchase_id: int) -> Optional[Dict[str, Any]]:
    """Get purchase with items by ID"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Get purchase header
        cursor.execute("SELECT * FROM purchases WHERE id = ?", (purchase_id,))
        row = cursor.fetchone()
        if not row:
            return None
        
        purchase = dict(row)
        
        # Get items
        cursor.execute("SELECT * FROM purchase_items WHERE purchase_id = ?", (purchase_id,))
        purchase["items"] = [dict(item_row) for item_row in cursor.fetchall()]
        
        return purchase


def list_all_purchases() -> List[Dict[str, Any]]:
    """List all purchases"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM purchases ORDER BY purchase_date DESC")
        purchases = [dict(row) for row in cursor.fetchall()]
        
        # Get items for each purchase
        for purchase in purchases:
            cursor.execute("SELECT * FROM purchase_items WHERE purchase_id = ?", (purchase["id"],))
            purchase["items"] = [dict(item_row) for item_row in cursor.fetchall()]
        
        return purchases


def update_purchase(purchase_id: int, updates: Dict[str, Any]) -> bool:
    """Update purchase information"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        set_clause = ", ".join([f"{k} = ?" for k in updates.keys()])
        cursor.execute(
            f"UPDATE purchases SET {set_clause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (*updates.values(), purchase_id)
        )
        return cursor.rowcount > 0


def delete_purchase(purchase_id: int) -> bool:
    """Delete purchase and associated stock movements"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Get items to reverse stock
        cursor.execute("SELECT product_id, quantity FROM purchase_items WHERE purchase_id = ?", (purchase_id,))
        items = cursor.fetchall()
        
        for item in items:
            product_id, quantity = item[0], item[1]
            # Reverse the stock addition (use same DB connection)
            update_stock(product_id, -quantity, "purchase_return", 
                        reference_id=str(purchase_id), notes="Purchase deleted", conn=conn)
        
        # Delete purchase items and purchase
        cursor.execute("DELETE FROM purchase_items WHERE purchase_id = ?", (purchase_id,))
        cursor.execute("DELETE FROM purchases WHERE id = ?", (purchase_id,))
        
        return cursor.rowcount > 0


# ============================================================================
# SALES OPERATIONS
# ============================================================================

def create_sale(customer_name: str, invoice_number: str, sale_date: str, 
               items_data: List[Dict[str, Any]], notes: Optional[str] = None) -> Dict[str, Any]:
    """Create a new sale order with items"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Calculate total
        total_amount = sum(item["quantity"] * item["unit_price"] for item in items_data)
        
        cursor.execute("""
            INSERT INTO sales (customer_name, invoice_number, sale_date, notes, total_amount)
            VALUES (?, ?, ?, ?, ?)
        """, (customer_name, invoice_number, sale_date, notes, total_amount))
        
        sale_id = cursor.lastrowid
        
        # Insert items and update stock
        for item in items_data:
            item_total = item["quantity"] * item["unit_price"]
            cursor.execute("""
                INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, total_price)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (sale_id, item["product_id"], item["product_name"], item["quantity"], 
                  item["unit_price"], item_total))
            
            # Update stock (decrease) using same DB connection
            update_stock(item["product_id"], -item["quantity"], "sale", 
                        reference_id=str(sale_id), notes=f"Sale {invoice_number}", conn=conn)
        
        return {"id": sale_id, "total_amount": total_amount}


def get_sale_by_id(sale_id: int) -> Optional[Dict[str, Any]]:
    """Get sale with items by ID"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Get sale header
        cursor.execute("SELECT * FROM sales WHERE id = ?", (sale_id,))
        row = cursor.fetchone()
        if not row:
            return None
        
        sale = dict(row)
        
        # Get items
        cursor.execute("SELECT * FROM sale_items WHERE sale_id = ?", (sale_id,))
        sale["items"] = [dict(item_row) for item_row in cursor.fetchall()]
        
        return sale


def list_all_sales() -> List[Dict[str, Any]]:
    """List all sales"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM sales ORDER BY sale_date DESC")
        sales = [dict(row) for row in cursor.fetchall()]
        
        # Get items for each sale
        for sale in sales:
            cursor.execute("SELECT * FROM sale_items WHERE sale_id = ?", (sale["id"],))
            sale["items"] = [dict(item_row) for item_row in cursor.fetchall()]
        
        return sales


def delete_sale(sale_id: int) -> bool:
    """Delete sale and reverse stock movements"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Get items to reverse stock
        cursor.execute("SELECT product_id, quantity FROM sale_items WHERE sale_id = ?", (sale_id,))
        items = cursor.fetchall()
        
        for item in items:
            product_id, quantity = item[0], item[1]
            # Reverse the stock deduction (use same DB connection)
            update_stock(product_id, quantity, "sale_return", 
                        reference_id=str(sale_id), notes="Sale deleted", conn=conn)
        
        # Delete sale items and sale
        cursor.execute("DELETE FROM sale_items WHERE sale_id = ?", (sale_id,))
        cursor.execute("DELETE FROM sales WHERE id = ?", (sale_id,))
        
        return cursor.rowcount > 0


# ============================================================================
# STOCK OPERATIONS
# ============================================================================

def update_stock(product_id: int, quantity_change: float, transaction_type: str, 
                reference_id: Optional[str] = None, notes: Optional[str] = None, conn: Optional[sqlite3.Connection] = None) -> Dict[str, Any]:
    """Update stock and create ledger entry.

    If a database connection is supplied via `conn`, use it so callers can perform
    multiple related writes within the same transaction (avoids nested connections
    and potential "database is locked" errors). Otherwise a new connection is used.
    """
    # Helper that performs the update using the provided cursor
    def _do_update(cursor):
        # Update or create stock entry
        cursor.execute("SELECT available_stock FROM stock WHERE product_id = ?", (product_id,))
        row = cursor.fetchone()

        if row:
            new_stock = row[0] + quantity_change
            cursor.execute("""
                UPDATE stock SET available_stock = ?, last_updated = CURRENT_TIMESTAMP 
                WHERE product_id = ?
            """, (new_stock, product_id))
        else:
            new_stock = quantity_change
            cursor.execute("""
                INSERT INTO stock (product_id, available_stock)
                VALUES (?, ?)
            """, (product_id, new_stock))

        # Add ledger entry
        transaction_date = datetime.now().strftime("%Y-%m-%d")
        cursor.execute("""
            INSERT INTO stock_ledger (product_id, transaction_type, quantity, reference_id, 
                                     reference_type, notes, transaction_date)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (product_id, transaction_type, quantity_change, reference_id, 
              transaction_type, notes, transaction_date))

        return {"product_id": product_id, "new_balance": new_stock}

    if conn is not None:
        cursor = conn.cursor()
        return _do_update(cursor)
    else:
        with get_db_connection() as _conn:
            cursor = _conn.cursor()
            return _do_update(cursor)


def get_stock(product_id: int) -> float:
    """Get current stock for a product"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT available_stock FROM stock WHERE product_id = ?", (product_id,))
        row = cursor.fetchone()
        return row[0] if row else 0.0


def list_all_stock() -> List[Dict[str, Any]]:
    """List all stock entries with product names"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT s.id, s.product_id, p.name as product_name, s.available_stock, s.last_updated
            FROM stock s
            JOIN products p ON s.product_id = p.id
            ORDER BY p.name
        """)
        return [dict(row) for row in cursor.fetchall()]


def get_low_stock_alerts() -> List[Dict[str, Any]]:
    """Get products below reorder point"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT 
                p.id as product_id,
                p.name as product_name,
                COALESCE(s.available_stock, 0) as current_stock,
                p.reorder_point,
                (p.reorder_point - COALESCE(s.available_stock, 0)) as shortage
            FROM products p
            LEFT JOIN stock s ON p.id = s.product_id
            WHERE p.reorder_point IS NOT NULL 
              AND (s.available_stock IS NULL OR s.available_stock < p.reorder_point)
            ORDER BY shortage DESC
        """)
        return [dict(row) for row in cursor.fetchall()]


# ---------------------------------------------------------------------------
# REPORTS
# ---------------------------------------------------------------------------

def get_current_stock_report(start_date: str | None = None, end_date: str | None = None) -> List[Dict[str, Any]]:
    """Get current stock report per product.

    If start_date/end_date are provided (YYYY-MM-DD), purchased and sold are
    aggregated within that inclusive date range. Opening is calculated from
    stock_ledger sums before the start_date. Closing = opening + purchased - sold.
    """
    # Default date window: from epoch to today
    from datetime import datetime, date
    if end_date is None:
        end_date = date.today().strftime("%Y-%m-%d")
    if start_date is None:
        start_date = '1970-01-01'

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT
                p.id as product_id,
                p.name as product_name,
                -- Opening stock from ledger before start_date
                COALESCE((SELECT SUM(quantity) FROM stock_ledger sl WHERE sl.product_id = p.id AND sl.transaction_date < ?), 0) as opening,
                -- Purchased within range from purchase_items JOIN purchases
                COALESCE((SELECT SUM(pi.quantity) FROM purchase_items pi JOIN purchases pu ON pi.purchase_id = pu.id WHERE pi.product_id = p.id AND pu.purchase_date BETWEEN ? AND ?), 0) as purchased,
                -- Sold within range from sale_items JOIN sales
                COALESCE((SELECT SUM(si.quantity) FROM sale_items si JOIN sales s ON si.sale_id = s.id WHERE si.product_id = p.id AND s.sale_date BETWEEN ? AND ?), 0) as sold
            FROM products p
            ORDER BY p.name
        """, (start_date, start_date, end_date, start_date, end_date))

        rows = [dict(r) for r in cursor.fetchall()]
        # Compute closing
        for r in rows:
            r['closing'] = (r.get('opening', 0) or 0) + (r.get('purchased', 0) or 0) - (r.get('sold', 0) or 0)
        return rows


def get_monthly_opening_closing(year: int, month: int) -> List[Dict[str, Any]]:
    """Get opening and closing stock for each product for the given month."""
    from calendar import monthrange
    start_date = f"{year:04d}-{month:02d}-01"
    last_day = monthrange(year, month)[1]
    end_date = f"{year:04d}-{month:02d}-{last_day:02d}"

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT
                p.id as product_id,
                p.name as product_name,
                COALESCE((SELECT SUM(quantity) FROM stock_ledger sl WHERE sl.product_id = p.id AND sl.transaction_date < ?), 0) as opening,
                COALESCE((SELECT SUM(quantity) FROM stock_ledger sl WHERE sl.product_id = p.id AND sl.transaction_date <= ?), 0) as closing
            FROM products p
            ORDER BY p.name
        """, (start_date, end_date))

        rows = [dict(r) for r in cursor.fetchall()]
        return rows


def get_kpis() -> Dict[str, Any]:
    """Compute simple KPIs for the dashboard.

    Returns a dictionary with nested metric objects, e.g.
    {
        'todays_sales': {'value': float, 'change_pct': float|None},
        'month_revenue': {'value': float, 'change_pct': float|None},
        'low_stock_count': {'value': int},
        'best_selling_product': 'Name' | None,
        'profit_today': {'value': float|None, 'change_pct': float|None}
    }
    """
    today = date.today().strftime("%Y-%m-%d")
    yesterday = (date.today() - timedelta(days=1)).strftime("%Y-%m-%d")
    current_month = date.today().strftime("%Y-%m")
    # previous month (take first day of current month, subtract one day)
    first_of_month = date.today().replace(day=1)
    prev_month_date = first_of_month - timedelta(days=1)
    prev_month = prev_month_date.strftime("%Y-%m")

    with get_db_connection() as conn:
        cursor = conn.cursor()
        # Today's sales
        cursor.execute("SELECT COALESCE(SUM(total_amount), 0) FROM sales WHERE sale_date = ?", (today,))
        todays_sales = float(cursor.fetchone()[0] or 0)

        # Yesterday's sales for comparison
        cursor.execute("SELECT COALESCE(SUM(total_amount), 0) FROM sales WHERE sale_date = ?", (yesterday,))
        yest_sales = float(cursor.fetchone()[0] or 0)
        todays_change_pct = None
        if yest_sales != 0:
            todays_change_pct = (todays_sales - yest_sales) / yest_sales * 100

        # Month revenue
        cursor.execute("SELECT COALESCE(SUM(total_amount), 0) FROM sales WHERE substr(sale_date,1,7) = ?", (current_month,))
        month_revenue = float(cursor.fetchone()[0] or 0)
        cursor.execute("SELECT COALESCE(SUM(total_amount), 0) FROM sales WHERE substr(sale_date,1,7) = ?", (prev_month,))
        prev_month_revenue = float(cursor.fetchone()[0] or 0)
        month_change_pct = None
        if prev_month_revenue != 0:
            month_change_pct = (month_revenue - prev_month_revenue) / prev_month_revenue * 100

        # Low stock count
        low_alerts = get_low_stock_alerts()
        low_stock_count = len(low_alerts)

        # Best selling product this month (by quantity)
        cursor.execute(
            """
            SELECT si.product_name, COALESCE(SUM(si.quantity),0) as qty
            FROM sale_items si
            JOIN sales s ON si.sale_id = s.id
            WHERE substr(s.sale_date,1,7) = ?
            GROUP BY si.product_id
            ORDER BY qty DESC
            LIMIT 1
            """,
            (current_month,)
        )
        row = cursor.fetchone()
        best_selling = row[0] if row else None

        # Profit today: not enough cost information to calculate reliably; leave null for now
        profit_today = None

        return {
            'todays_sales': {'value': todays_sales, 'change_pct': todays_change_pct},
            'month_revenue': {'value': month_revenue, 'change_pct': month_change_pct},
            'low_stock_count': {'value': low_stock_count},
            'best_selling_product': best_selling,
            'profit_today': {'value': profit_today, 'change_pct': None}
        }


# ---------------------------------------------------------------------------
# SALES REPORTS
# ---------------------------------------------------------------------------

def get_monthly_sales_summary(start_date: Optional[str] = None, end_date: Optional[str] = None) -> List[Dict[str, Any]]:
    """Return monthly summary rows: month (YYYY-MM), total_sales, total_quantity_sold, avg_sale_value."""
    if end_date is None:
        end_date = date.today().strftime("%Y-%m-%d")
    if start_date is None:
        # default to 12 months back
        d = date.today() - timedelta(days=365)
        start_date = d.strftime("%Y-%m-%d")

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT
                substr(s.sale_date,1,7) AS month,
                COALESCE(SUM(s.total_amount), 0) AS total_sales,
                COALESCE(SUM(si.quantity), 0) AS total_quantity_sold,
                CASE WHEN COUNT(DISTINCT s.id) = 0 THEN 0 ELSE ROUND(SUM(s.total_amount) / COUNT(DISTINCT s.id), 2) END AS avg_sale_value
            FROM sales s
            LEFT JOIN sale_items si ON si.sale_id = s.id
            WHERE s.sale_date BETWEEN ? AND ?
            GROUP BY month
            ORDER BY month
        """, (start_date, end_date))
        return [dict(r) for r in cursor.fetchall()]


def get_yearly_sales_summary(start_date: Optional[str] = None, end_date: Optional[str] = None) -> List[Dict[str, Any]]:
    """Return yearly summary rows: year (YYYY), total_sales, total_quantity_sold, avg_sale_value."""
    if end_date is None:
        end_date = date.today().strftime("%Y-%m-%d")
    if start_date is None:
        # default to 3 years back
        d = date.today() - timedelta(days=365 * 3)
        start_date = d.strftime("%Y-%m-%d")

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT
                substr(s.sale_date,1,4) AS year,
                COALESCE(SUM(s.total_amount), 0) AS total_sales,
                COALESCE(SUM(si.quantity), 0) AS total_quantity_sold,
                CASE WHEN COUNT(DISTINCT s.id) = 0 THEN 0 ELSE ROUND(SUM(s.total_amount) / COUNT(DISTINCT s.id), 2) END AS avg_sale_value
            FROM sales s
            LEFT JOIN sale_items si ON si.sale_id = s.id
            WHERE s.sale_date BETWEEN ? AND ?
            GROUP BY year
            ORDER BY year
        """, (start_date, end_date))
        return [dict(r) for r in cursor.fetchall()]


def get_product_wise_sales(start_date: Optional[str] = None, end_date: Optional[str] = None) -> List[Dict[str, Any]]:
    """Return product-wise sales: product_name, quantity_sold, revenue"""
    if end_date is None:
        end_date = date.today().strftime("%Y-%m-%d")
    if start_date is None:
        d = date.today() - timedelta(days=365)
        start_date = d.strftime("%Y-%m-%d")

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT
                si.product_id as product_id,
                si.product_name as product_name,
                COALESCE(SUM(si.quantity), 0) AS quantity_sold,
                COALESCE(SUM(si.total_price), 0) AS revenue
            FROM sale_items si
            JOIN sales s ON si.sale_id = s.id
            WHERE s.sale_date BETWEEN ? AND ?
            GROUP BY si.product_id
            ORDER BY revenue DESC
        """, (start_date, end_date))
        return [dict(r) for r in cursor.fetchall()]


def get_top_selling_products(start_date: Optional[str] = None, end_date: Optional[str] = None, limit: int = 10) -> List[Dict[str, Any]]:
    """Return top selling products by quantity sold (limit applies)."""
    if end_date is None:
        end_date = date.today().strftime("%Y-%m-%d")
    if start_date is None:
        d = date.today() - timedelta(days=365)
        start_date = d.strftime("%Y-%m-%d")

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT
                si.product_id as product_id,
                si.product_name as product_name,
                COALESCE(SUM(si.quantity), 0) AS qty_sold
            FROM sale_items si
            JOIN sales s ON si.sale_id = s.id
            WHERE s.sale_date BETWEEN ? AND ?
            GROUP BY si.product_id
            ORDER BY qty_sold DESC
            LIMIT ?
        """, (start_date, end_date, limit))
        return [dict(r) for r in cursor.fetchall()]


def get_dead_stock(days: int = 60, limit: int | None = None) -> List[Dict[str, Any]]:
    """Return products that have not been sold in the last `days` days. Includes last_sold_date and stock remaining."""
    cutoff = (date.today() - timedelta(days=days)).strftime("%Y-%m-%d")

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT
                p.id as product_id,
                p.name as product_name,
                MAX(s.sale_date) as last_sold_date,
                COALESCE(st.available_stock, 0) as stock_remaining
            FROM products p
            LEFT JOIN sale_items si ON si.product_id = p.id
            LEFT JOIN sales s ON s.id = si.sale_id
            LEFT JOIN stock st ON st.product_id = p.id
            GROUP BY p.id
            HAVING (MAX(s.sale_date) IS NULL OR MAX(s.sale_date) <= ?)
            ORDER BY last_sold_date ASC
        """, (cutoff,))

        rows = [dict(r) for r in cursor.fetchall()]
        if limit is not None:
            return rows[:limit]
        return rows


# ============================================================================
# STOCK LEDGER OPERATIONS
# ============================================================================

def list_ledger_entries(product_id: Optional[int] = None, limit: int = 100) -> List[Dict[str, Any]]:
    """List stock ledger entries"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        if product_id:
            cursor.execute("""
                SELECT * FROM stock_ledger 
                WHERE product_id = ?
                ORDER BY transaction_date DESC, id DESC
                LIMIT ?
            """, (product_id, limit))
        else:
            cursor.execute("""
                SELECT * FROM stock_ledger 
                ORDER BY transaction_date DESC, id DESC
                LIMIT ?
            """, (limit,))
        
        return [dict(row) for row in cursor.fetchall()]


def get_current_balance(product_id: int) -> float:
    """Get current stock balance for product"""
    return get_stock(product_id)


def get_opening_stock(product_id: int, year: int, month: int) -> float:
    """Get opening stock for a month (first transaction or 0)"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        month_str = f"{year:04d}-{month:02d}"
        
        cursor.execute("""
            SELECT 
                COALESCE(SUM(quantity), 0) as opening_balance
            FROM stock_ledger
            WHERE product_id = ? 
              AND transaction_date < ?
        """, (product_id, month_str + "-01"))
        
        row = cursor.fetchone()
        return row[0] if row and row[0] else 0.0


def get_closing_stock(product_id: int, year: int, month: int) -> float:
    """Get closing stock for a month"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        month_str = f"{year:04d}-{month:02d}"
        next_month = month + 1 if month < 12 else 1
        next_year = year if month < 12 else year + 1
        
        cursor.execute("""
            SELECT 
                COALESCE(SUM(quantity), 0) as closing_balance
            FROM stock_ledger
            WHERE product_id = ? 
              AND transaction_date < ?
        """, (product_id, f"{next_year:04d}-{next_month:02d}-01"))
        
        row = cursor.fetchone()
        return row[0] if row and row[0] else 0.0


# Initialize database on module import
if not os.path.exists(DB_PATH):
    init_db()
else:
    logger.info(f"Using existing database at {DB_PATH}")
