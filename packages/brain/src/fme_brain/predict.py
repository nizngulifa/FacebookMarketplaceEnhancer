from __future__ import annotations

import os

from openai import OpenAI

from fme_brain.models import ChatInput, SellerReplyPrediction
from fme_brain.parse import extract_json_object
from fme_brain.prompts import SYSTEM_SELLER_NEXT_MESSAGE, USER_TRANSCRIPT_TEMPLATE, format_transcript

_DEFAULT_MODEL = "gpt-4o"


def predict_seller_reply(
    chat: ChatInput,
    *,
    model: str | None = None,
    max_tokens: int = 1024,
    client: OpenAI | None = None,
) -> SellerReplyPrediction:
    """
    Call OpenAI with the seller-next-message prompt and return a validated prediction.
    """
    owns_client = client is None
    api_client = client or OpenAI()
    try:
        resolved_model = model or os.environ.get("OPENAI_MODEL", _DEFAULT_MODEL)
        transcript = format_transcript(chat.messages)
        user_content = USER_TRANSCRIPT_TEMPLATE.format(transcript=transcript)

        response = api_client.chat.completions.create(
            model=resolved_model,
            max_completion_tokens=max_tokens,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": SYSTEM_SELLER_NEXT_MESSAGE},
                {"role": "user", "content": user_content},
            ],
        )
        raw_text = response.choices[0].message.content
        if not raw_text:
            raise ValueError("OpenAI response had empty message content")
        data = extract_json_object(raw_text)
        return SellerReplyPrediction.model_validate(data)
    finally:
        if owns_client:
            api_client.close()
