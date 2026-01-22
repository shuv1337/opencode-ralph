/**
 * @file Headless Module Barrel Export
 * @description Re-exports all types from the headless module for convenient importing.
 *
 * @example
 * ```typescript
 * import {
 *   HeadlessConfig,
 *   HeadlessEvent,
 *   HeadlessCallbacks,
 *   FormatterType,
 * } from './headless';
 * ```
 *
 * @version 2.1.0
 * @see docs/architecture/HEADLESS_ARCHITECTURE.md
 */

// =============================================================================
// Core Type Exports
// =============================================================================

export type {
  // Exit codes
  HeadlessExitCode,

  // Formatter types
  FormatterType,
  HeadlessFormatter,
  FormatterOptions,

  // Execution limits
  HeadlessLimits,

  // Token usage
  TokenUsage,

  // Session & Agent types
  SessionInfo,
  SandboxConfig,
  RateLimitState,
  ActiveAgentState,

  // Event types
  HeadlessEventType,
  HeadlessEvent,
  StartEvent,
  IterationStartEvent,
  IterationEndEvent,
  ToolEvent,
  ReasoningEvent,
  OutputEvent,
  ProgressEvent,
  StatsEvent,
  PauseEvent,
  ResumeEvent,
  IdleEvent,
  ErrorEvent,
  CompleteEvent,
  ModelEvent,
  SandboxEvent,
  TokensEvent,
  RateLimitEvent,
  ActiveAgentEvent,
  BackoffEvent,
  BackoffClearedEvent,
  SessionEvent,
  PromptEvent,
  PlanModifiedEvent,
  AdapterModeEvent,

  // Summary & Stats
  HeadlessSummary,
  HeadlessStats,

  // Output types
  HeadlessOutputOptions,
  HeadlessOutput,

  // Callbacks
  HeadlessCallbacks,

  // State
  HeadlessState,

  // Configuration
  BannerConfig,
  ErrorHandlingConfig,
  CleanupConfig,
  HeadlessConfig,

  // Backward compatibility
  HeadlessRunOptions,
} from "./types";

// =============================================================================
// Value Exports (Constants)
// =============================================================================

export { HeadlessExitCodes } from "./types";

// =============================================================================
// Runner Exports
// =============================================================================

export { HeadlessRunner, createHeadlessRunner } from "./runner";
export type { HeadlessRunnerOptions } from "./runner";

// =============================================================================
// Callback Factory Exports
// =============================================================================

export {
  createHeadlessCallbacks,
  createInitialStats,
  wrapCallbacks,
  isToolEvent,
} from "./callbacks";

export type { CreateCallbacksOptions } from "./callbacks";
