# Chrome extension

Manifest V3 extension. Source lives in `src/`; **load unpacked** from this directory **after** a build so `dist/` exists.

## Prerequisites

- [Google Chrome](https://www.google.com/chrome/) (for loading unpacked extensions)
- Node.js 20+ and npm (for TypeScript + esbuild)

## First-time setup

```bash
cd extension
npm install
npm run build
```

## Development loop

1. `npm run watch` — rebuilds `dist/` when `src/` changes (leave this running), **or** run `npm run build` after edits.
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


## Layout


| Path                | Role                                           |
| ------------------- | ---------------------------------------------- |
| `manifest.json`     | Extension capabilities and entrypoints         |
| `src/`              | TypeScript source                              |
| `dist/`             | Build output (gitignored; run `npm run build`) |
| `popup.html`        | Popup markup; references `dist/popup.js`       |
| `popup.css`         | Popup styles                                   |
| `esbuild.config.js` | Bundler config; add entry points as needed     |


## Adding features (for future work)

- **New UI surface** — add an entry in `esbuild.config.js` (`entryPoints`), reference the emitted script from your HTML.
- **Background / service worker** — add `src/background.ts`, register in `manifest.json` under `background.service_worker` (single file must be self-contained or use import scripts carefully per MV3 rules; bundling one file is simplest).
- **Content scripts** — add under `src/content/`, declare in `manifest.json` with `matches`; bundle each entry with esbuild.
- **Permissions** — add only what you need; keeps review and user trust simpler.

## Monorepo note

This folder is intentionally self-contained (`package.json` here). The repo root README links here for the full-app context (database, MCP, etc.).