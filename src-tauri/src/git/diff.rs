//! Git diff operations.

use serde::Serialize;

use super::helpers::find_repo;

// ============================================================================
// Types
// ============================================================================

#[derive(Debug, Clone, Serialize)]
pub struct DiffHunkInfo {
    pub old_start: u32,
    pub old_lines: u32,
    pub new_start: u32,
    pub new_lines: u32,
    pub header: String,
    pub lines: Vec<DiffLineInfo>,
}

#[derive(Debug, Clone, Serialize)]
pub struct DiffLineInfo {
    pub origin: String,
    pub content: String,
    pub old_lineno: Option<u32>,
    pub new_lineno: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
pub struct StructuredDiff {
    pub file_path: String,
    pub hunks: Vec<DiffHunkInfo>,
}

// ============================================================================
// Diff Commands
// ============================================================================

#[tauri::command]
pub async fn git_diff(path: String, file_path: Option<String>) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let repo = find_repo(&path)?;

        let mut diff_opts = git2::DiffOptions::new();
        if let Some(ref fp) = file_path {
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
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
pub async fn git_diff_staged(path: String, file_path: Option<String>) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let repo = find_repo(&path)?;

        let head_tree = repo
            .head()
            .and_then(|r| r.peel_to_tree())
            .map_err(|e| format!("Failed to get HEAD tree: {}", e))?;

        let mut diff_opts = git2::DiffOptions::new();
        if let Some(ref fp) = file_path {
            diff_opts.pathspec(fp);
        }

        let diff = repo
            .diff_tree_to_index(Some(&head_tree), None, Some(&mut diff_opts))
            .map_err(|e| format!("Failed to get staged diff: {}", e))?;

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
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
pub async fn git_diff_commits(
    path: String,
    from_sha: String,
    to_sha: String,
) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let repo = find_repo(&path)?;

        let from_tree = repo
            .revparse_single(&from_sha)
            .and_then(|obj| obj.peel_to_tree())
            .map_err(|e| format!("Failed to resolve '{}': {}", from_sha, e))?;

        let to_tree = repo
            .revparse_single(&to_sha)
            .and_then(|obj| obj.peel_to_tree())
            .map_err(|e| format!("Failed to resolve '{}': {}", to_sha, e))?;

        let diff = repo
            .diff_tree_to_tree(Some(&from_tree), Some(&to_tree), None)
            .map_err(|e| format!("Failed to get diff between commits: {}", e))?;

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
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
pub async fn git_diff_structured(
    path: String,
    file_path: Option<String>,
    staged: Option<bool>,
) -> Result<Vec<StructuredDiff>, String> {
    tokio::task::spawn_blocking(move || {
        let repo = find_repo(&path)?;

        let mut diff_opts = git2::DiffOptions::new();
        if let Some(ref fp) = file_path {
            diff_opts.pathspec(fp);
        }

        let diff = if staged.unwrap_or(false) {
            let head_tree = repo
                .head()
                .and_then(|r| r.peel_to_tree())
                .map_err(|e| format!("Failed to get HEAD tree: {}", e))?;

            repo.diff_tree_to_index(Some(&head_tree), None, Some(&mut diff_opts))
                .map_err(|e| format!("Failed to get staged diff: {}", e))?
        } else {
            repo.diff_index_to_workdir(None, Some(&mut diff_opts))
                .map_err(|e| format!("Failed to get diff: {}", e))?
        };

        let results = std::cell::RefCell::new(Vec::<StructuredDiff>::new());

        diff.foreach(
            &mut |delta, _progress| {
                let path_str = delta
                    .new_file()
                    .path()
                    .or_else(|| delta.old_file().path())
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or_default();
                results.borrow_mut().push(StructuredDiff {
                    file_path: path_str,
                    hunks: Vec::new(),
                });
                true
            },
            None,
            Some(&mut |_delta, hunk| {
                let header = std::str::from_utf8(hunk.header())
                    .unwrap_or("")
                    .trim_end()
                    .to_string();
                if let Some(file_diff) = results.borrow_mut().last_mut() {
                    file_diff.hunks.push(DiffHunkInfo {
                        old_start: hunk.old_start(),
                        old_lines: hunk.old_lines(),
                        new_start: hunk.new_start(),
                        new_lines: hunk.new_lines(),
                        header,
                        lines: Vec::new(),
                    });
                }
                true
            }),
            Some(&mut |_delta, _hunk, line| {
                let origin = match line.origin() {
                    '+' => "+".to_string(),
                    '-' => "-".to_string(),
                    ' ' => " ".to_string(),
                    c => c.to_string(),
                };
                let content = std::str::from_utf8(line.content())
                    .unwrap_or("")
                    .to_string();
                let line_info = DiffLineInfo {
                    origin,
                    content,
                    old_lineno: line.old_lineno(),
                    new_lineno: line.new_lineno(),
                };
                if let Some(file_diff) = results.borrow_mut().last_mut() {
                    if let Some(hunk) = file_diff.hunks.last_mut() {
                        hunk.lines.push(line_info);
                    }
                }
                true
            }),
        )
        .map_err(|e| format!("Failed to iterate diff: {}", e))?;

        Ok(results.into_inner())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}
