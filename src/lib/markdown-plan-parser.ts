/**
 * Comprehensive Markdown Plan Parser for OpenRalph.
 * 
 * Converts structured markdown plan files to PRD JSON format.
 * Supports advanced features like metadata sections, acceptance criteria,
 * effort/risk estimates, and user story format descriptions.
 * 
 * This module is platform-agnostic and works across Windows, macOS, and Linux.
 * 
 * @module markdown-plan-parser
 */

import type { PrdItem } from "../plan";
import type { ExtendedPrdMetadata } from "../init";

/**
 * Result of parsing a markdown plan file.
 */
export type MarkdownPlanResult = {
  /** Parsed metadata from YAML frontmatter or markdown sections */
  metadata: ExtendedPrdMetadata | null;
  /** Parsed PRD items */
  items: PrdItem[];
  /** Warnings generated during parsing */
  warnings: string[];
  /** Whether the markdown was in structured format */
  isStructuredFormat: boolean;
};

/**
 * Effort level mappings from common terms to standard codes.
 */
const EFFORT_MAPPINGS: Record<string, string> = {
  "xs": "XS",
  "extra small": "XS",
  "extra-small": "XS",
  "tiny": "XS",
  "s": "S",
  "small": "S",
  "m": "M",
  "medium": "M",
  "l": "L",
  "large": "L",
  "xl": "XL",
  "extra large": "XL",
  "extra-large": "XL",
  "huge": "XL",
};

/**
 * Risk level mappings from common terms to standard codes.
 */
const RISK_MAPPINGS: Record<string, string> = {
  "l": "L",
  "low": "L",
  "m": "M",
  "medium": "M",
  "med": "M",
  "h": "H",
  "high": "H",
};

/**
 * Normalize effort string to standard code.
 */
export function normalizeEffort(effort: string): string | undefined {
  const normalized = effort.toLowerCase().trim();
  return EFFORT_MAPPINGS[normalized];
}

/**
 * Normalize risk string to standard code.
 */
export function normalizeRisk(risk: string): string | undefined {
  const normalized = risk.toLowerCase().trim();
  return RISK_MAPPINGS[normalized];
}

/**
 * Parse YAML-like frontmatter from markdown content.
 * Returns the frontmatter data and the remaining content.
 */
