//! Extension host path resolution and process management.
//!
//! This module handles the Node.js extension host process lifecycle,
//! including path resolution across different deployment scenarios.

use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::process::{Child, Stdio};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager};
use tracing::{error, info, warn};

use super::state::ExtensionsState;

// ============================================================================
// Extension Host Path Resolution
// ============================================================================

/// Environment variable name for custom extension host path
const EXTENSION_HOST_ENV_VAR: &str = "cortex_EXTENSION_HOST_PATH";

/// Relative path to extension host script from various base directories
const EXTENSION_HOST_RELATIVE_PATH: &str = "extension-host/dist/index.js";

/// Resolve the extension host script path using multiple fallback strategies.
///
/// Resolution order:
/// 1. Environment variable `cortex_EXTENSION_HOST_PATH` (if set)
/// 2. Tauri resource directory (for bundled apps)
/// 3. Relative to current executable (for portable installs)
/// 4. Standard install locations:
///    - Windows: %LOCALAPPDATA%\Cortex\extension-host\dist\index.js
///    - macOS: ~/Library/Application Support/Cortex/extension-host/dist/index.js
///    - Linux: ~/.local/share/Cortex/extension-host/dist/index.js
/// 5. Development paths relative to the desktop directory
pub fn resolve_extension_host_path(app: &AppHandle) -> Result<PathBuf, String> {
    // 1. Check environment variable first (highest priority for custom deployments)
    if let Ok(env_path) = std::env::var(EXTENSION_HOST_ENV_VAR) {
        let path = PathBuf::from(&env_path);
        if path.exists() {
            info!("Using extension host from environment variable: {:?}", path);
            return Ok(path);
        }
        warn!(
            "Extension host path from {} does not exist: {:?}",
            EXTENSION_HOST_ENV_VAR, path
        );
    }

    // 2. Check Tauri resource directory (bundled app)
    if let Ok(resource_dir) = app.path().resource_dir() {
        let path = resource_dir.join(EXTENSION_HOST_RELATIVE_PATH);
        if path.exists() {
            info!("Using extension host from resource directory: {:?}", path);
            return Ok(path);
        }
    }

    // 3. Check relative to current executable (portable installs)
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            // Check sibling directory
            let path = exe_dir.join(EXTENSION_HOST_RELATIVE_PATH);
            if path.exists() {
                info!("Using extension host relative to executable: {:?}", path);
                return Ok(path);
            }

            // Check one level up (common for app bundles)
            if let Some(parent_dir) = exe_dir.parent() {
                let path = parent_dir.join(EXTENSION_HOST_RELATIVE_PATH);
                if path.exists() {
                    info!("Using extension host from parent directory: {:?}", path);
                    return Ok(path);
                }

                // Check in Resources subdirectory (macOS app bundle structure)
                let path = parent_dir
                    .join("Resources")
                    .join(EXTENSION_HOST_RELATIVE_PATH);
                if path.exists() {
                    info!("Using extension host from Resources: {:?}", path);
                    return Ok(path);
                }
            }
        }
    }

    // 4. Check standard platform-specific install locations
    if let Some(data_dir) = get_platform_data_dir() {
        let path = data_dir.join("Cortex").join(EXTENSION_HOST_RELATIVE_PATH);
        if path.exists() {
            info!(
                "Using extension host from platform data directory: {:?}",
                path
            );
            return Ok(path);
        }
    }

    // 5. Development fallback: check relative to known development paths
    // Uses home directory to construct development-relative paths
    if let Some(home_dir) = dirs::home_dir() {
        // Common development locations
        let dev_locations = [
            // Relative to home for development
            home_dir
                .join("orion")
                .join("desktop")
                .join(EXTENSION_HOST_RELATIVE_PATH),
            home_dir
                .join("Documents")
                .join("orion")
                .join("desktop")
                .join(EXTENSION_HOST_RELATIVE_PATH),
            // orion_code folder (common development setup)
            home_dir
                .join("Documents")
                .join("orion_code")
                .join("orion")
                .join("desktop")
                .join(EXTENSION_HOST_RELATIVE_PATH),
            home_dir
                .join("orion_code")
                .join("orion")
                .join("desktop")
                .join(EXTENSION_HOST_RELATIVE_PATH),
            home_dir
                .join("Projects")
                .join("orion")
                .join("desktop")
                .join(EXTENSION_HOST_RELATIVE_PATH),
            home_dir
                .join("Projects")
                .join("orion_code")
                .join("orion")
                .join("desktop")
                .join(EXTENSION_HOST_RELATIVE_PATH),
            home_dir
                .join("dev")
                .join("orion")
                .join("desktop")
                .join(EXTENSION_HOST_RELATIVE_PATH),
            home_dir
                .join("dev")
                .join("orion_code")
                .join("orion")
                .join("desktop")
                .join(EXTENSION_HOST_RELATIVE_PATH),
            // Code folder (Windows common)
            home_dir
                .join("Code")
                .join("orion")
                .join("desktop")
                .join(EXTENSION_HOST_RELATIVE_PATH),
            home_dir
                .join("Code")
                .join("orion_code")
                .join("orion")
                .join("desktop")
                .join(EXTENSION_HOST_RELATIVE_PATH),
        ];

        for path in &dev_locations {
            if path.exists() {
                info!("Using extension host from development path: {:?}", path);
                return Ok(path.clone());
            }
        }
    }

    // 6. Also try current working directory for development
    if let Ok(cwd) = std::env::current_dir() {
        // Check if we're in the desktop directory or its parent
        let cwd_path = cwd.join(EXTENSION_HOST_RELATIVE_PATH);
        if cwd_path.exists() {
            info!(
                "Using extension host from current directory: {:?}",
                cwd_path
            );
            return Ok(cwd_path);
        }
        // Check desktop subdirectory
        let desktop_path = cwd.join("desktop").join(EXTENSION_HOST_RELATIVE_PATH);
        if desktop_path.exists() {
            info!(
                "Using extension host from desktop subdirectory: {:?}",
                desktop_path
            );
            return Ok(desktop_path);
        }
    }

    // If nothing found, return the expected resource path for a clearer error message
    let default_path = app
        .path()
        .resource_dir()
        .map(|d| d.join(EXTENSION_HOST_RELATIVE_PATH))
        .unwrap_or_else(|_| PathBuf::from(EXTENSION_HOST_RELATIVE_PATH));

    Err(format!(
        "Extension host script not found. Searched locations:\n\
         - Environment variable: ${}\n\
         - Resource directory\n\
         - Relative to executable\n\
         - Platform data directory\n\
         - Development paths\n\n\
         Expected path: {:?}\n\n\
         To fix this, either:\n\
         1. Set {} environment variable to the script path\n\
         2. Install the extension host in the standard location\n\
         3. Ensure the app is properly bundled with resources",
        EXTENSION_HOST_ENV_VAR, default_path, EXTENSION_HOST_ENV_VAR
    ))
}

