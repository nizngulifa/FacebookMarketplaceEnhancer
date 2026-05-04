import { extractThreadSnapshot, type ThreadSnapshot } from "../lib/messenger-extract";
import { fmeContentLog } from "../lib/fme-content-log";
import {
  FME_BACKGROUND_SHOW_PROMPT,
  FME_BACKGROUND_SHOW_SUGGEST_REPLY,
  FME_GET_THREAD_SNAPSHOT,
  FME_PROMPT_USER,
  FME_SUGGEST_REPLY,
} from "../lib/messenger-protocol";
import { promptUser, suggestReply } from "../lib/marketplace-ui";

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

/** Dev-only: ghost suggestion copy (same as prior self-test). */
const DEV_SUGGEST_REPLY_TEXT = "Hello there";

const DEV_SUGGEST_MAX_ATTEMPTS = 50;
const DEV_SUGGEST_RETRY_MS = 350;
const DEV_PROMPT_DELAY_MS = 200;
/** After hydration, Meta often replaces the composer; `suggestReply` now rebinds — this is just a gentler first try. */
const DEV_SUGGEST_FIRST_DELAY_MS = 1200;

type BgSuggestResult = { ok?: boolean; error?: string };

/**
 * Streamlined local testing: ask the service worker to run the same scripting path as the old
 * self-test. In-page `suggestReply` only sees the top document; the composer usually lives in a
 * subframe, so we must use `FME_BACKGROUND_SHOW_SUGGEST_REPLY` → `runSuggestReplyOnTab`.
 */
function scheduleDevMessengerUiOnLoad(): void {
  window.setTimeout(() => {
    void chrome.runtime
      .sendMessage({
        type: FME_BACKGROUND_SHOW_PROMPT,
        message: DEV_ASSISTANT_INTRO_PROMPT,
      })
      .then((r: unknown) => {
        fmeContentLog("devMessengerUi:prompt background result", r);
      })
      .catch((e: unknown) => {
        fmeContentLog("devMessengerUi:prompt sendMessage failed", e);
      });
  }, DEV_PROMPT_DELAY_MS);

  let attempt = 0;
  const trySuggestBg = (): void => {
    void chrome.runtime
      .sendMessage({
        type: FME_BACKGROUND_SHOW_SUGGEST_REPLY,
        text: DEV_SUGGEST_REPLY_TEXT,
      })
      .then((r: unknown) => {
        const res = r as BgSuggestResult;
        if (res?.ok === true) {
          fmeContentLog("devMessengerUi:suggest ok via background", { attempt });
          return;
        }
        attempt += 1;
        if (attempt < DEV_SUGGEST_MAX_ATTEMPTS) {
          window.setTimeout(trySuggestBg, DEV_SUGGEST_RETRY_MS);
        } else {
          fmeContentLog("devMessengerUi:suggest gave up", { attempt, error: res?.error });
        }
      })
      .catch((e: unknown) => {
        attempt += 1;
        if (attempt < DEV_SUGGEST_MAX_ATTEMPTS) {
          window.setTimeout(trySuggestBg, DEV_SUGGEST_RETRY_MS);
        } else {
          fmeContentLog("devMessengerUi:suggest sendMessage failed", e);
        }
      });
  };
  window.setTimeout(trySuggestBg, DEV_SUGGEST_FIRST_DELAY_MS);
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

scheduleDevMessengerUiOnLoad();
