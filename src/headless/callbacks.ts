/**
 * @file Headless Callbacks Implementation
 * @description Comprehensive callbacks factory for headless mode that implements
 * ALL callbacks defined in the HeadlessCallbacks interface.
 *
 * This module provides:
 * - Factory function to create a complete callback set
 * - Each callback emits the appropriate HeadlessEvent
 * - Proper error handling in each callback
 * - Statistics tracking for summary generation
 *
 * @version 2.1.0
 * @see docs/architecture/HEADLESS_ARCHITECTURE.md Section 5
 */

import type {
  HeadlessCallbacks,
  HeadlessEvent,
  HeadlessFormatter,
  HeadlessStats,
  TokenUsage,
  SessionInfo,
  SandboxConfig,
  RateLimitState,
  ActiveAgentState,
} from "./types";

// =============================================================================
// Helper Types
// =============================================================================

/**
 * Tool event from the loop (subset of state.ToolEvent)
 */
interface ToolEventInput {
  type: "tool" | "reasoning" | "spinner" | "separator";
  iteration: number;
  icon?: string;
  text: string;
  detail?: string;
}

/**
 * Options for creating headless callbacks.
 */
export interface CreateCallbacksOptions {
  /**
   * Formatter instance for event output.
   */
  readonly formatter: HeadlessFormatter;

  /**
   * Mutable stats object for tracking execution statistics.
   */
  readonly stats: HeadlessStats;

  /**
   * Whether to include timestamps in events.
   */
  readonly timestamps: boolean;
}

// =============================================================================
// Timestamp Helper
// =============================================================================

/**
 * Add timestamp to an event if timestamps are enabled.
 *
 * @param event - The event to potentially add timestamp to
 * @param includeTimestamps - Whether timestamps should be added
 * @returns The event with or without timestamp
 */
function withTimestamp<T extends HeadlessEvent>(
  event: T,
  includeTimestamps: boolean
): T {
  if (!includeTimestamps) return event;
  return { ...event, timestamp: event.timestamp ?? Date.now() };
}

// =============================================================================
// Safe Emit Wrapper
// =============================================================================

/**
 * Safely emit an event, catching any formatter errors.
 *
 * @param formatter - The formatter to emit to
 * @param event - The event to emit
 * @param timestamps - Whether to include timestamps
 */
function safeEmit(
  formatter: HeadlessFormatter,
  event: HeadlessEvent,
  timestamps: boolean
): void {
  try {
    formatter.emit(withTimestamp(event, timestamps));
  } catch (error) {
    // Log error but don't throw - callbacks should not break the loop
    console.error(
      `[HeadlessCallbacks] Failed to emit event: ${event.type}`,
      error
    );
  }
}

// =============================================================================
// Callback Factory
// =============================================================================

/**
 * Creates a complete set of HeadlessCallbacks that emit proper HeadlessEvents.
 *
 * @param options - Configuration options for the callbacks
 * @returns Complete HeadlessCallbacks implementation
 *
 * @example
 * ```typescript
 * const callbacks = createHeadlessCallbacks({
 *   formatter: createJsonlFormatter({ timestamps: true }),
 *   stats: { startTime: Date.now(), ... },
 *   timestamps: true,
 * });
 *
 * // Use in loop
 * await runLoop(loopOptions, persistedState, callbacks, signal);
 * ```
 */