/// Get the platform-specific application data directory
fn get_platform_data_dir() -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        std::env::var("LOCALAPPDATA").ok().map(PathBuf::from)
    }

    #[cfg(target_os = "macos")]
    {
        dirs::home_dir().map(|h| h.join("Library").join("Application Support"))
    }

    #[cfg(target_os = "linux")]
    {
        std::env::var("XDG_DATA_HOME")
            .ok()
            .map(PathBuf::from)
            .or_else(|| dirs::home_dir().map(|h| h.join(".local").join("share")))
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        dirs::data_dir()
    }
}

// ============================================================================
// Extension Host Process Management
// ============================================================================

/// Extension host process management
#[derive(Debug)]
pub struct ExtensionHost {
    child: Option<Arc<Mutex<Child>>>,
    tx: Option<tokio::sync::mpsc::UnboundedSender<String>>,
}

impl ExtensionHost {
    pub fn new() -> Self {
        Self {
            child: None,
            tx: None,
        }
    }

    pub fn start(&mut self, app: &AppHandle, extensions: Vec<PathBuf>) -> Result<(), String> {
        info!("Starting extension host...");

        // Resolve extension host script path using multiple fallback strategies
        let host_script = resolve_extension_host_path(app)?;

        if !host_script.exists() {
            return Err(format!(
                "Extension host script not found at {:?}",
                host_script
            ));
        }

        let mut child = crate::process_utils::command("node")
            .arg(host_script)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .spawn()
            .map_err(|e| format!("Failed to spawn extension host: {}", e))?;

        let stdin = child.stdin.take().ok_or("Failed to open stdin")?;
        let stdout = child.stdout.take().ok_or("Failed to open stdout")?;

        let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<String>();
        self.tx = Some(tx);

        // Thread to write to stdin
        std::thread::spawn(move || {
            let mut stdin = stdin;
            while let Some(msg) = rx.blocking_recv() {
                if let Err(e) = writeln!(stdin, "{}", msg) {
                    error!("Failed to write to extension host: {}", e);
                    break;
                }
            }
        });

        // Thread to read from stdout
        let app_handle = app.clone();
        std::thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                if let Ok(line) = line {
                    handle_host_message(&app_handle, line);
                }
            }
        });

        self.child = Some(Arc::new(Mutex::new(child)));

        // Send loadExtensions request
        let extension_paths: Vec<String> = extensions
            .iter()
            .map(|p| p.to_string_lossy().to_string())
            .collect();

        let request = serde_json::json!({
            "jsonrpc": "2.0",
            "id": 0,
            "method": "loadExtensions",
            "params": {
                "extensions": extension_paths
            }
        });

        self.send(
            serde_json::to_string(&request).expect("Extension host message serialization failed"),
        );

        Ok(())
    }

    pub fn send(&self, message: String) {
        if let Some(tx) = &self.tx {
            let _ = tx.send(message);
        }
    }

    pub fn stop(&mut self) {
        if let Some(child_arc) = self.child.take() {
            if let Ok(mut child) = child_arc.lock() {
                let _ = child.kill();
            }
        }
    }
}

