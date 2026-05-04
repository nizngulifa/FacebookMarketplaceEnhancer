import { extractThreadSnapshot, type ThreadSnapshot } from "../lib/messenger-extract";
import { fmeContentLog } from "../lib/fme-content-log";
import { FME_GET_THREAD_SNAPSHOT, FME_PROMPT_USER } from "../lib/messenger-protocol";
import { promptUser } from "../lib/marketplace-ui";

type ContentResponse =
  | ThreadSnapshot
  | { ok: true; kind: "prompt" }
  | { ok: false; kind: "prompt"; error: string }
  | { kind: "fme_internal"; reason: string; receivedType?: string };

/**
 * Chrome can drop synchronous `sendResponse` from content-script listeners, so
 * `tabs.sendMessage` may resolve to `undefined`. Defer the reply and return `true` to keep
 * the message channel open until `sendResponse` runs.
 *
 * Note: Popup diagnostics use `chrome.scripting.executeScript` instead because that path
 * was reliable on messenger.com; `FME_PROMPT_USER` remains for future callers (e.g. orchestrator).
 */
chrome.runtime.onMessage.addListener(
  (message: { type?: string; message?: string }, _sender, sendResponse: (p: ContentResponse) => void) => {
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
