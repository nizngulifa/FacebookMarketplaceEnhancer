import type { ThreadSnapshot } from "../lib/messenger-extract";
import { FME_GET_THREAD_SNAPSHOT } from "../lib/messenger-protocol";
import { getMessengerTab, messengerThreadIdFromUrl } from "./messenger-tab";
import { setStatus } from "../lib/status";

function appendDebugLog(line: string): void {
  const el = document.getElementById("debug-log");
  if (!el) return;
  const stamp = new Date().toISOString();
  el.textContent += `[${stamp}] ${line}\n`;
  el.scrollTop = el.scrollHeight;
  console.info(`[FME popup] ${line}`);
}

function setMeta(text: string, visible: boolean): void {
  const el = document.getElementById("meta");
  if (!el) return;
  el.textContent = text;
  el.hidden = !visible;
}

function renderMessages(snapshot: ThreadSnapshot): void {
  const list = document.getElementById("messages");
  if (!list) return;
  list.replaceChildren();
  for (const m of snapshot.messages) {
    const li = document.createElement("li");
    li.className = "msg";
    const head = document.createElement("div");
    head.className = "msg-head";
    const parts = [m.timestamp, m.sender].filter(Boolean);
    head.textContent = parts.join(" · ") || "Message";
    const body = document.createElement("div");
    body.className = "msg-body";
    body.textContent = m.text || "(no text in row)";
    li.append(head, body);
    list.appendChild(li);
  }
}

async function loadSnapshot(): Promise<void> {
  const resolved = await getMessengerTab();
  if ("error" in resolved) {
    setStatus(resolved.error);
    setMeta("", false);
    renderMessages({ logFound: false, messages: [] });
    return;
  }

  const { tabId, url } = resolved;
  setStatus("Reading DOM…");

  let snapshot: ThreadSnapshot | undefined;
  try {
    snapshot = await chrome.tabs.sendMessage(tabId, { type: FME_GET_THREAD_SNAPSHOT });
  } catch {
    setStatus(
      "Could not reach the page script. Reload the Messenger tab, then tap Reload messages again.",
    );
    setMeta("", false);
    renderMessages({ logFound: false, messages: [] });
    return;
  }

  if (snapshot == null) {
    setStatus(
      "Reload messages returned no data (known Chrome + Messenger channel issue). Reload Messenger and try again.",
    );
    setMeta("", false);
    renderMessages({ logFound: false, messages: [] });
    return;
  }

  const tid = messengerThreadIdFromUrl(url);
  const titleLine = snapshot.title ? `Title: ${snapshot.title}` : "Title: (not found)";
  const idLine = tid ? `Thread id: ${tid}` : "";
  setMeta([titleLine, idLine].filter(Boolean).join("\n"), true);

  if (!snapshot.logFound) {
    setStatus("No message log found on this page. Open a conversation view.");
    renderMessages({ logFound: false, messages: [] });
    return;
  }

  setStatus(`${snapshot.messages.length} mounted message row(s).`);
  renderMessages(snapshot);
}

function main(): void {
  document.getElementById("refresh")?.addEventListener("click", () => {
    void loadSnapshot();
  });

  appendDebugLog(
    "Popup opened — dev prompt + suggest run on Messenger full reload; use Reload messages for the list below.",
  );
  void loadSnapshot();
}

main();
