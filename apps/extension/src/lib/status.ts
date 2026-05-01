/** Update the popup status line; safe if `#status` is missing. */
export function setStatus(message: string): void {
  const el = document.getElementById("status");
  if (el) el.textContent = message;
}
