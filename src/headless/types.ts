/**
 * @file Headless Module Type Definitions
 * @description Core TypeScript types for OpenRalph's headless mode operation.
 *
 * This module provides comprehensive type definitions for:
 * - HeadlessConfig: Configuration for headless mode
 * - HeadlessEvent: Discriminated union of all event types
 * - HeadlessOutput: Output configuration and coordination
 * - HeadlessCallbacks: Full callback interface for loop integration
 * - HeadlessState: Runtime state management
 * - HeadlessStats: Aggregated statistics
 *
 * @version 2.1.0
 * @see docs/architecture/HEADLESS_ARCHITECTURE.md
 */

// =============================================================================
// Exit Codes
// =============================================================================

/**
 * Exit codes for headless mode execution.
 *
 * @remarks
 * These exit codes follow Unix conventions and provide clear semantics
 * for CI/CD pipeline integration.
 */
export type HeadlessExitCode =
  | 0  // Success: All tasks completed successfully
  | 1  // Error: Unrecoverable error occurred
  | 2  // Interrupted: User interruption (SIGINT/SIGTERM) or pause in headless mode
  | 3; // Limit: Max iterations or max time limit reached

/**
 * Exit code constants with semantic names.
 */
export const HeadlessExitCodes = {
  SUCCESS: 0 as const,
  ERROR: 1 as const,
  INTERRUPTED: 2 as const,
  LIMIT_REACHED: 3 as const,
} as const;

// =============================================================================
// Formatter Types
// =============================================================================

/**
 * Supported output format types for headless mode.
 *
 * @remarks
 * - `text`: Human-readable formatted text output
 * - `json`: Complete JSON output with events array and summary (emitted at end)
 * - `jsonl`: JSON Lines format - one JSON object per line (streaming)
 * - `stream`: Raw event streaming format for SDK integration (`EVENT <json>`)
 */
export type FormatterType = "text" | "json" | "jsonl" | "stream";

// =============================================================================
// Execution Limits
// =============================================================================

/**
 * Execution limits for headless mode.
 *
 * @remarks
 * These limits prevent runaway execution in CI/CD environments
 * and provide control over resource usage.
 */
export interface HeadlessLimits {
  /**
   * Maximum number of iterations before aborting.
   * Set to `undefined` for unlimited iterations.
   */
  readonly maxIterations?: number;

  /**
   * Maximum execution time in seconds before aborting.
   * Set to `undefined` for unlimited time.
   */
  readonly maxTime?: number;
}

// =============================================================================
// Token Usage
// =============================================================================

/**
 * Token usage statistics from LLM API calls.
 *
 * @remarks
 * Maps to the StepFinishPart.tokens structure from the OpenCode SDK.
 * Used for tracking API costs and monitoring usage patterns.
 */
export interface TokenUsage {
  /** Number of input tokens consumed */
  readonly input: number;
  /** Number of output tokens generated */
  readonly output: number;
  /** Number of reasoning tokens (for extended thinking models) */
  readonly reasoning: number;
  /** Number of tokens read from cache */
  readonly cacheRead: number;
  /** Number of tokens written to cache */
  readonly cacheWrite: number;
}

// =============================================================================
// Session & Agent Types
// =============================================================================

/**
 * Information about an active session.
 *
 * @remarks
 * Used for session lifecycle management and steering mode integration.
 */
export interface SessionInfo {
  /** Unique session identifier */
  readonly sessionId: string;
  /** URL of the OpenCode server */
  readonly serverUrl: string;
  /** Whether the session is currently attached */
  readonly attached: boolean;
  /**
   * Send a message to the session (for steering mode).
   * @param message - The message to send
   */
  sendMessage(message: string): Promise<void>;
}

/**
 * Sandbox configuration for secure execution.
 */
export interface SandboxConfig {
  /** Whether sandbox mode is enabled */
  readonly enabled?: boolean;
  /** Sandbox mode setting (e.g., 'auto', 'on', 'off') */
  readonly mode?: string;
  /** Whether network access is allowed in sandbox */
  readonly network?: boolean;
}

/**
 * Rate limit state for agent fallback handling.
 */
export interface RateLimitState {
  /** Timestamp when rate limit was detected */
  readonly limitedAt?: number;
  /** Name of the rate-limited primary agent */
  readonly primaryAgent?: string;
  /** Name of the fallback agent being used */
  readonly fallbackAgent?: string;
}

