from __future__ import annotations

import json
import re
from typing import Any

_JSON_FENCE = re.compile(r"^\s*```(?:json)?\s*(.*?)\s*```\s*$", re.DOTALL | re.IGNORECASE)


def extract_json_object(raw: str) -> dict[str, Any]:
    """Parse a JSON object from model output, allowing optional ```json fences."""
    text = raw.strip()
    m = _JSON_FENCE.match(text)
    if m:
        text = m.group(1).strip()
    return json.loads(text)
