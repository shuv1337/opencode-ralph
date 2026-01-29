import type { TaskStatus } from "../types/task-status";
export type { TaskStatus };

/**
 * Ralph execution status types.
 * Adopted from Ralph TUI with additional granularity for UI feedback.
 */
export type RalphStatus =
  | "starting"
  | "ready"
  | "running"
  | "selecting"
  | "executing"
  | "pausing"
  | "paused"
  | "stopped"
  | "complete"
  | "idle"
  | "error";

export type DetailsViewMode = "details" | "output" | "prompt";

/**
 * UI representation of a task with optional hierarchy and metadata.
 */
export type UiTask = {
  id: string;
  /** Short title for the task */
  title: string;
  status: TaskStatus;
  line?: number;
  description?: string;
  /** Parent task ID for hierarchical display (child tasks are indented) */
  parentId?: string;
  /** Task priority (0-4, where 0 is Critical and 4 is Backlog) */
  priority?: number;
  /** Task category for grouping/tags */
  category?: string;
  /** Acceptance criteria for task completion (preferred) */
  acceptanceCriteria?: string[];
  /** @deprecated Use acceptanceCriteria instead. Verification steps from PRD (backward compat) */
  steps?: string[];
  /** Effort estimate (e.g., "XS", "S", "M", "L", "XL") */
  effort?: string;
  /** Risk level (e.g., "L", "M", "H" for Low/Medium/High) */
  risk?: string;
  /** Original custom ID from PRD (e.g., "1.1.1") */
  originalId?: string;
  /** Notes written by Ralph during task execution */
  notes?: string;
};

/**
 * Rate limit state for agent fallback display.
 */
export type RateLimitState = {
  /** Timestamp when rate limited (undefined if not limited) */
  limitedAt?: number;
  /** Name of the primary agent that was rate limited */
  primaryAgent?: string;
  /** Name of the fallback agent being used */
  fallbackAgent?: string;
};

/**
 * Active agent state for header display.
 */
export type ActiveAgentState = {
  /** Current agent plugin name */
  plugin: string;
  /** Reason for using this agent ('primary' or 'fallback') */
  reason?: "primary" | "fallback";
};

/**
 * Sandbox configuration for header display.
 */
export type SandboxConfig = {
  /** Whether sandbox is enabled */
  enabled?: boolean;
  /** Sandbox mode (e.g., 'auto', 'on', 'off') */
  mode?: string;
  /** Whether network access is enabled */
  network?: boolean;
};
