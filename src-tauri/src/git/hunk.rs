//! Git hunk-level staging operations.

use tracing::info;

use super::command::git_command_with_timeout_stdin;
use super::helpers::find_repo;

// ============================================================================
// Hunk Staging Commands
// ============================================================================

/// Data structure to hold hunk information extracted from diff
struct HunkData {
    header: String,
    old_start: u32,
    old_lines: u32,
    new_start: u32,
    new_lines: u32,
    lines: Vec<(char, String)>, // (origin, content)
}

/// Stage a single hunk from a file
/// Uses git CLI for hunk staging since git2 doesn't have direct hunk-level staging
#[tauri::command]
pub async fn git_stage_hunk(path: String, file: String, hunk_index: u32) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let repo = find_repo(&path)?;
        let workdir = repo
            .workdir()
            .ok_or("Repository has no working directory")?;

        // Get the diff for the file
        let mut diff_opts = git2::DiffOptions::new();
        diff_opts.pathspec(&file);

        let diff = repo
            .diff_index_to_workdir(None, Some(&mut diff_opts))
            .map_err(|e| format!("Failed to get diff: {}", e))?;

        // Collect hunks using RefCell for interior mutability (needed by diff.foreach callbacks)
        use std::cell::RefCell;
        let hunks: RefCell<Vec<HunkData>> = RefCell::new(Vec::new());
        let current_hunk: RefCell<Option<HunkData>> = RefCell::new(None);

        diff.foreach(
            &mut |_, _| true,
            None,
            Some(&mut |_delta, hunk| {
                let mut cur = current_hunk.borrow_mut();
                if let Some(h) = cur.take() {
                    hunks.borrow_mut().push(h);
                }
                *cur = Some(HunkData {
                    header: String::from_utf8_lossy(hunk.header()).to_string(),
                    old_start: hunk.old_start(),
                    old_lines: hunk.old_lines(),
                    new_start: hunk.new_start(),
                    new_lines: hunk.new_lines(),
                    lines: Vec::new(),
                });
                true
            }),
            Some(&mut |_delta, _hunk, line| {
                if let Some(ref mut h) = *current_hunk.borrow_mut() {
                    h.lines.push((
                        line.origin(),
                        String::from_utf8_lossy(line.content()).to_string(),
                    ));
                }
                true
            }),
        )
        .map_err(|e| format!("Failed to iterate diff: {}", e))?;

        // Don't forget the last hunk
        if let Some(h) = current_hunk.borrow_mut().take() {
            hunks.borrow_mut().push(h);
        }

        let hunks = hunks.into_inner();

        if hunk_index as usize >= hunks.len() {
            return Err(format!(
                "Hunk index {} out of range (file has {} hunks)",
                hunk_index,
                hunks.len()
            ));
        }

        // Generate a patch for just this hunk
        let hunk = &hunks[hunk_index as usize];
        let patch = generate_hunk_patch_from_data(&file, hunk);

        // Apply the patch to the index using git apply with timeout
        let result = git_command_with_timeout_stdin(
            &["apply", "--cached", "--unidiff-zero", "-"],
            workdir,
            patch.as_bytes(),
        )?;

        if !result.status.success() {
            let stderr = String::from_utf8_lossy(&result.stderr);
            return Err(format!("Failed to stage hunk: {}", stderr));
        }

        info!("Staged hunk {} of file: {}", hunk_index, file);
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Unstage a single hunk from a file
/// Uses git CLI for hunk unstaging
#[tauri::command]
pub async fn git_unstage_hunk(path: String, file: String, hunk_index: u32) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let repo = find_repo(&path)?;
        let workdir = repo
            .workdir()
            .ok_or("Repository has no working directory")?;

        // Get the staged diff for the file (HEAD to index)
        let head = repo
            .head()
            .map_err(|e| format!("Failed to get HEAD: {}", e))?;
        let head_tree = head
            .peel_to_tree()
            .map_err(|e| format!("Failed to get HEAD tree: {}", e))?;

        let mut diff_opts = git2::DiffOptions::new();
        diff_opts.pathspec(&file);

        let diff = repo
            .diff_tree_to_index(Some(&head_tree), None, Some(&mut diff_opts))
            .map_err(|e| format!("Failed to get staged diff: {}", e))?;

        // Collect hunks using RefCell for interior mutability (needed by diff.foreach callbacks)
        use std::cell::RefCell;
        let hunks: RefCell<Vec<HunkData>> = RefCell::new(Vec::new());
        let current_hunk: RefCell<Option<HunkData>> = RefCell::new(None);

        diff.foreach(
            &mut |_, _| true,
            None,
            Some(&mut |_delta, hunk| {
                let mut cur = current_hunk.borrow_mut();
                if let Some(h) = cur.take() {
                    hunks.borrow_mut().push(h);
                }
                *cur = Some(HunkData {
                    header: String::from_utf8_lossy(hunk.header()).to_string(),
                    old_start: hunk.old_start(),
                    old_lines: hunk.old_lines(),
                    new_start: hunk.new_start(),
                    new_lines: hunk.new_lines(),
                    lines: Vec::new(),
                });
                true
            }),
            Some(&mut |_delta, _hunk, line| {
                if let Some(ref mut h) = *current_hunk.borrow_mut() {
                    h.lines.push((
                        line.origin(),
                        String::from_utf8_lossy(line.content()).to_string(),
                    ));
                }
                true
            }),
        )
        .map_err(|e| format!("Failed to iterate diff: {}", e))?;

        // Don't forget the last hunk
        if let Some(h) = current_hunk.borrow_mut().take() {
            hunks.borrow_mut().push(h);
        }

        let hunks = hunks.into_inner();

        if hunk_index as usize >= hunks.len() {
            return Err(format!(
                "Hunk index {} out of range (file has {} hunks)",
                hunk_index,
                hunks.len()
            ));
        }

        // Generate a reverse patch for just this hunk
        let hunk = &hunks[hunk_index as usize];
        let patch = generate_reverse_hunk_patch_from_data(&file, hunk);

        // Apply the reverse patch to the index using git apply with timeout
        let result = git_command_with_timeout_stdin(
            &["apply", "--cached", "--unidiff-zero", "-"],
            workdir,
            patch.as_bytes(),
        )?;

        if !result.status.success() {
            let stderr = String::from_utf8_lossy(&result.stderr);
            return Err(format!("Failed to unstage hunk: {}", stderr));
        }

        info!("Unstaged hunk {} of file: {}", hunk_index, file);
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Generate a patch for a single hunk from extracted data
fn generate_hunk_patch_from_data(file: &str, hunk: &HunkData) -> String {
    let mut patch = String::new();

    // Diff header
    patch.push_str(&format!("--- a/{}\n", file));
    patch.push_str(&format!("+++ b/{}\n", file));

    // Hunk header
    patch.push_str(&hunk.header);

    // Hunk lines
    for (origin, content) in &hunk.lines {
        match origin {
            '+' | '-' | ' ' => {
                patch.push(*origin);
                patch.push_str(content);
            }
            '>' | '<' => {
                // Context markers, skip
            }
            _ => {
                patch.push_str(content);
            }
        }
    }

    // Ensure patch ends with newline
    if !patch.ends_with('\n') {
        patch.push('\n');
    }

    patch
}

/// Generate a reverse patch for a single hunk (for unstaging)
fn generate_reverse_hunk_patch_from_data(file: &str, hunk: &HunkData) -> String {
    let mut patch = String::new();

    // Diff header (reversed)
    patch.push_str(&format!("--- a/{}\n", file));
    patch.push_str(&format!("+++ b/{}\n", file));

    // Calculate reversed hunk header
    // Original: @@ -old_start,old_lines +new_start,new_lines @@
    // Reversed: @@ -new_start,new_lines +old_start,old_lines @@
    let header = format!(
        "@@ -{},{} +{},{} @@\n",
        hunk.new_start, hunk.new_lines, hunk.old_start, hunk.old_lines
    );
    patch.push_str(&header);

    // Hunk lines (reversed: + becomes -, - becomes +)
    for (origin, content) in &hunk.lines {
        match origin {
            '+' => {
                patch.push('-');
                patch.push_str(content);
            }
            '-' => {
                patch.push('+');
                patch.push_str(content);
            }
            ' ' => {
                patch.push(' ');
                patch.push_str(content);
            }
            _ => {}
        }
    }

    // Ensure patch ends with newline
    if !patch.ends_with('\n') {
        patch.push('\n');
    }

    patch
}
