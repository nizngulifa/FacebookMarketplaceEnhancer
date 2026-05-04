import { promptUser, suggestReply } from "../lib/marketplace-ui";

Object.assign(globalThis as object, {
  __fmePromptUser: promptUser,
  __fmeSuggestReply: suggestReply,
});