/**
 * Active agent state for tracking current agent.
 */
export interface ActiveAgentState {
  /** Current agent plugin name */
  readonly plugin: string;
  /** Reason for using this agent */
  readonly reason?: "primary" | "fallback";
}

// =============================================================================
// Headless Event Types (Discriminated Union)
// =============================================================================

/**
 * Event type identifiers for headless mode events.
 */
export type HeadlessEventType =
  | "start"
  | "iteration_start"
  | "iteration_end"
  | "tool"
  | "reasoning"
  | "output"
  | "progress"
  | "stats"
  | "pause"
  | "resume"
  | "idle"
  | "error"
  | "complete"
  | "model"
  | "sandbox"
  | "tokens"
  | "rate_limit"
  | "active_agent"
  | "backoff"
  | "backoff_cleared"
  | "session"
  | "prompt"
  | "plan_modified"
  | "adapter_mode";

/**
 * Base interface for all headless events.
 */
interface BaseHeadlessEvent {
  /** Event type discriminator */
  readonly type: HeadlessEventType;
  /** Optional timestamp (epoch milliseconds) */
  readonly timestamp?: number;
}

/** Emitted when headless mode execution begins */
export interface StartEvent extends BaseHeadlessEvent {
  readonly type: "start";
}

/** Emitted at the beginning of each iteration */
export interface IterationStartEvent extends BaseHeadlessEvent {
  readonly type: "iteration_start";
  readonly iteration: number;
}

/** Emitted at the end of each iteration */
export interface IterationEndEvent extends BaseHeadlessEvent {
  readonly type: "iteration_end";
  readonly iteration: number;
  /** Duration of the iteration in milliseconds */
  readonly durationMs: number;
  /** Number of commits made during this iteration */
  readonly commits: number;
}

/** Emitted when a tool is invoked */
export interface ToolEvent extends BaseHeadlessEvent {
  readonly type: "tool";
  readonly iteration: number;
  /** Tool identifier/icon name */
  readonly name: string;
  /** Human-readable tool description */
  readonly title: string;
  /** Additional tool-specific detail */
  readonly detail?: string;
}

/** Emitted for LLM reasoning/thinking output */
export interface ReasoningEvent extends BaseHeadlessEvent {
  readonly type: "reasoning";
  readonly iteration: number;
  readonly text: string;
}

/** Emitted for raw output data (PTY mode) */
export interface OutputEvent extends BaseHeadlessEvent {
  readonly type: "output";
  readonly data: string;
}

/** Emitted when task progress is updated */
export interface ProgressEvent extends BaseHeadlessEvent {
  readonly type: "progress";
  /** Number of tasks completed */
  readonly done: number;
  /** Total number of tasks */
  readonly total: number;
}

/** Emitted when diff/commit stats are updated */
export interface StatsEvent extends BaseHeadlessEvent {
  readonly type: "stats";
  readonly commits: number;
  readonly linesAdded: number;
  readonly linesRemoved: number;
}

/** Emitted when execution is paused */
export interface PauseEvent extends BaseHeadlessEvent {
  readonly type: "pause";
}

/** Emitted when execution is resumed */
export interface ResumeEvent extends BaseHeadlessEvent {
  readonly type: "resume";
}

/** Emitted when idle state changes */
export interface IdleEvent extends BaseHeadlessEvent {
  readonly type: "idle";
  readonly isIdle: boolean;
}

/** Emitted on error */
export interface ErrorEvent extends BaseHeadlessEvent {
  readonly type: "error";
  readonly message: string;
  /** Optional error phase/context */
  readonly phase?: string;
  /** Optional stack trace */
  readonly stack?: string;
}

/** Emitted when all tasks are complete */
export interface CompleteEvent extends BaseHeadlessEvent {
  readonly type: "complete";
}

/** Emitted when the model is identified or changed */
export interface ModelEvent extends BaseHeadlessEvent {
  readonly type: "model";
  readonly model: string;
}

/** Emitted when sandbox configuration is detected */
export interface SandboxEvent extends BaseHeadlessEvent {
  readonly type: "sandbox";
  readonly enabled: boolean;
  readonly mode?: string;
  readonly network?: boolean;
}

