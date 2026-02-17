//! Host functions exposed to WASM extensions.
//!
//! These functions are callable from within the WASM sandbox and provide
//! controlled access to Cortex Desktop capabilities.

use std::fs;
use std::path::Path;
use std::sync::Mutex;

use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use tracing::{debug, info, warn};
use uuid::Uuid;

// ============================================================================
// Command Registry
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
struct RegisteredCommand {
    extension_id: String,
    command_id: String,
    title: String,
}

static COMMAND_REGISTRY: Lazy<Mutex<Vec<RegisteredCommand>>> = Lazy::new(|| Mutex::new(Vec::new()));

// ============================================================================
// Logging
// ============================================================================

pub fn host_log(level: u32, message: &str) {
    match level {
        0 => debug!("[WasmExt] {}", message),
        1 => debug!("[WasmExt] {}", message),
        2 => info!("[WasmExt] {}", message),
        3 => warn!("[WasmExt] {}", message),
        4 => tracing::error!("[WasmExt] {}", message),
        _ => info!("[WasmExt] {}", message),
    }
}

// ============================================================================
// Configuration
// ============================================================================

pub fn host_get_config(_key: &str) -> Option<String> {
    None
}

// ============================================================================
// Message Display
// ============================================================================

pub fn host_show_message(level: u32, message: &str) {
    match level {
        0 => info!("[WasmExt:Info] {}", message),
        1 => warn!("[WasmExt:Warn] {}", message),
        2 => tracing::error!("[WasmExt:Error] {}", message),
        _ => info!("[WasmExt:Msg] {}", message),
    }
}

pub fn host_show_info_message(message: &str) -> String {
    let id = Uuid::new_v4().to_string();
    info!("[WasmExt:Info] {}", message);
    id
}

pub fn host_show_warning_message(message: &str) -> String {
    let id = Uuid::new_v4().to_string();
    warn!("[WasmExt:Warn] {}", message);
    id
}

pub fn host_show_error_message(message: &str) -> String {
    let id = Uuid::new_v4().to_string();
    tracing::error!("[WasmExt:Error] {}", message);
    id
}

// ============================================================================
// Command Management
// ============================================================================

pub fn host_register_command(extension_id: &str, command_id: &str, title: &str) {
    let command = RegisteredCommand {
        extension_id: extension_id.to_string(),
        command_id: command_id.to_string(),
        title: title.to_string(),
    };

    let mut registry = COMMAND_REGISTRY
        .lock()
        .expect("Command registry lock poisoned");
    registry.push(command);

    info!(
        "[WasmExt] Registered command '{}' from extension '{}'",
        command_id, extension_id
    );
}

pub fn host_execute_command(command_id: &str, args_json: &str) -> Result<String, String> {
    debug!(
        "[WasmExt] Executing command '{}' with args: {}",
        command_id, args_json
    );

    let registry = COMMAND_REGISTRY
        .lock()
        .map_err(|_| "Failed to acquire command registry lock".to_string())?;

    let found = registry.iter().any(|cmd| cmd.command_id == command_id);
    if !found {
        return Err(format!("Command '{}' not found in registry", command_id));
    }

    let result = serde_json::json!({
        "command": command_id,
        "status": "dispatched"
    });

    serde_json::to_string(&result).map_err(|e| format!("Failed to serialize command result: {}", e))
}

pub fn host_get_commands() -> String {
    let registry = COMMAND_REGISTRY
        .lock()
        .expect("Command registry lock poisoned");

    serde_json::to_string(&*registry).unwrap_or_else(|_| "[]".to_string())
}

// ============================================================================
// File Operations (workspace-scoped)
// ============================================================================

fn validate_workspace_path(
    workspace_root: &str,
    relative_path: &str,
) -> Result<std::path::PathBuf, String> {
    let root = Path::new(workspace_root)
        .canonicalize()
        .map_err(|e| format!("Invalid workspace root: {}", e))?;
    let target = root.join(relative_path);
    let canonical = target.canonicalize().unwrap_or_else(|_| target.clone());
    if !canonical.starts_with(&root) {
        return Err("Path escapes workspace root".to_string());
    }
    Ok(canonical)
}

pub fn host_read_file(workspace_root: &str, relative_path: &str) -> Result<String, String> {
    let path = validate_workspace_path(workspace_root, relative_path)?;
    debug!("[WasmExt] Reading file: {}", path.display());
    fs::read_to_string(&path).map_err(|e| format!("Failed to read file: {}", e))
}

pub fn host_write_file(
    workspace_root: &str,
    relative_path: &str,
    content: &str,
) -> Result<(), String> {
    let root = Path::new(workspace_root)
        .canonicalize()
        .map_err(|e| format!("Invalid workspace root: {}", e))?;
    let target = root.join(relative_path);

    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create directories: {}", e))?;
    }

    let canonical_parent = target
        .parent()
        .unwrap_or(root.as_path())
        .canonicalize()
        .map_err(|e| format!("Cannot resolve parent: {}", e))?;
    if !canonical_parent.starts_with(&root) {
        return Err("Path escapes workspace root".to_string());
    }

    debug!("[WasmExt] Writing file: {}", target.display());
    fs::write(&target, content).map_err(|e| format!("Failed to write file: {}", e))
}

pub fn host_list_files(workspace_root: &str, pattern: &str) -> Result<String, String> {
    let root = Path::new(workspace_root)
        .canonicalize()
        .map_err(|e| format!("Invalid workspace root: {}", e))?;
    let full_pattern = root.join(pattern).to_string_lossy().to_string();

    let entries = glob::glob(&full_pattern).map_err(|e| format!("Invalid glob pattern: {}", e))?;

    let mut results: Vec<String> = Vec::new();
    for entry in entries.flatten() {
        if let Ok(canonical) = entry.canonicalize() {
            if canonical.starts_with(&root) {
                if let Ok(rel) = canonical.strip_prefix(&root) {
                    results.push(rel.to_string_lossy().to_string());
                }
            }
        }
    }

    serde_json::to_string(&results).map_err(|e| format!("Failed to serialize file list: {}", e))
}

// ============================================================================
// Event Emission
// ============================================================================

pub fn host_emit_event(event_name: &str, data_json: &str) {
    info!(
        "[WasmExt] Event emitted: {} with data: {}",
        event_name, data_json
    );
}
