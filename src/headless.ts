/**
 * @file Headless Mode Entry Point
 * @description Main entry point for headless mode execution.
 * Uses HeadlessRunner internally while maintaining backward compatibility.
 *
 * Features:
 * - ASCII banner display at startup (when terminal supports it)
 * - Enhanced text/json/jsonl formatters
 * - Proper process cleanup on exit
 * - Full backward compatibility with existing CLI options
 *
 * @version 2.1.0
 * @see docs/architecture/HEADLESS_ARCHITECTURE.md
 */

import { HeadlessRunner } from "./headless/runner";
import type {
  HeadlessConfig,
  FormatterType,
} from "./headless/types";
import { runLoop as defaultRunLoop } from "./loop";
import type { LoopOptions, PersistedState } from "./state";
import {
  renderBanner,
  shouldShowBanner,
  type BannerOptions,
} from "./lib/ascii-banner";
import { getCapabilities } from "./lib/terminal-capabilities";
import { log } from "./lib/log";

// =============================================================================
// Types (Backward Compatible)
// =============================================================================

/**
 * Options for running headless mode.
 *
 * @remarks
 * This type is maintained for backward compatibility with existing consumers.
 * New code should prefer using HeadlessRunner directly with HeadlessConfig.
 */
export type HeadlessRunOptions = {
  loopOptions: LoopOptions;
  persistedState: PersistedState;
  format: string;
  timestamps: boolean;
  maxIterations?: number;
  maxTime?: number;
  /** Whether to show the ASCII banner (defaults to true for text format) */
  showBanner?: boolean;
  /** Banner display options */
  bannerOptions?: BannerOptions;
  /** 
   * Whether to start immediately without waiting for keypress.
   * Defaults to true in CI environments, false in interactive terminals.
   */
  autoStart?: boolean;
};

// =============================================================================
// Banner Display
// =============================================================================

/**
 * Display the ASCII banner at startup if appropriate.
 *
 * @param format - Output format
 * @param showBanner - Whether to show the banner (can override auto-detection)
 * @param bannerOptions - Additional banner options
 * @param write - Custom write function (defaults to process.stdout.write)
 */
