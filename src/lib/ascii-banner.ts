/**
 * ASCII Banner Module - OpenRalph branding display
 *
 * Provides ASCII art banners for headless mode startup,
 * adapting to terminal capabilities automatically.
 *
 * @module ascii-banner
 * @see docs/specs/ASCII_BANNER_SPEC.md
 */

import { getCapabilities, type TerminalTier, type TerminalCapabilities } from "./terminal-capabilities";

// =============================================================================
// Types
// =============================================================================

/**
 * Banner rendering styles.
 */
export type BannerStyle = "filled" | "gradient" | "plain" | "minimal";

/**
 * Predefined color palette names.
 */
export type PaletteName =
  | "openralph"
  | "fire"
  | "ocean"
  | "forest"
  | "sunset"
  | "sunrise"
  | "grad-blue"
  | "monochrome"
  | "neon"
  | "matrix";

/**
 * Color palette definition for banner rendering.
 */
export interface BannerPalette {
  /** Palette name for identification */
  name: string;
  /** Primary gradient start color (hex) */
  startColor: string;
  /** Primary gradient end color (hex) */
  endColor: string;
  /** Optional middle color for 3-color gradients */
  middleColor?: string;
  /** Description for documentation */
  description: string;
}

/**
 * Banner configuration options.
 */
export interface BannerOptions {
  /** Rendering style */
  style?: BannerStyle;
  /** Whether to include colors (auto-detected if not specified) */
  colors?: boolean;
  /** Maximum width constraint (0 = auto) */
  width?: number;
  /** Color palette to use */
  palette?: PaletteName;
  /** Custom banner text (default: "OpenRalph") */
  text?: string;
  /** Whether to include version info */
  includeVersion?: boolean;
  /** Version string to display */
  version?: string;
}

/**
 * Render result containing output and metadata.
 */
export interface RenderResult {
  /** The rendered banner string */
  output: string;
  /** Terminal tier used for rendering */
  tier: TerminalTier;
  /** Style used for rendering */
  style: BannerStyle;
  /** Whether colors were applied */
  hasColors: boolean;
  /** Whether Unicode characters were used */
  hasUnicode: boolean;
  /** Render time in milliseconds */
  renderTimeMs: number;
}

// =============================================================================
// Color Palettes (Tokyo Night inspired)
// =============================================================================

/**
 * OpenRalph official color palettes.
 */
export const PALETTES: Record<PaletteName, BannerPalette> = {
  openralph: {
    name: "openralph",
    startColor: "#7aa2f7", // Primary blue
    endColor: "#bb9af7", // Purple gradient
    middleColor: "#a9b1d6", // Transition color
    description: "Official OpenRalph branding - Blue to purple gradient",
  },
  fire: {
    name: "fire",
    startColor: "#f7768e", // Red/pink
    endColor: "#ff9e64", // Orange
    description: "Warm fire gradient - Red to orange (Claude Code inspired)",
  },
  ocean: {
    name: "ocean",
    startColor: "#7dcfff", // Cyan
    endColor: "#7aa2f7", // Blue
    description: "Cool ocean gradient - Cyan to blue",
  },
  forest: {
    name: "forest",
    startColor: "#9ece6a", // Green
    endColor: "#73daca", // Teal
    description: "Nature gradient - Green to teal",
  },
  sunset: {
    name: "sunset",
    startColor: "#bb9af7", // Purple
    endColor: "#ff9e64", // Orange
    middleColor: "#f7768e", // Pink transition
    description: "Vibrant sunset - Purple to orange via pink",
  },
  sunrise: {
    name: "sunrise",
    startColor: "#e0af68", // Yellow
    endColor: "#ff9e64", // Orange
    description: "Morning sun - Yellow to orange",
  },
  "grad-blue": {
    name: "grad-blue",
    startColor: "#60a5fa", // Light blue
    endColor: "#a78bfa", // Light purple
    description: "Technical gradient - Light blue to purple",
  },
  monochrome: {
    name: "monochrome",
    startColor: "#c0caf5", // White-ish
    endColor: "#565f89", // Gray
    description: "Grayscale for minimal terminals",
  },
  neon: {
    name: "neon",
    startColor: "#f7768e", // Bright pink
    endColor: "#7dcfff", // Bright cyan
    description: "Neon style - Pink to cyan (cyberpunk)",
  },
  matrix: {
    name: "matrix",
    startColor: "#9ece6a", // Green
    endColor: "#73daca", // Bright green
    description: "Hacker aesthetic - Green gradient",
  },
};

