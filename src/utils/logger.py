from __future__ import annotations

import logging
import os
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Optional

_LOGGER_CACHE: dict[str, logging.Logger] = {}


def _ensure_log_directory(path: Path) -> None:
    """
    Ensure that the directory for log files exists.

    Parameters
    ----------
    path:
        Path to the log file. Its parent directory will be created if needed.
    """
    log_dir = path.parent
    log_dir.mkdir(parents=True, exist_ok=True)


def _create_file_handler(log_file: Path) -> RotatingFileHandler:
    """
    Create a rotating file handler for structured log output.

    Parameters
    ----------
    log_file:
        Target log file path.

    Returns
    -------
    RotatingFileHandler
        Configured file handler instance.
    """
    _ensure_log_directory(log_file)
    file_handler = RotatingFileHandler(
        log_file,
        maxBytes=1_000_000,
        backupCount=3,
        encoding="utf-8",
    )
    formatter = logging.Formatter(
        "%(asctime)s | %(levelname)s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    file_handler.setFormatter(formatter)
    file_handler.setLevel(logging.INFO)
    return file_handler


def _create_stream_handler(level: int = logging.INFO) -> logging.StreamHandler:
    """
    Create a stream handler for console output.

    Parameters
    ----------
    level:
        Minimum log level for console output.

    Returns
    -------
    logging.StreamHandler
        Configured stream handler.
    """
    stream_handler = logging.StreamHandler()
    formatter = logging.Formatter("%(levelname)s | %(name)s | %(message)s")
    stream_handler.setFormatter(formatter)
    stream_handler.setLevel(level)
    return stream_handler


def get_logger(name: str, *, debug: Optional[bool] = None) -> logging.Logger:
    """
    Retrieve a configured logger instance.

    This helper ensures that loggers are configured consistently across the
    application and that handlers are not duplicated.

    Parameters
    ----------
    name:
        Logger name, typically ``__name__`` or a dotted module path.
    debug:
        Optional override for debug mode. If ``None``, the value is inferred
        from the ``APP_DEBUG`` environment variable.

    Returns
    -------
    logging.Logger
        A configured logger instance.
    """
    if name in _LOGGER_CACHE:
        return _LOGGER_CACHE[name]

    if debug is None:
        debug_env = os.getenv("APP_DEBUG", "false").lower()
        debug = debug_env in {"1", "true", "yes"}

    logger = logging.getLogger(name)
    logger.setLevel(logging.DEBUG if debug else logging.INFO)

    # Avoid attaching multiple handlers if get_logger is called repeatedly.
    if not logger.handlers:
        log_file = Path("logs") / "app.log"
        logger.addHandler(_create_file_handler(log_file))
        logger.addHandler(_create_stream_handler())

        # Do not propagate to the root logger to prevent duplicate logs in some environments.
        logger.propagate = False

    _LOGGER_CACHE[name] = logger
    return logger