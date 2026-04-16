"""Initialize the configured database using explicit SQL statements."""
from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Any

import pymysql
from pymysql.cursors import DictCursor
from dotenv import load_dotenv
from sqlalchemy.engine import make_url

BASE_DIR = Path(__file__).resolve().parent

load_dotenv(BASE_DIR / ".env")

from app.config import MYSQL_TIMEOUT_SECONDS, _aiven_mysql_config, settings

MYSQL_SCHEMA_STATEMENTS = [
    """
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER NOT NULL AUTO_INCREMENT,
      username VARCHAR(80) NOT NULL,
      password_hash VARCHAR(255) NULL,
      is_guest BOOLEAN NOT NULL DEFAULT FALSE,
      created_at DATETIME(6) NOT NULL,
      last_login_at DATETIME(6) NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_users_username (username)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    """
    CREATE TABLE IF NOT EXISTS assets (
      id INTEGER NOT NULL AUTO_INCREMENT,
      owner_id INTEGER NOT NULL,
      kind VARCHAR(20) NOT NULL,
      filename VARCHAR(255) NOT NULL,
      stored_name VARCHAR(255) NOT NULL,
      storage_path VARCHAR(1024) NOT NULL,
      summary JSON NOT NULL,
      created_at DATETIME(6) NOT NULL,
      updated_at DATETIME(6) NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_assets_stored_name (stored_name),
      KEY ix_assets_owner_id (owner_id),
      KEY ix_assets_kind (kind),
      CONSTRAINT fk_assets_owner FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    """
    CREATE TABLE IF NOT EXISTS page_states (
      id INTEGER NOT NULL AUTO_INCREMENT,
      owner_id INTEGER NOT NULL,
      page_key VARCHAR(80) NOT NULL,
      state JSON NOT NULL,
      created_at DATETIME(6) NOT NULL,
      updated_at DATETIME(6) NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_page_state_owner_key (owner_id, page_key),
      KEY ix_page_states_owner_id (owner_id),
      KEY ix_page_states_page_key (page_key),
      CONSTRAINT fk_page_states_owner FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
    """
    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER NOT NULL AUTO_INCREMENT,
      owner_id INTEGER NOT NULL,
      action VARCHAR(80) NOT NULL,
      details JSON NOT NULL,
      created_at DATETIME(6) NOT NULL,
      PRIMARY KEY (id),
      KEY ix_activity_logs_owner_id (owner_id),
      KEY ix_activity_logs_action (action),
      CONSTRAINT fk_activity_logs_owner FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
]

SQLITE_SCHEMA_SCRIPT = """
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NULL,
  is_guest INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  last_login_at TEXT NULL
);

CREATE TABLE IF NOT EXISTS assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL,
  kind TEXT NOT NULL,
  filename TEXT NOT NULL,
  stored_name TEXT NOT NULL UNIQUE,
  storage_path TEXT NOT NULL,
  summary TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS page_states (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL,
  page_key TEXT NOT NULL,
  state TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT uq_page_state_owner_key UNIQUE (owner_id, page_key)
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  details TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_assets_owner_id ON assets (owner_id);
CREATE INDEX IF NOT EXISTS ix_assets_kind ON assets (kind);
CREATE INDEX IF NOT EXISTS ix_page_states_owner_id ON page_states (owner_id);
CREATE INDEX IF NOT EXISTS ix_page_states_page_key ON page_states (page_key);
CREATE INDEX IF NOT EXISTS ix_activity_logs_owner_id ON activity_logs (owner_id);
CREATE INDEX IF NOT EXISTS ix_activity_logs_action ON activity_logs (action);
"""


def _quote_mysql_identifier(value: str) -> str:
    return f"`{value.replace('`', '``')}`"


def _mysql_connect_kwargs(database: str | None = None) -> dict[str, Any] | None:
    config = _aiven_mysql_config()
    if config is None:
        return None

    kwargs: dict[str, Any] = {
        "charset": "utf8mb4",
        "connect_timeout": MYSQL_TIMEOUT_SECONDS,
        "cursorclass": DictCursor,
        "host": str(config["host"]),
        "password": str(config["password"]),
        "port": int(config["port"]),
        "read_timeout": MYSQL_TIMEOUT_SECONDS,
        "user": str(config["user"]),
        "write_timeout": MYSQL_TIMEOUT_SECONDS,
        "autocommit": True,
    }
    if database is not None:
        kwargs["db"] = database

    return kwargs


def _mysql_database_name() -> str:
    config = _aiven_mysql_config()
    if config is None:
        raise ValueError("Configured MySQL environment is incomplete.")
    return str(config["database"])


def initialize_mysql_database() -> bool:
    connect_kwargs = _mysql_connect_kwargs()
    if connect_kwargs is None:
        return False

    database_name = _mysql_database_name()

    server_connection = pymysql.connect(**_mysql_connect_kwargs(database=None))
    try:
        with server_connection.cursor() as cursor:
            cursor.execute(
                f"CREATE DATABASE IF NOT EXISTS {_quote_mysql_identifier(database_name)} "
                "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
            )
    finally:
        server_connection.close()

    database_connection = pymysql.connect(**_mysql_connect_kwargs(database=database_name))
    try:
        with database_connection.cursor() as cursor:
            for statement in MYSQL_SCHEMA_STATEMENTS:
                cursor.execute(statement)
    finally:
        database_connection.close()

    print(f"Initialized MySQL database {database_name} using backend/.env configuration.", flush=True)
    return True


def initialize_local_sqlite() -> Path:
    parsed = make_url(settings.local_database_url)
    database_path = Path(parsed.database or "")
    database_path.parent.mkdir(parents=True, exist_ok=True)

    connection = sqlite3.connect(database_path)
    try:
        connection.executescript(SQLITE_SCHEMA_SCRIPT)
        connection.commit()
    finally:
        connection.close()

    print(f"Initialized local SQLite database at {database_path}.", flush=True)
    return database_path


def main() -> None:
    try:
        if initialize_mysql_database():
            return
    except Exception as exc:
        print(f"Failed to initialize remote MySQL database ({exc}). Falling back to local SQLite.", flush=True)

    initialize_local_sqlite()


if __name__ == "__main__":
    main()
