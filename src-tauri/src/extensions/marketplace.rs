//! Extension marketplace integration.
//!
//! This module handles marketplace operations including searching,
//! downloading, and installing extensions from the marketplace.

use std::fs;
use std::io::Write;
use tauri::{AppHandle, Emitter, Manager};
use tracing::{info, warn};

use super::state::ExtensionsState;
use super::types::{Extension, ExtensionSource, MarketplaceExtension};
use super::utils::{extract_zip_package, find_extension_root};

/// Search marketplace extensions (mock implementation)
#[tauri::command]
pub async fn search_marketplace(
    query: String,
    _category: Option<String>,
) -> Result<Vec<MarketplaceExtension>, String> {
    // Mock marketplace data
    let mock_extensions = vec![
        MarketplaceExtension {
            name: "Cortex-theme-dracula".to_string(),
            version: "1.0.0".to_string(),
            description: "Dracula theme for Cortex Desktop".to_string(),
            author: "Cortex Community".to_string(),
            downloads: 12500,
            rating: 4.8,
            icon_url: None,
            repository_url: Some("https://github.com/Cortex/theme-dracula".to_string()),
            download_url: "https://marketplace.cortex.ai/extensions/Cortex-theme-dracula"
                .to_string(),
            categories: vec!["Themes".to_string()],
            updated_at: "2024-12-20".to_string(),
        },
        MarketplaceExtension {
            name: "Cortex-language-rust".to_string(),
            version: "2.1.0".to_string(),
            description: "Enhanced Rust language support with syntax highlighting".to_string(),
            author: "Cortex Team".to_string(),
            downloads: 45000,
            rating: 4.9,
            icon_url: None,
            repository_url: Some("https://github.com/Cortex/language-rust".to_string()),
            download_url: "https://marketplace.cortex.ai/extensions/Cortex-language-rust"
                .to_string(),
            categories: vec!["Languages".to_string()],
            updated_at: "2024-12-18".to_string(),
        },
        MarketplaceExtension {
            name: "Cortex-ai-assistant".to_string(),
            version: "1.5.0".to_string(),
            description: "AI-powered coding assistant panel".to_string(),
            author: "Cortex Team".to_string(),
            downloads: 78000,
            rating: 4.7,
            icon_url: None,
            repository_url: Some("https://github.com/Cortex/ai-assistant".to_string()),
            download_url: "https://marketplace.cortex.ai/extensions/Cortex-ai-assistant"
                .to_string(),
            categories: vec!["Panels".to_string(), "AI".to_string()],
            updated_at: "2024-12-22".to_string(),
        },
    ];

    // Filter by query
    let query_lower = query.to_lowercase();
    let filtered: Vec<MarketplaceExtension> = mock_extensions
        .into_iter()
        .filter(|ext| {
            query.is_empty()
                || ext.name.to_lowercase().contains(&query_lower)
                || ext.description.to_lowercase().contains(&query_lower)
                || ext.author.to_lowercase().contains(&query_lower)
        })
        .collect();

    Ok(filtered)
}

/// Get featured marketplace extensions
#[tauri::command]
pub async fn get_featured_extensions() -> Result<Vec<MarketplaceExtension>, String> {
    search_marketplace(String::new(), None).await
}

