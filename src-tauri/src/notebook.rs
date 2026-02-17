//! Notebook execution commands for Cortex Desktop
//!
//! This module provides backend support for Jupyter-style notebook execution.
//! The commands bridge to the existing REPL kernel infrastructure and provide
//! ipynb file parsing, saving, and export capabilities.

use crate::repl::{KernelEvent, KernelInfo, KernelManager};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, command};
use tokio::sync::mpsc;
use tracing::{error, info, warn};

// ===== ipynb Format Structs =====

/// Deserializer that accepts both a single string and an array of strings,
/// normalizing to `Vec<String>`.
fn deserialize_string_or_array<'de, D>(deserializer: D) -> Result<Vec<String>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum StringOrArray {
        Single(String),
        Array(Vec<String>),
    }

    match StringOrArray::deserialize(deserializer)? {
        StringOrArray::Single(s) => Ok(vec![s]),
        StringOrArray::Array(v) => Ok(v),
    }
}

/// Top-level .ipynb notebook structure (nbformat v4).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IpynbNotebook {
    #[serde(default = "default_nbformat")]
    pub nbformat: u32,
    #[serde(default)]
    pub nbformat_minor: u32,
    #[serde(default)]
    pub metadata: IpynbMetadata,
    #[serde(default)]
    pub cells: Vec<IpynbCell>,
}

fn default_nbformat() -> u32 {
    4
}

/// Notebook-level metadata.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct IpynbMetadata {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub kernelspec: Option<IpynbKernelspecMeta>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub language_info: Option<IpynbLanguageInfo>,
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

/// Kernel specification embedded in notebook metadata.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IpynbKernelspecMeta {
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub display_name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub language: Option<String>,
}

/// Language info embedded in notebook metadata.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IpynbLanguageInfo {
    #[serde(default)]
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mimetype: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub file_extension: Option<String>,
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

/// A single cell in an ipynb notebook.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IpynbCell {
    pub cell_type: String,
    #[serde(deserialize_with = "deserialize_string_or_array")]
    pub source: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub outputs: Option<Vec<IpynbOutput>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub execution_count: Option<u64>,
    #[serde(default)]
    pub metadata: serde_json::Value,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
}

/// An output entry in an ipynb cell.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IpynbOutput {
    pub output_type: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        deserialize_with = "deserialize_option_string_or_array"
    )]
    pub text: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub data: Option<HashMap<String, serde_json::Value>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub execution_count: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ename: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub evalue: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub traceback: Option<Vec<String>>,
}

fn deserialize_option_string_or_array<'de, D>(
    deserializer: D,
) -> Result<Option<Vec<String>>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum OptStringOrArray {
        Single(String),
        Array(Vec<String>),
    }

    let opt: Option<OptStringOrArray> = Option::deserialize(deserializer)?;
    Ok(opt.map(|v| match v {
        OptStringOrArray::Single(s) => vec![s],
        OptStringOrArray::Array(a) => a,
    }))
}

/// Entry returned by `notebook_list_kernels` combining Jupyter and REPL kernels.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotebookKernelEntry {
    pub name: String,
    pub display_name: String,
    pub language: String,
    pub source: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub executable: Option<String>,
}

// ===== Notebook-specific kernel state =====

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

// ===== Timeout constants =====

const KERNEL_START_TIMEOUT: Duration = Duration::from_secs(30);
const KERNEL_EXECUTE_TIMEOUT: Duration = Duration::from_secs(30);
const KERNEL_INTERRUPT_TIMEOUT: Duration = Duration::from_secs(10);
const KERNEL_SHUTDOWN_TIMEOUT: Duration = Duration::from_secs(10);

// ===== ipynb Parsing & Saving Commands =====

/// Parse a .ipynb file into structured notebook data.
#[command]
pub async fn notebook_parse_ipynb(path: String) -> Result<IpynbNotebook, String> {
    info!("[Notebook] Parsing ipynb file: {}", path);

    let content = tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| format!("Failed to read ipynb file '{}': {}", path, e))?;

    let notebook = tokio::task::spawn_blocking(move || {
        serde_json::from_str::<IpynbNotebook>(&content)
            .map_err(|e| format!("Failed to parse ipynb JSON: {}", e))
    })
    .await
    .map_err(|e| format!("Parse task failed: {}", e))??;

    info!(
        "[Notebook] Parsed {} cells from {}",
        notebook.cells.len(),
        path
    );
    Ok(notebook)
}

