import { existsSync, mkdirSync } from "fs";
import { dirname, extname, join } from "path";
import { parsePrdItems, type PrdItem } from "./plan";
import { PLUGIN_TEMPLATE } from "./templates/plugin-template";
import { AGENTS_TEMPLATE } from "./templates/agents-template";
import { parseMarkdownPlan } from "./lib/markdown-plan-parser";
import type { TaskStatus } from "./types/task-status";

// Re-export for backwards compatibility
export {
  GENERATED_PLUGIN_MARKER,
  isGeneratedPlugin,
} from "./templates/plugin-template";
export {
  GENERATED_AGENTS_MARKER,
  isGeneratedAgents,
} from "./templates/agents-template";

/**
 * Default files protected by the write-guardrail plugin.
 */
export const DEFAULT_PROTECTED_FILES = [
  "prd.json",
  "progress.txt",
  ".ralph-prompt.md",
  "AGENTS.md",
] as const;

/**
 * Entries to add to .gitignore for Ralph-specific files.
 * These are runtime files that should not be committed.
 */
export const GITIGNORE_ENTRIES = [
  ".ralph*",
  ".opencode/plugin/ralph-write-guardrail.ts",
] as const;

/**
 * Header comment for the Ralph gitignore section.
 */
export const GITIGNORE_HEADER = "# Ralph - AI agent loop files";

/**
 * The complete gitignore block including header and entries.
 */
export function buildGitignoreBlock(): string {
  return `${GITIGNORE_HEADER}\n${GITIGNORE_ENTRIES.join("\n")}\n`;
}

export type InitOptions = {
  planFile: string;
  progressFile: string;
  promptFile: string;
  pluginFile: string;
  agentsFile: string;
  gitignoreFile: string;
  from?: string;
  force?: boolean;
};

export type InitResult = {
  created: string[];
  skipped: string[];
  warnings: string[];
  gitignoreAppended?: boolean;
  /** Files that were normalized (format fixed) */
  normalized?: string[];
  /** Number of items normalized in the PRD */
  normalizedItemCount?: number;
};

/**
 * Metadata for generated PRD files.
 * Indicates the file was created by a PRD generator and is safe to remove with `ralph --reset`.
 */
export type PrdMetadata = {
  generated: true;
  /** Generator identifier (e.g., "ralph-init", "ralph-plan-command", or custom) */
  generator: string;
  createdAt: string;
  sourceFile?: string;
};

/**
 * Extended metadata from PRD generators.
 * These fields provide additional context about the PRD.
 */
export type ExtendedPrdMetadata = {
  generated?: boolean;
  generator?: string;
  createdAt?: string;
  sourceFile?: string;
  /** Title of the PRD/plan */
  title?: string;
  /** Summary description of the PRD */
  summary?: string;
  /** List of assumptions made during planning */
  assumptions?: string[];
  /** High-level approach description */
  approach?: string;
  /** Risk assessments */
  risks?: Array<{
    risk: string;
    likelihood: string;
    impact: string;
    mitigation: string;
  }>;
  /** Estimated effort (e.g., "3-5 days") */
  estimatedEffort?: string;
  /** Total number of tasks */
  totalTasks?: number;
};

/**
 * Wrapper format for generated PRD files.
 * User-created PRD files can be plain arrays; generated ones use this wrapper.
 */
export type GeneratedPrd = {
  metadata: PrdMetadata;
  items: PrdItem[];
};

/**
 * Check if a PRD file was generated (has metadata wrapper with generated: true).
 * Accepts any generator value to allow custom PRD generation tools.
 */
export function isGeneratedPrd(content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed.startsWith("{")) return false;
  try {
    const parsed = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== "object") {
      return false;
    }
    // Accept any PRD with generated: true and a non-empty generator string
    return (
      parsed.metadata?.generated === true &&
      typeof parsed.metadata?.generator === "string" &&
      parsed.metadata.generator.length > 0
    );
  } catch {
    return false;
  }
}

/**
 * Parse extended metadata from a PRD file.
 * Returns null if the file doesn't have metadata or isn't valid JSON.
 */
