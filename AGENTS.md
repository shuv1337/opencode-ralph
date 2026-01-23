# AGENTS.md - Critical Operational Details

## TypeScript Configuration

When using `@opentui/solid`, the `jsxImportSource` must be set to `"@opentui/solid"`, NOT `"solid-js"`. The plan.md incorrectly specifies `solid-js` but the actual requirement from the OpenTUI documentation is:

```json
{
  "compilerOptions": {
    "jsx": "preserve",
    "jsxImportSource": "@opentui/solid"
  }
}
```

Additionally, a `bunfig.toml` preload is required:

```toml
preload = ["@opentui/solid/preload"]
```

## Dependencies

The package.json uses `@types/bun` (modern approach) which doesn't require explicitly listing `bun-types` in the tsconfig's `types` array. The types are discovered automatically.

## OpenTUI Configuration

When using `@opentui/solid` for CLI TUI rendering, use these render options:

```typescript
render(
  () => <App />,
  {
    targetFps: 30,           // Balance between smoothness and CPU usage
    gatherStats: false,      // Disable stats gathering for performance
    exitOnCtrlC: false,      // Handle Ctrl+C manually via useKeyboard
    useKittyKeyboard: {},    // Enable Kitty keyboard protocol
  }
);
```

**Critical pattern**: Call `renderer.disableStdoutInterception()` immediately after `useRenderer()` to prevent OpenTUI from capturing stdout, which can interfere with logging.

## Keyboard Handling

**Known Issue**: The `onMount` lifecycle hook in `@opentui/solid` does NOT fire reliably on Windows. Since `useKeyboard` registers its handler inside `onMount`, keyboard events may not work through OpenTUI's native keyboard handling.

**Workaround**: Implement a fallback stdin handler that activates after a timeout if no OpenTUI keyboard events are received:

```typescript
// In src/index.ts
let keyboardWorking = false;
const keyboardTimeout = setTimeout(() => {
  if (!keyboardWorking && process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on("data", (data) => {
      if (keyboardWorking) return; // OpenTUI took over
      const key = data.toString();
      if (key === "q" || key === "\x03") { /* quit */ }
      if (key === "p") { /* pause */ }
    });
  }
}, 5000);

// Pass callback to App to signal when OpenTUI keyboard works
onKeyboardEvent: () => { keyboardWorking = true; clearTimeout(keyboardTimeout); }
```

**Key event typing**: Import `KeyEvent` from `@opentui/core` for proper typing in `useKeyboard` callbacks:

```typescript
import type { KeyEvent } from "@opentui/core";
useKeyboard((e: KeyEvent) => {
  if (e.name === "q" && !e.ctrl && !e.meta) { /* quit */ }
});
```

## Windows-Specific Considerations

1. **Keepalive interval**: Windows may terminate the process prematurely if there's no activity. Use a keepalive interval:
   ```typescript
   const keepalive = setInterval(() => {}, 30000);
   // Clear in finally block: clearInterval(keepalive);
   ```

2. **Defensive requestRender**: Call `renderer.requestRender?.()` after state updates on Windows where automatic redraw can stall.

3. **TTY checks**: Always check `process.stdin.isTTY` before calling `setRawMode(true)`.

4. **Terminal title reset**: Call `renderer.setTerminalTitle("")` before `renderer.destroy()` to reset the window title on exit.

5. **Orphan Text Nodes**: In OpenTUI's Solid renderer, all text nodes and text components like `<span>` and `<b>` MUST be children of a `<text>` component. Rendering text or spans directly inside a `<box>` or `<scrollbox>` will cause an "Orphan text error" uncaught exception.
   ```tsx
   // WRONG - will cause Orphan text error
   <box><span>Hello</span></box>
   
   // CORRECT
   <box><text><span>Hello</span></text></box>
   ```

## macOS-Specific Considerations

1. **Path Conventions**: macOS uses `~/Library/` paths:
   - Logs: `~/Library/Logs/Ralph/`
   - Config/State: `~/Library/Application Support/Ralph/`
   - Cache: `~/Library/Caches/Ralph/`

2. **Terminal Detection**: Check `TERM_PROGRAM` environment variable:
   - `Apple_Terminal` = Terminal.app (limited capabilities)
   - `iTerm.app` = iTerm2 (full Kitty protocol support)
   - `ghostty` = Ghostty (full support)

3. **Terminal.app Limitations**:
   - No Kitty keyboard protocol support
   - No modifyOtherKeys support
   - Falls back to raw stdin keyboard handling
   - Keyboard fallback timeout: 3 seconds (vs 5s for other Unix terminals)

