/**
 * Tool category classification for visualization.
 */
export type ToolCategory = 
  | 'file'        // read, write, edit, glob
  | 'search'      // grep, codesearch, websearch
  | 'execute'     // bash, run
  | 'web'         // webfetch, websearch
  | 'planning'    // task, todowrite, todoread
  | 'reasoning'   // thought, analyze
  | 'system'      // lsp, config
  | 'mcp'         // MCP server tools (e.g., tavily_search, context7_query-docs)
  | 'custom';     // user-defined tools

/**
 * Tool classification with display metadata.
 */
export interface ToolClassification {
  category: ToolCategory;
  displayName: string;
  description: string;
  color: string;        // Theme key or hex
  icon: string;         // Primary icon (Nerd Font)
  fallbackIcon: string; // ASCII/text fallback
  animated: boolean;    // Can show execution animation
  verboseDefault: boolean;
}

/**
 * All known tool classifications.
 */
export const TOOL_CLASSIFICATIONS: Record<string, ToolClassification> = {
  read: {
    category: 'file',
    displayName: 'Read',
    description: 'Read file contents',
    color: 'info',
    icon: '󰈞',  // Nerd Font file-search
    fallbackIcon: '[READ]',
    animated: false,
    verboseDefault: true,
  },
  write: {
    category: 'file',
    displayName: 'Write',
    description: 'Create or overwrite files',
    color: 'success',
    icon: '󰏫',  // Nerd Font file-plus
    fallbackIcon: '[WRITE]',
    animated: true,
    verboseDefault: false,
  },
  edit: {
    category: 'file',
    displayName: 'Edit',
    description: 'Modify file contents',
    color: 'success',
    icon: '󰛓',  // Nerd Font file-edit
    fallbackIcon: '[EDIT]',
    animated: true,
    verboseDefault: false,
  },
  glob: {
    category: 'file',
    displayName: 'Glob',
    description: 'Find files by pattern',
    color: 'warning',
    icon: '',   // Nerd Font folder-search
    fallbackIcon: '[GLOB]',
    animated: false,
    verboseDefault: true,
  },
  grep: {
    category: 'search',
    displayName: 'Grep',
    description: 'Search file contents',
    color: 'warning',
    icon: '󰱽',  // Nerd Font search
    fallbackIcon: '[GREP]',
    animated: false,
    verboseDefault: true,
  },
  codesearch: {
    category: 'search',
    displayName: 'CodeSearch',
    description: 'Search code across repositories',
    color: 'secondary',
    icon: '󰖟',  // Nerd Font search-web
    fallbackIcon: '[CODE]',
    animated: false,
    verboseDefault: true,
  },
  websearch: {
    category: 'web',
    displayName: 'WebSearch',
    description: 'Search the web',
    color: 'secondary',
    icon: '󰖟',
    fallbackIcon: '[WEB]',
    animated: true,
    verboseDefault: false,
  },
  webfetch: {
    category: 'web',
    displayName: 'WebFetch',
    description: 'Fetch web content',
    color: 'secondary',
    icon: '󰖟',
    fallbackIcon: '[FETCH]',
    animated: true,
    verboseDefault: false,
  },
  bash: {
    category: 'execute',
    displayName: 'Bash',
    description: 'Execute shell commands',
    color: 'textMuted',
    icon: '󱆃',  // Nerd Font terminal
    fallbackIcon: '[BASH]',
    animated: true,
    verboseDefault: true,
  },
  task: {
    category: 'planning',
    displayName: 'Task',
    description: 'Task delegation',
    color: 'accent',
    icon: '󰙨',  // Nerd Font task
    fallbackIcon: '[TASK]',
    animated: false,
    verboseDefault: false,
  },
  todowrite: {
    category: 'planning',
    displayName: 'TodoWrite',
    description: 'Update task list',
    color: 'text',
    icon: '󰗡',  // Nerd Font check-all
    fallbackIcon: '[TODO]',
    animated: false,
    verboseDefault: false,
  },
  todoread: {
    category: 'planning',
    displayName: 'TodoRead',
    description: 'Read task list',
    color: 'text',
    icon: '󰗡',
    fallbackIcon: '[TODO]',
    animated: false,
    verboseDefault: true,
  },
  thought: {
    category: 'reasoning',
    displayName: 'Thought',
    description: 'Reasoning/思考',
    color: 'warning',
    icon: '󰋚',  // Nerd Font brain
    fallbackIcon: '[THINK]',
    animated: true,
    verboseDefault: true,
  },
  lsp: {
    category: 'system',
    displayName: 'LSP',
    description: 'Language server operations',
    color: 'textMuted',
    icon: '󰅥',  // Nerd Font symbol-method
    fallbackIcon: '[LSP]',
    animated: false,
    verboseDefault: true,
  },
};

/**
 * Check if a tool name follows the MCP naming convention.
 * MCP tools are named as: serverName_toolName (e.g., tavily_search, context7_query-docs)
 * 
 * @param toolName - The tool name to check
 * @returns Object with isMcp flag and parsed server/tool names if it's an MCP tool
 */
export function parseMcpToolName(toolName: string): {
  isMcp: boolean;
  serverName?: string;
  actionName?: string;
  serverDisplayName?: string;
} {
  // MCP tools follow the pattern: serverName_actionName
  // The serverName is alphanumeric (sanitized), and actionName can have dashes
  const match = toolName.match(/^([a-zA-Z][a-zA-Z0-9]*)_([a-zA-Z0-9_-]+)$/);
  
  if (!match) {
    return { isMcp: false };
  }

  const serverName = match[1].toLowerCase();
  const actionName = match[2];

  return {
    isMcp: true,
    serverName,
    actionName,
    serverDisplayName: capitalizeFirst(serverName),
  };
}

/**
 * Capitalize the first letter of a string.
 */
function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Format a tool action name for display.
 * Converts snake_case and kebab-case to Title Case.
 */
function formatActionName(actionName: string): string {
  return actionName
    .split(/[-_]/)
    .map(word => capitalizeFirst(word))
    .join(' ');
}

/**
 * Get classification for a tool by name.
 * Handles built-in tools, MCP tools, and custom tools.
 */
export function getToolClassification(toolName: string): ToolClassification {
  const normalized = toolName.toLowerCase();
  
  // Check for built-in tool first
  const builtIn = TOOL_CLASSIFICATIONS[normalized];
  if (builtIn) {
    return builtIn;
  }

  // Check if it's an MCP tool
  const mcpInfo = parseMcpToolName(toolName);
  if (mcpInfo.isMcp) {
    const displayName = `${mcpInfo.serverDisplayName}: ${formatActionName(mcpInfo.actionName!)}`;
    return {
      category: 'mcp',
      displayName,
      description: `MCP tool from ${mcpInfo.serverDisplayName}`,
      color: 'toolMcp',
      icon: '󰌘',  // Nerd Font plug/connection icon
      fallbackIcon: `[${mcpInfo.serverDisplayName?.toUpperCase()}]`,
      animated: true,
      verboseDefault: false,
    };
  }

  // Fallback to custom tool
  return {
    category: 'custom',
    displayName: toolName,
    description: 'Custom tool',
    color: 'text',
    icon: '󰏗',  // Nerd Font package icon (better than box)
    fallbackIcon: `[${toolName.toUpperCase()}]`,
    animated: false,
    verboseDefault: false,
  };
}
