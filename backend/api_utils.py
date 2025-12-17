"""
Utility functions for handling Google API calls with retry logic and error handling.
"""
import time
import logging
from typing import Callable, TypeVar, Any

logger = logging.getLogger(__name__)

T = TypeVar('T')

def retry_api_call(
    func: Callable[[], T],
    max_retries: int = 3,
    delay: float = 1.0,
    backoff: float = 2.0,
    exceptions: tuple = (ConnectionResetError, ConnectionError, TimeoutError)
) -> T:
    """
    Retry an API call with exponential backoff.
    
    Args:
        func: The function to retry
        max_retries: Maximum number of retry attempts
        delay: Initial delay between retries in seconds
        backoff: Multiplier for delay after each retry
        exceptions: Tuple of exceptions to catch and retry on
        
    Returns:
        The result of the function call
        
    Raises:
        Exception: If all retries fail
    """
    last_exception = None
    
    for attempt in range(max_retries):
        try:
            return func()
        except exceptions as e:
            last_exception = e
            if attempt < max_retries - 1:
                wait_time = delay * (backoff ** attempt)
                logger.warning(
                    f"API call failed (attempt {attempt + 1}/{max_retries}): {type(e).__name__}. "
                    f"Retrying in {wait_time:.1f}s..."
                )
                time.sleep(wait_time)
            else:
                logger.error(f"API call failed after {max_retries} attempts: {type(e).__name__}")
                raise
    
    # Should never reach here, but just in case
    if last_exception:
        raise last_exception
    raise Exception("API call failed for unknown reason")


def is_network_error(exception: Exception) -> bool:
    """
    Check if an exception is a network/connection error.
    
    Args:
        exception: The exception to check
        
    Returns:
        True if it's a network error, False otherwise
    """
    network_errors = (
        ConnectionResetError,
        ConnectionError,
        TimeoutError,
        OSError,
    )
    return isinstance(exception, network_errors)


def get_user_friendly_error_message(exception: Exception) -> str:
    """
    Get a user-friendly error message for an exception.
    
    Args:
        exception: The exception that occurred
        
    Returns:
        A user-friendly error message
    """
    if is_network_error(exception):
        return "Network connection issue. Please check your internet connection and try again."
    
    error_str = str(exception)
    if "ConnectionResetError" in str(type(exception)) or "Connection reset" in error_str:
        return "Connection to server was lost. Please try again."
    
    if "Timeout" in error_str or "timed out" in error_str.lower():
        return "Request timed out. Please try again."
    
    if "quota" in error_str.lower() or "rate limit" in error_str.lower():
        return "Service temporarily unavailable due to high traffic. Please try again in a moment."
    
    return "An error occurred while processing your request. Please try again."

