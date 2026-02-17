//! File Search - File name and content search operations
//!
//! This module provides file search capabilities including filename search
//! and content search with optional ripgrep integration.

use ignore::WalkBuilder;
use parking_lot::Mutex;
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::File;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::sync::Arc;
use std::sync::atomic::{AtomicU32, Ordering};
use std::time::Instant;
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::Semaphore;
use tokio::task::JoinSet;
use tracing::{info, warn};

use crate::fs::types::{ContentSearchResponse, FileEntry, IoSemaphore, SearchMatch, SearchResult};
use crate::fs::utils::{get_extension, should_ignore, should_skip_for_search, system_time_to_unix};

// ============================================================================
// File Name Search
// ============================================================================

#[tauri::command]
pub async fn fs_search_files(
    app: AppHandle,
    root_path: String,
    query: String,
    max_results: u32,
) -> Result<Vec<FileEntry>, String> {
    let root = PathBuf::from(&root_path);
    let query_lower = query.to_lowercase();
    let max = max_results as usize;
    let semaphore = app.state::<Arc<IoSemaphore>>();

    let results = Arc::new(Mutex::new(Vec::new()));
    search_files_parallel(
        root,
        query_lower,
        Arc::clone(&results),
        max,
        semaphore.get(),
    )
    .await?;

    let final_results = results.lock().clone();
    Ok(final_results)
}

fn search_files_parallel(
    dir: PathBuf,
    query: String,
    results: Arc<Mutex<Vec<FileEntry>>>,
    max: usize,
    semaphore: Arc<Semaphore>,
) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<(), String>> + Send>> {
    Box::pin(async move {
        if results.lock().len() >= max {
            return Ok(());
        }

        let _permit = match semaphore.clone().try_acquire_owned() {
            Ok(p) => p,
            Err(_) => return Ok(()),
        };

        let dir_clone = dir.clone();
        let entries: Vec<(PathBuf, String, bool)> = tokio::task::spawn_blocking(move || {
            let mut entries = Vec::new();
            if let Ok(read_dir) = std::fs::read_dir(&dir_clone) {
                for entry in read_dir.flatten() {
                    let path = entry.path();
                    let name = entry.file_name().to_string_lossy().to_string();

                    if name.starts_with('.') || should_ignore(&name) {
                        continue;
                    }

                    let is_dir = entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false);
                    entries.push((path, name, is_dir));
                }
            }
            entries
        })
        .await
        .map_err(|e| format!("Task join error: {}", e))?;

        drop(_permit);

        let query_owned = query.clone();
        let matching: Vec<FileEntry> = entries
            .par_iter()
            .filter_map(|(path, name, is_dir)| {
                if name.to_lowercase().contains(&query_owned) {
                    let metadata = std::fs::metadata(path).ok();
                    Some(FileEntry {
                        name: name.clone(),
                        path: path.to_string_lossy().to_string(),
                        is_dir: *is_dir,
                        is_hidden: name.starts_with('.'),
                        is_symlink: std::fs::symlink_metadata(path)
                            .map(|m| m.file_type().is_symlink())
                            .unwrap_or(false),
                        size: metadata.as_ref().map(|m| m.len()),
                        modified_at: metadata
                            .and_then(|m| m.modified().ok())
                            .and_then(system_time_to_unix),
                        extension: get_extension(name),
                        children: None,
                    })
                } else {
                    None
                }
            })
            .collect();

        {
            let mut results_guard = results.lock();
            for entry in matching {
                if results_guard.len() >= max {
                    return Ok(());
                }
                results_guard.push(entry);
            }
        }

        let subdirs: Vec<PathBuf> = entries
            .into_iter()
            .filter(|(_, _, is_dir)| *is_dir)
            .map(|(path, _, _)| path)
            .collect();

        let mut join_set: JoinSet<Result<(), String>> = JoinSet::new();

        for subdir in subdirs {
            if results.lock().len() >= max {
                break;
            }

            let results_clone = Arc::clone(&results);
            let query_clone = query.clone();
            let sem_clone = Arc::clone(&semaphore);

            join_set.spawn(search_files_parallel(
                subdir,
                query_clone,
                results_clone,
                max,
                sem_clone,
            ));
        }

        while join_set.join_next().await.is_some() {}

        Ok(())
    })
}

