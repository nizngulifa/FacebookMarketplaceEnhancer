import { fmeContentLog } from "./fme-content-log";
import { FME_BACKGROUND_SHOW_SUGGEST_REPLY } from "./messenger-protocol";

type BgSuggestResult = { ok?: boolean; error?: string };

/**
 * Retries `FME_BACKGROUND_SHOW_SUGGEST_REPLY` until the worker reports success or max attempts.
 * Meta often swaps the composer iframe shortly after load; without retries the ghost never mounts.
 */
export function retryGhostSuggestViaBackground(
  text: string,
  options: { maxAttempts: number; retryMs: number; logScope: string },
): void {
  let attempt = 0;
  const trySuggestBg = (): void => {
    void chrome.runtime
      .sendMessage({
        type: FME_BACKGROUND_SHOW_SUGGEST_REPLY,
        text,
      })
      .then((r: unknown) => {
        const res = r as BgSuggestResult;
        if (res?.ok === true) {
          fmeContentLog(`${options.logScope}:suggest ok via background`, { attempt });
          return;
        }
        attempt += 1;
        if (attempt < options.maxAttempts) {
          window.setTimeout(trySuggestBg, options.retryMs);
        } else {
          fmeContentLog(`${options.logScope}:suggest gave up`, { attempt, error: res?.error });
        }
      })
      .catch((e: unknown) => {
        attempt += 1;
        if (attempt < options.maxAttempts) {
          window.setTimeout(trySuggestBg, options.retryMs);
        } else {
          fmeContentLog(`${options.logScope}:suggest sendMessage failed`, e);
        }
      });
  };
  trySuggestBg();
}
