import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { runInit } from "../../src/init";
import { TempDir } from "../helpers/temp-files";
import path from "path";

describe("Markdown to PRD Integration", () => {
  const tempDir = new TempDir();

  beforeEach(async () => {
    await tempDir.create();
  });

  afterEach(async () => {
    await tempDir.cleanup();
  });

  it("should convert simple markdown plan to prd.json", async () => {
    const planContent = `# Simple Plan

- [ ] First task
- [x] Second task completed
- [ ] Third task
`;

    const planPath = await tempDir.write("plan.md", planContent);

    const result = await runInit({
      planFile: tempDir.path("prd.json"),
      progressFile: tempDir.path("progress.txt"),
      promptFile: tempDir.path(".ralph-prompt.md"),
      pluginFile: tempDir.path(".opencode/plugin/ralph-write-guardrail.ts"),
      agentsFile: tempDir.path("AGENTS.md"),
      gitignoreFile: tempDir.path(".gitignore"),
      from: planPath,
    });

    const prdPath = tempDir.path("prd.json");
    const prdContent = await Bun.file(prdPath).json();

    expect(prdContent.items).toHaveLength(3);
    expect(prdContent.items[0].description).toBe("First task");
    expect(prdContent.items[0].passes).toBe(false);
    expect(prdContent.items[1].description).toBe("Second task completed");
    expect(prdContent.items[1].passes).toBe(true);
    expect(prdContent.items[2].description).toBe("Third task");
    expect(prdContent.items[2].passes).toBe(false);
  });

  it("should convert structured markdown with frontmatter", async () => {
    const planContent = `---
title: Feature Implementation
summary: Implement user authentication feature
estimatedEffort: 3-5 days
---

# Authentication Feature

## Assumptions

- Database is available
- Using JWT for tokens

## Tasks

- [ ] **Configure JWT** - Set up JWT library [effort: XS] [risk: L]
  - Install dependencies
  - Add environment variables
- [ ] **Create endpoints** - Build login/logout API [effort: M] [risk: M]
  - POST /login endpoint
  - POST /logout endpoint
- [x] **Setup complete** - Project initialized [effort: XS] [risk: L]
`;

    const planPath = await tempDir.write("plan.md", planContent);

    await runInit({
      planFile: tempDir.path("prd.json"),
      progressFile: tempDir.path("progress.txt"),
      promptFile: tempDir.path(".ralph-prompt.md"),
      pluginFile: tempDir.path(".opencode/plugin/ralph-write-guardrail.ts"),
      agentsFile: tempDir.path("AGENTS.md"),
      gitignoreFile: tempDir.path(".gitignore"),
      from: planPath,
    });

    const prdPath = tempDir.path("prd.json");
    const prdContent = await Bun.file(prdPath).json();

    // Check metadata
    expect(prdContent.metadata.title).toBe("Feature Implementation");
    expect(prdContent.metadata.summary).toBe("Implement user authentication feature");
    expect(prdContent.metadata.estimatedEffort).toBe("3-5 days");
    expect(prdContent.metadata.generated).toBe(true);

    // Check items
    expect(prdContent.items).toHaveLength(3);
    
    // First task
    expect(prdContent.items[0].title).toBe("Configure JWT");
    expect(prdContent.items[0].description).toBe("Set up JWT library");
    expect(prdContent.items[0].effort).toBe("XS");
    expect(prdContent.items[0].risk).toBe("L");
    expect(prdContent.items[0].acceptanceCriteria).toContain("Install dependencies");
    expect(prdContent.items[0].acceptanceCriteria).toContain("Add environment variables");
    expect(prdContent.items[0].passes).toBe(false);

    // Second task
    expect(prdContent.items[1].title).toBe("Create endpoints");
    expect(prdContent.items[1].effort).toBe("M");
    expect(prdContent.items[1].risk).toBe("M");
    expect(prdContent.items[1].acceptanceCriteria).toContain("POST /login endpoint");

    // Third task (completed)
    expect(prdContent.items[2].title).toBe("Setup complete");
    expect(prdContent.items[2].passes).toBe(true);
  });

  it("should convert markdown with task IDs", async () => {
    const planContent = `# Project Plan

- [ ] 1.1.1: Configure build system
- [ ] 1.1.2: Set up testing framework
- [ ] 2.1.1: Implement core feature
- [x] 1.0.0: Initial setup
`;

    const planPath = await tempDir.write("plan.md", planContent);

    await runInit({
      planFile: tempDir.path("prd.json"),
      progressFile: tempDir.path("progress.txt"),
      promptFile: tempDir.path(".ralph-prompt.md"),
      pluginFile: tempDir.path(".opencode/plugin/ralph-write-guardrail.ts"),
      agentsFile: tempDir.path("AGENTS.md"),
      gitignoreFile: tempDir.path(".gitignore"),
      from: planPath,
    });

    const prdContent = await Bun.file(tempDir.path("prd.json")).json();

    expect(prdContent.items[0].id).toBe("1.1.1");
    expect(prdContent.items[0].description).toBe("Configure build system");
    expect(prdContent.items[1].id).toBe("1.1.2");
    expect(prdContent.items[2].id).toBe("2.1.1");
    expect(prdContent.items[3].id).toBe("1.0.0");
    expect(prdContent.items[3].passes).toBe(true);
  });

  it("should convert markdown with category tags", async () => {
    const planContent = `# Plan

- [ ] [backend] Create API endpoint
- [ ] [frontend] Build form component  
- [ ] [test] Add integration tests
- [x] [setup] Initialize project
`;

    const planPath = await tempDir.write("plan.md", planContent);

    await runInit({
      planFile: tempDir.path("prd.json"),
      progressFile: tempDir.path("progress.txt"),
      promptFile: tempDir.path(".ralph-prompt.md"),
      pluginFile: tempDir.path(".opencode/plugin/ralph-write-guardrail.ts"),
      agentsFile: tempDir.path("AGENTS.md"),
      gitignoreFile: tempDir.path(".gitignore"),
      from: planPath,
    });

    const prdContent = await Bun.file(tempDir.path("prd.json")).json();

    expect(prdContent.items[0].category).toBe("backend");
    expect(prdContent.items[1].category).toBe("frontend");
    expect(prdContent.items[2].category).toBe("test");
    expect(prdContent.items[3].category).toBe("setup");
  });

  it("should handle markdown with nested tasks (ignore as subtasks become criteria)", async () => {
    const planContent = `# Plan

- [ ] Setup database connection
  - [ ] Subtask 1 (becomes criteria)
  - [ ] Subtask 2 (becomes criteria)
- [x] Implement user authentication
`;

    const planPath = await tempDir.write("plan.md", planContent);

    await runInit({
      planFile: tempDir.path("prd.json"),
      progressFile: tempDir.path("progress.txt"),
      promptFile: tempDir.path(".ralph-prompt.md"),
      pluginFile: tempDir.path(".opencode/plugin/ralph-write-guardrail.ts"),
      agentsFile: tempDir.path("AGENTS.md"),
      gitignoreFile: tempDir.path(".gitignore"),
      from: planPath,
    });

    const prdContent = await Bun.file(tempDir.path("prd.json")).json();

    // Main tasks only
    expect(prdContent.items.length).toBeGreaterThanOrEqual(2);
  });

  it("should skip code blocks when parsing markdown", async () => {
    const planContent = `# Plan

- [ ] Real task 1

\`\`\`markdown
- [ ] Fake task in code block
- [x] Another fake task
\`\`\`

- [ ] Real task 2
`;

    const planPath = await tempDir.write("plan.md", planContent);

    await runInit({
      planFile: tempDir.path("prd.json"),
      progressFile: tempDir.path("progress.txt"),
      promptFile: tempDir.path(".ralph-prompt.md"),
      pluginFile: tempDir.path(".opencode/plugin/ralph-write-guardrail.ts"),
      agentsFile: tempDir.path("AGENTS.md"),
      gitignoreFile: tempDir.path(".gitignore"),
      from: planPath,
    });

    const prdContent = await Bun.file(tempDir.path("prd.json")).json();

    expect(prdContent.items).toHaveLength(2);
    expect(prdContent.items[0].description).toBe("Real task 1");
    expect(prdContent.items[1].description).toBe("Real task 2");
  });

  it("should handle Windows CRLF line endings", async () => {
    const planContent = "# Plan\r\n\r\n- [ ] Task one\r\n- [x] Task two\r\n- [ ] Task three\r\n";

    const planPath = await tempDir.write("plan.md", planContent);

    await runInit({
      planFile: tempDir.path("prd.json"),
      progressFile: tempDir.path("progress.txt"),
      promptFile: tempDir.path(".ralph-prompt.md"),
      pluginFile: tempDir.path(".opencode/plugin/ralph-write-guardrail.ts"),
      agentsFile: tempDir.path("AGENTS.md"),
      gitignoreFile: tempDir.path(".gitignore"),
      from: planPath,
    });

    const prdContent = await Bun.file(tempDir.path("prd.json")).json();

    expect(prdContent.items).toHaveLength(3);
    expect(prdContent.items[0].description).toBe("Task one");
    expect(prdContent.items[1].passes).toBe(true);
  });

  it("should preserve source file in metadata", async () => {
    const planContent = `- [ ] Simple task`;
    const planPath = await tempDir.write("my-plan.md", planContent);

    await runInit({
      planFile: tempDir.path("prd.json"),
      progressFile: tempDir.path("progress.txt"),
      promptFile: tempDir.path(".ralph-prompt.md"),
      pluginFile: tempDir.path(".opencode/plugin/ralph-write-guardrail.ts"),
      agentsFile: tempDir.path("AGENTS.md"),
      gitignoreFile: tempDir.path(".gitignore"),
      from: planPath,
    });

    const prdContent = await Bun.file(tempDir.path("prd.json")).json();

    expect(prdContent.metadata.sourceFile).toBe(planPath);
  });

  it("should handle complex real-world markdown plan", async () => {
    const planContent = `---
title: E-commerce Platform MVP
summary: Build minimum viable product for online store
estimatedEffort: 2-4 weeks
approach: Backend API first, then frontend, then integration
assumptions:
  - PostgreSQL database available
  - Stripe for payments
  - React frontend
---

# E-commerce MVP Plan

## Phase 1: Backend [effort: L]

- [ ] 1.1.1: **Database Schema** - Design and implement core data models [effort: M] [risk: M]
  - Create Product table
  - Create Order table  
  - Create User table
  - Add relationships and indexes

- [ ] 1.1.2: **Product API** - CRUD endpoints for products [effort: M] [risk: L]
  - GET /api/products (list)
  - GET /api/products/:id (detail)
  - POST /api/products (admin create)
  - PUT /api/products/:id (admin update)
  - DELETE /api/products/:id (admin delete)

- [ ] 1.2.1: **Cart API** - Shopping cart functionality [effort: M] [risk: M]
  - Add to cart
  - Remove from cart
  - Update quantity
  - Get cart contents

## Phase 2: Frontend [effort: M]

- [ ] 2.1.1: [ui] Product listing page [effort: S] [risk: L]
- [ ] 2.1.2: [ui] Product detail page [effort: S] [risk: L]
- [ ] 2.2.1: [ui] Shopping cart component [effort: M] [risk: M]
- [ ] 2.2.2: [ui] Checkout flow [effort: L] [risk: H]

## Phase 3: Integration [effort: S]

- [ ] 3.1.1: **Stripe Integration** - Payment processing [effort: M] [risk: H]
- [x] 3.0.0: **Project Setup** - Initial configuration [effort: XS] [risk: L]
`;

    const planPath = await tempDir.write("plan.md", planContent);

    const result = await runInit({
      planFile: tempDir.path("prd.json"),
      progressFile: tempDir.path("progress.txt"),
      promptFile: tempDir.path(".ralph-prompt.md"),
      pluginFile: tempDir.path(".opencode/plugin/ralph-write-guardrail.ts"),
      agentsFile: tempDir.path("AGENTS.md"),
      gitignoreFile: tempDir.path(".gitignore"),
      from: planPath,
    });

    const prdContent = await Bun.file(tempDir.path("prd.json")).json();

    // Verify metadata
    expect(prdContent.metadata.title).toBe("E-commerce Platform MVP");
    expect(prdContent.metadata.summary).toContain("minimum viable product");
    expect(prdContent.metadata.estimatedEffort).toBe("2-4 weeks");
    expect(prdContent.metadata.assumptions).toContain("PostgreSQL database available");

    // Should have at least the main tasks
    expect(prdContent.items.length).toBeGreaterThanOrEqual(8);

    // Check first task with full metadata
    const dbTask = prdContent.items.find((i: any) => i.id === "1.1.1");
    expect(dbTask).toBeDefined();
    expect(dbTask.title).toBe("Database Schema");
    expect(dbTask.effort).toBe("M");
    expect(dbTask.risk).toBe("M");
    expect(dbTask.acceptanceCriteria?.length).toBeGreaterThanOrEqual(3);

    // Check completed task
    const completedTask = prdContent.items.find((i: any) => i.id === "3.0.0");
    expect(completedTask).toBeDefined();
    expect(completedTask.passes).toBe(true);

    // Check UI tasks have category
    const uiTask = prdContent.items.find((i: any) => i.description?.includes("Product listing"));
    expect(uiTask?.category).toBe("ui");
  });
});
