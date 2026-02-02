//! Cortex Desktop CLI
//!
//! A command-line interface for launching and controlling Cortex Desktop.
//!
//! # Usage Examples
//!
//! ```bash
//! # Open current directory
//! Cortex .
//!
//! # Open a specific folder
//! Cortex /path/to/project
//!
//! # Open a file
//! Cortex src/main.rs
//!
//! # Open at specific line and column
//! Cortex --goto src/main.rs:42:10
//!
//! # Open in new window
//! Cortex --new-window /path/to/project
//!
//! # Open and wait for close
//! Cortex --wait /path/to/file
//!
//! # Diff two files
//! Cortex --diff file1.rs file2.rs
//! ```

use anyhow::{Context, Result};
use clap::{Parser, Subcommand};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use tracing::{debug, error, info, warn};

/// Cortex Desktop CLI - Open files and folders in Cortex Desktop
#[derive(Parser, Debug)]
#[command(name = "Cortex")]
#[command(author, version)]
#[command(about = "Open files and folders in Cortex Desktop", long_about = None)]
#[command(
    override_usage = "Cortex [OPTIONS] [PATH]\n       Cortex --goto <FILE:LINE[:COLUMN]>\n       Cortex --diff <FILE1> <FILE2>"
)]
struct Cli {
    /// Path to open (file or folder). Use '.' for current directory.
    #[arg(value_name = "PATH")]
    path: Option<PathBuf>,

    /// Open a file at a specific line and optional column (e.g., file.rs:42 or file.rs:42:10)
    #[arg(long = "goto", short = 'g', value_name = "FILE:LINE[:COLUMN]")]
    goto: Option<String>,

    /// Open a diff between two files
    #[arg(long = "diff", short = 'd', num_args = 2, value_names = ["FILE1", "FILE2"])]
    diff: Option<Vec<PathBuf>>,

    /// Force open in a new window
    #[arg(long = "new-window", short = 'n')]
    new_window: bool,

    /// Wait for the file/folder to be closed before returning
    #[arg(long = "wait", short = 'w')]
    wait: bool,

    /// Reuse an existing window (default behavior)
    #[arg(long = "reuse-window", short = 'r')]
    reuse_window: bool,

    /// Add a folder to the current workspace
    #[arg(long = "add")]
    add_folder: Option<PathBuf>,

    /// Show verbose output
    #[arg(long = "verbose", short = 'v')]
    verbose: bool,

    /// Print the deep link URL without opening
    #[arg(long = "print-url", hide = true)]
    print_url: bool,

    #[command(subcommand)]
    command: Option<Commands>,
}

#[derive(Subcommand, Debug)]
enum Commands {
    /// Show version information
    Version,

    /// Show help and usage examples
    Help,
}

/// Represents parsed goto location
#[derive(Debug, Clone)]
struct GotoLocation {
    file: PathBuf,
    line: u32,
    column: Option<u32>,
}

