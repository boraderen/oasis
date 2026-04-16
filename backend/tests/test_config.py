from __future__ import annotations

import os
import unittest
from unittest.mock import patch

from backend.app.config import _aiven_mysql_config, _aiven_mysql_database_url, _database_url


class ConfigSelectionTests(unittest.TestCase):
    def test_aiven_mysql_config_and_database_url_are_built_when_env_is_complete(self) -> None:
        env = {
            "AIVEN_MYSQL_HOST": "db.example.com",
            "AIVEN_MYSQL_PORT": "3306",
            "AIVEN_MYSQL_DATABASE": "oasis",
            "AIVEN_MYSQL_USER": "service-user",
            "AIVEN_MYSQL_PASSWORD": "top secret",
        }
        with patch.dict(os.environ, env, clear=True):
            self.assertEqual(
                _aiven_mysql_config(),
                {
                    "host": "db.example.com",
                    "port": 3306,
                    "database": "oasis",
                    "user": "service-user",
                    "password": "top secret",
                },
            )
            self.assertEqual(
                _aiven_mysql_database_url(),
                "mysql+pymysql://service-user:top+secret@db.example.com:3306/oasis",
            )

    def test_incomplete_aiven_mysql_config_raises(self) -> None:
        env = {
            "AIVEN_MYSQL_HOST": "db.example.com",
            "AIVEN_MYSQL_USER": "service-user",
        }
        with patch.dict(os.environ, env, clear=True):
            with self.assertRaisesRegex(ValueError, "Incomplete Aiven/MySQL configuration"):
                _aiven_mysql_config()

    def test_invalid_aiven_mysql_port_raises(self) -> None:
        env = {
            "AIVEN_MYSQL_HOST": "db.example.com",
            "AIVEN_MYSQL_PORT": "not-a-port",
            "AIVEN_MYSQL_DATABASE": "oasis",
            "AIVEN_MYSQL_USER": "service-user",
            "AIVEN_MYSQL_PASSWORD": "top secret",
        }
        with patch.dict(os.environ, env, clear=True):
            with self.assertRaisesRegex(ValueError, "AIVEN_MYSQL_PORT must be an integer"):
                _aiven_mysql_config()

    def test_database_url_falls_back_to_local_sqlite(self) -> None:
        with patch.dict(os.environ, {}, clear=True):
            database_url = _database_url()

        self.assertTrue(database_url.startswith("sqlite:///"))
        self.assertTrue(database_url.endswith("/backend/data/oasis.db"))


if __name__ == "__main__":
    unittest.main()
