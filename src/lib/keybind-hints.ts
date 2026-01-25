/**
 * Keybind Hints Module - Displays available keyboard shortcuts in headless mode
 *
 * Provides a context-aware, horizontal display of keyboard shortcuts
 * for the OpenRalph headless CLI.
 *
 * @module keybind-hints
 */

import { getCapabilities } from "./terminal-capabilities";
import { getSymbol, MISC_SYMBOLS } from "./cli-symbols";

// =============================================================================
// Types
// =============================================================================

/**
 * Configuration options for keybind hints display.
 */
export interface KeybindHintsOptions {
  /** Keys to exclude from the hints (e.g., ['p', 'q']) */
  exclude?: string[];
  /** Whether to use colors (auto-detected if not specified) */
  colors?: boolean;
  /** Whether to use Unicode symbols (auto-detected if not specified) */
  unicode?: boolean;
  /** Custom write function (for testing) */
  write?: (text: string) => void;
}

/**
 * Single keybind definition.
 */
interface KeybindDef {
  /** The key or shortcut (e.g., 'Ctrl+C', 'T') */
  key: string;
  /** Brief description of the action */
  label: string;
  /** Context-aware ID for exclusion */
  id: string;
  /** Optional ANSI color code */
  color?: string;
}

// =============================================================================
// Constants
// =============================================================================

const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  gray: "\x1b[90m",
  white: "\x1b[37m",
} as const;

/**
 * Default keybind definitions for headless mode.
 */
const DEFAULT_KEYBINDS: KeybindDef[] = [
  { id: "interrupt", key: "Ctrl+C", label: "Interrupt", color: ANSI.yellow },
  { id: "terminal", key: "T", label: "Terminal", color: ANSI.cyan },
  { id: "force_quit", key: "Ctrl+\\", label: "Force Quit", color: ANSI.gray },
  { id: "pause", key: "P", label: "Pause/Menu", color: ANSI.yellow },
  { id: "quit", key: "Q", label: "Quit", color: ANSI.white },
];

// =============================================================================
// Implementation
// =============================================================================

/**
 * Render keybind hints as a horizontal string.
 *
 * @param options - Display options
 * @returns Formatted keybind hints string
 */
export function renderKeybindHints(options: KeybindHintsOptions = {}): string {
  const caps = getCapabilities();
  const useColors = options.colors ?? caps.supportsColor;
  const useUnicode = options.unicode ?? caps.supportsUnicode;
  const exclude = options.exclude || [];

  // Filter keybinds based on exclusion list
  const filtered = DEFAULT_KEYBINDS.filter((kb) => !exclude.includes(kb.id));

  if (filtered.length === 0) {
    return "";
  }

  const separator = getSymbol(MISC_SYMBOLS.separator, useUnicode ? "unicode" : "ascii");
  
  return filtered
    .map((kb) => {
      const keyStr = useColors 
        ? `${ANSI.bold}[${kb.key}]${ANSI.reset}` 
        : `[${kb.key}]`;
      
      const labelStr = useColors && kb.color
        ? `${kb.color}${kb.label}${ANSI.reset}`
        : kb.label;

      return `${keyStr} ${labelStr}`;
    })
    .join(`  ${useColors ? ANSI.dim : ""}${separator}${ANSI.reset}  `);
}

/**
 * Get available keybind hints for the start of headless mode.
 * Excludes 'p' and 'q' as they are typically shown in the start prompt.
 *
 * @returns Formatted hints string
 */
export function getStartupKeybindHints(): string {
  return renderKeybindHints({ exclude: ["pause", "quit"] });
}

/**
 * Get available keybind hints for runtime (during execution).
 * Includes 'P' (labeled as Pause/Menu) to ensure user knows about interactive mode.
 *
 * @returns Formatted hints string
 */
export function getRuntimeKeybindHints(): string {
  // During runtime, Q (quick quit) and P (menu) are both valid and important
  return renderKeybindHints({ exclude: [] });
}
