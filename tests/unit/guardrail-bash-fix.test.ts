/**
 * Unit tests for the guardrail bash command detection fix.
 *
 * Tests the fix for the false positive issue where commit messages containing
 * words like "Crossterm" would incorrectly trigger the "rm " keyword check.
 *
 * Root cause: The original implementation did naive string matching on the
 * entire command including commit messages, so "Crossterm " matched "rm ".
 *
 * Fix: Strip quoted content before keyword checks, use word-boundary patterns.
 */
import { describe, it, expect } from "bun:test";
import { PLUGIN_TEMPLATE } from "../../src/templates/plugin-template";

describe("Guardrail Bash Command Detection Fix", () => {
  describe("Template contains required functions", () => {
    it("includes stripQuotedContent function", () => {
      expect(PLUGIN_TEMPLATE).toContain("function stripQuotedContent(command: string): string");
    });

    it("stripQuotedContent handles double quotes", () => {
      // Check that the template contains a pattern for removing double-quoted strings
      // The exact escaping varies, so just check for the key parts
      expect(PLUGIN_TEMPLATE).toContain('result.replace(/');
      expect(PLUGIN_TEMPLATE).toContain('""');
    });

    it("stripQuotedContent handles single quotes", () => {
      expect(PLUGIN_TEMPLATE).toContain("'[^']*'");
    });
  });

  describe("Template contains git-specific patterns", () => {
    it("includes git rm pattern", () => {
      expect(PLUGIN_TEMPLATE).toContain("git rm");
      expect(PLUGIN_TEMPLATE).toContain("/git\\\\s+rm\\\\s+.*\\\\b(FILENAME)\\\\b/");
    });

    it("includes git mv pattern", () => {
      expect(PLUGIN_TEMPLATE).toContain("git mv");
      expect(PLUGIN_TEMPLATE).toContain("/git\\\\s+mv\\\\s+.*\\\\b(FILENAME)\\\\b/");
    });
  });

  describe("wouldModifyProtectedFile uses two-phase approach", () => {
    it("calls stripQuotedContent", () => {
      expect(PLUGIN_TEMPLATE).toContain("const unquotedCommand = stripQuotedContent(command)");
    });

    it("checks unquotedCommand for protected file presence", () => {
      expect(PLUGIN_TEMPLATE).toContain("if (unquotedCommand.includes(protectedFile))");
    });

    it("uses word-boundary patterns for dangerous commands", () => {
      // The patterns should use (?:^|[;&|]) to match command start/separator
      expect(PLUGIN_TEMPLATE).toContain("(?:^|[;&|])");
      expect(PLUGIN_TEMPLATE).toContain("rm\\\\s");
      expect(PLUGIN_TEMPLATE).toContain("mv\\\\s");
    });

    it("documents the two-phase approach", () => {
      expect(PLUGIN_TEMPLATE).toContain("Phase 1:");
      expect(PLUGIN_TEMPLATE).toContain("Phase 2:");
    });
  });

  describe("Dangerous patterns documentation", () => {
    it("mentions Crossterm as a false positive example", () => {
      expect(PLUGIN_TEMPLATE).toContain("Crossterm");
    });

    it("explains the commit message false positive issue", () => {
      expect(PLUGIN_TEMPLATE).toContain("commit messages");
    });
  });
});