/** Emitted when token usage data is received */
export interface TokensEvent extends BaseHeadlessEvent {
  readonly type: "tokens";
  readonly input: number;
  readonly output: number;
  readonly reasoning: number;
  readonly cacheRead: number;
  readonly cacheWrite: number;
}

/** Emitted when rate limit is detected */
export interface RateLimitEvent extends BaseHeadlessEvent {
  readonly type: "rate_limit";
  readonly primaryAgent?: string;
  readonly fallbackAgent: string;
}

/** Emitted when active agent changes */
export interface ActiveAgentEvent extends BaseHeadlessEvent {
  readonly type: "active_agent";
  readonly plugin: string;
  readonly reason: "primary" | "fallback";
}

/** Emitted when entering exponential backoff */
export interface BackoffEvent extends BaseHeadlessEvent {
  readonly type: "backoff";
  /** Backoff duration in milliseconds */
  readonly backoffMs: number;
  /** Timestamp when retry will occur */
  readonly retryAt: number;
}

/** Emitted when backoff is cleared and retry begins */
export interface BackoffClearedEvent extends BaseHeadlessEvent {
  readonly type: "backoff_cleared";
}

/** Emitted for session lifecycle events */
export interface SessionEvent extends BaseHeadlessEvent {
  readonly type: "session";
  readonly action: "created" | "ended";
  readonly sessionId: string;
  readonly serverUrl?: string;
}

/** Emitted when the system prompt is generated */
export interface PromptEvent extends BaseHeadlessEvent {
  readonly type: "prompt";
  readonly prompt: string;
}

/** Emitted when the plan file is modified */
export interface PlanModifiedEvent extends BaseHeadlessEvent {
  readonly type: "plan_modified";
}

/** Emitted when adapter mode changes */
export interface AdapterModeEvent extends BaseHeadlessEvent {
  readonly type: "adapter_mode";
  readonly mode: "sdk" | "pty";
}

/**
 * Discriminated union of all headless event types.
 *
 * @remarks
 * Use the `type` field to discriminate between event types:
 * ```typescript
 * function handleEvent(event: HeadlessEvent) {
 *   switch (event.type) {
 *     case "tool":
 *       console.log(`Tool: ${event.name} - ${event.title}`);
 *       break;
 *     case "error":
 *       console.error(`Error: ${event.message}`);
 *       break;
 *     // ... handle other event types
 *   }
 * }
 * ```
 */
export type HeadlessEvent =
  | StartEvent
  | IterationStartEvent
  | IterationEndEvent
  | ToolEvent
  | ReasoningEvent
  | OutputEvent
  | ProgressEvent
  | StatsEvent
  | PauseEvent
  | ResumeEvent
  | IdleEvent
  | ErrorEvent
  | CompleteEvent
  | ModelEvent
  | SandboxEvent
  | TokensEvent
  | RateLimitEvent
  | ActiveAgentEvent
  | BackoffEvent
  | BackoffClearedEvent
  | SessionEvent
  | PromptEvent
  | PlanModifiedEvent
  | AdapterModeEvent;

// =============================================================================
// Headless Summary
// =============================================================================

/**
 * Summary data emitted at the end of headless execution.
 *
 * @remarks
 * Contains aggregated statistics about the entire execution run.
 */
export interface HeadlessSummary {
  /** Exit code indicating execution result */
  readonly exitCode: HeadlessExitCode;
  /** Total duration of execution in milliseconds */
  readonly durationMs: number;
  /** Number of tasks completed */
  readonly tasksComplete: number;
  /** Total number of tasks */
  readonly totalTasks: number;
  /** Total commits made */
  readonly commits: number;
  /** Total lines added */
  readonly linesAdded: number;
  /** Total lines removed */
  readonly linesRemoved: number;
}

// =============================================================================
// Headless Stats
// =============================================================================

/**
 * Runtime statistics tracker for headless mode.
 *
 * @remarks
 * Used internally to aggregate statistics during execution.
 */
export interface HeadlessStats {
  /** Execution start time (epoch milliseconds) */
  startTime: number;
  /** Number of tasks completed */
  tasksComplete: number;
  /** Total number of tasks */
  totalTasks: number;
  /** Total commits made */
  commits: number;
  /** Total lines added */
  linesAdded: number;
  /** Total lines removed */
  linesRemoved: number;
  /** Number of iterations completed */
  iterations: number;
}

