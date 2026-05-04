import { fmeContentLog } from "./fme-content-log";

export const FME_PROMPT_HOST_ID = "fme-marketplace-ui-prompt-host";
export const FME_DEBUG_MARKER_ID = "fme-debug-marker";

function removeExistingPromptHost(): void {
  document.getElementById(FME_PROMPT_HOST_ID)?.remove();
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