// ============================================================================
// Content Search - Ripgrep Integration
// ============================================================================

/// Ripgrep JSON message types for parsing
#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
enum RgMessage {
    #[serde(rename = "match")]
    Match { data: RgMatchData },
    #[serde(rename = "begin")]
    Begin { data: RgBeginData },
    #[serde(rename = "end")]
    End { data: RgEndData },
    #[serde(rename = "summary")]
    Summary { data: RgSummaryData },
}

#[derive(Debug, Deserialize)]
struct RgMatchData {
    path: RgText,
    lines: RgText,
    line_number: u32,
    submatches: Vec<RgSubmatch>,
}

#[derive(Debug, Deserialize)]
struct RgBeginData {
    #[allow(dead_code)]
    path: RgText,
}

#[derive(Debug, Deserialize)]
struct RgEndData {
    #[allow(dead_code)]
    path: RgText,
    stats: Option<RgStats>,
}

#[derive(Debug, Deserialize)]
struct RgSummaryData {
    stats: RgStats,
}

#[derive(Debug, Deserialize)]
struct RgStats {
    #[allow(dead_code)]
    matched_lines: u64,
    searches: u64,
}

#[derive(Debug, Deserialize)]
struct RgText {
    text: String,
}

#[derive(Debug, Deserialize)]
struct RgSubmatch {
    #[serde(rename = "match")]
    match_text: RgText,
    start: u32,
    end: u32,
}

/// Try to execute ripgrep for content search. Returns None if ripgrep is not available
/// or if execution fails, allowing fallback to the regex-based implementation.
#[allow(clippy::too_many_arguments)]
fn try_ripgrep_search(
    path: &str,
    query: &str,
    case_sensitive: bool,
    use_regex: bool,
    whole_word: bool,
    include_patterns: &[String],
    exclude_patterns: &[String],
    max_results: usize,
) -> Option<ContentSearchResponse> {
    // Build the ripgrep command
    let mut cmd = crate::process_utils::command("rg");

    // JSON output for parsing
    cmd.arg("--json");
    cmd.arg("--line-number");

    // Case sensitivity
    if case_sensitive {
        cmd.arg("--case-sensitive");
    } else {
        cmd.arg("--ignore-case");
    }

    // Word matching
    if whole_word {
        cmd.arg("--word-regexp");
    }

    // Regex vs fixed string
    if use_regex {
        cmd.arg("--regexp");
    } else {
        cmd.arg("--fixed-strings");
    }
    cmd.arg(query);

    // Add include patterns (glob style)
    for pattern in include_patterns {
        if pattern.starts_with("*.") {
            // Convert *.ext to ripgrep glob
            cmd.arg("--glob").arg(pattern);
        } else if !pattern.is_empty() {
            cmd.arg("--glob").arg(format!("*{}*", pattern));
        }
    }

    // Add exclude patterns
    for pattern in exclude_patterns {
        if !pattern.is_empty() {
            cmd.arg("--glob").arg(format!("!**{}**", pattern));
            cmd.arg("--glob").arg(format!("!{}", pattern));
        }
    }

    // Skip binary files
    cmd.arg("--binary");
    cmd.arg("never");

    // Set max line length to avoid memory issues with minified files
    cmd.arg("--max-columns").arg("10000");

    // Don't follow symlinks for safety
    cmd.arg("--no-follow");

    // Search path
    cmd.arg(path);

    // Execute and capture output
    let output = match cmd.output() {
        Ok(output) => output,
        Err(e) => {
            // ripgrep not available or execution failed
            info!("ripgrep not available, falling back to regex search: {}", e);
            return None;
        }
    };

    // ripgrep returns exit code 1 when no matches found (which is fine)
    // Exit code 2+ indicates an error
    if !output.status.success() && output.status.code() != Some(1) {
        warn!("ripgrep returned error status: {:?}", output.status);
        return None;
    }

    // Parse JSON lines output
    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut file_matches: HashMap<String, Vec<SearchMatch>> = HashMap::new();
    let mut total_matches: u32 = 0;
    let mut files_searched: u32 = 0;

    for line in stdout.lines() {
        if total_matches as usize >= max_results {
            break;
        }

        let msg: RgMessage = match serde_json::from_str(line) {
            Ok(m) => m,
            Err(_) => continue,
        };

        match msg {
            RgMessage::Match { data } => {
                let file_path = data.path.text.clone();
                let line_text = data.lines.text.trim_end_matches('\n').to_string();

                // Process each submatch
                for submatch in data.submatches {
                    if total_matches as usize >= max_results {
                        break;
                    }

                    let search_match = SearchMatch {
                        line: data.line_number,
                        column: submatch.start + 1,
                        text: line_text.clone(),
                        match_start: submatch.start,
                        match_end: submatch.end,
                    };

                    file_matches
                        .entry(file_path.clone())
                        .or_default()
                        .push(search_match);

                    total_matches += 1;
                }
            }
            RgMessage::End { data } => {
                if data.stats.is_some() {
                    files_searched += 1;
                }
            }
            RgMessage::Summary { data } => {
                files_searched = data.stats.searches as u32;
            }
            _ => {}
        }
    }

    // Convert HashMap to Vec<SearchResult>
    let results: Vec<SearchResult> = file_matches
        .into_iter()
        .map(|(file, matches)| SearchResult { file, matches })
        .collect();

    info!(
        "ripgrep search completed: {} matches in {} files",
        total_matches,
        results.len()
    );

    Some(ContentSearchResponse {
        results,
        total_matches,
        files_searched,
    })
}