/// Serialize notebook data and write to a .ipynb file.
#[command]
pub async fn notebook_save_ipynb(path: String, notebook: IpynbNotebook) -> Result<(), String> {
    info!("[Notebook] Saving ipynb file: {}", path);

    let json = tokio::task::spawn_blocking(move || {
        serde_json::to_string_pretty(&notebook)
            .map_err(|e| format!("Failed to serialize notebook: {}", e))
    })
    .await
    .map_err(|e| format!("Serialize task failed: {}", e))??;

    tokio::fs::write(&path, json.as_bytes())
        .await
        .map_err(|e| format!("Failed to write ipynb file '{}': {}", path, e))?;

    info!("[Notebook] Saved ipynb file: {}", path);
    Ok(())
}

// ===== Export Commands =====

/// Export a notebook as an HTML document.
#[command]
pub async fn notebook_export_html(path: String) -> Result<String, String> {
    info!("[Notebook] Exporting notebook as HTML: {}", path);

    let content = tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| format!("Failed to read ipynb file '{}': {}", path, e))?;

    let html = tokio::task::spawn_blocking(move || -> Result<String, String> {
        let notebook: IpynbNotebook =
            serde_json::from_str(&content).map_err(|e| format!("Failed to parse ipynb: {}", e))?;

        let title = notebook
            .metadata
            .extra
            .get("title")
            .and_then(|v| v.as_str())
            .unwrap_or("Notebook");

        let mut body = String::new();

        for cell in &notebook.cells {
            let source = cell.source.join("");
            match cell.cell_type.as_str() {
                "markdown" => {
                    body.push_str("<div class=\"cell markdown-cell\">\n");
                    body.push_str(&html_escape(&source));
                    body.push_str("\n</div>\n");
                }
                "code" => {
                    body.push_str("<div class=\"cell code-cell\">\n");
                    if let Some(ec) = cell.execution_count {
                        body.push_str(&format!(
                            "<div class=\"execution-count\">In [{}]:</div>\n",
                            ec
                        ));
                    }
                    body.push_str("<pre><code>");
                    body.push_str(&html_escape(&source));
                    body.push_str("</code></pre>\n");

                    if let Some(ref outputs) = cell.outputs {
                        for output in outputs {
                            render_output_html(&mut body, output);
                        }
                    }

                    body.push_str("</div>\n");
                }
                "raw" => {
                    body.push_str("<div class=\"cell raw-cell\">\n<pre>");
                    body.push_str(&html_escape(&source));
                    body.push_str("</pre>\n</div>\n");
                }
                _ => {
                    body.push_str("<div class=\"cell\">\n<pre>");
                    body.push_str(&html_escape(&source));
                    body.push_str("</pre>\n</div>\n");
                }
            }
        }

        let html = format!(
            "<!DOCTYPE html>\n<html>\n<head>\n<meta charset=\"utf-8\">\n<title>{}</title>\n<style>\n\
             body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; }}\n\
             .cell {{ margin-bottom: 16px; padding: 12px; border: 1px solid #e1e4e8; border-radius: 6px; }}\n\
             .code-cell pre {{ background: #f6f8fa; padding: 12px; border-radius: 4px; overflow-x: auto; }}\n\
             .execution-count {{ color: #6a737d; font-size: 12px; margin-bottom: 4px; }}\n\
             .output {{ margin-top: 8px; padding: 8px; background: #fafbfc; border-left: 3px solid #0366d6; }}\n\
             .output-error {{ border-left-color: #d73a49; background: #ffeef0; }}\n\
             .raw-cell pre {{ background: #f0f0f0; padding: 12px; }}\n\
             </style>\n</head>\n<body>\n{}\n</body>\n</html>",
            html_escape(title),
            body
        );

        Ok(html)
    })
    .await
    .map_err(|e| format!("Export task failed: {}", e))??;

    info!("[Notebook] HTML export complete for: {}", path);
    Ok(html)
}

