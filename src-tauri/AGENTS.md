# AGENTS.md — src-tauri/ (Tauri Backend)

## Purpose

The Rust backend for Cortex Desktop. Implements all native functionality exposed to the frontend via Tauri IPC commands: file system operations, terminal PTY management, LSP/DAP protocol clients, Git operations, AI provider orchestration, extension hosting, remote SSH development, sandboxed agent execution, and more. This is a 40-module monolith compiled as `cortex-gui` (library: `cortex_gui_lib`).

## Architecture

- **Entry point:** `src/main.rs` → calls `cortex_gui_lib::run()` from `src/lib.rs`
- **Crate name:** `cortex-gui` (library: `cortex_gui_lib`)
- **Crate type:** `staticlib`, `cdylib`, `rlib`
- **Rust edition:** 2024, requires nightly (1.85+)
- **lib.rs:** 1636 lines — app setup, state initialization, all Tauri command registration

### Module Map

| Module | Path | Submodules | Description |
|--------|------|------------|-------------|
| `ai` | `src/ai/` | `agents/`, `protocol.rs`, `providers.rs`, `session.rs`, `session_commands.rs`, `storage.rs`, `thread.rs`, `tools.rs`, `types.rs` | AI provider management (OpenAI, Anthropic, etc.), agent spawning, conversation threads, tool execution, streaming |
| `lsp` | `src/lsp/` | `client/`, `commands/`, `types.rs` | Full LSP client: document sync, completions, hover, definitions, references, diagnostics |
| `dap` | `src/dap/` | `client.rs`, `commands/`, `protocol/`, `session/`, `transport.rs` | Debug Adapter Protocol: sessions, breakpoints, stepping, variables, stack frames |
| `terminal` | `src/terminal/` | `commands.rs`, `constants.rs`, `flow_control.rs`, `process.rs`, `shell_integration.rs`, `state.rs`, `types.rs` | PTY terminal management with flow control and shell integration |
| `git` | `src/git/` | 25 files: `bisect`, `blame`, `branch`, `cache`, `cherry_pick`, `clone`, `command`, `diff`, `helpers`, `hunk`, `lfs`, `lines`, `log`, `merge`, `mod`, `rebase`, `remote`, `staging`, `stash`, `status`, `submodule`, `tag`, `types`, `watcher`, `worktree` | Full Git operations via libgit2 |
| `fs` | `src/fs/` | `directory.rs`, `encoding.rs`, `operations.rs`, `search.rs`, `security.rs`, `types.rs`, `utils.rs`, `watcher.rs`, `workspace_edit.rs` | File system ops with caching, watching, encoding detection, workspace edits |
| `extensions` | `src/extensions/` | `activation.rs`, `api.rs`, `commands.rs`, `marketplace.rs`, `permissions.rs`, `plugin_api.rs`, `registry.rs`, `state.rs`, `types.rs`, `utils.rs`, `wasm/` (`host.rs`, `runtime.rs`), `wit/` (`cortex.wit`) | VS Code-compatible extension system + marketplace integration |
| `remote` | `src/remote/` | `commands.rs`, `connection.rs`, `credentials.rs`, `error.rs`, `manager.rs`, `types.rs` | SSH remote development (connection, file ops, credential storage) |
| `factory` | `src/factory/` | `audit.rs`, `commands.rs`, `events.rs`, `executor/`, `interception.rs`, `orchestrator.rs`, `persistence.rs`, `types.rs` | Agent workflow orchestration: designer, executor, interception, audit logging |
| `mcp` | `src/mcp/` | `commands.rs`, `socket_server.rs`, `tools.rs` | MCP TCP server for AI agent debugging |
| `context_server` | `src/context_server/` | `commands.rs`, `protocol.rs`, `transport.rs`, `types.rs` | MCP client for connecting to external context servers |
| `acp` | `src/acp/` | `commands.rs`, `executor.rs`, `types.rs` | Agent Control Protocol tool registry and execution |
| `settings` | `src/settings/` | `commands.rs`, `profiles.rs`, `secure_store.rs`, `storage.rs`, `types.rs` | User/workspace settings with profiles and secure storage |
| `formatter` | `src/formatter/` | `commands.rs`, `handlers.rs`, `prettier.rs`, `types.rs` | Code formatting (Prettier integration) |
| `testing` | `src/testing/` | `coverage.rs`, `detection.rs`, `discovery.rs`, `execution.rs`, `single_test.rs`, `types.rs`, `watch.rs` | Test framework detection, discovery, execution, coverage |
| `sandbox` | `src/sandbox/` | `acl.rs`, `audit.rs`, `cap.rs`, `dpapi.rs`, `elevated_impl.rs`, `env.rs`, `identity.rs`, `process.rs`, `sandbox_users.rs`, `token.rs`, `winutil.rs` | Sandboxed execution environment for AI agents |
| `repl` | `src/repl/` | `jupyter.rs`, `kernel.rs`, `types.rs` | REPL kernel management (Jupyter protocol) |
| `batch` | `src/batch.rs` | — | IPC batch command system with MessagePack support |
| `action_log` | `src/action_log.rs` | — | Agent action tracking for diff/accept/reject workflows |
| `auto_update` | `src/auto_update.rs` | — | Application auto-update via Tauri updater plugin |
| `browser` | `src/browser.rs` | — | Embedded browser webview management |
| `deep_link` | `src/deep_link.rs` | — | `cortex://` deep link handler |
| `notebook` | `src/notebook.rs` | — | Jupyter-style notebook kernel management |
| `search` | `src/search.rs` | — | Search and replace across files |
| `ssh_terminal` | `src/ssh_terminal.rs` | — | Remote SSH PTY sessions |
| `system_specs` | `src/system_specs.rs` | — | System info and live metrics |
| `toolchain` | `src/toolchain.rs` | — | Language toolchain detection (Node, Python, Rust) |
| `window` | `src/window.rs` | — | Multi-window management with session persistence |
| `workspace` | `src/workspace.rs` | — | Workspace file management (`.cortex-workspace`, recent workspaces, cross-folder ops) |
| `workspace_settings` | `src/workspace_settings.rs` | — | Workspace/folder/language-level settings |
| `wsl` | `src/wsl.rs` | — | Windows Subsystem for Linux integration |
| `activity` | `src/activity.rs` | — | User activity tracking |
| `diagnostics` | `src/diagnostics.rs` | — | Diagnostic aggregation |
| `language_selector` | `src/language_selector.rs` | — | Language detection and selection |
| `prompt_store` | `src/prompt_store.rs` | — | Prompt template persistence |
| `rules_library` | `src/rules_library.rs` | — | Agent rules library |
| `tasks` | `src/tasks.rs` | — | Task runner integration |
| `timeline` | `src/timeline.rs` | — | Local file history tracking (VS Code-like) |
| `process` | `src/process.rs` | — | Process management |
| `process_utils` | `src/process_utils.rs` | — | Process utilities |

