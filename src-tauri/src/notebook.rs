//! Notebook execution commands for Cortex Desktop
//!
//! This module provides backend support for Jupyter-style notebook execution.
//! The commands bridge to the existing REPL kernel infrastructure.

use crate::repl::{KernelEvent, KernelInfo, KernelManager};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, command};
use tokio::sync::mpsc;
use tracing::info;

/// Notebook-specific kernel state
pub struct NotebookKernelState {
    /// Mapping from notebook path to kernel ID
    pub notebook_kernels: Mutex<std::collections::HashMap<String, String>>,
}

impl NotebookKernelState {
    pub fn new() -> Self {
        Self {
            notebook_kernels: Mutex::new(std::collections::HashMap::new()),
        }
    }
}

impl Default for NotebookKernelState {
    fn default() -> Self {
        Self::new()
    }
}

/// Execute a cell in a notebook's kernel
#[command]
pub async fn notebook_execute_cell(
    app: AppHandle,
    kernel_id: String,
    cell_id: String,
    code: String,
    notebook_path: String,
) -> Result<u32, String> {
    info!(
        "[Notebook] Execute cell {} in kernel {} for {}",
        cell_id, kernel_id, notebook_path
    );

    // Use the REPL state which contains the KernelManager
    let repl_state = app.state::<crate::REPLState>();
    let mut guard = repl_state
        .0
        .lock()
        .map_err(|_| "Failed to acquire REPL lock")?;

    match guard.as_mut() {
        Some(manager) => manager.execute(&kernel_id, &code, &cell_id),
        None => Err("No kernel manager initialized".to_string()),
    }
}

/// Interrupt a notebook's kernel
#[command]
pub async fn notebook_interrupt_kernel(app: AppHandle, kernel_id: String) -> Result<(), String> {
    info!("[Notebook] Interrupt kernel {}", kernel_id);

    let repl_state = app.state::<crate::REPLState>();
    let mut guard = repl_state
        .0
        .lock()
        .map_err(|_| "Failed to acquire REPL lock")?;

    match guard.as_mut() {
        Some(manager) => manager.interrupt(&kernel_id),
        None => Err("No kernel manager initialized".to_string()),
    }
}

/// Shutdown a notebook's kernel
#[command]
pub async fn notebook_shutdown_kernel(app: AppHandle, kernel_id: String) -> Result<(), String> {
    info!("[Notebook] Shutdown kernel {}", kernel_id);

    let repl_state = app.state::<crate::REPLState>();
    let mut guard = repl_state
        .0
        .lock()
        .map_err(|_| "Failed to acquire REPL lock")?;

    match guard.as_mut() {
        Some(manager) => manager.shutdown(&kernel_id),
        None => Err("No kernel manager initialized".to_string()),
    }
}

/// Start a kernel for a notebook
#[command]
pub async fn notebook_start_kernel(
    app: AppHandle,
    kernel_id: String,
    language: String,
    notebook_path: String,
) -> Result<KernelInfo, String> {
    info!(
        "[Notebook] Start {} kernel {} for {}",
        language, kernel_id, notebook_path
    );

    let repl_state = app.state::<crate::REPLState>();
    let mut guard = repl_state
        .0
        .lock()
        .map_err(|_| "Failed to acquire REPL lock")?;

    if guard.is_none() {
        let (tx, mut rx) = mpsc::unbounded_channel::<KernelEvent>();
        let app_clone = app.clone();

        tauri::async_runtime::spawn(async move {
            while let Some(event) = rx.recv().await {
                let _ = app_clone.emit("repl:event", &event);
            }
        });

        *guard = Some(KernelManager::new(tx));
    }

    // Map notebook language to kernel spec ID
    let spec_id = match language.as_str() {
        "python" => "python3",
        "javascript" | "typescript" => "node",
        _ => &language,
    };

    guard.as_mut().unwrap().start_kernel(spec_id)
}
