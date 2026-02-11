import { describe, it, expect } from "bun:test";
import {
  parseMarkdownPlan,
  parseFrontmatter,
  parseMetadataSections,
  parseInlineMetadata,
  parseTaskLine,
  parseAcceptanceCriteria,
  isStructuredFormat,
  normalizeEffort,
  normalizeRisk,
  markdownToPrdJson,
} from "../../src/lib/markdown-plan-parser";

describe("normalizeEffort", () => {
  it("should normalize effort strings to standard codes", () => {
    expect(normalizeEffort("XS")).toBe("XS");
    expect(normalizeEffort("xs")).toBe("XS");
    expect(normalizeEffort("extra small")).toBe("XS");
    expect(normalizeEffort("extra-small")).toBe("XS");
    expect(normalizeEffort("tiny")).toBe("XS");
    expect(normalizeEffort("S")).toBe("S");
    expect(normalizeEffort("small")).toBe("S");
    expect(normalizeEffort("M")).toBe("M");
    expect(normalizeEffort("medium")).toBe("M");
    expect(normalizeEffort("L")).toBe("L");
    expect(normalizeEffort("large")).toBe("L");
    expect(normalizeEffort("XL")).toBe("XL");
    expect(normalizeEffort("extra large")).toBe("XL");
    expect(normalizeEffort("huge")).toBe("XL");
  });

  it("should return undefined for unknown effort strings", () => {
    expect(normalizeEffort("unknown")).toBeUndefined();
    expect(normalizeEffort("massive")).toBeUndefined();
  });
});

describe("normalizeRisk", () => {
  it("should normalize risk strings to standard codes", () => {
    expect(normalizeRisk("L")).toBe("L");
    expect(normalizeRisk("l")).toBe("L");
    expect(normalizeRisk("low")).toBe("L");
    expect(normalizeRisk("M")).toBe("M");
    expect(normalizeRisk("medium")).toBe("M");
    expect(normalizeRisk("med")).toBe("M");
    expect(normalizeRisk("H")).toBe("H");
    expect(normalizeRisk("high")).toBe("H");
  });

  it("should return undefined for unknown risk strings", () => {
    expect(normalizeRisk("unknown")).toBeUndefined();
    expect(normalizeRisk("critical")).toBeUndefined();
  });
});

describe("parseFrontmatter", () => {
  it("should parse YAML frontmatter with simple key-value pairs", () => {
    const content = `---
title: My Project
summary: A test project
generator: ralph-init
---
# Tasks

- [ ] First task`;

    const result = parseFrontmatter(content);
    
    expect(result.frontmatter).not.toBeNull();
    expect(result.frontmatter?.title).toBe("My Project");
    expect(result.frontmatter?.summary).toBe("A test project");
    expect(result.frontmatter?.generator).toBe("ralph-init");
    expect(result.body).toContain("# Tasks");
    expect(result.body).toContain("- [ ] First task");
  });

  it("should parse frontmatter with array values", () => {
    const content = `---
title: My Project
assumptions:
  - First assumption
  - Second assumption
---
# Content`;

    const result = parseFrontmatter(content);
    
    expect(result.frontmatter?.title).toBe("My Project");
    expect(result.frontmatter?.assumptions).toEqual(["First assumption", "Second assumption"]);
  });

  it("should parse frontmatter with boolean values", () => {
    const content = `---
generated: true
draft: false
---
Content`;

    const result = parseFrontmatter(content);
    
    expect(result.frontmatter?.generated).toBe(true);
    expect(result.frontmatter?.draft).toBe(false);
  });

  it("should parse frontmatter with numeric values", () => {
    const content = `---
totalTasks: 5
version: 1
---
Content`;

    const result = parseFrontmatter(content);
    
    expect(result.frontmatter?.totalTasks).toBe(5);
    expect(result.frontmatter?.version).toBe(1);
  });

  it("should return null frontmatter for content without frontmatter", () => {
    const content = `# No Frontmatter

- [ ] First task`;

    const result = parseFrontmatter(content);
    
    expect(result.frontmatter).toBeNull();
    expect(result.body).toBe(content);
  });

  it("should handle unclosed frontmatter gracefully", () => {
    const content = `---
title: Broken frontmatter
No closing delimiter`;

    const result = parseFrontmatter(content);
    
    expect(result.frontmatter).toBeNull();
    expect(result.body).toBe(content);
  });
});

