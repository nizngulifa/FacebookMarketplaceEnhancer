from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class ChatTurn(BaseModel):
    role: Literal["buyer", "seller"]
    text: str = Field(min_length=1)


class ChatInput(BaseModel):
    messages: list[ChatTurn] = Field(min_length=1)


class SellerReplyPrediction(BaseModel):
    reply: str = Field(min_length=1)
    rationale: str | None = None
    confidence: float | None = Field(default=None, ge=0.0, le=1.0)
