//! Git diff operations.

use super::helpers::find_repo;

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
