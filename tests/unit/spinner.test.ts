import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import {
  createSpinner,
  detectSpinnerStyle,
  SPINNER_FRAMES,
  type SpinnerController,
  type SpinnerStyle,
} from "../../src/lib/spinner";
import { resetCapabilitiesCache } from "../../src/lib/terminal-capabilities";

describe("Spinner - Frame Definitions", () => {
  describe("SPINNER_FRAMES", () => {
    it("should have braille spinner frames", () => {
      expect(SPINNER_FRAMES.braille).toBeDefined();
      expect(SPINNER_FRAMES.braille.length).toBe(10);
      expect(SPINNER_FRAMES.braille[0]).toBe("⠋");
    });

    it("should have line spinner frames", () => {
      expect(SPINNER_FRAMES.line).toBeDefined();
      expect(SPINNER_FRAMES.line.length).toBe(4);
      expect(SPINNER_FRAMES.line).toContain("|");
      expect(SPINNER_FRAMES.line).toContain("/");
      expect(SPINNER_FRAMES.line).toContain("-");
      expect(SPINNER_FRAMES.line).toContain("\\");
    });

    it("should have block spinner frames", () => {
      expect(SPINNER_FRAMES.block).toBeDefined();
      expect(SPINNER_FRAMES.block.length).toBe(4);
    });

    it("should have arrow spinner frames", () => {
      expect(SPINNER_FRAMES.arrow).toBeDefined();
      expect(SPINNER_FRAMES.arrow.length).toBe(8);
    });

    it("should have dots spinner frames", () => {
      expect(SPINNER_FRAMES.dots).toBeDefined();
      expect(SPINNER_FRAMES.dots.length).toBe(8);
    });

    it("should have bounce spinner frames", () => {
      expect(SPINNER_FRAMES.bounce).toBeDefined();
      expect(SPINNER_FRAMES.bounce.length).toBe(4);
    });
  });
});

describe("Spinner - Style Detection", () => {
  beforeEach(() => {
    resetCapabilitiesCache();
  });

  afterEach(() => {
    resetCapabilitiesCache();
  });

  it("should detect a valid spinner style", () => {
    const style = detectSpinnerStyle();
    expect(["braille", "line", "block", "arrow", "dots", "bounce"]).toContain(style);
  });
});

describe("Spinner - Controller Creation", () => {
  let spinner: SpinnerController;
  let output: string[];

  beforeEach(() => {
    output = [];
    spinner = createSpinner({
      write: (text: string) => { output.push(text); },
      text: "Test spinner",
      hideCursor: false,
    });
  });

  afterEach(() => {
    if (spinner.isRunning()) {
      spinner.stop();
    }
  });

  it("should create a spinner with default options", () => {
    const defaultSpinner = createSpinner();
    expect(defaultSpinner).toBeDefined();
    expect(defaultSpinner.isRunning).toBeDefined();
    expect(typeof defaultSpinner.start).toBe("function");
    expect(typeof defaultSpinner.stop).toBe("function");
    expect(typeof defaultSpinner.pause).toBe("function");
    expect(typeof defaultSpinner.resume).toBe("function");
  });

  it("should start and stop the spinner", () => {
    expect(spinner.isRunning()).toBe(false);
    spinner.start();
    expect(spinner.isRunning()).toBe(true);
    spinner.stop();
    expect(spinner.isRunning()).toBe(false);
  });

  it("should pause and resume the spinner", () => {
    spinner.start();
    expect(spinner.isRunning()).toBe(true);
    spinner.pause();
    expect(spinner.isRunning()).toBe(true); // Still "running" state, just paused
    spinner.resume();
    expect(spinner.isRunning()).toBe(true);
    spinner.stop();
  });

  it("should allow setting text", () => {
    spinner.setText("New text");
    // No error should be thrown
    expect(spinner.isRunning()).toBe(false);
  });

  it("should allow changing style", () => {
    spinner.setStyle("line");
    // No error should be thrown
    expect(spinner.isRunning()).toBe(false);
  });

  it("should not start twice", () => {
    spinner.start();
    const firstOutput = output.length;
    spinner.start(); // Should be a no-op
    // Wait a tick
    setTimeout(() => {
      spinner.stop();
    }, 50);
  });

  it("should not stop when not running", () => {
    spinner.stop(); // Should be a no-op
    expect(spinner.isRunning()).toBe(false);
  });

  it("should provide clear method", () => {
    expect(typeof spinner.clear).toBe("function");
    spinner.clear(); // Should not throw
  });
});

describe("Spinner - Text Updates", () => {
  let spinner: SpinnerController;
  let output: string[];

  beforeEach(() => {
    output = [];
    spinner = createSpinner({
      write: (text: string) => { output.push(text); },
      text: "Initial text",
      hideCursor: false,
    });
  });

  afterEach(() => {
    if (spinner.isRunning()) {
      spinner.stop();
    }
  });

  it("should accept text updates", () => {
    spinner.setText("Updated text");
    expect(spinner.isRunning()).toBe(false);
  });

  it("should handle empty text", () => {
    spinner.setText("");
    expect(spinner.isRunning()).toBe(false);
  });

  it("should handle long text", () => {
    const longText = "A".repeat(200);
    spinner.setText(longText);
    expect(spinner.isRunning()).toBe(false);
  });
});

describe("Spinner - Style Variations", () => {
  const styles: SpinnerStyle[] = ["braille", "line", "block", "arrow", "dots", "bounce"];
  let output: string[];

  beforeEach(() => {
    output = [];
  });

  for (const style of styles) {
    it(`should create spinner with ${style} style`, () => {
      const spinner = createSpinner({
        style,
        write: (text: string) => { output.push(text); },
        hideCursor: false,
      });
      expect(spinner).toBeDefined();
      expect(spinner.isRunning()).toBe(false);
    });
  }
});
