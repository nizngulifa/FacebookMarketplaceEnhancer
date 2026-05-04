import { getMessengerTab } from "./messenger-tab";

export const PROMPT_BRIDGE_FILE = "dist/fmePromptBridge.js";

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
          "left:12px",
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
  d.appendDebugLog(
    "Step 3 Prompt: button clicked (inject bridge via scripting, then run promptUser in main frame)",
  );
  const resolved = await d.getMessengerTab();
  if ("error" in resolved) {
    d.appendDebugLog(`Step 3 Prompt: tab error — ${resolved.error}`);
    d.setStatus(resolved.error);
    return;
  }
  d.appendDebugLog(`Step 3 Prompt: tabId=${resolved.tabId}`);

  const text =
    "If you see this overlay, promptUser works. Dismiss, Escape, or click backdrop. Reply with what you saw + the log lines below.";

  try {
    await chrome.scripting.executeScript({
      target: { tabId: resolved.tabId, allFrames: false },
      files: [PROMPT_BRIDGE_FILE],
    });
    d.appendDebugLog(`Step 3 Prompt: bridge file injected — ${PROMPT_BRIDGE_FILE}`);

    const results = await chrome.scripting.executeScript({
      target: { tabId: resolved.tabId, allFrames: false },
      args: [text],
      func: (message: string) => {
        type G = { __fmePromptUser?: (m: string) => void };
        const fn = (globalThis as G).__fmePromptUser;
        if (typeof fn !== "function") {
          return { ok: false as const, error: "prompt bridge missing after file inject" };
        }
        try {
          fn(message);
          return { ok: true as const };
        } catch (e) {
          return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
        }
      },
    });
    d.appendDebugLog(`Step 3 Prompt: run result JSON — ${JSON.stringify(results)}`);
    const first = results[0]?.result as { ok?: boolean; error?: string } | undefined;
    if (first && first.ok === false) {
      d.setStatus(`Prompt failed: ${first.error ?? "unknown"}`);
      return;
    }
    d.setStatus("Prompt ran in main frame — check Messenger for dim overlay + card.");
  } catch (err) {
    d.appendDebugLog(
      `Step 3 Prompt: executeScript threw — ${err instanceof Error ? err.message : String(err)}`,
    );
    d.setStatus("Prompt failed — see log.");
  }
}
