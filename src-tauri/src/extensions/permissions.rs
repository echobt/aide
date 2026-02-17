//! Extension permissions and workspace-scoped file access control.
//!
//! This module provides a permissions system for extensions, enforcing
//! workspace-scoped file access and requiring explicit grants for
//! shell execution, network access, and clipboard operations.

use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use chrono::{DateTime, Utc};
use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};
use tracing::{info, warn};
use uuid::Uuid;

// ============================================================================
// Types
// ============================================================================

/// Kinds of permissions an extension can request.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum PermissionKind {
    FileRead,
    FileWrite,
    ShellExecute,
    NetworkAccess,
    ClipboardAccess,
}

/// A permission request emitted to the frontend for user approval.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PermissionRequest {
    pub request_id: String,
    pub extension_id: String,
    pub permission: PermissionKind,
    pub resource: String,
    pub reason: String,
}

/// A granted permission with scope and expiration metadata.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PermissionGrant {
    pub extension_id: String,
    pub permission: PermissionKind,
    pub scope: String,
    pub granted_at: DateTime<Utc>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<DateTime<Utc>>,
}

// ============================================================================
// Manager
// ============================================================================

/// Manages extension permission grants and workspace folder restrictions.
pub struct PermissionsManager {
    grants: DashMap<String, Vec<PermissionGrant>>,
    workspace_folders: Arc<Mutex<Vec<PathBuf>>>,
    pending_requests: DashMap<String, tokio::sync::oneshot::Sender<bool>>,
}

impl Default for PermissionsManager {
    fn default() -> Self {
        Self::new()
    }
}

impl PermissionsManager {
    pub fn new() -> Self {
        Self {
            grants: DashMap::new(),
            workspace_folders: Arc::new(Mutex::new(Vec::new())),
            pending_requests: DashMap::new(),
        }
    }

    /// Replace the set of workspace folders used for path validation.
    pub fn set_workspace_folders(&self, folders: Vec<PathBuf>) {
        let mut ws = self
            .workspace_folders
            .lock()
            .expect("workspace_folders mutex poisoned");
        *ws = folders;
    }

    /// Check whether `extension_id` may access `path` (read or write).
    ///
    /// Access is allowed when the canonicalized path falls inside any
    /// workspace folder **or** the extension holds an explicit grant whose
    /// scope is a prefix of the canonicalized path.
    pub fn check_file_access(
        &self,
        extension_id: &str,
        path: &Path,
        write: bool,
    ) -> Result<(), String> {
        let canonical = path
            .canonicalize()
            .map_err(|e| format!("Failed to resolve path {}: {}", path.display(), e))?;

        let required = if write {
            PermissionKind::FileWrite
        } else {
            PermissionKind::FileRead
        };

        let ws = self
            .workspace_folders
            .lock()
            .expect("workspace_folders mutex poisoned");

        for folder in ws.iter() {
            if let Ok(ws_canonical) = folder.canonicalize() {
                if canonical.starts_with(&ws_canonical) {
                    return Ok(());
                }
            }
        }
        drop(ws);

        if let Some(ext_grants) = self.grants.get(extension_id) {
            let now = Utc::now();
            for grant in ext_grants.iter() {
                if grant.permission != required {
                    continue;
                }
                if let Some(expires) = grant.expires_at {
                    if now > expires {
                        continue;
                    }
                }
                if let Ok(scope_canonical) = PathBuf::from(&grant.scope).canonicalize() {
                    if canonical.starts_with(&scope_canonical) {
                        return Ok(());
                    }
                }
            }
        }

        warn!(
            extension_id = extension_id,
            path = %canonical.display(),
            write = write,
            "File access denied"
        );
        Err(format!(
            "Extension '{}' does not have {} access to {}",
            extension_id,
            if write { "write" } else { "read" },
            canonical.display()
        ))
    }

    /// Returns `true` if the extension holds a non-expired `ShellExecute` grant.
    pub fn check_shell_permission(&self, extension_id: &str) -> bool {
        if let Some(ext_grants) = self.grants.get(extension_id) {
            let now = Utc::now();
            return ext_grants.iter().any(|g| {
                g.permission == PermissionKind::ShellExecute
                    && g.expires_at.is_none_or(|exp| now <= exp)
            });
        }
        false
    }

    /// Grant a permission to an extension.
    pub fn grant_permission(
        &self,
        extension_id: &str,
        permission: PermissionKind,
        scope: &str,
    ) -> PermissionGrant {
        let grant = PermissionGrant {
            extension_id: extension_id.to_string(),
            permission: permission.clone(),
            scope: scope.to_string(),
            granted_at: Utc::now(),
            expires_at: None,
        };

        self.grants
            .entry(extension_id.to_string())
            .or_default()
            .push(grant.clone());

        info!(
            extension_id = extension_id,
            permission = ?permission,
            scope = scope,
            "Permission granted"
        );

        grant
    }

