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
| `src/popup/write-path-selftest.ts` | Dev-only “Write path” steps (scripting API) |
| `src/lib/`           | Shared helpers                                 |
| `src/lib/marketplace-ui.ts` | **`MarketplaceUI` write surface** — `promptUser` (dark assistant chip), debug marker |
| `src/lib/prompt-via-scripting.ts` | `runPromptUserOnTab` — inject bridge + call `promptUser` via `scripting` |
| `src/background/background.ts` | Service worker: `FME_BACKGROUND_SHOW_PROMPT` → `runPromptUserOnTab` |
| `src/content/fme-prompt-bridge.ts` | On-demand bundle: assigns `globalThis.__fmePromptUser` for `scripting` |
| `dist/`              | Build output (gitignored; run build first)       |
| `popup.html`         | Popup markup; references `dist/popup.js`       |
| `popup.css`          | Popup styles                                   |
| `esbuild.config.js`  | Bundler config; add entry points as needed     |
| `.env.example`       | Placeholder for future extension env vars      |

## MarketplaceUI write path (`promptUser`)

All Messenger DOM **writes** for copilot UX should go through **`src/lib/marketplace-ui.ts`** so we do not scatter `document.createElement` across the codebase.

- **`promptUser(message)`** — dismissible **dark assistant chip** on the **inline-end** edge (usually right in LTR): reads as an internal copilot voice, not a tutorial card. No full-page dimmer — the user can **keep scrolling** the thread. **Got it** or **Escape** closes it.
- **Debug marker** — `injectDebugMarker()` / `#fme-debug-marker` for manual verification only.

### Who can call `promptUser`?

| Caller | Supported today? | How |
|--------|------------------|-----|
| **Random website / REST API** | **No** | Browsers do not expose extension APIs to the open web. |
| **Same extension (popup, options, future orchestrator code)** | **Yes** | Prefer `chrome.runtime.sendMessage` to the **service worker** with **`FME_BACKGROUND_SHOW_PROMPT`** `{ message, tabId? }`. The worker runs `runPromptUserOnTab` (`src/lib/prompt-via-scripting.ts`). If `tabId` is omitted, the worker picks the focused `messenger.com` tab (same heuristics as the popup). |
| **Content script** (e.g. message from another extension context) | **Yes** | `chrome.tabs.sendMessage` with **`FME_PROMPT_USER`** still calls `promptUser` in-page (deferred `sendResponse`); on some setups the **response payload** back to the caller may be unreliable—use the **background** path above if you need a confirmed return value. |
| **Trusted web app** | **Not wired** | Possible follow-up: `externally_connectable` + `chrome.runtime.sendMessage` from an allow-listed origin, or a **WebSocket / fetch loop** in the service worker that listens to your server then calls `runPromptUserOnTab`. |

### How the popup self-test works (important for contributors)

On some Chrome + `messenger.com` setups, **`chrome.tabs.sendMessage` + `sendResponse` from a content script returns `undefined`** to the caller even when the listener runs. The popup’s **Write path (self-test)** therefore uses **`chrome.scripting.executeScript`** instead:

1. **Ping / marker** — `executeScript` with `allFrames: true` so code runs in the same document the user sees (Messenger often has a single meaningful frame in practice; `allFrames` is still the right default for diagnostics).
2. **Prompt** — uses **`runPromptUserOnTab`** (bridge file + `func`), same as the service worker.

After changing permissions, **reload the extension** on `chrome://extensions` so Chrome grants them (e.g. `scripting`).

**Reload messages** still uses `tabs.sendMessage` + `FME_GET_THREAD_SNAPSHOT`; if that returns empty data, reload Messenger or migrate that read path to `executeScript` the same way.

### Protocol constants

See `src/lib/messenger-protocol.ts`: **`FME_PROMPT_USER`** (content script), **`FME_BACKGROUND_SHOW_PROMPT`** (service worker → `scripting`).

## Adding features (for future work)

- **New UI surface** — add an entry in `esbuild.config.js` (`entryPoints`), reference the emitted script from your HTML.
- **Background / service worker** — `src/background/background.ts` → `dist/background.js`; registered in `manifest.json`.
- **Content scripts** — add under `src/content/`, declare in `manifest.json` with `matches`; bundle each entry with esbuild.
- **Permissions** — add only what you need; keeps review and user trust simpler.

## Monorepo note

This package is part of the root **npm workspace** (`apps/*`). Dependencies are installed from the repo root with `npm install`; the workspace name is `facebook-marketplace-enhancer-extension`. See [docs/monorepo.md](../../docs/monorepo.md).