export function parseFrontmatter(content: string): {
  frontmatter: Record<string, unknown> | null;
  body: string;
} {
  const lines = content.split(/\r?\n/);
  
  // Check for YAML frontmatter (starts with ---)
  if (lines[0]?.trim() !== "---") {
    return { frontmatter: null, body: content };
  }
  
  // Find closing ---
  let endIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === "---") {
      endIndex = i;
      break;
    }
  }
  
  if (endIndex === -1) {
    return { frontmatter: null, body: content };
  }
  
  // Parse YAML-like frontmatter (supports multi-line values and array items)
  const frontmatterLines = lines.slice(1, endIndex);
  const frontmatter: Record<string, unknown> = {};
  let currentKey: string | null = null;
  let currentArrayItems: string[] = [];
  
  /**
   * Collect continuation lines starting at `start`, returning the joined text
   * and the index of the first non-continuation line.
   * Continuation lines are lines indented more than `baseIndent`.
   */
  function collectContinuation(start: number, baseIndent: number): { text: string; nextIndex: number } {
    const parts: string[] = [];
    let j = start;
    while (j < frontmatterLines.length) {
      const contLine = frontmatterLines[j];
      const contTrimmed = contLine.trim();
      // Stop at empty lines, comments, or lines at/below base indent
      if (!contTrimmed || contTrimmed.startsWith("#")) { j++; continue; }
      const contIndent = contLine.length - contLine.trimStart().length;
      if (contIndent <= baseIndent) break;
      // Stop if this looks like a new top-level key (unindented key: value)
      if (contIndent <= baseIndent && contTrimmed.includes(":")) break;
      parts.push(contTrimmed);
      j++;
    }
    return { text: parts.join(" "), nextIndex: j };
  }
  
  /**
   * Strip surrounding quotes from a string value and join multi-line quoted strings.
   */
  function cleanStringValue(value: string): string {
    // Remove wrapping single or double quotes
    return value.replace(/^["']|["']$/g, "").trim();
  }
  
  for (let i = 0; i < frontmatterLines.length; i++) {
    const line = frontmatterLines[i];
    const trimmed = line.trim();
    const lineIndent = line.length - line.trimStart().length;
    
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith("#")) continue;
    
    // Check for array item (- value)
    if (trimmed.startsWith("- ")) {
      if (currentKey) {
        let itemText = trimmed.slice(2).trim();
        
        // Collect continuation lines for this array item
        const itemIndent = lineIndent + 2; // indent of the item text after "- "
        const { text: contText, nextIndex } = collectContinuation(i + 1, itemIndent - 1);
        if (contText) {
          itemText += " " + contText;
        }
        i = nextIndex - 1; // -1 because for loop increments
        
        currentArrayItems.push(cleanStringValue(itemText));
      }
      continue;
    }
    
    // Save previous array if exists
    if (currentKey && currentArrayItems.length > 0) {
      frontmatter[currentKey] = currentArrayItems;
      currentArrayItems = [];
    }
    
    // Parse key: value
    const colonIndex = trimmed.indexOf(":");
    if (colonIndex > 0) {
      const key = trimmed.slice(0, colonIndex).trim();
      let value = trimmed.slice(colonIndex + 1).trim();
      
      currentKey = key;
      
      if (!value) {
        // No inline value — peek ahead to determine if this is a multi-line string or array
        let nextNonEmpty = i + 1;
        while (nextNonEmpty < frontmatterLines.length) {
          const nextTrimmed = frontmatterLines[nextNonEmpty].trim();
          if (nextTrimmed && !nextTrimmed.startsWith("#")) break;
          nextNonEmpty++;
        }
        const nextTrimmed = nextNonEmpty < frontmatterLines.length 
          ? frontmatterLines[nextNonEmpty].trim() 
          : "";
        
        if (nextTrimmed.startsWith("- ")) {
          // This is an array — let the array parsing handle it on subsequent iterations
        } else if (nextTrimmed) {
          // Multi-line string value — collect continuation lines
          const { text: contText, nextIndex } = collectContinuation(i + 1, lineIndent);
          if (contText) {
            value = contText;
            i = nextIndex - 1;
            frontmatter[key] = cleanStringValue(value);
          }
        }
        // If still no value, it might be followed by array items (handled next iteration)
      } else {
        // Handle inline value
        if (value === "true") {
          frontmatter[key] = true;
        } else if (value === "false") {
          frontmatter[key] = false;
        } else if (/^\d+$/.test(value)) {
          frontmatter[key] = parseInt(value, 10);
        } else {
          // Check if the value is an opening quote without a closing quote (multi-line)
          const isOpenQuote = (value.startsWith("'") && !value.endsWith("'")) ||
                              (value.startsWith('"') && !value.endsWith('"'));
          if (isOpenQuote) {
            // Collect continuation lines
            const { text: contText, nextIndex } = collectContinuation(i + 1, lineIndent);
            if (contText) {
              value += " " + contText;
              i = nextIndex - 1;
            }
            frontmatter[key] = cleanStringValue(value);
          } else {
            // Remove quotes if present
            frontmatter[key] = cleanStringValue(value);
          }
        }
      }
    }
  }
  
  // Save final array if exists
  if (currentKey && currentArrayItems.length > 0) {
    frontmatter[currentKey] = currentArrayItems;
  }
  
  const body = lines.slice(endIndex + 1).join("\n");
  
  return { frontmatter, body };
}

/**
 * Parse metadata from markdown sections (alternative to frontmatter).
 * Looks for specific headers like "## Metadata", "## Overview", "## Summary".
 */
