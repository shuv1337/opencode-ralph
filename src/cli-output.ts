import type { LoopCallbacks } from "./loop";
import type { ToolEvent } from "./state";
import { createJsonFormatter } from "./formats/json";
import { createJsonlFormatter } from "./formats/jsonl";
import { createTextFormatter } from "./formats/text";
import {
  createTextRenderer,
  type TextRenderer,
  type TextRenderMode,
  type TextRendererOptions,
} from "./lib/text-renderer";
import { renderBanner, shouldShowBanner, type BannerOptions } from "./lib/ascii-banner";
import { getCapabilities } from "./lib/terminal-capabilities";

// Re-export canonical types from headless/types.ts
export type {
  HeadlessEvent,
  HeadlessEventType,
  HeadlessSummary,
  HeadlessFormatter,
  HeadlessExitCode,
  HeadlessStats,
  HeadlessCallbacks,
  HeadlessConfig,
  HeadlessLimits,
  HeadlessOutput as HeadlessOutputInterface,
  HeadlessOutputOptions,
  HeadlessState,
  FormatterType,
  FormatterOptions,
  TokenUsage,
  SessionInfo,
  SandboxConfig,
  RateLimitState,
  ActiveAgentState,
  BannerConfig,
  ErrorHandlingConfig,
  CleanupConfig,
} from "./headless/types";

// Re-export exit code constants
export { HeadlessExitCodes } from "./headless/types";

import type {
  HeadlessEvent,
  HeadlessSummary,
  HeadlessFormatter,
  HeadlessExitCode,
  HeadlessStats,
  BannerConfig,
} from "./headless/types";

// Re-export text renderer types for consumers
export type { TextRenderer, TextRenderMode, TextRendererOptions };
export { createTextRenderer };

/**
 * Headless output coordinator.
 * @remarks Uses the canonical types from headless/types.ts
 */
export type HeadlessOutput = {
  callbacks: LoopCallbacks;
  emit: (event: HeadlessEvent) => void;
  showBanner: () => void;
  finalize: (exitCode: HeadlessExitCode) => void;
  getStats: () => Readonly<HeadlessStats>;
  getTextRenderer: () => TextRenderer;
  /** Get the configured left margin string */
  getMargin: () => string;
};

/**
 * Extended options for headless output creation.
 */
export interface HeadlessOutputCreateOptions {
  format: string;
  timestamps: boolean;
  startTime?: number;
  write?: (text: string) => void;
  /** Banner configuration for ASCII art display */
  banner?: Partial<BannerConfig>;
  /** Text renderer options for formatting */
  textRendererOptions?: TextRendererOptions;
}