/**
 * 256-color ANSI approximations.
 */
const PALETTE_256_MAP: Record<PaletteName, number[]> = {
  openralph: [63, 141, 255], // blue, purple
  fire: [203, 215], // pink, orange
  ocean: [81, 63], // cyan, blue
  forest: [120, 78], // green, teal
  sunset: [141, 203, 215], // purple, pink, orange
  sunrise: [215, 209], // orange, yellow-orange
  "grad-blue": [75, 141], // cyan-blue, purple
  monochrome: [255, 244], // white, gray
  neon: [203, 81], // pink, cyan
  matrix: [120, 119], // green, bright green
};

/**
 * Standard ANSI color names for basic terminals.
 */
const ANSI_COLOR_MAP: Record<PaletteName, string> = {
  openralph: "blue",
  fire: "red",
  ocean: "cyan",
  forest: "green",
  sunset: "magenta",
  sunrise: "yellow",
  "grad-blue": "blue",
  monochrome: "white",
  neon: "cyan",
  matrix: "green",
};

// =============================================================================
// ASCII Art Designs
// =============================================================================

/**
 * Filled style banner with block characters (for truecolor terminals).
 * Uses Unicode box drawing characters for a bold, modern look.
 */
const FILLED_BANNER = `
 ██████╗ ██████╗ ███████╗███╗   ██╗██████╗  █████╗ ██╗     ██████╗ ██╗  ██╗
██╔═══██╗██╔══██╗██╔════╝████╗  ██║██╔══██╗██╔══██╗██║     ██╔══██╗██║  ██║
██║   ██║██████╔╝█████╗  ██╔██╗ ██║██████╔╝███████║██║     ██████╔╝███████║
██║   ██║██╔═══╝ ██╔══╝  ██║╚██╗██║██╔══██╗██╔══██║██║     ██╔═══╝ ██╔══██║
╚██████╔╝██║     ███████╗██║ ╚████║██║  ██║██║  ██║███████╗██║     ██║  ██║
 ╚═════╝ ╚═╝     ╚══════╝╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚═╝     ╚═╝  ╚═╝
`.trim();

/**
 * Simple ASCII art (for basic ANSI terminals without Unicode).
 */
const SIMPLE_BANNER = `
  ___  ____  _____ _   _ ____    _    _     ____  _   _ 
 / _ \\|  _ \\| ____| \\ | |  _ \\  / \\  | |   |  _ \\| | | |
| | | | |_) |  _| |  \\| | |_) |/ _ \\ | |   | |_) | |_| |
| |_| |  __/| |___| |\\  |  _ </ ___ \\| |___|  __/|  _  |
 \\___/|_|   |_____|_| \\_|_| \\_/_/   \\_\\_____|_|   |_| |_|
`.trim();

/**
 * Plain text banner (for legacy terminals).
 */
const PLAIN_BANNER = `
=== OpenRalph ===
AI Coding Agent
`.trim();

/**
 * Minimal banner (for constrained environments or when disabled).
 */
const MINIMAL_BANNER = "OpenRalph";

// =============================================================================
// Color Utilities
// =============================================================================

/**
 * Parse hex color to RGB components.
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    return { r: 255, g: 255, b: 255 };
  }
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

/**
 * Interpolate between two colors.
 */
