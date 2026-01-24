import { clearTerminal } from "./ansi";
import { isVTSupported } from "./windows-console";
import { getCapabilities } from "./terminal-capabilities";
import { log } from "./log";

/**
 * TerminalService - Encapsulates terminal operations for layered architecture.
 * Provides robust terminal control with capability-aware fallbacks.
 */
export class TerminalService {
  private write: (text: string) => void;

  constructor(write?: (text: string) => void) {
    this.write = write ?? ((text: string) => process.stdout.write(text));
  }

  /**
   * Clear the terminal buffer with appropriate fallback for legacy terminals.
   * 
   * @param scrollback - Whether to clear the scrollback buffer
   */
  public clearBuffer(scrollback: boolean = true): void {
    try {
      const caps = getCapabilities();
      
      // Respect TTY and CI flags
      if (!caps.isInteractive || caps.isCI) {
        return;
      }

      if (isVTSupported()) {
        // Use ANSI sequences via utility
        clearTerminal(scrollback);
      } else {
        // Fallback for non-VT terminals: just a few newlines
        this.write("\n\n\n");
      }
    } catch (error) {
      log("terminal", "Failed to clear terminal buffer", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Set terminal title if supported.
   */
  public setTitle(title: string): void {
    if (isVTSupported()) {
      this.write(`\x1b]0;${title}\x07`);
    }
  }
}
