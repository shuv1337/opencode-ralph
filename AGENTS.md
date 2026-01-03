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
