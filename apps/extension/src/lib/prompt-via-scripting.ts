/**
 * Show `MarketplaceUI.promptUser` on a tab via `chrome.scripting.executeScript`
 * (reliable on messenger.com; avoids flaky `tabs.sendMessage` responses from the popup).
 */

export const PROMPT_BRIDGE_FILE = "dist/fmePromptBridge.js";

export async function runPromptUserOnTab(
  tabId: number,
  message: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: false },
      files: [PROMPT_BRIDGE_FILE],
    });

    const results = await chrome.scripting.executeScript({
      target: { tabId, allFrames: false },
      args: [message],
      func: (text: string) => {
        type G = { __fmePromptUser?: (m: string) => void };
        const fn = (globalThis as G).__fmePromptUser;
        if (typeof fn !== "function") {
          return { ok: false as const, error: "prompt bridge missing after file inject" };
        }
        try {
          fn(text);
          return { ok: true as const };
        } catch (e) {
          return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
        }
      },
    });

    const first = results[0]?.result as { ok?: boolean; error?: string } | undefined;
    if (first && first.ok === false) {
      return { ok: false, error: first.error ?? "unknown" };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