fn handle_host_message(app: &AppHandle, line: String) {
    let msg: serde_json::Value = match serde_json::from_str(&line) {
        Ok(v) => v,
        Err(_) => return,
    };

    if let Some(method) = msg.get("method").and_then(|m| m.as_str()) {
        match method {
            "ready" => {
                info!("Extension host is ready");
            }
            "registerCommand" => {
                let command = msg["params"]["command"].as_str().unwrap_or_default();
                info!("Extension registered command: {}", command);
                // In a real implementation, we would store this to route commands correctly
            }
            "showInformationMessage" => {
                let message = msg["params"]["message"]
                    .as_str()
                    .unwrap_or_default()
                    .to_string();
                let id = msg.get("id").and_then(|i| i.as_u64());

                info!("Extension showInformationMessage: {}", message);

                // Show notification using tauri emit
                let app_handle = app.clone();
                tauri::async_runtime::spawn(async move {
                    let _ = app_handle.emit(
                        "extension:notification",
                        serde_json::json!({
                            "type": "info",
                            "message": message
                        }),
                    );

                    if let Some(id) = id {
                        // Send response back
                        let response = serde_json::json!({
                            "jsonrpc": "2.0",
                            "id": id,
                            "result": null
                        });

                        if let Ok(manager) = app_handle.state::<ExtensionsState>().0.lock() {
                            if let Some(host) = &manager.host {
                                host.send(
                                    serde_json::to_string(&response)
                                        .expect("Extension host response serialization failed"),
                                );
                            }
                        }
                    }
                });
            }
            _ => warn!("Unknown method from extension host: {}", method),
        }
    }
}
