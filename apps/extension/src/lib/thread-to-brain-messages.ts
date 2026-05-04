import type { ThreadSnapshot } from "./messenger-extract";
import type { BrainChatTurnPayload } from "./messenger-protocol";

/** Messenger (English) uses "You" for the logged-in user in row aria-labels. */
const SELF_SENDER_LABEL = "you";

function isSelfSender(sender: string): boolean {
  return sender.trim().toLowerCase() === SELF_SENDER_LABEL;
}

/**
 * Maps a DOM snapshot to brain input. Treats the user as the seller ("You" rows).
 * Returns null if there is nothing usable for `ChatInput`.
 */
export function threadSnapshotToBrainMessages(
  snapshot: ThreadSnapshot,
): BrainChatTurnPayload[] | null {
  if (!snapshot.logFound || snapshot.messages.length === 0) {
    return null;
  }
  const out: BrainChatTurnPayload[] = [];
  for (const m of snapshot.messages) {
    const sender = m.sender?.trim();
    const text = m.text.trim();
    if (!sender || !text) continue;
    const role: BrainChatTurnPayload["role"] = isSelfSender(sender) ? "seller" : "buyer";
    out.push({ role, text });
  }
  if (out.length === 0) {
    return null;
  }
  return out;
}
