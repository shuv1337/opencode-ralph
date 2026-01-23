/**
 * Requirements validation module for OpenRalph.
 *
 * Validates that all prerequisites are met before allowing the user
 * to start the automation loop (e.g., plan file exists).
 *
 * Cross-platform compatible: Windows, macOS, Linux.
 */

/**
 * Result of validating OpenRalph requirements.
 */
export interface RequirementsResult {
  /** Whether all requirements are satisfied */
  valid: boolean;
  /** List of missing requirements (e.g., file paths) */
  missing: string[];
  /** Human-readable message describing the validation result */
  message: string;
}

/**
 * Validate that all OpenRalph prerequisites are met.
 *
 * Currently checks:
 * - Plan file exists (e.g., prd.json)
 *
 * @param planFile - Path to the plan file to validate
 * @returns RequirementsResult with validation status
 *
 * @example
 * ```typescript
 * const result = await validateRequirements('./prd.json');
 * if (!result.valid) {
 *   console.error(formatRequirementsError(result));
 *   process.exit(1);
 * }
 * ```
 */
export async function validateRequirements(
  planFile: string
): Promise<RequirementsResult> {
  const missing: string[] = [];

  try {
    // Use Bun.file() to check if the plan file exists
    const file = Bun.file(planFile);
    const exists = await file.exists();

    if (!exists) {
      missing.push(planFile);
    }
  } catch (error) {
    // Handle file system errors gracefully
    // If we can't check the file, treat it as missing
    missing.push(planFile);
  }

  if (missing.length === 0) {
    return {
      valid: true,
      missing: [],
      message: "All requirements satisfied",
    };
  }

  return {
    valid: false,
    missing,
    message: `Missing required file: ${planFile}`,
  };
}

/**
 * Format a requirements error for display to the user.
 *
 * Provides consistent, user-friendly error messaging for missing prerequisites.
 *
 * @param result - The RequirementsResult from validateRequirements()
 * @returns Formatted error message string
 *
 * @example
 * ```typescript
 * const result = await validateRequirements('./prd.json');
 * if (!result.valid) {
 *   console.error(formatRequirementsError(result));
 * }
 * ```
 */
export function formatRequirementsError(result: RequirementsResult): string {
  if (result.valid) {
    return "";
  }

  const lines: string[] = [
    "Cannot start: missing prerequisites",
    "",
  ];

  for (const file of result.missing) {
    lines.push(`  - Plan file not found: ${file}`);
  }

  lines.push("");
  lines.push("Create the plan file or specify a different path with --plan");

  return lines.join("\n");
}
