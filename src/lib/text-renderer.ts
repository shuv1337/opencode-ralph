/**
 * Text-based output renderer for headless mode.
 *
 * Converts TUI visual elements to text-based equivalents for:
 * - Piped output
 * - CI/CD environments
 * - Terminals with limited Unicode/color support
 *
 * Features:
 * - Complete icon-to-text mapping (21+ tools)
 * - 4 render modes: full, unicode, ascii, minimal
 * - ANSI color support with NO_COLOR compliance
 * - Integration with existing icon-fallback.ts
 */

import { getCapabilities } from "./terminal-capabilities";
import { ICON_SETS, type IconStyle } from "./icon-fallback";
import {
  getSymbol,
  getSymbolStyle,
  TOOL_SYMBOLS,
  TOOL_TYPE_SYMBOLS,
  STATUS_SYMBOLS,
  ARROW_SYMBOLS,
  BOX_SYMBOLS,
  BLOCK_SYMBOLS,
  MISC_SYMBOLS,
  type SymbolStyle,
} from "./cli-symbols";

// ============================================================================
// Types
// ============================================================================

/**
 * Text rendering modes based on terminal capabilities.
 */
export type TextRenderMode = "full" | "unicode" | "ascii" | "minimal";

/**
 * Ralph execution status.
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

/**
 * Task completion status.
 */
export type TaskStatus =
  | "done"
  | "active"
  | "actionable"
  | "pending"
  | "blocked"
  | "error"
  | "closed";

/**
 * Activity event types.
 */
export type ActivityEventType =
  | "session_start"
  | "session_idle"
  | "task"
  | "file_edit"
  | "file_read"
  | "error"
  | "user_message"
  | "assistant_message"
  | "reasoning"
  | "tool_use"
  | "info";

/**
 * Outcome indicator types.
 */
export type OutcomeType = "success" | "error" | "running" | "warning";

/**
 * Log entry data.
 */
export interface LogEntry {
  timestamp?: number;
  level: string;
  message: string;
  metadata?: Record<string, unknown>;
  iteration?: number;
}

/**
 * Session statistics for footer rendering.
 */
export interface SessionStats {
  iterations: number;
  commits: number;
  linesAdded: number;
  linesRemoved: number;
  tasksComplete: number;
  totalTasks: number;
  durationMs: number;
  exitCode: number;
}

/**
 * Override symbols for ASCII mode customization.
 */
export interface AsciiSymbolOverrides {
  toolPrefix?: string;
  toolSuffix?: string;
  statusOpen?: string;
  statusClose?: string;
  separatorChar?: string;
  progressOpen?: string;
  progressClose?: string;
  progressFill?: string;
  progressEmpty?: string;
}

/**
 * Configuration options for text rendering.
 */
export interface TextRendererOptions {
  mode?: TextRenderMode;
  timestamps?: boolean;
  colors?: boolean;
  width?: number;
  asciiSymbols?: AsciiSymbolOverrides;
  /** 
   * Left margin (number of spaces)
   * @default 2
   */
  leftMargin?: number;
  /** 
   * If true, use at least 'ascii' mode even for non-TTY output.
   * This is useful for headless mode where we want formatted output
   * regardless of whether stdout is a TTY.
   */
  forceMinimumAscii?: boolean;
}

/**
 * Interface for text-based output rendering.
 */
export interface TextRenderer {
  renderToolIcon(toolName: string): string;
  renderStatus(status: RalphStatus): string;
  renderTaskStatus(status: TaskStatus): string;
  renderEvent(event: ActivityEventType): string;
  renderOutcome(outcome: OutcomeType): string;
  renderSeparator(text?: string): string;
  renderProgress(done: number, total: number): string;
  renderHeader(title: string, metadata?: Record<string, string>): string;
  renderFooter(stats: SessionStats): string;
  renderLogEntry(entry: LogEntry): string;
  getMode(): TextRenderMode;
  /** Get the configured left margin string */
  getMargin(): string;
}

// ============================================================================
// ANSI Color Support
// ============================================================================

/**
 * ANSI color codes for text output.
 */
