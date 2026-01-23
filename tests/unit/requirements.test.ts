import { describe, it, expect, afterAll } from "bun:test";
import { validateRequirements, formatRequirementsError } from "../../src/lib/requirements";
import { join } from "path";
import { tmpdir } from "os";
import { unlinkSync, writeFileSync } from "fs";

describe("requirements", () => {
  const tempFiles: string[] = [];

  const createTempFile = (content: string = "test", prefix: string = "test-plan") => {
    const filePath = join(tmpdir(), `${prefix}-${Date.now()}-${Math.random().toString(36).substring(7)}.json`);
    writeFileSync(filePath, content);
    tempFiles.push(filePath);
    return filePath;
  };

  afterAll(() => {
    for (const file of tempFiles) {
      try {
        unlinkSync(file);
      } catch (e) {
        // Ignore errors during cleanup
      }
    }
  });

  describe("validateRequirements", () => {
    it("should return valid: true when the file exists", async () => {
      const tempFile = createTempFile();
      const result = await validateRequirements(tempFile);
      
      expect(result.valid).toBe(true);
      expect(result.missing).toEqual([]);
      expect(result.message).toBe("All requirements satisfied");
    });

    it("should return valid: false when the file does not exist", async () => {
      const nonExistentPath = join(tmpdir(), `non-existent-${Date.now()}.json`);
      const result = await validateRequirements(nonExistentPath);
      
      expect(result.valid).toBe(false);
      expect(result.missing).toContain(nonExistentPath);
      expect(result.message).toBe(`Missing required file: ${nonExistentPath}`);
    });

    it("should handle an empty file path", async () => {
      const result = await validateRequirements("");
      
      expect(result.valid).toBe(false);
      expect(result.missing).toContain("");
      expect(result.message).toBe("Missing required file: ");
    });

    it("should handle paths with spaces and special characters", async () => {
      const specialPath = createTempFile("test", "plan with spaces & special $ chars");
      const result = await validateRequirements(specialPath);
      
      expect(result.valid).toBe(true);
      expect(result.missing).toEqual([]);
    });

    it("should return the correct RequirementsResult structure", async () => {
      const tempFile = createTempFile();
      const result = await validateRequirements(tempFile);
      
      expect(result).toHaveProperty("valid");
      expect(result).toHaveProperty("missing");
      expect(result).toHaveProperty("message");
      expect(Array.isArray(result.missing)).toBe(true);
      expect(typeof result.valid).toBe("boolean");
      expect(typeof result.message).toBe("string");
    });
  });

  describe("formatRequirementsError", () => {
    it("should return an empty string for a valid result", () => {
      const result = {
        valid: true,
        missing: [],
        message: "All good"
      };
      
      const formatted = formatRequirementsError(result);
      expect(formatted).toBe("");
    });

    it("should format a single missing requirement correctly", () => {
      const result = {
        valid: false,
        missing: ["prd.json"],
        message: "Missing required file: prd.json"
      };
      
      const formatted = formatRequirementsError(result);
      expect(formatted).toContain("Cannot start: missing prerequisites");
      expect(formatted).toContain("- Plan file not found: prd.json");
      expect(formatted).toContain("Create the plan file or specify a different path with --plan");
    });

    it("should format multiple missing requirements correctly", () => {
      const result = {
        valid: false,
        missing: ["prd.json", "env.json"],
        message: "Multiple missing files"
      };
      
      const formatted = formatRequirementsError(result);
      expect(formatted).toContain("Cannot start: missing prerequisites");
      expect(formatted).toContain("- Plan file not found: prd.json");
      expect(formatted).toContain("- Plan file not found: env.json");
    });
  });
});
