"""
Utility functions for employee ID generation.
"""
import re


def generate_next_employee_id(last_empid: str) -> str:
    """
    Generate the next employee ID by incrementing the numeric part.
    
    Examples:
        KP001 -> KP002
        KP012 -> KP013
        KP099 -> KP100
        KP001 -> KP002
    
    Args:
        last_empid: The last employee ID (e.g., "KP012")
    
    Returns:
        str: Next employee ID (e.g., "KP013")
    """
    if not last_empid:
        return "KP001"
    
    # Extract prefix and number (e.g., "KP" and "012")
    match = re.match(r"([A-Z]+)(\d+)", last_empid.upper())
    
    if not match:
        # If format doesn't match, default to KP001
        return "KP001"
    
    prefix = match.group(1)  # e.g., "KP"
    number_str = match.group(2)  # e.g., "012"
    
    # Convert to integer, increment, and format back
    number = int(number_str)
    next_number = number + 1
    
    # Format with same zero-padding as original
    padding = len(number_str)
    next_number_str = str(next_number).zfill(padding)
    
    # If number exceeds padding (e.g., 100 with 2-digit padding), use natural length
    if len(str(next_number)) > padding:
        next_number_str = str(next_number)
    
    return f"{prefix}{next_number_str}"


def format_date(date_str: str) -> str:
    """
    Format date to dd-mm-yyyy format.
    
    Handles dates from HTML date picker (YYYY-MM-DD format) and converts to dd-mm-yyyy
    for Google Sheets storage.
    
    Args:
        date_str: Date string in various formats (YYYY-MM-DD from date picker, dd-mm-yyyy, etc.)
    
    Returns:
        str: Formatted date as dd-mm-yyyy
    """
    if not date_str or not date_str.strip():
        return date_str
    
    date_str = date_str.strip()
    
    # If already in dd-mm-yyyy format, return as is
    if re.match(r"^\d{2}-\d{2}-\d{4}$", date_str):
        return date_str
    
    # If in yyyy-mm-dd format (from HTML date picker), convert to dd-mm-yyyy
    if re.match(r"^\d{4}-\d{2}-\d{2}$", date_str):
        parts = date_str.split("-")
        year, month, day = parts[0], parts[1], parts[2]
        return f"{day}-{month}-{year}"
    
    # Handle other formats (yyyy/mm/dd, etc.)
    if re.match(r"^\d{4}/\d{2}/\d{2}$", date_str):
        parts = date_str.split("/")
        year, month, day = parts[0], parts[1], parts[2]
        return f"{day}-{month}-{year}"
    
    # Return as is if format is unclear (let Google Sheets handle it)
    return date_str

