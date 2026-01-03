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