export function parseMetadataSections(content: string): {
  metadata: Partial<ExtendedPrdMetadata>;
  warnings: string[];
} {
  const metadata: Partial<ExtendedPrdMetadata> = {};
  const warnings: string[] = [];
  const lines = content.split(/\r?\n/);
  
  let inMetadataSection = false;
  let inAssumptionsSection = false;
  let inRisksSection = false;
  
  const assumptions: string[] = [];
  const risks: ExtendedPrdMetadata["risks"] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Check for section headers
    if (trimmed.match(/^##?\s+(metadata|overview|project info)/i)) {
      inMetadataSection = true;
      inAssumptionsSection = false;
      inRisksSection = false;
      continue;
    }
    
    if (trimmed.match(/^##?\s+assumptions/i)) {
      inAssumptionsSection = true;
      inMetadataSection = false;
      inRisksSection = false;
      continue;
    }
    
    if (trimmed.match(/^##?\s+risks/i)) {
      inRisksSection = true;
      inMetadataSection = false;
      inAssumptionsSection = false;
      continue;
    }
    
    // New major section ends current section
    if (trimmed.match(/^##?\s+tasks/i) || trimmed.match(/^##?\s+plan/i)) {
      inMetadataSection = false;
      inAssumptionsSection = false;
      inRisksSection = false;
      continue;
    }
    
    // Parse metadata fields
    if (inMetadataSection) {
      const titleMatch = trimmed.match(/^(title|name|project):\s*(.+)/i);
      if (titleMatch) {
        metadata.title = titleMatch[2].replace(/^["']|["']$/g, "");
        continue;
      }
      
      const summaryMatch = trimmed.match(/^(summary|description|overview):\s*(.+)/i);
      if (summaryMatch) {
        metadata.summary = summaryMatch[2].replace(/^["']|["']$/g, "");
        continue;
      }
      
      const effortMatch = trimmed.match(/^(effort|estimated effort|timeline):\s*(.+)/i);
      if (effortMatch) {
        metadata.estimatedEffort = effortMatch[2].replace(/^["']|["']$/g, "");
        continue;
      }
      
      const approachMatch = trimmed.match(/^(approach|strategy|method):\s*(.+)/i);
      if (approachMatch) {
        metadata.approach = approachMatch[2].replace(/^["']|["']$/g, "");
        continue;
      }
    }
    
    // Parse assumptions (list items)
    if (inAssumptionsSection && trimmed.match(/^[-*+]\s+(.+)/)) {
      const listIndent = line.length - line.trimStart().length;
      let assumption = trimmed.replace(/^[-*+]\s+/, "").trim();
      
      // Collect continuation lines
      while (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        const nextTrimmed = nextLine.trim();
        const nextIndent = nextLine.length - nextLine.trimStart().length;
        
        // Stop at empty lines, headers, new list items, or same/less indent
        if (!nextTrimmed || nextTrimmed.startsWith("#") || nextTrimmed.match(/^[-*+]\s/) || nextIndent <= listIndent) {
          break;
        }
        
        assumption += " " + nextTrimmed;
        i++;
      }
      
      if (assumption) {
        assumptions.push(assumption);
      }
      continue;
    }
    
    // Parse risks (simple list or structured)
    if (inRisksSection && trimmed.match(/^[-*+]\s+(.+)/)) {
      const listIndent = line.length - line.trimStart().length;
      let riskText = trimmed.replace(/^[-*+]\s+/, "").trim();
      
      // Collect continuation lines
      while (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        const nextTrimmed = nextLine.trim();
        const nextIndent = nextLine.length - nextLine.trimStart().length;
        
        // Stop at empty lines, headers, new list items, or same/less indent
        if (!nextTrimmed || nextTrimmed.startsWith("#") || nextTrimmed.match(/^[-*+]\s/) || nextIndent <= listIndent) {
          break;
        }
        
        riskText += " " + nextTrimmed;
        i++;
      }
      
      if (riskText) {
        // Try to parse structured risk: "Risk: description (likelihood: L, impact: H, mitigation: ...)"
        const structuredMatch = riskText.match(
          /^(.+?)\s*(?:\(|-)?\s*(?:likelihood:\s*(\w+))?,?\s*(?:impact:\s*(\w+))?,?\s*(?:mitigation:\s*(.+?))?(?:\)|$)/i
        );
        
        if (structuredMatch && (structuredMatch[2] || structuredMatch[3])) {
          risks.push({
            risk: structuredMatch[1].trim(),
            likelihood: normalizeRisk(structuredMatch[2] || "M") || "M",
            impact: normalizeRisk(structuredMatch[3] || "M") || "M",
            mitigation: structuredMatch[4]?.trim() || "",
          });
        } else {
          // Simple risk text
          risks.push({
            risk: riskText,
            likelihood: "M",
            impact: "M",
            mitigation: "",
          });
        }
      }
      continue;
    }
  }
  
  if (assumptions.length > 0) {
    metadata.assumptions = assumptions;
  }
  
  if (risks.length > 0) {
    metadata.risks = risks;
  }
  
  return { metadata, warnings };
}

/**
 * Task inline metadata regex patterns.
 * Matches patterns like: `[effort: M]`, `[risk: H]`, `(effort: S)`, `{risk: L}`
 */
const INLINE_METADATA_PATTERN = /[\[\({]\s*(effort|risk|id|category)\s*:\s*([^\]\)}]+)\s*[\]\)}]/gi;

/**
 * Parse inline metadata from task text.
 * Returns extracted metadata and cleaned task text.
 */
export function parseInlineMetadata(text: string): {
  cleanText: string;
  id?: string;
  category?: string;
  effort?: string;
  risk?: string;
} {
  const result: {
    cleanText: string;
    id?: string;
    category?: string;
    effort?: string;
    risk?: string;
  } = { cleanText: text };
  
  // Extract metadata patterns
  const matches = [...text.matchAll(INLINE_METADATA_PATTERN)];
  
  for (const match of matches) {
    const key = match[1].toLowerCase();
    const value = match[2].trim();
    
    switch (key) {
      case "effort":
        result.effort = normalizeEffort(value) || value.toUpperCase();
        break;
      case "risk":
        result.risk = normalizeRisk(value) || value.toUpperCase();
        break;
      case "id":
        result.id = value;
        break;
      case "category":
        result.category = value;
        break;
    }
  }
  
  // Remove inline metadata from text
  result.cleanText = text.replace(INLINE_METADATA_PATTERN, "").trim();
  
  // Also check for category tag at start: [category] Task description
  const categoryTagMatch = result.cleanText.match(/^\[([^\]]+)\]\s+(.+)/);
  if (categoryTagMatch && !result.category) {
    const potentialCategory = categoryTagMatch[1].toLowerCase();
    // Only treat as category if it doesn't look like metadata
    if (!potentialCategory.includes(":")) {
      result.category = categoryTagMatch[1];
      result.cleanText = categoryTagMatch[2].trim();
    }
  }
  
  return result;
}

/**
 * Parse acceptance criteria following a task.
 * Looks for indented list items or a section marked "Acceptance Criteria:".
 */
export function parseAcceptanceCriteria(lines: string[], startIndex: number, taskIndent: number): {
  criteria: string[];
  endIndex: number;
} {
  const criteria: string[] = [];
  let i = startIndex;
  
  // Look for acceptance criteria in following lines
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Empty line - continue looking
    if (!trimmed) {
      i++;
      continue;
    }
    
    // Stop at code block markers
    if (trimmed.startsWith("```")) {
      break;
    }
    
    // Calculate indent of current line
    const currentIndent = line.length - line.trimStart().length;
    
    // If same or less indent and looks like a new task (checkbox pattern), stop
    if (currentIndent <= taskIndent && trimmed.match(/^(?:[-*+]|\d+[.)]) \s*\[[xX ]\]/)) {
      break;
    }
    
    // If it's a header, stop
    if (trimmed.startsWith("#")) {
      break;
    }
    
    // Check for "Acceptance Criteria:" label
    if (trimmed.match(/^acceptance\s*criteria:?/i)) {
      i++;
      continue;
    }
    
    // Check for indented list items (acceptance criteria)
    // Matches: - item, * item, + item, 1. item, 2) item
    if (currentIndent > taskIndent && trimmed.match(/^(?:[-*+]|\d+[.)])\s+(.+)/)) {
      // If it looks like a checkbox (nested task), stop - let the main loop handle it
      if (trimmed.match(/^(?:[-*+]|\d+[.)]) \s*\[[xX ]\]/)) {
        break;
      }
      let criteriaText = trimmed.replace(/^(?:[-*+]|\d+[.)]) \s*/, "").trim();
      
      // Collect continuation lines for this criterion
      while (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        const nextTrimmed = nextLine.trim();
        const nextIndent = nextLine.length - nextLine.trimStart().length;
        
        // Stop at empty lines
        if (!nextTrimmed) break;
        // Stop at headers
        if (nextTrimmed.startsWith("#")) break;
        // Stop at code blocks
        if (nextTrimmed.startsWith("```")) break;
        // Stop at new list items (at criteria indent level)
        if (nextIndent <= currentIndent && nextTrimmed.match(/^(?:[-*+]|\d+[.)])\s/)) break;
        // Stop at checkbox items at any level
        if (nextTrimmed.match(/^(?:[-*+]|\d+[.)])\s*\[[xX ]\]/)) break;
        // Stop if at or below task indent (new task or section)
        if (nextIndent <= taskIndent) break;
        
        // Continuation line (indented deeper than the list marker)
        if (nextIndent > currentIndent) {
          criteriaText += " " + nextTrimmed;
          i++;
        } else {
          break;
        }
      }
      
      criteria.push(criteriaText);
      i++;
      continue;
    }
    
    // Check for numbered criteria
    if (currentIndent > taskIndent && trimmed.match(/^\d+[.)]\s+(.+)/)) {
      let criteriaText = trimmed.replace(/^\d+[.)]\s+/, "").trim();
      
      // Collect continuation lines for this criterion
      while (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        const nextTrimmed = nextLine.trim();
        const nextIndent = nextLine.length - nextLine.trimStart().length;
        
        if (!nextTrimmed || nextTrimmed.startsWith("#") || nextTrimmed.startsWith("```")) break;
        if (nextIndent <= currentIndent && nextTrimmed.match(/^(?:[-*+]|\d+[.)])\s/)) break;
        if (nextTrimmed.match(/^(?:[-*+]|\d+[.)])\s*\[[xX ]\]/)) break;
        if (nextIndent <= taskIndent) break;
        
        if (nextIndent > currentIndent) {
          criteriaText += " " + nextTrimmed;
          i++;
        } else {
          break;
        }
      }
      
      criteria.push(criteriaText);
      i++;
      continue;
    }
    
    // If less indent, we're done with this task's criteria
    if (currentIndent <= taskIndent) {
      break;
    }
    
    i++;
  }
  
  return { criteria, endIndex: i };
}