export function createHeadlessOutput(options: HeadlessOutputCreateOptions): HeadlessOutput {
  const format = options.format.toLowerCase();
  
  // Create text renderer for formatting
  // In headless mode (text format), force minimum 'ascii' mode instead of 'minimal'
  // This ensures [READ], [WRITE], etc. prefixes are shown properly
  const textRenderer = createTextRenderer({
    ...options.textRendererOptions,
    forceMinimumAscii: format === "text",
  });
  
  const formatter: HeadlessFormatter =
    format === "json"
      ? createJsonFormatter({ write: options.write })
      : format === "jsonl"
        ? createJsonlFormatter({ timestamps: options.timestamps, write: options.write })
        : createTextFormatter({ 
            timestamps: options.timestamps, 
            write: options.write,
            textRenderer,
          });

  const stats: HeadlessStats = {
    startTime: options.startTime ?? Date.now(),
    tasksComplete: 0,
    totalTasks: 0,
    commits: 0,
    linesAdded: 0,
    linesRemoved: 0,
    iterations: 0,
  };

  const withTimestamp = <T extends HeadlessEvent>(event: T): T => {
    if (!options.timestamps) return event;
    return { ...event, timestamp: event.timestamp ?? Date.now() };
  };

  const emit = (event: HeadlessEvent) => {
    formatter.emit(withTimestamp(event));
  };

  const emitStats = () => {
    emit({
      type: "stats",
      commits: stats.commits,
      linesAdded: stats.linesAdded,
      linesRemoved: stats.linesRemoved,
    });
  };

  const callbacks: LoopCallbacks = {
    onIterationStart: (iteration) => {
      stats.iterations = iteration;
      emit({ type: "iteration_start", iteration });
    },
    onEvent: (event: ToolEvent) => {
      if (event.type === "spinner" || event.type === "separator") return;
      if (event.type === "tool") {
        emit({
          type: "tool",
          iteration: event.iteration,
          name: event.icon || "tool",
          title: event.text,
          detail: event.detail,
        });
        return;
      }
      if (event.type === "reasoning") {
        emit({
          type: "reasoning",
          iteration: event.iteration,
          text: event.text,
        });
      }
    },
    onIterationComplete: (iteration, duration, commits) => {
      emit({
        type: "iteration_end",
        iteration,
        durationMs: duration,
        commits,
      });
    },
    onTasksUpdated: (done, total) => {
      stats.tasksComplete = done;
      stats.totalTasks = total;
      emit({ type: "progress", done, total });
    },
    onCommitsUpdated: (commits) => {
      stats.commits = commits;
      emitStats();
    },
    onDiffUpdated: (added, removed) => {
      stats.linesAdded = added;
      stats.linesRemoved = removed;
      emitStats();
    },
    onPause: () => {
      emit({ type: "pause" });
    },
    onResume: () => {
      emit({ type: "resume" });
    },
    onComplete: () => {
      emit({ type: "complete" });
    },
    onError: (error) => {
      emit({ type: "error", message: error });
    },
    onIdleChanged: (isIdle) => {
      emit({ type: "idle", isIdle });
    },
    onModel: (model) => {
      emit({ type: "model", model });
    },
    onSandbox: (sandbox) => {
      emit({ 
        type: "sandbox", 
        enabled: sandbox.enabled ?? false,
        mode: sandbox.mode,
        network: sandbox.network,
      });
    },
    onRateLimit: (state) => {
      emit({ 
        type: "rate_limit", 
        primaryAgent: state.primaryAgent,
        fallbackAgent: state.fallbackAgent ?? "unknown",
      });
    },
    onActiveAgent: (state) => {
      emit({ 
        type: "active_agent", 
        plugin: state.plugin,
        reason: state.reason ?? "primary",
      });
    },
  };


  return {
    callbacks,
    emit,
    showBanner: () => {
      // Emit banner if enabled (only for text format by default)
      const isTextFormat = format === "text";
      const bannerEnabled = options.banner?.enabled ?? isTextFormat;

      if (!bannerEnabled || !shouldShowBanner()) {
        return;
      }

      // In headless mode, we want to show the banner even if terminal is non-interactive.
      // The banner.enabled flag being explicitly set means the caller wants the banner.
      // Only skip for CI environments unless explicitly enabled.
      const caps = getCapabilities();
      if (caps.isCI && options.banner?.enabled !== true) {
        return;
      }

      const bannerText = renderBanner({
        text: options.banner?.text ?? "OpenRalph",
        palette: (options.banner?.palette as import("./lib/ascii-banner").PaletteName) ?? "openralph",
        style: (options.banner?.style as import("./lib/ascii-banner").BannerStyle) || (options.banner?.filled ? "filled" : undefined),
        includeVersion: options.banner?.includeVersion,
        version: options.banner?.version,
      });
      if (bannerText) {
        const write = options.write ?? ((text: string) => process.stdout.write(text));
        const margin = textRenderer.getMargin();
        const formattedBanner = bannerText
          .split("\n")
          .map(line => line.length > 0 ? margin + line : line)
          .join("\n");
        write(formattedBanner + "\n\n");
      }
    },
    finalize: (exitCode) => {
      const durationMs = Date.now() - stats.startTime;
      formatter.finalize({
        exitCode,
        durationMs,
        tasksComplete: stats.tasksComplete,
        totalTasks: stats.totalTasks,
        commits: stats.commits,
        linesAdded: stats.linesAdded,
        linesRemoved: stats.linesRemoved,
      });
    },
    getStats: () => stats as Readonly<HeadlessStats>,
    getTextRenderer: () => textRenderer,
    getMargin: () => textRenderer.getMargin(),
  };
}
