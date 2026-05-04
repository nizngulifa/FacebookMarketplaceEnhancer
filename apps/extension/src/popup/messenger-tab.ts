/** Resolve the focused Messenger tab (popup timing makes `currentWindow` alone unreliable). */

import { isMessengerUrl } from "../lib/messenger-url";

export { isMessengerUrl };

export function messengerThreadIdFromUrl(url: string): string | undefined {
  try {
    const u = new URL(url);
    if (!u.hostname.endsWith("messenger.com")) return undefined;
    const m = u.pathname.match(/\/t\/([^/]+)/);
    return m?.[1];
  } catch {
    return undefined;
  }
}

export async function getMessengerTab(): Promise<{ tabId: number; url: string } | { error: string }> {
  const ordered: chrome.tabs.Tab[] = [];
  const push = (tabs: chrome.tabs.Tab[]): void => {
    for (const t of tabs) ordered.push(t);
  };
  push(await chrome.tabs.query({ active: true, lastFocusedWindow: true }));
  push(await chrome.tabs.query({ active: true, currentWindow: true }));

  const seen = new Set<number>();
  for (const tab of ordered) {
    if (tab.id == null) continue;
    if (seen.has(tab.id)) continue;
    seen.add(tab.id);
    if (isMessengerUrl(tab.url)) return { tabId: tab.id, url: tab.url ?? "" };
  }
  return {
    error:
      "No active messenger.com tab found. Click the Messenger tab, then open this popup again (or reload Messenger after installing the extension).",
  };
}