export function parsePrdMetadata(content: string): ExtendedPrdMetadata | null {
  const trimmed = content.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== "object" || !parsed.metadata) {
      return null;
    }
    const meta = parsed.metadata;
    return {
      generated: meta.generated,
      generator: meta.generator,
      createdAt: meta.createdAt,
      sourceFile: meta.sourceFile,
      title: meta.title,
      summary: meta.summary,
      assumptions: Array.isArray(meta.assumptions) ? meta.assumptions : undefined,
      approach: meta.approach,
      risks: Array.isArray(meta.risks) ? meta.risks : undefined,
      estimatedEffort: meta.estimatedEffort,
      totalTasks: typeof meta.totalTasks === "number" ? meta.totalTasks : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Normalize a PRD item to ensure it has a `passes` field.
 * Derives `passes` from `status` if missing:
 * - status: "done" → passes: true
 * - any other status or missing → passes: false
 */
function normalizeItem(item: Record<string, unknown>): Record<string, unknown> {
  // If passes is already a boolean, return as-is
  if (typeof item.passes === "boolean") {
    return item;
  }

  // Derive passes from status
  const status = item.status as string | undefined;
  const passes = status === "done";

  return { ...item, passes };
}

/**
 * Normalize items array to ensure all items have required fields.
 * Returns the normalized items array.
 */
function normalizeItems(items: unknown[]): unknown[] {
  return items.map((item) => {
    if (item && typeof item === "object") {
      return normalizeItem(item as Record<string, unknown>);
    }
    return item;
  });
}

/**
 * Result of PRD normalization.
 */
export type NormalizePrdResult = {
  /** Whether the file was modified */
  modified: boolean;
  /** Number of items that were normalized */
  normalizedCount: number;
  /** Warning messages */
  warnings: string[];
};

/**
 * Normalize an existing prd.json file to ensure all items have required fields.
 * This is called during `ralph init` when prd.json already exists.
 * 
 * Fixes:
 * - Items missing `passes` field (derived from `status`)
 * - Items with `status: "done"` but no `passes` → adds `passes: true`
 * - Items with other/no status but no `passes` → adds `passes: false`
 * 
 * @param prdPath - Path to the prd.json file
 * @returns NormalizePrdResult with modification status
 */
export async function normalizePrdFile(prdPath: string): Promise<NormalizePrdResult> {
  const result: NormalizePrdResult = {
    modified: false,
    normalizedCount: 0,
    warnings: [],
  };

  const file = Bun.file(prdPath);
  if (!(await file.exists())) {
    return result;
  }

  const content = await file.text();
  const trimmed = content.trim();

  // Only process JSON files
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return result;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    result.warnings.push("Failed to parse prd.json - invalid JSON syntax.");
    return result;
  }

  // Get items array from parsed content
  let items: unknown[] | null = null;
  let isArrayFormat = false;

  if (Array.isArray(parsed)) {
    items = parsed;
    isArrayFormat = true;
  } else if (parsed && typeof parsed === "object" && Array.isArray((parsed as { items?: unknown }).items)) {
    items = (parsed as { items: unknown[] }).items;
  }

  if (!items || items.length === 0) {
    return result;
  }

  // Count items that need normalization (missing passes field)
  const itemsNeedingFix = items.filter((item) => {
    if (!item || typeof item !== "object") return false;
    const candidate = item as Record<string, unknown>;
    return typeof candidate.passes !== "boolean";
  });

  if (itemsNeedingFix.length === 0) {
    // All items already have passes field
    return result;
  }

  // Normalize items
  const normalizedItems = normalizeItems(items);
  result.normalizedCount = itemsNeedingFix.length;
  result.modified = true;

  // Reconstruct the JSON with normalized items
  let output: unknown;
  if (isArrayFormat) {
    output = normalizedItems;
  } else {
    output = { ...(parsed as object), items: normalizedItems };
  }

  // Write back the normalized file
  await Bun.write(prdPath, JSON.stringify(output, null, 2) + "\n");

  return result;
}

/**
 * Check if a prompt file was generated by ralph init (has frontmatter marker).
 */
export function isGeneratedPrompt(content: string): boolean {
  return content.startsWith("---\ngenerated: true\n");
}

/**
 * Check if a progress file was generated by ralph init.
 * Uses the "Initialized via ralph init" line as the marker.
 */
export function isGeneratedProgress(content: string): boolean {
  return content.includes("- Notes: Initialized via ralph init.");
}

const DEFAULT_CATEGORY = "functional";
const DEFAULT_ACCEPTANCE_CRITERIA = "Add acceptance criteria for this item.";

/**
 * Frontmatter marker for generated prompt files.
 * This marker indicates the file was created by `ralph init` and is safe to remove with `ralph --reset`.
 */
export const GENERATED_PROMPT_MARKER = `---
generated: true
generator: ralph-init
safe_to_delete: true
---
`;