/// Export a notebook as a Python script.
#[command]
pub async fn notebook_export_python(path: String) -> Result<String, String> {
    info!("[Notebook] Exporting notebook as Python script: {}", path);

    let content = tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| format!("Failed to read ipynb file '{}': {}", path, e))?;

    let script = tokio::task::spawn_blocking(move || -> Result<String, String> {
        let notebook: IpynbNotebook =
            serde_json::from_str(&content).map_err(|e| format!("Failed to parse ipynb: {}", e))?;

        let mut parts: Vec<String> = Vec::new();
        parts.push("#!/usr/bin/env python3".to_string());
        parts.push(format!(
            "# Exported from: {}",
            notebook
                .metadata
                .extra
                .get("title")
                .and_then(|v| v.as_str())
                .unwrap_or("Notebook")
        ));
        parts.push(String::new());

        for cell in &notebook.cells {
            let source = cell.source.join("");
            match cell.cell_type.as_str() {
                "code" => {
                    parts.push(source);
                    parts.push(String::new());
                }
                "markdown" => {
                    let commented: Vec<String> = source
                        .lines()
                        .map(|line| {
                            if line.is_empty() {
                                "#".to_string()
                            } else {
                                format!("# {}", line)
                            }
                        })
                        .collect();
                    parts.push(commented.join("\n"));
                    parts.push(String::new());
                }
                "raw" => {
                    let commented: Vec<String> = source
                        .lines()
                        .map(|line| {
                            if line.is_empty() {
                                "#".to_string()
                            } else {
                                format!("# {}", line)
                            }
                        })
                        .collect();
                    parts.push(commented.join("\n"));
                    parts.push(String::new());
                }
                _ => {}
            }
        }

        Ok(parts.join("\n"))
    })
    .await
    .map_err(|e| format!("Export task failed: {}", e))??;

    info!("[Notebook] Python export complete for: {}", path);
    Ok(script)
}

// ===== Kernel Discovery =====

/// Discover available Jupyter kernels from system kernelspec locations
/// and the existing REPL kernel specs.
#[command]
pub async fn notebook_list_kernels(app: AppHandle) -> Result<Vec<NotebookKernelEntry>, String> {
    info!("[Notebook] Listing available kernels");

    let mut entries: Vec<NotebookKernelEntry> = Vec::new();

    // 1. Discover Jupyter kernelspecs from `jupyter --data-dir`
    match discover_jupyter_kernels().await {
        Ok(jupyter_entries) => {
            info!(
                "[Notebook] Found {} Jupyter kernelspecs",
                jupyter_entries.len()
            );
            entries.extend(jupyter_entries);
        }
        Err(e) => {
            warn!("[Notebook] Could not discover Jupyter kernels: {}", e);
        }
    }

    // 2. Include REPL kernel specs from the existing KernelManager
    let repl_state = app.state::<crate::REPLState>();
    let repl_specs = {
        let guard = repl_state
            .0
            .lock()
            .map_err(|_| "Failed to acquire REPL lock".to_string())?;
        match guard.as_ref() {
            Some(manager) => manager.list_kernel_specs(),
            None => Vec::new(),
        }
    };

    for spec in repl_specs {
        let already_listed = entries
            .iter()
            .any(|e| e.name == spec.id || e.display_name == spec.display_name);
        if !already_listed {
            entries.push(NotebookKernelEntry {
                name: spec.id,
                display_name: spec.display_name,
                language: spec.language,
                source: "repl".to_string(),
                executable: spec.executable,
            });
        }
    }

    info!("[Notebook] Total kernels found: {}", entries.len());
    Ok(entries)
}