// ============================================================================
// Content Search - Fallback Implementation
// ============================================================================

#[allow(clippy::too_many_arguments)]
#[tauri::command]
pub async fn fs_search_content(
    path: String,
    query: String,
    case_sensitive: Option<bool>,
    regex: Option<bool>,
    whole_word: Option<bool>,
    include: Option<String>,
    exclude: Option<String>,
    max_results: Option<u32>,
) -> Result<ContentSearchResponse, String> {
    let root = PathBuf::from(&path);
    if !root.exists() {
        return Err(format!("Path does not exist: {}", path));
    }

    let case_sensitive = case_sensitive.unwrap_or(false);
    let use_regex = regex.unwrap_or(false);
    let whole_word = whole_word.unwrap_or(false);
    let max = max_results.unwrap_or(1000) as usize;

    // Parse exclude patterns
    let exclude_patterns: Vec<String> = exclude
        .unwrap_or_else(|| "node_modules, .git, dist, build".to_string())
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();

    // Parse include patterns (glob-style)
    let include_patterns: Vec<String> = include
        .unwrap_or_default()
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();

    // Try ripgrep first for better performance on large codebases
    if let Some(result) = try_ripgrep_search(
        &path,
        &query,
        case_sensitive,
        use_regex,
        whole_word,
        &include_patterns,
        &exclude_patterns,
        max,
    ) {
        return Ok(result);
    }

    // Fallback to Rust regex search if ripgrep is not available
    info!("Using fallback regex search");

    // Build regex pattern
    let search_pattern = if use_regex {
        query.clone()
    } else {
        regex::escape(&query)
    };

    let search_pattern = if whole_word {
        format!(r"\b{}\b", search_pattern)
    } else {
        search_pattern
    };

    let re = if case_sensitive {
        regex::Regex::new(&search_pattern)
    } else {
        regex::RegexBuilder::new(&search_pattern)
            .case_insensitive(true)
            .build()
    }
    .map_err(|e| format!("Invalid search pattern: {}", e))?;

    let mut results: Vec<SearchResult> = Vec::new();
    let mut total_matches: u32 = 0;
    let mut files_searched: u32 = 0;

    // Recursive search function
    #[allow(clippy::too_many_arguments)]
    fn search_dir(
        dir: &std::path::Path,
        re: &regex::Regex,
        results: &mut Vec<SearchResult>,
        total_matches: &mut u32,
        files_searched: &mut u32,
        max: usize,
        exclude_patterns: &[String],
        include_patterns: &[String],
    ) -> Result<(), String> {
        let entries =
            std::fs::read_dir(dir).map_err(|e| format!("Failed to read directory: {}", e))?;

        for entry in entries.flatten() {
            if *total_matches as usize >= max {
                break;
            }

            let path = entry.path();
            let name = path
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();

            // Skip hidden files and excluded patterns
            if name.starts_with('.') {
                continue;
            }

            if should_skip_for_search(&name) {
                continue;
            }

            // Check exclude patterns
            let path_str = path.to_string_lossy();
            if exclude_patterns.iter().any(|p| path_str.contains(p)) {
                continue;
            }

            if path.is_dir() {
                search_dir(
                    &path,
                    re,
                    results,
                    total_matches,
                    files_searched,
                    max,
                    exclude_patterns,
                    include_patterns,
                )?;
            } else if path.is_file() {
                // Check include patterns if specified
                if !include_patterns.is_empty() {
                    let matches_include = include_patterns.iter().any(|pattern| {
                        if let Some(ext) = pattern.strip_prefix("*.") {
                            name.ends_with(&format!(".{}", ext))
                        } else {
                            name.contains(pattern)
                        }
                    });
                    if !matches_include {
                        continue;
                    }
                }

                // Try to read file as text
                if let Ok(file) = File::open(&path) {
                    *files_searched += 1;
                    let reader = BufReader::new(file);
                    let mut file_matches = Vec::new();

                    for (line_num, line_result) in reader.lines().enumerate() {
                        if *total_matches as usize >= max {
                            break;
                        }

                        if let Ok(line) = line_result {
                            // Skip very long lines (likely minified/binary)
                            if line.len() > 10000 {
                                continue;
                            }

                            for mat in re.find_iter(&line) {
                                file_matches.push(SearchMatch {
                                    line: (line_num + 1) as u32,
                                    column: (mat.start() + 1) as u32,
                                    text: line.clone(),
                                    match_start: mat.start() as u32,
                                    match_end: mat.end() as u32,
                                });
                                *total_matches += 1;

                                if *total_matches as usize >= max {
                                    break;
                                }
                            }
                        }
                    }

                    if !file_matches.is_empty() {
                        results.push(SearchResult {
                            file: path.to_string_lossy().to_string(),
                            matches: file_matches,
                        });
                    }
                }
            }
        }

        Ok(())
    }

    search_dir(
        &root,
        &re,
        &mut results,
        &mut total_matches,
        &mut files_searched,
        max,
        &exclude_patterns,
        &include_patterns,
    )?;

    Ok(ContentSearchResponse {
        results,
        total_matches,
        files_searched,
    })
}