/// Install extension from marketplace
///
/// This downloads the extension from the marketplace, extracts it, and installs it.
/// Supports both .zip packages and direct git repository clones.
#[tauri::command]
pub async fn install_from_marketplace(
    app: AppHandle,
    extension_name: String,
) -> Result<Extension, String> {
    info!("Installing extension from marketplace: {}", extension_name);

    // Search for the extension in the marketplace
    let extensions = search_marketplace(extension_name.clone(), None).await?;
    let ext_info = extensions
        .iter()
        .find(|e| e.name == extension_name)
        .ok_or_else(|| format!("Extension '{}' not found in marketplace", extension_name))?
        .clone();

    // Create a temp directory for download (blocking operation)
    let extension_name_clone = extension_name.clone();
    let temp_dir = tokio::task::spawn_blocking(move || {
        let temp_dir = std::env::temp_dir().join(format!("cortex_ext_{}", extension_name_clone));
        if temp_dir.exists() {
            fs::remove_dir_all(&temp_dir)
                .map_err(|e| format!("Failed to clean temp directory: {}", e))?;
        }
        fs::create_dir_all(&temp_dir)
            .map_err(|e| format!("Failed to create temp directory: {}", e))?;
        Ok::<_, String>(temp_dir)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))??;

    // Try to download from repository URL if available (git clone)
    if let Some(repo_url) = &ext_info.repository_url {
        if repo_url.contains("github.com") || repo_url.ends_with(".git") {
            match clone_extension_from_git(repo_url, &temp_dir).await {
                Ok(_) => {
                    info!("Successfully cloned extension from git");
                    // Install from the cloned directory (lock scope limited to avoid holding across await)
                    let extension = {
                        let state = app.state::<ExtensionsState>();
                        let mut manager = state.0.lock().map_err(|_| "Lock error")?;
                        let mut ext = manager.install_extension(&temp_dir)?;
                        ext.source = ExtensionSource::Marketplace;
                        ext
                    };

                    // Clean up temp dir (blocking operation) - lock is released here
                    let temp_dir_clone = temp_dir.clone();
                    let _ =
                        tokio::task::spawn_blocking(move || fs::remove_dir_all(&temp_dir_clone))
                            .await;

                    // Emit event
                    let _ = app.emit("extension:installed", &extension);
                    return Ok(extension);
                }
                Err(e) => {
                    warn!("Git clone failed, trying download URL: {}", e);
                }
            }
        }
    }

    // Fall back to download URL (zip package)
    let download_path = temp_dir.join(format!("{}.zip", extension_name));
    download_extension_package(&ext_info.download_url, &download_path).await?;

    // Extract the zip package
    let extract_dir = temp_dir.join("extracted");
    extract_zip_package(&download_path, &extract_dir)?;

    // Find the extension root (may be in a subdirectory)
    let ext_root = find_extension_root(&extract_dir)?;

    // Install the extension (lock scope limited to avoid holding across await)
    let extension = {
        let state = app.state::<ExtensionsState>();
        let mut manager = state.0.lock().map_err(|_| "Lock error")?;
        let mut ext = manager.install_extension(&ext_root)?;
        ext.source = ExtensionSource::Marketplace;
        ext
    };

    // Clean up temp dir (blocking operation) - lock is released here
    let temp_dir_clone = temp_dir.clone();
    let _ = tokio::task::spawn_blocking(move || fs::remove_dir_all(&temp_dir_clone)).await;

    // Emit event
    let _ = app.emit("extension:installed", &extension);

    info!("Successfully installed extension: {}", extension_name);
    Ok(extension)
}

/// Clone an extension from a git repository
async fn clone_extension_from_git(
    repo_url: &str,
    target_dir: &std::path::Path,
) -> Result<(), String> {
    let repo_url = repo_url.to_string();
    let target_dir = target_dir.to_path_buf();

    tokio::task::spawn_blocking(move || {
        let output = crate::process_utils::command("git")
            .args([
                "clone",
                "--depth",
                "1",
                &repo_url,
                &target_dir.to_string_lossy(),
            ])
            .output()
            .map_err(|e| format!("Failed to run git: {}", e))?;

        if !output.status.success() {
            return Err(format!(
                "Git clone failed: {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }

        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Download an extension package from a URL
async fn download_extension_package(
    url: &str,
    target_path: &std::path::Path,
) -> Result<(), String> {
    let response = reqwest::get(url)
        .await
        .map_err(|e| format!("Failed to download extension: {}", e))?;

    if !response.status().is_success() {
        return Err(format!(
            "Download failed with status: {}",
            response.status()
        ));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;

    let mut file =
        fs::File::create(target_path).map_err(|e| format!("Failed to create file: {}", e))?;

    file.write_all(&bytes)
        .map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(())
}
