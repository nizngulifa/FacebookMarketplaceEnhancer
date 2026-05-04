# fme-brain

Local **chat → seller next message** pipeline using the **OpenAI** API. Input is explicit buyer/seller turns; output is JSON (`reply`, `rationale`, `confidence`).

**Architecture, boundaries, and how to extend (models, prompts, troubleshooting):** [docs/brain.md](../../docs/brain.md)

## Setup

From repo root (or this directory):

```bash
cd packages/brain
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e ".[dev,server]"
```

Or from repo root: `make brain-install` (creates `packages/brain/.venv` and installs CLI + HTTP server extras).

The **`Makefile` sets `PYTHONPATH=src`** for `brain-predict` and `brain-serve` because some Python versions ignore editable-install `.pth` hooks whose filenames start with `_`. Tests use `pythonpath = ["src"]` in `pyproject.toml` for the same reason.

Set `OPENAI_API_KEY` in your environment, or copy `.env.example` to `.env` in this directory (the CLI loads repo root `.env` first, then `packages/brain/.env`). The OpenAI SDK also reads `OPENAI_API_KEY` from the environment.

## Usage

```bash
fme-brain fixtures/example_marketplace.json
cat fixtures/example_marketplace.json | fme-brain -
```

From repo root (default fixture):

```bash
make brain-predict
# Custom file (path relative to packages/brain):
make brain-predict FILE=fixtures/example_marketplace.json
```

### Local HTTP API (Chrome extension MVP)

Start the server (requires `OPENAI_API_KEY` for live `/v1/predict`):

```bash
make brain-serve
```

- **`GET /health`** — no auth; quick check the process is up.
- **`POST /v1/predict`** — JSON body same shape as the CLI input (`ChatInput`). Response is `SellerReplyPrediction` JSON (`reply`, `rationale`, `confidence`).

Default bind: **127.0.0.1:8765** (override with `FME_BRAIN_HOST` / `FME_BRAIN_PORT` in the environment if you change `main()` usage).

Implementation: [`src/fme_brain/server.py`](src/fme_brain/server.py). Env loading: [`src/fme_brain/env.py`](src/fme_brain/env.py) (`load_brain_dotenv()` — **never** put keys in the extension bundle).

See [docs/brain.md](../../docs/brain.md) for how `apps/extension/` calls this endpoint.

**Note:** The CLI is invoked as `fme-brain <path>` or `fme-brain -`, not `fme-brain predict …`.

Input JSON:

```json
{
  "messages": [
    { "role": "buyer", "text": "Hi, is this still available?" },
    { "role": "seller", "text": "Yes, it is. Are you interested?" }
  ]
}
```

Stdout: one JSON object from the model (validated and re-serialized).

## Development

```bash
pytest
```

Parsing tests do not call OpenAI. After prompt or model changes, run a live smoke test with a fixture if you have an API key.

## Library

```python
from fme_brain import predict_seller_reply
from fme_brain.models import ChatInput, ChatTurn

out = predict_seller_reply(
    ChatInput(
        messages=[
            ChatTurn(role="buyer", text="Hi"),
            ChatTurn(role="seller", text="Hello!"),
        ]
    )
)
print(out.reply, out.confidence)
```

`load_brain_dotenv()` runs in the CLI and HTTP server entrypoints. For one-off scripts that call `predict_seller_reply` directly, either set env vars yourself or call `load_brain_dotenv()` from `fme_brain.env` first.
