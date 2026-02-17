//! Snippet Manager Backend
//!
//! Provides VS Code-compatible snippet management with user snippets
//! (per-language and global), workspace snippets, built-in snippet support,
//! CRUD operations, and tab stop parsing for snippet expansion.

use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager, State};
use tracing::info;

// ============================================================================
// Types
// ============================================================================

/// A single code snippet with VS Code-compatible fields
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Snippet {
    pub prefix: Vec<String>,
    pub body: Vec<String>,
    pub description: Option<String>,
    pub scope: Option<String>,
    #[serde(default)]
    pub is_file_template: bool,
}

/// A file containing one or more snippets
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnippetFile {
    pub path: String,
    pub language: Option<String>,
    pub is_global: bool,
    pub snippets: HashMap<String, Snippet>,
}

/// Summary info for a snippet file (returned by get_files)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnippetFileSummary {
    pub file_id: String,
    pub path: String,
    pub language: Option<String>,
    pub is_global: bool,
    pub snippet_count: usize,
}

/// A snippet entry with its name and source file
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnippetEntry {
    pub name: String,
    pub file_id: String,
    pub snippet: Snippet,
}

/// Options for creating a new snippet
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSnippetOptions {
    pub name: String,
    pub prefix: Vec<String>,
    pub body: Vec<String>,
    pub description: Option<String>,
    pub scope: Option<String>,
    #[serde(default)]
    pub is_file_template: bool,
}

/// Options for updating an existing snippet
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSnippetOptions {
    pub prefix: Option<Vec<String>>,
    pub body: Option<Vec<String>>,
    pub description: Option<Option<String>>,
    pub scope: Option<Option<String>>,
    pub is_file_template: Option<bool>,
}

/// Options for creating a new snippet file
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSnippetFileOptions {
    pub language: Option<String>,
    pub is_global: bool,
    pub workspace_path: Option<String>,
}

/// Result of expanding a snippet
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExpandedSnippet {
    pub text: String,
    pub tab_stops: Vec<TabStop>,
}

/// A tab stop location in the expanded snippet
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TabStop {
    pub index: u32,
    pub offset: usize,
    pub length: usize,
    pub placeholder: String,
}

/// VS Code-compatible JSON format for snippet deserialization.
/// Handles both `Vec<String>` and single `String` for prefix/body fields.
#[derive(Debug, Clone, Deserialize)]
struct RawSnippet {
    #[serde(default, deserialize_with = "deserialize_string_or_vec")]
    prefix: Vec<String>,
    #[serde(default, deserialize_with = "deserialize_string_or_vec")]
    body: Vec<String>,
    description: Option<String>,
    scope: Option<String>,
    #[serde(default, rename = "isFileTemplate")]
    is_file_template: bool,
}

fn deserialize_string_or_vec<'de, D>(deserializer: D) -> Result<Vec<String>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum StringOrVec {
        Single(String),
        Multiple(Vec<String>),
    }

    match StringOrVec::deserialize(deserializer)? {
        StringOrVec::Single(s) => Ok(vec![s]),
        StringOrVec::Multiple(v) => Ok(v),
    }
}

// ============================================================================
// State
// ============================================================================

/// Shared state for snippet management
pub struct SnippetState {
    snippets: Mutex<HashMap<String, SnippetFile>>,
    workspace_path: Mutex<Option<String>>,
}

impl SnippetState {
    pub fn new() -> Self {
        Self {
            snippets: Mutex::new(HashMap::new()),
            workspace_path: Mutex::new(None),
        }
    }

    fn get_snippets_dir(app: &AppHandle) -> PathBuf {
        app.path()
            .app_data_dir()
            .unwrap_or_else(|_| {
                dirs::data_dir()
                    .unwrap_or_else(|| PathBuf::from("."))
                    .join("Cortex-desktop")
            })
            .join("snippets")
    }

    fn generate_file_id(path: &str) -> String {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        let mut hasher = DefaultHasher::new();
        path.hash(&mut hasher);
        format!("sf_{:016x}", hasher.finish())
    }
}

