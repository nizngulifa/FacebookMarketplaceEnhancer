# Chrome extension — collaborator quickstart

Use this doc to **ship changes to `apps/extension/`** or to **hook the extension to an external system** (your server, another web app). It complements [apps/extension/README.md](../apps/extension/README.md).

---

## 1. Build and load (first 2 minutes)

| Step | Action |
|------|--------|
| 1 | From repo root: `make extension-build` (or `npm run build:extension`). |
| 2 | Chrome → `chrome://extensions` → **Developer mode** → **Load unpacked** → choose **`apps/extension/`** (must contain `dist/`). |
| 3 | After **any** `src/` change, rebuild and **Reload** the extension card. |
| 4 | Open **messenger.com** (Marketplace thread is fine) → hard-refresh the tab. |

**Typecheck:** `npm run typecheck:extension` from repo root.

---

## 2. Mental model (what exists today)

| Layer | Role |
|-------|------|
| **`src/lib/marketplace-ui.ts`** | **`MarketplaceUI` write path** — `promptUser(message)` (dark assistant chip), `suggestReply(text)` (composer ghost text, Tab to insert), `injectDebugMarker()` for dev checks. **All Messenger DOM writes for copilot UX should stay here.** |
| **`src/lib/prompt-via-scripting.ts`** | **`runPromptUserOnTab`**, **`runSuggestReplyOnTab`** — injects `dist/fmePromptBridge.js` (and for suggest, probes with `dist/fmeComposerProbeBridge.js` then targets `frameId`) then calls the UI helper via `chrome.scripting.executeScript`. Use this when you need a **reliable** return value from the popup or service worker. |
| **`src/content/fme-prompt-bridge.ts`** | Built to **`dist/fmePromptBridge.js`**. Assigns `globalThis.__fmePromptUser` / `__fmeSuggestReply` in the page’s **extension isolated world**. |
| **`src/content/fme-composer-probe-bridge.ts`** | Built to **`dist/fmeComposerProbeBridge.js`**. Assigns `globalThis.__fmeProbeComposer` for all-frame composer discovery before `suggestReply`. |
| **`src/background/background.ts`** | **Service worker** — handles **`FME_BACKGROUND_SHOW_PROMPT`** and **`FME_BACKGROUND_SHOW_SUGGEST_REPLY`**. |
| **`src/content/messenger.ts`** | Content script: **`FME_GET_THREAD_SNAPSHOT`**, **`FME_PROMPT_USER`**, **`FME_SUGGEST_REPLY`**, plus **dev-only** messages to the worker (`FME_BACKGROUND_SHOW_*`, tab from `sender.tab`) on each full Messenger load so writes use the **scripting** path (composer iframe). Popup “Reload messages” still uses `sendMessage` for snapshot; **responses to the caller can be `undefined`** on some Chrome + Messenger setups — prefer the **scripting** helpers from extension UI for writes that need a reliable return value. |

---

## 3. Internal APIs you can call **today** (same extension only)

### A. Show a prompt from popup / options / future orchestrator script

**Preferred:** message the service worker:

```ts
const result = await chrome.runtime.sendMessage({
  type: "FME_BACKGROUND_SHOW_PROMPT", // FME_BACKGROUND_SHOW_PROMPT in messenger-protocol.ts
  message: "Your instruction text here.",
  // tabId: optional; if omitted, worker picks focused messenger.com tab
});
// result: { ok: true } | { ok: false, error: string }
```

Constants live in **`src/lib/messenger-protocol.ts`**.

### B. Show a prompt directly from extension code that already has `tabId`

```ts
import { runPromptUserOnTab } from "../lib/prompt-via-scripting";

await runPromptUserOnTab(tabId, "Your instruction text here.");
```

### C. Content script → same tab (legacy)

`chrome.tabs.sendMessage(tabId, { type: FME_PROMPT_USER, message: "…" })` — **UI still runs**; **do not rely** on the reply payload for critical control flow.

### D. Ghost reply suggestion from popup / worker

**Preferred:** message the service worker:

```ts
const result = await chrome.runtime.sendMessage({
  type: "FME_BACKGROUND_SHOW_SUGGEST_REPLY", // in messenger-protocol.ts
  text: "Suggested reply text here.",
  // tabId: optional; if omitted, worker picks focused messenger.com tab
});
// result: { ok: true, logs: string[] } | { ok: false, error: string, logs?: string[] }
```

Or call **`runSuggestReplyOnTab(tabId, text)`** from code that already holds `tabId`.

---

## 4. “External world” — **not implemented** (your next feature)

Nothing in this repo yet lets **arbitrary internet callers** or **your REST API** invoke the extension directly. Chrome does not work that way. A **second developer** should pick one pattern and add manifest + worker code:

| Pattern | When to use | You add |
|---------|-------------|---------|
| **Outbound WebSocket / SSE / poll** in the service worker | Your server pushes “show prompt” events | `host_permissions` or narrow URL, auth, reconnect logic; handler calls `runPromptUserOnTab`. |
| **`externally_connectable`** | A **specific HTTPS web app** you control should call the extension | Manifest block + allow-listed origins; web page uses `chrome.runtime.sendMessage(EXTENSION_ID, …)` (Chrome only, extension installed). |
| **Native messaging** | A desktop helper or local agent talks to the extension | Host app + `nativeMessaging` manifest. |

**Secrets:** Do not embed API keys or DB URLs in extension source (see repo `AGENTS.md`). Keep tokens in `chrome.storage`, your server session, or env **outside** the shipped bundle as appropriate.

---

## 5. Protocol constants (single source of truth)

**`src/lib/messenger-protocol.ts`**

| Constant | Direction | Purpose |
|----------|-----------|---------|
| `FME_GET_THREAD_SNAPSHOT` | → content script | Thread DOM snapshot for popup “Reload messages”. |
| `FME_PROMPT_USER` | → content script | Call `promptUser` in-page (deferred reply). |
| `FME_SUGGEST_REPLY` | → content script | Call `suggestReply` in-page (deferred reply). |
| `FME_BACKGROUND_SHOW_PROMPT` | → service worker | Run `runPromptUserOnTab` (scripting path). |
| `FME_BACKGROUND_SHOW_SUGGEST_REPLY` | → service worker | Run `runSuggestReplyOnTab` (scripting path). |

---

## 6. Manifest and bundles

- **`manifest.json`** — `permissions`, `host_permissions`, `background.service_worker`, `content_scripts`, `action` popup.
- **`esbuild.config.js`** — `entryPoints`: `popup`, `content`, `background`, `fmePromptBridge`, `fmeComposerProbeBridge`. New entry = add here + reference from manifest/HTML if needed.

---

## 7. Verification checklist (before you PR)

- [ ] `make extension-build` and `npm run typecheck:extension` pass.
- [ ] Full **reload** of a Messenger thread tab: confirm dev **prompt** + **suggest** appear (until replaced by orchestrator-driven behavior).
- [ ] If you changed `promptUser` visuals: confirm scroll + dismiss (**Got it** / Escape).
- [ ] If you changed `suggestReply`: confirm ghost visibility, **Tab** inserts, **Escape** dismisses, typing clears.

---

## 8. Further reading

- [apps/extension/README.md](../apps/extension/README.md) — dev loop, Messenger reload testing vs `sendMessage` snapshot, layout table.
- [AGENTS.md](../AGENTS.md) — agent / automation notes for this repo.
