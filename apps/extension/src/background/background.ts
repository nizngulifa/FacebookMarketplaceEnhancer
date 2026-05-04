import { fetchSellerReply, normalizeBrainTurns, type BrainPredictResult } from "../lib/brain-client";
import { DEFAULT_BRAIN_SERVER_ORIGIN } from "../lib/brain-config";
import { isMessengerUrl } from "../lib/messenger-url";
import {
  FME_BACKGROUND_BRAIN_PREDICT,
  FME_BACKGROUND_SHOW_PROMPT,
  FME_BACKGROUND_SHOW_SUGGEST_REPLY,
} from "../lib/messenger-protocol";
import { runPromptUserOnTab, runSuggestReplyOnTab } from "../lib/prompt-via-scripting";

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
    sender,
    sendResponse: (r: { ok: true } | { ok: false; error: string }) => void,
  ) => {
    if (message?.type !== FME_BACKGROUND_SHOW_PROMPT || typeof message.message !== "string") {
      return;
    }

    const promptMessage = message.message;

    void (async () => {
      try {
        const explicit = typeof message.tabId === "number" ? message.tabId : undefined;
        const fromSender = sender.tab?.id;
        const tabId = explicit ?? fromSender ?? (await activeMessengerTabId());
        if (tabId == null) {
          sendResponse({ ok: false, error: "no_messenger_tab" });
          return;
        }
        if (explicit != null || fromSender != null) {
          const t = await chrome.tabs.get(tabId);
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

chrome.runtime.onMessage.addListener(
  (
    message: { type?: string; text?: string; tabId?: number },
    sender,
    sendResponse: (
      r: { ok: true; logs: string[] } | { ok: false; error: string; logs?: string[] },
    ) => void,
  ) => {
    if (message?.type !== FME_BACKGROUND_SHOW_SUGGEST_REPLY || typeof message.text !== "string") {
      return;
    }

    const suggestionText = message.text;

    void (async () => {
      try {
        const explicit = typeof message.tabId === "number" ? message.tabId : undefined;
        const fromSender = sender.tab?.id;
        const tabId = explicit ?? fromSender ?? (await activeMessengerTabId());
        if (tabId == null) {
          sendResponse({ ok: false, error: "no_messenger_tab" });
          return;
        }
        if (explicit != null || fromSender != null) {
          const t = await chrome.tabs.get(tabId);
          if (!isMessengerUrl(t.url)) {
            sendResponse({ ok: false, error: "tab_not_messenger" });
            return;
          }
        }
        const result = await runSuggestReplyOnTab(tabId, suggestionText);
        sendResponse(result);
      } catch (e) {
        sendResponse({
          ok: false,
          error: e instanceof Error ? e.message : String(e),
          logs: [`exception: ${e instanceof Error ? e.message : String(e)}`],
        });
      }
    })();

    return true;
  },
);

chrome.runtime.onMessage.addListener(
  (
    message: {
      type?: string;
      messages?: Array<{ role?: string; text?: string }>;
    },
    sender,
    sendResponse: (r: BrainPredictResult) => void,
  ) => {
    if (message?.type !== FME_BACKGROUND_BRAIN_PREDICT) {
      return;
    }

    void (async () => {
      if (!Array.isArray(message.messages)) {
        sendResponse({ ok: false, error: "invalid_messages" });
        return;
      }
      if (sender.tab?.id == null) {
        sendResponse({ ok: false, error: "no_sender_tab" });
        return;
      }
      const t = await chrome.tabs.get(sender.tab.id);
      if (!isMessengerUrl(t.url)) {
        sendResponse({ ok: false, error: "tab_not_messenger" });
        return;
      }

      const turns = normalizeBrainTurns(message.messages);
      const result = await fetchSellerReply(turns, DEFAULT_BRAIN_SERVER_ORIGIN);
      sendResponse(result);
    })();

    return true;
  },
);
