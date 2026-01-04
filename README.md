# opencode-ralph

A fullscreen TUI harness for Ralph-driven development using `@opentui/solid` and `@opencode-ai/sdk`. Stateless design with file-based persistence for resume capability.

## What is Ralph-driven development?

Ralph-driven development is a methodology pioneered by [Geoffrey Huntley](https://ghuntley.com/ralph/) where an AI agent operates in a stateless execution loop:

1. **Read** the plan file
2. **Pick ONE task** from the backlog
3. **Complete the task** with verification
4. **Commit** the change (updating the plan in the same commit)
5. **Repeat** until all tasks are done

The key insight is that by forcing the agent to re-read the full context every iteration, you eliminate context drift. Each loop starts fresh, with the agent maintaining a vague understanding of the past AND the end state.

This technique works because:
- **Deterministic failures are debuggable**: When Ralph fails, you don't just fix the code - you fix the prompt. Add a "sign" (instruction) to prevent the same mistake.
- **AGENTS.md accumulates wisdom**: Critical operational details (e.g., how to build, common pitfalls) are captured so future iterations don't have to rediscover them.
- **Human review remains in control**: The agent never pushes - only commits - so you maintain a review checkpoint before changes go live.

For more on the methodology, see:
- [Geoffrey Huntley's original Ralph post](https://ghuntley.com/ralph/)
- [Luke Parker's "Stop Chatting with AI. Start Loops"](https://lukeparker.dev/stop-chatting-with-ai-start-loops-ralph-driven-development)

## Features

- Fullscreen TUI with alt screen and Tokyo Night color scheme
- Parse `plan.md` checkboxes for real-time progress tracking
- ETA calculation based on rolling average of iteration times
- Scrollable event log grouped by iteration
- File-based state persistence (resume after Ctrl+C)
- Lock file to prevent multiple instances
- Pause/resume support via keyboard

## Installation

### Prerequisites

- [Bun](https://bun.sh) runtime (v1.0+)
- [OpenCode](https://opencode.ai) CLI (for the agent backend)

### Setup

```bash
# Clone the repository
git clone https://github.com/your-username/opencode-ralph.git
cd opencode-ralph

# Install dependencies
bun install
```

### Global Installation (Optional)

To make the `ralph` command available globally:

```bash
bun link
```

After linking, you can run `ralph` from any directory.

## Usage

### Basic Usage

```bash
# Run with defaults (uses plan.md in current directory)
ralph

# Or with bun directly
bun run src/index.ts
```

### With Options

```bash
# Use a different plan file
ralph --plan BACKLOG.md

# Use a specific model
ralph --model anthropic/claude-opus-4

# Use a custom prompt template
ralph --prompt "Read {plan} and complete one task..."

# Reset state and start fresh
ralph --reset

# Combine multiple options
ralph --plan tasks.md --model opencode/gpt-4o --reset
```

### CLI Options

| Option | Alias | Type | Default | Description |
|--------|-------|------|---------|-------------|
| `--plan` | `-p` | string | `plan.md` | Path to the plan file |
| `--model` | `-m` | string | `opencode/claude-opus-4-5` | Model to use (provider/model format) |
| `--prompt` | | string | (see below) | Custom prompt template (use `{plan}` as placeholder) |
| `--reset` | `-r` | boolean | `false` | Reset state and start fresh |
| `--help` | `-h` | | | Show help |

### Default Prompt

The default prompt template used when `--prompt` is not specified:

```
READ all of {plan}. Pick ONE task. If needed, verify via web/code search. Complete task. Commit change (update the plan.md in the same commit). ONLY do one task unless GLARINGLY OBVIOUS steps should run together. Update {plan}. If you learn a critical operational detail, update AGENTS.md. When ALL tasks complete, create .ralph-done and exit. NEVER GIT PUSH. ONLY COMMIT.
```

## Files

Ralph uses several hidden files in your project directory:

| File | Purpose |
|------|---------|
| `.ralph-state.json` | Persisted state for resume. Contains start time, initial commit hash, iteration durations, and plan file path. Allows resuming after Ctrl+C. |
| `.ralph-lock` | Lock file to prevent multiple instances. Contains the PID of the running process. Automatically cleaned up on exit. |
| `.ralph-done` | Created by the agent when all tasks in the plan are complete. Ralph detects this file and exits cleanly. |
| `.ralph-pause` | Created by pressing `p` to pause the loop. Ralph checks for this file between iterations and waits until it's removed. |

All files are gitignored by default. Add them to your `.gitignore` if not already present:

```
.ralph-state.json
.ralph-lock
.ralph-done
.ralph-pause
```

## Keybindings

| Key | Action |
|-----|--------|
| `p` | Toggle pause - creates/deletes `.ralph-pause` file |
| `q` | Quit the application |
| `Ctrl+C` | Quit the application |
| `↑` / `k` | Scroll up |
| `↓` / `j` | Scroll down |
| `Page Up` | Scroll up half viewport |
| `Page Down` | Scroll down half viewport |
| `Home` | Scroll to top |
| `End` | Scroll to bottom |

## Tips

### Spend Time on the Plan

The plan is everything. Before starting Ralph, invest significant time crafting a detailed, well-structured plan file:

- **Be specific**: Each task should be small and isolated enough that a new engineer could implement it immediately
- **Chronological order**: Tasks should be ordered so dependencies come first
- **Use checkboxes**: Ralph parses `- [x]` and `- [ ]` to track progress
- **1000+ lines is normal**: Don't be afraid of long plans - more detail means fewer hallucinations
- **Read every line**: If you're not happy with the plan, keep refining before running

> "I spend an hour purely on the plan. I do not touch code." — Luke Parker

### Use AGENTS.md for Accumulated Wisdom

The `AGENTS.md` file is where Ralph's learnings persist across iterations:

- **Build steps**: If Ralph discovers a tricky build command, it writes it to AGENTS.md so future iterations don't rediscover fire
- **Common pitfalls**: When Ralph makes a mistake, add a "sign" to prevent the same error
- **Configuration quirks**: Library-specific settings, environment requirements, etc.

Example AGENTS.md content:
```markdown
## Build Commands
- Run `bun install` before `bun run dev`
- Tests require `DATABASE_URL` to be set

## Pitfalls
- Never import from `solid-js` directly, use `@opentui/solid`
- The API requires `Content-Type: application/json` header
```

Think of it as putting up warning signs at the playground - when Ralph falls off the slide, you don't just put him back; you put up a sign that says "DON'T JUMP."

### Monitor with GitHub Desktop

While Ralph runs, use GitHub Desktop (or `git log --oneline -n 20`) to monitor progress:

- **Watch commits roll in**: Each completed task should produce a commit
- **Review before pushing**: Ralph only commits, never pushes - you maintain the final review checkpoint
- **Catch issues early**: If commits stop appearing, check the TUI for errors or paused state
- **Squash if needed**: Since you control the push, you can squash messy commits before they reach the remote

### General Tips

- **Never let Ralph push**: The `--only-commit` design ensures you always review before code reaches the remote
- **Pause to intervene**: Press `p` if you see Ralph heading in the wrong direction - fix the issue manually, then resume
- **Trust eventual consistency**: Ralph will test your patience, but deterministic failures are debuggable failures
- **Tune, don't blame**: When Ralph does something bad, Ralph gets tuned - like a guitar. Fix the prompt, not just the code.

## Testing

Ralph includes a comprehensive test suite using Bun's built-in test runner.

### Running Tests

```bash
# Run all tests
bun test

# Run tests in watch mode (re-runs on file changes)
bun test --watch

# Run tests with coverage report
bun test --coverage
```

