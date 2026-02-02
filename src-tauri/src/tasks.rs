//! Tasks module for running VS Code-style task definitions
//!
//! This module provides functionality to run tasks defined in tasks.json files,
//! commonly used for pre/post debug tasks and build tasks.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Stdio;

/// Task definition from tasks.json
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskDefinition {
    pub label: String,
    #[serde(rename = "type")]
    pub task_type: String,
    #[serde(default)]
    pub command: Option<String>,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(default)]
    pub options: TaskOptions,
    #[serde(default)]
    pub group: Option<TaskGroup>,
    #[serde(default)]
    pub problem_matcher: Option<serde_json::Value>,
    #[serde(default)]
    pub depends_on: Vec<String>,
    #[serde(default)]
    pub is_background: bool,
    #[serde(default)]
    pub presentation: TaskPresentation,
}

/// Task options
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskOptions {
    pub cwd: Option<String>,
    #[serde(default)]
    pub env: HashMap<String, String>,
    pub shell: Option<TaskShell>,
}

/// Task shell configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskShell {
    pub executable: Option<String>,
    #[serde(default)]
    pub args: Vec<String>,
}

/// Task group
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum TaskGroup {
    Simple(String),
    Extended {
        kind: String,
        #[serde(default)]
        is_default: bool,
    },
}

/// Task presentation options
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskPresentation {
    #[serde(default = "default_reveal")]
    pub reveal: String,
    #[serde(default)]
    pub echo: bool,
    #[serde(default)]
    pub focus: bool,
    #[serde(default = "default_panel")]
    pub panel: String,
    #[serde(default)]
    pub show_reuse_message: bool,
    #[serde(default)]
    pub clear: bool,
}

fn default_reveal() -> String {
    "always".to_string()
}

fn default_panel() -> String {
    "shared".to_string()
}

/// Tasks configuration from tasks.json
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TasksConfig {
    #[serde(default = "default_version")]
    pub version: String,
    #[serde(default)]
    pub tasks: Vec<TaskDefinition>,
    #[serde(default)]
    pub inputs: Vec<serde_json::Value>,
}

fn default_version() -> String {
    "2.0.0".to_string()
}

impl Default for TasksConfig {
    fn default() -> Self {
        Self {
            version: default_version(),
            tasks: Vec::new(),
            inputs: Vec::new(),
        }
    }
}

/// Result of running a task
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskResult {
    pub task_name: String,
    pub success: bool,
    pub exit_code: Option<i32>,
    pub output: String,
    pub error: Option<String>,
}

/// Load tasks.json from the workspace
fn load_tasks_config(workspace_path: &str) -> Result<TasksConfig, String> {
    let vscode_path = PathBuf::from(workspace_path)
        .join(".vscode")
        .join("tasks.json");

    if vscode_path.exists() {
        let content = std::fs::read_to_string(&vscode_path)
            .map_err(|e| format!("Failed to read tasks.json: {}", e))?;

        // Remove comments (VS Code allows JSON with comments)
        let content = remove_json_comments(&content);

        serde_json::from_str(&content).map_err(|e| format!("Failed to parse tasks.json: {}", e))
    } else {
        Ok(TasksConfig::default())
    }
}

/// Remove single-line and multi-line comments from JSON content
fn remove_json_comments(content: &str) -> String {
    let mut result = String::with_capacity(content.len());
    let mut chars = content.chars().peekable();
    let mut in_string = false;

    while let Some(c) = chars.next() {
        if in_string {
            result.push(c);
            if c == '\\' {
                if let Some(&next) = chars.peek() {
                    result.push(next);
                    chars.next();
                }
            } else if c == '"' {
                in_string = false;
            }
        } else if c == '"' {
            in_string = true;
            result.push(c);
        } else if c == '/' {
            if let Some(&next) = chars.peek() {
                if next == '/' {
                    // Single-line comment - skip to end of line
                    chars.next();
                    while let Some(&ch) = chars.peek() {
                        if ch == '\n' {
                            break;
                        }
                        chars.next();
                    }
                } else if next == '*' {
                    // Multi-line comment - skip until */
                    chars.next();
                    while let Some(ch) = chars.next() {
                        if ch == '*' {
                            if let Some(&next) = chars.peek() {
                                if next == '/' {
                                    chars.next();
                                    break;
                                }
                            }
                        }
                    }
                } else {
                    result.push(c);
                }
            } else {
                result.push(c);
            }
        } else {
            result.push(c);
        }
    }

    result
}

