import type { ThreadSnapshot } from "../lib/messenger-extract";
import { FME_GET_THREAD_SNAPSHOT } from "../lib/messenger-protocol";
import { setStatus } from "../lib/status";

function messengerThreadIdFromUrl(url: string): string | undefined {
  try {
    const u = new URL(url);
    if (!u.hostname.endsWith("messenger.com")) return undefined;
    const m = u.pathname.match(/\/t\/([^/]+)/);
    return m?.[1];
  } catch {
    return undefined;
  }
}

function isMessengerUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.hostname === "messenger.com" || u.hostname.endsWith(".messenger.com");
  } catch {
    return false;
  }
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
  // Popups are not in the browser tab strip; `currentWindow` often targets the wrong window.
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const url = tab?.url;

  if (!isMessengerUrl(url)) {
    setStatus("Active tab is not messenger.com. Open a thread, then try again.");
    setMeta("", false);
    renderMessages({ logFound: false, messages: [] });
    return;
  }

  if (tab.id == null) {
    setStatus("Could not read the active tab.");
    return;
  }

  setStatus("Reading DOM…");

  let snapshot: ThreadSnapshot;
  try {
    snapshot = await chrome.tabs.sendMessage(tab.id, { type: FME_GET_THREAD_SNAPSHOT });
  } catch {
    setStatus(
      "Could not reach the page script. Reload the Messenger tab, then tap Refresh again.",
    );
    setMeta("", false);
    renderMessages({ logFound: false, messages: [] });
    return;
  }

  const tid = messengerThreadIdFromUrl(url ?? "");
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
  const btn = document.getElementById("refresh");
  btn?.addEventListener("click", () => {
    void loadSnapshot();
  });
  void loadSnapshot();
}

main();