const PROMPT_TEMPLATE = `${GENERATED_PROMPT_MARKER}READ all of {{PLAN_FILE}} and {{PROGRESS_FILE}}.
Pick ONE task with passes=false (prefer highest-risk/highest-impact).
Keep changes small: one logical change per commit.
Update {{PLAN_FILE}} by setting passes=true and adding notes or acceptanceCriteria as needed.
Append a brief entry to {{PROGRESS_FILE}} with what changed and why.
Run feedback loops before committing:
- bun run typecheck
- bun test
- bun run lint (if missing, note in {{PROGRESS_FILE}} and continue)
Commit the change (include {{PLAN_FILE}} updates).
ONLY do one task unless GLARINGLY OBVIOUS acceptanceCriteria should run together.
Quality bar: production code, maintainable, tests when appropriate.
If you learn a critical operational detail, update AGENTS.md.
When ALL tasks complete, create .ralph-done and output <promise>COMPLETE</promise>.
NEVER GIT PUSH. ONLY COMMIT.
`;

function isMarkdownPath(path: string): boolean {
  const ext = extname(path).toLowerCase();
  return ext === ".md" || ext === ".markdown" || ext === ".mdx";
}

function resolvePlanTarget(planFile: string): { planFile: string; warning?: string } {
  if (!isMarkdownPath(planFile)) {
    return { planFile };
  }

  const target = join(dirname(planFile), "prd.json");
  return {
    planFile: target,
    warning: `Preserving markdown plan "${planFile}" and writing PRD JSON to "${target}".`,
  };
}

function ensureParentDir(path: string): void {
  const dir = dirname(path);
  if (dir === "." || dir === "/") return;
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Parse gitignore content into a set of entries (excluding comments and blank lines).
 */
function parseGitignoreEntries(content: string): Set<string> {
  const entries = new Set<string>();
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    // Skip comments and blank lines
    if (!trimmed || trimmed.startsWith("#")) continue;
    entries.add(trimmed);
  }
  return entries;
}

/**
 * Update .gitignore with Ralph-specific entries.
 * Creates the file if it doesn't exist, or appends missing entries if it does.
 * 
 * @returns "created" if new file was created, "appended" if entries were added,
 *          "skipped" if all entries already present
 */
async function updateGitignore(
  gitignorePath: string,
  result: InitResult
): Promise<void> {
  const file = Bun.file(gitignorePath);
  const exists = await file.exists();

  if (!exists) {
    // Create new .gitignore with Ralph entries
    ensureParentDir(gitignorePath);
    await Bun.write(gitignorePath, buildGitignoreBlock());
    result.created.push(gitignorePath);
    return;
  }

  // Read existing content
  const content = await file.text();
  const existingEntries = parseGitignoreEntries(content);

  // Find entries that need to be added
  const missingEntries = GITIGNORE_ENTRIES.filter(
    (entry) => !existingEntries.has(entry)
  );

  if (missingEntries.length === 0) {
    // All entries already present
    result.skipped.push(gitignorePath);
    return;
  }

  // Append missing entries with header
  // Ensure file ends with newline before appending
  const hasTrailingNewline = content.endsWith("\n");
  const prefix = hasTrailingNewline ? "\n" : "\n\n";
  const block = `${prefix}${GITIGNORE_HEADER}\n${missingEntries.join("\n")}\n`;

  await Bun.write(gitignorePath, content + block);
  result.gitignoreAppended = true;
  result.created.push(gitignorePath);
}

type ExtractedTask = {
  description: string;
  passes: boolean;
  category?: string;
};

function extractTasksFromText(content: string): ExtractedTask[] {
  const tasks: ExtractedTask[] = [];
  let inCodeBlock = false;

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock || !trimmed) continue;
    if (trimmed.startsWith("#")) continue;

    let description = "";
    let passes = false;
    let category: string | undefined;

    // Enhanced regex to handle indentation for nested items
    // Matches: 
    // - [ ] Task
    //   - [x] Subtask
    // 1. [ ] Numbered task
    const checkboxMatch = line.match(/^\s*([-*+]|\d+[.)])\s+\[([ xX-])\]\s+(.+)/);
    
    if (checkboxMatch) {
      // If it has an explicit checkbox, it is DEFINITELY a task.
      // We bypass noise filtering heuristics for explicit tasks.
      passes = checkboxMatch[2].toLowerCase() === "x";
      description = checkboxMatch[3].trim();
    } else {
      // Try plain list pattern for potential tasks
      const listMatch =
        line.match(/^\s*([-*+]|\d+[.)])\s+(.+)/);
      
      if (listMatch) {
        const candidate = listMatch[2].trim();
        // Heuristic: If it's a very short line or looks like a table/metadata, skip
        if (
          candidate.length < 5 || 
          candidate.includes("|") || 
          candidate.match(/^[a-z]/) || // Starts with lowercase (likely a note fragment)
          candidate.match(/^[A-Z][a-z]+: /) || // "Summary: ...", "Note: ..."
          candidate.match(/^(No|Sample)\s+[a-z]+/) // "No backend", "Sample data", etc. (assumptions)
        ) {
          continue;
        }
        description = candidate;
      }
    }

    if (!description) continue;

    // Try to extract category if description starts with [tag]
    const categoryMatch = description.match(/^\[([^\]]+)\]\s*(.+)/);
    if (categoryMatch) {
      category = categoryMatch[1];
      description = categoryMatch[2].trim();
    }

    tasks.push({ description, passes, category });
  }

  return tasks;
}

