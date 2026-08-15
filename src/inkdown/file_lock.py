"""
File Locking Utility for Inkdown
Prevents race conditions when daemon and main app write simultaneously.

Usage:
    from file_lock import FileLock, atomic_write

    with FileLock('/path/to/file.json'):
        atomic_write('/path/to/file.json', '{"data": "value"}')
"""
import os
import time
import tempfile
import errno


class FileLockError(Exception):
    """Raised when a file lock cannot be acquired."""
    pass


class FileLock:
    """
    Cross-platform file lock using lock files.

    Usage:
        with FileLock('/path/to/file'):
            # Critical section - only one process can be here
            do_something()
    """

    def __init__(self, path, timeout=10, retry_delay=0.1):
        self.path = path
        self.lock_path = path + '.lock'
        self.timeout = timeout
        self.retry_delay = retry_delay
        self._acquired = False

    def acquire(self):
        """Acquire the lock. Raises FileLockError on timeout."""
        start_time = time.time()

        while True:
            try:
                # Try to create lock file exclusively
                fd = os.open(self.lock_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
                os.write(fd, str(os.getpid()).encode())
                os.close(fd)
                self._acquired = True
                return True

            except OSError as e:
                if e.errno != errno.EEXIST:
                    raise FileLockError(f"Failed to create lock: {e}")

                # Lock exists - check if stale
                if self._is_stale_lock():
                    self._remove_stale_lock()
                    continue

                # Check timeout
                elapsed = time.time() - start_time
                if elapsed >= self.timeout:
                    raise FileLockError(
                        f"Timeout acquiring lock for {self.path} after {self.timeout}s"
                    )

                time.sleep(self.retry_delay)

    def release(self):
        """Release the lock."""
        if self._acquired:
            try:
                os.remove(self.lock_path)
            except OSError:
                pass  # Lock file already gone
            self._acquired = False

    def _is_stale_lock(self):
        """Check if lock file is older than 30 seconds (stale)."""
        try:
            lock_age = time.time() - os.path.getmtime(self.lock_path)
            return lock_age > 30
        except OSError:
            return False

    def _remove_stale_lock(self):
        """Remove a stale lock file."""
        try:
            os.remove(self.lock_path)
        except OSError:
            pass

    def __enter__(self):
        self.acquire()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.release()
        return False


def atomic_write(path, content, encoding='utf-8'):
    """
    Atomically write content to a file.

    Writes to a temp file first, then renames. This ensures the file
    is never in a partially-written state.

    Args:
        path: Target file path
        content: String content to write
        encoding: File encoding (default utf-8)

    Raises:
        IOError: If write fails
    """
    dir_path = os.path.dirname(path) or '.'

    # Ensure directory exists
    os.makedirs(dir_path, exist_ok=True)

    # Write to temp file in same directory (required for atomic rename)
    fd, temp_path = tempfile.mkstemp(dir=dir_path, prefix='.tmp_', suffix='.tmp')

    try:
        with os.fdopen(fd, 'w', encoding=encoding) as f:
            f.write(content)
            f.flush()
            os.fsync(f.fileno())  # Ensure data is on disk

        # Atomic rename (on Windows, need to remove target first)
        if os.path.exists(path):
            os.remove(path)
        os.rename(temp_path, path)

    except Exception:
        # Clean up temp file on failure
        try:
            os.remove(temp_path)
        except OSError:
            pass
        raise


def safe_read_json(path, default=None):
    """
    Safely read a JSON file with file locking.

    Args:
        path: File path
        default: Value to return if file doesn't exist or is invalid

    Returns:
        Parsed JSON or default
    """
    import json

    try:
        with FileLock(path, timeout=5):
            if not os.path.exists(path):
                return default
            with open(path, 'r', encoding='utf-8') as f:
                return json.load(f)
    except (FileLockError, json.JSONDecodeError, IOError, OSError):
        return default


def safe_write_json(path, data):
    """
    Safely write JSON data with file locking and atomic write.

    Args:
        path: File path
        data: Data to serialize as JSON

    Returns:
        True on success, False on failure
    """
    import json

    try:
        with FileLock(path, timeout=10):
            atomic_write(path, json.dumps(data, ensure_ascii=False, indent=2))
        return True
    except (FileLockError, IOError, OSError) as e:
        print(f"[FileLock] Write failed for {path}: {e}")
        return False