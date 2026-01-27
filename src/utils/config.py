from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional

from dotenv import load_dotenv
from pydantic import BaseModel, ValidationError, field_validator

from src.utils.logger import get_logger


class ConfigError(RuntimeError):
    """
    Raised when required configuration is missing or invalid.

    The Streamlit app catches this exception and surfaces a friendly error
    message to the user, while also logging the underlying details.
    """


class AppConfig(BaseModel):
    """
    Application configuration loaded from environment variables.

    Parameters are validated with Pydantic to provide clear error messages
    and type-safe access throughout the codebase.
    """

    groq_api_key: str
    opentripmap_api_key: Optional[str] = None
    google_places_api_key: Optional[str] = None

    app_env: str = "development"
    groq_default_model: str = "llama3-8b-8192"
    debug: bool = False

    @field_validator("groq_api_key")
    @classmethod
    def _validate_groq_api_key(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("GROQ_API_KEY must be set and non-empty.")
        return value.strip()

    @field_validator("app_env")
    @classmethod
    def _validate_app_env(cls, value: str) -> str:
        env = value.lower().strip()
        if env not in {"development", "production"}:
            raise ValueError("APP_ENV must be 'development' or 'production'.")
        return env

    @field_validator("groq_default_model")
    @classmethod
    def _validate_model(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("GROQ_DEFAULT_MODEL must be a non-empty string.")
        return value.strip()

    @field_validator("debug", mode="before")
    @classmethod
    def _coerce_debug(cls, value: object) -> bool:
        if isinstance(value, bool):
            return value
        if value is None:
            return False
        return str(value).lower() in {"1", "true", "yes"}


@dataclass
class ConfigLoadResult:
    """
    Result of attempting to load configuration.

    Attributes
    ----------
    config:
        The loaded configuration if successful, otherwise ``None``.
    error:
        A human-readable error message describing why configuration failed,
        or ``None`` if loading was successful.
    """

    config: Optional[AppConfig]
    error: Optional[str]


def _read_env() -> dict[str, str]:
    """
    Read relevant configuration values from environment variables.

    Returns
    -------
    dict[str, str]
        Dictionary of raw environment values.
    """
    return {
        "groq_api_key": os.getenv("GROQ_API_KEY", ""),
        "opentripmap_api_key": os.getenv("OPENTRIPMAP_API_KEY", "") or None,
        "google_places_api_key": os.getenv("GOOGLE_PLACES_API_KEY", "") or None,
        "app_env": os.getenv("APP_ENV", "development"),
        "groq_default_model": os.getenv("GROQ_DEFAULT_MODEL", "llama3-8b-8192"),
        "debug": os.getenv("APP_DEBUG", "false"),
    }


def load_config() -> AppConfig:
    """
    Load and validate application configuration.

    This function is intended for use in code paths where configuration
    must be present and valid; it raises :class:`ConfigError` when this is
    not the case.

    Returns
    -------
    AppConfig
        Fully validated application configuration.

    Raises
    ------
    ConfigError
        If configuration could not be validated.
    """
    # Ensure `.env` is respected in local development environments.
    load_dotenv(override=False)

    logger = get_logger("config")
    raw = _read_env()
    try:
        config = AppConfig(**raw)
    except ValidationError as exc:  # type: ignore[no-untyped-call]
        # Log detailed information while raising a user-friendly exception.
        logger.error("Configuration validation failed: %s", exc)
        message = (
            "Configuration error: one or more required environment variables "
            "are missing or invalid. Please check your .env file or deployment "
            "settings."
        )
        raise ConfigError(message) from exc

    logger.info("Configuration loaded successfully (env=%s)", config.app_env)
    return config


def try_load_config() -> ConfigLoadResult:
    """
    Attempt to load configuration without raising on failure.

    This is useful in the Streamlit UI where we want to present a helpful
    message to the user while still allowing the interface to render.

    Returns
    -------
    ConfigLoadResult
        Object containing either a valid configuration or a descriptive error.
    """
    try:
        config = load_config()
    except ConfigError as exc:
        return ConfigLoadResult(config=None, error=str(exc))
    return ConfigLoadResult(config=config, error=None)