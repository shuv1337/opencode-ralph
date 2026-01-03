export type PersistedState = {
  startTime: number; // When run started (epoch ms)
  initialCommitHash: string; // HEAD at start
  iterationTimes: number[]; // Duration of each completed iteration (ms)
  planFile: string; // Which plan file we're working on
};