// =============================================================================
// Formatter Interface
// =============================================================================

/**
 * Interface for headless output formatters.
 *
 * @remarks
 * Implementations handle serialization of events to different formats
 * (text, JSON, JSONL, stream).
 */
export interface HeadlessFormatter {
  /**
   * Emit a single event to the output.
   * @param event - The event to emit
   */
  emit(event: HeadlessEvent): void;

  /**
   * Finalize output with summary data.
   * @param summary - Execution summary
   */
  finalize(summary: HeadlessSummary): void;

  /**
   * Flush any buffered output.
   * @remarks Optional - not all formatters buffer output.
   */
  flush?(): void;
}

/**
 * Options for creating a formatter.
 */
export interface FormatterOptions {
  /** Whether to include timestamps in output */
  readonly timestamps: boolean;
  /** Custom write function (defaults to process.stdout.write) */
  readonly write?: (text: string) => void;
}

// =============================================================================
// Headless Output
// =============================================================================

/**
 * Unified output configuration for headless mode.
 */
export interface HeadlessOutputOptions {
  /** Output format */
  readonly format: FormatterType;
  /** Whether to include timestamps */
  readonly timestamps: boolean;
  /** Custom write function */
  readonly write?: (text: string) => void;
  /** Start time for duration calculation */
  readonly startTime?: number;
}

/**
 * Headless output coordinator interface.
 *
 * @remarks
 * Provides a unified interface for output management, combining
 * formatter access, callback generation, and statistics tracking.
 */
export interface HeadlessOutput {
  /** Loop callbacks wired to this output */
  readonly callbacks: HeadlessCallbacks;

  /**
   * Emit an event directly.
   * @param event - The event to emit
   */
  emit(event: HeadlessEvent): void;

  /**
   * Emit the start event.
   */
  emitStart(): void;

  /**
   * Finalize output with the given exit code.
   * @param exitCode - Exit code for the summary
   */
  finalize(exitCode: HeadlessExitCode): void;

  /**
   * Get current statistics.
   */
  getStats(): Readonly<HeadlessStats>;
}

// =============================================================================
// Headless Callbacks
// =============================================================================

/**
 * Complete callback interface for loop integration in headless mode.
 *
 * @remarks
 * This interface defines all callbacks that the main execution loop
 * can invoke to notify headless mode of state changes and events.
 *
 * Required callbacks are always called; optional callbacks may not be
 * implemented by all loop integrations.
 */
export interface HeadlessCallbacks {
  // -------------------------------------------------------------------------
  // Core Iteration Callbacks (Required)
  // -------------------------------------------------------------------------

  /**
   * Called at the start of each iteration.
   * @param iteration - The iteration number (1-based)
   */
  onIterationStart(iteration: number): void;

  /**
   * Called when a tool event occurs.
   * @param event - The tool event (from state.ToolEvent)
   */
  onEvent(event: unknown): void;

  /**
   * Called when an iteration completes.
   * @param iteration - The iteration number
   * @param duration - Duration of the iteration in milliseconds
   * @param commits - Number of commits made during this iteration
   */
  onIterationComplete(iteration: number, duration: number, commits: number): void;

  // -------------------------------------------------------------------------
  // Progress Callbacks (Required)
  // -------------------------------------------------------------------------

  /**
   * Called when task progress is updated.
   * @param done - Number of tasks completed
   * @param total - Total number of tasks
   * @param error - Optional error message if task parsing failed
   */
  onTasksUpdated(done: number, total: number, error?: string): void;

  /**
   * Called when commit count is updated.
   * @param commits - Current commit count since initial hash
   */
  onCommitsUpdated(commits: number): void;

  /**
   * Called when diff statistics are updated.
   * @param added - Lines added
   * @param removed - Lines removed
   */
  onDiffUpdated(added: number, removed: number): void;

  // -------------------------------------------------------------------------
  // State Callbacks (Required)
  // -------------------------------------------------------------------------

  /**
   * Called when execution is paused.
   */
  onPause(): void;

  /**
   * Called when execution is resumed.
   */
  onResume(): void;

  /**
   * Called when idle state changes.
   * @param isIdle - Whether the loop is currently idle
   */
  onIdleChanged(isIdle: boolean): void;

