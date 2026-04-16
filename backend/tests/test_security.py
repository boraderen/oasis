from __future__ import annotations

import unittest

import bcrypt

from backend.app.security import BCRYPT_SHA256_PREFIX, hash_password, verify_password


class PasswordSecurityTests(unittest.TestCase):
    def test_hash_and_verify_password_round_trip(self) -> None:
        hashed = hash_password("secret123")

        self.assertTrue(hashed.startswith(BCRYPT_SHA256_PREFIX))
        self.assertTrue(verify_password("secret123", hashed))
        self.assertFalse(verify_password("wrong-password", hashed))

    def test_supports_long_passwords(self) -> None:
        password = "p" * 200
        hashed = hash_password(password)

        self.assertTrue(verify_password(password, hashed))

    def test_verify_password_supports_legacy_bcrypt_hashes(self) -> None:
        legacy_hash = bcrypt.hashpw(b"secret123", bcrypt.gensalt()).decode("utf-8")

        self.assertTrue(verify_password("secret123", legacy_hash))
        self.assertFalse(verify_password("wrong-password", legacy_hash))


if __name__ == "__main__":
    unittest.main()