/**
 * Parse a structured task line.
 * Supports multiple formats:
 * - `- [ ] Task description`
 * - `- [ ] **Title** - Description`
 * - `- [ ] 1.1.1: Title - Description`
 * - `- [ ] [category] Task description`
 */
export function parseTaskLine(line: string): {
  done: boolean;
  id?: string;
  title?: string;
  description: string;
  category?: string;
  effort?: string;
  risk?: string;
} | null {
  const trimmed = line.trim();
  
  // Match checkbox pattern with various list markers (-, *, +, or numbered like 1., 2., etc.)
  const checkboxMatch = trimmed.match(/^(?:[-*+]|\d+[.)]) \s*\[([xX ])\]\s+(.+)/);
  if (!checkboxMatch) {
    return null;
  }
  
  const done = checkboxMatch[1].toLowerCase() === "x";
  let taskText = checkboxMatch[2].trim();
  
  // Parse inline metadata first
  const { cleanText, id, category, effort, risk } = parseInlineMetadata(taskText);
  taskText = cleanText;
  
  // Try to extract ID from start: "1.1.1:" or "ID-123:"
  let taskId = id;
  let taskCategory = category;
  const idMatch = taskText.match(/^([a-zA-Z0-9.-]+):\s*(.+)/);
  if (idMatch && !taskId) {
    // Validate it looks like an ID - MUST contain at least one digit
    // This prevents words like "No:" from being treated as IDs
    if (/\d/.test(idMatch[1])) {
      taskId = idMatch[1];
      taskText = idMatch[2].trim();
    }
  }
  
  // After ID extraction, check again for category tag at start: [category] Task description
  // This handles cases like "1.1.1: [ui] Task description"
  if (!taskCategory) {
    const categoryTagMatch = taskText.match(/^\[([^\]]+)\]\s+(.+)/);
    if (categoryTagMatch) {
      const potentialCategory = categoryTagMatch[1].toLowerCase();
      // Only treat as category if it doesn't look like metadata (no colon)
      if (!potentialCategory.includes(":")) {
        taskCategory = categoryTagMatch[1];
        taskText = categoryTagMatch[2].trim();
      }
    }
  }
  
  // Try to extract title and description
  // Format 1: **Title** - Description
  // Format 2: **Title**: Description
  // Format 3: Title - Description (if short title)
  let title: string | undefined;
  let description = taskText;
  
  const boldTitleMatch = taskText.match(/^\*\*([^*]+)\*\*\s*[-:]\s*(.+)/);
  if (boldTitleMatch) {
    title = boldTitleMatch[1].trim();
    description = boldTitleMatch[2].trim();
  } else {
    // Try simple "Title - Description" format
    const simpleTitleMatch = taskText.match(/^([^-]{5,50})\s*-\s+(.{10,})/);
    if (simpleTitleMatch) {
      title = simpleTitleMatch[1].trim();
      description = simpleTitleMatch[2].trim();
    }
  }
  
  return {
    done,
    id: taskId,
    title,
    description: description || taskText,
    category: taskCategory,
    effort,
    risk,
  };
}

