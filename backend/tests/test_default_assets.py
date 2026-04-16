from __future__ import annotations

import unittest
from pathlib import Path

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from backend.app.database import Base
from backend.app.default_assets import DEFAULT_LOG_DIR, DEFAULT_MODEL_DIR, ensure_default_assets
from backend.app.models import Asset, User
from backend.app.services.io import SUPPORTED_LOG_SUFFIXES, SUPPORTED_MODEL_SUFFIXES, SUPPORTED_OCEL_SUFFIXES
from backend.app.storage import ensure_storage


class DefaultAssetTests(unittest.TestCase):
    def setUp(self) -> None:
        from backend.app import models  # noqa: F401

        ensure_storage()
        self.engine = create_engine("sqlite:///:memory:", future=True)
        Base.metadata.create_all(self.engine)
        self.created_paths: list[str] = []

    def tearDown(self) -> None:
        for path in self.created_paths:
            try:
                Path(path).unlink(missing_ok=True)
            except OSError:
                pass
        Base.metadata.drop_all(self.engine)
        self.engine.dispose()

    def test_ensure_default_assets_matches_bundled_backend_assets_for_a_user(self) -> None:
        with Session(self.engine) as db:
            user = User(username="seed-user", password_hash=None, is_guest=True)
            db.add(user)
            db.flush()

            expected_filenames = set()
            for directory, supported_suffixes in (
                (DEFAULT_LOG_DIR, SUPPORTED_LOG_SUFFIXES | SUPPORTED_OCEL_SUFFIXES),
                (DEFAULT_MODEL_DIR, SUPPORTED_MODEL_SUFFIXES),
            ):
                if not directory.exists():
                    continue
                for source in directory.iterdir():
                    if source.is_file() and source.suffix.lower() in supported_suffixes:
                        expected_filenames.add(source.name)

            seeded = ensure_default_assets(db, user)
            assets = list(db.scalars(select(Asset).where(Asset.owner_id == user.id)).all())
            self.created_paths = [asset.storage_path for asset in assets]

            self.assertEqual(seeded, bool(expected_filenames))
            self.assertEqual(len(assets), len(expected_filenames))

            filenames = {asset.filename for asset in assets}
            self.assertEqual(filenames, expected_filenames)

            seeded_again = ensure_default_assets(db, user)
            assets_again = list(db.scalars(select(Asset).where(Asset.owner_id == user.id)).all())

            self.assertFalse(seeded_again)
            self.assertEqual(len(assets_again), len(assets))


if __name__ == "__main__":
    unittest.main()
