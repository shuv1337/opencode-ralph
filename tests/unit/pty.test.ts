import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { spawnPty } from "../../src/pty/spawn";

describe("spawnPty", () => {
  let originalSpawn: typeof Bun.spawn;

  beforeEach(() => {
    originalSpawn = Bun.spawn;
  });

  afterEach(() => {
    Bun.spawn = originalSpawn;
  });

  it("spawns with PTY settings and drains output", async () => {
    let capturedOptions: any;
    const outputChunks: string[] = [];
    let terminalData: ((terminal: unknown, data: string) => void) | undefined;

    Bun.spawn = ((command: string[], options: any) => {
      capturedOptions = options;
      terminalData = options.terminal?.data;
      return {
        terminal: {
          write: (_data: string) => {},
          resize: (_cols: number, _rows: number) => {},
          close: () => {},
        },
        stdout: null,
        stderr: null,
        stdin: null,
        pid: 123,
        kill: () => {},
        exited: Promise.resolve(0),
      } as any;
    }) as any;

    const pty = spawnPty(["echo", "hi"], {
      cols: 100,
      rows: 40,
      cwd: "/tmp",
      env: { FOO: "bar" },
    });

    pty.onData((data) => outputChunks.push(data));

    terminalData?.({} as any, "out");
    terminalData?.({} as any, "err");

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(capturedOptions.terminal.cols).toBe(100);
    expect(capturedOptions.terminal.rows).toBe(40);
    expect(capturedOptions.env.TERM).toBe("xterm-256color");
    expect(capturedOptions.env.COLUMNS).toBe("100");
    expect(capturedOptions.env.LINES).toBe("40");
    expect(outputChunks.join("")).toBe("outerr");
  });
});