/// Find a task by name
fn find_task<'a>(config: &'a TasksConfig, task_name: &str) -> Option<&'a TaskDefinition> {
    config.tasks.iter().find(|t| t.label == task_name)
}

/// Run a single task
async fn run_single_task(
    task: &TaskDefinition,
    workspace_path: &str,
) -> Result<TaskResult, String> {
    let command = task.command.as_ref().ok_or("Task has no command")?;

    // Determine working directory
    let cwd = task
        .options
        .cwd
        .as_ref()
        .map(|c| PathBuf::from(workspace_path).join(c))
        .unwrap_or_else(|| PathBuf::from(workspace_path));

    // Build the command
    let mut cmd = if cfg!(target_os = "windows") {
        let mut c = crate::process_utils::async_command("cmd");
        c.arg("/C")
            .arg(format!("{} {}", command, task.args.join(" ")));
        c
    } else {
        let mut c = crate::process_utils::async_command("sh");
        c.arg("-c")
            .arg(format!("{} {}", command, task.args.join(" ")));
        c
    };

    cmd.current_dir(&cwd);
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    // Set environment variables
    for (key, value) in &task.options.env {
        cmd.env(key, value);
    }

    // Run the command
    let output = cmd
        .output()
        .await
        .map_err(|e| format!("Failed to execute task: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    Ok(TaskResult {
        task_name: task.label.clone(),
        success: output.status.success(),
        exit_code: output.status.code(),
        output: format!("{}{}", stdout, stderr),
        error: if output.status.success() {
            None
        } else {
            Some(stderr)
        },
    })
}

// ============== Tauri Commands ==============

/// Run a task by name
#[tauri::command]
pub async fn tasks_run_task(
    task_name: String,
    workspace_path: Option<String>,
) -> Result<TaskResult, String> {
    // Get workspace path from argument or use current directory
    let workspace = workspace_path.unwrap_or_else(|| {
        std::env::current_dir()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| ".".to_string())
    });

    // Load tasks configuration
    let config = load_tasks_config(&workspace)?;

    // Find the task
    let task = find_task(&config, &task_name)
        .ok_or_else(|| format!("Task '{}' not found in tasks.json", task_name))?;

    // Handle task dependencies
    for dep in &task.depends_on {
        if let Some(dep_task) = find_task(&config, dep) {
            let dep_result = run_single_task(dep_task, &workspace).await?;
            if !dep_result.success {
                return Err(format!("Dependency task '{}' failed", dep));
            }
        }
    }

    // Run the main task
    run_single_task(task, &workspace).await
}

/// List all available tasks
#[tauri::command]
pub async fn tasks_list(workspace_path: Option<String>) -> Result<Vec<String>, String> {
    let workspace = workspace_path.unwrap_or_else(|| {
        std::env::current_dir()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| ".".to_string())
    });

    let config = load_tasks_config(&workspace)?;
    Ok(config.tasks.iter().map(|t| t.label.clone()).collect())
}

/// Get task configuration
#[tauri::command]
pub async fn tasks_get_config(workspace_path: Option<String>) -> Result<TasksConfig, String> {
    let workspace = workspace_path.unwrap_or_else(|| {
        std::env::current_dir()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| ".".to_string())
    });

    load_tasks_config(&workspace)
}