impl Default for SnippetState {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// Tab Stop Expansion
// ============================================================================

fn expand_tab_stops(body: &[String]) -> ExpandedSnippet {
    let joined = body.join("\n");
    let mut result = String::with_capacity(joined.len());
    let mut tab_stops: Vec<TabStop> = Vec::new();

    let placeholder_re = Regex::new(r"\$\{(\d+):([^}]*)\}|\$\{(\d+)\|([^}]*)\|\}|\$(\d+)").unwrap();

    let mut last_end = 0;
    for cap in placeholder_re.captures_iter(&joined) {
        let m = cap.get(0).unwrap();
        result.push_str(&joined[last_end..m.start()]);

        let offset = result.len();

        if let Some(idx_match) = cap.get(1) {
            let index: u32 = idx_match.as_str().parse().unwrap_or(0);
            let placeholder = cap.get(2).map(|m| m.as_str()).unwrap_or("");
            result.push_str(placeholder);
            tab_stops.push(TabStop {
                index,
                offset,
                length: placeholder.len(),
                placeholder: placeholder.to_string(),
            });
        } else if let Some(idx_match) = cap.get(3) {
            let index: u32 = idx_match.as_str().parse().unwrap_or(0);
            let choices_str = cap.get(4).map(|m| m.as_str()).unwrap_or("");
            let first_choice = choices_str.split(',').next().unwrap_or("");
            result.push_str(first_choice);
            tab_stops.push(TabStop {
                index,
                offset,
                length: first_choice.len(),
                placeholder: first_choice.to_string(),
            });
        } else if let Some(idx_match) = cap.get(5) {
            let index: u32 = idx_match.as_str().parse().unwrap_or(0);
            tab_stops.push(TabStop {
                index,
                offset,
                length: 0,
                placeholder: String::new(),
            });
        }

        last_end = m.end();
    }
    result.push_str(&joined[last_end..]);

    tab_stops.sort_by(|a, b| {
        let a_key = if a.index == 0 { u32::MAX } else { a.index };
        let b_key = if b.index == 0 { u32::MAX } else { b.index };
        a_key.cmp(&b_key)
    });

    ExpandedSnippet {
        text: result,
        tab_stops,
    }
}

// ============================================================================
// File I/O Helpers
// ============================================================================

async fn read_snippet_file(path: &str) -> Result<HashMap<String, Snippet>, String> {
    let content = tokio::fs::read_to_string(path)
        .await
        .map_err(|e| format!("Failed to read snippet file '{}': {}", path, e))?;

    let raw: HashMap<String, RawSnippet> = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse snippet file '{}': {}", path, e))?;

    let snippets = raw
        .into_iter()
        .map(|(name, raw)| {
            let snippet = Snippet {
                prefix: raw.prefix,
                body: raw.body,
                description: raw.description,
                scope: raw.scope,
                is_file_template: raw.is_file_template,
            };
            (name, snippet)
        })
        .collect();

    Ok(snippets)
}

async fn write_snippet_file(path: &str, snippets: &HashMap<String, Snippet>) -> Result<(), String> {
    let path_buf = PathBuf::from(path);
    if let Some(parent) = path_buf.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("Failed to create snippet directory: {}", e))?;
    }

    let content = serde_json::to_string_pretty(snippets)
        .map_err(|e| format!("Failed to serialize snippets: {}", e))?;

    tokio::fs::write(path, content)
        .await
        .map_err(|e| format!("Failed to write snippet file '{}': {}", path, e))
}

// ============================================================================
// Tauri Commands
// ============================================================================

/// List all snippets, optionally filtered by language
#[tauri::command]
pub async fn snippets_list(
    state: State<'_, Arc<SnippetState>>,
    language: Option<String>,
) -> Result<Vec<SnippetEntry>, String> {
    let files = state
        .snippets
        .lock()
        .map_err(|_| "Failed to acquire snippets lock")?;

    let mut entries = Vec::new();

    for (file_id, file) in files.iter() {
        let matches_language = match (&language, &file.language) {
            (Some(lang), Some(file_lang)) => file_lang.eq_ignore_ascii_case(lang) || file.is_global,
            (Some(_), None) => file.is_global,
            (None, _) => true,
        };

        if !matches_language {
            continue;
        }

        for (name, snippet) in &file.snippets {
            if let Some(ref lang) = language {
                if let Some(ref scope) = snippet.scope {
                    let scopes: Vec<&str> = scope.split(',').map(|s| s.trim()).collect();
                    if !scopes.iter().any(|s| s.eq_ignore_ascii_case(lang)) && !file.is_global {
                        continue;
                    }
                }
            }

            entries.push(SnippetEntry {
                name: name.clone(),
                file_id: file_id.clone(),
                snippet: snippet.clone(),
            });
        }
    }

    Ok(entries)
}

/// Get a specific snippet by name and file ID
#[tauri::command]
pub async fn snippets_get(
    state: State<'_, Arc<SnippetState>>,
    file_id: String,
    name: String,
) -> Result<SnippetEntry, String> {
    let files = state
        .snippets
        .lock()
        .map_err(|_| "Failed to acquire snippets lock")?;

    let file = files
        .get(&file_id)
        .ok_or_else(|| format!("Snippet file not found: {}", file_id))?;

    let snippet = file
        .snippets
        .get(&name)
        .ok_or_else(|| format!("Snippet not found: {}", name))?;

    Ok(SnippetEntry {
        name,
        file_id,
        snippet: snippet.clone(),
    })
}

