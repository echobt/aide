//! Diagnostics module for aggregating and managing diagnostics from multiple sources.
//!
//! This module provides Tauri commands for:
//! - Refreshing diagnostics from all sources
//! - Writing files (for export functionality)

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use tauri::AppHandle;
use tracing::{error, info};

/// Diagnostic severity levels
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DiagnosticSeverity {
    Error,
    Warning,
    Information,
    Hint,
}

/// Diagnostic source types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DiagnosticSource {
    Lsp,
    Typescript,
    Eslint,
    Build,
    Task,
    Custom,
}

/// Diagnostic position in a file
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiagnosticPosition {
    pub line: u32,
    pub character: u32,
}

/// Diagnostic range in a file
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiagnosticRange {
    pub start: DiagnosticPosition,
    pub end: DiagnosticPosition,
}

/// A unified diagnostic from any source
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnifiedDiagnostic {
    pub uri: String,
    pub range: DiagnosticRange,
    pub severity: DiagnosticSeverity,
    pub source: DiagnosticSource,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_name: Option<String>,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,
}

/// Summary of diagnostic counts
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DiagnosticSummary {
    pub error_count: u32,
    pub warning_count: u32,
    pub information_count: u32,
    pub hint_count: u32,
    pub total_count: u32,
}

/// Result of a diagnostics refresh operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RefreshResult {
    pub success: bool,
    pub message: String,
    pub summary: DiagnosticSummary,
}

/// Refresh diagnostics from all sources.
///
/// This command triggers a refresh of diagnostics from all registered sources.
/// The actual diagnostics are pushed via events from the LSP and other providers.
#[tauri::command]
pub async fn diagnostics_refresh(_app: AppHandle) -> Result<RefreshResult, String> {
    info!("Refreshing diagnostics from all sources");

    // In a full implementation, this would:
    // 1. Trigger LSP to re-publish diagnostics
    // 2. Re-run any build tasks that have problem matchers
    // 3. Re-run linters if configured
    //
    // For now, we return a success message and let the frontend
    // handle aggregation from the existing LSP diagnostics stream.

    Ok(RefreshResult {
        success: true,
        message: "Diagnostics refresh initiated".to_string(),
        summary: DiagnosticSummary::default(),
    })
}

/// Write content to a file.
///
/// This is used by the export functionality to save diagnostic reports.
#[tauri::command]
pub async fn write_file(path: String, content: String) -> Result<(), String> {
    let file_path = Path::new(&path);

    // Ensure parent directory exists
    if let Some(parent) = file_path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| {
                error!("Failed to create parent directory: {}", e);
                format!("Failed to create directory: {}", e)
            })?;
        }
    }

    // Write the file
    fs::write(&path, content).map_err(|e| {
        error!("Failed to write file {}: {}", path, e);
        format!("Failed to write file: {}", e)
    })?;

    info!("Successfully wrote file: {}", path);
    Ok(())
}

/// Get the current diagnostic summary without refreshing.
#[tauri::command]
pub async fn diagnostics_get_summary(_app: AppHandle) -> Result<DiagnosticSummary, String> {
    // In a full implementation, this would query the aggregated state.
    // For now, return defaults as the frontend maintains the state.
    Ok(DiagnosticSummary::default())
}