function createTemplateItems(): PrdItem[] {
  return [
    {
      title: "First PRD Item",
      category: DEFAULT_CATEGORY,
      description: "As a developer, I want to define the first PRD item so that I can start tracking project tasks.",
      acceptanceCriteria: [DEFAULT_ACCEPTANCE_CRITERIA],
      passes: false,
    },
  ];
}

function createPrdItemsFromTasks(tasks: ExtractedTask[]): PrdItem[] {
  return tasks.map((task) => ({
    category: task.category ?? DEFAULT_CATEGORY,
    description: task.description,
    acceptanceCriteria: [DEFAULT_ACCEPTANCE_CRITERIA],
    passes: task.passes,
  }));
}

function buildProgressTemplate(planFile: string): string {
  const timestamp = new Date().toISOString();
  return `# Ralph Progress

## Iteration 0 - Initialized ${timestamp}
- Plan: ${planFile}
- Notes: Initialized via ralph init.
`;
}

async function writeFileIfNeeded(
  path: string,
  content: string,
  force: boolean,
  result: InitResult,
): Promise<void> {
  const file = Bun.file(path);
  const exists = await file.exists();
  if (exists && !force) {
    result.skipped.push(path);
    return;
  }
  ensureParentDir(path);
  await Bun.write(path, content);
  result.created.push(path);
}

