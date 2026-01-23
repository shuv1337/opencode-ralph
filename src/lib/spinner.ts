/**
 * CLI Spinner Animation Module
 *
 * Provides animated loading spinners for headless CLI mode.
 * Supports multiple spinner styles with cross-platform fallbacks.
 *
 * Features:
 * - Braille dot spinner (default): ⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏
 * - Line spinner fallback: |/-\
 * - Block spinner: ▖▘▝▗
 * - Arrow spinner: ←↖↑↗→↘↓↙
 * - Configurable animation rate (~100ms default)
 * - ANSI escape codes for in-place updates
 * - Fallback to static message for unsupported terminals
 * - Color customization
 */

import { getCapabilities } from "./terminal-capabilities";

// =============================================================================
// Types
// =============================================================================

/**
 * Available spinner styles
 */
export type SpinnerStyle = 
  | "braille"     // ⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏ (default)
  | "line"        // |/-\
  | "block"       // ▖▘▝▗
  | "arrow"       // ←↖↑↗→↘↓↙
  | "dots"        // ⣾⣽⣻⢿⡿⣟⣯⣷
  | "bounce";     // ⠁⠂⠄⠂

/**
 * Spinner configuration options
 */
export interface SpinnerOptions {
  /** Spinner style */
  style?: SpinnerStyle;
  /** Animation interval in milliseconds (default: 100) */
  interval?: number;
  /** Text to display after spinner */
  text?: string;
  /** Color for spinner (ANSI color code) */
  color?: string;
  /** Custom write function */
  write?: (text: string) => void;
  /** Whether to hide cursor during animation */
  hideCursor?: boolean;
}

/**
 * Spinner controller interface
 */
export interface SpinnerController {
  /** Start the spinner animation */
  start(): void;
  /** Stop the spinner animation */
  stop(): void;
  /** Pause the spinner animation (preserves frame index) */
  pause(): void;
  /** Resume the spinner animation */
  resume(): void;
  /** Update the spinner text */
  setText(text: string): void;
  /** Check if spinner is running */
  isRunning(): boolean;
  /** Update spinner style */
  setStyle(style: SpinnerStyle): void;
  /** Clear the spinner line (also pauses animation) */
  clear(): void;
}

// =============================================================================
// Spinner Frame Definitions
// =============================================================================

/**
 * Spinner frame sequences for each style
 */
export const SPINNER_FRAMES: Record<SpinnerStyle, readonly string[]> = {
  braille: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
  line: ["|", "/", "-", "\\"],
  block: ["▖", "▘", "▝", "▗"],
  arrow: ["←", "↖", "↑", "↗", "→", "↘", "↓", "↙"],
  dots: ["⣾", "⣽", "⣻", "⢿", "⡿", "⣟", "⣯", "⣷"],
  bounce: ["⠁", "⠂", "⠄", "⠂"],
};

/**
 * ASCII fallback frames for terminals without Unicode
 */
const ASCII_FRAMES = ["|", "/", "-", "\\"];

// =============================================================================
// ANSI Escape Codes
// =============================================================================

const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  // Colors
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  // 256 color mode
  dimCyan: "\x1b[38;5;44m",
  // Cursor control
  cursorHide: "\x1b[?25l",
  cursorShow: "\x1b[?25h",
  // Line control
  clearLine: "\x1b[2K",
  cursorToStart: "\x1b[0G",
  cursorUp: "\x1b[1A",
  saveCursor: "\x1b7",
  restoreCursor: "\x1b8",
} as const;

// =============================================================================
// Implementation
// =============================================================================

/**
 * Determine the best spinner style for the current terminal
 */
export function detectSpinnerStyle(): SpinnerStyle {
  const caps = getCapabilities();

  // Use line spinner for legacy Windows or terminals without Unicode
  if (caps.isWindowsLegacy || !caps.supportsUnicode) {
    return "line";
  }

  // Use braille for terminals with Unicode support
  return "braille";
}

/**
 * Create a spinner controller
 *
 * @param options - Spinner configuration
 * @returns SpinnerController instance
 */
