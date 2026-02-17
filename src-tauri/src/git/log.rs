//! Git log and history operations.

use git2::BranchType;
use serde::Serialize;
use std::collections::HashMap;

use super::command::git_command_with_timeout;
use super::helpers::find_repo;
use super::types::{BranchComparison, GitCommit};
use std::path::Path;

#[derive(Debug, Clone, Serialize)]
pub struct GraphCommit {
    pub sha: String,
    pub short_sha: String,
    pub message: String,
    pub author: String,
    pub author_email: String,
    pub date: i64,
    pub parent_shas: Vec<String>,
    pub refs: Vec<String>,
    pub is_head: bool,
    pub lane: u32,
    pub merge_lanes: Vec<u32>,
}

#[derive(Debug, Clone, Serialize)]
pub struct CommitGraph {
    pub commits: Vec<GraphCommit>,
    pub total_lanes: u32,
}

// ============================================================================
// Log Commands
// ============================================================================

#[tauri::command]
pub async fn git_log(
    path: String,
    max_count: Option<u32>,
    branch: Option<String>,
) -> Result<Vec<GitCommit>, String> {
    tokio::task::spawn_blocking(move || git_log_sync(&path, max_count, branch))
        .await
        .map_err(|e| format!("Task join error: {}", e))?
}

fn git_log_sync(
    path: &str,
    max_count: Option<u32>,
    branch: Option<String>,
) -> Result<Vec<GitCommit>, String> {
    let repo = find_repo(path)?;
    let mut commits = Vec::new();

    let max = max_count.unwrap_or(100) as usize;

    let mut revwalk = repo
        .revwalk()
        .map_err(|e| format!("Failed to create revwalk: {}", e))?;

    // If branch specified, start from that branch's head
    if let Some(ref branch_name) = branch {
        // Try local branch first
        let branch_oid = repo
            .find_branch(branch_name, BranchType::Local)
            .or_else(|_| repo.find_branch(branch_name, BranchType::Remote))
            .map_err(|e| format!("Branch '{}' not found: {}", branch_name, e))?
            .get()
            .target()
            .ok_or_else(|| format!("Branch '{}' has no target", branch_name))?;

        revwalk
            .push(branch_oid)
            .map_err(|e| format!("Failed to push branch: {}", e))?;
    } else {
        revwalk
            .push_head()
            .map_err(|e| format!("Failed to push HEAD: {}", e))?;
    }

    for (i, oid_result) in revwalk.enumerate() {
        if i >= max {
            break;
        }

        let oid = oid_result.map_err(|e| format!("Revwalk error: {}", e))?;
        let commit = repo
            .find_commit(oid)
            .map_err(|e| format!("Failed to find commit: {}", e))?;

        let sha = oid.to_string();
        let short_sha = sha[..7.min(sha.len())].to_string();
        let message = commit.message().unwrap_or("").to_string();
        let author = commit.author();

        commits.push(GitCommit {
            sha,
            short_sha,
            message,
            author: author.name().unwrap_or("").to_string(),
            author_email: author.email().unwrap_or("").to_string(),
            date: commit.time().seconds(),
        });
    }

    Ok(commits)
}

#[tauri::command]
pub async fn git_log_graph(
    path: String,
    max_count: Option<u32>,
    branch: Option<String>,
) -> Result<CommitGraph, String> {
    tokio::task::spawn_blocking(move || git_log_graph_sync(&path, max_count, branch))
        .await
        .map_err(|e| format!("Task join error: {}", e))?
}

