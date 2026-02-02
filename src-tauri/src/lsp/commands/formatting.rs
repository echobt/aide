//! Formatting commands
//!
//! Commands for document formatting.

use tauri::State;

use crate::lsp::types::{FormattingParams, FormattingResult, RangeFormattingParams};

use super::state::LspState;

/// Format document
#[tauri::command]
pub async fn lsp_format(
    server_id: String,
    params: FormattingParams,
    state: State<'_, LspState>,
) -> Result<FormattingResult, String> {
    let client = {
        let clients = state.clients.lock();
        clients
            .get(&server_id)
            .cloned()
            .ok_or_else(|| format!("Server not found: {}", server_id))?
    };

    client
        .format(params)
        .await
        .map_err(|e| format!("Format request failed: {}", e))
}

/// Format document range
#[tauri::command]
pub async fn lsp_format_range(
    server_id: String,
    params: RangeFormattingParams,
    state: State<'_, LspState>,
) -> Result<FormattingResult, String> {
    let client = {
        let clients = state.clients.lock();
        clients
            .get(&server_id)
            .cloned()
            .ok_or_else(|| format!("Server not found: {}", server_id))?
    };

    client
        .format_range(params)
        .await
        .map_err(|e| format!("Range format request failed: {}", e))
}