function displayBanner(
  format: string,
  showBanner: boolean | undefined,
  bannerOptions?: BannerOptions,
  write?: (text: string) => void
): void {
  // Only show banner for text format by default
  const isTextFormat = format.toLowerCase() === "text";

  // Determine if we should show banner
  const shouldShow =
    showBanner !== undefined
      ? showBanner
      : isTextFormat && shouldShowBanner();

  if (!shouldShow) {
    log("headless", "Banner display skipped", {
      format,
      showBanner,
      shouldShowBanner: shouldShowBanner(),
    });
    return;
  }

  try {
    const caps = getCapabilities();

    // Only skip banner in CI environments (not for non-interactive terminals)
    // In headless mode, we want to show banner even without a TTY
    if (caps.isCI && showBanner !== true) {
      log("headless", "Banner skipped for CI environment", {
        isCI: caps.isCI,
      });
      return;
    }

    const banner = renderBanner({
      ...bannerOptions,
      includeVersion: bannerOptions?.includeVersion ?? true,
    });

    if (banner) {
      const output = write ?? ((text: string) => process.stdout.write(text));
      output(banner + "\n\n");
      log("headless", "Banner displayed", { tier: caps.tier });
    }
  } catch (error) {
    // Banner display should never fail the execution
    log("headless", "Banner display error (non-fatal)", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// =============================================================================
// Main Entry Point
// =============================================================================

/**
 * Run headless mode with the new modular architecture.
 *
 * @param options - Headless run options (backward compatible)
 * @param runLoop - Loop function to use (for testing, defaults to runLoop)
 * @returns Exit code indicating the result of execution
 *
 * @remarks
 * This function maintains backward compatibility with the existing CLI interface
 * while internally using the new HeadlessRunner architecture.
 *
 * @example
 * ```typescript
 * const exitCode = await runHeadlessMode({
 *   loopOptions,
 *   persistedState,
 *   format: "text",
 *   timestamps: true,
 *   maxIterations: 10,
 * });
 * ```
 */
export async function runHeadlessMode(
  options: HeadlessRunOptions,
  runLoop: typeof defaultRunLoop = defaultRunLoop
): Promise<number> {
  const {
    loopOptions,
    persistedState,
    format,
    timestamps,
    maxIterations,
    maxTime,
    showBanner,
    bannerOptions,
    autoStart,
  } = options;

  log("headless", "Starting headless mode", {
    format,
    timestamps,
    maxIterations,
    maxTime,
    planFile: loopOptions.planFile,
    autoStart,
  });

  // Convert format string to FormatterType
  const formatterType = normalizeFormat(format);

  // Build HeadlessConfig from options
  const config: HeadlessConfig = {
    format: formatterType,
    timestamps,
    limits: {
      maxIterations,
      maxTime,
    },
    cleanup: {
      enabled: true,
      timeout: 3000,
      force: true,
    },
    banner: {
      // In headless mode, show banner by default for all formats unless explicitly disabled
      // The banner is shown BEFORE any output, so it won't interfere with JSON parsing
      enabled: showBanner ?? true,
      text: bannerOptions?.text,
      palette: bannerOptions?.palette,
      style: bannerOptions?.style as any,
      includeVersion: bannerOptions?.includeVersion,
      version: bannerOptions?.version,
    },
    // Pass autoStart to the HeadlessConfig
    autoStart,
  };

  // Create the runner
  const runner = new HeadlessRunner(config);

  // Run with the provided loop function
  const exitCode = await runner.run({
    loopOptions,
    persistedState,
    runLoop,
  });

  log("headless", "Headless mode completed", { exitCode });

  return exitCode;
}

/**
 * Normalize format string to FormatterType.
 *
 * @param format - Raw format string from CLI
 * @returns Normalized FormatterType
 */
function normalizeFormat(format: string): FormatterType {
  const normalized = format.toLowerCase().trim();

  switch (normalized) {
    case "json":
      return "json";
    case "jsonl":
    case "json-lines":
    case "ndjson":
      return "jsonl";
    case "stream":
      return "stream";
    case "text":
    case "txt":
    default:
      return "text";
  }
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Create a headless runner with options from HeadlessRunOptions.
 *
 * @param options - Headless run options
 * @returns Configured HeadlessRunner instance
 *
 * @remarks
 * Use this when you need more control over the runner lifecycle
 * (e.g., event handlers, custom cleanup).
 *
 * @example
 * ```typescript
 * const runner = createRunnerFromOptions({
 *   format: "jsonl",
 *   timestamps: true,
 *   maxIterations: 5,
 * });
 *
 * runner.on("tool", (event) => console.log("Tool:", event));
 *
 * const exitCode = await runner.run({ loopOptions, persistedState });
 * ```
 */
export function createRunnerFromOptions(
  options: Omit<HeadlessRunOptions, "loopOptions" | "persistedState">
): HeadlessRunner {
  const { format, timestamps, maxIterations, maxTime } = options;

  const config: HeadlessConfig = {
    format: normalizeFormat(format),
    timestamps,
    limits: {
      maxIterations,
      maxTime,
    },
    cleanup: {
      enabled: true,
      timeout: 3000,
      force: true,
    },
  };

  return new HeadlessRunner(config);
}

// =============================================================================
// Re-exports for Convenience
// =============================================================================

// Re-export types from headless/types.ts
export type {
  HeadlessConfig,
  HeadlessExitCode,
  FormatterType,
  HeadlessEvent,
  HeadlessEventType,
  HeadlessSummary,
  HeadlessStats,
  HeadlessState,
  HeadlessCallbacks,
} from "./headless/types";

export { HeadlessExitCodes } from "./headless/types";

// Re-export HeadlessRunner from runner.ts
export { HeadlessRunner, createHeadlessRunner } from "./headless/runner";

// Re-export banner utilities
export {
  renderBanner,
  shouldShowBanner,
  type BannerOptions,
  type BannerStyle,
  type PaletteName,
} from "./lib/ascii-banner";

// Re-export text renderer utilities
export {
  createTextRenderer,
  getTextRenderer,
  type TextRenderer,
  type TextRenderMode,
} from "./lib/text-renderer";
