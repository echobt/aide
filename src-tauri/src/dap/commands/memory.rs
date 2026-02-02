//! Memory and disassembly commands
//!
//! This module contains Tauri commands for low-level memory operations:
//! reading/writing memory and disassembling code.

use tauri::State;

use super::super::protocol::{ReadMemoryResponse, WriteMemoryResponse};
use super::state::DebuggerState;
use super::types::DisassembleResult;

/// Disassemble code at a memory reference
#[tauri::command]
pub async fn debug_disassemble(
    state: State<'_, DebuggerState>,
    session_id: String,
    memory_reference: String,
    offset: Option<i64>,
    instruction_offset: Option<i64>,
    instruction_count: i64,
    resolve_symbols: Option<bool>,
) -> Result<DisassembleResult, String> {
    let sessions = state.sessions.read().await;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| format!("Session not found: {}", session_id))?;

    let session = session.read().await;
    let result = session
        .disassemble(
            &memory_reference,
            offset,
            instruction_offset,
            instruction_count,
            resolve_symbols,
        )
        .await
        .map_err(|e| format!("Failed to disassemble: {}", e))?;

    Ok(DisassembleResult {
        instructions: result.instructions,
    })
}

/// Read memory from the debuggee
#[tauri::command]
pub async fn debug_read_memory(
    state: State<'_, DebuggerState>,
    session_id: String,
    memory_reference: String,
    offset: Option<i64>,
    count: i64,
) -> Result<ReadMemoryResponse, String> {
    let sessions = state.sessions.read().await;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| format!("Session not found: {}", session_id))?;

    let session = session.read().await;
    session
        .read_memory(&memory_reference, offset, count)
        .await
        .map_err(|e| format!("Failed to read memory: {}", e))
}

/// Write memory to the debuggee
#[tauri::command]
pub async fn debug_write_memory(
    state: State<'_, DebuggerState>,
    session_id: String,
    memory_reference: String,
    offset: Option<i64>,
    data: String,
    allow_partial: Option<bool>,
) -> Result<WriteMemoryResponse, String> {
    let sessions = state.sessions.read().await;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| format!("Session not found: {}", session_id))?;

    let session = session.read().await;
    session
        .write_memory(&memory_reference, offset, &data, allow_partial)
        .await
        .map_err(|e| format!("Failed to write memory: {}", e))
}