// ============================================================================
// Content Search - Streaming Multi-Root Implementation
// ============================================================================

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SearchProgressEvent {
    files_searched: u32,
    total_files: u32,
    matches_found: u32,
    current_file: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SearchCompleteEvent {
    files_searched: u32,
    total_matches: u32,
    duration: u64,
    was_cancelled: bool,
}

#[allow(clippy::too_many_arguments)]
#[tauri::command]
pub async fn fs_search_content_stream(
    app: AppHandle,
    paths: Vec<String>,
    query: String,
    case_sensitive: Option<bool>,
    regex: Option<bool>,
    whole_word: Option<bool>,
    include: Option<String>,
    exclude: Option<String>,
    max_results: Option<u32>,
    respect_gitignore: Option<bool>,
) -> Result<(), String> {
    if paths.is_empty() {
        return Err("No search paths provided".to_string());
    }

    let case_sensitive = case_sensitive.unwrap_or(false);
    let use_regex = regex.unwrap_or(false);
    let whole_word = whole_word.unwrap_or(false);
    let max = max_results.unwrap_or(1000) as usize;
    let gitignore = respect_gitignore.unwrap_or(true);

    let exclude_patterns: Vec<String> = exclude
        .unwrap_or_else(|| "node_modules, .git, dist, build".to_string())
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();

    let include_patterns: Vec<String> = include
        .unwrap_or_default()
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();

    let search_pattern = if use_regex {
        query.clone()
    } else {
        regex::escape(&query)
    };

    let search_pattern = if whole_word {
        format!(r"\b{}\b", search_pattern)
    } else {
        search_pattern
    };

    let re = if case_sensitive {
        regex::Regex::new(&search_pattern)
    } else {
        regex::RegexBuilder::new(&search_pattern)
            .case_insensitive(true)
            .build()
    }
    .map_err(|e| format!("Invalid search pattern: {}", e))?;

    tokio::task::spawn_blocking(move || {
        let start = Instant::now();

        let first_path = &paths[0];
        let mut builder = WalkBuilder::new(first_path);
        for p in &paths[1..] {
            builder.add(p);
        }

        builder
            .hidden(false)
            .git_ignore(gitignore)
            .git_global(false)
            .git_exclude(false)
            .follow_links(false);

        if !include_patterns.is_empty() || !exclude_patterns.is_empty() {
            let override_root = PathBuf::from(first_path);
            let mut ob = ignore::overrides::OverrideBuilder::new(&override_root);
            for pattern in &include_patterns {
                if let Err(e) = ob.add(pattern) {
                    warn!("Invalid include pattern '{}': {}", pattern, e);
                }
            }
            for pattern in &exclude_patterns {
                let negated = format!("!{}", pattern);
                if let Err(e) = ob.add(&negated) {
                    warn!("Invalid exclude pattern '{}': {}", pattern, e);
                }
            }
            match ob.build() {
                Ok(overrides) => {
                    builder.overrides(overrides);
                }
                Err(e) => {
                    warn!("Failed to build overrides: {}", e);
                }
            }
        }

        let file_paths: Vec<PathBuf> = builder
            .build()
            .filter_map(|entry| entry.ok())
            .filter(|entry| entry.file_type().map(|ft| ft.is_file()).unwrap_or(false))
            .filter(|entry| {
                let name = entry.file_name().to_string_lossy();
                !should_skip_for_search(&name)
            })
            .map(|entry| entry.into_path())
            .collect();

        let total_files = file_paths.len() as u32;
        info!(
            "Streaming search: {} files to search across {} roots",
            total_files,
            paths.len()
        );

        let total_matches = AtomicU32::new(0);
        let files_searched = AtomicU32::new(0);

        file_paths.par_iter().for_each(|file_path| {
            if total_matches.load(Ordering::Relaxed) as usize >= max {
                return;
            }

            if let Ok(file) = File::open(file_path) {
                let reader = BufReader::new(file);
                let mut file_matches = Vec::new();

                for (line_num, line_result) in reader.lines().enumerate() {
                    if total_matches.load(Ordering::Relaxed) as usize >= max {
                        break;
                    }

                    if let Ok(line) = line_result {
                        if line.len() > 10000 {
                            continue;
                        }

                        for mat in re.find_iter(&line) {
                            file_matches.push(SearchMatch {
                                line: (line_num + 1) as u32,
                                column: (mat.start() + 1) as u32,
                                text: line.clone(),
                                match_start: mat.start() as u32,
                                match_end: mat.end() as u32,
                            });
                            total_matches.fetch_add(1, Ordering::Relaxed);

                            if total_matches.load(Ordering::Relaxed) as usize >= max {
                                break;
                            }
                        }
                    }
                }

                let searched = files_searched.fetch_add(1, Ordering::Relaxed) + 1;

                if !file_matches.is_empty() {
                    let result = SearchResult {
                        file: file_path.to_string_lossy().to_string(),
                        matches: file_matches,
                    };
                    let _ = app.emit("search:result", &result);
                }

                if searched % 50 == 0 {
                    let _ = app.emit(
                        "search:progress",
                        &SearchProgressEvent {
                            files_searched: searched,
                            total_files,
                            matches_found: total_matches.load(Ordering::Relaxed),
                            current_file: file_path.to_string_lossy().to_string(),
                        },
                    );
                }
            }
        });

        let duration = start.elapsed().as_millis() as u64;
        let final_matches = total_matches.load(Ordering::Relaxed);
        let final_searched = files_searched.load(Ordering::Relaxed);

        let _ = app.emit(
            "search:complete",
            &SearchCompleteEvent {
                files_searched: final_searched,
                total_matches: final_matches,
                duration,
                was_cancelled: false,
            },
        );

        info!(
            "Streaming search completed: {} matches in {} files ({} ms)",
            final_matches, final_searched, duration
        );
    })
    .await
    .map_err(|e| format!("Search task failed: {}", e))?;

    Ok(())
}
