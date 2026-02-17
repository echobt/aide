//! SCM provider abstraction for version control operations.
//!
//! This module defines a trait that abstracts SCM operations so the application
//! could theoretically support version control systems beyond Git. The trait is
//! synchronous — callers should wrap calls in `tokio::task::spawn_blocking` when
//! invoked from async contexts.

use git2::{BranchType, StatusOptions};
use serde::Serialize;
use std::path::Path;

use super::helpers::{find_repo, status_to_string};

// ============================================================================
// SCM Data Types
// ============================================================================

#[derive(Debug, Clone, Serialize)]
pub struct ScmFileStatus {
    pub path: String,
    pub status: String,
    pub staged: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct ScmBranch {
    pub name: String,
    pub is_current: bool,
    pub upstream: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ScmCommitInfo {
    pub id: String,
    pub short_id: String,
    pub message: String,
    pub author: String,
    pub author_email: String,
    pub date: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct ScmProviderInfo {
    pub name: String,
    pub root_path: String,
    pub branch: Option<String>,
}

// ============================================================================
// SCM Provider Trait
// ============================================================================

pub trait ScmProvider: Send + Sync {
    fn name(&self) -> &str;
    fn is_available(&self, path: &str) -> bool;
    fn get_info(&self, path: &str) -> Result<ScmProviderInfo, String>;
    fn get_status(&self, path: &str) -> Result<Vec<ScmFileStatus>, String>;
    fn get_branches(&self, path: &str) -> Result<Vec<ScmBranch>, String>;
    fn get_log(&self, path: &str, max_count: u32) -> Result<Vec<ScmCommitInfo>, String>;
    fn stage(&self, path: &str, files: Vec<String>) -> Result<(), String>;
    fn unstage(&self, path: &str, files: Vec<String>) -> Result<(), String>;
    fn commit(&self, path: &str, message: &str) -> Result<String, String>;
    fn diff(&self, path: &str, file: Option<&str>) -> Result<String, String>;
}

// ============================================================================
// Git SCM Provider
// ============================================================================

pub struct GitScmProvider;

impl GitScmProvider {
    pub fn new() -> Self {
        Self
    }
}

impl Default for GitScmProvider {
    fn default() -> Self {
        Self::new()
    }
}

impl ScmProvider for GitScmProvider {
    fn name(&self) -> &str {
        "git"
    }

    fn is_available(&self, path: &str) -> bool {
        git2::Repository::discover(path).is_ok()
    }

    fn get_info(&self, path: &str) -> Result<ScmProviderInfo, String> {
        let repo = find_repo(path)?;
        let root = repo
            .workdir()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();
        let branch = repo
            .head()
            .ok()
            .and_then(|h| h.shorthand().map(|s| s.to_string()));
        Ok(ScmProviderInfo {
            name: "git".to_string(),
            root_path: root,
            branch,
        })
    }

    fn get_status(&self, path: &str) -> Result<Vec<ScmFileStatus>, String> {
        let repo = find_repo(path)?;
        let mut results = Vec::new();

        let mut opts = StatusOptions::new();
        opts.include_untracked(true)
            .recurse_untracked_dirs(true)
            .include_ignored(false);

        let statuses = repo
            .statuses(Some(&mut opts))
            .map_err(|e| format!("Failed to get status: {}", e))?;

        for entry in statuses.iter() {
            let file_path = entry.path().unwrap_or("").to_string();
            let status = entry.status();

            if status.is_index_new()
                || status.is_index_modified()
                || status.is_index_deleted()
                || status.is_index_renamed()
                || status.is_index_typechange()
            {
                results.push(ScmFileStatus {
                    path: file_path.clone(),
                    status: status_to_string(status),
                    staged: true,
                });
            }

            if status.is_wt_new()
                || status.is_wt_modified()
                || status.is_wt_deleted()
                || status.is_wt_renamed()
                || status.is_wt_typechange()
            {
                results.push(ScmFileStatus {
                    path: file_path,
                    status: status_to_string(status),
                    staged: false,
                });
            }
        }

        Ok(results)
    }

    fn get_branches(&self, path: &str) -> Result<Vec<ScmBranch>, String> {
        let repo = find_repo(path)?;
        let mut branches = Vec::new();

        let current_branch = repo
            .head()
            .ok()
            .and_then(|h| h.shorthand().map(|s| s.to_string()));

        let git_branches = repo
            .branches(Some(BranchType::Local))
            .map_err(|e| format!("Failed to list branches: {}", e))?;

        for branch_result in git_branches {
            let (branch, _) = branch_result.map_err(|e| format!("Failed to read branch: {}", e))?;

            let name = branch
                .name()
                .map_err(|e| format!("Failed to get branch name: {}", e))?
                .unwrap_or("")
                .to_string();

            let upstream = branch
                .upstream()
                .ok()
                .and_then(|u| u.name().ok().flatten().map(|s| s.to_string()));

            let is_current = current_branch.as_deref() == Some(name.as_str());

            branches.push(ScmBranch {
                name,
                is_current,
                upstream,
            });
        }

        Ok(branches)
    }

    fn get_log(&self, path: &str, max_count: u32) -> Result<Vec<ScmCommitInfo>, String> {
        let repo = find_repo(path)?;
        let mut commits = Vec::new();

        let mut revwalk = repo
            .revwalk()
            .map_err(|e| format!("Failed to create revwalk: {}", e))?;

        revwalk
            .push_head()
            .map_err(|e| format!("Failed to push HEAD: {}", e))?;

        for (i, oid_result) in revwalk.enumerate() {
            if i >= max_count as usize {
                break;
            }

            let oid = oid_result.map_err(|e| format!("Failed to get commit oid: {}", e))?;
            let commit = repo
                .find_commit(oid)
                .map_err(|e| format!("Failed to find commit: {}", e))?;

            let id = oid.to_string();
            let short_id = id.get(..7).unwrap_or(&id).to_string();

            commits.push(ScmCommitInfo {
                id,
                short_id,
                message: commit.message().unwrap_or("").to_string(),
                author: commit.author().name().unwrap_or("").to_string(),
                author_email: commit.author().email().unwrap_or("").to_string(),
                date: commit.time().seconds(),
            });
        }

        Ok(commits)
    }

    fn stage(&self, path: &str, files: Vec<String>) -> Result<(), String> {
        let repo = find_repo(path)?;
        let mut index = repo
            .index()
            .map_err(|e| format!("Failed to get index: {}", e))?;

        for file in &files {
            index
                .add_path(Path::new(file))
                .map_err(|e| format!("Failed to stage file '{}': {}", file, e))?;
        }

        index
            .write()
            .map_err(|e| format!("Failed to write index: {}", e))?;

        Ok(())
    }

    fn unstage(&self, path: &str, files: Vec<String>) -> Result<(), String> {
        let repo = find_repo(path)?;

        let head = repo
            .head()
            .map_err(|e| format!("Failed to get HEAD: {}", e))?;
        let head_commit = head
            .peel_to_commit()
            .map_err(|e| format!("Failed to get HEAD commit: {}", e))?;

        let paths: Vec<&Path> = files.iter().map(|f| Path::new(f.as_str())).collect();
        repo.reset_default(Some(&head_commit.into_object()), paths)
            .map_err(|e| format!("Failed to unstage files: {}", e))?;

        Ok(())
    }

    fn commit(&self, path: &str, message: &str) -> Result<String, String> {
        let repo = find_repo(path)?;

        let mut index = repo
            .index()
            .map_err(|e| format!("Failed to get index: {}", e))?;

        let tree_oid = index
            .write_tree()
            .map_err(|e| format!("Failed to write tree: {}", e))?;

        let tree = repo
            .find_tree(tree_oid)
            .map_err(|e| format!("Failed to find tree: {}", e))?;

        let signature = repo
            .signature()
            .map_err(|e| format!("Failed to get signature: {}", e))?;

        let parent = repo.head().ok().and_then(|h| h.peel_to_commit().ok());
        let parents: Vec<&git2::Commit> = parent.iter().collect();

        let oid = repo
            .commit(
                Some("HEAD"),
                &signature,
                &signature,
                message,
                &tree,
                &parents,
            )
            .map_err(|e| format!("Failed to commit: {}", e))?;

        Ok(oid.to_string())
    }

    fn diff(&self, path: &str, file: Option<&str>) -> Result<String, String> {
        let repo = find_repo(path)?;

        let mut diff_opts = git2::DiffOptions::new();
        if let Some(fp) = file {
            diff_opts.pathspec(fp);
        }

        let diff = repo
            .diff_index_to_workdir(None, Some(&mut diff_opts))
            .map_err(|e| format!("Failed to get diff: {}", e))?;

        let mut diff_text = String::new();
        diff.print(git2::DiffFormat::Patch, |_delta, _hunk, line| {
            let prefix = match line.origin() {
                '+' => "+",
                '-' => "-",
                ' ' => " ",
                '>' => ">",
                '<' => "<",
                'H' => "",
                _ => "",
            };
            if let Ok(content) = std::str::from_utf8(line.content()) {
                diff_text.push_str(prefix);
                diff_text.push_str(content);
            }
            true
        })
        .map_err(|e| format!("Failed to format diff: {}", e))?;

        Ok(diff_text)
    }
}