impl GotoLocation {
    /// Parse a goto string like "file.rs:42" or "file.rs:42:10"
    fn parse(s: &str) -> Result<Self> {
        // Find the last colon that could be part of line:column
        // We need to be careful with Windows paths like C:\path\file.rs:42
        let parts: Vec<&str> = s.rsplitn(3, ':').collect();

        match parts.len() {
            1 => anyhow::bail!("Invalid goto format. Expected FILE:LINE or FILE:LINE:COLUMN"),
            2 => {
                // Could be file:line or C:path (Windows drive)
                let line_str = parts[0];
                let file_str = parts[1];

                if let Ok(line) = line_str.parse::<u32>() {
                    Ok(GotoLocation {
                        file: PathBuf::from(file_str),
                        line,
                        column: None,
                    })
                } else {
                    anyhow::bail!(
                        "Invalid line number: {line_str}. Expected FILE:LINE or FILE:LINE:COLUMN"
                    )
                }
            }
            3 => {
                // Could be file:line:column or C:\path:line
                let col_or_line = parts[0];
                let line_or_path = parts[1];
                let file_start = parts[2];

                // Try parsing as file:line:column first
                if let (Ok(line), Ok(col)) =
                    (line_or_path.parse::<u32>(), col_or_line.parse::<u32>())
                {
                    Ok(GotoLocation {
                        file: PathBuf::from(file_start),
                        line,
                        column: Some(col),
                    })
                } else if let Ok(line) = col_or_line.parse::<u32>() {
                    // This is path:line where path contains a colon (Windows)
                    let file_path = format!("{file_start}:{line_or_path}");
                    Ok(GotoLocation {
                        file: PathBuf::from(file_path),
                        line,
                        column: None,
                    })
                } else {
                    anyhow::bail!(
                        "Invalid goto format: {s}. Expected FILE:LINE or FILE:LINE:COLUMN"
                    )
                }
            }
            _ => {
                // Handle Windows paths with more colons: C:\path\file:line:column
                // Reconstruct the path
                let col = parts[0]
                    .parse::<u32>()
                    .context("Invalid column number")?;
                let line = parts[1]
                    .parse::<u32>()
                    .context("Invalid line number")?;
                let file_path = parts[2..].iter().rev().collect::<Vec<_>>().join(":");
                Ok(GotoLocation {
                    file: PathBuf::from(file_path),
                    line,
                    column: Some(col),
                })
            }
        }
    }
}

/// Build a deep link URL for the given action
fn build_deep_link(action: &DeepLinkAction) -> String {
    match action {
        DeepLinkAction::OpenFile { path } => {
            let encoded = urlencoding::encode(&normalize_path(path));
            format!("Cortex://file/{encoded}")
        }
        DeepLinkAction::OpenFolder { path } => {
            let encoded = urlencoding::encode(&normalize_path(path));
            format!("Cortex://open?folder={encoded}")
        }
        DeepLinkAction::OpenGoto { path, line, column } => {
            let encoded = urlencoding::encode(&normalize_path(path));
            match column {
                Some(col) => format!("Cortex://goto/{encoded}?line={line}&column={col}"),
                None => format!("Cortex://goto/{encoded}?line={line}"),
            }
        }
        DeepLinkAction::OpenDiff { file1, file2 } => {
            let encoded1 = urlencoding::encode(&normalize_path(file1));
            let encoded2 = urlencoding::encode(&normalize_path(file2));
            format!("Cortex://diff?left={encoded1}&right={encoded2}")
        }
        DeepLinkAction::NewWindow { path } => {
            let encoded = urlencoding::encode(&normalize_path(path));
            format!("Cortex://open?folder={encoded}&new_window=true")
        }
        DeepLinkAction::AddFolder { path } => {
            let encoded = urlencoding::encode(&normalize_path(path));
            format!("Cortex://add?folder={encoded}")
        }
    }
}

/// Normalize a path to an absolute path string
fn normalize_path(path: &Path) -> String {
    let absolute = if path.is_absolute() {
        path.to_path_buf()
    } else {
        std::env::current_dir()
            .map(|cwd| cwd.join(path))
            .unwrap_or_else(|_| path.to_path_buf())
    };

    // Use dunce to get clean Windows paths without UNC prefix
    dunce::canonicalize(&absolute)
        .unwrap_or(absolute)
        .to_string_lossy()
        .to_string()
}

/// Deep link actions
#[derive(Debug, Clone)]
enum DeepLinkAction {
    OpenFile { path: PathBuf },
    OpenFolder { path: PathBuf },
    OpenGoto { path: PathBuf, line: u32, column: Option<u32> },
    OpenDiff { file1: PathBuf, file2: PathBuf },
    NewWindow { path: PathBuf },
    AddFolder { path: PathBuf },
}

