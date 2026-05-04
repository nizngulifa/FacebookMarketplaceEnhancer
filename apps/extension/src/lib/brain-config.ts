/**
 * Default origin for the local brain HTTP server (`make brain-serve`).
 * Override later via options page / `chrome.storage` if needed.
 */
export const DEFAULT_BRAIN_SERVER_ORIGIN = "http://127.0.0.1:8765";

export const BRAIN_PREDICT_PATH = "/v1/predict";

export function brainPredictUrl(serverOrigin: string): string {
  return `${serverOrigin.replace(/\/$/, "")}${BRAIN_PREDICT_PATH}`;
}
