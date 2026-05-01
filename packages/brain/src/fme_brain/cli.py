from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Annotated

import typer
from dotenv import load_dotenv

from fme_brain.models import ChatInput

# Resolve .env relative to this package (not process cwd) so Make/IDE runs still find the key.
_BRAIN_PKG_ROOT = Path(__file__).resolve().parents[2]
_REPO_ROOT = _BRAIN_PKG_ROOT.parent.parent
load_dotenv(_REPO_ROOT / ".env")
load_dotenv(_BRAIN_PKG_ROOT / ".env", override=True)

from fme_brain.predict import predict_seller_reply

app = typer.Typer(no_args_is_help=True, add_completion=False)


@app.command()
def predict(
    input_path: Annotated[
        Path,
        typer.Argument(help="Path to JSON chat file, or - for stdin"),
    ],
) -> None:
    """Read ChatInput JSON and print SellerReplyPrediction JSON to stdout."""
    if str(input_path) == "-":
        raw = sys.stdin.read()
    else:
        raw = input_path.read_text(encoding="utf-8")
    chat = ChatInput.model_validate_json(raw)
    result = predict_seller_reply(chat)
    typer.echo(json.dumps(result.model_dump(), ensure_ascii=False, indent=2))


def main() -> None:
    app()


if __name__ == "__main__":
    main()
