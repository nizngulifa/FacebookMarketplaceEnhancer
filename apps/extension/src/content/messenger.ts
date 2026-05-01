import { extractThreadSnapshot, type ThreadSnapshot } from "../lib/messenger-extract";
import { FME_GET_THREAD_SNAPSHOT } from "../lib/messenger-protocol";

chrome.runtime.onMessage.addListener(
  (message: { type?: string }, _sender, sendResponse: (s: ThreadSnapshot) => void) => {
    if (message?.type !== FME_GET_THREAD_SNAPSHOT) return;
    sendResponse(extractThreadSnapshot(document));
  },
);
