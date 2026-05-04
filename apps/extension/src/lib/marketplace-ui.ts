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
 * Non-blocking instruction panel (`MarketplaceUI.promptUser`): docked on the inline-end edge so the
 * user can still scroll the thread (no modal backdrop). Dismiss or Escape to hide.
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
    "width:min(300px,40vw)",
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
    .panel {
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-height: inherit;
      overflow: auto;
      padding: 14px 16px;
      border-radius: 10px;
      background: #fff;
      color: #1a1a1a;
      border: 1px solid #ccd0d5;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.18);
      box-sizing: border-box;
    }
    .title {
      margin: 0;
      font-size: 14px;
      font-weight: 600;
    }
    .body {
      margin: 0;
      font-size: 13px;
      line-height: 1.45;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
    }
    button {
      font: inherit;
      font-weight: 600;
      padding: 7px 12px;
      border-radius: 8px;
      border: none;
      cursor: pointer;
      background: #1877f2;
      color: #fff;
    }
    button:hover {
      background: #166fe5;
    }
    button:focus-visible {
      outline: 2px solid #1877f2;
      outline-offset: 2px;
    }
  `;

  const panel = document.createElement("div");
  panel.className = "panel";
  panel.setAttribute("role", "region");
  panel.setAttribute("aria-label", "Marketplace Enhancer instructions");

  const title = document.createElement("h2");
  title.className = "title";
  title.id = "fme-prompt-title";
  title.textContent = "Next step";

  const body = document.createElement("p");
  body.className = "body";
  body.textContent = message;

  const actions = document.createElement("div");
  actions.className = "actions";

  const dismissBtn = document.createElement("button");
  dismissBtn.type = "button";
  dismissBtn.textContent = "Dismiss";

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

  actions.appendChild(dismissBtn);
  panel.append(title, body, actions);
  shadow.append(style, panel);
  const root = document.body ?? document.documentElement;
  root.appendChild(host);
  fmeContentLog("promptUser:mounted", { hostId: FME_PROMPT_HOST_ID });
}
