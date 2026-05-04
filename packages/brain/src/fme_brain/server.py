"""Local HTTP API for the Chrome extension — wraps ``predict_seller_reply`` (OpenAI key via env)."""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

_BRAIN_PKG_ROOT = Path(__file__).resolve().parents[2]
_REPO_ROOT = _BRAIN_PKG_ROOT.parent.parent
load_dotenv(_REPO_ROOT / ".env")
load_dotenv(_BRAIN_PKG_ROOT / ".env", override=True)

from fastapi import FastAPI, HTTPException  # noqa: E402 — after dotenv
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402

from fme_brain.models import ChatInput, SellerReplyPrediction  # noqa: E402
from fme_brain.predict import predict_seller_reply  # noqa: E402

_DEFAULT_HOST = "127.0.0.1"
_DEFAULT_PORT = 8765

app = FastAPI(title="fme-brain", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/v1/predict")
def predict_endpoint(body: ChatInput) -> SellerReplyPrediction:
    try:
        return predict_seller_reply(body)
    except ValueError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    except Exception as e:  # noqa: BLE001 — surface model/API failures
        raise HTTPException(status_code=502, detail=str(e)) from e


def main() -> None:
    import uvicorn

    host = os.environ.get("FME_BRAIN_HOST", _DEFAULT_HOST)
    port = int(os.environ.get("FME_BRAIN_PORT", str(_DEFAULT_PORT)))
    uvicorn.run("fme_brain.server:app", host=host, port=port, reload=False)


if __name__ == "__main__":
    main()