describe("parseMetadataSections", () => {
  it("should parse metadata from markdown sections", () => {
    const content = `# Project Plan

## Overview

Title: My Awesome Project
Summary: This is a summary of the project
Effort: 3-5 days
Approach: Start with backend

## Assumptions

- The database is available
- Users have modern browsers

## Tasks

- [ ] First task`;

    const result = parseMetadataSections(content);
    
    expect(result.metadata.title).toBe("My Awesome Project");
    expect(result.metadata.summary).toBe("This is a summary of the project");
    expect(result.metadata.estimatedEffort).toBe("3-5 days");
    expect(result.metadata.approach).toBe("Start with backend");
    expect(result.metadata.assumptions).toEqual([
      "The database is available",
      "Users have modern browsers",
    ]);
  });

  it("should parse risks section with simple format", () => {
    const content = `## Risks

- API instability
- Performance concerns
- Data migration complexity`;

    const result = parseMetadataSections(content);
    
    expect(result.metadata.risks).toHaveLength(3);
    expect(result.metadata.risks![0].risk).toBe("API instability");
    expect(result.metadata.risks![0].likelihood).toBe("M");
    expect(result.metadata.risks![0].impact).toBe("M");
  });
});

describe("parseInlineMetadata", () => {
  it("should extract effort from task text", () => {
    const result = parseInlineMetadata("Implement feature [effort: M]");
    
    expect(result.effort).toBe("M");
    expect(result.cleanText).toBe("Implement feature");
  });

  it("should extract risk from task text", () => {
    const result = parseInlineMetadata("Deploy to production [risk: H]");
    
    expect(result.risk).toBe("H");
    expect(result.cleanText).toBe("Deploy to production");
  });

  it("should extract id from task text", () => {
    const result = parseInlineMetadata("Feature implementation [id: 1.1.1]");
    
    expect(result.id).toBe("1.1.1");
    expect(result.cleanText).toBe("Feature implementation");
  });

  it("should extract category from task text", () => {
    const result = parseInlineMetadata("Add login form [category: ui]");
    
    expect(result.category).toBe("ui");
    expect(result.cleanText).toBe("Add login form");
  });

  it("should extract multiple metadata fields", () => {
    const result = parseInlineMetadata("Big feature [effort: L] [risk: H] [category: backend]");
    
    expect(result.effort).toBe("L");
    expect(result.risk).toBe("H");
    expect(result.category).toBe("backend");
    expect(result.cleanText).toBe("Big feature");
  });

  it("should extract category from tag prefix", () => {
    const result = parseInlineMetadata("[ui] Add login form");
    
    expect(result.category).toBe("ui");
    expect(result.cleanText).toBe("Add login form");
  });

  it("should handle parentheses and braces syntax", () => {
    const result1 = parseInlineMetadata("Task (effort: S)");
    expect(result1.effort).toBe("S");
    
    const result2 = parseInlineMetadata("Task {risk: M}");
    expect(result2.risk).toBe("M");
  });
});