export const ANSI_COLORS = {
  // Foreground colors (256-color mode)
  primary: "\x1b[38;5;63m", // Blue
  secondary: "\x1b[38;5;141m", // Purple
  accent: "\x1b[38;5;203m", // Red/Pink
  success: "\x1b[38;5;120m", // Green
  warning: "\x1b[38;5;215m", // Orange
  error: "\x1b[38;5;203m", // Red
  info: "\x1b[38;5;81m", // Cyan
  text: "\x1b[38;5;255m", // White
  textMuted: "\x1b[38;5;244m", // Gray

  // Extended palette for tool distinction
  yellow: "\x1b[38;5;227m", // Bright Yellow
  magenta: "\x1b[38;5;207m", // Magenta/Pink
  teal: "\x1b[38;5;44m", // Teal
  lime: "\x1b[38;5;154m", // Lime Green
  coral: "\x1b[38;5;209m", // Coral/Salmon
  sky: "\x1b[38;5;117m", // Sky Blue
  violet: "\x1b[38;5;135m", // Violet
  gold: "\x1b[38;5;220m", // Gold

  // Background colors
  background: "\x1b[48;5;234m", // Dark
  backgroundElement: "\x1b[48;5;238m", // Dark gray

  // Styles
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
} as const;

type AnsiColorName = keyof typeof ANSI_COLORS;

// ============================================================================
// Tool Icon Mappings (ASCII mode text equivalents)
// ============================================================================

/**
 * Tool icon to ASCII text mapping.
 * All 21+ tools from the spec.
 */
export const TOOL_TEXT_MAP: Record<string, string> = {
  read: "[READ]",
  write: "[WRITE]",
  edit: "[EDIT]",
  bash: "[BASH]",
  glob: "[GLOB]",
  grep: "[GREP]",
  task: "[TASK]",
  todowrite: "[TODO-W]",
  todoread: "[TODO-R]",
  thought: "[THINK]",
  lsp: "[LSP]",
  websearch: "[WEB]",
  webfetch: "[FETCH]",
  codesearch: "[CODE]",
  mcp: "[MCP]",
  tavily: "[TAVILY]",
  context7: "[C7]",
  exa: "[EXA]",
  gh: "[GH]",
  github: "[GH]",
  brave: "[BRAVE]",
  custom: "[TOOL]",
  skill: "[SKILL]",
  success: "[OK]",
  info: "[INFO]",
};

/**
 * Tool icon to Unicode symbol mapping.
 * Uses proper terminal-native symbols, NOT emojis.
 * These are monospace-compatible UTF-8 characters.
 */
export const TOOL_UNICODE_MAP: Record<string, string> = {
  read: "[◀]",
  write: "[▶]",
  edit: "[◇]",
  bash: "[$]",
  glob: "[*]",
  grep: "[/]",
  task: "[▣]",
  todowrite: "[☑]",
  todoread: "[▣]",
  thought: "[◈]",
  lsp: "[◎]",
  websearch: "[◉]",
  webfetch: "[↓]",
  codesearch: "[/]",
  mcp: "[+]",
  tavily: "[◉]",
  context7: "[+]",
  exa: "[/]",
  gh: "[#]",
  github: "[#]",
  brave: "[◉]",
  custom: "[◆]",
  skill: "[★]",
  success: "[✓]",
  info: "[i]",
};

// ============================================================================
// Status Indicator Mappings
// ============================================================================

/**
 * Ralph status to ASCII text mapping.
 */
export const STATUS_TEXT_MAP: Record<RalphStatus, string> = {
  starting: "[START]",
  ready: "[READY]",
  running: "[RUN]",
  selecting: "[SELECT]",
  executing: "[EXEC]",
  pausing: "[PAUSING]",
  paused: "[PAUSED]",
  stopped: "[STOP]",
  complete: "[DONE]",
  idle: "[IDLE]",
  error: "[ERROR]",
};

/**
 * Ralph status to Unicode symbol mapping.
 * Uses proper terminal-native symbols, NOT emojis.
 */
export const STATUS_UNICODE_MAP: Record<RalphStatus, string> = {
  starting: "[○]",
  ready: "[●]",
  running: "[▶]",
  selecting: "[◐]",
  executing: "[▶]",
  pausing: "[◆]",
  paused: "[◆]",
  stopped: "[■]",
  complete: "[✓]",
  idle: "[○]",
  error: "[✗]",
};

/**
 * Status color mapping.
 */
export const STATUS_COLOR_MAP: Record<RalphStatus, AnsiColorName> = {
  starting: "textMuted",
  ready: "success",
  running: "primary",
  selecting: "info",
  executing: "primary",
  pausing: "warning",
  paused: "warning",
  stopped: "textMuted",
  complete: "success",
  idle: "textMuted",
  error: "error",
};

