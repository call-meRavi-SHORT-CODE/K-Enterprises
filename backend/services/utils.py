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
    
    Args:
        date_str: Date string in various formats
    
    Returns:
        str: Formatted date as dd-mm-yyyy
    """
    # Handle common date formats
    # If already in dd-mm-yyyy, return as is
    if re.match(r"\d{2}-\d{2}-\d{4}", date_str):
        return date_str
    
    # If in yyyy-mm-dd format, convert
    if re.match(r"\d{4}-\d{2}-\d{2}", date_str):
        parts = date_str.split("-")
        return f"{parts[2]}-{parts[1]}-{parts[0]}"
    
    # Return as is if format is unclear
    return date_str