export function createHeadlessCallbacks(
  options: CreateCallbacksOptions
): HeadlessCallbacks {
  const { formatter, stats, timestamps } = options;

  /**
   * Helper to emit events with error handling.
   */
  const emit = (event: HeadlessEvent): void => {
    safeEmit(formatter, event, timestamps);
  };

  /**
   * Helper to emit stats event.
   */
  const emitStats = (): void => {
    emit({
      type: "stats",
      commits: stats.commits,
      linesAdded: stats.linesAdded,
      linesRemoved: stats.linesRemoved,
    });
  };

  // ---------------------------------------------------------------------------
  // Build complete callback object
  // ---------------------------------------------------------------------------

  const callbacks: HeadlessCallbacks = {
    // -------------------------------------------------------------------------
    // Core Iteration Callbacks (Required)
    // -------------------------------------------------------------------------

    /**
     * Called at the start of each iteration.
     * Emits: iteration_start
     */
    onIterationStart: (iteration: number): void => {
      stats.iterations = iteration;
      emit({ type: "iteration_start", iteration });
    },

    /**
     * Called when a tool or reasoning event occurs.
     * Emits: tool | reasoning (filters out spinner/separator)
     */
    onEvent: (event: unknown): void => {
      const toolEvent = event as ToolEventInput;

      // Filter out non-essential events
      if (toolEvent.type === "spinner" || toolEvent.type === "separator") {
        return;
      }

      if (toolEvent.type === "tool") {
        emit({
          type: "tool",
          iteration: toolEvent.iteration,
          name: toolEvent.icon || "tool",
          title: toolEvent.text,
          detail: toolEvent.detail,
        });
        return;
      }

      if (toolEvent.type === "reasoning") {
        emit({
          type: "reasoning",
          iteration: toolEvent.iteration,
          text: toolEvent.text,
        });
      }
    },

    /**
     * Called when an iteration completes.
     * Emits: iteration_end
     */
    onIterationComplete: (
      iteration: number,
      duration: number,
      commits: number
    ): void => {
      emit({
        type: "iteration_end",
        iteration,
        durationMs: duration,
        commits,
      });
    },

    // -------------------------------------------------------------------------
    // Progress Callbacks (Required)
    // -------------------------------------------------------------------------

    /**
     * Called when task progress is updated.
     * Emits: progress
     */
    onTasksUpdated: (done: number, total: number, _error?: string): void => {
      stats.tasksComplete = done;
      stats.totalTasks = total;
      emit({ type: "progress", done, total });
    },

    /**
     * Called when commit count is updated.
     * Emits: stats
     */
    onCommitsUpdated: (commits: number): void => {
      stats.commits = commits;
      emitStats();
    },

    /**
     * Called when diff statistics are updated.
     * Emits: stats
     */
    onDiffUpdated: (added: number, removed: number): void => {
      stats.linesAdded = added;
      stats.linesRemoved = removed;
      emitStats();
    },

    // -------------------------------------------------------------------------
    // State Callbacks (Required)
    // -------------------------------------------------------------------------

    /**
     * Called when execution is paused.
     * Emits: pause
     */
    onPause: (): void => {
      emit({ type: "pause" });
    },

    /**
     * Called when execution is resumed.
     * Emits: resume
     */
    onResume: (): void => {
      emit({ type: "resume" });
    },

    /**
     * Called when idle state changes.
     * Emits: idle
     */
    onIdleChanged: (isIdle: boolean): void => {
      emit({ type: "idle", isIdle });
    },

    /**
     * Called when all tasks are complete.
     * Emits: complete
     */
    onComplete: (): void => {
      emit({ type: "complete" });
    },

    /**
     * Called when an error occurs.
     * Emits: error
     */
    onError: (error: string): void => {
      emit({ type: "error", message: error });
    },

    // -------------------------------------------------------------------------
    // Raw Output Callback (Optional)
    // -------------------------------------------------------------------------

    /**
     * Called with raw output data (PTY mode).
     * Emits: output
     */
    onRawOutput: (data: string): void => {
      emit({ type: "output", data });
    },

    // -------------------------------------------------------------------------
    // Session Callbacks (Optional)
    // -------------------------------------------------------------------------

    /**
     * Called when a new session is created.
     * Emits: session (action: 'created')
     */
    onSessionCreated: (session: SessionInfo): void => {
      emit({
        type: "session",
        action: "created",
        sessionId: session.sessionId,
        serverUrl: session.serverUrl,
      });
    },

    /**
     * Called when a session ends.
     * Emits: session (action: 'ended')
     */
    onSessionEnded: (sessionId: string): void => {
      emit({
        type: "session",
        action: "ended",
        sessionId,
      });
    },

    // -------------------------------------------------------------------------
    // Rate Limiting / Backoff Callbacks (Optional)
    // -------------------------------------------------------------------------

    /**
     * Called when entering exponential backoff.
     * Emits: backoff
     */
    onBackoff: (backoffMs: number, retryAt: number): void => {
      emit({
        type: "backoff",
        backoffMs,
        retryAt,
      });
    },

    /**
     * Called when backoff is cleared and retry begins.
     * Emits: backoff_cleared
     */
    onBackoffCleared: (): void => {
      emit({ type: "backoff_cleared" });
    },

    // -------------------------------------------------------------------------
    // Token & Model Callbacks (Optional)
    // -------------------------------------------------------------------------

    /**
     * Called when token usage data is received.
     * Emits: tokens
     */
    onTokens: (tokens: TokenUsage): void => {
      emit({
        type: "tokens",
        input: tokens.input,
        output: tokens.output,
        reasoning: tokens.reasoning,
        cacheRead: tokens.cacheRead,
        cacheWrite: tokens.cacheWrite,
      });
    },

    /**
     * Called when the model is identified or changed.
     * Emits: model
     */
    onModel: (model: string): void => {
      emit({
        type: "model",
        model,
      });
    },

    /**
     * Called when sandbox configuration is detected.
     * Emits: sandbox
     */
    onSandbox: (sandbox: SandboxConfig): void => {
      emit({
        type: "sandbox",
        enabled: sandbox.enabled ?? false,
        mode: sandbox.mode,
        network: sandbox.network,
      });
    },

    /**
     * Called when rate limit is detected.
     * Emits: rate_limit
     */
    onRateLimit: (state: RateLimitState): void => {
      emit({
        type: "rate_limit",
        primaryAgent: state.primaryAgent,
        fallbackAgent: state.fallbackAgent ?? "unknown",
      });
    },

    /**
     * Called when active agent changes.
     * Emits: active_agent
     */
    onActiveAgent: (state: ActiveAgentState): void => {
      emit({
        type: "active_agent",
        plugin: state.plugin,
        reason: state.reason ?? "primary",
      });
    },

    // -------------------------------------------------------------------------
    // Prompt & Plan Callbacks (Optional)
    // -------------------------------------------------------------------------

    /**
     * Called when the system prompt is generated.
     * Emits: prompt
     */
    onPrompt: (prompt: string): void => {
      emit({
        type: "prompt",
        prompt,
      });
    },

    /**
     * Called when the plan file is modified.
     * Emits: plan_modified
     */
    onPlanFileModified: (): void => {
      emit({ type: "plan_modified" });
    },

    // -------------------------------------------------------------------------
    // Mode Callbacks (Optional)
    // -------------------------------------------------------------------------

    /**
     * Called when adapter mode changes.
     * Emits: adapter_mode
     */
    onAdapterModeChanged: (mode: "sdk" | "pty"): void => {
      emit({
        type: "adapter_mode",
        mode,
      });
    },
  };

  return callbacks;
}