// ============================================================================
// Task Status Mappings
// ============================================================================

/**
 * Task status to ASCII text mapping.
 */
export const TASK_STATUS_TEXT_MAP: Record<TaskStatus, string> = {
  done: "[X]",
  active: "[>]",
  actionable: "[>]",
  pending: "[ ]",
  blocked: "[-]",
  error: "[!]",
  closed: "[X]",
};

/**
 * Task status to Unicode symbol mapping.
 */
export const TASK_STATUS_UNICODE_MAP: Record<TaskStatus, string> = {
  done: "[✓]",
  active: "[▶]",
  actionable: "[▶]",
  pending: "[○]",
  blocked: "[⊘]",
  error: "[✗]",
  closed: "[✓]",
};

/**
 * Task status color mapping.
 */
export const TASK_STATUS_COLOR_MAP: Record<TaskStatus, AnsiColorName> = {
  done: "success",
  active: "primary",
  actionable: "success",
  pending: "textMuted",
  blocked: "error",
  error: "error",
  closed: "textMuted",
};

// ============================================================================
// Activity Event Mappings
// ============================================================================

/**
 * Activity event to ASCII text mapping.
 */
export const EVENT_TEXT_MAP: Record<ActivityEventType, string> = {
  session_start: "[START]",
  session_idle: "[IDLE]",
  task: "[TASK]",
  file_edit: "[EDIT]",
  file_read: "[READ]",
  error: "[ERROR]",
  user_message: "[USER]",
  assistant_message: "[BOT]",
  reasoning: "[THINK]",
  tool_use: "[TOOL]",
  info: "[INFO]",
};

/**
 * Activity event to Unicode symbol mapping.
 * Uses proper terminal-native symbols, NOT emojis.
 */
export const EVENT_UNICODE_MAP: Record<ActivityEventType, string> = {
  session_start: "[▶]",
  session_idle: "[◆]",
  task: "[☐]",
  file_edit: "[◇]",
  file_read: "[◀]",
  error: "[✗]",
  user_message: "[→]",
  assistant_message: "[←]",
  reasoning: "[◈]",
  tool_use: "[◆]",
  info: "[i]",
};

/**
 * Activity event color mapping.
 */
export const EVENT_COLOR_MAP: Record<ActivityEventType, AnsiColorName> = {
  session_start: "success",
  session_idle: "textMuted",
  task: "accent",
  file_edit: "success",
  file_read: "info",
  error: "error",
  user_message: "accent",
  assistant_message: "secondary",
  reasoning: "warning",
  tool_use: "text",
  info: "info",
};

// ============================================================================
// Outcome Indicator Mappings
// ============================================================================

/**
 * Outcome to ASCII text mapping.
 */
export const OUTCOME_TEXT_MAP: Record<OutcomeType, string> = {
  success: "[OK]",
  error: "[ERR]",
  running: "[...]",
  warning: "[WARN]",
};

/**
 * Outcome to Unicode symbol mapping.
 * Uses proper terminal-native symbols, NOT emojis.
 */
export const OUTCOME_UNICODE_MAP: Record<OutcomeType, string> = {
  success: "[✓]",
  error: "[✗]",
  running: "[●]",
  warning: "[!]",
};

/**
 * Outcome color mapping.
 */
