/** Structured logs on the page console (Messenger DevTools → Console). */
export function fmeContentLog(step: string, data?: unknown): void {
  const payload = data === undefined ? "" : data;
  console.info(`[FME content] ${step}`, payload);
}
