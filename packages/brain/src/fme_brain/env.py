"""Shared `.env` loading for CLI, HTTP server, and scripts (paths ignore cwd)."""

from __future__ import annotations

from pathlib import Path

from dotenv import load_dotenv

_BRAIN_PKG_ROOT = Path(__file__).resolve().parents[2]
_REPO_ROOT = _BRAIN_PKG_ROOT.parent.parent


def load_brain_dotenv() -> None:
    """Load repo root `.env` then `packages/brain/.env` (second wins on duplicate keys)."""
    load_dotenv(_REPO_ROOT / ".env")
    load_dotenv(_BRAIN_PKG_ROOT / ".env", override=True)