/// Discover Jupyter kernelspecs by running `jupyter --data-dir` and scanning
/// the kernels subdirectory.
async fn discover_jupyter_kernels() -> Result<Vec<NotebookKernelEntry>, String> {
    let output = tokio::process::Command::new("jupyter")
        .arg("--data-dir")
        .output()
        .await
        .map_err(|e| format!("Failed to run 'jupyter --data-dir': {}", e))?;

    if !output.status.success() {
        return Err("'jupyter --data-dir' returned non-zero exit code".to_string());
    }

    let data_dir = String::from_utf8(output.stdout)
        .map_err(|e| format!("Invalid UTF-8 from jupyter: {}", e))?
        .trim()
        .to_string();

    let kernels_dir = std::path::PathBuf::from(&data_dir).join("kernels");

    let entries =
        tokio::task::spawn_blocking(move || -> Result<Vec<NotebookKernelEntry>, String> {
            let mut results = Vec::new();

            let read_dir = match std::fs::read_dir(&kernels_dir) {
                Ok(rd) => rd,
                Err(_) => return Ok(results),
            };

            for entry in read_dir.flatten() {
                let kernel_dir = entry.path();
                if !kernel_dir.is_dir() {
                    continue;
                }

                let kernel_json = kernel_dir.join("kernel.json");
                if !kernel_json.exists() {
                    continue;
                }

                let content = match std::fs::read_to_string(&kernel_json) {
                    Ok(c) => c,
                    Err(_) => continue,
                };

                let spec: serde_json::Value = match serde_json::from_str(&content) {
                    Ok(v) => v,
                    Err(_) => continue,
                };

                let name = entry.file_name().to_string_lossy().to_string();

                let display_name = spec
                    .get("display_name")
                    .and_then(|v| v.as_str())
                    .unwrap_or(&name)
                    .to_string();

                let language = spec
                    .get("language")
                    .and_then(|v| v.as_str())
                    .unwrap_or("unknown")
                    .to_string();

                let executable = spec
                    .get("argv")
                    .and_then(|v| v.as_array())
                    .and_then(|arr| arr.first())
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());

                results.push(NotebookKernelEntry {
                    name,
                    display_name,
                    language,
                    source: "jupyter".to_string(),
                    executable,
                });
            }

            Ok(results)
        })
        .await
        .map_err(|e| format!("Kernel discovery task failed: {}", e))??;

    Ok(entries)
}

// ===== Kernel Lifecycle Commands with Timeout =====

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

    let repl_state = app.state::<crate::REPLState>();
    let state_clone = repl_state.0.clone();
    let kid = kernel_id.clone();
    let cid = cell_id.clone();

    let result = tokio::time::timeout(
        KERNEL_EXECUTE_TIMEOUT,
        tokio::task::spawn_blocking(move || {
            let mut guard = state_clone
                .lock()
                .map_err(|_| "Failed to acquire REPL lock".to_string())?;

            match guard.as_mut() {
                Some(manager) => manager.execute(&kid, &code, &cid),
                None => Err("No kernel manager initialized".to_string()),
            }
        }),
    )
    .await
    .map_err(|_| {
        error!(
            "[Notebook] Execute cell {} timed out after {:?}",
            cell_id, KERNEL_EXECUTE_TIMEOUT
        );
        format!(
            "Execute cell timed out after {} seconds",
            KERNEL_EXECUTE_TIMEOUT.as_secs()
        )
    })?
    .map_err(|e| format!("Execute task failed: {}", e))??;

    Ok(result)
}

/// Interrupt a notebook's kernel
#[command]
pub async fn notebook_interrupt_kernel(app: AppHandle, kernel_id: String) -> Result<(), String> {
    info!("[Notebook] Interrupt kernel {}", kernel_id);

    let repl_state = app.state::<crate::REPLState>();
    let state_clone = repl_state.0.clone();
    let kid = kernel_id.clone();

    tokio::time::timeout(
        KERNEL_INTERRUPT_TIMEOUT,
        tokio::task::spawn_blocking(move || {
            let mut guard = state_clone
                .lock()
                .map_err(|_| "Failed to acquire REPL lock".to_string())?;

            match guard.as_mut() {
                Some(manager) => manager.interrupt(&kid),
                None => Err("No kernel manager initialized".to_string()),
            }
        }),
    )
    .await
    .map_err(|_| {
        error!(
            "[Notebook] Interrupt kernel {} timed out after {:?}",
            kernel_id, KERNEL_INTERRUPT_TIMEOUT
        );
        format!(
            "Interrupt kernel timed out after {} seconds",
            KERNEL_INTERRUPT_TIMEOUT.as_secs()
        )
    })?
    .map_err(|e| format!("Interrupt task failed: {}", e))?
}

