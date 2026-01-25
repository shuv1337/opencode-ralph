import { describe, it, expect } from "bun:test";
import { getRuntimeKeybindHints } from "../../src/lib/keybind-hints";

describe("Runtime KeybindHints", () => {
  it("should include Pause/Menu hint", () => {
    const hints = getRuntimeKeybindHints();
    // ANSI codes might make direct comparison tricky, check for text
    const plainHints = hints.replace(/\x1b\[[0-9;]*m/g, "");
    
    expect(plainHints).toContain("Pause/Menu");
    expect(plainHints).toContain(" P ");
  });

  it("should include all keybinds for runtime", () => {
    const hints = getRuntimeKeybindHints();
    const plainHints = hints.replace(/\x1b\[[0-9;]*m/g, "");
    
    expect(plainHints).toContain("Interrupt");
    expect(plainHints).toContain("Terminal");
    expect(plainHints).toContain("Force Quit");
    expect(plainHints).toContain("Quit");
  });
});