/// Check if Cortex Desktop is currently running
fn is_Cortex_running() -> bool {
    use sysinfo::System;

    let mut system = System::new();
    system.refresh_processes(sysinfo::ProcessesToUpdate::All, true);

    for process in system.processes().values() {
        let name = process.name().to_string_lossy().to_lowercase();
        if name.contains("Cortex") && (name.contains("desktop") || name.contains("tauri")) {
            debug!("Found running Cortex process: {}", name);
            return true;
        }
    }

    false
}

/// Get the path to Cortex Desktop executable
fn get_Cortex_desktop_path() -> Option<PathBuf> {
    // Check common installation locations

    #[cfg(target_os = "windows")]
    {
        // Windows: Check Program Files and Local AppData
        if let Some(local_app_data) = dirs::data_local_dir() {
            let paths = [
                local_app_data.join("Programs").join("Cortex Desktop").join("Cortex Desktop.exe"),
                local_app_data.join("Cortex Desktop").join("Cortex Desktop.exe"),
            ];
            for path in paths {
                if path.exists() {
                    return Some(path);
                }
            }
        }

        if let Some(program_files) = std::env::var_os("ProgramFiles") {
            let path = PathBuf::from(program_files).join("Cortex Desktop").join("Cortex Desktop.exe");
            if path.exists() {
                return Some(path);
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        let paths = [
            PathBuf::from("/Applications/Cortex Desktop.app/Contents/MacOS/Cortex Desktop"),
            dirs::home_dir()
                .map(|h| h.join("Applications/Cortex Desktop.app/Contents/MacOS/Cortex Desktop"))
                .unwrap_or_default(),
        ];
        for path in paths {
            if path.exists() {
                return Some(path);
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        let paths = [
            PathBuf::from("/usr/bin/Cortex-desktop"),
            PathBuf::from("/usr/local/bin/Cortex-desktop"),
            PathBuf::from("/opt/Cortex Desktop/Cortex-desktop"),
            dirs::home_dir()
                .map(|h| h.join(".local/bin/Cortex-desktop"))
                .unwrap_or_default(),
        ];
        for path in paths {
            if path.exists() {
                return Some(path);
            }
        }
    }

    None
}

/// Open a deep link URL using the system handler
fn open_deep_link(url: &str) -> Result<()> {
    debug!("Opening deep link: {}", url);

    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(["/C", "start", "", url])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .context("Failed to open deep link on Windows")?;
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(url)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .context("Failed to open deep link on macOS")?;
    }

    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(url)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .context("Failed to open deep link on Linux")?;
    }

    Ok(())
}

/// Launch Cortex Desktop with arguments
fn launch_Cortex_desktop(args: &[&str]) -> Result<std::process::Child> {
    let exe_path = get_Cortex_desktop_path().context(
        "Cortex Desktop not found. Please ensure it is installed and in your PATH, \
         or set Cortex_DESKTOP_PATH environment variable.",
    )?;

    debug!("Launching Cortex Desktop from: {:?} with args: {:?}", exe_path, args);

    Command::new(&exe_path)
        .args(args)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .with_context(|| format!("Failed to launch Cortex Desktop from {:?}", exe_path))
}

/// Execute the CLI action
fn execute(cli: &Cli) -> Result<()> {
    // Determine the action based on CLI arguments
    let action = determine_action(cli)?;

    // Build the deep link URL
    let url = build_deep_link(&action);

    // If print-url flag is set, just print and exit
    if cli.print_url {
        println!("{url}");
        return Ok(());
    }

    info!("Action: {:?}", action);
    debug!("Deep link URL: {}", url);

    // Check if Cortex Desktop is running
    let is_running = is_Cortex_running();
    debug!("Cortex Desktop running: {}", is_running);

    if is_running {
        // Send deep link to running instance
        open_deep_link(&url)?;
    } else {
        // Launch Cortex Desktop with the deep link
        info!("Cortex Desktop not running, launching...");

        // Try to launch and pass the deep link
        match launch_Cortex_desktop(&[&url]) {
            Ok(child) => {
                if cli.wait {
                    // Wait for the process to exit
                    let output = child.wait_with_output();
                    match output {
                        Ok(out) => {
                            if !out.status.success() {
                                warn!("Cortex Desktop exited with status: {}", out.status);
                            }
                        }
                        Err(e) => {
                            error!("Error waiting for Cortex Desktop: {}", e);
                        }
                    }
                }
            }
            Err(e) => {
                // Fallback: try opening the deep link directly
                warn!("Failed to launch Cortex Desktop directly: {}. Trying deep link...", e);
                open_deep_link(&url)?;
            }
        }
    }

    // If wait flag is set and we used deep link, we need to poll for process exit
    if cli.wait && is_running {
        info!("Waiting for Cortex Desktop to close the file/folder...");
        // In a real implementation, we'd use IPC to wait for the specific file/folder
        // For now, we just return immediately when using deep links to running instance
        warn!("--wait flag with running instance requires IPC (not fully implemented)");
    }

    Ok(())
}

/// Determine the action from CLI arguments
fn determine_action(cli: &Cli) -> Result<DeepLinkAction> {
    // Priority: goto > diff > add_folder > path

    // Handle --goto
    if let Some(ref goto_str) = cli.goto {
        let location = GotoLocation::parse(goto_str)?;
        return Ok(DeepLinkAction::OpenGoto {
            path: location.file,
            line: location.line,
            column: location.column,
        });
    }

    // Handle --diff
    if let Some(ref files) = cli.diff {
        if files.len() != 2 {
            anyhow::bail!("--diff requires exactly two files");
        }
        return Ok(DeepLinkAction::OpenDiff {
            file1: files[0].clone(),
            file2: files[1].clone(),
        });
    }

    // Handle --add
    if let Some(ref folder) = cli.add_folder {
        return Ok(DeepLinkAction::AddFolder {
            path: folder.clone(),
        });
    }

    // Handle path argument
    let path = cli.path.clone().unwrap_or_else(|| PathBuf::from("."));
    let resolved_path = resolve_path(&path)?;

    // Check if path exists
    if !resolved_path.exists() {
        // Could be a new file - allow opening anyway
        warn!("Path does not exist: {:?}. Will attempt to create on open.", resolved_path);
    }

    // Determine if it's a file or folder
    let is_dir = resolved_path.is_dir() || (resolved_path.to_string_lossy().ends_with('/'))
        || (resolved_path.to_string_lossy().ends_with('\\'));

    if cli.new_window {
        Ok(DeepLinkAction::NewWindow { path: resolved_path })
    } else if is_dir {
        Ok(DeepLinkAction::OpenFolder { path: resolved_path })
    } else {
        Ok(DeepLinkAction::OpenFile { path: resolved_path })
    }
}

/// Resolve a path to an absolute path
fn resolve_path(path: &Path) -> Result<PathBuf> {
    if path.is_absolute() {
        return Ok(path.to_path_buf());
    }

    // Handle "." specially
    if path == Path::new(".") {
        return std::env::current_dir().context("Failed to get current directory");
    }

    // Make path absolute relative to current directory
    let cwd = std::env::current_dir().context("Failed to get current directory")?;
    Ok(cwd.join(path))
}

fn main() -> Result<()> {
    let cli = Cli::parse();

    // Initialize logging
    let log_level = if cli.verbose { "debug" } else { "warn" };
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive(log_level.parse().unwrap_or(tracing::level_filters::LevelFilter::WARN.into())),
        )
        .with_writer(std::io::stderr)
        .init();

    // Handle subcommands
    match &cli.command {
        Some(Commands::Version) => {
            println!("Cortex-desktop-cli {}", env!("CARGO_PKG_VERSION"));
            println!("Cortex Desktop CLI for opening files and folders");
            return Ok(());
        }
        Some(Commands::Help) => {
            println!("Cortex Desktop CLI");
            println!();
            println!("USAGE:");
            println!("    Cortex [OPTIONS] [PATH]");
            println!("    Cortex --goto <FILE:LINE[:COLUMN]>");
            println!("    Cortex --diff <FILE1> <FILE2>");
            println!();
            println!("EXAMPLES:");
            println!("    Cortex .                        Open current directory");
            println!("    Cortex /path/to/project         Open a folder");
            println!("    Cortex src/main.rs              Open a file");
            println!("    Cortex --goto src/main.rs:42    Open file at line 42");
            println!("    Cortex -g src/main.rs:42:10     Open file at line 42, column 10");
            println!("    Cortex --new-window .           Open in a new window");
            println!("    Cortex --wait file.txt          Wait for file to be closed");
            println!("    Cortex --diff old.rs new.rs     Open diff view");
            println!("    Cortex --add ./lib              Add folder to workspace");
            println!();
            println!("OPTIONS:");
            println!("    -g, --goto <FILE:LINE[:COL]>    Open at specific location");
            println!("    -d, --diff <F1> <F2>            Compare two files");
            println!("    -n, --new-window                Force new window");
            println!("    -w, --wait                      Wait for close");
            println!("    -r, --reuse-window              Reuse existing window (default)");
            println!("    --add <FOLDER>                  Add folder to workspace");
            println!("    -v, --verbose                   Verbose output");
            println!("    -h, --help                      Print help");
            println!("    -V, --version                   Print version");
            return Ok(());
        }
        None => {}
    }

    execute(&cli)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_goto_parse_simple() {
        let loc = GotoLocation::parse("file.rs:42").unwrap();
        assert_eq!(loc.file, PathBuf::from("file.rs"));
        assert_eq!(loc.line, 42);
        assert_eq!(loc.column, None);
    }

    #[test]
    fn test_goto_parse_with_column() {
        let loc = GotoLocation::parse("file.rs:42:10").unwrap();
        assert_eq!(loc.file, PathBuf::from("file.rs"));
        assert_eq!(loc.line, 42);
        assert_eq!(loc.column, Some(10));
    }

    #[test]
    fn test_goto_parse_path_with_directory() {
        let loc = GotoLocation::parse("src/main.rs:100").unwrap();
        assert_eq!(loc.file, PathBuf::from("src/main.rs"));
        assert_eq!(loc.line, 100);
        assert_eq!(loc.column, None);
    }

    #[test]
    fn test_deep_link_file() {
        let action = DeepLinkAction::OpenFile {
            path: PathBuf::from("/test/file.rs"),
        };
        let url = build_deep_link(&action);
        assert!(url.starts_with("Cortex://file/"));
        assert!(url.contains("file.rs"));
    }

    #[test]
    fn test_deep_link_folder() {
        let action = DeepLinkAction::OpenFolder {
            path: PathBuf::from("/test/project"),
        };
        let url = build_deep_link(&action);
        assert!(url.starts_with("Cortex://open?folder="));
        assert!(url.contains("project"));
    }

    #[test]
    fn test_deep_link_goto() {
        let action = DeepLinkAction::OpenGoto {
            path: PathBuf::from("/test/file.rs"),
            line: 42,
            column: Some(10),
        };
        let url = build_deep_link(&action);
        assert!(url.starts_with("Cortex://goto/"));
        assert!(url.contains("line=42"));
        assert!(url.contains("column=10"));
    }

    #[test]
    fn test_deep_link_diff() {
        let action = DeepLinkAction::OpenDiff {
            file1: PathBuf::from("/test/old.rs"),
            file2: PathBuf::from("/test/new.rs"),
        };
        let url = build_deep_link(&action);
        assert!(url.starts_with("Cortex://diff?"));
        assert!(url.contains("left="));
        assert!(url.contains("right="));
    }
}