describe("stripQuotedContent function behavior", () => {
  // Create a test implementation matching the template
  const stripQuotedContent = (command: string): string => {
    let result = command;
    // Matches the template regex: "(?:[^"\\]|\\.)*"
    result = result.replace(/"(?:[^"\\]|\\.)*"/g, '""');
    result = result.replace(/'[^']*'/g, "''");
    return result;
  };

  it("removes double-quoted content", () => {
    expect(stripQuotedContent('git commit -m "message"')).toBe('git commit -m ""');
  });

  it("removes single-quoted content", () => {
    expect(stripQuotedContent("echo 'hello world'")).toBe("echo ''");
  });

  it("handles escaped quotes in double quotes", () => {
    expect(stripQuotedContent('echo "test \\"nested\\" quote"')).toBe('echo ""');
  });

  it("preserves unquoted content", () => {
    expect(stripQuotedContent("rm file.txt")).toBe("rm file.txt");
  });

  it("handles multiple quoted sections", () => {
    expect(stripQuotedContent('git add "file1" && git commit -m "msg"')).toBe(
      'git add "" && git commit -m ""'
    );
  });

  it("removes Crossterm from commit messages", () => {
    const cmd = 'git commit -m "Using Crossterm for TUI"';
    const stripped = stripQuotedContent(cmd);
    expect(stripped).toBe('git commit -m ""');
    expect(stripped).not.toContain("Crossterm");
  });

  it("removes AGENTS.md mention from commit messages", () => {
    const cmd = 'git commit -m "Updated AGENTS.md with docs"';
    const stripped = stripQuotedContent(cmd);
    expect(stripped).toBe('git commit -m ""');
    expect(stripped).not.toContain("AGENTS.md");
  });
});

describe("Dangerous pattern matching", () => {
  // Test implementations matching template patterns
  const dangerousPatterns = [
    /(?:^|[;&|])\s*rm\s/,
    /(?:^|[;&|])\s*mv\s/,
    /(?:^|[;&|])\s*truncate\s/,
    /(?:^|[;&|])\s*shred\s/,
    />\s*$/,
    />>\s*$/,
  ];

  const matchesDangerous = (cmd: string): boolean => {
    return dangerousPatterns.some((p) => p.test(cmd));
  };

  describe("should match actual dangerous commands", () => {
    it("matches rm at command start", () => {
      expect(matchesDangerous("rm file.txt")).toBe(true);
    });

    it("matches rm after semicolon", () => {
      expect(matchesDangerous("echo test; rm file")).toBe(true);
    });

    it("matches rm after pipe", () => {
      expect(matchesDangerous("echo | rm file")).toBe(true);
    });

    it("matches rm after &&", () => {
      expect(matchesDangerous("echo && rm file")).toBe(true);
    });

    it("matches mv command", () => {
      expect(matchesDangerous("mv old.txt new.txt")).toBe(true);
    });

    it("matches redirect at end", () => {
      expect(matchesDangerous("echo test >")).toBe(true);
    });
  });

  describe("should NOT match false positives", () => {
    it("does not match Crossterm", () => {
      expect(matchesDangerous("Crossterm stuff")).toBe(false);
    });

    it("does not match platform", () => {
      expect(matchesDangerous("cross-platform docs")).toBe(false);
    });

    it("does not match transform", () => {
      expect(matchesDangerous("data transform")).toBe(false);
    });

    it("does not match inform", () => {
      expect(matchesDangerous("to inform users")).toBe(false);
    });

    it("does not match firm", () => {
      expect(matchesDangerous("confirm action")).toBe(false);
    });

    it("does not match random word ending in rm", () => {
      expect(matchesDangerous("alarm system")).toBe(false);
    });
  });
});