/// Create a new snippet in a file
#[tauri::command]
pub async fn snippets_create(
    state: State<'_, Arc<SnippetState>>,
    file_id: String,
    options: CreateSnippetOptions,
) -> Result<SnippetEntry, String> {
    let path = {
        let mut files = state
            .snippets
            .lock()
            .map_err(|_| "Failed to acquire snippets lock")?;

        let file = files
            .get_mut(&file_id)
            .ok_or_else(|| format!("Snippet file not found: {}", file_id))?;

        if file.snippets.contains_key(&options.name) {
            return Err(format!(
                "Snippet '{}' already exists in this file",
                options.name
            ));
        }

        let snippet = Snippet {
            prefix: options.prefix,
            body: options.body,
            description: options.description,
            scope: options.scope,
            is_file_template: options.is_file_template,
        };

        file.snippets.insert(options.name.clone(), snippet);
        file.path.clone()
    };

    let snippets = {
        let files = state
            .snippets
            .lock()
            .map_err(|_| "Failed to acquire snippets lock")?;
        files
            .get(&file_id)
            .ok_or_else(|| "Snippet file removed concurrently".to_string())?
            .snippets
            .clone()
    };

    write_snippet_file(&path, &snippets).await?;

    let files = state
        .snippets
        .lock()
        .map_err(|_| "Failed to acquire snippets lock")?;
    let snippet = files
        .get(&file_id)
        .and_then(|f| f.snippets.get(&options.name))
        .ok_or_else(|| "Snippet was removed concurrently".to_string())?;

    info!("Created snippet '{}' in file '{}'", options.name, path);

    Ok(SnippetEntry {
        name: options.name,
        file_id,
        snippet: snippet.clone(),
    })
}

/// Update an existing snippet
#[tauri::command]
pub async fn snippets_update(
    state: State<'_, Arc<SnippetState>>,
    file_id: String,
    name: String,
    options: UpdateSnippetOptions,
) -> Result<SnippetEntry, String> {
    let path = {
        let mut files = state
            .snippets
            .lock()
            .map_err(|_| "Failed to acquire snippets lock")?;

        let file = files
            .get_mut(&file_id)
            .ok_or_else(|| format!("Snippet file not found: {}", file_id))?;

        let snippet = file
            .snippets
            .get_mut(&name)
            .ok_or_else(|| format!("Snippet not found: {}", name))?;

        if let Some(prefix) = options.prefix {
            snippet.prefix = prefix;
        }
        if let Some(body) = options.body {
            snippet.body = body;
        }
        if let Some(description) = options.description {
            snippet.description = description;
        }
        if let Some(scope) = options.scope {
            snippet.scope = scope;
        }
        if let Some(is_file_template) = options.is_file_template {
            snippet.is_file_template = is_file_template;
        }

        file.path.clone()
    };

    let snippets = {
        let files = state
            .snippets
            .lock()
            .map_err(|_| "Failed to acquire snippets lock")?;
        files
            .get(&file_id)
            .ok_or_else(|| "Snippet file removed concurrently".to_string())?
            .snippets
            .clone()
    };

    write_snippet_file(&path, &snippets).await?;

    let files = state
        .snippets
        .lock()
        .map_err(|_| "Failed to acquire snippets lock")?;
    let snippet = files
        .get(&file_id)
        .and_then(|f| f.snippets.get(&name))
        .ok_or_else(|| "Snippet was removed concurrently".to_string())?;

    info!("Updated snippet '{}' in file '{}'", name, path);

    Ok(SnippetEntry {
        name,
        file_id,
        snippet: snippet.clone(),
    })
}

/// Delete a snippet from a file
#[tauri::command]
pub async fn snippets_delete(
    state: State<'_, Arc<SnippetState>>,
    file_id: String,
    name: String,
) -> Result<(), String> {
    let path = {
        let mut files = state
            .snippets
            .lock()
            .map_err(|_| "Failed to acquire snippets lock")?;

        let file = files
            .get_mut(&file_id)
            .ok_or_else(|| format!("Snippet file not found: {}", file_id))?;

        if file.snippets.remove(&name).is_none() {
            return Err(format!("Snippet not found: {}", name));
        }

        file.path.clone()
    };

    let snippets = {
        let files = state
            .snippets
            .lock()
            .map_err(|_| "Failed to acquire snippets lock")?;
        files
            .get(&file_id)
            .ok_or_else(|| "Snippet file removed concurrently".to_string())?
            .snippets
            .clone()
    };

    write_snippet_file(&path, &snippets).await?;

    info!("Deleted snippet '{}' from file '{}'", name, path);

    Ok(())
}

