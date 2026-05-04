import { brainPredictUrl } from "./brain-config";
import type { BrainChatTurnPayload } from "./messenger-protocol";

export type BrainPredictResult =
  | { ok: true; reply: string }
  | { ok: false; error: string };

/** Keeps only valid buyer/seller turns with non-empty trimmed text (defensive). */
export function normalizeBrainTurns(
  messages: Array<{ role?: string; text?: string }>,
): BrainChatTurnPayload[] {
  const out: BrainChatTurnPayload[] = [];
  for (const m of messages) {
    if ((m.role !== "buyer" && m.role !== "seller") || typeof m.text !== "string") continue;
    const text = m.text.trim();
    if (!text) continue;
    out.push({ role: m.role, text });
  }
  return out;
}

/** Calls the local brain HTTP API (`POST /v1/predict`). Does not hold secrets. */
export async function fetchSellerReply(
  turns: BrainChatTurnPayload[],
  serverOrigin: string,
): Promise<BrainPredictResult> {
  if (turns.length === 0) {
    return { ok: false, error: "no_messages" };
  }
  try {
    const res = await fetch(brainPredictUrl(serverOrigin), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: turns }),
    });
    const raw = await res.text();
    if (!res.ok) {
      return { ok: false, error: `brain_http_${res.status}: ${raw.slice(0, 240)}` };
    }
    let data: { reply?: unknown };
    try {
      data = JSON.parse(raw) as { reply?: unknown };
    } catch {
      return { ok: false, error: "brain_invalid_json" };
    }
    const reply = typeof data.reply === "string" ? data.reply.trim() : "";
    if (!reply) {
      return { ok: false, error: "brain_empty_reply" };
    }
    return { ok: true, reply };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
