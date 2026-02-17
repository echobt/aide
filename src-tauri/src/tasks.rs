//! Tasks module for running VS Code-style task definitions
//!
//! This module provides functionality to run tasks defined in tasks.json files,
//! commonly used for pre/post debug tasks and build tasks.

use once_cell::sync::Lazy;
use parking_lot::Mutex;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tracing::{debug, error, info, warn};
use uuid::Uuid;

// ============== Global Running Tasks State ==============

static RUNNING_TASKS: Lazy<Mutex<HashMap<String, RunningTask>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

static LAST_TASK: Lazy<Mutex<Option<(TaskDefinition, String)>>> = Lazy::new(|| Mutex::new(None));

struct RunningTask {
    abort_handle: tokio::task::AbortHandle,
}

// ============== Event Payloads ==============

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TaskOutputEvent {
    task_id: String,
    line: String,
    is_stderr: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TaskStatusEvent {
    task_id: String,
    status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TaskDiagnosticEvent {
    task_id: String,
    file: String,
    line: u32,
    column: u32,
    severity: String,
    message: String,
    code: Option<String>,
    source: String,
}

// ============== Task Structs ==============

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
    pub depends_order: Option<String>,
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

// ============== Problem Matcher ==============

struct ProblemMatcher {
    name: String,
    pattern: Regex,
    file_group: usize,
    line_group: usize,
    column_group: usize,
    severity_group: Option<usize>,
    message_group: usize,
    code_group: Option<usize>,
}

fn get_builtin_problem_matcher(name: &str) -> Option<ProblemMatcher> {
    match name {
        "$tsc" => {
            // TypeScript: src/file.ts(10,5): error TS2304: Cannot find name 'x'.
            Regex::new(r"^(.+)\((\d+),(\d+)\):\s+(error|warning)\s+(TS\d+):\s+(.+)$")
                .ok()
                .map(|pattern| ProblemMatcher {
                    name: "tsc".to_string(),
                    pattern,
                    file_group: 1,
                    line_group: 2,
                    column_group: 3,
                    severity_group: Some(4),
                    message_group: 6,
                    code_group: Some(5),
                })
        }
        "$eslint-stylish" => {
            // /path/to/file.js
            //   10:5  error  some message  rule-name
            // We match the detail line; file tracking is multi-line. Simplified single-line:
            Regex::new(r"^\s+(\d+):(\d+)\s+(error|warning)\s+(.+?)\s{2,}(\S+)\s*$")
                .ok()
                .map(|pattern| ProblemMatcher {
                    name: "eslint-stylish".to_string(),
                    pattern,
                    file_group: 0, // handled specially
                    line_group: 1,
                    column_group: 2,
                    severity_group: Some(3),
                    message_group: 4,
                    code_group: Some(5),
                })
        }
        "$gcc" => {
            // file.c:10:5: error: undeclared identifier
            Regex::new(r"^(.+):(\d+):(\d+):\s+(error|warning|note):\s+(.+)$")
                .ok()
                .map(|pattern| ProblemMatcher {
                    name: "gcc".to_string(),
                    pattern,
                    file_group: 1,
                    line_group: 2,
                    column_group: 3,
                    severity_group: Some(4),
                    message_group: 5,
                    code_group: None,
                })
        }
        "$rustc" => {
            // error[E0425]: cannot find value `x` in this scope
            //  --> src/main.rs:10:5
            // We match the location line:
            Regex::new(r"^\s*-->\s+(.+):(\d+):(\d+)\s*$")
                .ok()
                .map(|pattern| ProblemMatcher {
                    name: "rustc".to_string(),
                    pattern,
                    file_group: 1,
                    line_group: 2,
                    column_group: 3,
                    severity_group: None,
                    message_group: 0, // handled via context
                    code_group: None,
                })
        }
        "$go" => {
            // file.go:10:5: error message
            Regex::new(r"^(.+\.go):(\d+):(\d+):\s+(.+)$")
                .ok()
                .map(|pattern| ProblemMatcher {
                    name: "go".to_string(),
                    pattern,
                    file_group: 1,
                    line_group: 2,
                    column_group: 3,
                    severity_group: None,
                    message_group: 4,
                    code_group: None,
                })
        }
        "$python" => {
            // File "file.py", line 10
            Regex::new(r#"^\s*File "(.+)", line (\d+)"#)
                .ok()
                .map(|pattern| ProblemMatcher {
                    name: "python".to_string(),
                    pattern,
                    file_group: 1,
                    line_group: 2,
                    column_group: 0,
                    severity_group: None,
                    message_group: 0,
                    code_group: None,
                })
        }
        _ => None,
    }
}

fn get_problem_matchers(problem_matcher: &Option<serde_json::Value>) -> Vec<ProblemMatcher> {
    let Some(value) = problem_matcher else {
        return Vec::new();
    };

    let mut matchers = Vec::new();

    match value {
        serde_json::Value::String(name) => {
            if let Some(m) = get_builtin_problem_matcher(name) {
                matchers.push(m);
            } else {
                debug!("Unknown problem matcher: {}", name);
            }
        }
        serde_json::Value::Array(arr) => {
            for item in arr {
                if let Some(name) = item.as_str() {
                    if let Some(m) = get_builtin_problem_matcher(name) {
                        matchers.push(m);
                    }
                }
            }
        }
        _ => {
            debug!("Unsupported problem matcher format");
        }
    }

    matchers
}

fn apply_problem_matchers(
    line: &str,
    matchers: &[ProblemMatcher],
    task_id: &str,
    app_handle: &AppHandle,
    last_rustc_message: &Option<(String, String)>,
) {
    for matcher in matchers {
        if let Some(caps) = matcher.pattern.captures(line) {
            let file = if matcher.file_group > 0 {
                caps.get(matcher.file_group)
                    .map(|m| m.as_str().to_string())
                    .unwrap_or_default()
            } else {
                String::new()
            };

            let line_num: u32 = if matcher.line_group > 0 {
                caps.get(matcher.line_group)
                    .and_then(|m| m.as_str().parse().ok())
                    .unwrap_or(0)
            } else {
                0
            };

            let column: u32 = if matcher.column_group > 0 {
                caps.get(matcher.column_group)
                    .and_then(|m| m.as_str().parse().ok())
                    .unwrap_or(0)
            } else {
                0
            };

            let severity = matcher
                .severity_group
                .and_then(|g| caps.get(g))
                .map(|m| m.as_str().to_string())
                .or_else(|| last_rustc_message.as_ref().map(|(sev, _)| sev.clone()))
                .unwrap_or_else(|| "error".to_string());

            let message = if matcher.message_group > 0 {
                caps.get(matcher.message_group)
                    .map(|m| m.as_str().to_string())
                    .unwrap_or_default()
            } else {
                last_rustc_message
                    .as_ref()
                    .map(|(_, msg)| msg.clone())
                    .unwrap_or_default()
            };

            let code = matcher
                .code_group
                .and_then(|g| caps.get(g))
                .map(|m| m.as_str().to_string());

            let event = TaskDiagnosticEvent {
                task_id: task_id.to_string(),
                file,
                line: line_num,
                column,
                severity,
                message,
                code,
                source: matcher.name.clone(),
            };

            if let Err(e) = app_handle.emit("task:diagnostic", &event) {
                warn!("Failed to emit task:diagnostic event: {}", e);
            }

            break;
        }
    }
}

// ============== Variable Substitution ==============

fn substitute_variables(input: &str, workspace_path: &str, file_path: Option<&str>) -> String {
    static VAR_RE: Lazy<Regex> =
        Lazy::new(|| Regex::new(r"\$\{([^}]+)\}").expect("Invalid variable substitution regex"));

    let workspace = Path::new(workspace_path);

    VAR_RE
        .replace_all(input, |caps: &regex::Captures| {
            let var_name = &caps[1];
            match var_name {
                "workspaceFolder" => workspace_path.to_string(),
                "workspaceFolderBasename" => workspace
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("")
                    .to_string(),
                "cwd" => std::env::current_dir()
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or_else(|_| ".".to_string()),
                "file" => file_path.unwrap_or("").to_string(),
                "fileBasename" => file_path
                    .map(|f| {
                        Path::new(f)
                            .file_name()
                            .and_then(|n| n.to_str())
                            .unwrap_or("")
                            .to_string()
                    })
                    .unwrap_or_default(),
                "fileDirname" => file_path
                    .map(|f| {
                        Path::new(f)
                            .parent()
                            .and_then(|p| p.to_str())
                            .unwrap_or("")
                            .to_string()
                    })
                    .unwrap_or_default(),
                "fileExtname" => file_path
                    .map(|f| {
                        Path::new(f)
                            .extension()
                            .and_then(|e| e.to_str())
                            .map(|e| format!(".{}", e))
                            .unwrap_or_default()
                    })
                    .unwrap_or_default(),
                "fileBasenameNoExtension" => file_path
                    .map(|f| {
                        Path::new(f)
                            .file_stem()
                            .and_then(|n| n.to_str())
                            .unwrap_or("")
                            .to_string()
                    })
                    .unwrap_or_default(),
                other if other.starts_with("env:") => {
                    let env_var = &other[4..];
                    std::env::var(env_var).unwrap_or_default()
                }
                _ => caps[0].to_string(),
            }
        })
        .to_string()
}

// ============== Command Building ==============

fn build_command(task: &TaskDefinition, workspace_path: &str) -> tokio::process::Command {
    let command_str = task
        .command
        .as_deref()
        .map(|c| substitute_variables(c, workspace_path, None))
        .unwrap_or_default();

    let args: Vec<String> = task
        .args
        .iter()
        .map(|a| substitute_variables(a, workspace_path, None))
        .collect();

    let cwd = task
        .options
        .cwd
        .as_ref()
        .map(|c| {
            let substituted = substitute_variables(c, workspace_path, None);
            let p = PathBuf::from(&substituted);
            if p.is_absolute() {
                p
            } else {
                PathBuf::from(workspace_path).join(p)
            }
        })
        .unwrap_or_else(|| PathBuf::from(workspace_path));

    let mut cmd = if task.task_type == "process" {
        let mut c = crate::process_utils::async_command(&command_str);
        for arg in &args {
            c.arg(arg);
        }
        c
    } else {
        let full_command = if args.is_empty() {
            command_str
        } else {
            format!("{} {}", command_str, shell_join_args(&args))
        };

        if let Some(ref custom_shell) = task.options.shell {
            let shell_exec = custom_shell
                .executable
                .as_deref()
                .unwrap_or(default_shell_executable());
            let mut c = crate::process_utils::async_command(shell_exec);
            if custom_shell.args.is_empty() {
                for arg in default_shell_args() {
                    c.arg(arg);
                }
            } else {
                for arg in &custom_shell.args {
                    c.arg(arg);
                }
            }
            c.arg(&full_command);
            c
        } else {
            let mut c = crate::process_utils::async_command(default_shell_executable());
            for arg in default_shell_args() {
                c.arg(arg);
            }
            c.arg(&full_command);
            c
        }
    };

    cmd.current_dir(&cwd);
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    for (key, value) in &task.options.env {
        let substituted_value = substitute_variables(value, workspace_path, None);
        cmd.env(key, substituted_value);
    }

    cmd
}

fn default_shell_executable() -> &'static str {
    if cfg!(target_os = "windows") {
        "cmd"
    } else {
        "sh"
    }
}

fn default_shell_args() -> &'static [&'static str] {
    if cfg!(target_os = "windows") {
        &["/C"]
    } else {
        &["-c"]
    }
}

fn shell_join_args(args: &[String]) -> String {
    args.iter()
        .map(|a| {
            if a.contains(' ') || a.contains('"') || a.contains('\'') {
                format!("\"{}\"", a.replace('"', "\\\""))
            } else {
                a.clone()
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

// ============== Rustc Context Tracking ==============

static RUSTC_HEADER_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"^(error|warning)(?:\[([A-Z]\d+)\])?:\s+(.+)$").expect("Invalid rustc header regex")
});

fn parse_rustc_header(line: &str) -> Option<(String, String)> {
    RUSTC_HEADER_RE.captures(line).map(|caps| {
        let severity = caps[1].to_string();
        let message = caps[3].to_string();
        (severity, message)
    })
}

// ============== Core Execution ==============

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

/// Run a single task (legacy - collects all output at once)
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

/// Execute a task with streaming output, problem matchers, and background support
async fn execute_task_streaming(
    task: TaskDefinition,
    workspace_path: String,
    app_handle: AppHandle,
    task_id: String,
) -> anyhow::Result<TaskResult> {
    let command_str = task.command.as_deref().unwrap_or_default();
    if command_str.is_empty() {
        anyhow::bail!("Task '{}' has no command", task.label);
    }

    info!("Executing task '{}' (id: {})", task.label, task_id);

    let _ = app_handle.emit(
        "task:status",
        &TaskStatusEvent {
            task_id: task_id.clone(),
            status: "started".to_string(),
        },
    );

    let mut child = build_command(&task, &workspace_path)
        .spawn()
        .map_err(|e| anyhow::anyhow!("Failed to spawn task '{}': {}", task.label, e))?;

    let matchers = get_problem_matchers(&task.problem_matcher);
    let has_rustc_matcher = matchers.iter().any(|m| m.name == "rustc");

    let stdout_handle = if let Some(stdout) = child.stdout.take() {
        let reader = BufReader::new(stdout);
        let app = app_handle.clone();
        let tid = task_id.clone();
        let matchers_for_stdout: Vec<_> = matchers
            .iter()
            .map(|m| ProblemMatcher {
                name: m.name.clone(),
                pattern: m.pattern.clone(),
                file_group: m.file_group,
                line_group: m.line_group,
                column_group: m.column_group,
                severity_group: m.severity_group,
                message_group: m.message_group,
                code_group: m.code_group,
            })
            .collect();
        let track_rustc = has_rustc_matcher;

        Some(tokio::spawn(async move {
            let mut lines = reader.lines();
            let mut last_rustc_ctx: Option<(String, String)> = None;

            while let Ok(Some(line)) = lines.next_line().await {
                let _ = app.emit(
                    "task:output",
                    &TaskOutputEvent {
                        task_id: tid.clone(),
                        line: line.clone(),
                        is_stderr: false,
                    },
                );

                if track_rustc {
                    if let Some(ctx) = parse_rustc_header(&line) {
                        last_rustc_ctx = Some(ctx);
                    }
                }

                apply_problem_matchers(&line, &matchers_for_stdout, &tid, &app, &last_rustc_ctx);
            }
        }))
    } else {
        None
    };

    let stderr_handle = if let Some(stderr) = child.stderr.take() {
        let reader = BufReader::new(stderr);
        let app = app_handle.clone();
        let tid = task_id.clone();
        let matchers_for_stderr: Vec<_> = matchers
            .iter()
            .map(|m| ProblemMatcher {
                name: m.name.clone(),
                pattern: m.pattern.clone(),
                file_group: m.file_group,
                line_group: m.line_group,
                column_group: m.column_group,
                severity_group: m.severity_group,
                message_group: m.message_group,
                code_group: m.code_group,
            })
            .collect();
        let track_rustc = has_rustc_matcher;

        Some(tokio::spawn(async move {
            let mut lines = reader.lines();
            let mut last_rustc_ctx: Option<(String, String)> = None;

            while let Ok(Some(line)) = lines.next_line().await {
                let _ = app.emit(
                    "task:output",
                    &TaskOutputEvent {
                        task_id: tid.clone(),
                        line: line.clone(),
                        is_stderr: true,
                    },
                );

                if track_rustc {
                    if let Some(ctx) = parse_rustc_header(&line) {
                        last_rustc_ctx = Some(ctx);
                    }
                }

                apply_problem_matchers(&line, &matchers_for_stderr, &tid, &app, &last_rustc_ctx);
            }
        }))
    } else {
        None
    };

    if task.is_background {
        let _ = app_handle.emit(
            "task:status",
            &TaskStatusEvent {
                task_id: task_id.clone(),
                status: "running".to_string(),
            },
        );

        info!(
            "Background task '{}' (id: {}) is running",
            task.label, task_id
        );

        let task_label = task.label.clone();
        let app_for_bg = app_handle.clone();
        let tid_for_bg = task_id.clone();

        tokio::spawn(async move {
            let status = child.wait().await;
            let exit_code = status.map(|s| s.code().unwrap_or(-1)).ok();

            if let Some(h) = stdout_handle {
                let _ = h.await;
            }
            if let Some(h) = stderr_handle {
                let _ = h.await;
            }

            RUNNING_TASKS.lock().remove(&tid_for_bg);

            let final_status = if exit_code == Some(0) {
                "completed"
            } else {
                "failed"
            };

            let _ = app_for_bg.emit(
                "task:status",
                &TaskStatusEvent {
                    task_id: tid_for_bg.clone(),
                    status: final_status.to_string(),
                },
            );

            info!(
                "Background task '{}' (id: {}) finished with status: {}",
                task_label, tid_for_bg, final_status
            );
        });

        return Ok(TaskResult {
            task_name: task.label.clone(),
            success: true,
            exit_code: None,
            output: String::new(),
            error: None,
        });
    }

    let status = child.wait().await?;

    if let Some(h) = stdout_handle {
        let _ = h.await;
    }
    if let Some(h) = stderr_handle {
        let _ = h.await;
    }

    RUNNING_TASKS.lock().remove(&task_id);

    let exit_code = status.code();
    let success = status.success();

    let final_status = if success { "completed" } else { "failed" };

    let _ = app_handle.emit(
        "task:status",
        &TaskStatusEvent {
            task_id: task_id.clone(),
            status: final_status.to_string(),
        },
    );

    info!(
        "Task '{}' (id: {}) finished with status: {}",
        task.label, task_id, final_status
    );

    Ok(TaskResult {
        task_name: task.label,
        success,
        exit_code,
        output: String::new(),
        error: if success {
            None
        } else {
            Some(format!("Task exited with code {:?}", exit_code))
        },
    })
}

/// Run dependency tasks before the main task
async fn run_dependencies(
    depends_on: &[String],
    depends_order: Option<&str>,
    workspace_path: &str,
    app_handle: &AppHandle,
) -> Result<(), String> {
    if depends_on.is_empty() {
        return Ok(());
    }

    let config = load_tasks_config(workspace_path)?;

    if depends_order == Some("parallel") {
        let mut handles = Vec::new();

        for dep_name in depends_on {
            let dep_task = find_task(&config, dep_name)
                .ok_or_else(|| format!("Dependency task '{}' not found", dep_name))?
                .clone();

            let ws = workspace_path.to_string();
            let app = app_handle.clone();
            let dep_id = Uuid::new_v4().to_string();

            debug!(
                "Starting parallel dependency task '{}' (id: {})",
                dep_name, dep_id
            );

            handles.push(tokio::spawn(async move {
                execute_task_streaming(dep_task, ws, app, dep_id).await
            }));
        }

        for handle in handles {
            let result = handle
                .await
                .map_err(|e| format!("Dependency task join error: {}", e))?
                .map_err(|e| format!("Dependency task failed: {}", e))?;

            if !result.success {
                return Err(format!("Dependency task '{}' failed", result.task_name));
            }
        }
    } else {
        for dep_name in depends_on {
            let dep_task = find_task(&config, dep_name)
                .ok_or_else(|| format!("Dependency task '{}' not found", dep_name))?
                .clone();

            let dep_id = Uuid::new_v4().to_string();
            debug!(
                "Starting sequential dependency task '{}' (id: {})",
                dep_name, dep_id
            );

            let result = execute_task_streaming(
                dep_task,
                workspace_path.to_string(),
                app_handle.clone(),
                dep_id,
            )
            .await
            .map_err(|e| format!("Dependency task '{}' failed: {}", dep_name, e))?;

            if !result.success {
                return Err(format!("Dependency task '{}' failed", dep_name));
            }
        }
    }

    Ok(())
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

/// Execute a task with streaming output, problem matchers, and dependency support
#[tauri::command]
pub async fn tasks_execute_task(
    task: TaskDefinition,
    workspace_path: Option<String>,
    app_handle: AppHandle,
) -> Result<String, String> {
    let workspace = workspace_path.unwrap_or_else(|| {
        std::env::current_dir()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| ".".to_string())
    });

    let task_id = Uuid::new_v4().to_string();
    LAST_TASK.lock().replace((task.clone(), workspace.clone()));
    info!("Scheduling task '{}' (id: {})", task.label, task_id);

    let depends_on = task.depends_on.clone();
    let depends_order = task.depends_order.clone();

    if !depends_on.is_empty() {
        run_dependencies(
            &depends_on,
            depends_order.as_deref(),
            &workspace,
            &app_handle,
        )
        .await?;
    }

    let task_id_clone = task_id.clone();
    let app_clone = app_handle.clone();
    let ws = workspace.clone();

    let join_handle = tokio::spawn(async move {
        match execute_task_streaming(task, ws, app_clone.clone(), task_id_clone.clone()).await {
            Ok(result) => {
                debug!(
                    "Task {} completed: success={}",
                    task_id_clone, result.success
                );
            }
            Err(e) => {
                error!("Task {} failed: {}", task_id_clone, e);
                let _ = app_clone.emit(
                    "task:status",
                    &TaskStatusEvent {
                        task_id: task_id_clone.clone(),
                        status: "failed".to_string(),
                    },
                );
                RUNNING_TASKS.lock().remove(&task_id_clone);
            }
        }
    });

    RUNNING_TASKS.lock().insert(
        task_id.clone(),
        RunningTask {
            abort_handle: join_handle.abort_handle(),
        },
    );

    Ok(task_id)
}

/// Cancel a running task
#[tauri::command]
pub async fn tasks_cancel_task(task_id: String) -> Result<(), String> {
    let running_task = RUNNING_TASKS.lock().remove(&task_id);

    match running_task {
        Some(task) => {
            info!("Cancelling task {}", task_id);
            task.abort_handle.abort();
            Ok(())
        }
        None => Err(format!("Task '{}' not found or already completed", task_id)),
    }
}

/// Get the inputs array from tasks.json config
#[tauri::command]
pub async fn tasks_get_inputs(
    workspace_path: Option<String>,
) -> Result<Vec<serde_json::Value>, String> {
    let workspace = workspace_path.unwrap_or_else(|| {
        std::env::current_dir()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| ".".to_string())
    });
    let config = load_tasks_config(&workspace)?;
    Ok(config.inputs)
}

/// Re-run the last executed task
#[tauri::command]
pub async fn tasks_rerun_last(app_handle: AppHandle) -> Result<String, String> {
    let last = LAST_TASK.lock().clone();
    match last {
        Some((task, workspace)) => {
            let task_id = Uuid::new_v4().to_string();
            let task_id_clone = task_id.clone();
            let app_clone = app_handle.clone();

            let join_handle = tokio::spawn(async move {
                match execute_task_streaming(
                    task,
                    workspace,
                    app_clone.clone(),
                    task_id_clone.clone(),
                )
                .await
                {
                    Ok(result) => {
                        debug!(
                            "Re-run task {} completed: success={}",
                            task_id_clone, result.success
                        );
                    }
                    Err(e) => {
                        error!("Re-run task {} failed: {}", task_id_clone, e);
                        let _ = app_clone.emit(
                            "task:status",
                            &TaskStatusEvent {
                                task_id: task_id_clone.clone(),
                                status: "failed".to_string(),
                            },
                        );
                        RUNNING_TASKS.lock().remove(&task_id_clone);
                    }
                }
            });

            RUNNING_TASKS.lock().insert(
                task_id.clone(),
                RunningTask {
                    abort_handle: join_handle.abort_handle(),
                },
            );

            Ok(task_id)
        }
        None => Err("No previous task to re-run".to_string()),
    }
}

/// Get list of currently running task IDs
#[tauri::command]
pub async fn tasks_get_running() -> Result<Vec<String>, String> {
    Ok(RUNNING_TASKS.lock().keys().cloned().collect())
}