/**
 * Check if content appears to be in structured markdown plan format.
 * Structured format has:
 * - YAML frontmatter with specific fields, OR
 * - Metadata section headers, OR
 * - Tasks with inline metadata patterns
 */
export function isStructuredFormat(content: string): boolean {
  // Check for YAML frontmatter with plan-specific fields
  if (content.startsWith("---")) {
    const frontmatterEnd = content.indexOf("\n---", 4);
    if (frontmatterEnd > 0) {
      const frontmatter = content.slice(0, frontmatterEnd);
      if (
        frontmatter.match(/title:/i) ||
        frontmatter.match(/summary:/i) ||
        frontmatter.match(/generator:/i)
      ) {
        return true;
      }
    }
  }
  
  // Check for metadata section headers
  if (
    content.match(/^##?\s+(metadata|overview|assumptions|risks)\s*$/im)
  ) {
    return true;
  }
  
  // Check for inline task metadata
  if (content.match(/\[(effort|risk|id):\s*\w+\]/i)) {
    return true;
  }
  
  // Check for structured task format with bold titles
  if (content.match(/^[-*+]\s+\[[xX ]\]\s+\*\*[^*]+\*\*/m)) {
    return true;
  }
  
  return false;
}

/**
 * Parse markdown plan content into PRD format.
 * Handles both simple and structured markdown formats.
 * 
 * @param content - Markdown content to parse
 * @param options - Parser options
 * @returns Parsed plan result with metadata and items
 */
export function parseMarkdownPlan(
  content: string,
  options: {
    /** Source file path for metadata */
    sourceFile?: string;
    /** Default category for tasks without one */
    defaultCategory?: string;
  } = {}
): MarkdownPlanResult {
  const warnings: string[] = [];
  const items: PrdItem[] = [];
  const isStructured = isStructuredFormat(content);
  
  // Parse frontmatter if present
  const { frontmatter, body } = parseFrontmatter(content);
  
  // Build metadata from frontmatter or sections
  let metadata: ExtendedPrdMetadata | null = null;
  
  if (frontmatter) {
    metadata = {
      generated: true,
      generator: (frontmatter.generator as string) || "ralph-markdown-parser",
      createdAt: new Date().toISOString(),
      sourceFile: options.sourceFile,
      title: frontmatter.title as string,
      summary: frontmatter.summary as string,
      assumptions: frontmatter.assumptions as string[],
      approach: frontmatter.approach as string,
      estimatedEffort: frontmatter.estimatedEffort as string,
    };
  }
  
  // Also check for section-based metadata
  const { metadata: sectionMetadata, warnings: sectionWarnings } = parseMetadataSections(body || content);
  warnings.push(...sectionWarnings);
  
  // Merge section metadata into main metadata
  if (Object.keys(sectionMetadata).length > 0) {
    if (!metadata) {
      metadata = {
        generated: true,
        generator: "ralph-markdown-parser",
        createdAt: new Date().toISOString(),
        sourceFile: options.sourceFile,
      };
    }
    
    // Section metadata takes precedence (more specific)
    Object.assign(metadata, sectionMetadata);
  }
  
  // Parse tasks from content
  const contentToParse = body || content;
  const lines = contentToParse.split(/\r?\n/);
  let inCodeBlock = false;
  let currentCategory: string | undefined;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Track code blocks
    if (trimmed.startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    
    if (inCodeBlock) continue;
    
    // Skip empty lines
    if (!trimmed) continue;
    
    // Track section headers for implicit category
    const headerMatch = trimmed.match(/^##?#?\s+(.+)/);
    if (headerMatch) {
      const headerText = headerMatch[1].toLowerCase();
      // Skip metadata/overview sections and top-level "Plan" headers
      if (!headerText.match(/^(metadata|overview|assumptions|risks|summary|plan|tasks?)$/)) {
        // Use header as category hint (but only if no default category is provided)
        if (!options.defaultCategory) {
          // Strip inline metadata like [effort: M] from header before using as category
          let categoryText = headerMatch[1];
          categoryText = categoryText.replace(INLINE_METADATA_PATTERN, "").trim();
          // Also strip trailing colons
          categoryText = categoryText.replace(/:\s*$/, "").trim();
          if (categoryText) {
            currentCategory = categoryText;
          }
        }
      }
      continue;
    }
    
    // Parse task line
    const lineIndent = line.length - line.trimStart().length;
    const parsedTask = parseTaskLine(line);
    
    if (parsedTask) {
      // Collect continuation lines (indented text that continues the task description)
      let continuationEndIndex = i + 1;
      const continuationLines: string[] = [];
      
      while (continuationEndIndex < lines.length) {
        const contLine = lines[continuationEndIndex];
        const contTrimmed = contLine.trim();
        const contIndent = contLine.length - contLine.trimStart().length;
        
        // Stop at empty lines
        if (!contTrimmed) {
          continuationEndIndex++;
          continue;
        }
        
        // Stop at code blocks
        if (contTrimmed.startsWith("```")) {
          break;
        }
        
        // Stop at headers
        if (contTrimmed.startsWith("#")) {
          break;
        }
        
        // Stop at list items with checkboxes (new task)
        if (contTrimmed.match(/^(?:[-*+]|\d+[.)])\s*\[[xX ]\]/)) {
          break;
        }
        
        // Stop at ANY list item (these become acceptance criteria, not description continuation)
        // List items are: - item, * item, + item, 1. item, 2) item
        if (contTrimmed.match(/^(?:[-*+]|\d+[.)])\s/)) {
          break;
        }
        
        // If indented more than the task line, it's a continuation
        if (contIndent > lineIndent) {
          continuationLines.push(contTrimmed);
          continuationEndIndex++;
        } else {
          // Same or less indent - stop collecting
          break;
        }
      }
      
      // Append continuation lines to description
      let fullDescription = parsedTask.description;
      if (continuationLines.length > 0) {
        fullDescription = fullDescription + " " + continuationLines.join(" ");
      }
      
      // Re-parse inline metadata from the full description to catch effort/risk on continuation lines
      const { cleanText, effort, risk } = parseInlineMetadata(fullDescription);
      fullDescription = cleanText;
      
      // Use effort/risk from continuation lines if not already set
      const finalEffort = parsedTask.effort || effort;
      const finalRisk = parsedTask.risk || risk;
      
      // Check for acceptance criteria in following lines (starting after continuation lines)
      const { criteria, endIndex } = parseAcceptanceCriteria(lines, continuationEndIndex, lineIndent);
      
      // Build PRD item
      const item: PrdItem = {
        id: parsedTask.id,
        title: parsedTask.title,
        category: parsedTask.category || currentCategory || options.defaultCategory || "functional",
        description: fullDescription,
        passes: parsedTask.done,
        effort: finalEffort,
        risk: finalRisk,
      };
      
      // Add acceptance criteria if found
      if (criteria.length > 0) {
        item.acceptanceCriteria = criteria;
      }
      
      items.push(item);
      
      // Skip to end of acceptance criteria
      if (endIndex > i + 1) {
        i = endIndex - 1;
      }
    }
  }
  
  // Calculate totalTasks in metadata
  if (metadata) {
    metadata.totalTasks = items.length;
  }
  
  return {
    metadata,
    items,
    warnings,
    isStructuredFormat: isStructured,
  };
}

/**
 * Convert markdown plan content to PRD JSON string.
 * Convenience function that parses and formats the result.
 * 
 * @param content - Markdown content to convert
 * @param options - Parser options
 * @returns JSON string of the PRD
 */
export function markdownToPrdJson(
  content: string,
  options: {
    sourceFile?: string;
    defaultCategory?: string;
  } = {}
): { json: string; warnings: string[] } {
  const result = parseMarkdownPlan(content, options);
  
  const prd = {
    metadata: result.metadata || {
      generated: true,
      generator: "ralph-markdown-parser",
      createdAt: new Date().toISOString(),
      sourceFile: options.sourceFile,
      totalTasks: result.items.length,
    },
    items: result.items,
  };
  
  return {
    json: JSON.stringify(prd, null, 2),
    warnings: result.warnings,
  };
}