export function createSpinner(options: SpinnerOptions = {}): SpinnerController {
  const caps = getCapabilities();
  const write = options.write ?? ((text: string) => process.stdout.write(text));
  
  // Determine spinner style with fallbacks
  let style = options.style ?? detectSpinnerStyle();
  const interval = options.interval ?? 100;
  let text = options.text ?? "Looping...";
  const hideCursor = options.hideCursor ?? true;
  
  // Determine color based on terminal capabilities
  let colorCode = options.color ?? ANSI.dimCyan;
  if (!caps.supportsColor) {
    colorCode = "";
  }

  // Get appropriate frames
  const getFrames = (): readonly string[] => {
    if (!caps.supportsUnicode && style !== "line") {
      return ASCII_FRAMES;
    }
    return SPINNER_FRAMES[style];
  };

  let running = false;
  let frameIndex = 0;
  let timer: ReturnType<typeof setInterval> | null = null;

  /**
   * Render the current spinner frame
   */
  const render = (): void => {
    const frames = getFrames();
    const frame = frames[frameIndex % frames.length];
    frameIndex++;

    // Build the spinner line
    const spinnerChar = colorCode ? `${colorCode}${frame}${ANSI.reset}` : frame;
    const line = `${ANSI.cursorToStart}${ANSI.clearLine}${spinnerChar} ${text}`;
    
    write(line);
  };

  /**
   * Animation can only work if:
   * 1. Terminal supports animation
   * 2. stdout is a TTY (not piped)
   */
  const canAnimate = (): boolean => {
    return caps.supportsAnimation || process.stdout.isTTY === true;
  };

  return {
    start(): void {
      if (running) return;
      running = true;

      // Check if animation is possible
      if (!canAnimate()) {
        // Fallback to static message
        const fallbackText = caps.supportsColor
          ? `${ANSI.dimCyan}...${ANSI.reset} ${text}`
          : `... ${text}`;
        write(fallbackText + "\n");
        return;
      }

      // Hide cursor if requested
      if (hideCursor && caps.supportsAnimation) {
        write(ANSI.cursorHide);
      }

      // Start animation loop
      render();
      timer = setInterval(render, interval);
    },

    stop(): void {
      if (!running) return;
      running = false;

      // Clear the timer
      if (timer) {
        clearInterval(timer);
        timer = null;
      }

      // Only clear if we were animating
      if (canAnimate()) {
        // Clear the spinner line
        write(`${ANSI.cursorToStart}${ANSI.clearLine}`);
        
        // Show cursor again
        if (hideCursor) {
          write(ANSI.cursorShow);
        }
      }
    },

    setText(newText: string): void {
      text = newText;
      // Re-render immediately if running
      if (running && canAnimate()) {
        render();
      }
    },

    isRunning(): boolean {
      return running;
    },

    setStyle(newStyle: SpinnerStyle): void {
      style = newStyle;
      frameIndex = 0;
    },

    pause(): void {
      if (!running) return;
      
      // Clear the timer but keep running state for resume
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      
      // Clear the line
      if (canAnimate()) {
        write(`${ANSI.cursorToStart}${ANSI.clearLine}`);
      }
    },

    resume(): void {
      if (!running) return;
      
      // Only restart if not already animating
      if (!timer && canAnimate()) {
        render();
        timer = setInterval(render, interval);
      }
    },

    clear(): void {
      // Pause the animation and clear the line
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      if (canAnimate()) {
        write(`${ANSI.cursorToStart}${ANSI.clearLine}`);
      }
    },
  };
}

/**
 * Default spinner instance (lazily created)
 */
let defaultSpinner: SpinnerController | null = null;

/**
 * Get the default spinner controller
 */
export function getSpinner(options?: SpinnerOptions): SpinnerController {
  if (!defaultSpinner) {
    defaultSpinner = createSpinner(options);
  }
  return defaultSpinner;
}

/**
 * Reset the default spinner
 */
export function resetSpinner(): void {
  if (defaultSpinner) {
    defaultSpinner.stop();
    defaultSpinner = null;
  }
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Show a spinner while a promise is executing
 *
 * @param promise - Promise to wait for
 * @param text - Text to display while waiting
 * @returns Result of the promise
 */
export async function withSpinner<T>(
  promise: Promise<T>,
  text: string = "Processing..."
): Promise<T> {
  const spinner = createSpinner({ text });
  spinner.start();

  try {
    const result = await promise;
    spinner.stop();
    return result;
  } catch (error) {
    spinner.stop();
    throw error;
  }
}
