# Chrome extension

**→ New here?** Read **[docs/extension-for-collaborators.md](../../docs/extension-for-collaborators.md)** first (60-second map, internal APIs, and how to add server / web exposure later).

Manifest V3 extension. Source lives in `src/`; **load unpacked** from **`apps/extension/`** (this directory) **after** a build so `dist/` exists.

> **Path change:** If you still have an unpacked extension pointing at the old `extension/` folder, remove it in `chrome://extensions` and **Load unpacked** → select this `apps/extension` directory.

## Prerequisites

- [Google Chrome](https://www.google.com/chrome/) (for loading unpacked extensions)
- Node.js 20+ and npm (for TypeScript + esbuild)

## First-time setup

From **repo root** (recommended — npm workspaces):

```bash
make extension-install
make extension-build
```

Or from this directory only:

```bash
cd apps/extension
npm install
npm run build
```

## Development loop

1. `npm run watch` from this directory, **or** `make extension-watch` from repo root — rebuilds `dist/` when `src/` changes. Alternatively run `npm run build` / `make extension-build` after edits.
2. Chrome → `chrome://extensions` → **Reload** this extension.
3. Click the toolbar icon to open the popup.

Use **Reload** on the extension card after each build; refreshing the popup alone does not reload extension code.

Opening Chrome: prefer starting Chrome normally, then paste `chrome://extensions` in the address bar. Passing `chrome://` URLs via command-line `open` can spawn a second Chrome instance and trigger profile errors on macOS.

## Scripts

| Script              | Purpose                            |
| ------------------- | ---------------------------------- |
| `npm run build`     | Production-style bundle to `dist/` |
| `npm run watch`     | Rebuild on change                  |
| `npm run typecheck` | `tsc --noEmit` (no output files)   |

From repo root: `npm run build:extension`, `npm run watch:extension`, `npm run typecheck:extension`.

## Layout

| Path                 | Role                                           |
| -------------------- | ---------------------------------------------- |
| `manifest.json`      | Extension capabilities and entrypoints         |
| `src/popup/`         | Popup entry (`popup.ts` → `dist/popup.js`)     |
| `src/popup/messenger-tab.ts` | Resolve the active `messenger.com` tab from the popup |
| `src/lib/`           | Shared helpers                                 |
| `src/lib/marketplace-ui.ts` | **`MarketplaceUI` write surface** — `promptUser` (dark assistant chip), `suggestReply` (composer ghost text), debug marker |
| `src/lib/messenger-composer.ts` | Composer discovery for `suggestReply` (strict + loose `contenteditable` heuristics) |
| `src/lib/brain-config.ts` | Default local brain server URL (`http://127.0.0.1:8765`) + `brainPredictUrl()` |
| `src/lib/brain-client.ts` | Service worker: `fetch` `POST /v1/predict` (`fetchSellerReply`, `normalizeBrainTurns`) — **no API keys** |
| `src/lib/thread-to-brain-messages.ts` | Maps `ThreadSnapshot` → brain `ChatInput` turns (`You` → seller) |
| `src/lib/ghost-suggest-retry.ts` | Retries `FME_BACKGROUND_SHOW_SUGGEST_REPLY` until composer bridge succeeds |
| `src/lib/fme-ui-host-ids.ts` | Stable DOM ids for injected UI hosts (shared with scripting verify) |
| `src/lib/prompt-via-scripting.ts` | `runPromptUserOnTab`, `runSuggestReplyOnTab` — inject bridge(s) + call via `scripting` |
| `src/background/background.ts` | Service worker: brain predict (`fetch`), `FME_BACKGROUND_SHOW_PROMPT`, `FME_BACKGROUND_SHOW_SUGGEST_REPLY` |
| `src/content/fme-prompt-bridge.ts` | On-demand bundle: `__fmePromptUser`, `__fmeSuggestReply` for `scripting` |
| `src/content/fme-composer-probe-bridge.ts` | On-demand bundle: `__fmeProbeComposer` (all-frames composer probe) |
| `src/content/messenger.ts` | Content script: snapshot/prompt/suggest messages + **on each full tab load** assistant chip + brain-driven ghost reply |
| `dist/`              | Build output (gitignored; run build first)       |
| `popup.html`         | Popup markup; references `dist/popup.js`       |
| `popup.css`          | Popup styles                                   |
| `esbuild.config.js`  | Bundler config; add entry points as needed     |
| `.env.example`       | Placeholder for future extension env vars      |

## MarketplaceUI write path (`promptUser`, `suggestReply`)

All Messenger DOM **writes** for copilot UX should go through **`src/lib/marketplace-ui.ts`** so we do not scatter `document.createElement` across the codebase.

- **`promptUser(message)`** — dismissible **dark assistant chip** on the **inline-end** edge (usually right in LTR): reads as an internal copilot voice, not a tutorial card. No full-page dimmer — the user can **keep scrolling** the thread. **Got it** or **Escape** closes it.
- **`suggestReply(text)`** — **Ghost suggestion** over the thread composer: muted overlay + **Tab** inserts the text into the field (user still sends the message), **Escape** dismisses without inserting. Typing in the composer clears the ghost.
- **Debug marker** — `injectDebugMarker()` / `#fme-debug-marker` for manual verification only.

### Who can call `promptUser`?

| Caller | Supported today? | How |
|--------|------------------|-----|
| **Random website / REST API** | **No** | Browsers do not expose extension APIs to the open web. |
| **Same extension (popup, options, future orchestrator code)** | **Yes** | Prefer `chrome.runtime.sendMessage` to the **service worker** with **`FME_BACKGROUND_SHOW_PROMPT`** `{ message, tabId? }`. The worker runs `runPromptUserOnTab` (`src/lib/prompt-via-scripting.ts`). If `tabId` is omitted, the worker picks the focused `messenger.com` tab (same heuristics as the popup). |
| **Content script** (e.g. message from another extension context) | **Yes** | `chrome.tabs.sendMessage` with **`FME_PROMPT_USER`** still calls `promptUser` in-page (deferred `sendResponse`); on some setups the **response payload** back to the caller may be unreliable—use the **background** path above if you need a confirmed return value. |
| **Trusted web app** | **Not wired** | Possible follow-up: `externally_connectable` + `chrome.runtime.sendMessage` from an allow-listed origin, or a **WebSocket / fetch loop** in the service worker that listens to your server then calls `runPromptUserOnTab`. |

### Who can call `suggestReply`?

| Caller | Supported today? | How |
|--------|------------------|-----|
| **Same extension (popup, service worker, future orchestrator)** | **Yes** | Prefer `chrome.runtime.sendMessage` with **`FME_BACKGROUND_SHOW_SUGGEST_REPLY`** `{ text, tabId? }`. The worker runs **`runSuggestReplyOnTab`** (composer probe + `fmePromptBridge.js` into the chosen frame). |
| **Content script** | **Yes** | `chrome.tabs.sendMessage` with **`FME_SUGGEST_REPLY`** `{ text }` (same caveats as `FME_PROMPT_USER` about flaky `sendResponse`). |

### Developer testing (Messenger reload)

For fast iteration, **`src/content/messenger.ts`** on each **full Messenger tab load**:

1. Sends **`FME_BACKGROUND_SHOW_PROMPT`** to the service worker (same **`chrome.scripting`** path as production: `runPromptUserOnTab`).
2. Extracts a **`ThreadSnapshot`**, maps it to brain turns (`thread-to-brain-messages.ts`), then sends **`FME_BACKGROUND_BRAIN_PREDICT`** to the worker. The worker **`fetch`es** the local brain server (`make brain-serve` → `POST http://127.0.0.1:8765/v1/predict`). **Start the brain server and set `OPENAI_API_KEY` on the Python side** or prediction fails (logged as `brainSuggest:predict failed`).
3. On success, sends **`FME_BACKGROUND_SHOW_SUGGEST_REPLY`** with the model `reply` text; **`ghost-suggest-retry.ts`** retries until `runSuggestReplyOnTab` succeeds (composer iframe often mounts late).

Check **DevTools → Console** (`[FME content]`). Remove or gate this auto-run before shipping end-user behavior.

**Further reading:** [docs/brain.md](../../docs/brain.md) (extension ↔ brain MVP), [docs/extension-for-collaborators.md](../../docs/extension-for-collaborators.md).

On some Chrome + `messenger.com` setups, **`chrome.tabs.sendMessage` + `sendResponse` from a content script returns `undefined`** to the caller even when the listener runs. The popup’s **Reload messages** button still uses `sendMessage` + **`FME_GET_THREAD_SNAPSHOT`**; if it returns empty data, reload Messenger or migrate that read path to `chrome.scripting` like **`runPromptUserOnTab`** / **`runSuggestReplyOnTab`** do for writes.

After changing permissions, **reload the extension** on `chrome://extensions` so Chrome grants them (e.g. `scripting`).

### Protocol constants

See `src/lib/messenger-protocol.ts`: **`FME_PROMPT_USER`**, **`FME_SUGGEST_REPLY`** (content script), **`FME_BACKGROUND_SHOW_PROMPT`**, **`FME_BACKGROUND_SHOW_SUGGEST_REPLY`**, **`FME_BACKGROUND_BRAIN_PREDICT`** (content → worker → localhost `fetch`).

## Adding features (for future work)

- **New UI surface** — add an entry in `esbuild.config.js` (`entryPoints`), reference the emitted script from your HTML.
- **Background / service worker** — `src/background/background.ts` → `dist/background.js`; registered in `manifest.json`.
- **Content scripts** — add under `src/content/`, declare in `manifest.json` with `matches`; bundle each entry with esbuild.
- **Permissions** — add only what you need; keeps review and user trust simpler.

## Monorepo note

This package is part of the root **npm workspace** (`apps/*`). Dependencies are installed from the repo root with `npm install`; the workspace name is `facebook-marketplace-enhancer-extension`. See [docs/monorepo.md](../../docs/monorepo.md).
