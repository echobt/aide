# Cortex GUI

Cortex GUI - AI-Powered Development Environment built with Tauri.

## Prerequisites

- [Node.js](https://nodejs.org/) (v20+)
- [Rust](https://www.rust-lang.org/) (nightly, 1.85+)
- Platform-specific dependencies (see below)

### Linux

```bash
sudo apt-get update
sudo apt-get install -y libgtk-3-dev libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf libglib2.0-dev libasound2-dev
```

### macOS

No additional dependencies required.

### Windows

No additional dependencies required.

## Development

### Install dependencies

```bash
npm install
```

### Run in development mode

```bash
npm run tauri:dev
```

### Build for production

```bash
npm run tauri:build
```

## Project Structure

```
cortex-gui/
├── src/                    # Frontend source (SolidJS)
├── src-tauri/              # Tauri backend (Rust)
│   ├── src/               # Rust source code
│   ├── Cargo.toml         # Rust dependencies
│   └── tauri.conf.json    # Tauri configuration
├── public/                 # Static assets
├── package.json           # Node.js dependencies
└── vite.config.ts         # Vite configuration
```

## Dependencies

This project depends on the following crates from [cortex-cli](https://github.com/CortexLM/cortex-cli):

- `cortex-engine` - Core AI engine
- `cortex-protocol` - Communication protocol
- `cortex-storage` - Data persistence

## License

MIT
