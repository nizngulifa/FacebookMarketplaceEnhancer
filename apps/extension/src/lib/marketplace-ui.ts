import { fmeContentLog } from "./fme-content-log";
import { listMessengerComposerCandidates, pickMessengerComposerElement } from "./messenger-composer";

export const FME_PROMPT_HOST_ID = "fme-marketplace-ui-prompt-host";
export const FME_SUGGEST_HOST_ID = "fme-marketplace-ui-suggest-host";
export const FME_DEBUG_MARKER_ID = "fme-debug-marker";

function removeExistingPromptHost(): void {
  document.getElementById(FME_PROMPT_HOST_ID)?.remove();
}

function removeExistingSuggestHost(): void {
  document.getElementById(FME_SUGGEST_HOST_ID)?.remove();
}

/** @see pickMessengerComposerElement */
export function findMessengerComposer(root: Document): HTMLElement | null {
  return pickMessengerComposerElement(root);
}

/** Messenger’s composer row is often ~20px tall; never cap the ghost chip to that or it collapses to invisible. */
const SUGGEST_GHOST_MIN_HEIGHT_PX = 52;
const SUGGEST_GHOST_MAX_HEIGHT_PX = 220;

function placeSuggestOverlay(host: HTMLElement, composer: HTMLElement): void {
  const r = composer.getBoundingClientRect();
  const win = host.ownerDocument.defaultView;
  const vw = win?.innerWidth ?? 0;
  const vh = win?.innerHeight ?? 0;
  const hPad = 10;
  const vPad = 6;

  const width = Math.min(Math.max(240, r.width - hPad * 2), Math.max(160, vw - 16));
  const left = Math.max(8, Math.min(r.left + hPad, vw - width - 8));
  const top = Math.max(8, r.top + vPad);
  const roomBelow = vh - top - 12;
  const maxH = Math.max(SUGGEST_GHOST_MIN_HEIGHT_PX, Math.min(SUGGEST_GHOST_MAX_HEIGHT_PX, roomBelow));

  host.style.left = `${left}px`;
  host.style.top = `${top}px`;
  host.style.width = `${width}px`;
  host.style.minHeight = `${SUGGEST_GHOST_MIN_HEIGHT_PX}px`;
  host.style.maxHeight = `${maxH}px`;
}

function commitSuggestionIntoComposer(composer: HTMLElement, text: string): void {
  composer.focus();
  const inserted = document.execCommand("insertText", false, text);
  if (!inserted) {
    composer.textContent = text;
    composer.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

/**
 * Ghost reply suggestion (`MarketplaceUI.suggestReply`): muted overlay on the message composer.
 * **Tab** inserts the text into the field; **Escape** dismisses. Typing in the composer clears the ghost.
 */
export function suggestReply(text: string): void {
  fmeContentLog("suggestReply:start", { length: text.length });
  removeExistingSuggestHost();

  const composer = findMessengerComposer(document);
  if (!composer) {
    const candidates = listMessengerComposerCandidates(document);
    fmeContentLog("suggestReply:no_composer", {
      strictTextbox: document.querySelectorAll('[contenteditable="true"][role="textbox"]').length,
      contentEditable: document.querySelectorAll('[contenteditable="true"]').length,
      afterHeuristic: candidates.length,
    });
    throw new Error("composer_not_found");
  }

  const host = document.createElement("div");
  host.id = FME_SUGGEST_HOST_ID;
  host.setAttribute("data-fme", "marketplace-ui-suggest");
  host.style.cssText = [
    "position:fixed",
    "margin:0",
    "padding:0",
    "border:0",
    "z-index:2147483647",
    "pointer-events:none",
    "display:block",
    "box-sizing:border-box",
    "overflow:visible",
  ].join(";");

  const shadow = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = `
    :host {
      display: block;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    }
    .ghost {
      margin: 0;
      padding: 0;
      color: rgba(100, 116, 139, 0.92);
      font-size: 15px;
      line-height: 1.35;
      white-space: pre-wrap;
      word-break: break-word;
      user-select: none;
    }
    .hint {
      margin: 6px 0 0;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.02em;
      text-transform: uppercase;
      color: rgba(100, 116, 139, 0.75);
    }
  `;

  const ghost = document.createElement("p");
  ghost.className = "ghost";
  ghost.setAttribute("aria-hidden", "true");
  ghost.textContent = text;

  const hint = document.createElement("p");
  hint.className = "hint";
  hint.textContent = "Tab to insert · Esc to dismiss";

  shadow.append(style, ghost, hint);

  const root = document.body ?? document.documentElement;
  root.appendChild(host);
  placeSuggestOverlay(host, composer);

  const syncPosition = (): void => {
    if (!document.body?.contains(composer)) {
      teardown("composer_removed");
      return;
    }
    placeSuggestOverlay(host, composer);
  };

  let tornDown = false;
  const teardown = (reason: string): void => {
    if (tornDown) return;
    tornDown = true;
    fmeContentLog("suggestReply:teardown", { reason });
    window.removeEventListener("scroll", onScrollOrResize, true);
    window.removeEventListener("resize", onScrollOrResize);
    document.removeEventListener("keydown", onKeyDown, true);
    composer.removeEventListener("input", onComposerInput);
    ro?.disconnect();
    host.remove();
  };

  const onScrollOrResize = (): void => {
    window.requestAnimationFrame(syncPosition);
  };

  let committingSuggestion = false;
  const onComposerInput = (): void => {
    if (committingSuggestion) return;
    teardown("user_typed");
  };

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === "Escape") {
      e.preventDefault();
      teardown("escape");
      return;
    }
    if (e.key === "Tab" && !e.repeat) {
      e.preventDefault();
      committingSuggestion = true;
      commitSuggestionIntoComposer(composer, text);
      committingSuggestion = false;
      teardown("tab_accept");
    }
  };

  let ro: ResizeObserver | undefined;
  if (typeof ResizeObserver !== "undefined") {
    ro = new ResizeObserver(() => {
      syncPosition();
    });
    ro.observe(composer);
  }

  window.addEventListener("scroll", onScrollOrResize, true);
  window.addEventListener("resize", onScrollOrResize);
  document.addEventListener("keydown", onKeyDown, true);
  composer.addEventListener("input", onComposerInput);

  fmeContentLog("suggestReply:mounted", { hostId: FME_SUGGEST_HOST_ID });
}