fn git_log_graph_sync(
    path: &str,
    max_count: Option<u32>,
    branch: Option<String>,
) -> Result<CommitGraph, String> {
    let repo = find_repo(path)?;
    let max = max_count.unwrap_or(100) as usize;

    let mut revwalk = repo
        .revwalk()
        .map_err(|e| format!("Failed to create revwalk: {}", e))?;
    revwalk
        .set_sorting(git2::Sort::TOPOLOGICAL | git2::Sort::TIME)
        .map_err(|e| format!("Failed to set sorting: {}", e))?;

    if let Some(ref branch_name) = branch {
        let branch_oid = repo
            .find_branch(branch_name, BranchType::Local)
            .or_else(|_| repo.find_branch(branch_name, BranchType::Remote))
            .map_err(|e| format!("Branch '{}' not found: {}", branch_name, e))?
            .get()
            .target()
            .ok_or_else(|| format!("Branch '{}' has no target", branch_name))?;
        revwalk
            .push(branch_oid)
            .map_err(|e| format!("Failed to push branch: {}", e))?;
    } else {
        revwalk
            .push_head()
            .map_err(|e| format!("Failed to push HEAD: {}", e))?;
    }

    let head_sha = repo
        .head()
        .ok()
        .and_then(|h| h.target())
        .map(|o| o.to_string());
    let refs_map = git_get_refs_sync(path)?;

    struct RawCommit {
        sha: String,
        short_sha: String,
        message: String,
        author: String,
        author_email: String,
        date: i64,
        parent_shas: Vec<String>,
    }

    let mut raw_commits = Vec::new();
    for (i, oid_result) in revwalk.enumerate() {
        if i >= max {
            break;
        }
        let oid = oid_result.map_err(|e| format!("Revwalk error: {}", e))?;
        let commit = repo
            .find_commit(oid)
            .map_err(|e| format!("Failed to find commit: {}", e))?;
        let sha = oid.to_string();
        let short_sha = sha[..7.min(sha.len())].to_string();
        let parent_shas: Vec<String> = commit.parent_ids().map(|id| id.to_string()).collect();
        let author = commit.author();
        raw_commits.push(RawCommit {
            sha,
            short_sha,
            message: commit.message().unwrap_or("").to_string(),
            author: author.name().unwrap_or("").to_string(),
            author_email: author.email().unwrap_or("").to_string(),
            date: commit.time().seconds(),
            parent_shas,
        });
    }

    let mut active_lanes: Vec<Option<String>> = Vec::new();
    let mut graph_commits = Vec::new();
    let mut max_lanes: u32 = 0;

    for raw in &raw_commits {
        let lane = active_lanes
            .iter()
            .position(|slot| slot.as_deref() == Some(&raw.sha))
            .unwrap_or_else(|| {
                if let Some(pos) = active_lanes.iter().position(|s| s.is_none()) {
                    active_lanes[pos] = Some(raw.sha.clone());
                    pos
                } else {
                    active_lanes.push(Some(raw.sha.clone()));
                    active_lanes.len() - 1
                }
            });

        let mut merge_lanes = Vec::new();
        if raw.parent_shas.is_empty() {
            active_lanes[lane] = None;
        } else {
            active_lanes[lane] = Some(raw.parent_shas[0].clone());
            for parent_sha in &raw.parent_shas[1..] {
                let parent_lane = active_lanes
                    .iter()
                    .position(|slot| slot.as_deref() == Some(parent_sha))
                    .unwrap_or_else(|| {
                        if let Some(pos) = active_lanes.iter().position(|s| s.is_none()) {
                            active_lanes[pos] = Some(parent_sha.clone());
                            pos
                        } else {
                            active_lanes.push(Some(parent_sha.clone()));
                            active_lanes.len() - 1
                        }
                    });
                merge_lanes.push(parent_lane as u32);
            }
        }

        let current_lanes = active_lanes.len() as u32;
        if current_lanes > max_lanes {
            max_lanes = current_lanes;
        }

        graph_commits.push(GraphCommit {
            sha: raw.sha.clone(),
            short_sha: raw.short_sha.clone(),
            message: raw.message.clone(),
            author: raw.author.clone(),
            author_email: raw.author_email.clone(),
            date: raw.date,
            parent_shas: raw.parent_shas.clone(),
            refs: refs_map.get(&raw.sha).cloned().unwrap_or_default(),
            is_head: head_sha.as_deref() == Some(&raw.sha),
            lane: lane as u32,
            merge_lanes,
        });
    }

    Ok(CommitGraph {
        commits: graph_commits,
        total_lanes: max_lanes,
    })
}

// ============================================================================
// Refs Commands
// ============================================================================