export async function runInit(options: InitOptions): Promise<InitResult> {
  const result: InitResult = { created: [], skipped: [], warnings: [] };
  const resolvedPlan = resolvePlanTarget(options.planFile);
  if (resolvedPlan.warning) {
    result.warnings.push(resolvedPlan.warning);
  }

  let sourceText = "";
  let sourcePath: string | null = null;

  if (options.from) {
    sourcePath = options.from;
  } else {
    const explicitPlan = Bun.file(options.planFile);
    if (await explicitPlan.exists()) {
      sourcePath = options.planFile;
    } else {
      const fallbackPlan = "plan.md";
      const fallbackFile = Bun.file(fallbackPlan);
      if (await fallbackFile.exists()) {
        sourcePath = fallbackPlan;
        result.warnings.push(`Found "${fallbackPlan}" and used it to seed PRD JSON.`);
      }
    }
  }

  if (sourcePath) {
    const sourceFile = Bun.file(sourcePath);
    if (await sourceFile.exists()) {
      sourceText = await sourceFile.text();
    } else {
      result.warnings.push(`Source file not found: ${sourcePath}`);
    }
  } else {
    result.warnings.push("No plan file found. Creating a template PRD.");
  }

  const trimmedSource = sourceText.trim();
  const looksLikeJson = trimmedSource.startsWith("{") || trimmedSource.startsWith("[");
  const parsedItems = sourceText ? parsePrdItems(sourceText) : null;
  let prdItems: PrdItem[] = [];
  let parsedMetadata: ExtendedPrdMetadata | null = null;
  
  // Check if target prd.json already exists and might need normalization
  const targetPrdExists = await Bun.file(resolvedPlan.planFile).exists();
  const targetIsSource = sourcePath === resolvedPlan.planFile || sourcePath === options.planFile;

  // If target prd.json exists and is the source, and parsing failed,
  // try to normalize it (fix missing fields like 'passes')
  if (targetPrdExists && targetIsSource && !parsedItems && looksLikeJson && !options.force) {
    const normalizeResult = await normalizePrdFile(resolvedPlan.planFile);
    if (normalizeResult.modified) {
      result.normalized = result.normalized || [];
      result.normalized.push(resolvedPlan.planFile);
      result.normalizedItemCount = normalizeResult.normalizedCount;
      // Re-read the normalized content
      const normalizedContent = await Bun.file(resolvedPlan.planFile).text();
      const normalizedItems = parsePrdItems(normalizedContent);
      if (normalizedItems) {
        prdItems = normalizedItems;
      }
    }
    if (normalizeResult.warnings.length > 0) {
      result.warnings.push(...normalizeResult.warnings);
    }
  }

  // Standard parsing logic if we don't have prdItems yet
  if (prdItems.length === 0) {
    if (parsedItems) {
      prdItems = parsedItems;
    } else if (sourceText) {
      // Always use the comprehensive markdown parser for better extraction
      // (IDs, categories, effort, risk, acceptance criteria, etc.)
      const markdownResult = parseMarkdownPlan(sourceText, {
        sourceFile: sourcePath ?? undefined,
      });
      
      if (markdownResult.items.length > 0) {
        prdItems = markdownResult.items;
        result.warnings.push(...markdownResult.warnings);
        
        // Preserve the parsed metadata for the generated PRD
        // Copy all extended metadata fields (title, summary, assumptions, etc.)
        if (markdownResult.metadata) {
          parsedMetadata = {
            generated: true as const,
            generator: markdownResult.metadata.generator || "ralph-init",
            createdAt: new Date().toISOString(),
            sourceFile: sourcePath ?? undefined,
            // Copy extended metadata fields
            title: markdownResult.metadata.title,
            summary: markdownResult.metadata.summary,
            assumptions: markdownResult.metadata.assumptions,
            approach: markdownResult.metadata.approach,
            risks: markdownResult.metadata.risks,
            estimatedEffort: markdownResult.metadata.estimatedEffort,
            totalTasks: markdownResult.metadata.totalTasks ?? prdItems.length,
          };
        }
      }
      
      // Fallback to simple extraction if comprehensive parser found nothing
      if (prdItems.length === 0) {
        const tasks = extractTasksFromText(sourceText);
        if (tasks.length > 0) {
          prdItems = createPrdItemsFromTasks(tasks);
        } else {
          prdItems = createTemplateItems();
          if (looksLikeJson) {
            result.warnings.push("Invalid PRD JSON detected. Creating a template PRD instead.");
          } else {
            result.warnings.push("Unable to extract tasks from the source plan. Creating a template PRD instead.");
          }
        }
      }
    } else {
      prdItems = createTemplateItems();
    }
  }

  // If we already normalized the file, skip creating a new one
  const alreadyNormalized = result.normalized?.includes(resolvedPlan.planFile);
  
  if (!alreadyNormalized) {
    // Wrap PRD items with metadata to mark as generated
    // Use parsed metadata if available (from structured markdown), otherwise create default
    const baseMetadata: PrdMetadata = {
      generated: true,
      generator: parsedMetadata?.generator || "ralph-init",
      createdAt: parsedMetadata?.createdAt || new Date().toISOString(),
      sourceFile: parsedMetadata?.sourceFile || (sourcePath ?? undefined),
    };
    
    // Merge extended metadata fields if present
    const fullMetadata = parsedMetadata 
      ? { ...baseMetadata, ...parsedMetadata, generated: true as const }
      : baseMetadata;
    
    const generatedPrd = {
      metadata: fullMetadata,
      items: prdItems,
    };
    const planContent = JSON.stringify(generatedPrd, null, 2) + "\n";

    await writeFileIfNeeded(resolvedPlan.planFile, planContent, Boolean(options.force), result);
  }
  await writeFileIfNeeded(
    options.progressFile,
    buildProgressTemplate(resolvedPlan.planFile),
    Boolean(options.force),
    result
  );
  await writeFileIfNeeded(options.promptFile, PROMPT_TEMPLATE, Boolean(options.force), result);

  // Create plugin file (respects --force)
  await writeFileIfNeeded(options.pluginFile, PLUGIN_TEMPLATE, Boolean(options.force), result);

  // Create AGENTS.md ONLY if it doesn't exist (NEVER overwrite, ignore --force)
  // This is intentionally different from other files - user's AGENTS.md is sacred
  const agentsFile = Bun.file(options.agentsFile);
  const agentsExists = await agentsFile.exists();
  if (!agentsExists) {
    ensureParentDir(options.agentsFile);
    await Bun.write(options.agentsFile, AGENTS_TEMPLATE);
    result.created.push(options.agentsFile);
  } else {
    result.skipped.push(options.agentsFile);
  }

  // Update .gitignore with Ralph-specific entries
  await updateGitignore(options.gitignoreFile, result);

  if (result.skipped.length > 0 && !options.force) {
    result.warnings.push("Some files already existed. Re-run with --force to overwrite.");
  }

  return result;
}
