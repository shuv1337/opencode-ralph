import type { HeadlessEvent, HeadlessFormatter, HeadlessSummary } from "../headless/types";
import {
  createTextRenderer,
  type TextRenderer,
  type TextRenderMode,
  detectRenderMode,
  colorize,
  type SessionStats,
} from "../lib/text-renderer";

/**
 * Options for creating a text formatter.
 */
export type TextFormatterOptions = {
  timestamps: boolean;
  write?: (text: string) => void;
  /** Optional pre-configured text renderer */
  textRenderer?: TextRenderer;
};

/**
 * Tool name to color mapping for semantic highlighting.
 * Each major tool has a DISTINCT color for easy visual identification.
 * 
 * Color palette:
 * - read: teal (file reading)
 * - write: lime (file creation)
 * - edit: gold (file modification)
 * - bash: coral (command execution)
 * - glob: yellow (file finding)
 * - grep: magenta (content searching)
 * - task/todo: violet (task management)
 * - thought: warning/orange (reasoning)
 * - lsp: textMuted (background tool)
 * - web tools: sky (external resources)
 * - github: secondary/purple (version control)
 * - mcp: primary/blue (plugins)
 */
const TOOL_COLORS: Record<string, "info" | "success" | "warning" | "error" | "primary" | "secondary" | "textMuted" | "yellow" | "magenta" | "teal" | "lime" | "coral" | "sky" | "violet" | "gold"> = {
  // File operations - each distinct
  read: "teal",        // Teal - reading files
  write: "lime",       // Lime green - creating files
  edit: "gold",        // Gold - modifying files
  
  // Execution - stands out
  bash: "coral",       // Coral/salmon - command execution
  
  // Search operations - distinct from each other
  glob: "yellow",      // Yellow - finding files by pattern
  grep: "magenta",     // Magenta - searching content
  codesearch: "violet", // Violet - code-specific search
  
  // Task management - grouped
  task: "violet",
  todowrite: "violet",
  todoread: "violet",
  
  // Thinking/reasoning
  thought: "warning",  // Orange - thinking/reasoning
  
  // Code intelligence
  lsp: "textMuted",    // Gray - background tool
  
  // Web/external resources - grouped by purpose
  websearch: "sky",    // Sky blue - web search
  webfetch: "sky",     // Sky blue - web fetch
  tavily: "info",      // Cyan - Tavily search
  context7: "info",    // Cyan - Context7 docs
  exa: "info",         // Cyan - Exa search
  brave: "sky",        // Sky blue - Brave search
  
  // Version control
  gh: "secondary",     // Purple - GitHub
  github: "secondary", // Purple - GitHub
  
  // Plugin/MCP tools
  mcp: "primary",      // Blue - MCP plugins
  skill: "primary",    // Blue - Skills
  
  // Status indicators
  error: "error",
  success: "success",
  running: "primary",
  custom: "textMuted",
};

/**
 * Format timestamp as ISO string.
 */
const formatTimestamp = (timestamp: number): string => {
  return new Date(timestamp).toISOString();
};

/**
 * Human-readable display names for tools.
 * Maps internal tool identifiers to user-friendly names.
 */
const TOOL_DISPLAY_NAMES: Record<string, string> = {
  read: "Read",
  write: "Write",
  edit: "Edit",
  bash: "Bash",
  glob: "Glob",
  grep: "Grep",
  task: "Task",
  todowrite: "TodoWrite",
  todoread: "TodoRead",
  thought: "Thinking",
  lsp: "LSP",
  websearch: "Web Search",
  webfetch: "Web Fetch",
  codesearch: "Code Search",
  mcp: "MCP Tool",
  tavily: "Tavily",
  context7: "Context7",
  exa: "Exa",
  gh: "GitHub",
  github: "GitHub",
  brave: "Brave",
  skill: "Skill",
  custom: "Tool",
};

/**
 * Format a tool name for human-readable display.
 * 
 * @param toolName - Internal tool identifier (e.g., "read", "tavily_search")
 * @returns Human-readable display name (e.g., "Read", "Tavily Search")
 */
function formatToolDisplayName(toolName: string): string {
  const normalized = toolName.toLowerCase();
  
  // Check for MCP tool pattern (server_tool format like "tavily_search")
  const mcpMatch = normalized.match(/^(\w+)_(\w+)$/);
  if (mcpMatch) {
    const [, serverName, actionName] = mcpMatch;
    // Get server display name or capitalize first letter
    const serverDisplay = TOOL_DISPLAY_NAMES[serverName] ?? 
      serverName.charAt(0).toUpperCase() + serverName.slice(1);
    // Capitalize action name and replace underscores with spaces
    const actionDisplay = actionName
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    return `${serverDisplay} ${actionDisplay}`;
  }
  
  // Direct lookup or capitalize first letter
  return TOOL_DISPLAY_NAMES[normalized] ?? 
    toolName.charAt(0).toUpperCase() + toolName.slice(1);
}

