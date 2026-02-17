//! WASM extension runtime using wasmtime.
//!
//! This module provides the sandboxed WASM execution environment for
//! Cortex Desktop extensions. Extensions are compiled to WASM and run
//! in isolated wasmtime instances with host function bindings.

pub mod host;
mod runtime;

pub use runtime::WasmRuntime;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use super::state::ExtensionsState;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WasmRuntimeState {
    pub id: String,
    pub status: u32,
    pub activation_time: Option<f64>,
    pub error: Option<String>,
    pub last_activity: Option<f64>,
    pub memory_usage: Option<f64>,
    pub cpu_usage: Option<f64>,
}

#[tauri::command]
pub async fn load_wasm_extension(
    app: AppHandle,
    extension_id: String,
    wasm_path: String,
) -> Result<(), String> {
    let state = app.state::<ExtensionsState>();
    let mut manager = state.0.lock().map_err(|_| "Failed to acquire lock")?;

    manager
        .wasm_runtime
        .load_extension(&extension_id, &wasm_path)
}

#[tauri::command]
pub async fn unload_wasm_extension(app: AppHandle, extension_id: String) -> Result<(), String> {
    let state = app.state::<ExtensionsState>();
    let mut manager = state.0.lock().map_err(|_| "Failed to acquire lock")?;

    manager.wasm_runtime.unload_extension(&extension_id)
}

#[tauri::command]
pub async fn execute_wasm_command(
    app: AppHandle,
    extension_id: String,
    command: String,
    args: Option<Vec<serde_json::Value>>,
) -> Result<serde_json::Value, String> {
    let state = app.state::<ExtensionsState>();
    let mut manager = state.0.lock().map_err(|_| "Failed to acquire lock")?;

    let args_json = serde_json::to_string(&args.unwrap_or_default())
        .map_err(|e| format!("Failed to serialize args: {}", e))?;

    let result = manager
        .wasm_runtime
        .execute_command(&extension_id, &command, &args_json)?;

    serde_json::from_str(&result).unwrap_or(Ok(serde_json::Value::String(result)))
}

#[tauri::command]
pub async fn get_wasm_runtime_states(app: AppHandle) -> Result<Vec<WasmRuntimeState>, String> {
    let state = app.state::<ExtensionsState>();
    let manager = state.0.lock().map_err(|_| "Failed to acquire lock")?;

    Ok(manager.wasm_runtime.get_states())
}