fn git_get_refs_sync(path: &str) -> Result<HashMap<String, Vec<String>>, String> {
    let repo = find_repo(path)?;
    let mut refs_map: HashMap<String, Vec<String>> = HashMap::new();

    // Get HEAD ref
    if let Ok(head) = repo.head() {
        if let Some(target) = head.target() {
            let sha = target.to_string();
            refs_map.entry(sha).or_default().push("HEAD".to_string());
        }
    }

    // Get all references (branches and tags)
    let references = repo
        .references()
        .map_err(|e| format!("Failed to get references: {}", e))?;

    for reference_result in references {
        let reference = match reference_result {
            Ok(r) => r,
            Err(_) => continue,
        };

        // Get the target commit (resolve if symbolic)
        let target = if reference.is_branch() || reference.is_remote() {
            reference.target()
        } else if reference.is_tag() {
            // For tags, try to peel to commit
            reference
                .peel_to_commit()
                .ok()
                .map(|c| c.id())
                .or_else(|| reference.target())
        } else {
            reference.target()
        };

        if let Some(oid) = target {
            let sha = oid.to_string();
            let ref_name = reference.name().unwrap_or("").to_string();

            // Skip HEAD (already added)
            if ref_name == "HEAD" {
                continue;
            }

            // Format ref name for display
            let display_name = if ref_name.starts_with("refs/heads/") {
                ref_name
                    .strip_prefix("refs/heads/")
                    .expect("Prefix was matched, strip should succeed")
                    .to_string()
            } else if ref_name.starts_with("refs/remotes/") {
                ref_name
                    .strip_prefix("refs/remotes/")
                    .expect("Prefix was matched, strip should succeed")
                    .to_string()
            } else if ref_name.starts_with("refs/tags/") {
                format!(
                    "tag: {}",
                    ref_name
                        .strip_prefix("refs/tags/")
                        .expect("Prefix was matched, strip should succeed")
                )
            } else {
                ref_name
            };

            refs_map.entry(sha).or_default().push(display_name);
        }
    }

    Ok(refs_map)
}

#[tauri::command]
pub async fn git_get_refs(path: String) -> Result<HashMap<String, Vec<String>>, String> {
    tokio::task::spawn_blocking(move || git_get_refs_sync(&path))
        .await
        .map_err(|e| format!("Task join error: {}", e))?
}

// ============================================================================
// Branch Comparison
// ============================================================================

/// Compare current branch with another branch
#[tauri::command]
pub async fn git_compare_branches(
    path: String,
    base_branch: String,
    compare_branch: Option<String>,
) -> Result<BranchComparison, String> {
    tokio::task::spawn_blocking(move || {
        let repo_root = super::helpers::get_repo_root(&path)?;
        let repo_root_path = Path::new(&repo_root);

        // Get current branch if compare_branch not specified
        let compare = match compare_branch {
            Some(b) => b,
            None => {
                let output =
                    git_command_with_timeout(&["branch", "--show-current"], repo_root_path)?;
                String::from_utf8_lossy(&output.stdout).trim().to_string()
            }
        };

        // Get ahead/behind counts
        let rev_list_output = git_command_with_timeout(
            &[
                "rev-list",
                "--left-right",
                "--count",
                &format!("{}...{}", base_branch, compare),
            ],
            repo_root_path,
        )?;

        let counts = String::from_utf8_lossy(&rev_list_output.stdout);
        let parts: Vec<&str> = counts.trim().split('\t').collect();
        let behind = parts
            .first()
            .and_then(|s| s.parse::<u32>().ok())
            .unwrap_or(0);
        let ahead = parts
            .get(1)
            .and_then(|s| s.parse::<u32>().ok())
            .unwrap_or(0);

        // Get commits ahead (commits in compare that are not in base)
        let commits_ahead = get_commits_between(&repo_root, &base_branch, &compare, 20)?;

        // Get commits behind (commits in base that are not in compare)
        let commits_behind = get_commits_between(&repo_root, &compare, &base_branch, 20)?;

        // Check if can fast-forward (behind == 0 means base hasn't diverged)
        let can_fast_forward = behind == 0 && ahead > 0;

        Ok(BranchComparison {
            ahead,
            behind,
            commits_ahead,
            commits_behind,
            can_fast_forward,
        })
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Get commits that are in branch2 but not in branch1
fn get_commits_between(
    repo_root: &str,
    branch1: &str,
    branch2: &str,
    limit: u32,
) -> Result<Vec<GitCommit>, String> {
    let range = format!("{}..{}", branch1, branch2);
    let limit_str = format!("-{}", limit);

    let output = git_command_with_timeout(
        &["log", &limit_str, "--format=%H|%h|%s|%an|%ae|%ct", &range],
        Path::new(repo_root),
    )?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let commits: Vec<GitCommit> = stdout
        .lines()
        .filter(|l| !l.is_empty())
        .filter_map(|line| {
            let parts: Vec<&str> = line.splitn(6, '|').collect();
            if parts.len() >= 6 {
                Some(GitCommit {
                    sha: parts[0].to_string(),
                    short_sha: parts[1].to_string(),
                    message: parts[2].to_string(),
                    author: parts[3].to_string(),
                    author_email: parts[4].to_string(),
                    date: parts[5].parse::<i64>().unwrap_or(0),
                })
            } else {
                None
            }
        })
        .collect();

    Ok(commits)
}
