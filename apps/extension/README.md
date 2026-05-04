# Chrome extension

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
| `src/lib/marketplace-ui.ts` | **`MarketplaceUI` write surface** — `promptUser`, debug marker |
| `src/content/fme-prompt-bridge.ts` | On-demand bundle: exposes `promptUser` for `scripting.executeScript` |
| `dist/`              | Build output (gitignored; run build first)       |
| `popup.html`         | Popup markup; references `dist/popup.js`       |
| `popup.css`          | Popup styles                                   |
| `esbuild.config.js`  | Bundler config; add entry points as needed     |
| `.env.example`       | Placeholder for future extension env vars      |

## MarketplaceUI write path (`promptUser`)

All Messenger DOM **writes** for copilot UX should go through **`src/lib/marketplace-ui.ts`** so we do not scatter `document.createElement` across the codebase.

- **`promptUser(message)`** — dismissible modal overlay (shadow DOM + full-viewport host). Escape, “Dismiss”, or backdrop click closes it.
- **Debug marker** — `injectDebugMarker()` / `#fme-debug-marker` for manual verification only.

### How the popup self-test works (important for contributors)

On some Chrome + `messenger.com` setups, **`chrome.tabs.sendMessage` + `sendResponse` from a content script returns `undefined`** to the caller even when the listener runs. The popup’s **Write path (self-test)** therefore uses **`chrome.scripting.executeScript`** instead:

1. **Ping / marker** — `executeScript` with `allFrames: true` so code runs in the same document the user sees (Messenger often has a single meaningful frame in practice; `allFrames` is still the right default for diagnostics).
2. **Prompt** — inject `dist/fmePromptBridge.js` (assigns `globalThis.__fmePromptUser`), then a tiny `func` calls it. Same isolated world as manifest content scripts.

After changing permissions, **reload the extension** on `chrome://extensions` so Chrome grants them (e.g. `scripting`).

**Reload messages** still uses `tabs.sendMessage` + `FME_GET_THREAD_SNAPSHOT`; if that returns empty data, reload Messenger or migrate that read path to `executeScript` the same way.

### Protocol constants

See `src/lib/messenger-protocol.ts`. **`FME_PROMPT_USER`** is handled in the content script for non-popup callers (e.g. future orchestrator).

## Adding features (for future work)

- **New UI surface** — add an entry in `esbuild.config.js` (`entryPoints`), reference the emitted script from your HTML.
- **Background / service worker** — add e.g. `src/background/background.ts`, register in `manifest.json` under `background.service_worker` (bundling one file is simplest for MV3).
- **Content scripts** — add under `src/content/`, declare in `manifest.json` with `matches`; bundle each entry with esbuild.
- **Permissions** — add only what you need; keeps review and user trust simpler.

## Monorepo note

This package is part of the root **npm workspace** (`apps/*`). Dependencies are installed from the repo root with `npm install`; the workspace name is `facebook-marketplace-enhancer-extension`. See [docs/monorepo.md](../../docs/monorepo.md).
