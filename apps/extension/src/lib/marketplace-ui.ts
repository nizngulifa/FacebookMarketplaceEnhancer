import { fmeContentLog } from "./fme-content-log";
import {
  FME_DEBUG_MARKER_ID,
  FME_PROMPT_HOST_ID,
  FME_SUGGEST_HOST_ID,
} from "./fme-ui-host-ids";
import {
  listMessengerComposerCandidates,
  pickMessengerComposerElement,
} from "./messenger-composer";

export { FME_DEBUG_MARKER_ID, FME_PROMPT_HOST_ID, FME_SUGGEST_HOST_ID };

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

function isTransparentCssColor(value: string): boolean {
  const v = value.trim().toLowerCase();
  if (v === "transparent") return true;
  const m = /^rgba\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*([\d.]+)\s*\)$/.exec(v);
  if (m) return parseFloat(m[1]) === 0;
  return false;
}

/** Walk up for a non-transparent background so the overlay covers native placeholder text. */
function solidBackgroundNear(composer: HTMLElement): string {
  const win = composer.ownerDocument.defaultView;
  if (!win) return "#ffffff";
  let cur: HTMLElement | null = composer;
  for (let i = 0; i < 8 && cur; i += 1) {
    const bg = win.getComputedStyle(cur).backgroundColor;
    if (bg && !isTransparentCssColor(bg)) return bg;
    cur = cur.parentElement;
  }
  return "#ffffff";
}

type PlaceholderMask = { ariaPlaceholder: string | null; dataPlaceholder: string | null };

function captureAndStripPlaceholderAttrs(el: HTMLElement): PlaceholderMask {
  const state: PlaceholderMask = {
    ariaPlaceholder: el.getAttribute("aria-placeholder"),
    dataPlaceholder: el.getAttribute("data-placeholder"),
  };
  el.removeAttribute("aria-placeholder");
  el.removeAttribute("data-placeholder");
  return state;
}

function restorePlaceholderAttrs(el: HTMLElement, prev: PlaceholderMask): void {
  if (prev.ariaPlaceholder !== null) el.setAttribute("aria-placeholder", prev.ariaPlaceholder);
  else el.removeAttribute("aria-placeholder");
  if (prev.dataPlaceholder !== null) el.setAttribute("data-placeholder", prev.dataPlaceholder);
  else el.removeAttribute("data-placeholder");
}

/** When siblings aren’t measurable, approximate space left of the typing strip (e.g. “Aa”). */
const MVP_AA_STRIP_FALLBACK_PX = 34;

function reserveLeftComposerChromePx(composer: HTMLElement): number {
  let sum = 0;
  let el = composer.previousElementSibling as HTMLElement | null;
  while (el) {
    const br = el.getBoundingClientRect();
    if (br.width > 2 && br.height > 2) sum += br.width;
    el = el.previousElementSibling as HTMLElement | null;
  }
  const gap = 4;
  const raw = sum > 0 ? Math.ceil(sum + gap) : MVP_AA_STRIP_FALLBACK_PX;
  /** Pull the chip slightly left vs measured chrome so it doesn’t sit too far past “Aa”. */
  const nudgeLeft = 10;
  return Math.max(0, raw - nudgeLeft);
}