    /// Revoke all grants of a specific permission kind for an extension.
    pub fn revoke_permission(&self, extension_id: &str, permission: &PermissionKind) {
        if let Some(mut ext_grants) = self.grants.get_mut(extension_id) {
            let before = ext_grants.len();
            ext_grants.retain(|g| &g.permission != permission);
            let removed = before - ext_grants.len();
            if removed > 0 {
                info!(
                    extension_id = extension_id,
                    permission = ?permission,
                    removed = removed,
                    "Permissions revoked"
                );
            }
        }
    }

    /// Revoke every grant held by an extension.
    pub fn revoke_all(&self, extension_id: &str) {
        if self.grants.remove(extension_id).is_some() {
            info!(extension_id = extension_id, "All permissions revoked");
        }
    }

    /// Return a snapshot of all grants for an extension.
    pub fn get_grants(&self, extension_id: &str) -> Vec<PermissionGrant> {
        self.grants
            .get(extension_id)
            .map(|v| v.clone())
            .unwrap_or_default()
    }

    /// Emit a permission request to the frontend and wait for a response.
    ///
    /// The frontend should listen for `plugin:permission-request` events and
    /// call `plugin_respond_permission_request` with the `request_id` and the
    /// user's decision.
    pub async fn request_shell_permission(
        &self,
        app_handle: &AppHandle,
        extension_id: &str,
        command: &str,
    ) -> Result<bool, String> {
        let request_id = Uuid::new_v4().to_string();
        let (tx, rx) = tokio::sync::oneshot::channel::<bool>();

        self.pending_requests.insert(request_id.clone(), tx);

        let request = PermissionRequest {
            request_id: request_id.clone(),
            extension_id: extension_id.to_string(),
            permission: PermissionKind::ShellExecute,
            resource: command.to_string(),
            reason: format!("Extension '{}' wants to execute: {}", extension_id, command),
        };

        app_handle
            .emit("plugin:permission-request", &request)
            .map_err(|e| format!("Failed to emit permission request: {}", e))?;

        info!(
            request_id = %request_id,
            extension_id = extension_id,
            command = command,
            "Shell permission requested"
        );

        match rx.await {
            Ok(approved) => {
                info!(
                    request_id = %request_id,
                    approved = approved,
                    "Shell permission response received"
                );
                Ok(approved)
            }
            Err(_) => {
                warn!(
                    request_id = %request_id,
                    "Permission request channel closed without response"
                );
                Err("Permission request was cancelled".to_string())
            }
        }
    }

    /// Deliver a user's response to a pending permission request.
    pub fn respond_permission_request(
        &self,
        request_id: &str,
        approved: bool,
    ) -> Result<(), String> {
        let (_, tx) = self
            .pending_requests
            .remove(request_id)
            .ok_or_else(|| format!("No pending permission request with id '{}'", request_id))?;

        tx.send(approved)
            .map_err(|_| "Failed to deliver permission response: receiver dropped".to_string())
    }
}

// ============================================================================
// State
// ============================================================================

/// Thread-safe wrapper for [`PermissionsManager`] managed by Tauri.
#[derive(Clone)]
pub struct PermissionsState(pub Arc<PermissionsManager>);

// ============================================================================
// Tauri Commands
// ============================================================================

/// Check whether an extension has file access to a given path.
#[tauri::command]
pub async fn plugin_check_permission(
    app: AppHandle,
    extension_id: String,
    path: String,
    write: bool,
) -> Result<bool, String> {
    let state = app.state::<PermissionsState>();
    match state
        .0
        .check_file_access(&extension_id, Path::new(&path), write)
    {
        Ok(()) => Ok(true),
        Err(reason) => {
            warn!(
                extension_id = %extension_id,
                path = %path,
                write = write,
                reason = %reason,
                "Permission check failed"
            );
            Ok(false)
        }
    }
}

/// Grant a permission to an extension.
#[tauri::command]
pub async fn plugin_grant_permission(
    app: AppHandle,
    extension_id: String,
    permission: PermissionKind,
    scope: String,
) -> Result<PermissionGrant, String> {
    let state = app.state::<PermissionsState>();
    Ok(state.0.grant_permission(&extension_id, permission, &scope))
}

/// Revoke a specific permission from an extension.
#[tauri::command]
pub async fn plugin_revoke_permission(
    app: AppHandle,
    extension_id: String,
    permission: PermissionKind,
) -> Result<(), String> {
    let state = app.state::<PermissionsState>();
    state.0.revoke_permission(&extension_id, &permission);
    Ok(())
}

/// Respond to a pending permission request from the frontend.
#[tauri::command]
pub async fn plugin_respond_permission_request(
    app: AppHandle,
    request_id: String,
    approved: bool,
) -> Result<(), String> {
    let state = app.state::<PermissionsState>();
    state.0.respond_permission_request(&request_id, approved)
}
