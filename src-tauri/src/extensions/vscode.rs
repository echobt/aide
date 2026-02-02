//! VS Code compatibility commands.
//!
//! These commands provide compatibility with VS Code extension API calls.
//! They are called by the frontend when attempting to execute extension commands
//! but full VS Code extension runtime compatibility is not yet implemented.

use tauri::AppHandle;

/// Execute a VS Code builtin command
///
/// This is called when trying to execute commands like `workbench.action.files.save`
/// that are VS Code builtins. Returns an error since we don't have a VS Code runtime.
#[tauri::command]
pub async fn vscode_execute_builtin_command(
    command: String,
    args: Vec<serde_json::Value>,
) -> Result<serde_json::Value, String> {
    tracing::debug!(
        "vscode_execute_builtin_command called: {} with {} args",
        command,
        args.len()
    );

    // Map common VS Code commands to Cortex equivalents where possible
    match command.as_str() {
        "workbench.action.files.save" => {
            // This should be handled by the frontend directly
            Ok(serde_json::Value::Null)
        }
        "workbench.action.files.saveAll" => Ok(serde_json::Value::Null),
        "workbench.action.closeActiveEditor" => Ok(serde_json::Value::Null),
        _ => {
            tracing::warn!(
                "VS Code builtin command '{}' is not implemented in Cortex",
                command
            );
            Err(format!(
                "VS Code command '{}' is not available in Cortex. This command requires VS Code extension runtime which is not yet implemented.",
                command
            ))
        }
    }
}

/// Execute an extension command
///
/// This is called when trying to execute commands contributed by extensions.
/// Returns an error since extension command execution is not fully implemented.
#[tauri::command]
pub async fn vscode_execute_command(
    command: String,
    args: Vec<serde_json::Value>,
) -> Result<serde_json::Value, String> {
    tracing::debug!(
        "vscode_execute_command called: {} with {} args",
        command,
        args.len()
    );

    tracing::warn!("Extension command '{}' execution not implemented", command);
    Err(format!(
        "Extension command '{}' is not available. Extension command execution requires the VS Code extension host which is not yet fully implemented.",
        command
    ))
}

/// Get command palette items from extensions
///
/// Returns a list of commands that should appear in the command palette.
/// Currently returns an empty list since extension command discovery is not implemented.
#[tauri::command]
pub async fn vscode_get_command_palette_items(
    _app: AppHandle,
) -> Result<Vec<serde_json::Value>, String> {
    tracing::debug!("vscode_get_command_palette_items called");

    // Return empty list - no extension commands available yet
    // In the future, this would scan loaded extensions for contributed commands
    Ok(Vec::new())
}
