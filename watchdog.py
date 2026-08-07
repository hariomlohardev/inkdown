"""
Inkdown Daemon Watchdog
Monitors the daemon process and restarts it if it crashes.

Usage:
    python watchdog.py

The watchdog will:
- Start inkdown_daemon.py
- Monitor it every 5 seconds
- Restart if it crashes
- Stop after 3 crashes in 60 seconds
- Log all events to daemon-crash.log
"""
import os
import sys
import time
import subprocess
from datetime import datetime

# Configuration
DAEMON_SCRIPT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'inkdown_daemon.py')
DATA_DIR = os.path.join(os.environ.get('APPDATA', os.path.expanduser('~')), 'Inkdown')
CRASH_LOG = os.path.join(DATA_DIR, 'daemon-crash.log')
CHECK_INTERVAL = 5  # seconds
MAX_RESTARTS = 3
RESTART_WINDOW = 60  # seconds

# Track restarts
restart_times = []
user_requested_exit = False


def log(message, level='INFO'):
    """Log to crash log and console."""
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    log_line = f"[{timestamp}] WATCHDOG {level}: {message}"

    print(log_line)

    try:
        os.makedirs(DATA_DIR, exist_ok=True)
        with open(CRASH_LOG, 'a', encoding='utf-8') as f:
            f.write(log_line + '\n')
    except Exception as e:
        print(f"Watchdog logging error: {e}")


def start_daemon():
    """Start the daemon process."""
    log(f"Starting daemon: {DAEMON_SCRIPT}")

    try:
        process = subprocess.Popen(
            [sys.executable, DAEMON_SCRIPT],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        return process
    except Exception as e:
        log(f"Failed to start daemon: {e}", 'ERROR')
        return None


def is_process_alive(process):
    """Check if a process is still running."""
    if process is None:
        return False
    return process.poll() is None


def handle_crash(process):
    """Handle a daemon crash."""
    exit_code = process.poll() if process else 'unknown'
    log(f"Daemon crashed with exit code: {exit_code}", 'ERROR')

    # Try to capture output
    if process:
        try:
            stdout, stderr = process.communicate(timeout=1)
            if stderr:
                log(f"Daemon stderr: {stderr[:500]}", 'ERROR')
        except Exception:
            pass

    # Track restart time
    restart_times.append(time.time())

    # Clean up old restart times (outside window)
    cutoff = time.time() - RESTART_WINDOW
    while restart_times and restart_times[0] < cutoff:
        restart_times.pop(0)

    # Check if too many restarts
    if len(restart_times) >= MAX_RESTARTS:
        log(f"Too many crashes ({MAX_RESTARTS} in {RESTART_WINDOW}s). Stopping watchdog.", 'ERROR')
        show_error_notification(
            "Inkdown Daemon Error",
            "The daemon keeps crashing. Please check the logs at:\n" + CRASH_LOG
        )
        return False

    return True


def show_error_notification(title, message):
    """Show an error notification."""
    try:
        from win10toast import ToastNotifier
        toaster = ToastNotifier()
        toaster.show_toast(title, message, duration=10, threaded=True)
    except ImportError:
        print(f"\n{'='*50}\n{title}\n{message}\n{'='*50}\n")
    except Exception:
        print(f"\n{title}: {message}\n")


def check_dependencies():
    """Check if required dependencies are installed."""
    required = ['webview', 'keyboard', 'pystray', 'PIL']
    missing = []

    for module in required:
        try:
            __import__(module)
        except ImportError:
            missing.append(module)

    if missing:
        log(f"Missing dependencies: {', '.join(missing)}", 'ERROR')
        print(f"\nERROR: Missing required packages: {', '.join(missing)}")
        print("Install them with:")
        print(f"  pip install {' '.join(missing)}")
        return False

    return True


def main():
    global user_requested_exit

    log("=" * 50)
    log("Inkdown Watchdog Starting")
    log(f"Daemon script: {DAEMON_SCRIPT}")
    log(f"Crash log: {CRASH_LOG}")
    log("=" * 50)

    # Check dependencies
    if not check_dependencies():
        sys.exit(1)

    # Check daemon script exists
    if not os.path.exists(DAEMON_SCRIPT):
        log(f"Daemon script not found: {DAEMON_SCRIPT}", 'ERROR')
        sys.exit(1)

    # Main watchdog loop
    process = None

    try:
        while True:
            # Start daemon if not running
            if process is None or not is_process_alive(process):
                if process is not None:
                    # Process died - handle crash
                    if not handle_crash(process):
                        break

                # Wait before restart (except first time)
                if process is not None:
                    log("Waiting 5 seconds before restart...")
                    time.sleep(5)

                process = start_daemon()

                if process is None:
                    log("Failed to start daemon, retrying in 5s", 'ERROR')
                    time.sleep(5)
                    continue

                log(f"Daemon started with PID {process.pid}")

            # Wait before next check
            time.sleep(CHECK_INTERVAL)

    except KeyboardInterrupt:
        log("Watchdog interrupted by user")
        user_requested_exit = True

    finally:
        # Clean up daemon process
        if process and is_process_alive(process):
            log("Terminating daemon process...")
            process.terminate()

            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                log("Daemon didn't terminate, killing...", 'WARNING')
                process.kill()

        log("Watchdog stopped")


if __name__ == '__main__':
    main()