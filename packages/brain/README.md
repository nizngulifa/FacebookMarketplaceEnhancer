# fme-brain

Local **chat → seller next message** pipeline using the **OpenAI** API. Input is explicit buyer/seller turns; output is JSON (`reply`, `rationale`, `confidence`).

## Setup

From repo root (or this directory):

```bash
cd packages/brain
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
```

Set `OPENAI_API_KEY` in your environment, or copy `.env.example` to `.env` in this directory (the CLI loads it via `python-dotenv`). The SDK also reads `OPENAI_API_KEY` automatically when set in the environment.

## Usage

```bash
fme-brain fixtures/example_marketplace.json
cat fixtures/example_marketplace.json | fme-brain -
```

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
