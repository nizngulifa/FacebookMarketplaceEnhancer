/** aria-label on the scrollable message region */
const LOG_ARIA_PREFIX = "Messages in conversation titled ";

export type ThreadMessage = {
  timestamp?: string;
  sender?: string;
  text: string;
  rawAriaLabel: string;
};

export type ThreadSnapshot = {
  logFound: boolean;
  title?: string;
  messages: ThreadMessage[];
};

export function extractTitleFromLog(log: Element): string | undefined {
  const label = log.getAttribute("aria-label");
  if (!label?.startsWith(LOG_ARIA_PREFIX)) return undefined;
  const title = label.slice(LOG_ARIA_PREFIX.length).trim();
  return title || undefined;
}

export function findMessageLogRoot(doc: Document): Element | null {
  const byLabel = doc.querySelector('[role="log"][aria-label^="Messages in conversation"]');
  if (byLabel) return byLabel;
  return doc.querySelector('[role="log"]');
}

/**
 * Parse Messenger's row aria-label:
 * "At {date}, {time} AM|PM, {Sender}: {body}"
 * Datetime may contain commas; we anchor on the last "AM, " / "PM, ".
 */
export function parseMessengerRowAriaLabel(label: string): {
  timestamp?: string;
  sender?: string;
  text: string;
} {
  const trimmed = label.trim();
  if (!trimmed.startsWith("At ")) {
    return { text: trimmed };
  }
  const am = trimmed.lastIndexOf("AM, ");
  const pm = trimmed.lastIndexOf("PM, ");
  const cut = Math.max(am, pm);
  if (cut === -1) {
    return { text: trimmed.slice(3).trim() };
  }
  const timestamp = trimmed.slice(3, cut + 2).trim();
  const afterTime = trimmed.slice(cut + 4).trim();
  const colon = afterTime.indexOf(": ");
  if (colon === -1) {
    return { timestamp, sender: afterTime, text: "" };
  }
  const sender = afterTime.slice(0, colon).trim();
  const text = afterTime.slice(colon + 2).trim();
  return { timestamp, sender, text };
}

function normalizeBody(s: string): string {
  return s
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Injected / system UI rows we do not treat as conversation (sold banner is allowed). */
const CLUTTER_SUBSTRINGS = [
  "started this chat",
  "waiting for your response",
  "you can now rate each other",
  "people may rate one another",
  "message sent",
  "view buyer profile",
  "buyer details",
  "conversation details",
];

function isInjectedUiBody(body: string): boolean {
  const n = normalizeBody(body);
  if (!n) return true;
  for (const frag of CLUTTER_SUBSTRINGS) {
    if (n.includes(frag)) return true;
  }
  if (/^rate\s+/.test(n)) return true;
  return false;
}

function rowHasMarketplaceRatingCta(row: Element): boolean {
  return (
    row.querySelector(
      'a[href*="marketplace/you/rate"], a[href*="buyer_rating_eligibility"], a[href*="BUYER_RATING_ELIGIBILITY"]',
    ) != null
  );
}

function isConversationRow(parsed: ReturnType<typeof parseMessengerRowAriaLabel>): boolean {
  if (!parsed.timestamp || !parsed.sender) return false;
  return parsed.text.trim().length > 0;
}

export function extractThreadSnapshot(doc: Document): ThreadSnapshot {
  const log = findMessageLogRoot(doc);
  if (!log) {
    return { logFound: false, messages: [] };
  }
  const title = extractTitleFromLog(log);
  const rows = Array.from(
    log.querySelectorAll('[data-scope="messages_table"][aria-roledescription="message"]'),
  );
  const messages: ThreadMessage[] = [];
  for (const row of rows) {
    const raw = row.getAttribute("aria-label")?.trim() ?? "";
    if (!raw) continue;
    const parsed = parseMessengerRowAriaLabel(raw);
    if (!isConversationRow(parsed)) continue;
    const text = parsed.text.trim();
    if (isInjectedUiBody(text)) continue;
    if (rowHasMarketplaceRatingCta(row)) continue;
    messages.push({
      timestamp: parsed.timestamp,
      sender: parsed.sender,
      text,
      rawAriaLabel: raw,
    });
  }
  return { logFound: true, title, messages };
}
