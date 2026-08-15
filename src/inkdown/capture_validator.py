"""
Quick Capture Input Validation
Sanitizes user input before writing to disk.
Prevents path traversal, XSS, and file corruption.
"""
import re
import unicodedata

# Limits
MAX_CAPTURE_LENGTH = 5000
MIN_CAPTURE_LENGTH = 1

# Dangerous patterns
PATH_TRAVERSAL_PATTERN = re.compile(r'\.\.[/\\]')
NULL_BYTE_PATTERN = re.compile(r'\x00')
CONTROL_CHAR_PATTERN = re.compile(r'[\x01-\x08\x0b\x0c\x0e-\x1f]')


class ValidationError(Exception):
    """Raised when input validation fails."""
    pass


def sanitize_capture(text):
    """
    Sanitize capture text before saving.

    Args:
        text: Raw user input

    Returns:
        Tuple of (sanitized_text, list_of_modifications)

    Raises:
        ValidationError: If input is empty or invalid
    """
    modifications = []

    if text is None:
        raise ValidationError("Input is None")

    original_length = len(text)

    # Remove null bytes
    if NULL_BYTE_PATTERN.search(text):
        text = NULL_BYTE_PATTERN.sub('', text)
        modifications.append('Removed null bytes')

    # Remove control characters (except newline and tab)
    if CONTROL_CHAR_PATTERN.search(text):
        text = CONTROL_CHAR_PATTERN.sub('', text)
        modifications.append('Removed control characters')

    # Remove path traversal sequences
    if PATH_TRAVERSAL_PATTERN.search(text):
        text = PATH_TRAVERSAL_PATTERN.sub('', text)
        modifications.append('Removed path traversal sequences')

    # Normalize unicode (prevent homoglyph attacks)
    text = unicodedata.normalize('NFC', text)

    # Truncate if too long
    if len(text) > MAX_CAPTURE_LENGTH:
        text = text[:MAX_CAPTURE_LENGTH]
        modifications.append(f'Truncated from {original_length} to {MAX_CAPTURE_LENGTH} characters')

    # Strip leading/trailing whitespace
    text = text.strip()

    # Check minimum length
    if len(text) < MIN_CAPTURE_LENGTH:
        raise ValidationError("Input is empty or too short")

    return text, modifications


def validate_capture(text):
    """
    Validate capture text without modifying it.

    Args:
        text: User input

    Returns:
        Dict with validation result:
        {
            'valid': bool,
            'reason': str,
            'sanitized': str or None
        }
    """
    try:
        sanitized, modifications = sanitize_capture(text)
        return {
            'valid': True,
            'reason': '',
            'sanitized': sanitized,
            'modifications': modifications
        }
    except ValidationError as e:
        return {
            'valid': False,
            'reason': str(e),
            'sanitized': None,
            'modifications': []
        }


def sanitize_filename(name):
    """
    Sanitize a filename for safe use.

    Args:
        name: Raw filename

    Returns:
        Safe filename
    """
    if not name:
        return 'untitled.md'

    # Remove dangerous characters
    safe = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '', name)

    # Remove path traversal
    safe = safe.replace('..', '')

    # Limit length
    if len(safe) > 100:
        base, ext = os.path.splitext(safe)
        safe = base[:100 - len(ext)] + ext

    # Ensure .md extension
    if not re.search(r'\.(md|markdown|mdown|txt)$', safe, re.IGNORECASE):
        safe += '.md'

    return safe.strip() or 'untitled.md'


def validate_file_path(path, allowed_dir):
    """
    Validate that a file path is within an allowed directory.
    Prevents path traversal attacks.

    Args:
        path: File path to validate
        allowed_dir: Directory the file must be within

    Returns:
        True if path is safe, False otherwise
    """
    import os

    # Normalize both paths
    abs_path = os.path.abspath(path)
    abs_allowed = os.path.abspath(allowed_dir)

    # Check if path is within allowed directory
    return abs_path.startswith(abs_allowed + os.sep) or abs_path == abs_allowed


# Import os for sanitize_filename
import os