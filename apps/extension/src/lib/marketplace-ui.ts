import { fmeContentLog } from "./fme-content-log";

export const FME_PROMPT_HOST_ID = "fme-marketplace-ui-prompt-host";
export const FME_DEBUG_MARKER_ID = "fme-debug-marker";

function removeExistingPromptHost(): void {
  document.getElementById(FME_PROMPT_HOST_ID)?.remove();
}

export type DebugMarkerRect = { x: number; y: number; width: number; height: number };

/**
 * Step 2 — minimal light-DOM injection (no shadow) to verify the tab can be written.
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
  const rect = el.getBoundingClientRect();
  const result = {
    rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
  };
  fmeContentLog("injectDebugMarker:done", result);
  return result;
}

/**
 * Step 3 — dismissible overlay (`MarketplaceUI.promptUser`).
 */
export function promptUser(message: string): void {
  fmeContentLog("promptUser:start", { length: message.length });
  removeExistingPromptHost();

  const host = document.createElement("div");
  host.id = FME_PROMPT_HOST_ID;
  host.setAttribute("data-fme", "marketplace-ui-prompt");
  host.style.cssText = [
    "position:fixed",
    "inset:0",
    "width:100%",
    "height:100%",
    "margin:0",
    "padding:0",
    "border:0",
    "pointer-events:none",
    "z-index:2147483647",
    "display:block",
  ].join(";");

  const shadow = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = `
    :host {
      font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    }
    .backdrop {
      position: absolute;
      inset: 0;
      z-index: 0;
      pointer-events: auto;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      box-sizing: border-box;
      background: rgba(0, 0, 0, 0.45);
    }
    .card {
      max-width: 420px;
      width: 100%;
      padding: 20px 22px;
      border-radius: 12px;
      background: #fff;
      color: #1a1a1a;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
      box-sizing: border-box;
    }
    .title {
      margin: 0 0 10px;
      font-size: 15px;
      font-weight: 600;
    }
    .body {
      margin: 0 0 18px;
      font-size: 14px;
      line-height: 1.45;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }
    button {
      font: inherit;
      font-weight: 600;
      padding: 8px 14px;
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

  const backdrop = document.createElement("div");
  backdrop.className = "backdrop";
  backdrop.setAttribute("role", "dialog");
  backdrop.setAttribute("aria-modal", "true");
  backdrop.setAttribute("aria-labelledby", "fme-prompt-title");

  const card = document.createElement("div");
  card.className = "card";

  const title = document.createElement("h2");
  title.className = "title";
  title.id = "fme-prompt-title";
  title.textContent = "Marketplace Enhancer";

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
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) dismiss();
  });
  document.addEventListener("keydown", onKeyDown, true);

  actions.appendChild(dismissBtn);
  card.append(title, body, actions);
  backdrop.appendChild(card);
  shadow.append(style, backdrop);
  const root = document.body ?? document.documentElement;
  root.appendChild(host);
  fmeContentLog("promptUser:mounted", { hostId: FME_PROMPT_HOST_ID });
}