/// Load snippets from a JSON file
#[tauri::command]
pub async fn snippets_load_file(
    state: State<'_, Arc<SnippetState>>,
    path: String,
    language: Option<String>,
    is_global: bool,
) -> Result<SnippetFileSummary, String> {
    let snippets = read_snippet_file(&path).await?;
    let file_id = SnippetState::generate_file_id(&path);
    let snippet_count = snippets.len();

    let file = SnippetFile {
        path: path.clone(),
        language: language.clone(),
        is_global,
        snippets,
    };

    {
        let mut files = state
            .snippets
            .lock()
            .map_err(|_| "Failed to acquire snippets lock")?;
        files.insert(file_id.clone(), file);
    }

    info!("Loaded {} snippets from '{}'", snippet_count, path);

    Ok(SnippetFileSummary {
        file_id,
        path,
        language,
        is_global,
        snippet_count,
    })
}

/// Save all snippets in a file to disk
#[tauri::command]
pub async fn snippets_save_file(
    state: State<'_, Arc<SnippetState>>,
    file_id: String,
) -> Result<(), String> {
    let (path, snippets) = {
        let files = state
            .snippets
            .lock()
            .map_err(|_| "Failed to acquire snippets lock")?;

        let file = files
            .get(&file_id)
            .ok_or_else(|| format!("Snippet file not found: {}", file_id))?;

        (file.path.clone(), file.snippets.clone())
    };

    write_snippet_file(&path, &snippets).await?;

    info!("Saved snippet file '{}'", path);

    Ok(())
}

/// List all loaded snippet files
#[tauri::command]
pub async fn snippets_get_files(
    state: State<'_, Arc<SnippetState>>,
) -> Result<Vec<SnippetFileSummary>, String> {
    let files = state
        .snippets
        .lock()
        .map_err(|_| "Failed to acquire snippets lock")?;

    let summaries = files
        .iter()
        .map(|(file_id, file)| SnippetFileSummary {
            file_id: file_id.clone(),
            path: file.path.clone(),
            language: file.language.clone(),
            is_global: file.is_global,
            snippet_count: file.snippets.len(),
        })
        .collect();

    Ok(summaries)
}

/// Create a new snippet file
#[tauri::command]
pub async fn snippets_create_file(
    app: AppHandle,
    state: State<'_, Arc<SnippetState>>,
    options: CreateSnippetFileOptions,
) -> Result<SnippetFileSummary, String> {
    let path = if let Some(ref ws) = options.workspace_path {
        let vscode_dir = PathBuf::from(ws).join(".vscode");
        match &options.language {
            Some(lang) => vscode_dir.join(format!("{}.code-snippets", lang)),
            None => vscode_dir.join("snippets.code-snippets"),
        }
    } else {
        let snippets_dir = SnippetState::get_snippets_dir(&app);
        match &options.language {
            Some(lang) => snippets_dir.join(format!("{}.json", lang)),
            None => snippets_dir.join("global.code-snippets"),
        }
    };

    let path_str = path.to_string_lossy().to_string();

    let empty_snippets: HashMap<String, Snippet> = HashMap::new();
    write_snippet_file(&path_str, &empty_snippets).await?;

    let file_id = SnippetState::generate_file_id(&path_str);

    let file = SnippetFile {
        path: path_str.clone(),
        language: options.language.clone(),
        is_global: options.is_global,
        snippets: HashMap::new(),
    };

    {
        let mut files = state
            .snippets
            .lock()
            .map_err(|_| "Failed to acquire snippets lock")?;
        files.insert(file_id.clone(), file);
    }

    info!("Created snippet file '{}'", path_str);

    Ok(SnippetFileSummary {
        file_id,
        path: path_str,
        language: options.language,
        is_global: options.is_global,
        snippet_count: 0,
    })
}

/// Expand a snippet with tab stops resolved
#[tauri::command]
pub async fn snippets_expand(
    state: State<'_, Arc<SnippetState>>,
    file_id: String,
    name: String,
) -> Result<ExpandedSnippet, String> {
    let body = {
        let files = state
            .snippets
            .lock()
            .map_err(|_| "Failed to acquire snippets lock")?;

        let file = files
            .get(&file_id)
            .ok_or_else(|| format!("Snippet file not found: {}", file_id))?;

        let snippet = file
            .snippets
            .get(&name)
            .ok_or_else(|| format!("Snippet not found: {}", name))?;

        snippet.body.clone()
    };

    Ok(expand_tab_stops(&body))
}
