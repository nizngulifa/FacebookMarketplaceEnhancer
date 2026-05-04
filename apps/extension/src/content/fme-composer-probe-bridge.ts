import { probeComposerFramePayload } from "../lib/messenger-composer";

Object.assign(globalThis as object, { __fmeProbeComposer: probeComposerFramePayload });
