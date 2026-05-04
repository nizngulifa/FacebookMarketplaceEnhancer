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

type BrainPredictResponse = { ok: true; reply: string } | { ok: false; error: string };

chrome.runtime.onMessage.addListener(
  (
    message: {
      type?: string;
      messages?: Array<{ role: string; text: string }>;
    },
    sender,
    sendResponse: (r: BrainPredictResponse) => void,
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

      const turns = message.messages.filter(
        (m): m is { role: "buyer" | "seller"; text: string } =>
          (m.role === "buyer" || m.role === "seller") &&
          typeof m.text === "string" &&
          m.text.trim().length > 0,
      );
      if (turns.length === 0) {
        sendResponse({ ok: false, error: "no_messages" });
        return;
      }

      const payload = {
        messages: turns.map((m) => ({ role: m.role, text: m.text.trim() })),
      };

      try {
        const res = await fetch(`${DEFAULT_BRAIN_SERVER_ORIGIN}/v1/predict`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const raw = await res.text();
        if (!res.ok) {
          sendResponse({
            ok: false,
            error: `brain_http_${res.status}: ${raw.slice(0, 240)}`,
          });
          return;
        }
        let data: { reply?: unknown };
        try {
          data = JSON.parse(raw) as { reply?: unknown };
        } catch {
          sendResponse({ ok: false, error: "brain_invalid_json" });
          return;
        }
        const reply = typeof data.reply === "string" ? data.reply.trim() : "";
        if (!reply) {
          sendResponse({ ok: false, error: "brain_empty_reply" });
          return;
        }
        sendResponse({ ok: true, reply });
      } catch (e) {
        sendResponse({
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    })();

    return true;
  },
);
