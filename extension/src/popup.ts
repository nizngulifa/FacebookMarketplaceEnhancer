/**
 * Popup UI entry. Keep side effects and DOM wiring here; extract helpers as the
 * extension grows (e.g. src/popup/ or src/lib/).
 */
function setStatus(message: string): void {
  const el = document.getElementById("status");
  if (el) el.textContent = message;
}

function main(): void {
  setStatus("If you see this after Reload, the new build is live.");
}

main();
