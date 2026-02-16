# AGENTS.md — extension-host/ (Extension Host)

## Purpose

Separate Node.js process that hosts VS Code-compatible extensions for Cortex Desktop. Communicates with the Tauri backend via JSON-RPC over stdin/stdout. Provides the extension API surface (themes, commands, languages, panels, etc.) in an isolated process to prevent extensions from crashing the main app.

## Architecture

- **Entry:** `src/index.ts` (139 lines) — JSON-RPC message loop over stdin/stdout
- **API:** `src/api.ts` (36 lines) — `CortexAPI` class implementing the extension host API
- **Protocol:** Line-delimited JSON-RPC 2.0 (requests, responses, notifications)
- **Process model:** Spawned as a child process by `src-tauri/src/extensions/host.rs`
- **TypeScript target:** ESNext, NodeNext module resolution

### Communication Protocol
```
Tauri Backend ←→ stdin/stdout (JSON-RPC) ←→ Extension Host Process
```

- Notifications: fire-and-forget messages (no response expected)
- Requests: messages with `id` field, expect a response
- Responses: messages with `id` and `result` fields

### Message Handling
- `handleRequest()` in `src/index.ts` dispatches incoming requests to the appropriate handler
- `sendNotification()` / `sendRequest()` for outbound communication
- Pending requests tracked via `Map<number, (result: any) => void>`

## Build

```bash
cd extension-host
npm install          # Install dependencies
npm run build        # Compile TypeScript (tsc → dist/)
npm run start        # Run compiled host (node dist/index.js)
```

## Dependencies

- `typescript` ^5.9 — Compiler
- `@types/node` ^22 — Node.js type definitions
- Node.js built-ins: `fs`, `path`, `readline`

## Rules

- Keep the host process lightweight — it's spawned per window
- All extension API calls must be handled in `handleRequest()` in `src/index.ts`
- **Never use `console.log` for output** — stdout is the JSON-RPC transport; use stderr for debug
- Errors in extension code must be caught and reported, never crash the host
- Strict TypeScript mode: `strict: true`, `forceConsistentCasingInFileNames: true`
