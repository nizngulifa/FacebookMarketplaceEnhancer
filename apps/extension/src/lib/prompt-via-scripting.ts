/**
 * Show `MarketplaceUI` write helpers on a tab via `chrome.scripting.executeScript`
 * (reliable on messenger.com; avoids flaky `tabs.sendMessage` responses from the popup).
 */

import type { ComposerFrameProbe } from "./messenger-composer";

export const PROMPT_BRIDGE_FILE = "dist/fmePromptBridge.js";
/** Tiny bridge injected into all frames to locate the thread composer (often inside an iframe). */
export const COMPOSER_PROBE_FILE = "dist/fmeComposerProbeBridge.js";

async function injectMarketplaceUiBridge(tabId: number, frameId: number): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId, frameIds: [frameId] },
    files: [PROMPT_BRIDGE_FILE],
  });
}

type ProbeRow = { frameId: number; probe: ComposerFrameProbe | null; note?: string };

/**
 * Messenger’s message box frequently lives in a subframe; `allFrames: false` only hits the top document.
 * Probe every accessible frame, then pick the composer closest to the bottom of that frame’s viewport.
 */
async function resolveMessengerComposerFrameId(
  tabId: number,
  logs: string[],
): Promise<{ ok: true; frameId: number } | { ok: false; error: string }> {
  logs.push(`probe: injecting ${COMPOSER_PROBE_FILE} (allFrames=true)`);
  await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    files: [COMPOSER_PROBE_FILE],
  });

  logs.push("probe: running __fmeProbeComposer in each frame");
  const results = await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    func: () => {
      type G = { __fmeProbeComposer?: () => unknown };
      const fn = (globalThis as G).__fmeProbeComposer;
      if (typeof fn !== "function") {
        return { kind: "no_bridge" as const };
      }
      try {
        return { kind: "ok" as const, value: fn() as ComposerFrameProbe };
      } catch (e) {
        return { kind: "threw" as const, error: e instanceof Error ? e.message : String(e) };
      }
    },
  });

  logs.push(`probe: injectionResultCount=${results.length}`);
  const rows: ProbeRow[] = [];
  for (const row of results) {
    const frameId = row.frameId;
    const r = row.result as
      | { kind: "no_bridge" }
      | { kind: "threw"; error: string }
      | { kind: "ok"; value: ComposerFrameProbe }
      | undefined;
    if (!r) {
      rows.push({ frameId, probe: null, note: "empty_result" });
      continue;
    }
    if (r.kind === "no_bridge") {
      rows.push({ frameId, probe: null, note: "probe_missing" });
      continue;
    }
    if (r.kind === "threw") {
      rows.push({ frameId, probe: null, note: r.error });
      continue;
    }
    rows.push({ frameId, probe: r.value });
  }

  for (const row of rows) {
    const p = row.probe;
    const comp = p?.composer;
    logs.push(
      `probe: frameId=${row.frameId} note=${row.note ?? ""} href=${p?.href ?? "?"} isTop=${p?.isTop ?? "?"} composer=${comp ? `bottom=${comp.bottom} area=${Math.round(comp.area)}` : "null"}`,
    );
  }

  const hits: { frameId: number; probe: ComposerFrameProbe }[] = [];
  for (const x of rows) {
    if (x.probe?.composer != null) {
      hits.push({ frameId: x.frameId, probe: x.probe });
    }
  }
  if (hits.length === 0) {
    const detail = JSON.stringify(rows.slice(0, 16));
    logs.push(`probe: no frame with composer (hits=0)`);
    return {
      ok: false,
      error: `composer_not_found:${detail.length > 3500 ? `${detail.slice(0, 3500)}…` : detail}`,
    };
  }

  hits.sort((a, b) => {
    const cb = b.probe.composer!.bottom - a.probe.composer!.bottom;
    if (cb !== 0) return cb;
    return b.probe.composer!.area - a.probe.composer!.area;
  });

  logs.push(
    `probe: picked frameId=${hits[0].frameId} (best bottom=${hits[0].probe.composer!.bottom}, area=${Math.round(hits[0].probe.composer!.area)})`,
  );
  return { ok: true, frameId: hits[0].frameId };
}

export async function runPromptUserOnTab(
  tabId: number,
  message: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await injectMarketplaceUiBridge(tabId, 0);

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

export type SuggestReplyRunResult =
  | { ok: true; logs: string[] }
  | { ok: false; error: string; logs: string[] };

export async function runSuggestReplyOnTab(tabId: number, text: string): Promise<SuggestReplyRunResult> {
  const logs: string[] = [];
  logs.push(`start tabId=${tabId} suggestionLength=${text.length}`);

  try {
    const resolved = await resolveMessengerComposerFrameId(tabId, logs);
    if (!resolved.ok) {
      logs.push(`fail: ${resolved.error}`);
      return { ok: false, error: resolved.error, logs };
    }

    logs.push(`bridge: injecting ${PROMPT_BRIDGE_FILE} frameIds=[${resolved.frameId}]`);
    await injectMarketplaceUiBridge(tabId, resolved.frameId);
    logs.push("bridge: inject finished");

    logs.push("call: executeScript __fmeSuggestReply(suggestion)");
    const results = await chrome.scripting.executeScript({
      target: { tabId, frameIds: [resolved.frameId] },
      args: [text],
      func: (suggestion: string) => {
        type G = { __fmeSuggestReply?: (t: string) => void };
        const fn = (globalThis as G).__fmeSuggestReply;
        if (typeof fn !== "function") {
          return { ok: false as const, error: "suggest bridge missing after file inject" };
        }
        try {
          fn(suggestion);
          return { ok: true as const };
        } catch (e) {
          return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
        }
      },
    });

    logs.push(`call: injectionResultsLength=${results.length}`);
    const first = results[0]?.result as { ok?: boolean; error?: string } | undefined;
    logs.push(`call: firstResult=${JSON.stringify(first)}`);
    if (first && first.ok === false) {
      const err = first.error ?? "unknown";
      logs.push(`fail: suggestReply threw or bridge error — ${err}`);
      return { ok: false, error: err, logs };
    }

    logs.push("verify: post-run snapshot in target frame");
    const verify = await chrome.scripting.executeScript({
      target: { tabId, frameIds: [resolved.frameId] },
      func: () => {
        const host = document.getElementById("fme-marketplace-ui-suggest-host");
        const r = host?.getBoundingClientRect();
        const strict = document.querySelectorAll('[contenteditable="true"][role="textbox"]').length;
        const ce = document.querySelectorAll('[contenteditable="true"]').length;
        return {
          suggestHostPresent: !!host,
          suggestHostRect: r
            ? { x: r.x, y: r.y, w: r.width, h: r.height }
            : null,
          strictTextboxCount: strict,
          contentEditableCount: ce,
          href: location.href,
          isTop: window === window.top,
        };
      },
    });
    logs.push(`verify: ${JSON.stringify(verify[0]?.result)}`);

    logs.push("done ok=true");
    return { ok: true, logs };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logs.push(`exception: ${msg}`);
    return { ok: false, error: msg, logs };
  }
}
