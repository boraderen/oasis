"""Application configuration."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal, Optional
from urllib.parse import quote_plus

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent.parent
DEFAULT_DATA_DIR = BASE_DIR / "data"
DEFAULT_CORS_ORIGINS = (
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
)
MYSQL_TIMEOUT_SECONDS = 10

load_dotenv(BASE_DIR / ".env")


def _parse_origins(raw: Optional[str], fallback: tuple[str, ...] = DEFAULT_CORS_ORIGINS) -> tuple[str, ...]:
    if not raw:
        return fallback
    return tuple(origin.strip() for origin in raw.split(",") if origin.strip())


def _parse_bool(raw: Optional[str], default: bool = False) -> bool:
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _parse_samesite(raw: Optional[str], default: Literal["lax", "strict", "none"] = "lax") -> Literal["lax", "strict", "none"]:
    if not raw:
        return default

    value = raw.strip().lower()
    if value not in {"lax", "strict", "none"}:
        raise ValueError("SESSION_COOKIE_SAMESITE must be one of: lax, strict, none")
    return value


def _data_dir() -> Path:
    raw = os.getenv("OASIS_DATA_DIR")
    if not raw:
        return DEFAULT_DATA_DIR
    return Path(raw).expanduser().resolve()


def _asset_dir() -> Path:
    return _data_dir() / "assets"


def _local_database_url() -> str:
    return f"sqlite:///{_data_dir() / 'oasis.db'}"


def _env_value(*names: str) -> str | None:
    for name in names:
        value = os.getenv(name)
        if value is not None and value.strip():
            return value.strip()
    return None


def _aiven_mysql_config() -> dict[str, str | int] | None:
    required = {
        "AIVEN_MYSQL_HOST": _env_value("AIVEN_MYSQL_HOST"),
        "AIVEN_MYSQL_PORT": _env_value("AIVEN_MYSQL_PORT"),
        "AIVEN_MYSQL_DATABASE": _env_value("AIVEN_MYSQL_DATABASE"),
        "AIVEN_MYSQL_USER": _env_value("AIVEN_MYSQL_USER"),
        "AIVEN_MYSQL_PASSWORD": _env_value("AIVEN_MYSQL_PASSWORD"),
    }
    if not any(required.values()):
        return None

    missing = [name for name, value in required.items() if not value]
    if missing:
        raise ValueError(f"Incomplete Aiven/MySQL configuration. Missing: {', '.join(missing)}")

    try:
        port = int(required["AIVEN_MYSQL_PORT"] or "")
    except ValueError as exc:
        raise ValueError("AIVEN_MYSQL_PORT must be an integer.") from exc

    return {
        "host": required["AIVEN_MYSQL_HOST"] or "",
        "port": port,
        "database": required["AIVEN_MYSQL_DATABASE"] or "",
        "user": required["AIVEN_MYSQL_USER"] or "",
        "password": required["AIVEN_MYSQL_PASSWORD"] or "",
    }


def _aiven_mysql_database_url() -> str | None:
    config = _aiven_mysql_config()
    if config is None:
        return None

    host = str(config["host"])
    port = int(config["port"])
    database = quote_plus(str(config["database"]))
    user = quote_plus(str(config["user"]))
    password = quote_plus(str(config["password"]))
    return f"mysql+pymysql://{user}:{password}@{host}:{port}/{database}"


def _database_url() -> str:
    remote = _aiven_mysql_database_url()
    if remote:
        return remote

    return _local_database_url()


def _csrf_trusted_origins(cors_origins: tuple[str, ...]) -> tuple[str, ...]:
    raw = os.getenv("CSRF_TRUSTED_ORIGINS")
    return _parse_origins(raw, fallback=cors_origins)


@dataclass(frozen=True)
class Settings:
    app_name: str = "Oasis API"
    secret_key: str = os.getenv("OASIS_SECRET_KEY", "oasis-dev-secret")
    algorithm: str = "HS256"
    session_cookie_name: str = "oasis_session"
    session_cookie_domain: Optional[str] = os.getenv("SESSION_COOKIE_DOMAIN") or None
    session_cookie_secure: bool = _parse_bool(os.getenv("SESSION_COOKIE_SECURE"))
    session_cookie_samesite: Literal["lax", "strict", "none"] = _parse_samesite(
        os.getenv("SESSION_COOKIE_SAMESITE"),
        default="lax",
    )
    session_duration_minutes: int = int(os.getenv("OASIS_SESSION_MINUTES", "43200"))
    database_url: str = field(default_factory=_database_url)
    local_database_url: str = field(default_factory=_local_database_url)
    cors_origins: tuple[str, ...] = field(default_factory=lambda: _parse_origins(os.getenv("CORS_ORIGINS")))
    csrf_trusted_origins: tuple[str, ...] = field(init=False)
    data_dir: Path = field(default_factory=_data_dir)
    asset_dir: Path = field(default_factory=_asset_dir)

    def __post_init__(self) -> None:
        object.__setattr__(self, "csrf_trusted_origins", _csrf_trusted_origins(self.cors_origins))


settings = Settings()