function interpolateColor(
  color1: { r: number; g: number; b: number },
  color2: { r: number; g: number; b: number },
  factor: number
): { r: number; g: number; b: number } {
  return {
    r: Math.round(color1.r + (color2.r - color1.r) * factor),
    g: Math.round(color1.g + (color2.g - color1.g) * factor),
    b: Math.round(color1.b + (color2.b - color1.b) * factor),
  };
}

/**
 * Generate ANSI escape code for truecolor foreground.
 */
function truecolorFg(r: number, g: number, b: number): string {
  return `\x1b[38;2;${r};${g};${b}m`;
}

/**
 * Generate ANSI escape code for 256-color foreground.
 */
function color256Fg(colorIndex: number): string {
  return `\x1b[38;5;${colorIndex}m`;
}

/**
 * ANSI reset sequence.
 */
const RESET = "\x1b[0m";

/**
 * Basic ANSI color codes.
 */
const ANSI_COLORS: Record<string, string> = {
  black: "\x1b[30m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m",
};

// =============================================================================
// Rendering Functions
// =============================================================================

/**
 * Apply horizontal gradient to text (truecolor).
 */
function applyHorizontalGradient(text: string, palette: BannerPalette): string {
  const lines = text.split("\n");
  const startRgb = hexToRgb(palette.startColor);
  const endRgb = hexToRgb(palette.endColor);
  const middleRgb = palette.middleColor ? hexToRgb(palette.middleColor) : null;

  return lines
    .map((line) => {
      if (line.length === 0) return line;

      let result = "";
      const chars = [...line]; // Handle Unicode properly
      const total = chars.length;

      for (let i = 0; i < chars.length; i++) {
        const char = chars[i];
        if (char === " ") {
          result += char;
          continue;
        }

        const progress = total > 1 ? i / (total - 1) : 0;
        let color: { r: number; g: number; b: number };

        if (middleRgb) {
          // 3-color gradient
          if (progress < 0.5) {
            color = interpolateColor(startRgb, middleRgb, progress * 2);
          } else {
            color = interpolateColor(middleRgb, endRgb, (progress - 0.5) * 2);
          }
        } else {
          // 2-color gradient
          color = interpolateColor(startRgb, endRgb, progress);
        }

        result += truecolorFg(color.r, color.g, color.b) + char;
      }

      return result + RESET;
    })
    .join("\n");
}

/**
 * Apply vertical gradient to text (truecolor).
 */
function applyVerticalGradient(text: string, palette: BannerPalette): string {
  const lines = text.split("\n");
  const startRgb = hexToRgb(palette.startColor);
  const endRgb = hexToRgb(palette.endColor);
  const middleRgb = palette.middleColor ? hexToRgb(palette.middleColor) : null;
  const totalLines = lines.length;

  return lines
    .map((line, lineIndex) => {
      if (line.length === 0) return line;

      const progress = totalLines > 1 ? lineIndex / (totalLines - 1) : 0;
      let color: { r: number; g: number; b: number };

      if (middleRgb) {
        if (progress < 0.5) {
          color = interpolateColor(startRgb, middleRgb, progress * 2);
        } else {
          color = interpolateColor(middleRgb, endRgb, (progress - 0.5) * 2);
        }
      } else {
        color = interpolateColor(startRgb, endRgb, progress);
      }

      return truecolorFg(color.r, color.g, color.b) + line + RESET;
    })
    .join("\n");
}

/**
 * Apply 256-color styling to text.
 */
function apply256Color(text: string, paletteName: PaletteName): string {
  const colors = PALETTE_256_MAP[paletteName] || [63];
  const lines = text.split("\n");
  const totalLines = lines.length;

  return lines
    .map((line, lineIndex) => {
      if (line.length === 0) return line;

      // Simple vertical gradient with available colors
      const colorIndex = Math.floor((lineIndex / totalLines) * colors.length);
      const color = colors[Math.min(colorIndex, colors.length - 1)];

      return color256Fg(color) + line + RESET;
    })
    .join("\n");
}