export type DebugMarkerRect = { x: number; y: number; width: number; height: number };

/**
 * Dev-only: small chip to verify DOM writes. Docked on the inline-end edge (usually right in LTR).
 */
export function injectDebugMarker(): { rect: DebugMarkerRect } {
  fmeContentLog("injectDebugMarker:start");
  document.getElementById(FME_DEBUG_MARKER_ID)?.remove();

  const el = document.createElement("div");
  el.id = FME_DEBUG_MARKER_ID;
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
  const rect = el.getBoundingClientRect();
  const result = {
    rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
  };
  fmeContentLog("injectDebugMarker:done", result);
  return result;
}

/**
 * Non-blocking “internal voice” prompt (`MarketplaceUI.promptUser`): dark assistant chip on the
 * inline-end edge — scroll-safe, no modal backdrop. **Got it** or **Escape** to hide.
 */
export function promptUser(message: string): void {
  fmeContentLog("promptUser:start", { length: message.length });
  removeExistingPromptHost();

  const host = document.createElement("div");
  host.id = FME_PROMPT_HOST_ID;
  host.setAttribute("data-fme", "marketplace-ui-prompt");
  host.style.cssText = [
    "position:fixed",
    "inset-inline-end:12px",
    "inset-block-start:max(72px,12vh)",
    "width:min(300px,42vw)",
    "max-height:min(46vh,400px)",
    "margin:0",
    "padding:0",
    "border:0",
    "z-index:2147483647",
    "pointer-events:auto",
    "display:block",
    "box-sizing:border-box",
  ].join(";");

  const shadow = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = `
    :host {
      font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    }
    .chip {
      max-height: inherit;
      overflow: auto;
      background: linear-gradient(145deg, #2d3748, #1a202c);
      color: #f7fafc;
      border-radius: 14px;
      padding: 12px 14px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-sizing: border-box;
    }
    .row {
      display: flex;
      align-items: flex-start;
      gap: 10px;
    }
    .glyph {
      font-size: 18px;
      line-height: 1;
      flex-shrink: 0;
      opacity: 0.95;
    }
    .body {
      margin: 0;
      font-size: 13px;
      line-height: 1.45;
      white-space: pre-wrap;
      word-break: break-word;
      flex: 1;
      min-width: 0;
    }
    .actions {
      margin-top: 10px;
      display: flex;
      justify-content: flex-end;
    }
    button {
      font: inherit;
      font-weight: 600;
      font-size: 12px;
      padding: 6px 12px;
      border-radius: 8px;
      border: none;
      cursor: pointer;
      background: transparent;
      color: #90cdf4;
    }
    button:hover {
      color: #bee3f8;
      text-decoration: underline;
    }
    button:focus-visible {
      outline: 2px solid #90cdf4;
      outline-offset: 2px;
      border-radius: 6px;
    }
  `;

  const chip = document.createElement("div");
  chip.className = "chip";
  chip.setAttribute("role", "status");
  chip.setAttribute("aria-live", "polite");
  chip.setAttribute("aria-label", "Copilot note");

  const row = document.createElement("div");
  row.className = "row";

  const glyph = document.createElement("span");
  glyph.className = "glyph";
  glyph.setAttribute("aria-hidden", "true");
  glyph.textContent = "✦";

  const body = document.createElement("p");
  body.className = "body";
  body.id = "fme-prompt-body";
  body.textContent = message;

  const actions = document.createElement("div");
  actions.className = "actions";

  const dismissBtn = document.createElement("button");
  dismissBtn.type = "button";
  dismissBtn.textContent = "Got it";

  const dismiss = (): void => {
    document.removeEventListener("keydown", onKeyDown, true);
    host.remove();
    fmeContentLog("promptUser:dismissed");
  };

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === "Escape") dismiss();
  };

  dismissBtn.addEventListener("click", dismiss);
  document.addEventListener("keydown", onKeyDown, true);

  row.append(glyph, body);
  actions.appendChild(dismissBtn);
  chip.append(row, actions);
  shadow.append(style, chip);
  const root = document.body ?? document.documentElement;
  root.appendChild(host);
  fmeContentLog("promptUser:mounted", { hostId: FME_PROMPT_HOST_ID });
}
