import { extractThreadSnapshot, type ThreadSnapshot } from "../lib/messenger-extract";
import { fmeContentLog } from "../lib/fme-content-log";
import {
  FME_BACKGROUND_BRAIN_PREDICT,
  FME_BACKGROUND_SHOW_PROMPT,
  FME_BACKGROUND_SHOW_SUGGEST_REPLY,
  FME_GET_THREAD_SNAPSHOT,
  FME_PROMPT_USER,
  FME_SUGGEST_REPLY,
} from "../lib/messenger-protocol";
import type { BrainPredictResult } from "../lib/brain-client";
import { retryGhostSuggestViaBackground } from "../lib/ghost-suggest-retry";
import { promptUser, suggestReply } from "../lib/marketplace-ui";
import { threadSnapshotToBrainMessages } from "../lib/thread-to-brain-messages";

type ContentResponse =
  | ThreadSnapshot
  | { ok: true; kind: "prompt" }
  | { ok: false; kind: "prompt"; error: string }
  | { ok: true; kind: "suggest" }
  | { ok: false; kind: "suggest"; error: string }
  | { kind: "fme_internal"; reason: string; receivedType?: string };

/** Dev-only: shown on each Messenger full load to exercise `promptUser` without popup clicks. */
const DEV_ASSISTANT_INTRO_PROMPT =
  "Hi — I'm your assistant. I'm here with you in this chat, thinking alongside you. I'll suggest reply text you can insert with Tab when you're ready. You can dismiss this anytime; it won't block the thread.";

const DEV_SUGGEST_MAX_ATTEMPTS = 50;
const DEV_SUGGEST_RETRY_MS = 350;
const DEV_PROMPT_DELAY_MS = 200;
/** After hydration, Meta often replaces the composer; `suggestReply` now rebinds — this is just a gentler first try. */
const DEV_SUGGEST_FIRST_DELAY_MS = 1200;

/**
 * After load: assistant chip + ghost suggestion from local brain server (`make brain-serve`).
 * In-page `suggestReply` only sees the top document; the composer usually lives in a subframe, so
 * we use `FME_BACKGROUND_SHOW_SUGGEST_REPLY` → `runSuggestReplyOnTab`.
 */
function scheduleMessengerUiOnLoad(): void {
  window.setTimeout(() => {
    void chrome.runtime
      .sendMessage({
        type: FME_BACKGROUND_SHOW_PROMPT,
        message: DEV_ASSISTANT_INTRO_PROMPT,
      })
      .then((r: unknown) => {
        fmeContentLog("messengerUi:prompt background result", r);
      })
      .catch((e: unknown) => {
        fmeContentLog("messengerUi:prompt sendMessage failed", e);
      });
  }, DEV_PROMPT_DELAY_MS);

  window.setTimeout(() => {
    void runBrainGhostSuggestionOnLoad();
  }, DEV_SUGGEST_FIRST_DELAY_MS);
}

async function runBrainGhostSuggestionOnLoad(): Promise<void> {
  const snapshot = extractThreadSnapshot(document);
  const messages = threadSnapshotToBrainMessages(snapshot);
  if (messages == null) {
    fmeContentLog("brainSuggest:skip", {
      logFound: snapshot.logFound,
      rowCount: snapshot.messages.length,
    });
    return;
  }

  let pred: unknown;
  try {
    pred = await chrome.runtime.sendMessage({
      type: FME_BACKGROUND_BRAIN_PREDICT,
      messages,
    });
  } catch (e: unknown) {
    fmeContentLog("brainSuggest:predict sendMessage failed", e);
    return;
  }

  if (pred == null || typeof pred !== "object" || !("ok" in pred)) {
    fmeContentLog("brainSuggest:predict empty response", { pred });
    return;
  }
  const p = pred as BrainPredictResult;
  if (p.ok !== true) {
    fmeContentLog("brainSuggest:predict failed", { error: p.error });
    return;
  }

  retryGhostSuggestViaBackground(p.reply, {
    maxAttempts: DEV_SUGGEST_MAX_ATTEMPTS,
    retryMs: DEV_SUGGEST_RETRY_MS,
    logScope: "brainSuggest",
  });
}

/**
 * Chrome can drop synchronous `sendResponse` from content-script listeners, so
 * `tabs.sendMessage` may resolve to `undefined`. Defer the reply and return `true` to keep
 * the message channel open until `sendResponse` runs.
 *
 * Note: Popup diagnostics use `chrome.scripting.executeScript` instead because that path
 * was reliable on messenger.com; `FME_PROMPT_USER` remains for future callers (e.g. orchestrator).
 */
chrome.runtime.onMessage.addListener(
  (
    message: { type?: string; message?: string; text?: string },
    _sender,
    sendResponse: (p: ContentResponse) => void,
  ) => {
    const reply = (payload: ContentResponse): void => {
      try {
        sendResponse(payload);
      } catch {
        /* channel already closed (tab navigated, extension reload, etc.) */
      }
    };

    const run = (): void => {
      const t = message?.type;
      fmeContentLog("onMessage", { type: t });

      try {
        if (t === FME_GET_THREAD_SNAPSHOT) {
          reply(extractThreadSnapshot(document));
          return;
        }

        if (t === FME_PROMPT_USER && typeof message.message === "string") {
          try {
            promptUser(message.message);
            reply({ ok: true, kind: "prompt" });
          } catch (err) {
            reply({
              ok: false,
              kind: "prompt",
              error: err instanceof Error ? err.message : String(err),
            });
          }
          return;
        }

        if (t === FME_SUGGEST_REPLY && typeof message.text === "string") {
          try {
            suggestReply(message.text);
            reply({ ok: true, kind: "suggest" });
          } catch (err) {
            reply({
              ok: false,
              kind: "suggest",
              error: err instanceof Error ? err.message : String(err),
            });
          }
          return;
        }

        reply({
          kind: "fme_internal",
          reason: "unknown_message_type",
          receivedType: t === undefined ? "(undefined)" : String(t),
        });
      } catch (err) {
        reply({
          kind: "fme_internal",
          reason: "handler_threw",
          receivedType: err instanceof Error ? err.message : String(err),
        });
      }
    };

    setTimeout(run, 0);
    return true;
  },
);

scheduleMessengerUiOnLoad();
