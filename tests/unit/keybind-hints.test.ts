import { describe, it, expect } from "bun:test";
import { renderKeybindHints, getStartupKeybindHints } from "../../src/lib/keybind-hints";

describe("KeybindHints", () => {
  it("should render default keybinds", () => {
    const hints = renderKeybindHints({ colors: false, unicode: false });
    expect(hints).toContain("Ctrl+C Interrupt");
    expect(hints).toContain("T Terminal");
    expect(hints).toContain("Ctrl+\\ Force Quit");
    expect(hints).toContain("P Pause/Menu");
    expect(hints).toContain("Q Quit");
  });

  it("should respect exclusion list", () => {
    const hints = renderKeybindHints({ 
      exclude: ["pause", "quit"], 
      colors: false, 
      unicode: false 
    });
    expect(hints).toContain("Ctrl+C Interrupt");
    expect(hints).toContain("T Terminal");
    expect(hints).toContain("Ctrl+\\ Force Quit");
    expect(hints).not.toContain("P Pause/Menu");
    expect(hints).not.toContain("Q Quit");
  });

  it("should return empty string if all keybinds are excluded", () => {
    const hints = renderKeybindHints({ 
      exclude: ["interrupt", "terminal", "force_quit", "pause", "quit"], 
      colors: false 
    });
    expect(hints).toBe("");
  });

  it("should use unicode separators if requested", () => {
    const hints = renderKeybindHints({ colors: false, unicode: true });
    expect(hints).toContain("│"); // Unicode separator
  });

  it("should use ASCII separators if unicode is disabled", () => {
    const hints = renderKeybindHints({ colors: false, unicode: false });
    expect(hints).toContain("|"); // ASCII separator
  });

  it("should provide startup hints (excluding p and q)", () => {
    const hints = getStartupKeybindHints();
    // We can't easily test colors/unicode here as it depends on environment,
    // but we can check the content by stripping ANSI codes if needed.
    // For simplicity, just check that it doesn't contain the labels for p and q.
    const plainHints = hints.replace(/\x1b\[[0-9;]*m/g, "");
    expect(plainHints).toContain("Interrupt");
    expect(plainHints).toContain("Terminal");
    expect(plainHints).toContain("Force Quit");
    expect(plainHints).not.toContain("[P] Pause");
    expect(plainHints).not.toContain("[Q] Quit");
  });
});
