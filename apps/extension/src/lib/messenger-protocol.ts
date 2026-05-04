export const FME_GET_THREAD_SNAPSHOT = "FME_GET_THREAD_SNAPSHOT" as const;
/** Popup / background → content: show `MarketplaceUI` prompt (content script uses deferred `sendResponse`). */
export const FME_PROMPT_USER = "FME_PROMPT_USER" as const;
/**
 * Extension-internal: popup / orchestrator → service worker →
 * `chrome.scripting` + `promptUser` on a Messenger tab. Not callable from arbitrary websites.
 */
export const FME_BACKGROUND_SHOW_PROMPT = "FME_BACKGROUND_SHOW_PROMPT" as const;
/** Popup / background → content: ghost reply suggestion in the composer (Tab to insert). */
export const FME_SUGGEST_REPLY = "FME_SUGGEST_REPLY" as const;
/**
 * Extension-internal: popup / orchestrator → service worker →
 * `chrome.scripting` + `suggestReply` on a Messenger tab.
 */
export const FME_BACKGROUND_SHOW_SUGGEST_REPLY = "FME_BACKGROUND_SHOW_SUGGEST_REPLY" as const;

export type GetThreadSnapshotMessage = { type: typeof FME_GET_THREAD_SNAPSHOT };
export type PromptUserMessage = { type: typeof FME_PROMPT_USER; message: string };
export type BackgroundShowPromptMessage = {
  type: typeof FME_BACKGROUND_SHOW_PROMPT;
  message: string;
  /** If omitted, the worker picks the focused messenger.com tab (same heuristics as the popup). */
  tabId?: number;
};
export type SuggestReplyMessage = { type: typeof FME_SUGGEST_REPLY; text: string };
export type BackgroundShowSuggestReplyMessage = {
  type: typeof FME_BACKGROUND_SHOW_SUGGEST_REPLY;
  text: string;
  tabId?: number;
};