  /**
   * Called when all tasks are complete.
   */
  onComplete(): void;

  /**
   * Called when an error occurs.
   * @param error - Error message
   */
  onError(error: string): void;

  // -------------------------------------------------------------------------
  // Raw Output Callback (Optional)
  // -------------------------------------------------------------------------

  /**
   * Called with raw output data (PTY mode).
   * @param data - Raw output string
   */
  onRawOutput?(data: string): void;

  // -------------------------------------------------------------------------
  // Session Callbacks (Optional)
  // -------------------------------------------------------------------------

  /**
   * Called when a new session is created.
   * @param session - Session information
   */
  onSessionCreated?(session: SessionInfo): void;

  /**
   * Called when a session ends.
   * @param sessionId - ID of the ended session
   */
  onSessionEnded?(sessionId: string): void;

  // -------------------------------------------------------------------------
  // Rate Limiting Callbacks (Optional)
  // -------------------------------------------------------------------------

  /**
   * Called when entering exponential backoff.
   * @param backoffMs - Backoff duration in milliseconds
   * @param retryAt - Timestamp when retry will occur
   */
  onBackoff?(backoffMs: number, retryAt: number): void;

  /**
   * Called when backoff is cleared and retry begins.
   */
  onBackoffCleared?(): void;

  // -------------------------------------------------------------------------
  // Token & Model Callbacks (Optional)
  // -------------------------------------------------------------------------

  /**
   * Called when token usage data is received.
   * @param tokens - Token usage breakdown
   */
  onTokens?(tokens: TokenUsage): void;

  /**
   * Called when the model is identified or changed.
   * @param model - Model identifier string
   */
  onModel?(model: string): void;

  /**
   * Called when sandbox configuration is detected.
   * @param sandbox - Sandbox configuration
   */
  onSandbox?(sandbox: SandboxConfig): void;

  /**
   * Called when rate limit is detected.
   * @param state - Rate limit state
   */
  onRateLimit?(state: RateLimitState): void;

  /**
   * Called when active agent changes.
   * @param state - Active agent state
   */
  onActiveAgent?(state: ActiveAgentState): void;

  // -------------------------------------------------------------------------
  // Prompt & Plan Callbacks (Optional)
  // -------------------------------------------------------------------------

  /**
   * Called when the system prompt is generated.
   * @param prompt - The full system prompt
   */
  onPrompt?(prompt: string): void;

  /**
   * Called when the plan file is modified.
   */
  onPlanFileModified?(): void;

  // -------------------------------------------------------------------------
  // Mode Callbacks (Optional)
  // -------------------------------------------------------------------------

  /**
   * Called when adapter mode changes.
   * @param mode - The new adapter mode
   */
  onAdapterModeChanged?(mode: "sdk" | "pty"): void;
}

// =============================================================================
// Headless State
// =============================================================================

/**
 * Runtime state for headless mode execution.
 *
 * @remarks
 * Tracks the current execution state including active sessions,
 * iteration progress, and error conditions.
 */
export interface HeadlessState {
  /** Current status of execution */
  status: "initializing" | "running" | "paused" | "complete" | "error";
  /** Current iteration number */
  iteration: number;
  /** Whether the loop is idle (waiting between iterations) */
  isIdle: boolean;
  /** Current session ID (if any) */
  sessionId?: string;
  /** Server URL for current session */
  serverUrl?: string;
  /** Whether session is attached */
  attached?: boolean;
  /** Current error message (if status is 'error') */
  error?: string;
  /** Current backoff duration in ms (if in backoff) */
  backoffMs?: number;
  /** Timestamp when retry will occur (if in backoff) */
  retryAt?: number;
  /** Current adapter mode */
  adapterMode: "sdk" | "pty";
  /** Accumulated token usage */
  tokens?: TokenUsage;
  /** Current model identifier */
  model?: string;
  /** Rate limit state */
  rateLimit?: RateLimitState;
  /** Active agent state */
  activeAgent?: ActiveAgentState;
}

// =============================================================================
// Headless Configuration
// =============================================================================

/**
 * Banner configuration for ASCII art display.
 */
