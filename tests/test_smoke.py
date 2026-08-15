"""Smoke tests — ensure package imports and key invariants hold without launching GUI."""

def test_imports():
    # Package imports should not require GUI
    import inkdown
    import inkdown.file_lock
    import inkdown.updater
    import inkdown.capture_validator
    assert hasattr(inkdown, "__version__")

def test_file_lock_api():
    from inkdown.file_lock import FileLock, safe_read_json, safe_write_json, atomic_write
    assert callable(FileLock)
    assert callable(safe_read_json)
    assert callable(safe_write_json)
    assert callable(atomic_write)

def test_version_files_exist():
    import os
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    assert os.path.isfile(os.path.join(repo_root, "version.txt"))
    assert os.path.isfile(os.path.join(repo_root, "version.json"))

def test_app_entry_exists():
    import os
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    assert os.path.isfile(os.path.join(repo_root, "app", "index.html"))
    assert os.path.isdir(os.path.join(repo_root, "app", "src", "scripts"))
    assert os.path.isdir(os.path.join(repo_root, "src", "inkdown"))
