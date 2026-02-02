//! Git data structures and type definitions.

use serde::{Deserialize, Serialize};

// ============================================================================
// Basic Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitFile {
    pub path: String,
    pub status: String,
    pub staged: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitBranch {
    pub name: String,
    pub is_head: bool,
    pub is_remote: bool,
    pub upstream: Option<String>,
    pub ahead: Option<u32>,
    pub behind: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitRemote {
    pub name: String,
    pub url: Option<String>,
    pub fetch_url: Option<String>,
    pub push_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitStash {
    pub index: usize,
    pub message: String,
    pub branch: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitCommit {
    pub sha: String,
    pub short_sha: String,
    pub message: String,
    pub author: String,
    pub author_email: String,
    pub date: i64,
}

// ============================================================================
// Response Types
// ============================================================================

#[derive(Debug, Serialize)]
pub struct IsRepoResponse {
    #[serde(rename = "isRepo")]
    pub is_repo: bool,
}

#[derive(Debug, Serialize)]
pub struct RootResponse {
    pub root: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct StatusResponse {
    pub branch: String,
    pub staged: Vec<GitFile>,
    pub unstaged: Vec<GitFile>,
    pub conflicts: Vec<GitFile>,
    pub ahead: u32,
    pub behind: u32,
    #[serde(rename = "headSha")]
    pub head_sha: Option<String>,
    #[serde(rename = "isMerging")]
    pub is_merging: bool,
    #[serde(rename = "isRebasing")]
    pub is_rebasing: bool,
    /// Indicates if the file list was truncated due to size limits
    #[serde(rename = "truncated", skip_serializing_if = "Option::is_none")]
    pub truncated: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct BranchesResponse {
    pub branches: Vec<GitBranch>,
}

#[derive(Debug, Serialize)]
pub struct RemotesResponse {
    pub remotes: Vec<GitRemote>,
}

#[derive(Debug, Serialize)]
pub struct GitRemoteResponse {
    pub url: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct GitBranchResponse {
    pub branch: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct GitHeadResponse {
    pub sha: String,
}

#[derive(Debug, Serialize)]
pub struct StashesResponse {
    pub stashes: Vec<GitStash>,
}

// ============================================================================
// Cherry-pick Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitFile {
    pub path: String,
    pub status: String, // "added", "modified", "deleted"
    pub additions: u32,
    pub deletions: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CherryPickStatus {
    pub in_progress: bool,
    pub current_commit: Option<String>,
    pub has_conflicts: bool,
}

// ============================================================================
// Rebase Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RebaseCommit {
    pub hash: String,
    pub short_hash: String,
    pub message: String,
    pub author: String,
    pub date: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RebaseAction {
    pub hash: String,
    pub action: String, // "pick", "reword", "edit", "squash", "fixup", "drop"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RebaseStatus {
    pub in_progress: bool,
    pub current_commit: Option<String>,
    pub remaining: u32,
    pub total: u32,
    pub has_conflicts: bool,
    pub conflict_files: Vec<String>,
    pub paused_commit: Option<RebaseCommit>,
}

// ============================================================================
// Bisect Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BisectStatus {
    pub in_progress: bool,
    pub current_commit: Option<String>,
    pub good_commits: Vec<String>,
    pub bad_commits: Vec<String>,
    pub remaining_steps: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BisectResult {
    pub current_commit: String,
    pub remaining_steps: u32,
    pub found_culprit: bool,
    pub culprit_commit: Option<String>,
}

// ============================================================================
// Stash Types
// ============================================================================

/// Stash entry with enhanced metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StashEntry {
    pub index: u32,
    pub message: String,
    pub date: String,
    pub branch: Option<String>,
}

/// Stash diff information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StashDiff {
    pub index: usize,
    pub message: String,
    pub diff: String,
    pub files: Vec<StashDiffFile>,
}

/// File changed in a stash
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StashDiffFile {
    pub path: String,
    pub status: String,
    pub additions: u32,
    pub deletions: u32,
}

// ============================================================================
// Submodule Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubmoduleInfo {
    pub name: String,
    pub path: String,
    pub url: String,
    pub branch: Option<String>,
    pub head_id: Option<String>,
    pub status: String, // "uninitialized", "initialized", "modified"
}

// ============================================================================
// Tag Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitTag {
    pub name: String,
    pub message: Option<String>,
    pub tagger: Option<String>,
    pub date: Option<String>,
    pub commit_sha: String,
    pub is_annotated: bool,
}

// ============================================================================
// Worktree Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorktreeInfo {
    pub path: String,
    pub head: Option<String>,
    pub branch: Option<String>,
    pub is_bare: bool,
    pub is_detached: bool,
    pub is_locked: bool,
    pub lock_reason: Option<String>,
    pub prunable: bool,
}

// ============================================================================
// LFS Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LFSStatus {
    pub installed: bool,
    pub initialized: bool,
    pub version: Option<String>,
    pub tracked_patterns: Vec<String>,
    pub files_count: u32,
    pub files_size: u64,
    pub lfs_files: Vec<LFSFileEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LFSFileEntry {
    pub path: String,
    pub size: u64,
    pub oid: Option<String>,
    pub downloaded: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LFSFileInfo {
    pub path: String,
    pub is_lfs: bool,
    pub size: u64,
    pub oid: Option<String>,
    pub downloaded: bool,
    pub pointer_size: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LFSDirSummary {
    pub total_files: u32,
    pub lfs_files: u32,
    pub total_size: u64,
    pub lfs_size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LFSLock {
    pub id: String,
    pub path: String,
    pub owner: String,
    pub locked_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LFSTrackPreviewFile {
    pub path: String,
    pub size: u64,
    pub would_track: bool,
}

// ============================================================================
// Clone Types
// ============================================================================

/// Progress information for git clone operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloneProgress {
    pub stage: String, // "counting", "compressing", "receiving", "resolving", "checking_out"
    pub current: u32,
    pub total: u32,
    pub bytes_received: Option<u64>,
    pub message: Option<String>,
}

// ============================================================================
// Merge Types
// ============================================================================

/// Result of a merge operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MergeResult {
    pub success: bool,
    pub fast_forward: bool,
    pub conflicts: Vec<String>,
    pub message: Option<String>,
}

// ============================================================================
// Branch Comparison Types
// ============================================================================

/// Get comparison information between two branches
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BranchComparison {
    pub ahead: u32,
    pub behind: u32,
    pub commits_ahead: Vec<GitCommit>,
    pub commits_behind: Vec<GitCommit>,
    pub can_fast_forward: bool,
}

// ============================================================================
// Line Staging Types
// ============================================================================

/// Line range for staging/unstaging specific lines
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LineRange {
    pub start: u32,
    pub end: u32,
}
