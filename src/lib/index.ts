/**
 * Library Module Barrel Export
 * 
 * Re-exports all public APIs from the lib directory for convenient importing.
 * 
 * @example
 * ```typescript
 * import {
 *   getCapabilities,
 *   renderBanner,
 *   createTextRenderer,
 *   cleanupProcess,
 * } from './lib';
 * ```
 * 
 * @version 1.0.0
 */

// =============================================================================
// Terminal Capabilities
// =============================================================================

export {
  detectCapabilities,
  detectTerminalCapabilities,
  getCapabilities,
  resetCapabilitiesCache,
  hasColorSupport,
  getTerminalDescription,
} from "./terminal-capabilities";

export type {
  CapabilityLevel,
  TerminalTier,
  TerminalCapabilities,
} from "./terminal-capabilities";

// =============================================================================
// ASCII Banner
// =============================================================================

export {
  renderBanner,
  getBannerForTerminal,
  getBannerForTier,
  getAvailablePalettes,
  getAvailableStyles,
  shouldShowBanner,
  renderBannerWithMetadata,
  PALETTES,
} from "./ascii-banner";

export type {
  BannerStyle,
  PaletteName,
  BannerPalette,
  BannerOptions,
  RenderResult,
} from "./ascii-banner";

// =============================================================================
// Text Renderer
// =============================================================================

export {
  createTextRenderer,
  getTextRenderer,
  resetTextRenderer,
  detectRenderMode,
  shouldDisableColors,
  colorize,
  ANSI_COLORS,
  TOOL_TEXT_MAP,
  TOOL_UNICODE_MAP,
  STATUS_TEXT_MAP,
  STATUS_UNICODE_MAP,
  STATUS_COLOR_MAP,
  TASK_STATUS_TEXT_MAP,
  TASK_STATUS_UNICODE_MAP,
  TASK_STATUS_COLOR_MAP,
  EVENT_TEXT_MAP,
  EVENT_UNICODE_MAP,
  EVENT_COLOR_MAP,
  OUTCOME_TEXT_MAP,
  OUTCOME_UNICODE_MAP,
  OUTCOME_COLOR_MAP,
} from "./text-renderer";

export type {
  TextRenderMode,
  RalphStatus,
  TaskStatus,
  ActivityEventType,
  OutcomeType,
  LogEntry,
  SessionStats,
  AsciiSymbolOverrides,
  TextRendererOptions,
  TextRenderer,
} from "./text-renderer";

// =============================================================================
// Process Cleanup
// =============================================================================

export {
  // Cleanup functions
  cleanupProcess,
  cleanupProcessTree,
  cleanupAllSessions,
  forceTerminateDescendants,
  killRegisteredProcesses,
  killProcess,
  
  // Process registry
  registerSpawnedProcess,
  unregisterSpawnedProcess,
  getRegisteredProcesses,
  clearProcessRegistry,
  
  // Port-based process finding
  findProcessByPort,
  findAndRegisterProcessByPort,
  
  // Process state checks
  isProcessRunning,
  
  // Signal handlers
  registerCleanupHandler,
  registerSessionCleanup,
} from "./process-cleanup";

export type {
  ProcessCleanupOptions,
  CleanupResult,
} from "./process-cleanup";

// =============================================================================
// Icon Fallback
// =============================================================================

export {
  getIconStyle,
  getIcon,
  getToolIcon,
  getToolIconWithFallback,
  getCategoryIconSet,
  ICON_SETS,
} from "./icon-fallback";

export type {
  IconStyle,
  IconSet,
} from "./icon-fallback";

// =============================================================================
// Logging
// =============================================================================

export {
  log,
  initLog,
  stopMemoryLogging,
  logMemory,
  setVerbose,
  checkMemoryThreshold,
} from "./log";

// =============================================================================
// Error Handling
// =============================================================================

export {
  ErrorHandler,
} from "./error-handler";

export type {
  ErrorContext,
} from "./error-handler";

// =============================================================================
// ANSI Utilities
// =============================================================================

export {
  stripAnsiCodes,
} from "./ansi";

// =============================================================================
// Lock Management
// =============================================================================

export {
  SessionLock,
  LOCK_FILE,
} from "./lock";

// =============================================================================
// Interrupt Handling
// =============================================================================

export {
  InterruptHandler,
} from "./interrupt";

// =============================================================================
// Rate Limiting
// =============================================================================

export {
  rateLimitDetector,
  getFallbackAgent,
} from "./rate-limit";

// =============================================================================
// Task Deduplication
// =============================================================================

export {
  isRedundantTask,
} from "./task-deduplication";
