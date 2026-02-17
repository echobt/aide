//! Workspace management for Cortex Desktop
//!
//! This module provides Tauri commands for workspace file operations:
//! - Save/load `.cortex-workspace` and `.code-workspace` files
//! - Recent workspaces tracking (last 20 entries)
//! - Cross-folder file copy/move within a workspace
//! - Relative path resolution within workspace roots

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tracing::{error, info, warn};
use walkdir::WalkDir;

const MAX_RECENT_ENTRIES: usize = 20;
const CORTEX_WORKSPACE_FILE: &str = ".cortex-workspace";
const RECENT_WORKSPACES_FILE: &str = "recent-workspaces.json";
const APP_CONFIG_DIR: &str = "cortex-desktop";

// ============================================================================
// Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceFolder {
    pub path: String,
    pub name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceConfig {
    pub folders: Vec<WorkspaceFolder>,
    pub settings: Option<serde_json::Value>,
    pub extensions: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentWorkspaceEntry {
    pub path: String,
    pub name: String,
    pub is_workspace_file: bool,
    pub folder_count: u32,
    pub last_opened: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RecentWorkspaceList {
    version: String,
    entries: Vec<RecentWorkspaceEntry>,
}

impl Default for RecentWorkspaceList {
    fn default() -> Self {
        Self {
            version: "1.0".to_string(),
            entries: Vec::new(),
        }
    }
}

// ============================================================================
// Helpers
// ============================================================================

fn get_recent_workspaces_path() -> Result<PathBuf, String> {
    let config_dir =
        dirs::config_dir().ok_or_else(|| "Unable to determine config directory".to_string())?;
    Ok(config_dir.join(APP_CONFIG_DIR).join(RECENT_WORKSPACES_FILE))
}

fn load_recent_workspaces() -> Result<RecentWorkspaceList, String> {
    let path = get_recent_workspaces_path()?;
    if !path.exists() {
        return Ok(RecentWorkspaceList::default());
    }
    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read recent workspaces: {}", e))?;
    serde_json::from_str(&content).map_err(|e| format!("Failed to parse recent workspaces: {}", e))
}

fn save_recent_workspaces(list: &RecentWorkspaceList) -> Result<(), String> {
    let path = get_recent_workspaces_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }
    let content = serde_json::to_string_pretty(list)
        .map_err(|e| format!("Failed to serialize recent workspaces: {}", e))?;
    fs::write(&path, content).map_err(|e| format!("Failed to write recent workspaces: {}", e))
}

fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<(), String> {
    fs::create_dir_all(dst).map_err(|e| format!("Failed to create directory {:?}: {}", dst, e))?;

    for entry in WalkDir::new(src).min_depth(1) {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let relative = entry
            .path()
            .strip_prefix(src)
            .map_err(|e| format!("Failed to compute relative path: {}", e))?;
        let target = dst.join(relative);

        if entry.file_type().is_dir() {
            fs::create_dir_all(&target)
                .map_err(|e| format!("Failed to create directory {:?}: {}", target, e))?;
        } else {
            if let Some(parent) = target.parent() {
                fs::create_dir_all(parent).map_err(|e| {
                    format!("Failed to create parent directory {:?}: {}", parent, e)
                })?;
            }
            fs::copy(entry.path(), &target)
                .map_err(|e| format!("Failed to copy {:?} to {:?}: {}", entry.path(), target, e))?;
        }
    }
    Ok(())
}

fn remove_dir_all_safe(path: &Path) -> Result<(), String> {
    fs::remove_dir_all(path).map_err(|e| format!("Failed to remove directory {:?}: {}", path, e))
}

fn parse_code_workspace(content: &str) -> Result<WorkspaceConfig, String> {
    let value: serde_json::Value = serde_json::from_str(content)
        .map_err(|e| format!("Failed to parse workspace file: {}", e))?;

    let folders = match value.get("folders") {
        Some(serde_json::Value::Array(arr)) => arr
            .iter()
            .map(|f| {
                let path = f
                    .get("path")
                    .and_then(|p| p.as_str())
                    .unwrap_or("")
                    .to_string();
                let name = f.get("name").and_then(|n| n.as_str()).map(String::from);
                WorkspaceFolder { path, name }
            })
            .collect(),
        _ => Vec::new(),
    };

    let settings = value.get("settings").cloned();
    let extensions = value.get("extensions").cloned();

    Ok(WorkspaceConfig {
        folders,
        settings,
        extensions,
    })
}

// ============================================================================
// Tauri Commands
// ============================================================================

#[tauri::command]
pub async fn workspace_save(path: String, config: WorkspaceConfig) -> Result<(), String> {
    let workspace_path = PathBuf::from(&path);
    tokio::task::spawn_blocking(move || {
        let file_path = workspace_path.join(CORTEX_WORKSPACE_FILE);
        let content = serde_json::to_string_pretty(&config)
            .map_err(|e| format!("Failed to serialize workspace config: {}", e))?;
        fs::write(&file_path, content)
            .map_err(|e| format!("Failed to write workspace file: {}", e))?;
        info!("Saved workspace config to {:?}", file_path);
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
pub async fn workspace_load(path: String) -> Result<WorkspaceConfig, String> {
    let workspace_path = PathBuf::from(&path);
    tokio::task::spawn_blocking(move || {
        let cortex_file = workspace_path.join(CORTEX_WORKSPACE_FILE);
        if cortex_file.exists() {
            let content = fs::read_to_string(&cortex_file)
                .map_err(|e| format!("Failed to read workspace file: {}", e))?;
            let config: WorkspaceConfig = serde_json::from_str(&content)
                .map_err(|e| format!("Failed to parse workspace config: {}", e))?;
            info!("Loaded workspace config from {:?}", cortex_file);
            return Ok(config);
        }

        let code_workspace = find_code_workspace_file(&workspace_path);
        if let Some(ws_file) = code_workspace {
            let content = fs::read_to_string(&ws_file)
                .map_err(|e| format!("Failed to read .code-workspace file: {}", e))?;
            let config = parse_code_workspace(&content)?;
            info!("Loaded workspace config from {:?}", ws_file);
            return Ok(config);
        }

        warn!("No workspace file found in {:?}", workspace_path);
        Ok(WorkspaceConfig {
            folders: vec![WorkspaceFolder {
                path: workspace_path.to_string_lossy().to_string(),
                name: workspace_path
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string()),
            }],
            settings: None,
            extensions: None,
        })
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

fn find_code_workspace_file(dir: &Path) -> Option<PathBuf> {
    let entries = fs::read_dir(dir).ok()?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() {
            if let Some(ext) = path.extension() {
                if ext == "code-workspace" {
                    return Some(path);
                }
            }
        }
    }
    None
}

#[tauri::command]
pub async fn workspace_recent_list() -> Result<Vec<RecentWorkspaceEntry>, String> {
    tokio::task::spawn_blocking(|| {
        let mut list = load_recent_workspaces()?;
        list.entries
            .sort_by(|a, b| b.last_opened.cmp(&a.last_opened));
        list.entries.truncate(MAX_RECENT_ENTRIES);
        Ok(list.entries)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
pub async fn workspace_recent_add(
    path: String,
    name: String,
    is_workspace_file: bool,
    folder_count: u32,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let mut list = load_recent_workspaces()?;
        let now = chrono::Utc::now().to_rfc3339();

        if let Some(existing) = list.entries.iter_mut().find(|e| e.path == path) {
            existing.name = name;
            existing.is_workspace_file = is_workspace_file;
            existing.folder_count = folder_count;
            existing.last_opened = now;
        } else {
            list.entries.push(RecentWorkspaceEntry {
                path: path.clone(),
                name,
                is_workspace_file,
                folder_count,
                last_opened: now,
            });
        }

        list.entries
            .sort_by(|a, b| b.last_opened.cmp(&a.last_opened));
        list.entries.truncate(MAX_RECENT_ENTRIES);

        save_recent_workspaces(&list)?;
        info!("Added recent workspace: {}", path);
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
pub async fn workspace_recent_remove(path: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let mut list = load_recent_workspaces()?;
        let original_len = list.entries.len();
        list.entries.retain(|e| e.path != path);

        if list.entries.len() < original_len {
            save_recent_workspaces(&list)?;
            info!("Removed recent workspace: {}", path);
        } else {
            warn!("Recent workspace not found for removal: {}", path);
        }
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
pub async fn workspace_resolve_path(
    workspace_root: String,
    relative_path: String,
) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let root = PathBuf::from(&workspace_root);
        let resolved = root.join(&relative_path);

        let canonical = resolved
            .canonicalize()
            .map_err(|e| format!("Failed to resolve path {:?}: {}", resolved, e))?;

        let canonical_root = root
            .canonicalize()
            .map_err(|e| format!("Failed to canonicalize workspace root {:?}: {}", root, e))?;

        if !canonical.starts_with(&canonical_root) {
            error!(
                "Path traversal detected: {:?} is outside workspace root {:?}",
                canonical, canonical_root
            );
            return Err("Resolved path is outside the workspace root".to_string());
        }

        Ok(canonical.to_string_lossy().to_string())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
pub async fn workspace_cross_folder_copy(
    source: String,
    target_folder: String,
    new_name: Option<String>,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let src_path = PathBuf::from(&source);
        let file_name = new_name.unwrap_or_else(|| {
            src_path
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| "unknown".to_string())
        });
        let dst_path = PathBuf::from(&target_folder).join(&file_name);

        if !src_path.exists() {
            return Err(format!("Source path does not exist: {}", source));
        }

        if let Some(parent) = dst_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create destination parent directory: {}", e))?;
        }

        if src_path.is_dir() {
            copy_dir_recursive(&src_path, &dst_path)?;
            info!("Copied directory {:?} to {:?}", src_path, dst_path);
        } else {
            fs::copy(&src_path, &dst_path)
                .map_err(|e| format!("Failed to copy {:?} to {:?}: {}", src_path, dst_path, e))?;
            info!("Copied file {:?} to {:?}", src_path, dst_path);
        }

        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
pub async fn workspace_cross_folder_move(
    source: String,
    target_folder: String,
    new_name: Option<String>,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let src_path = PathBuf::from(&source);
        let file_name = new_name.unwrap_or_else(|| {
            src_path
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| "unknown".to_string())
        });
        let dst_path = PathBuf::from(&target_folder).join(&file_name);

        if !src_path.exists() {
            return Err(format!("Source path does not exist: {}", source));
        }

        if let Some(parent) = dst_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create destination parent directory: {}", e))?;
        }

        match fs::rename(&src_path, &dst_path) {
            Ok(()) => {
                info!("Moved {:?} to {:?}", src_path, dst_path);
                Ok(())
            }
            Err(_rename_err) => {
                if src_path.is_dir() {
                    copy_dir_recursive(&src_path, &dst_path)?;
                    remove_dir_all_safe(&src_path)?;
                } else {
                    fs::copy(&src_path, &dst_path).map_err(|e| {
                        format!("Failed to copy {:?} to {:?}: {}", src_path, dst_path, e)
                    })?;
                    fs::remove_file(&src_path).map_err(|e| {
                        format!("Failed to remove source file {:?}: {}", src_path, e)
                    })?;
                }
                info!(
                    "Moved {:?} to {:?} (cross-device fallback)",
                    src_path, dst_path
                );
                Ok(())
            }
        }
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}