/// Shutdown a notebook's kernel
#[command]
pub async fn notebook_shutdown_kernel(app: AppHandle, kernel_id: String) -> Result<(), String> {
    info!("[Notebook] Shutdown kernel {}", kernel_id);

    let repl_state = app.state::<crate::REPLState>();
    let state_clone = repl_state.0.clone();
    let kid = kernel_id.clone();

    tokio::time::timeout(
        KERNEL_SHUTDOWN_TIMEOUT,
        tokio::task::spawn_blocking(move || {
            let mut guard = state_clone
                .lock()
                .map_err(|_| "Failed to acquire REPL lock".to_string())?;

            match guard.as_mut() {
                Some(manager) => manager.shutdown(&kid),
                None => Err("No kernel manager initialized".to_string()),
            }
        }),
    )
    .await
    .map_err(|_| {
        error!(
            "[Notebook] Shutdown kernel {} timed out after {:?}",
            kernel_id, KERNEL_SHUTDOWN_TIMEOUT
        );
        format!(
            "Shutdown kernel timed out after {} seconds",
            KERNEL_SHUTDOWN_TIMEOUT.as_secs()
        )
    })?
    .map_err(|e| format!("Shutdown task failed: {}", e))?
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
    let state_clone = repl_state.0.clone();
    let app_clone = app.clone();

    let spec_id = match language.as_str() {
        "python" => "python3".to_string(),
        "javascript" | "typescript" => "node".to_string(),
        _ => language.clone(),
    };

    let result = tokio::time::timeout(
        KERNEL_START_TIMEOUT,
        tokio::task::spawn_blocking(move || {
            let mut guard = state_clone
                .lock()
                .map_err(|_| "Failed to acquire REPL lock".to_string())?;

            if guard.is_none() {
                let (tx, mut rx) = mpsc::unbounded_channel::<KernelEvent>();
                let emitter = app_clone.clone();

                tauri::async_runtime::spawn(async move {
                    while let Some(event) = rx.recv().await {
                        let _ = emitter.emit("repl:event", &event);
                    }
                });

                *guard = Some(KernelManager::new(tx));
            }

            match guard.as_mut() {
                Some(manager) => manager.start_kernel(&spec_id),
                None => Err("Kernel manager not initialized".to_string()),
            }
        }),
    )
    .await
    .map_err(|_| {
        error!(
            "[Notebook] Start kernel {} timed out after {:?}",
            kernel_id, KERNEL_START_TIMEOUT
        );
        format!(
            "Start kernel timed out after {} seconds",
            KERNEL_START_TIMEOUT.as_secs()
        )
    })?
    .map_err(|e| format!("Start kernel task failed: {}", e))??;

    Ok(result)
}

// ===== Helper Functions =====

/// Escape HTML special characters.
fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

/// Render a single ipynb output entry as HTML, appending to `buf`.
fn render_output_html(buf: &mut String, output: &IpynbOutput) {
    match output.output_type.as_str() {
        "stream" => {
            if let Some(ref text) = output.text {
                buf.push_str("<div class=\"output\">\n<pre>");
                buf.push_str(&html_escape(&text.join("")));
                buf.push_str("</pre>\n</div>\n");
            }
        }
        "execute_result" | "display_data" => {
            if let Some(ref data) = output.data {
                if let Some(html_val) = data.get("text/html") {
                    buf.push_str("<div class=\"output\">\n");
                    let html_text = match html_val {
                        serde_json::Value::Array(arr) => arr
                            .iter()
                            .filter_map(|v| v.as_str())
                            .collect::<Vec<_>>()
                            .join(""),
                        serde_json::Value::String(s) => s.clone(),
                        _ => String::new(),
                    };
                    buf.push_str(&html_text);
                    buf.push_str("\n</div>\n");
                } else if let Some(text_val) = data.get("text/plain") {
                    buf.push_str("<div class=\"output\">\n<pre>");
                    let text = match text_val {
                        serde_json::Value::Array(arr) => arr
                            .iter()
                            .filter_map(|v| v.as_str())
                            .collect::<Vec<_>>()
                            .join(""),
                        serde_json::Value::String(s) => s.clone(),
                        _ => String::new(),
                    };
                    buf.push_str(&html_escape(&text));
                    buf.push_str("</pre>\n</div>\n");
                }
                if let Some(png_val) = data.get("image/png") {
                    if let Some(png_data) = png_val.as_str() {
                        buf.push_str("<div class=\"output\">\n<img src=\"data:image/png;base64,");
                        buf.push_str(png_data);
                        buf.push_str("\" />\n</div>\n");
                    }
                }
            }
        }
        "error" => {
            buf.push_str("<div class=\"output output-error\">\n<pre>");
            if let Some(ref ename) = output.ename {
                buf.push_str(&html_escape(ename));
                buf.push_str(": ");
            }
            if let Some(ref evalue) = output.evalue {
                buf.push_str(&html_escape(evalue));
            }
            if let Some(ref traceback) = output.traceback {
                buf.push('\n');
                for line in traceback {
                    buf.push_str(&html_escape(line));
                    buf.push('\n');
                }
            }
            buf.push_str("</pre>\n</div>\n");
        }
        _ => {}
    }
}