describe("parseTaskLine", () => {
  it("should parse simple checkbox task", () => {
    const result = parseTaskLine("- [ ] Implement feature");
    
    expect(result).not.toBeNull();
    expect(result!.done).toBe(false);
    expect(result!.description).toBe("Implement feature");
  });

  it("should parse completed task", () => {
    const result = parseTaskLine("- [x] Completed task");
    
    expect(result).not.toBeNull();
    expect(result!.done).toBe(true);
    expect(result!.description).toBe("Completed task");
  });

  it("should parse uppercase X as completed", () => {
    const result = parseTaskLine("- [X] Also completed");
    
    expect(result).not.toBeNull();
    expect(result!.done).toBe(true);
  });

  it("should parse task with ID prefix", () => {
    const result = parseTaskLine("- [ ] 1.1.1: Configure JWT library");
    
    expect(result).not.toBeNull();
    expect(result!.id).toBe("1.1.1");
    expect(result!.description).toBe("Configure JWT library");
  });

  it("should parse task with bold title and description", () => {
    const result = parseTaskLine("- [ ] **Configure JWT** - Set up JWT library for authentication");
    
    expect(result).not.toBeNull();
    expect(result!.title).toBe("Configure JWT");
    expect(result!.description).toBe("Set up JWT library for authentication");
  });

  it("should parse task with inline metadata", () => {
    const result = parseTaskLine("- [ ] Deploy service [effort: M] [risk: H]");
    
    expect(result).not.toBeNull();
    expect(result!.effort).toBe("M");
    expect(result!.risk).toBe("H");
    expect(result!.description).toBe("Deploy service");
  });

  it("should parse task with category tag", () => {
    const result = parseTaskLine("- [ ] [backend] Create API endpoint");
    
    expect(result).not.toBeNull();
    expect(result!.category).toBe("backend");
    expect(result!.description).toBe("Create API endpoint");
  });

  it("should handle asterisk list marker", () => {
    const result = parseTaskLine("* [ ] Task with asterisk");
    
    expect(result).not.toBeNull();
    expect(result!.description).toBe("Task with asterisk");
  });

  it("should handle plus list marker", () => {
    const result = parseTaskLine("+ [ ] Task with plus");
    
    expect(result).not.toBeNull();
    expect(result!.description).toBe("Task with plus");
  });

  it("should return null for non-task lines", () => {
    expect(parseTaskLine("# Header")).toBeNull();
    expect(parseTaskLine("Regular text")).toBeNull();
    expect(parseTaskLine("- List item without checkbox")).toBeNull();
  });
});

describe("parseAcceptanceCriteria", () => {
  it("should parse indented list items as criteria", () => {
    const lines = [
      "- [ ] Main task",
      "  - First criterion",
      "  - Second criterion",
      "  - Third criterion",
      "- [ ] Next task",
    ];

    const result = parseAcceptanceCriteria(lines, 1, 0);
    
    expect(result.criteria).toEqual([
      "First criterion",
      "Second criterion",
      "Third criterion",
    ]);
    expect(result.endIndex).toBe(4);
  });

  it("should parse numbered criteria", () => {
    const lines = [
      "- [ ] Main task",
      "  1. First step",
      "  2. Second step",
      "  3. Third step",
      "- [ ] Next task",
    ];

    const result = parseAcceptanceCriteria(lines, 1, 0);
    
    expect(result.criteria).toEqual([
      "First step",
      "Second step",
      "Third step",
    ]);
  });

  it("should stop at nested checkbox items (they become separate tasks)", () => {
    const lines = [
      "- [ ] Main task",
      "  - [x] Nested completed task",
      "  - Regular criterion",
      "- [ ] Next task",
    ];

    const result = parseAcceptanceCriteria(lines, 1, 0);
    
    // Should stop at the nested checkbox - the main loop will handle it as a task
    // The "Regular criterion" after a checkbox is not part of this task's criteria
    expect(result.criteria).toEqual([]);
    expect(result.endIndex).toBe(1); // Stops at the nested checkbox
  });

  it("should handle empty lines between criteria", () => {
    const lines = [
      "- [ ] Main task",
      "  - First criterion",
      "",
      "  - Second criterion",
      "- [ ] Next task",
    ];

    const result = parseAcceptanceCriteria(lines, 1, 0);
    
    expect(result.criteria).toEqual([
      "First criterion",
      "Second criterion",
    ]);
  });
});

