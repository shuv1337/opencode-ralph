import { createOpencodeServer, createOpencodeClient } from "@opencode-ai/sdk";
import type { LoopOptions, PersistedState, ToolEvent } from "./state.js";
import { getHeadHash, getCommitsSince } from "./git.js";
import { parsePlan } from "./plan.js";

export type LoopCallbacks = {
  onIterationStart: (iteration: number) => void;
  onEvent: (event: ToolEvent) => void;
  onIterationComplete: (
    iteration: number,
    duration: number,
    commits: number,
  ) => void;
  onTasksUpdated: (done: number, total: number) => void;
  onCommitsUpdated: (commits: number) => void;
  onPause: () => void;
  onResume: () => void;
  onComplete: () => void;
  onError: (error: string) => void;
};
