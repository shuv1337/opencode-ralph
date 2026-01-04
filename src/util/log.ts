/**
 * Debug logging utility for ralph
 * Logs are written to .ralph.log file
 */
import { appendFileSync, writeFileSync, existsSync } from "node:fs";

export const LOG_FILE = ".ralph.log";

let initialized = false;

/**
 * Initialize the log file. Call with reset=true to clear existing logs.
 */
export function initLog(reset: boolean = false): void {
  if (reset || !existsSync(LOG_FILE)) {
    writeFileSync(
      LOG_FILE,
      `=== Ralph Log Started: ${new Date().toISOString()} ===\n`
    );
  } else {
    appendFileSync(
      LOG_FILE,
      `\n=== Ralph Session Resumed: ${new Date().toISOString()} ===\n`
    );
  }
  initialized = true;
}

/**
 * Log a message with timestamp to .ralph.log
 */
export function log(category: string, message: string, data?: unknown): void {
  if (!initialized) {
    initLog(false);
  }

  const timestamp = new Date().toISOString();
  let line = `[${timestamp}] [${category}] ${message}`;
  if (data !== undefined) {
    try {
      line += ` ${JSON.stringify(data)}`;
    } catch {
      line += ` [unstringifiable data]`;
    }
  }

  try {
    appendFileSync(LOG_FILE, line + "\n");
  } catch {
    // Silently fail if we can't write logs
  }
}
