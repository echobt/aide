//! Search and replace functionality for Cortex Desktop
//!
//! This module provides backend support for project-wide search and replace operations.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use tauri::command;
use tracing::{info, warn};

/// A single search match
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchMatch {
    pub id: String,
    pub line: u32,
    pub column: u32,
    pub length: u32,
    pub line_text: String,
    pub preview: String,
}

/// Search result for a single file
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub uri: String,
    pub matches: Vec<SearchMatch>,
    #[serde(rename = "totalMatches")]
    pub total_matches: u32,
}

/// Replace all matches across multiple files
#[command]
pub async fn search_replace_all(
    results: Vec<SearchResult>,
    replace_text: String,
    use_regex: bool,
    preserve_case: bool,
) -> Result<u32, String> {
    let mut total_replaced = 0;

    for result in results {
        let path = result.uri.strip_prefix("file://").unwrap_or(&result.uri);

        match replace_in_file_internal(
            path,
            &result.matches,
            &replace_text,
            use_regex,
            preserve_case,
        ) {
            Ok(count) => {
                total_replaced += count;
                info!("[Search] Replaced {} matches in {}", count, path);
            }
            Err(e) => {
                warn!("[Search] Failed to replace in {}: {}", path, e);
                return Err(format!("Failed to replace in {}: {}", path, e));
            }
        }
    }

    Ok(total_replaced)
}

/// Replace all matches in a single file
#[command]
pub async fn search_replace_in_file(
    uri: String,
    matches: Vec<SearchMatch>,
    replace_text: String,
    use_regex: bool,
    preserve_case: bool,
) -> Result<u32, String> {
    let path = uri.strip_prefix("file://").unwrap_or(&uri);
    replace_in_file_internal(path, &matches, &replace_text, use_regex, preserve_case)
}

/// Request structure for replacing a single match
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReplaceMatchRequest {
    pub uri: String,
    /// The match to replace (renamed from 'match' which is a Rust keyword)
    #[serde(rename = "match")]
    pub match_info: SearchMatch,
    pub replace_text: String,
    #[serde(default)]
    pub use_regex: bool,
    #[serde(default)]
    pub preserve_case: bool,
}

/// Replace a single match
#[command]
pub async fn search_replace_match(request: ReplaceMatchRequest) -> Result<(), String> {
    let path = request.uri.strip_prefix("file://").unwrap_or(&request.uri);
    let matches = vec![request.match_info];
    replace_in_file_internal(
        path,
        &matches,
        &request.replace_text,
        request.use_regex,
        request.preserve_case,
    )?;
    Ok(())
}

/// Internal function to perform replacements in a file
fn replace_in_file_internal(
    path: &str,
    matches: &[SearchMatch],
    replace_text: &str,
    _use_regex: bool,
    preserve_case: bool,
) -> Result<u32, String> {
    let file_path = PathBuf::from(path);
    let content =
        fs::read_to_string(&file_path).map_err(|e| format!("Failed to read file: {}", e))?;

    let lines: Vec<&str> = content.lines().collect();
    let mut new_lines: Vec<String> = lines.iter().map(|s| s.to_string()).collect();

    // Group matches by line (in reverse order to handle offsets correctly)
    let mut matches_by_line: HashMap<u32, Vec<&SearchMatch>> = HashMap::new();
    for m in matches {
        matches_by_line.entry(m.line).or_default().push(m);
    }

    // Sort matches within each line by column (descending) for replacement
    for matches in matches_by_line.values_mut() {
        matches.sort_by(|a, b| b.column.cmp(&a.column));
    }

    let mut replaced_count = 0u32;

    for (line_num, line_matches) in matches_by_line {
        if (line_num as usize) >= new_lines.len() {
            continue;
        }

        let mut line = new_lines[line_num as usize].clone();

        for m in line_matches {
            let start = m.column as usize;
            let end = start + m.length as usize;

            if end <= line.len() {
                let original = &line[start..end];
                let replacement = if preserve_case {
                    apply_case_preservation(original, replace_text)
                } else {
                    replace_text.to_string()
                };

                line = format!("{}{}{}", &line[..start], replacement, &line[end..]);
                replaced_count += 1;
            }
        }

        new_lines[line_num as usize] = line;
    }

    // Write the modified content back
    let new_content = new_lines.join("\n");
    fs::write(&file_path, new_content).map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(replaced_count)
}

/// Apply case preservation to the replacement text
fn apply_case_preservation(original: &str, replacement: &str) -> String {
    if original.is_empty() || replacement.is_empty() {
        return replacement.to_string();
    }

    // Check if original is all uppercase
    if original
        .chars()
        .all(|c| !c.is_alphabetic() || c.is_uppercase())
    {
        return replacement.to_uppercase();
    }

    // Check if original is all lowercase
    if original
        .chars()
        .all(|c| !c.is_alphabetic() || c.is_lowercase())
    {
        return replacement.to_lowercase();
    }

    // Check if original is title case (first letter uppercase, rest lowercase)
    let chars: Vec<char> = original.chars().collect();
    if chars.first().map_or(false, |c| c.is_uppercase())
        && chars
            .iter()
            .skip(1)
            .all(|c| !c.is_alphabetic() || c.is_lowercase())
    {
        let mut result = replacement.to_lowercase();
        if let Some(first) = result.chars().next() {
            result = format!("{}{}", first.to_uppercase(), &result[first.len_utf8()..]);
        }
        return result;
    }

    // Default: return as-is
    replacement.to_string()
}
