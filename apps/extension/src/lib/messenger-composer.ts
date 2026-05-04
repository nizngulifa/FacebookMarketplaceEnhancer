/**
 * Best-effort discovery of the Messenger thread composer (message input).
 * Prefer ARIA (`role="textbox"`) per project constraints; fall back when Meta omits it.
 */

export type ComposerFrameProbe = {
  href: string;
  isTop: boolean;
  composer: null | { bottom: number; area: number };
};

function sortByLowestOnScreen(candidates: HTMLElement[], doc: Document): HTMLElement | null {
  if (candidates.length === 0) return null;
  const vh = doc.defaultView?.innerHeight ?? 0;
  const visible = candidates.filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < vh;
  });
  const pool = visible.length > 0 ? visible : candidates;
  pool.sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom);
  return pool[0] ?? null;
}

/** Collect likely composer elements (ordered: strict first, then loose heuristics). */
export function listMessengerComposerCandidates(doc: Document): HTMLElement[] {
  const strict = Array.from(
    doc.querySelectorAll<HTMLElement>('[contenteditable="true"][role="textbox"]'),
  );
  if (strict.length > 0) return strict;

  const vh = doc.defaultView?.innerHeight ?? 0;
  const loose = Array.from(doc.querySelectorAll<HTMLElement>('[contenteditable="true"]')).filter(
    (el) => {
      const r = el.getBoundingClientRect();
      const area = r.width * r.height;
      return (
        r.width >= 120 &&
        r.height >= 18 &&
        area > 2000 &&
        r.bottom > vh * 0.25 &&
        el.closest('[data-scope="messages_table"]') == null
      );
    },
  );
  return loose;
}

export function pickMessengerComposerElement(doc: Document): HTMLElement | null {
  return sortByLowestOnScreen(listMessengerComposerCandidates(doc), doc);
}

/**
 * Serializable payload for `chrome.scripting.executeScript` (all frames).
 * Keep DOM-only — runs in page isolated world.
 */
export function probeComposerFramePayload(): ComposerFrameProbe {
  const doc = document;
  const composer = pickMessengerComposerElement(doc);
  if (!composer) {
    return {
      href: location.href,
      isTop: window === window.top,
      composer: null,
    };
  }
  const r = composer.getBoundingClientRect();
  return {
    href: location.href,
    isTop: window === window.top,
    composer: { bottom: r.bottom, area: r.width * r.height },
  };
}