/**
 * Apply basic ANSI color to text.
 */
function applyBasicColor(text: string, paletteName: PaletteName): string {
  const colorName = ANSI_COLOR_MAP[paletteName] || "white";
  const colorCode = ANSI_COLORS[colorName] || "";

  if (!colorCode) return text;

  return text
    .split("\n")
    .map((line) => (line ? colorCode + line + RESET : line))
    .join("\n");
}

/**
 * Determine the best banner style for the terminal capabilities.
 */
function determineBestStyle(caps: TerminalCapabilities): BannerStyle {
  if (caps.isWindowsLegacy) {
    return "plain";
  }

  if (caps.tier === "full_feature" || caps.tier === "truecolor") {
    return "filled";
  }

  if (caps.tier === "ansi_256") {
    return "gradient";
  }

  if (caps.supportsUnicode) {
    return "plain";
  }

  return "minimal";
}

/**
 * Get the appropriate banner art for the style.
 */
function getBannerArt(style: BannerStyle, supportsUnicode: boolean): string {
  switch (style) {
    case "filled":
      return supportsUnicode ? FILLED_BANNER : SIMPLE_BANNER;
    case "gradient":
      return supportsUnicode ? FILLED_BANNER : SIMPLE_BANNER;
    case "plain":
      return supportsUnicode ? SIMPLE_BANNER : PLAIN_BANNER;
    case "minimal":
      return MINIMAL_BANNER;
    default:
      return MINIMAL_BANNER;
  }
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Render the ASCII banner with automatic terminal detection.
 *
 * @param options - Banner configuration options
 * @returns Rendered banner string with appropriate styling
 *
 * @example
 * ```typescript
 * // Auto-detect terminal and render
 * const banner = renderBanner();
 * console.log(banner);
 *
 * // Force a specific style
 * const simpleBanner = renderBanner({ style: 'plain' });
 *
 * // Use a different color palette
 * const fireBanner = renderBanner({ palette: 'fire' });
 * ```
 */
export function renderBanner(options: BannerOptions = {}): string {
  const startTime = performance.now();
  const caps = getCapabilities();

  // Check for disabled banner via environment
  if (process.env.RALPH_BANNER_DISABLED === "1") {
    return "";
  }

  // Determine colors
  const useColors = options.colors ?? (caps.supportsColor && !process.env.NO_COLOR);

  // Determine style
  let style = options.style;
  if (!style) {
    style = determineBestStyle(caps);
  }

  // Get palette
  const paletteName = options.palette || "openralph";
  const palette = PALETTES[paletteName] || PALETTES.openralph;

  // Get banner art
  let banner = getBannerArt(style, caps.supportsUnicode);

  // Apply colors based on capabilities
  if (useColors && style !== "minimal") {
    if (caps.supportsTrueColor && (style === "filled" || style === "gradient")) {
      // Use horizontal gradient for filled style
      banner = applyHorizontalGradient(banner, palette);
    } else if (caps.level === "256") {
      banner = apply256Color(banner, paletteName);
    } else if (caps.level === "colors") {
      banner = applyBasicColor(banner, paletteName);
    }
  }

  // Add version if requested
  if (options.includeVersion && options.version) {
    const versionLine = `v${options.version}`;
    if (useColors && caps.supportsColor) {
      const mutedColor = caps.supportsTrueColor
        ? truecolorFg(86, 95, 137) // Tokyo Night muted
        : ANSI_COLORS.gray;
      banner += `\n${mutedColor}${versionLine}${RESET}`;
    } else {
      banner += `\n${versionLine}`;
    }
  }

  return banner;
}

/**
 * Get a banner optimized for the current terminal.
 *
 * This is the simplest API - just call it and get a banner.
 *
 * @returns Rendered banner string
 *
 * @example
 * ```typescript
 * console.log(getBannerForTerminal());
 * ```
 */
export function getBannerForTerminal(): string {
  return renderBanner();
}

/**
 * Get a banner for a specific terminal tier.
 *
 * Useful for testing or forcing a specific output level.
 *
 * @param tier - Terminal tier to render for
 * @param options - Additional banner options
 * @returns Rendered banner string
 */
export function getBannerForTier(tier: TerminalTier, options: BannerOptions = {}): string {
  let style: BannerStyle;
  let supportsUnicode = true;
  let useColors = true;

  switch (tier) {
    case "legacy_windows":
      style = "plain";
      supportsUnicode = false;
      useColors = false;
      break;
    case "basic_ansi":
      style = "plain";
      useColors = true;
      break;
    case "ansi_256":
      style = "gradient";
      break;
    case "truecolor":
    case "full_feature":
      style = "filled";
      break;
    default:
      style = "minimal";
  }

  // Allow style override
  if (options.style) {
    style = options.style;
  }

  const paletteName = options.palette || "openralph";
  const palette = PALETTES[paletteName] || PALETTES.openralph;

  let banner = getBannerArt(style, supportsUnicode);

  // Apply colors
  if (useColors && style !== "minimal") {
    switch (tier) {
      case "truecolor":
      case "full_feature":
        banner = applyHorizontalGradient(banner, palette);
        break;
      case "ansi_256":
        banner = apply256Color(banner, paletteName);
        break;
      case "basic_ansi":
        banner = applyBasicColor(banner, paletteName);
        break;
    }
  }

  // Add version if requested
  if (options.includeVersion && options.version) {
    banner += `\nv${options.version}`;
  }

  return banner;
}

/**
 * Get all available palette names.
 *
 * @returns Array of palette names
 */
export function getAvailablePalettes(): PaletteName[] {
  return Object.keys(PALETTES) as PaletteName[];
}

/**
 * Get all available banner styles.
 *
 * @returns Array of style names
 */
export function getAvailableStyles(): BannerStyle[] {
  return ["filled", "gradient", "plain", "minimal"];
}

/**
 * Check if banner should be displayed based on environment.
 *
 * @returns true if banner should be shown
 */
export function shouldShowBanner(): boolean {
  if (process.env.RALPH_BANNER_DISABLED === "1") {
    return false;
  }
  
  // Check for Windows Terminal - it supports colors and Unicode
  const isWindowsTerminal = !!process.env.WT_SESSION;
  const isModernWindowsConsole = !!process.env.ANSICON || !!process.env.ConEmuANSI;
  
  // Show banner in Windows Terminal even if isTTY is undefined
  if (isWindowsTerminal || isModernWindowsConsole) {
    return true;
  }
  
  return true;
}

/**
 * Render result with full metadata (for advanced usage).
 *
 * @param options - Banner options
 * @returns Full render result with metadata
 */
export function renderBannerWithMetadata(options: BannerOptions = {}): RenderResult {
  const startTime = performance.now();
  const caps = getCapabilities();

  const useColors = options.colors ?? (caps.supportsColor && !process.env.NO_COLOR);
  const style = options.style || determineBestStyle(caps);
  const output = renderBanner({ ...options, style });

  return {
    output,
    tier: caps.tier,
    style,
    hasColors: useColors,
    hasUnicode: caps.supportsUnicode,
    renderTimeMs: performance.now() - startTime,
  };
}

// =============================================================================
// Exports for Testing
// =============================================================================

export const _internals = {
  FILLED_BANNER,
  SIMPLE_BANNER,
  PLAIN_BANNER,
  MINIMAL_BANNER,
  hexToRgb,
  interpolateColor,
  applyHorizontalGradient,
  applyVerticalGradient,
  apply256Color,
  applyBasicColor,
  determineBestStyle,
  getBannerArt,
};