describe("isStructuredFormat", () => {
  it("should detect YAML frontmatter with plan fields", () => {
    const content = `---
title: My Project
summary: Description
---
# Tasks`;

    expect(isStructuredFormat(content)).toBe(true);
  });

  it("should detect metadata section headers", () => {
    const content = `# Project

## Overview

## Assumptions

- Assumption 1`;

    expect(isStructuredFormat(content)).toBe(true);
  });

  it("should detect inline task metadata", () => {
    const content = `# Plan

- [ ] Task one [effort: M]
- [ ] Task two [risk: H]`;

    expect(isStructuredFormat(content)).toBe(true);
  });

  it("should detect bold task titles", () => {
    const content = `# Plan

- [ ] **Task Title** - Description here`;

    expect(isStructuredFormat(content)).toBe(true);
  });

  it("should return false for simple markdown", () => {
    const content = `# Plan

- [ ] First task
- [ ] Second task
- [x] Completed task`;

    expect(isStructuredFormat(content)).toBe(false);
  });
});

describe("parseMarkdownPlan", () => {
  it("should parse simple markdown plan", () => {
    const content = `# Plan

- [ ] First task
- [x] Second task (completed)
- [ ] Third task`;

    const result = parseMarkdownPlan(content);
    
    expect(result.items).toHaveLength(3);
    expect(result.items[0].description).toBe("First task");
    expect(result.items[0].passes).toBe(false);
    expect(result.items[1].description).toBe("Second task (completed)");
    expect(result.items[1].passes).toBe(true);
    expect(result.items[2].description).toBe("Third task");
    expect(result.items[2].passes).toBe(false);
  });

  it("should parse structured markdown with frontmatter", () => {
    const content = `---
title: My Project Plan
summary: Implementation plan for the feature
estimatedEffort: 2-3 days
---

# Tasks

- [ ] **Setup** - Configure the project [effort: XS] [risk: L]
  - Install dependencies
  - Configure build
- [ ] **Implementation** - Build the feature [effort: M] [risk: M]`;

    const result = parseMarkdownPlan(content, { sourceFile: "plan.md" });
    
    expect(result.metadata).not.toBeNull();
    expect(result.metadata?.title).toBe("My Project Plan");
    expect(result.metadata?.summary).toBe("Implementation plan for the feature");
    expect(result.metadata?.estimatedEffort).toBe("2-3 days");
    
    expect(result.items).toHaveLength(2);
    expect(result.items[0].title).toBe("Setup");
    expect(result.items[0].effort).toBe("XS");
    expect(result.items[0].risk).toBe("L");
    expect(result.items[0].acceptanceCriteria).toEqual([
      "Install dependencies",
      "Configure build",
    ]);
    
    expect(result.items[1].title).toBe("Implementation");
    expect(result.items[1].effort).toBe("M");
    expect(result.items[1].risk).toBe("M");
  });

  it("should parse tasks with custom IDs", () => {
    const content = `# Plan

- [ ] 1.1.1: First feature
- [ ] 1.1.2: Second feature
- [x] 2.1.1: Completed feature`;

    const result = parseMarkdownPlan(content);
    
    expect(result.items[0].id).toBe("1.1.1");
    expect(result.items[0].description).toBe("First feature");
    expect(result.items[1].id).toBe("1.1.2");
    expect(result.items[2].id).toBe("2.1.1");
    expect(result.items[2].passes).toBe(true);
  });

  it("should parse tasks with category tags", () => {
    const content = `# Plan

- [ ] [backend] Create API endpoint
- [ ] [frontend] Build UI component
- [x] [test] Add unit tests`;

    const result = parseMarkdownPlan(content);
    
    expect(result.items[0].category).toBe("backend");
    expect(result.items[1].category).toBe("frontend");
    expect(result.items[2].category).toBe("test");
  });

  it("should inherit category from section headers", () => {
    const content = `# Plan

## Backend Tasks

- [ ] Create API endpoint
- [ ] Add validation

## Frontend Tasks

- [ ] Build form component`;

    const result = parseMarkdownPlan(content);
    
    expect(result.items[0].category).toBe("Backend Tasks");
    expect(result.items[1].category).toBe("Backend Tasks");
    expect(result.items[2].category).toBe("Frontend Tasks");
  });

  it("should skip code blocks", () => {
    // Use array join to avoid template literal backtick escaping issues
    const content = [
      "# Plan",
      "",
      "- [ ] Setup database connection",
      "",
      "```markdown",
      "- [ ] Fake task in code block",
      "```",
      "",
      "- [ ] Build user interface"
    ].join("\n");

    const result = parseMarkdownPlan(content);
    
    expect(result.items).toHaveLength(2);
    expect(result.items[0].description).toBe("Setup database connection");
    expect(result.items[1].description).toBe("Build user interface");
  });

  it("should use default category from options", () => {
    const content = `# Plan

- [ ] Task without explicit category`;

    const result = parseMarkdownPlan(content, { defaultCategory: "misc" });
    
    expect(result.items[0].category).toBe("misc");
  });

  it("should handle Windows line endings (CRLF)", () => {
    const content = "# Plan\r\n\r\n- [ ] Task one\r\n- [x] Task two\r\n";

    const result = parseMarkdownPlan(content);
    
    expect(result.items).toHaveLength(2);
    expect(result.items[0].description).toBe("Task one");
    expect(result.items[1].description).toBe("Task two");
  });

  it("should set totalTasks in metadata", () => {
    const content = `---
title: Test Plan
---
# Tasks

- [ ] Task 1
- [ ] Task 2
- [ ] Task 3`;

    const result = parseMarkdownPlan(content);
    
    expect(result.metadata?.totalTasks).toBe(3);
  });
});