/**
 * Create a text formatter for headless output.
 * 
 * Uses the text renderer from lib/text-renderer.ts for consistent formatting
 * across all text-based output modes.
 * 
 * @param options - Formatter configuration
 * @returns HeadlessFormatter implementation
 */
export function createTextFormatter(options: TextFormatterOptions): HeadlessFormatter {
  const write = options.write ?? ((text: string) => process.stdout.write(text));
  
  // Use provided text renderer or create a new one
  const renderer = options.textRenderer ?? createTextRenderer();
  const mode = renderer.getMode();

  // Track state to suppress repetitive emissions
  // Model is only emitted once (at start or on change)
  let lastModel: string | undefined;
  // Token stats are accumulated and shown only in the footer
  let accumulatedTokens = { input: 0, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0 };
  // Deduplicate error messages within a short window
  let lastErrorMessage: string | undefined;
  let lastErrorTime = 0;
  const ERROR_DEDUP_WINDOW_MS = 1000; // 1 second window for deduplication

  const lineWithTimestamp = (event: HeadlessEvent, line: string): string => {
    if (!options.timestamps || !event.timestamp) {
      return line;
    }
    return `[${formatTimestamp(event.timestamp)}] ${line}`;
  };

  const emit = (event: HeadlessEvent): void => {
    let line = "";
    
    switch (event.type) {
      case "start":
        line = renderer.renderHeader("RALPH - AI Coding Agent");
        break;
        
      case "iteration_start":
        line = "\n" + renderer.renderSeparator(`Iteration ${event.iteration}`);
        break;
        
      case "iteration_end":
        line = colorize(
          `[*] Iteration ${event.iteration} complete`,
          "success",
          { mode }
        ) + colorize(
          ` | ${event.durationMs}ms | ${event.commits} commit${event.commits !== 1 ? "s" : ""}`,
          "text",
          { mode }
        );
        break;
        
      case "tool": {
        const toolIcon = renderer.renderToolIcon(event.name);
        const colorKey = TOOL_COLORS[event.name.toLowerCase()] ?? "textMuted";
        
        // Human-readable tool name with proper color coding
        const toolDisplayName = formatToolDisplayName(event.name);
        const coloredToolName = colorize(toolDisplayName, colorKey, { mode });
        
        const detail = event.detail 
          ? ` ${colorize(event.detail, "textMuted", { dim: true, mode })}` 
          : "";
        
        // Format: [ICON] ToolName: title detail (or just [ICON] ToolName if no title)
        const title = event.title || "";
        line = title 
          ? `${toolIcon} ${coloredToolName}: ${title}${detail}`
          : `${toolIcon} ${coloredToolName}${detail}`;
        break;
      }
        
      case "reasoning": {
        const thoughtIcon = renderer.renderToolIcon("thought");
        line = `${thoughtIcon} ${colorize(event.text, "text", { dim: true, mode })}`;
        break;
      }
        
      case "output":
        // Raw output, write directly without processing
        write(event.data);
        return;
        
      case "progress":
        line = renderer.renderProgress(event.done, event.total);
        break;
        
      case "stats":
        line = colorize("[>] Stats:", "info", { mode }) + 
          colorize(` ${event.commits} commit${event.commits !== 1 ? "s" : ""}`, "text", { mode }) +
          colorize(` +${event.linesAdded}`, "success", { mode }) +
          colorize(` -${event.linesRemoved}`, "error", { mode });
        break;
        
      case "pause":
        line = renderer.renderStatus("paused");
        break;
        
      case "resume":
        line = renderer.renderStatus("running");
        break;
        
      case "idle":
        line = event.isIdle 
          ? colorize("[||] Waiting for input...", "warning", { mode })
          : colorize("[>] Processing...", "info", { mode });
        break;
        
      case "error":
        // Deduplicate identical errors within a short window
        const now = Date.now();
        if (event.message === lastErrorMessage && (now - lastErrorTime) < ERROR_DEDUP_WINDOW_MS) {
          return; // Suppress duplicate error
        }
        lastErrorMessage = event.message;
        lastErrorTime = now;
        line = `${renderer.renderOutcome("error")} ${colorize(event.message, "error", { mode })}`;
        break;
        
      case "complete":
        // Complete event marks completion; actual summary in finalize
        line = renderer.renderOutcome("success") + " " + colorize("[DONE]", "success", { bold: true, mode });
        break;
        
      case "model":
        // Only emit model info when it changes, not on every occurrence
        if (event.model !== lastModel) {
          lastModel = event.model;
          // Model uses cyan (info) for the value, bold dim for the label
          const modelLabel = colorize("Model:", "text", { bold: true, dim: true, mode });
          const modelValue = colorize(event.model, "info", { mode });
          line = `${modelLabel} ${modelValue}`;
        } else {
          // Suppress duplicate model emissions
          return;
        }
        break;
        
      case "sandbox":
        // Sandbox uses yellow for values, bold dim for labels
        const sandboxLabel = colorize("sandbox:", "text", { bold: true, dim: true, mode });
        const sandboxEnabled = colorize(
          event.enabled ? "enabled" : "disabled",
          event.enabled ? "success" : "textMuted",
          { mode }
        );
        const sandboxMode = colorize(event.mode ?? "unknown", "yellow", { mode });
        line = `${sandboxLabel} ${sandboxEnabled} mode=${sandboxMode}`;
        break;
        
      case "rate_limit":
        // Rate limit uses warning color, bold dim for labels
        const rateLimitLabel = colorize("rate_limit:", "text", { bold: true, dim: true, mode });
        const fallbackValue = colorize(event.fallbackAgent, "warning", { mode });
        line = `${rateLimitLabel} fallback=${fallbackValue}`;
        break;
        
      case "active_agent":
        // Agent uses green for the value, bold dim for labels
        const agentLabel = colorize("agent:", "text", { bold: true, dim: true, mode });
        const agentPlugin = colorize(event.plugin, "success", { mode });
        const agentReason = colorize(`(${event.reason})`, "textMuted", { dim: true, mode });
        line = `${agentLabel} ${agentPlugin} ${agentReason}`;
        break;
        
      case "tokens":
        // Accumulate token usage for the footer summary instead of spamming per-line
        // This reduces visual noise while still tracking total usage
        accumulatedTokens.input += event.input;
        accumulatedTokens.output += event.output;
        accumulatedTokens.reasoning += event.reasoning;
        accumulatedTokens.cacheRead += event.cacheRead ?? 0;
        accumulatedTokens.cacheWrite += event.cacheWrite ?? 0;
        // Suppress per-line token output - will be shown in footer
        return;
        
      case "backoff":
        line = colorize(
          `backoff: ${event.backoffMs}ms, retry at ${new Date(event.retryAt).toISOString()}`,
          "warning",
          { mode }
        );
        break;
        
      case "backoff_cleared":
        line = colorize("backoff cleared, retrying...", "info", { mode });
        break;
        
      case "session":
        // Session uses secondary (purple) for the session ID, bold dim for labels
        const sessionLabel = colorize(`session ${event.action}:`, "text", { bold: true, dim: true, mode });
        const sessionId = colorize(event.sessionId, "secondary", { mode });
        line = `${sessionLabel} ${sessionId}`;
        break;
        
      case "prompt":
        // Prompt events are typically verbose/debug
        line = colorize("[PROMPT] " + event.prompt.substring(0, 100) + "...", "textMuted", { dim: true, mode });
        break;
        
      case "plan_modified": {
        const icon = renderer.renderToolIcon("task");
        line = `${icon} ${colorize("Plan", "violet", { mode })}: modified`;
        break;
      }
        
      case "adapter_mode":
        // Adapter mode uses magenta for the value, bold dim for labels
        const adapterLabel = colorize("adapter mode:", "text", { bold: true, dim: true, mode });
        const adapterValue = colorize(event.mode, "magenta", { mode });
        line = `${adapterLabel} ${adapterValue}`;
        break;
        
      default:
        // Unknown event type - skip
        return;
    }

    if (!line) return;

    write(lineWithTimestamp(event, line) + "\n");
  };

  const finalize = (summary: HeadlessSummary): void => {
    // Convert HeadlessSummary to SessionStats format
    const stats: SessionStats = {
      iterations: 0, // Not tracked in summary
      commits: summary.commits,
      linesAdded: summary.linesAdded,
      linesRemoved: summary.linesRemoved,
      tasksComplete: summary.tasksComplete,
      totalTasks: summary.totalTasks,
      durationMs: summary.durationMs,
      exitCode: summary.exitCode,
    };
    
    const footer = renderer.renderFooter(stats);
    write(footer + "\n");
    
    // Display accumulated token usage in the footer (consolidated, not per-line)
    const hasTokens = accumulatedTokens.input > 0 || accumulatedTokens.output > 0;
    if (hasTokens) {
      const tokenLine = colorize(
        `Tokens: in=${accumulatedTokens.input} out=${accumulatedTokens.output} reasoning=${accumulatedTokens.reasoning}`,
        "textMuted",
        { mode }
      );
      write(tokenLine + "\n");
    }
    
    // Display model info if captured (shown once in footer, not per-line)
    if (lastModel) {
      const modelLine = colorize(`Model: ${lastModel}`, "textMuted", { mode });
      write(modelLine + "\n");
    }
  };

  return { emit, finalize };
}

// Re-export TextRenderMode for backward compatibility
export type { TextRenderMode };