export const OUTCOME_COLOR_MAP: Record<OutcomeType, AnsiColorName> = {
  success: "success",
  error: "error",
  running: "primary",
  warning: "warning",
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if colors should be disabled.
 */
export function shouldDisableColors(): boolean {
  // Explicit NO_COLOR setting (RFC 3972)
  if (process.env.NO_COLOR !== undefined && process.env.NO_COLOR !== "") {
    return true;
  }

  // Check for FORCE_COLOR=0
  if (process.env.FORCE_COLOR === "0") {
    return true;
  }

  // Non-interactive output (pipes, redirects)
  if (process.stdout.isTTY === false) {
    return true;
  }

  return false;
}

/**
 * Detect the appropriate render mode for the current terminal.
 * 
 * @param forceMinimumAscii - If true, use at least 'ascii' mode for non-TTY output
 */
export function detectRenderMode(forceMinimumAscii: boolean = false): TextRenderMode {
  // Check NO_COLOR first (RFC 3972 compliance)
  if (process.env.NO_COLOR) {
    return "ascii";
  }

  // CRITICAL FIX: Check for Windows Terminal BEFORE TTY check
  // Windows Terminal sets WT_SESSION even when isTTY might be undefined/false
  const isWindowsTerminal = !!process.env.WT_SESSION;
  const isModernWindowsConsole = !!process.env.ANSICON || !!process.env.ConEmuANSI;
  
  // MSYS2/Git Bash detection - provides Unix-like environment on Windows
  const isMsys2 = !!process.env.MSYSTEM;
  const term = process.env.TERM || '';
  const isMsys2WithXterm = isMsys2 && (term.includes('xterm') || term.includes('256color'));

  // Check for TTY (not a pipe/redirect), BUT allow Windows Terminal and MSYS2 to pass through
  if (!process.stdout.isTTY && !isWindowsTerminal && !isModernWindowsConsole && !isMsys2WithXterm) {
    return forceMinimumAscii ? "ascii" : "minimal";
  }

  const caps = getCapabilities();

  // Windows legacy console
  if (caps.isWindowsLegacy) {
    return "ascii";
  }

  // Determine mode based on capabilities
  if (caps.level === "basic" || !caps.supportsUnicode) {
    return "ascii";
  }

  if (caps.supportsTrueColor) {
    return caps.supportsAnimation ? "full" : "unicode";
  }

  if (caps.level === "256" || caps.level === "colors") {
    return "unicode";
  }

  return "ascii";
}

/**
 * Apply color to text if colors are enabled and supported.
 */
export function colorize(
  text: string,
  color: AnsiColorName,
  options?: { bold?: boolean; dim?: boolean; mode?: TextRenderMode; colors?: boolean }
): string {
  const mode = options?.mode ?? detectRenderMode();
  const colors = options?.colors ?? true;

  if (!colors || mode === "minimal" || mode === "ascii") {
    return text;
  }

  if (shouldDisableColors()) {
    return text;
  }

  const codes: string[] = [];

  if (mode === "full" || mode === "unicode") {
    const colorCode = ANSI_COLORS[color];
    if (colorCode && color !== "reset" && color !== "bold" && color !== "dim") {
      codes.push(colorCode);
    }
    if (options?.bold) {
      codes.push(ANSI_COLORS.bold);
    }
    if (options?.dim) {
      codes.push(ANSI_COLORS.dim);
    }
  }

  if (codes.length === 0) {
    return text;
  }

  return codes.join("") + text + ANSI_COLORS.reset;
}

/**
 * Format duration in milliseconds to human-readable string.
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

// ============================================================================
// TextRenderer Implementation
// ============================================================================

/**
 * Create a text renderer with the specified mode.
 */
export function createTextRenderer(options?: TextRendererOptions): TextRenderer {
  const forceMinimumAscii = options?.forceMinimumAscii ?? false;
  const mode = options?.mode ?? detectRenderMode(forceMinimumAscii);
  const useColors = options?.colors ?? !shouldDisableColors();
  const width = options?.width ?? 60;
  const margin = " ".repeat(options?.leftMargin ?? 2);

  // Helper to apply margin to all lines of a string
  function applyMargin(text: string): string {
    if (!text) return "";
    return text
      .split("\n")
      .map((line) => (line.length > 0 ? margin + line : line))
      .join("\n");
  }

  // ASCII symbol overrides
  const symbols = {
    toolPrefix: options?.asciiSymbols?.toolPrefix ?? "[",
    toolSuffix: options?.asciiSymbols?.toolSuffix ?? "]",
    statusOpen: options?.asciiSymbols?.statusOpen ?? "[",
    statusClose: options?.asciiSymbols?.statusClose ?? "]",
    separatorChar: options?.asciiSymbols?.separatorChar ?? (mode === "ascii" || mode === "minimal" ? "-" : "─"),
    progressOpen: options?.asciiSymbols?.progressOpen ?? "[",
    progressClose: options?.asciiSymbols?.progressClose ?? "]",
    progressFill: options?.asciiSymbols?.progressFill ?? "=",
    progressEmpty: options?.asciiSymbols?.progressEmpty ?? ".",
  };

  // Border characters
  const border = {
    horizontal: mode === "ascii" || mode === "minimal" ? "=" : "═",
    horizontalThin: mode === "ascii" || mode === "minimal" ? "-" : "─",
  };

  function renderToolIcon(toolName: string): string {
    const normalized = toolName.toLowerCase();

    // Check for MCP tool pattern (server_tool format)
    const mcpMatch = normalized.match(/^(\w+)_\w+$/);
    if (mcpMatch) {
      const serverName = mcpMatch[1];
      // Check if we have a specific server icon
      if (mode === "unicode" || mode === "full") {
        const unicodeIcon = TOOL_UNICODE_MAP[serverName];
        if (unicodeIcon) {
          return useColors ? colorize(unicodeIcon, "info", { mode }) : unicodeIcon;
        }
      }
      const textIcon = TOOL_TEXT_MAP[serverName];
      if (textIcon) {
        return useColors ? colorize(textIcon, "info", { mode }) : textIcon;
      }
    }

    // Direct tool lookup
    if (mode === "unicode" || mode === "full") {
      const unicodeIcon = TOOL_UNICODE_MAP[normalized];
      if (unicodeIcon) {
        return useColors ? colorize(unicodeIcon, "info", { mode }) : unicodeIcon;
      }
    }

    const textIcon = TOOL_TEXT_MAP[normalized];
    if (textIcon) {
      return useColors ? colorize(textIcon, "info", { mode }) : textIcon;
    }

    // Fallback to uppercase tool name
    const fallback = `${symbols.toolPrefix}${toolName.toUpperCase()}${symbols.toolSuffix}`;
    return useColors ? colorize(fallback, "info", { mode }) : fallback;
  }

  function renderStatus(status: RalphStatus): string {
    const color = STATUS_COLOR_MAP[status];

    if (mode === "unicode" || mode === "full") {
      const unicode = STATUS_UNICODE_MAP[status];
      if (unicode) {
        return useColors ? colorize(unicode, color, { mode }) : unicode;
      }
    }

    const text = STATUS_TEXT_MAP[status];
    const result = useColors ? colorize(text, color, { mode }) : text;
    return result;
  }

  function renderTaskStatus(status: TaskStatus): string {
    const color = TASK_STATUS_COLOR_MAP[status];

    if (mode === "unicode" || mode === "full") {
      const unicode = TASK_STATUS_UNICODE_MAP[status];
      if (unicode) {
        return useColors ? colorize(unicode, color, { mode }) : unicode;
      }
    }

    const text = TASK_STATUS_TEXT_MAP[status];
    return useColors ? colorize(text, color, { mode }) : text;
  }

  function renderEvent(event: ActivityEventType): string {
    const color = EVENT_COLOR_MAP[event];

    if (mode === "unicode" || mode === "full") {
      const unicode = EVENT_UNICODE_MAP[event];
      if (unicode) {
        return useColors ? colorize(unicode, color, { mode }) : unicode;
      }
    }

    const text = EVENT_TEXT_MAP[event];
    return useColors ? colorize(text, color, { mode }) : text;
  }

  function renderOutcome(outcome: OutcomeType): string {
    const color = OUTCOME_COLOR_MAP[outcome];

    if (mode === "unicode" || mode === "full") {
      const unicode = OUTCOME_UNICODE_MAP[outcome];
      if (unicode) {
        return useColors ? colorize(unicode, color, { mode }) : unicode;
      }
    }

    const text = OUTCOME_TEXT_MAP[outcome];
    return useColors ? colorize(text, color, { mode }) : text;
  }

  function renderSeparator(text?: string): string {
    if (mode === "minimal") {
      return text ? `--- ${text} ---` : "---";
    }

    const sepChar = symbols.separatorChar;
    const totalWidth = width;

    if (!text) {
      const line = sepChar.repeat(totalWidth);
      return useColors ? colorize(line, "textMuted", { mode }) : line;
    }

    // Format: --- text ------- (left-aligned text with padding)
    const textWithPadding = ` ${text} `;
    const prefixLen = 3;
    const remaining = totalWidth - prefixLen - textWithPadding.length;
    const suffix = sepChar.repeat(Math.max(0, remaining));

    const line = sepChar.repeat(prefixLen) + textWithPadding + suffix;
    return useColors ? colorize(line, "textMuted", { mode }) : line;
  }

  function renderProgress(done: number, total: number): string {
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;

    if (mode === "minimal") {
      return `${done}/${total} (${percent}%)`;
    }

    // Progress bar width (excluding brackets and percentage)
    const barWidth = 20;
    const fillCount = total > 0 ? Math.round((done / total) * barWidth) : 0;
    const emptyCount = barWidth - fillCount;

    const fill = symbols.progressFill.repeat(fillCount);
    const empty = symbols.progressEmpty.repeat(emptyCount);
    const bar = `${symbols.progressOpen}${fill}${empty}${symbols.progressClose}`;

    const taskLabel = renderToolIcon("task");
    const progress = `${taskLabel} ${done}/${total} ${bar} ${percent}%`;

    return progress;
  }

  function renderHeader(title: string, metadata?: Record<string, string>): string {
    const lines: string[] = [];
    const borderLine = border.horizontal.repeat(width);
    const thinLine = border.horizontalThin.repeat(width);

    lines.push(useColors ? colorize(borderLine, "primary", { mode }) : borderLine);
    lines.push(useColors ? colorize(title, "primary", { bold: true, mode }) : title);
    lines.push(useColors ? colorize(thinLine, "textMuted", { mode }) : thinLine);

    if (metadata) {
      for (const [key, value] of Object.entries(metadata)) {
        const label = useColors ? colorize(`${key}:`, "primary", { bold: true, mode }) : `${key}:`;
        lines.push(`${label} ${value}`);
      }
    }

    lines.push(useColors ? colorize(borderLine, "primary", { mode }) : borderLine);

    return lines.join("\n");
  }

  function renderFooter(stats: SessionStats): string {
    const lines: string[] = [];
    const borderLine = border.horizontal.repeat(width);
    const thinLine = border.horizontalThin.repeat(width);

    lines.push(useColors ? colorize(borderLine, "primary", { mode }) : borderLine);
    lines.push(useColors ? colorize("Summary", "primary", { bold: true, mode }) : "Summary");
    lines.push(useColors ? colorize(thinLine, "textMuted", { mode }) : thinLine);

    // Stats
    lines.push(`Iterations: ${stats.iterations}`);
    lines.push(`Commits:    ${stats.commits}`);
    lines.push(`Lines:      +${stats.linesAdded} / -${stats.linesRemoved}`);
    lines.push(`Tasks:      ${stats.tasksComplete}/${stats.totalTasks} complete`);
    lines.push(`Duration:   ${formatDuration(stats.durationMs)}`);

    // Status with exit code
    const statusText = stats.exitCode === 0 ? "DONE" : "FAILED";
    const statusColor: AnsiColorName = stats.exitCode === 0 ? "success" : "error";
    const statusLine = `Status:     ${useColors ? colorize(statusText, statusColor, { mode }) : statusText} (exit code: ${stats.exitCode})`;
    lines.push(statusLine);

    lines.push(useColors ? colorize(borderLine, "primary", { mode }) : borderLine);

    return lines.join("\n");
  }

  function renderLogEntry(entry: LogEntry): string {
    const parts: string[] = [];

    // Timestamp
    if (entry.timestamp) {
      const ts = new Date(entry.timestamp).toISOString();
      parts.push(useColors ? colorize(`[${ts}]`, "textMuted", { mode }) : `[${ts}]`);
    }

    // Level indicator
    const levelColors: Record<string, AnsiColorName> = {
      info: "info",
      warn: "warning",
      error: "error",
      debug: "textMuted",
    };
    const levelColor = levelColors[entry.level.toLowerCase()] ?? "text";
    const levelText = `[${entry.level.toUpperCase()}]`;
    parts.push(useColors ? colorize(levelText, levelColor, { mode }) : levelText);

    // Iteration number
    if (entry.iteration !== undefined) {
      parts.push(`#${entry.iteration}`);
    }

    // Message
    parts.push(entry.message);

    return parts.join(" ");
  }

  function getMode(): TextRenderMode {
    return mode;
  }

  function getMargin(): string {
    return margin;
  }

  return {
    renderToolIcon,
    renderStatus,
    renderTaskStatus,
    renderEvent,
    renderOutcome,
    renderSeparator,
    renderProgress,
    renderHeader,
    renderFooter,
    renderLogEntry,
    getMode,
    getMargin,
  };
}

// ============================================================================
// Convenience Exports
// ============================================================================

/**
 * Default text renderer with auto-detected mode.
 */
let defaultRenderer: TextRenderer | null = null;

/**
 * Get the default text renderer (lazily initialized).
 */
export function getTextRenderer(): TextRenderer {
  if (!defaultRenderer) {
    defaultRenderer = createTextRenderer();
  }
  return defaultRenderer;
}

/**
 * Reset the default text renderer (useful for testing).
 */
export function resetTextRenderer(): void {
  defaultRenderer = null;
}
