import logging
import os
from logging.handlers import RotatingFileHandler
from config import CA_CONFIG

LOG_PATH = os.path.join(os.path.dirname(CA_CONFIG["audit_log_path"]), "ca_system.log")
_configured = False


def get_logger(name: str) -> logging.Logger:
    global _configured
    if not _configured:
        _setup_root_logger()
        _configured = True
    return logging.getLogger(name)


def _setup_root_logger() -> None:
    os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)

    root = logging.getLogger()
    root.setLevel(logging.DEBUG)

    # ── Console handler (INFO+) ────────────────────────────────────────
    console = logging.StreamHandler()
    console.setLevel(logging.INFO)
    console.setFormatter(_ColorFormatter("%(asctime)s [%(levelname)s] %(message)s"))

    # ── Rotating file handler (DEBUG+, 5 MB × 3 backups) ──────────────
    file_handler = RotatingFileHandler(
        LOG_PATH, maxBytes=5 * 1024 * 1024, backupCount=3, encoding="utf-8"
    )
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(
        logging.Formatter("%(asctime)s [%(levelname)s] %(name)s — %(message)s")
    )

    root.addHandler(console)
    root.addHandler(file_handler)


class _ColorFormatter(logging.Formatter):
    """ANSI color codes for console readability (gracefully degrades on Windows)."""

    COLORS = {
        logging.DEBUG:    "\033[37m",    # white
        logging.INFO:     "\033[36m",    # cyan
        logging.WARNING:  "\033[33m",    # yellow
        logging.ERROR:    "\033[31m",    # red
        logging.CRITICAL: "\033[1;31m",  # bold red
    }
    RESET = "\033[0m"

    def format(self, record: logging.LogRecord) -> str:
        color = self.COLORS.get(record.levelno, "")
        record.levelname = f"{color}{record.levelname}{self.RESET}"
        return super().format(record)