export interface BannerConfig {
  /** Whether banner is enabled */
  readonly enabled: boolean;
  /** Text to display */
  readonly text: string;
  /** Color palette (name or custom colors) */
  readonly palette: string | readonly string[];
  /** Whether to use filled block style */
  readonly filled: boolean;
  /** Font name for figlet */
  readonly font: string;
  /** Rendering style */
  readonly style: "filled" | "gradient" | "plain" | "minimal";
  /** Gradient direction */
  readonly direction: "horizontal" | "vertical" | "diagonal";
  /** Whether to include version info */
  readonly includeVersion: boolean;
  /** Version string to display */
  readonly version: string;
}

/**
 * Error handling configuration.
 */
export interface ErrorHandlingConfig {
  /** Error handling strategy */
  readonly strategy: "retry" | "skip" | "abort";
  /** Maximum retry attempts */
  readonly maxRetries: number;
  /** Initial retry delay in milliseconds */
  readonly retryDelayMs: number;
  /** Multiplier for exponential backoff */
  readonly backoffMultiplier: number;
}

/**
 * Cleanup configuration for process management.
 */
export interface CleanupConfig {
  /** Whether cleanup is enabled */
  readonly enabled: boolean;
  /** Cleanup timeout in milliseconds */
  readonly timeout: number;
  /** Whether to force kill processes */
  readonly force: boolean;
}

/**
 * Complete configuration for headless mode.
 *
 * @remarks
 * This interface consolidates all configuration options for headless
 * mode execution, including output settings, execution limits,
 * and optional feature configurations.
 */
export interface HeadlessConfig {
  // -------------------------------------------------------------------------
  // Output Settings
  // -------------------------------------------------------------------------

  /** Output format */
  readonly format: FormatterType;
  /** Whether to include timestamps in output */
  readonly timestamps: boolean;
  /** Custom write function for output */
  readonly write?: (text: string) => void;

  // -------------------------------------------------------------------------
  // Execution Limits
  // -------------------------------------------------------------------------

  /** Execution limits (max iterations, max time) */
  readonly limits: HeadlessLimits;

  // -------------------------------------------------------------------------
  // Startup Behavior
  // -------------------------------------------------------------------------

  /**
   * Whether to start immediately without waiting for keypress.
   * Defaults to true in CI environments, false in interactive terminals.
   * When false, displays "Press [P] to start or [Q] to quit..." and waits.
   */
  readonly autoStart?: boolean;

  // -------------------------------------------------------------------------
  // Optional Feature Configurations
  // -------------------------------------------------------------------------

  /** Banner configuration (optional) */
  readonly banner?: Partial<BannerConfig>;
  /** Error handling configuration (optional) */
  readonly errorHandling?: Partial<ErrorHandlingConfig>;
  /** Cleanup configuration (optional) */
  readonly cleanup?: Partial<CleanupConfig>;
}

// =============================================================================
// Backward Compatibility Re-exports
// =============================================================================

/**
 * Options for running headless mode.
 *
 * @remarks
 * This type is backward compatible with the existing `HeadlessRunOptions`
 * in `src/headless.ts`. It extends the configuration with loop-specific
 * options needed for execution.
 *
 * @deprecated Use `HeadlessConfig` for new code. This type is maintained
 * for backward compatibility with existing consumers.
 */
export interface HeadlessRunOptions {
  /** Loop configuration options */
  readonly loopOptions: {
    readonly planFile: string;
    readonly progressFile: string;
    readonly model: string;
    readonly prompt: string;
    readonly promptFile?: string;
    readonly serverUrl?: string;
    readonly serverTimeoutMs?: number;
    readonly adapter?: string;
    readonly agent?: string;
    readonly debug?: boolean;
    readonly errorHandling?: unknown;
    readonly session?: unknown;
    readonly ui?: unknown;
    readonly fallbackAgents?: Record<string, string>;
  };
  /** Persisted state from previous runs */
  readonly persistedState: {
    startTime: number;
    initialCommitHash: string;
    iterationTimes: number[];
    planFile: string;
    totalPausedMs: number;
    lastSaveTime: number;
  };
  /** Output format */
  readonly format: string;
  /** Whether to include timestamps */
  readonly timestamps: boolean;
  /** Maximum iterations (optional) */
  readonly maxIterations?: number;
  /** Maximum time in seconds (optional) */
  readonly maxTime?: number;
}
