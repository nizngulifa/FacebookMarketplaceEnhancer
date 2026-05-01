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
| `src/lib/`           | Shared helpers                                 |
| `dist/`              | Build output (gitignored; run build first)       |
| `popup.html`         | Popup markup; references `dist/popup.js`       |
| `popup.css`          | Popup styles                                   |
| `esbuild.config.js`  | Bundler config; add entry points as needed     |
| `.env.example`       | Placeholder for future extension env vars      |

## Adding features (for future work)

- **New UI surface** — add an entry in `esbuild.config.js` (`entryPoints`), reference the emitted script from your HTML.
- **Background / service worker** — add e.g. `src/background/background.ts`, register in `manifest.json` under `background.service_worker` (bundling one file is simplest for MV3).
- **Content scripts** — add under `src/content/`, declare in `manifest.json` with `matches`; bundle each entry with esbuild.
- **Permissions** — add only what you need; keeps review and user trust simpler.

## Monorepo note

This package is part of the root **npm workspace** (`apps/*`). Dependencies are installed from the repo root with `npm install`; the workspace name is `facebook-marketplace-enhancer-extension`. See [docs/monorepo.md](../../docs/monorepo.md).