describe("End-to-end guardrail behavior", () => {
  // Simulate the full wouldModifyProtectedFile logic
  const PROTECTED_FILES = ["prd.json", "progress.txt", ".ralph-prompt.md", "AGENTS.md"];

  const stripQuotedContent = (command: string): string => {
    let result = command;
    result = result.replace(/"(?:[^"\\]|\\.)*"/g, '""');
    result = result.replace(/'[^']*'/g, "''");
    return result;
  };

  const DESTRUCTIVE_PATTERNS = [
    /^rm\s+.*\b(FILENAME)\b/,
    /^rm\s+-[rf]+\s+.*\b(FILENAME)\b/,
    /^mv\s+.*\b(FILENAME)\b/,
    /[>|]\s*(FILENAME)\b/,
    /^truncate\s+.*\b(FILENAME)\b/,
    /^shred\s+.*\b(FILENAME)\b/,
    /git\s+rm\s+.*\b(FILENAME)\b/,
    /git\s+mv\s+.*\b(FILENAME)\b/,
  ];

  const dangerousPatterns = [
    /(?:^|[;&|])\s*rm\s/,
    /(?:^|[;&|])\s*mv\s/,
    /(?:^|[;&|])\s*truncate\s/,
    /(?:^|[;&|])\s*shred\s/,
    />\s*$/,
    />>\s*$/,
  ];

  const wouldModifyProtectedFile = (command: string): string | null => {
    const unquotedCommand = stripQuotedContent(command);

    for (const protectedFile of PROTECTED_FILES) {
      const escapedFileName = protectedFile.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      // Phase 1: Regex patterns against full command
      for (const patternTemplate of DESTRUCTIVE_PATTERNS) {
        const pattern = new RegExp(
          patternTemplate.source.replace(/FILENAME/g, escapedFileName),
          patternTemplate.flags
        );
        if (pattern.test(command)) {
          return protectedFile;
        }
      }

      // Phase 2: Unquoted command keyword check
      if (unquotedCommand.includes(protectedFile)) {
        for (const pattern of dangerousPatterns) {
          if (pattern.test(unquotedCommand)) {
            return protectedFile;
          }
        }
      }
    }
    return null;
  };

  describe("should ALLOW safe commands", () => {
    it("allows git commit with protected file mentioned in message", () => {
      const cmd = 'git commit -m "Updated AGENTS.md with Crossterm docs"';
      expect(wouldModifyProtectedFile(cmd)).toBeNull();
    });

    it("allows git log on protected file", () => {
      expect(wouldModifyProtectedFile("git log AGENTS.md")).toBeNull();
    });

    it("allows git diff on protected file", () => {
      expect(wouldModifyProtectedFile("git diff prd.json")).toBeNull();
    });

    it("allows git show on protected file", () => {
      expect(wouldModifyProtectedFile("git show HEAD:AGENTS.md")).toBeNull();
    });

    it("allows git add with no protected files", () => {
      expect(wouldModifyProtectedFile("git add src/index.ts")).toBeNull();
    });

    it("allows complex commit message with Crossterm", () => {
      const cmd = `git add docs/architecture/DECISIONS.md && git commit -m "docs(architecture): add technology decisions documentation
Create comprehensive DECISIONS.md documenting technology rationale for:
- BLAKE3 hashing (8.4 GB/s, multi-threaded, cryptographic)
- jwalk directory walking (4x faster than walkdir)
- Ratatui + Crossterm TUI (cross-platform requirement)
- Clap v4 CLI parsing (derive macros, shell completions)
- trash crate for safe deletion (native OS integration)
- anyhow + thiserror error handling
- Rayon parallel processing
Each section includes alternatives considered, rationale, and
cross-platform considerations. Also updated AGENTS.md with project
configuration and 6 documented gotchas.
Task-Id: 1.1.1"`;
      expect(wouldModifyProtectedFile(cmd)).toBeNull();
    });
  });

  describe("should BLOCK dangerous commands", () => {
    it("blocks rm of protected file", () => {
      expect(wouldModifyProtectedFile("rm AGENTS.md")).toBe("AGENTS.md");
    });

    it("blocks rm -rf of protected file", () => {
      expect(wouldModifyProtectedFile("rm -rf prd.json")).toBe("prd.json");
    });

    it("blocks mv of protected file", () => {
      expect(wouldModifyProtectedFile("mv AGENTS.md backup.md")).toBe("AGENTS.md");
    });

    it("blocks redirect to protected file", () => {
      expect(wouldModifyProtectedFile("echo test > prd.json")).toBe("prd.json");
    });

    it("blocks git rm of protected file", () => {
      expect(wouldModifyProtectedFile("git rm AGENTS.md")).toBe("AGENTS.md");
    });

    it("blocks git mv of protected file", () => {
      expect(wouldModifyProtectedFile("git mv prd.json old-prd.json")).toBe("prd.json");
    });

    it("blocks truncate of protected file", () => {
      expect(wouldModifyProtectedFile("truncate -s 0 progress.txt")).toBe("progress.txt");
    });

    it("blocks shred of protected file", () => {
      expect(wouldModifyProtectedFile("shred AGENTS.md")).toBe("AGENTS.md");
    });
  });
});
