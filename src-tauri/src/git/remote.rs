//! Git remote operations.

use std::path::Path;
use tracing::info;

use super::command::git_command_with_timeout;
use super::helpers::{find_repo, get_repo_root};

// ============================================================================
// Remote Management Commands
// ============================================================================

/// Add a new remote to the repository
#[tauri::command]
pub async fn git_add_remote(path: String, name: String, url: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let repo = find_repo(&path)?;

        repo.remote(&name, &url)
            .map_err(|e| format!("Failed to add remote '{}': {}", name, e))?;

        info!("Added remote '{}' with URL: {}", name, url);
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Remove a remote from the repository
#[tauri::command]
pub async fn git_remove_remote(path: String, name: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let repo = find_repo(&path)?;

        repo.remote_delete(&name)
            .map_err(|e| format!("Failed to remove remote '{}': {}", name, e))?;

        info!("Removed remote '{}'", name);
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Set the URL of an existing remote
#[tauri::command]
pub async fn git_set_remote_url(path: String, name: String, url: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let repo = find_repo(&path)?;

        repo.remote_set_url(&name, &url)
            .map_err(|e| format!("Failed to set URL for remote '{}': {}", name, e))?;

        info!("Updated remote '{}' URL to: {}", name, url);
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Set the push URL of an existing remote (separate from fetch URL)
#[tauri::command]
pub async fn git_set_remote_push_url(
    path: String,
    name: String,
    url: String,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let repo = find_repo(&path)?;

        repo.remote_set_pushurl(&name, Some(&url))
            .map_err(|e| format!("Failed to set push URL for remote '{}': {}", name, e))?;

        info!("Updated remote '{}' push URL to: {}", name, url);
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Rename a remote
#[tauri::command]
pub async fn git_rename_remote(
    path: String,
    old_name: String,
    new_name: String,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let repo = find_repo(&path)?;

        repo.remote_rename(&old_name, &new_name).map_err(|e| {
            format!(
                "Failed to rename remote '{}' to '{}': {:?}",
                old_name, new_name, e
            )
        })?;

        info!("Renamed remote '{}' to '{}'", old_name, new_name);
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

// ============================================================================
// Fetch and Push Commands
// ============================================================================

/// Fetch from a remote with configurable options
/// - prune: Remove remote-tracking references that no longer exist on the remote
/// - tags: Fetch all tags from the remote
#[tauri::command]
pub async fn git_fetch_with_options(
    path: String,
    remote: Option<String>,
    prune: bool,
    tags: bool,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let repo_root = get_repo_root(&path)?;
        let repo_root_path = Path::new(&repo_root);
        let remote_name = remote.unwrap_or_else(|| "origin".to_string());

        let mut args = vec!["fetch", remote_name.as_str()];

        if prune {
            args.push("--prune");
        }

        if tags {
            args.push("--tags");
        }

        info!(
            "Fetching from '{}' with prune={}, tags={}",
            remote_name, prune, tags
        );

        let output = git_command_with_timeout(&args, repo_root_path)?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!(
                "Failed to fetch from '{}': {}",
                remote_name, stderr
            ));
        }

        info!("Fetch completed successfully from '{}'", remote_name);
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Push to a remote with --follow-tags option
/// This pushes annotated tags that are reachable from the pushed commits
#[tauri::command]
pub async fn git_push_with_tags(
    path: String,
    remote: Option<String>,
    branch: Option<String>,
    follow_tags: bool,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let repo_root = get_repo_root(&path)?;
        let repo_root_path = Path::new(&repo_root);
        let remote_name = remote.unwrap_or_else(|| "origin".to_string());

        let mut args = vec!["push", remote_name.as_str()];

        // Add branch if specified
        let branch_ref;
        if let Some(ref b) = branch {
            branch_ref = b.clone();
            args.push(&branch_ref);
        }

        if follow_tags {
            args.push("--follow-tags");
        }

        info!(
            "Pushing to '{}' with follow_tags={}",
            remote_name, follow_tags
        );

        let output = git_command_with_timeout(&args, repo_root_path)?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Failed to push to '{}': {}", remote_name, stderr));
        }

        info!("Push completed successfully to '{}'", remote_name);
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Pull from a remote (convenience command)
#[tauri::command]
pub async fn git_pull(
    path: String,
    remote: Option<String>,
    branch: Option<String>,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let repo_root = get_repo_root(&path)?;
        let repo_root_path = Path::new(&repo_root);
        let remote_name = remote.unwrap_or_else(|| "origin".to_string());

        let mut args = vec!["pull", remote_name.as_str()];

        let branch_ref;
        if let Some(ref b) = branch {
            branch_ref = b.clone();
            args.push(&branch_ref);
        }

        info!("Pulling from '{}'", remote_name);

        let output = git_command_with_timeout(&args, repo_root_path)?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Failed to pull from '{}': {}", remote_name, stderr));
        }

        info!("Pull completed successfully from '{}'", remote_name);
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Pull with rebase from a remote
#[tauri::command]
pub async fn git_pull_rebase(
    path: String,
    remote: Option<String>,
    branch: Option<String>,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let repo_root = get_repo_root(&path)?;
        let repo_root_path = Path::new(&repo_root);
        let remote_name = remote.unwrap_or_else(|| "origin".to_string());

        let mut args = vec!["pull", "--rebase", remote_name.as_str()];

        let branch_ref;
        if let Some(ref b) = branch {
            branch_ref = b.clone();
            args.push(&branch_ref);
        }

        info!("Pulling with rebase from '{}'", remote_name);

        let output = git_command_with_timeout(&args, repo_root_path)?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!(
                "Failed to pull with rebase from '{}': {}",
                remote_name, stderr
            ));
        }

        info!(
            "Pull with rebase completed successfully from '{}'",
            remote_name
        );
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Basic fetch from a remote (convenience command)
#[tauri::command]
pub async fn git_fetch(path: String, remote: Option<String>) -> Result<(), String> {
    git_fetch_with_options(path, remote, false, false).await
}

/// Basic push to a remote (convenience command)
#[tauri::command]
pub async fn git_push(
    path: String,
    remote: Option<String>,
    branch: Option<String>,
) -> Result<(), String> {
    git_push_with_tags(path, remote, branch, false).await
}

// Frontend compatibility aliases - map frontend names to backend functions
// These are thin wrappers to handle naming conventions

/// Alias for git_add_remote (frontend uses git_remote_add)
#[tauri::command]
pub async fn git_remote_add(path: String, name: String, url: String) -> Result<(), String> {
    git_add_remote(path, name, url).await
}

/// Alias for git_remove_remote (frontend uses git_remote_remove)
#[tauri::command]
pub async fn git_remote_remove(path: String, name: String) -> Result<(), String> {
    git_remove_remote(path, name).await
}

/// Alias for git_rename_remote (frontend uses git_remote_rename)
#[tauri::command]
pub async fn git_remote_rename(
    path: String,
    old_name: String,
    new_name: String,
) -> Result<(), String> {
    git_rename_remote(path, old_name, new_name).await
}
