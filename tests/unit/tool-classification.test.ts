import { describe, it, expect } from "bun:test";
import { 
  getToolClassification, 
  TOOL_CLASSIFICATIONS,
  parseMcpToolName
} from "../../src/lib/tool-classification";

describe("Tool Classification", () => {
  it("should return correct classification for known tools", () => {
    const read = getToolClassification("read");
    expect(read.category).toBe("file");
    expect(read.displayName).toBe("Read");
    expect(read.icon).toBe("󰈞");

    const bash = getToolClassification("bash");
    expect(bash.category).toBe("execute");
    expect(bash.displayName).toBe("Bash");
  });

  it("should be case-insensitive", () => {
    const read1 = getToolClassification("READ");
    const read2 = getToolClassification("read");
    expect(read1).toEqual(read2);
  });

  it("should return a custom classification for unknown tools", () => {
    const unknown = getToolClassification("my-cool-tool");
    expect(unknown.category).toBe("custom");
    expect(unknown.displayName).toBe("my-cool-tool");
    expect(unknown.fallbackIcon).toBe("[MY-COOL-TOOL]");
  });

  it("should have classifications for all standard OpenCode tools", () => {
    const standardTools = ["read", "write", "edit", "glob", "grep", "bash", "task"];
    for (const tool of standardTools) {
      expect(TOOL_CLASSIFICATIONS[tool]).toBeDefined();
    }
  });
});

describe("MCP Tool Parsing", () => {
  it("should detect MCP tools by their naming pattern", () => {
    const result = parseMcpToolName("tavily_search");
    expect(result.isMcp).toBe(true);
    expect(result.serverName).toBe("tavily");
    expect(result.actionName).toBe("search");
  });

  it("should auto-capitalize server names", () => {
    const result = parseMcpToolName("tavily_extract");
    expect(result.isMcp).toBe(true);
    expect(result.serverDisplayName).toBe("Tavily");
  });

  it("should handle context7 tools", () => {
    const result = parseMcpToolName("context7_query-docs");
    expect(result.isMcp).toBe(true);
    expect(result.serverName).toBe("context7");
    expect(result.actionName).toBe("query-docs");
    expect(result.serverDisplayName).toBe("Context7");
  });

  it("should handle exa tools", () => {
    const result = parseMcpToolName("exa_get_code_context_exa");
    expect(result.isMcp).toBe(true);
    expect(result.serverName).toBe("exa");
    expect(result.actionName).toBe("get_code_context_exa");
    expect(result.serverDisplayName).toBe("Exa");
  });

  it("should handle gh tools with auto-capitalization", () => {
    const result = parseMcpToolName("gh_grep_searchGitHub");
    expect(result.isMcp).toBe(true);
    expect(result.serverName).toBe("gh");
    expect(result.actionName).toBe("grep_searchGitHub");
    expect(result.serverDisplayName).toBe("Gh");
  });

  it("should capitalize unknown server names", () => {
    const result = parseMcpToolName("myserver_dothing");
    expect(result.isMcp).toBe(true);
    expect(result.serverName).toBe("myserver");
    expect(result.serverDisplayName).toBe("Myserver");
  });

  it("should not detect non-MCP tools", () => {
    expect(parseMcpToolName("read").isMcp).toBe(false);
    expect(parseMcpToolName("bash").isMcp).toBe(false);
    expect(parseMcpToolName("my-cool-tool").isMcp).toBe(false);
    // No underscore
    expect(parseMcpToolName("tavilysearch").isMcp).toBe(false);
  });

  it("should not detect tools starting with underscore", () => {
    expect(parseMcpToolName("_private_tool").isMcp).toBe(false);
  });

  it("should not detect tools starting with numbers", () => {
    expect(parseMcpToolName("123_tool").isMcp).toBe(false);
  });
});

describe("MCP Tool Classification", () => {
  it("should classify MCP tools as 'mcp' category", () => {
    const classification = getToolClassification("tavily_search");
    expect(classification.category).toBe("mcp");
  });

  it("should format MCP tool display names properly", () => {
    const tavily = getToolClassification("tavily_search");
    expect(tavily.displayName).toBe("Tavily: Search");

    const context7 = getToolClassification("context7_query-docs");
    expect(context7.displayName).toBe("Context7: Query Docs");

    const gh = getToolClassification("gh_grep_searchGitHub");
    expect(gh.displayName).toBe("Gh: Grep SearchGitHub");
  });

  it("should use toolMcp as color key for MCP tools", () => {
    const classification = getToolClassification("tavily_search");
    expect(classification.color).toBe("toolMcp");
  });

  it("should provide proper fallback icons for MCP tools", () => {
    const tavily = getToolClassification("tavily_search");
    expect(tavily.fallbackIcon).toBe("[TAVILY]");

    const context7 = getToolClassification("context7_resolve-library-id");
    expect(context7.fallbackIcon).toBe("[CONTEXT7]");
  });

  it("should animate MCP tools", () => {
    const classification = getToolClassification("tavily_search");
    expect(classification.animated).toBe(true);
  });
});
