import { setStatus } from "../lib/status";

/**
 * Popup UI entry. Keep side effects and DOM wiring here; add helpers under
 * `src/lib/` or split popup-specific pieces under `src/popup/`.
 */
function main(): void {
  setStatus("If you see this after Reload, the new build is live.");
}

main();
