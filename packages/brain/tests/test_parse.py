import json

import pytest

from fme_brain.parse import extract_json_object


def test_extract_plain_json() -> None:
    out = extract_json_object('{"reply": "Hi", "rationale": "x", "confidence": 0.9}')
    assert out["reply"] == "Hi"


def test_extract_fenced_json() -> None:
    raw = """```json
{"reply": "OK", "rationale": "y", "confidence": 0.5}
```"""
    out = extract_json_object(raw)
    assert out["reply"] == "OK"


def test_invalid_json_raises() -> None:
    with pytest.raises(json.JSONDecodeError):
        extract_json_object("not json")
