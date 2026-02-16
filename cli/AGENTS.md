# AGENTS.md — cli/ (Desktop CLI)

## Purpose

Command-line interface for launching and controlling Cortex Desktop. Allows users to open files/folders, navigate to specific lines, diff files, and manage the desktop app from the terminal via deep links (`cortex://` protocol). Single file binary (638 lines in `src/main.rs`).

## Architecture

- **Binary name:** `cortex`
- **Entry:** `src/main.rs` (638 lines — the entire CLI)
- **CLI framework:** `clap` 4 with derive macros
- **Edition:** Rust 2021

### Key Features
- Open files and folders: `cortex .`, `cortex /path/to/project`
- Go to line/column: `cortex --goto src/main.rs:42:10`
- Diff two files: `cortex --diff file1.rs file2.rs`
- New window: `cortex --new-window /path`
- Wait for close: `cortex --wait /path/to/file`

### Dependencies
- `clap` 4 — CLI argument parsing (derive, wrap_help, string features)
- `anyhow` — Error handling
- `urlencoding` — Deep link URL encoding
- `dunce`/`dirs` — Path handling (canonicalization, home dir)
- `sysinfo` — Process management (detect running instances)
- `tracing`/`tracing-subscriber` — Logging (env-filter)
- `windows` (Windows-only) — Win32 APIs for window management
- `libc` (Unix-only) — Unix process utilities

## Build

```bash
cd cli
cargo build              # Debug build
cargo build --release    # Release build (LTO, strip, panic=abort)
cargo fmt -- --check     # Check formatting
cargo clippy -- -D warnings  # Lint
```

## Rules

- Keep the CLI lightweight — it's a launcher, not a runtime
- Use deep links (`cortex://`) to communicate with the running desktop app
- All paths must be canonicalized before encoding into deep link URLs
- Platform-specific code is behind `#[cfg(windows)]` / `#[cfg(unix)]` guards
- Release profile: LTO enabled, single codegen unit, symbols stripped, panic=abort
- Lint config inherits from workspace (`[lints] workspace = true`)
