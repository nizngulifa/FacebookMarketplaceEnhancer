import { promptUser } from "../lib/marketplace-ui";

Object.assign(globalThis as object, { __fmePromptUser: promptUser });
