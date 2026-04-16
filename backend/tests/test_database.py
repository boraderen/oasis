from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from backend.app import database
from backend.app.config import MYSQL_TIMEOUT_SECONDS


class _FakeConnection:
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def exec_driver_sql(self, statement: str) -> None:
        self.statement = statement


class _FakeEngine:
    def __init__(self, fail_on_connect: bool = False):
        self.fail_on_connect = fail_on_connect
        self.disposed = False

    def connect(self):
        if self.fail_on_connect:
            raise RuntimeError("remote unavailable")
        return _FakeConnection()

    def dispose(self) -> None:
        self.disposed = True


class DatabaseFallbackTests(unittest.TestCase):
    def test_mysql_connect_args_match_aiven_timeout_configuration(self) -> None:
        self.assertEqual(
            database._build_connect_args("mysql+pymysql://user:pass@example.com:3306/oasis"),
            {
                "charset": "utf8mb4",
                "connect_timeout": MYSQL_TIMEOUT_SECONDS,
                "read_timeout": MYSQL_TIMEOUT_SECONDS,
                "write_timeout": MYSQL_TIMEOUT_SECONDS,
            },
        )

    def test_remote_failure_falls_back_to_local_sqlite(self) -> None:
        remote_engine = _FakeEngine(fail_on_connect=True)
        local_engine = _FakeEngine(fail_on_connect=False)

        with tempfile.TemporaryDirectory() as tmpdir:
            fallback_url = f"sqlite:///{Path(tmpdir) / 'oasis.db'}"
            with patch("backend.app.database.create_engine", side_effect=[remote_engine, local_engine]):
                engine, database_url = database._build_engine_with_fallback(
                    "mysql+pymysql://user:pass@example.com:3306/oasis",
                    fallback_url,
                )

        self.assertIs(engine, local_engine)
        self.assertEqual(database_url, fallback_url)
        self.assertTrue(remote_engine.disposed)


if __name__ == "__main__":
    unittest.main()
