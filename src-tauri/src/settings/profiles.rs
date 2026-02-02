//! User profiles management
//!
//! This module handles saving and loading user profiles (settings/workspaces/configurations).
//! Profiles contain user settings, workspace configurations, and UI state.

use tauri::{AppHandle, Manager};
use tracing::info;

/// Save user profiles (settings/workspaces/configurations)
///
/// This command persists user profiles to a local JSON file.
/// Profiles contain user settings, workspace configurations, and UI state.
#[tauri::command]
pub async fn profiles_save(
    app: AppHandle,
    profiles: String,
    active_id: Option<String>,
) -> Result<(), String> {
    let mut profiles_path = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("Failed to get config directory: {}", e))?;

    if !profiles_path.exists() {
        std::fs::create_dir_all(&profiles_path)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }

    profiles_path.push("profiles.json");

    // Write profiles data
    std::fs::write(&profiles_path, &profiles)
        .map_err(|e| format!("Failed to write profiles: {}", e))?;

    // Save active profile ID separately if provided
    if let Some(active) = active_id {
        let mut active_path = app
            .path()
            .app_config_dir()
            .map_err(|e| format!("Failed to get config directory: {}", e))?;
        active_path.push("active_profile.txt");
        std::fs::write(&active_path, &active)
            .map_err(|e| format!("Failed to write active profile: {}", e))?;
    }

    info!("Profiles saved to {:?}", profiles_path);
    Ok(())
}

/// Load user profiles
#[tauri::command]
pub async fn profiles_load(app: AppHandle) -> Result<(String, Option<String>), String> {
    let mut profiles_path = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("Failed to get config directory: {}", e))?;
    profiles_path.push("profiles.json");

    let profiles = if profiles_path.exists() {
        std::fs::read_to_string(&profiles_path)
            .map_err(|e| format!("Failed to read profiles: {}", e))?
    } else {
        "[]".to_string()
    };

    // Load active profile ID
    let mut active_path = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("Failed to get config directory: {}", e))?;
    active_path.push("active_profile.txt");

    let active_id = if active_path.exists() {
        Some(
            std::fs::read_to_string(&active_path)
                .map_err(|e| format!("Failed to read active profile: {}", e))?,
        )
    } else {
        None
    };

    Ok((profiles, active_id))
}