4. **Process Management**:
   - Use `lsof -i :PORT -sTCP:LISTEN -t` to find process by port (netstat doesn't show PIDs on macOS)
   - SIGHUP is sent when Terminal.app window closes - handle for cleanup

5. **PTY Environment Variables**: Preserve these for child processes:
   - `TERM_PROGRAM` - Terminal detection
   - `TERM_PROGRAM_VERSION` - Version info
   - `LANG` / `LC_ALL` - UTF-8 encoding (default: `en_US.UTF-8`)

6. **Shell Default**: macOS Catalina+ uses `zsh` as default shell, not `bash`

## Headless Mode Features

New interactive features are available when running in headless mode (default):

### Interactive Interrupt Menu
When `Ctrl+C` is pressed during a running session, an interactive menu appears instead of immediately terminating the process. Options include:
- `[Q] Force Quit`: Immediately terminate the process.
- `[P] Pause`: Pause the current session (if supported).
- `[R] Resume`: Resume the session and close the menu.

### Requirements Validation
The agent validates necessary files before allowing certain actions.
- **Product Requirements**: The `[P]` (Plan) action is blocked if `prd.json` is missing in the current directory. An error message will be displayed indicating the missing requirement.

### Terminal Session Launch
- Pressing `t` while a session is active opens a new external terminal window attached to the current session context.
- **Note**: This feature is disabled if the session is already running in PTY mode.

## Local Development & Building


### Building and Installing Locally

**ALWAYS follow this exact sequence when asked to build/install:**

```bash
# 1. Run tests first
bun test

# 2. Build all platform binaries
bun run build

# 3. Install to /usr/local/bin (Linux/macOS)
sudo cp dist/openralph-linux-x64/bin/ralph /usr/local/bin/ralph

# 4. Verify installation
ralph -v
```

**Platform-specific binary paths:**
- Linux x64: `dist/openralph-linux-x64/bin/ralph`
- Linux arm64: `dist/openralph-linux-arm64/bin/ralph`
- macOS x64: `dist/openralph-darwin-x64/bin/ralph`
- macOS arm64: `dist/openralph-darwin-arm64/bin/ralph`
- Windows x64: `dist/openralph-windows-x64/bin/ralph.exe`

### Version Handling

**CRITICAL**: Version is injected at build time via Bun's `define` option, NOT read from package.json at runtime.

In `src/index.ts`:
```typescript
// @ts-expect-error - RALPH_VERSION is replaced at build time
const version: string = RALPH_VERSION;
```

In `scripts/build.ts`:
```typescript
define: {
  RALPH_VERSION: JSON.stringify(version),
},
```

**Never import version from package.json** - it won't work in compiled binaries.

### Version Bumping Workflow

When releasing a new version:

```bash
# 1. Bump version (creates commit automatically if --no-git-tag-version is omitted)
npm version patch --no-git-tag-version

# 2. Commit the version bump
git add package.json
git commit -m "chore: bump version to X.Y.Z"

# 3. Build and install
bun run build
sudo cp dist/openralph-linux-x64/bin/ralph /usr/local/bin/ralph

# 4. Verify
ralph -v

# 5. Push
git push origin master
```

### Common Pitfalls

1. **Stale binary in PATH**: Check `which -a ralph` - there may be an old binary in `~/.bun/bin/ralph` shadowing the new one. Remove it: `rm ~/.bun/bin/ralph`

2. **Shell hash cache**: After installing, run `hash -r` to clear the shell's command cache

3. **Forgetting to rebuild**: The version is baked into the binary at build time. Changing package.json does nothing until you rebuild.

## Release Workflow

### Rolling Dev Releases

Every push to `master` automatically updates the `dev` release:

- A single `dev` release is maintained (not multiple dev releases)
- The release is marked as a **prerelease**
- Assets are replaced on each push with the latest build
- Version format: `X.Y.Z-dev.YYYYMMDD.HHMMSS`

**Important**: Do NOT manually create, delete, or modify the `dev` release - CI manages it automatically.

### Production Releases

To create a production release:

```bash
gh workflow run publish.yml --field bump=patch
```

Options for `bump`:
- `patch` - Bug fixes (0.1.0 → 0.1.1)
- `minor` - New features (0.1.0 → 0.2.0)
- `major` - Breaking changes (0.1.0 → 1.0.0)

Production releases:
- Create an immutable `vX.Y.Z` tag and GitHub release
- Generate a changelog from commits since the last production release
- Publish to npm (`openralph` and platform-specific packages)

### Release Assets

Each release includes binaries for all supported platforms:

| Platform      | Formats                              |
|---------------|--------------------------------------|
| Windows x64   | `.tar.gz`, `.zip`, standalone `.exe` |
| macOS x64     | `.tar.gz`                            |
| macOS arm64   | `.tar.gz`                            |
| Linux x64     | `.tar.gz`                            |
| Linux arm64   | `.tar.gz`                            |

All releases include a `SHA256SUMS.txt` file for binary verification:

```bash
# Verify downloaded binary
sha256sum -c SHA256SUMS.txt
```

### Important Notes

1. **Dev releases are unstable** - They include a warning banner and should only be used for testing
2. **Don't modify the dev release manually** - The CI pipeline manages creation, updates, and cleanup
3. **Verify binaries** - Always check `SHA256SUMS.txt` before installing from releases
4. **Changelog scope** - Dev releases show commits since last production release; production releases show commits since previous production release