### State Management Pattern

All state is initialized in `run()` via `app.manage()`. Heavy state uses `LazyState<T>` (wraps `OnceLock`) for deferred initialization. Startup uses `tokio::join!` for parallel async init of settings, extensions, LSP, SSH profiles, AI providers, and auto-update. State types: `AIState`, `AgentState`, `AgentStoreState`, `AIToolsState`, `LspState`, `ActivityState`, etc.

## Key Dependencies

- `tauri` 2.9 with `macos-private-api` and `unstable` features
- `cortex-engine`, `cortex-protocol`, `cortex-storage` from `github.com/CortexLM/cortex-cli` (master branch)
- `tokio` (full), `serde`/`serde_json`, `rmp-serde` (MessagePack), `anyhow`/`thiserror`
- `git2` (libgit2), `rusqlite` (SQLite, bundled), `ssh2`, `portable-pty`
- `keyring`/`secrecy`/`zeroize` for secure credential storage
- `dashmap`, `parking_lot`, `lru` for concurrent data structures
- `reqwest` (async-only, no `blocking` feature — intentional)
- Platform-specific: `window-vibrancy`, `win-screenshot`, `xcap`, `windows-sys`

## Build Commands

```bash
cargo fmt --all -- --check             # Check formatting
cargo clippy --all-targets -- -D warnings  # Lint
cargo check                            # Type check
cargo build                            # Debug build
cargo build --release                  # Release build (LTO, strip, panic=abort)
cargo test                             # Run tests
```

## Rules

- All `#[tauri::command]` must return `Result<T, String>` — never `anyhow::Result`
- Use `tracing::{info, warn, error}` for logging, not `println!`
- State accessed via `app.state::<T>()` must be `Send + Sync`
- Never block the async runtime — use `spawn_blocking` for sync work
- Platform-specific code uses `#[cfg(target_os = "...")]` guards
- The `window-vibrancy/` subdirectory is a vendored crate — do not modify
- Release profile enables LTO, single codegen unit, symbol stripping, and panic=abort
- Clippy lints: `unwrap_used`, `expect_used`, `print_stdout`, `print_stderr`, `unnecessary_sort_by`, `iter_without_into_iter`, `module_inception`, `derivable_impls` are set to `allow` in `Cargo.toml`; `unsafe_code` is also allowed at the Rust lint level
- New Tauri plugins require updating `src-tauri/capabilities/default.json` and CSP in `tauri.conf.json`