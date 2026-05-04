import { runPromptUserOnTab, runSuggestReplyOnTab } from "../lib/prompt-via-scripting";
import { getMessengerTab } from "./messenger-tab";

/** Must match `FME_DEBUG_MARKER_ID` in `src/lib/marketplace-ui.ts` (injected `func` cannot close over imports). */
const INJECTED_MARKER_ID = "fme-debug-marker";

export type SelfTestDeps = {
  getMessengerTab: typeof getMessengerTab;
  appendDebugLog: (line: string) => void;
  setStatus: (msg: string) => void;
};

export async function runSelfTestPing(d: SelfTestDeps): Promise<void> {
  d.appendDebugLog("Step 1 Ping: button clicked (uses chrome.scripting.executeScript, all frames)");
  const resolved = await d.getMessengerTab();
  if ("error" in resolved) {
    d.appendDebugLog(`Step 1 Ping: tab error — ${resolved.error}`);
    d.setStatus(resolved.error);
    return;
  }
  d.appendDebugLog(`Step 1 Ping: tabId=${resolved.tabId} url=${resolved.url}`);

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: resolved.tabId, allFrames: true },
      func: () => ({
        kind: "ping" as const,
        transport: "scripting" as const,
        href: location.href,
        isTop: window === window.top,
        visibilityState: document.visibilityState,
        hasBody: !!document.body,
        bodyChildCount: document.body?.childElementCount ?? 0,
      }),
    });
    d.appendDebugLog(`Step 1 Ping: ${results.length} injection result(s)`);
    d.appendDebugLog(`Step 1 Ping: JSON — ${JSON.stringify(results)}`);
    d.setStatus("Ping OK — see log (per-frame).");
  } catch (err) {
    d.appendDebugLog(
      `Step 1 Ping: executeScript threw — ${err instanceof Error ? err.message : String(err)}`,
    );
    d.setStatus("Ping failed — see log (check scripting permission + Messenger reload).");
  }
}

export async function runSelfTestMarker(d: SelfTestDeps): Promise<void> {
  d.appendDebugLog("Step 2 Marker: button clicked (uses chrome.scripting.executeScript, all frames)");
  const resolved = await d.getMessengerTab();
  if ("error" in resolved) {
    d.appendDebugLog(`Step 2 Marker: tab error — ${resolved.error}`);
    d.setStatus(resolved.error);
    return;
  }
  d.appendDebugLog(`Step 2 Marker: tabId=${resolved.tabId}`);

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: resolved.tabId, allFrames: true },
      func: (markerId: string) => {
        document.getElementById(markerId)?.remove();
        const el = document.createElement("div");
        el.id = markerId;
        el.setAttribute("data-fme", "debug-marker");
        el.textContent = "FME DOM OK";
        el.style.cssText = [
          "position:fixed",
          "top:12px",
          "inset-inline-end:12px",
          "z-index:2147483647",
          "margin:0",
          "padding:10px 14px",
          "background:#ffeb3b",
          "color:#111",
          "font:700 14px/1.2 system-ui,sans-serif",
          "border:3px solid #111",
          "border-radius:6px",
          "box-shadow:0 4px 12px rgba(0,0,0,0.35)",
        ].join(";");
        const root = document.body ?? document.documentElement;
        root.appendChild(el);
        const r = el.getBoundingClientRect();
        return {
          ok: true as const,
          href: location.href,
          isTop: window === window.top,
          rect: { x: r.x, y: r.y, width: r.width, height: r.height },
        };
      },
      args: [INJECTED_MARKER_ID],
    });
    d.appendDebugLog(`Step 2 Marker: ${results.length} injection result(s)`);
    d.appendDebugLog(`Step 2 Marker: JSON — ${JSON.stringify(results)}`);
    d.setStatus(
      "Marker injected in every frame — look for yellow “FME DOM OK” (may appear inside the chat iframe).",
    );
  } catch (err) {
    d.appendDebugLog(
      `Step 2 Marker: executeScript threw — ${err instanceof Error ? err.message : String(err)}`,
    );
    d.setStatus("Marker failed — see log.");
  }
}

export async function runSelfTestPrompt(d: SelfTestDeps): Promise<void> {
  d.appendDebugLog("Step 3 Prompt: button clicked (runPromptUserOnTab → dark chip, main frame)");
  const resolved = await d.getMessengerTab();
  if ("error" in resolved) {
    d.appendDebugLog(`Step 3 Prompt: tab error — ${resolved.error}`);
    d.setStatus(resolved.error);
    return;
  }
  d.appendDebugLog(`Step 3 Prompt: tabId=${resolved.tabId}`);

  const text = "Hi, I'm here to help.";

  try {
    const result = await runPromptUserOnTab(resolved.tabId, text);
    d.appendDebugLog(`Step 3 Prompt: result JSON — ${JSON.stringify(result)}`);
    if (!result.ok) {
      d.setStatus(`Prompt failed: ${result.error}`);
      return;
    }
    d.setStatus(
      "Prompt ran — look for the dark assistant chip on the inline-end (usually right). Scroll the chat while it is open.",
    );
  } catch (err) {
    d.appendDebugLog(
      `Step 3 Prompt: runPromptUserOnTab threw — ${err instanceof Error ? err.message : String(err)}`,
    );
    d.setStatus("Prompt failed — see log.");
  }
}

export async function runSelfTestSuggestReply(d: SelfTestDeps): Promise<void> {
  d.appendDebugLog(
    "Step 4 Suggest: button clicked (runSuggestReplyOnTab; trace lines below are for debugging)",
  );
  const resolved = await d.getMessengerTab();
  if ("error" in resolved) {
    d.appendDebugLog(`Step 4 Suggest: tab error — ${resolved.error}`);
    d.setStatus(resolved.error);
    return;
  }
  d.appendDebugLog(`Step 4 Suggest: tabId=${resolved.tabId}`);

  const text = "Hello there";

  try {
    const result = await runSuggestReplyOnTab(resolved.tabId, text);
    d.appendDebugLog("Step 4 Suggest: ——— trace start ———");
    for (const line of result.logs) {
      d.appendDebugLog(`Step 4 Suggest | ${line}`);
    }
    d.appendDebugLog("Step 4 Suggest: ——— trace end ———");
    d.appendDebugLog(`Step 4 Suggest: result JSON — ${JSON.stringify({ ok: result.ok, error: result.ok ? undefined : result.error })}`);
    if (!result.ok) {
      d.setStatus(`Suggest failed: ${result.error}`);
      return;
    }
    d.setStatus(
      "Suggest ran — ghost text on the composer; Tab inserts, Esc dismisses, typing clears it.",
    );
  } catch (err) {
    d.appendDebugLog(
      `Step 4 Suggest: runSuggestReplyOnTab threw — ${err instanceof Error ? err.message : String(err)}`,
    );
    d.setStatus("Suggest failed — see log.");
  }
}