function placeSuggestOverlay(
  host: HTMLElement,
  composer: HTMLElement,
  ghostEl: HTMLElement,
  hintEl: HTMLElement,
): void {
  const win = composer.ownerDocument.defaultView;
  if (!win) return;
  const r = composer.getBoundingClientRect();
  const cs = win.getComputedStyle(composer);
  const padL = Math.max(0, parseFloat(cs.paddingLeft) || 0);
  const padR = Math.max(0, parseFloat(cs.paddingRight) || 0);
  const padT = Math.max(0, parseFloat(cs.paddingTop) || 0);
  const padB = Math.max(0, parseFloat(cs.paddingBottom) || 0);
  const vw = win.innerWidth;
  const vh = win.innerHeight;

  const aaReserve = reserveLeftComposerChromePx(composer);
  const contentLeft = r.left + padL + aaReserve;
  const left = Math.min(Math.max(6, contentLeft), vw - 100);
  const width = Math.max(100, Math.min(Math.max(0, r.right - padR - left - 8), vw - left - 8));
  const top = Math.max(4, r.top + padT);
  const innerH = Math.max(0, r.height - padT - padB);
  const roomBelow = vh - top - 10;
  const maxH = Math.max(
    SUGGEST_GHOST_MIN_HEIGHT_PX,
    Math.min(SUGGEST_GHOST_MAX_HEIGHT_PX, innerH + 48, roomBelow),
  );

  host.style.left = `${left}px`;
  host.style.top = `${top}px`;
  host.style.width = `${width}px`;
  host.style.minHeight = `${Math.max(SUGGEST_GHOST_MIN_HEIGHT_PX, Math.min(innerH + 36, maxH))}px`;
  host.style.maxHeight = `${maxH}px`;
  host.style.backgroundColor = solidBackgroundNear(composer);
  const br = cs.borderRadius;
  if (br && br !== "0px") host.style.borderRadius = br;

  ghostEl.style.fontFamily = cs.fontFamily;
  ghostEl.style.fontSize = cs.fontSize;
  ghostEl.style.lineHeight = cs.lineHeight;
  ghostEl.style.letterSpacing = cs.letterSpacing;
  hintEl.style.fontFamily = cs.fontFamily;
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
 * If the composer node is replaced (e.g. Messenger/React hydration), we rebind to the new element instead of tearing down immediately.
 */
export function suggestReply(text: string): void {
  fmeContentLog("suggestReply:start", { length: text.length });
  removeExistingSuggestHost();

  const initial = findMessengerComposer(document);
  if (!initial) {
    const candidates = listMessengerComposerCandidates(document);
    fmeContentLog("suggestReply:no_composer", {
      strictTextbox: document.querySelectorAll('[contenteditable="true"][role="textbox"]').length,
      contentEditable: document.querySelectorAll('[contenteditable="true"]').length,
      afterHeuristic: candidates.length,
    });
    throw new Error("composer_not_found");
  }

  /** React / Messenger often replace the composer node after first paint; keep rebounding to the live node. */
  let activeComposer: HTMLElement = initial;

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
    .wrap {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      min-height: 100%;
      box-sizing: border-box;
    }
    .ghost {
      margin: 0;
      padding: 0;
      color: rgba(71, 85, 105, 0.98);
      white-space: pre-wrap;
      word-break: break-word;
      user-select: none;
      flex: 0 0 auto;
    }
    .hint {
      margin: 4px 0 0;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: rgba(100, 116, 139, 0.85);
      flex: 0 0 auto;
    }
  `;

  const wrap = document.createElement("div");
  wrap.className = "wrap";

  const ghost = document.createElement("p");
  ghost.className = "ghost";
  ghost.setAttribute("aria-hidden", "true");
  ghost.textContent = text;

  const hint = document.createElement("p");
  hint.className = "hint";
  hint.textContent = "Tab to insert · Esc to dismiss";

  wrap.append(ghost, hint);
  shadow.append(style, wrap);

  const root = document.body ?? document.documentElement;
  root.appendChild(host);

  let savedPlaceholder: PlaceholderMask = captureAndStripPlaceholderAttrs(activeComposer);
  placeSuggestOverlay(host, activeComposer, ghost, hint);

  let relookupTimer: ReturnType<typeof setTimeout> | undefined;
  let giveUpMisses = 0;
  const MAX_COMPOSER_RELOOKUPS = 45;

  const clearRelookupTimer = (): void => {
    if (relookupTimer != undefined) {
      clearTimeout(relookupTimer);
      relookupTimer = undefined;
    }
  };

  let ro: ResizeObserver | undefined;

  const rebindToComposer = (next: HTMLElement): void => {
    if (next === activeComposer) return;
    fmeContentLog("suggestReply:composerRebound");
    restorePlaceholderAttrs(activeComposer, savedPlaceholder);
    activeComposer.removeEventListener("input", onComposerInput);
    ro?.unobserve(activeComposer);
    activeComposer = next;
    savedPlaceholder = captureAndStripPlaceholderAttrs(activeComposer);
    activeComposer.addEventListener("input", onComposerInput);
    ro?.observe(activeComposer);
  };

  let tornDown = false;
  const teardown = (reason: string): void => {
    if (tornDown) return;
    tornDown = true;
    fmeContentLog("suggestReply:teardown", { reason });
    clearRelookupTimer();
    window.removeEventListener("scroll", onScrollOrResize, true);
    window.removeEventListener("resize", onScrollOrResize);
    document.removeEventListener("keydown", onKeyDown, true);
    activeComposer.removeEventListener("input", onComposerInput);
    restorePlaceholderAttrs(activeComposer, savedPlaceholder);
    ro?.disconnect();
    host.remove();
  };

  const attemptRebindOrTeardown = (fromTimer: boolean): void => {
    if (tornDown) return;
    if (document.body?.contains(activeComposer)) {
      giveUpMisses = 0;
      clearRelookupTimer();
      placeSuggestOverlay(host, activeComposer, ghost, hint);
      return;
    }
    const next = pickMessengerComposerElement(document);
    if (next) {
      giveUpMisses = 0;
      clearRelookupTimer();
      rebindToComposer(next);
      placeSuggestOverlay(host, activeComposer, ghost, hint);
      return;
    }
    if (fromTimer) {
      giveUpMisses += 1;
      if (giveUpMisses >= MAX_COMPOSER_RELOOKUPS) {
        teardown("composer_removed");
        return;
      }
    }
    if (relookupTimer === undefined) {
      relookupTimer = window.setTimeout(() => {
        relookupTimer = undefined;
        attemptRebindOrTeardown(true);
      }, 120);
    }
  };

  const syncPosition = (): void => {
    if (tornDown) return;
    if (document.body?.contains(activeComposer)) {
      giveUpMisses = 0;
      clearRelookupTimer();
      placeSuggestOverlay(host, activeComposer, ghost, hint);
      return;
    }
    attemptRebindOrTeardown(false);
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
      const target =
        document.body?.contains(activeComposer) ? activeComposer : pickMessengerComposerElement(document);
      if (target) {
        commitSuggestionIntoComposer(target, text);
      }
      committingSuggestion = false;
      teardown("tab_accept");
    }
  };

  if (typeof ResizeObserver !== "undefined") {
    ro = new ResizeObserver(() => {
      syncPosition();
    });
    ro.observe(activeComposer);
  }

  window.addEventListener("scroll", onScrollOrResize, true);
  window.addEventListener("resize", onScrollOrResize);
  document.addEventListener("keydown", onKeyDown, true);
  activeComposer.addEventListener("input", onComposerInput);

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
