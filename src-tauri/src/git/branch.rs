//! Git branch operations.

use std::path::Path;
use tracing::info;

use super::command::git_command_with_timeout;
use super::helpers::get_repo_root;

// ============================================================================
// Branch Commands
// ============================================================================

/// Rename a local branch
#[tauri::command]
pub async fn git_branch_rename(
    path: String,
    old_name: String,
    new_name: String,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let output =
            git_command_with_timeout(&["branch", "-m", &old_name, &new_name], Path::new(&path))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Failed to rename branch: {}", stderr));
        }

        info!("[Git] Renamed branch {} to {}", old_name, new_name);
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Publish a local branch to a remote (git push -u)
#[tauri::command]
pub async fn git_publish_branch(
    path: String,
    branch: Option<String>,
    remote: Option<String>,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let repo_root = get_repo_root(&path)?;
        let repo_root_path = Path::new(&repo_root);

        // Get current branch if not specified
        let branch_name = match branch {
            Some(b) => b,
            None => {
                let output =
                    git_command_with_timeout(&["branch", "--show-current"], repo_root_path)?;
                String::from_utf8_lossy(&output.stdout).trim().to_string()
            }
        };

        if branch_name.is_empty() {
            return Err("Not on a branch (HEAD is detached)".to_string());
        }

        let remote_name = remote.unwrap_or_else(|| "origin".to_string());

        info!(
            "Publishing branch '{}' to remote '{}'",
            branch_name, remote_name
        );

        // Push with upstream tracking
        let output =
            git_command_with_timeout(&["push", "-u", &remote_name, &branch_name], repo_root_path)?;

        if output.status.success() {
            info!("Branch '{}' published successfully", branch_name);
            Ok(())
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            Err(format!("Failed to publish branch: {}", stderr))
        }
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Set upstream branch for current branch
#[tauri::command]
pub async fn git_set_upstream(
    path: String,
    branch: Option<String>,
    upstream: String,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let repo_root = get_repo_root(&path)?;
        let repo_root_path = Path::new(&repo_root);

        // Get current branch if not specified
        let branch_name = match branch {
            Some(b) => b,
            None => {
                let output =
                    git_command_with_timeout(&["branch", "--show-current"], repo_root_path)?;
                String::from_utf8_lossy(&output.stdout).trim().to_string()
            }
        };

        if branch_name.is_empty() {
            return Err("Not on a branch (HEAD is detached)".to_string());
        }

        info!("Setting upstream of '{}' to '{}'", branch_name, upstream);

        let output = git_command_with_timeout(
            &["branch", "--set-upstream-to", &upstream, &branch_name],
            repo_root_path,
        )?;

        if output.status.success() {
            info!("Upstream set successfully");
            Ok(())
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            Err(format!("Failed to set upstream: {}", stderr))
        }
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Soft reset to a commit (keeps changes staged)
#[tauri::command]
pub async fn git_reset_soft(path: String, commit: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let output = git_command_with_timeout(&["reset", "--soft", &commit], Path::new(&path))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Failed to soft reset: {}", stderr));
        }

        info!("[Git] Soft reset to {}", commit);
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Clean untracked files
#[tauri::command]
pub async fn git_clean(path: String, files: Option<Vec<String>>) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let mut args = vec!["clean", "-f", "-d"];

        // If specific files are provided, clean only those
        let file_refs: Vec<&str> = files
            .as_ref()
            .map(|f| f.iter().map(|s| s.as_str()).collect())
            .unwrap_or_default();

        if !file_refs.is_empty() {
            args.push("--");
            args.extend(file_refs);
        }

        let output = git_command_with_timeout(&args, Path::new(&path))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Failed to clean: {}", stderr));
        }

        info!("[Git] Cleaned untracked files");
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}
