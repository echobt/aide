//! Git line-level staging operations.

use std::cell::RefCell;
use tracing::info;

use super::command::git_command_with_timeout_stdin;
use super::helpers::find_repo;
use super::types::LineRange;

// ============================================================================
// Line Staging Commands
// ============================================================================

struct HunkData {
    old_start: u32,
    new_start: u32,
    lines: Vec<(char, String, Option<u32>, Option<u32>)>,
}

/// Stage specific lines from a file
#[tauri::command]
pub async fn git_stage_lines(
    path: String,
    file: String,
    ranges: Vec<LineRange>,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let repo = find_repo(&path)?;
        let workdir = repo
            .workdir()
            .ok_or("Repository has no working directory")?;

        let mut diff_opts = git2::DiffOptions::new();
        diff_opts.pathspec(&file);

        let diff = repo
            .diff_index_to_workdir(None, Some(&mut diff_opts))
            .map_err(|e| format!("Failed to get diff: {}", e))?;

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
                    old_start: hunk.old_start(),
                    new_start: hunk.new_start(),
                    lines: Vec::new(),
                });
                true
            }),
            Some(&mut |_delta, _hunk, line| {
                if let Some(ref mut h) = *current_hunk.borrow_mut() {
                    h.lines.push((
                        line.origin(),
                        String::from_utf8_lossy(line.content()).to_string(),
                        line.old_lineno(),
                        line.new_lineno(),
                    ));
                }
                true
            }),
        )
        .map_err(|e| format!("Failed to iterate diff: {}", e))?;

        if let Some(h) = current_hunk.borrow_mut().take() {
            hunks.borrow_mut().push(h);
        }

        let hunks = hunks.into_inner();

        let mut patch = String::new();
        patch.push_str(&format!("--- a/{}\n", file));
        patch.push_str(&format!("+++ b/{}\n", file));

        let mut has_content = false;

        for hunk in &hunks {
            let mut hunk_lines: Vec<(char, String)> = Vec::new();
            let mut old_count: u32 = 0;
            let mut new_count: u32 = 0;

            for (origin, content, old_lineno, new_lineno) in &hunk.lines {
                let in_range = ranges.iter().any(|r| {
                    let lineno = new_lineno.or(*old_lineno).unwrap_or(0);
                    lineno >= r.start && lineno <= r.end
                });

                match origin {
                    '+' => {
                        if in_range {
                            hunk_lines.push(('+', content.clone()));
                            new_count += 1;
                        }
                    }
                    '-' => {
                        if in_range {
                            hunk_lines.push(('-', content.clone()));
                            old_count += 1;
                        } else {
                            hunk_lines.push((' ', content.clone()));
                            old_count += 1;
                            new_count += 1;
                        }
                    }
                    ' ' => {
                        hunk_lines.push((' ', content.clone()));
                        old_count += 1;
                        new_count += 1;
                    }
                    _ => {}
                }
            }

            if hunk_lines.iter().any(|(o, _)| *o == '+' || *o == '-') {
                has_content = true;
                patch.push_str(&format!(
                    "@@ -{},{} +{},{} @@\n",
                    hunk.old_start, old_count, hunk.new_start, new_count
                ));
                for (origin, content) in &hunk_lines {
                    patch.push(*origin);
                    patch.push_str(content);
                    if !content.ends_with('\n') {
                        patch.push('\n');
                    }
                }
            }
        }

        if !has_content {
            return Ok(());
        }

        let result = git_command_with_timeout_stdin(
            &["apply", "--cached", "--unidiff-zero", "-"],
            workdir,
            patch.as_bytes(),
        )?;

        if !result.status.success() {
            let stderr = String::from_utf8_lossy(&result.stderr);
            return Err(format!("Failed to stage lines: {}", stderr));
        }

        info!("Staged lines {:?} of file: {}", ranges, file);
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Unstage specific lines from a file
#[tauri::command]
pub async fn git_unstage_lines(
    path: String,
    file: String,
    ranges: Vec<LineRange>,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let repo = find_repo(&path)?;
        let workdir = repo
            .workdir()
            .ok_or("Repository has no working directory")?;

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
                    old_start: hunk.old_start(),
                    new_start: hunk.new_start(),
                    lines: Vec::new(),
                });
                true
            }),
            Some(&mut |_delta, _hunk, line| {
                if let Some(ref mut h) = *current_hunk.borrow_mut() {
                    h.lines.push((
                        line.origin(),
                        String::from_utf8_lossy(line.content()).to_string(),
                        line.old_lineno(),
                        line.new_lineno(),
                    ));
                }
                true
            }),
        )
        .map_err(|e| format!("Failed to iterate diff: {}", e))?;

        if let Some(h) = current_hunk.borrow_mut().take() {
            hunks.borrow_mut().push(h);
        }

        let hunks = hunks.into_inner();

        let mut patch = String::new();
        patch.push_str(&format!("--- a/{}\n", file));
        patch.push_str(&format!("+++ b/{}\n", file));

        let mut has_content = false;

        for hunk in &hunks {
            let mut hunk_lines: Vec<(char, String)> = Vec::new();
            let mut old_count: u32 = 0;
            let mut new_count: u32 = 0;

            for (origin, content, old_lineno, new_lineno) in &hunk.lines {
                let in_range = ranges.iter().any(|r| {
                    let lineno = new_lineno.or(*old_lineno).unwrap_or(0);
                    lineno >= r.start && lineno <= r.end
                });

                match origin {
                    '+' => {
                        if in_range {
                            hunk_lines.push(('-', content.clone()));
                            old_count += 1;
                        } else {
                            hunk_lines.push((' ', content.clone()));
                            old_count += 1;
                            new_count += 1;
                        }
                    }
                    '-' => {
                        if in_range {
                            hunk_lines.push(('+', content.clone()));
                            new_count += 1;
                        }
                    }
                    ' ' => {
                        hunk_lines.push((' ', content.clone()));
                        old_count += 1;
                        new_count += 1;
                    }
                    _ => {}
                }
            }

            if hunk_lines.iter().any(|(o, _)| *o == '+' || *o == '-') {
                has_content = true;
                patch.push_str(&format!(
                    "@@ -{},{} +{},{} @@\n",
                    hunk.new_start, old_count, hunk.old_start, new_count
                ));
                for (origin, content) in &hunk_lines {
                    patch.push(*origin);
                    patch.push_str(content);
                    if !content.ends_with('\n') {
                        patch.push('\n');
                    }
                }
            }
        }

        if !has_content {
            return Ok(());
        }

        let result = git_command_with_timeout_stdin(
            &["apply", "--cached", "--unidiff-zero", "-"],
            workdir,
            patch.as_bytes(),
        )?;

        if !result.status.success() {
            let stderr = String::from_utf8_lossy(&result.stderr);
            return Err(format!("Failed to unstage lines: {}", stderr));
        }

        info!("Unstaged lines {:?} of file: {}", ranges, file);
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}
