export const FME_GET_THREAD_SNAPSHOT = "FME_GET_THREAD_SNAPSHOT" as const;
/** Popup / background → content: show `MarketplaceUI` prompt (content script uses deferred `sendResponse`). */
export const FME_PROMPT_USER = "FME_PROMPT_USER" as const;

export type GetThreadSnapshotMessage = { type: typeof FME_GET_THREAD_SNAPSHOT };
export type PromptUserMessage = { type: typeof FME_PROMPT_USER; message: string };