// =============================================================================
// Statistics Factory
// =============================================================================

/**
 * Creates an initial HeadlessStats object.
 *
 * @param startTime - Optional start time (defaults to Date.now())
 * @returns Fresh HeadlessStats object
 */
export function createInitialStats(startTime?: number): HeadlessStats {
  return {
    startTime: startTime ?? Date.now(),
    tasksComplete: 0,
    totalTasks: 0,
    commits: 0,
    linesAdded: 0,
    linesRemoved: 0,
    iterations: 0,
  };
}

// =============================================================================
// Callback Wrapper for Loop Integration
// =============================================================================

/**
 * Wraps HeadlessCallbacks to add additional behavior (e.g., iteration limits).
 *
 * @param callbacks - Base callbacks to wrap
 * @param hooks - Additional hooks to run alongside callbacks
 * @returns Wrapped callbacks with additional behavior
 *
 * @example
 * ```typescript
 * const wrapped = wrapCallbacks(baseCallbacks, {
 *   onIterationStart: (iteration) => {
 *     if (iteration > maxIterations) {
 *       requestAbort(3, 'max-iterations reached');
 *     }
 *   },
 * });
 * ```
 */
export function wrapCallbacks(
  callbacks: HeadlessCallbacks,
  hooks: Partial<HeadlessCallbacks>
): HeadlessCallbacks {
  const wrapped: HeadlessCallbacks = { ...callbacks };

  // Wrap each callback that has a hook
  for (const key of Object.keys(hooks) as Array<keyof HeadlessCallbacks>) {
    const originalCallback = callbacks[key];
    const hook = hooks[key];

    if (typeof originalCallback === "function" && typeof hook === "function") {
      // Create a wrapper that calls both
      (wrapped[key] as (...args: unknown[]) => void) = (
        ...args: unknown[]
      ): void => {
        // Call original first
        (originalCallback as (...args: unknown[]) => void)(...args);
        // Then call hook
        (hook as (...args: unknown[]) => void)(...args);
      };
    } else if (typeof hook === "function") {
      // No original, just use hook
      (wrapped[key] as (...args: unknown[]) => void) = hook as (
        ...args: unknown[]
      ) => void;
    }
  }

  return wrapped;
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard to check if an event is a ToolEvent.
 */
export function isToolEvent(event: unknown): event is ToolEventInput {
  if (typeof event !== "object" || event === null) return false;
  const e = event as Record<string, unknown>;
  return (
    typeof e.type === "string" &&
    ["tool", "reasoning", "spinner", "separator"].includes(e.type) &&
    typeof e.iteration === "number"
  );
}