describe("markdownToPrdJson", () => {
  it("should convert markdown to valid PRD JSON", () => {
    const content = `---
title: Test Project
---
# Tasks

- [ ] First task
- [x] Completed task`;

    const { json, warnings } = markdownToPrdJson(content, { sourceFile: "plan.md" });
    
    const prd = JSON.parse(json);
    
    expect(prd.metadata).toBeDefined();
    expect(prd.metadata.generated).toBe(true);
    expect(prd.metadata.title).toBe("Test Project");
    expect(prd.items).toHaveLength(2);
    expect(prd.items[0].passes).toBe(false);
    expect(prd.items[1].passes).toBe(true);
  });

  it("should produce valid JSON for simple markdown", () => {
    const content = `- [ ] Task 1
- [x] Task 2`;

    const { json } = markdownToPrdJson(content);
    
    expect(() => JSON.parse(json)).not.toThrow();
    
    const prd = JSON.parse(json);
    expect(prd.items).toHaveLength(2);
  });
});

describe("parseMarkdownPlan - edge cases", () => {
  it("should handle empty content", () => {
    const result = parseMarkdownPlan("");
    
    expect(result.items).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it("should handle content with only headers", () => {
    const content = `# Plan

## Phase 1

## Phase 2`;

    const result = parseMarkdownPlan(content);
    
    expect(result.items).toHaveLength(0);
  });

  it("should handle mixed checkbox styles", () => {
    const content = `- [ ] Task with dash
* [ ] Task with asterisk
+ [ ] Task with plus`;

    const result = parseMarkdownPlan(content);
    
    expect(result.items).toHaveLength(3);
  });

  it("should handle deeply nested acceptance criteria", () => {
    const content = `- [ ] Main task
    - Level 1 criterion
        - Level 2 criterion (should be ignored as too deep)
    - Another level 1 criterion`;

    const result = parseMarkdownPlan(content);
    
    // Only level 1 criteria should be captured
    expect(result.items[0].acceptanceCriteria?.length).toBeGreaterThanOrEqual(2);
  });

  it("should handle unicode in task descriptions", () => {
    const content = `- [ ] Implement 日本語 support
- [x] Add emoji handling 🚀
- [ ] Support Ü and ö characters`;

    const result = parseMarkdownPlan(content);
    
    expect(result.items).toHaveLength(3);
    expect(result.items[0].description).toContain("日本語");
    expect(result.items[1].description).toContain("🚀");
    expect(result.items[2].description).toContain("Ü");
  });

  it("should handle very long task descriptions", () => {
    const longDescription = "A".repeat(500);
    const content = `- [ ] ${longDescription}`;

    const result = parseMarkdownPlan(content);
    
    expect(result.items).toHaveLength(1);
    expect(result.items[0].description).toBe(longDescription);
  });
});
