import { isMessengerUrl } from "../lib/messenger-url";
import { FME_BACKGROUND_SHOW_PROMPT } from "../lib/messenger-protocol";
import { runPromptUserOnTab } from "../lib/prompt-via-scripting";

async function activeMessengerTabId(): Promise<number | undefined> {
  const candidates = [
    ...(await chrome.tabs.query({ active: true, lastFocusedWindow: true })),
    ...(await chrome.tabs.query({ active: true, currentWindow: true })),
  ];
  const seen = new Set<number>();
  for (const t of candidates) {
    if (t.id == null || seen.has(t.id)) continue;
    seen.add(t.id);
    if (isMessengerUrl(t.url)) return t.id;
  }
  return undefined;
}

chrome.runtime.onMessage.addListener(
  (
    message: { type?: string; message?: string; tabId?: number },
    _sender,
    sendResponse: (r: { ok: true } | { ok: false; error: string }) => void,
  ) => {
    if (message?.type !== FME_BACKGROUND_SHOW_PROMPT || typeof message.message !== "string") {
      return;
    }

    const promptMessage = message.message;

    void (async () => {
      try {
        const explicit = typeof message.tabId === "number" ? message.tabId : undefined;
        const tabId = explicit ?? (await activeMessengerTabId());
        if (tabId == null) {
          sendResponse({ ok: false, error: "no_messenger_tab" });
          return;
        }
        if (explicit != null) {
          const t = await chrome.tabs.get(explicit);
          if (!isMessengerUrl(t.url)) {
            sendResponse({ ok: false, error: "tab_not_messenger" });
            return;
          }
        }
        const result = await runPromptUserOnTab(tabId, promptMessage);
        sendResponse(result);
      } catch (e) {
        sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) });
      }
    })();

    return true;
  },
);
