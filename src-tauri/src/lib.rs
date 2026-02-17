#![allow(dead_code)]
//! Cortex Desktop - Tauri application backend
//!
//! This module provides the Rust backend for the Cortex Desktop application,
//! including sidecar management, IPC commands, system integration, remote development, LSP, debugging, auto-updates, code formatting, MCP context servers, ACP tools, and terminal PTY support.
//!
//! # Startup Optimization
//!
//! This module implements several startup optimizations:
//! - Lazy state initialization using `OnceLock` for heavy managers
//! - Parallel initialization of independent systems using `tokio::join!`
//! - Deferred window visibility until content is ready
//! - Settings preloading for fast restore

mod acp;
mod action_log;
mod activity;
mod ai;
mod auto_update;
mod batch;
mod browser;
mod context_server;
mod dap;
mod deep_link;
mod diagnostics;
mod extensions;
mod factory;
mod formatter;
mod fs;
mod git;
mod language_selector;
mod lsp;
mod mcp;
mod notebook;
mod process;
mod process_utils;
mod prompt_store;
mod remote;
mod repl;
mod rules_library;
mod sandbox;
mod search;
mod settings;
mod ssh_terminal;
mod system_specs;
mod tasks;
mod terminal;
mod testing;
mod timeline;
mod toolchain;
mod window;
mod workspace_settings;
mod wsl;

use std::collections::VecDeque;
use std::net::TcpListener;
use std::sync::{Arc, Mutex, OnceLock};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, RunEvent, WebviewWindow, WindowEvent};
use tauri_plugin_shell::process::CommandChild;
use tokio::sync::mpsc;
use tracing::{error, info, warn};

use activity::ActivityState;
use ai::{
    AIState,
    AIToolsState,
    AgentState,
    AgentStoreState,
    agent_cancel_task,
    agent_cleanup,
    agent_generate_prompt,
    agent_get_history,
    agent_get_stats,
    agent_get_status,
    agent_get_task,
    agent_list,
    agent_list_tasks,
    agent_remove,
    agent_run_task,
    // Agent commands
    agent_spawn,
    agent_store_add_history,
    // Agent Store commands (persistent storage)
    agent_store_load,
    agent_store_save,
    agent_store_update_stats,
    // Message commands
    ai_add_message,
    ai_clear_messages,
    // Completion commands
    ai_complete,
    ai_configure_provider,
    // Thread commands
    ai_create_thread,
    ai_delete_thread,
    // Thread utility commands
    ai_duplicate_thread,
    ai_export_thread,
    ai_get_messages,
    ai_get_provider_models,
    ai_get_thread,
    ai_import_thread,
    ai_init_threads,
    ai_list_models,
    ai_list_thread_summaries,
    ai_list_threads,
    // AI predictions and misc commands
    ai_predict,
    ai_remove_provider,
    ai_search_threads,
    ai_stream,
    ai_thread_count,
    ai_update_thread,
    cortex_approve_exec,
    cortex_cancel,
    // Cortex Session commands
    cortex_create_session,
    cortex_delete_session,
    cortex_destroy_session,
    cortex_get_history,
    cortex_get_status,
    cortex_list_stored_sessions,
    cortex_send_message,
    cortex_submit_system,
    cortex_update_cwd,
    cortex_update_model,
    fetch_url,
    submit_feedback,
    tools_execute,
    tools_execute_batch,
    tools_get,
    // Tool commands
    tools_list,
};
use auto_update::AutoUpdateState;
use context_server::ContextServerState;
use dap::DebuggerState;
use extensions::{ExtensionsManager, ExtensionsState};
use lsp::LspState;
use remote::RemoteManager;
use repl::{KernelEvent, KernelInfo, KernelManager, KernelSpec};
use timeline::TimelineState;
use toolchain::ToolchainState;

const _MAX_LOG_ENTRIES: usize = 500;

/// Lazy initialization wrapper for heavy state managers.
/// Uses `OnceLock` to defer initialization until first access.
pub struct LazyState<T> {
    inner: OnceLock<T>,
    init: fn() -> T,
}

impl<T> LazyState<T> {
    /// Create a new lazy state with the given initialization function.
    pub const fn new(init: fn() -> T) -> Self {
        Self {
            inner: OnceLock::new(),
            init,
        }
    }

    /// Get or initialize the inner state.
    pub fn get(&self) -> &T {
        self.inner.get_or_init(self.init)
    }

    /// Check if the state has been initialized.
    pub fn is_initialized(&self) -> bool {
        self.inner.get().is_some()
    }
}

// Implement Clone for LazyState where T: Clone
impl<T: Clone> Clone for LazyState<T> {
    fn clone(&self) -> Self {
        // If initialized, create a new LazyState with the cloned value
        // Otherwise, create a new uninitialized LazyState with the same init fn
        let new_state = Self::new(self.init);
        if let Some(value) = self.inner.get() {
            let _ = new_state.inner.set(value.clone());
        }
        new_state
    }
}

/// Show the main window with optimized timing.
/// Call this after initial content is ready to avoid blank window flash.
fn show_main_window(window: &WebviewWindow) {
    if let Err(e) = window.show() {
        error!("Failed to show main window: {}", e);
    }
    if let Err(e) = window.set_focus() {
        warn!("Failed to focus main window: {}", e);
    }
}

#[derive(Clone)]
struct ServerState(Arc<Mutex<Option<CommandChild>>>);

#[derive(Clone)]
struct LogState(Arc<Mutex<VecDeque<String>>>);

#[derive(Clone)]
struct PortState(Arc<Mutex<u32>>);

#[derive(Clone)]
struct REPLState(Arc<Mutex<Option<KernelManager>>>);

#[derive(Debug, Serialize, Deserialize)]
pub struct ServerInfo {
    pub port: u32,
    pub url: String,
    pub running: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CortexConfig {
    pub model: String,
    pub provider: String,
    pub sandbox_mode: String,
    pub approval_mode: String,
}

fn find_free_port() -> Result<u32, String> {
    // Try 4096 first
    if TcpListener::bind("127.0.0.1:4096").is_ok() {
        return Ok(4096);
    }

    TcpListener::bind("127.0.0.1:0")
        .and_then(|listener| listener.local_addr())
        .map(|addr| addr.port() as u32)
        .map_err(|e| format!("Failed to find free port: {}", e))
}

#[tauri::command]
async fn start_server(_app: AppHandle) -> Result<ServerInfo, String> {
    Ok(ServerInfo {
        port: 4096,
        url: "http://127.0.0.1:4096".to_string(),
        running: true,
    })
}

#[tauri::command]
async fn stop_server(_app: AppHandle) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
async fn get_server_info(_app: AppHandle) -> Result<ServerInfo, String> {
    Ok(ServerInfo {
        port: 4096,
        url: "http://127.0.0.1:4096".to_string(),
        running: true,
    })
}

#[tauri::command]
async fn get_logs(app: AppHandle) -> Result<String, String> {
    let log_state = app.state::<LogState>();

    let logs = log_state
        .0
        .lock()
        .map_err(|_| "Failed to acquire log lock")?;

    Ok(logs.iter().cloned().collect::<Vec<_>>().join(""))
}

#[tauri::command]
async fn copy_logs_to_clipboard(app: AppHandle) -> Result<(), String> {
    let log_state = app.state::<LogState>();

    let logs = log_state
        .0
        .lock()
        .map_err(|_| "Failed to acquire log lock")?;

    let log_text = logs.iter().cloned().collect::<Vec<_>>().join("");

    app.clipboard()
        .write_text(log_text)
        .map_err(|e| format!("Failed to copy to clipboard: {}", e))?;

    Ok(())
}

#[tauri::command]
async fn get_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[tauri::command]
async fn open_in_browser(url: String) -> Result<(), String> {
    open::that(&url).map_err(|e| format!("Failed to open URL: {}", e))
}

// ===== REPL Commands =====

#[tauri::command]
async fn repl_list_kernel_specs(app: AppHandle) -> Result<Vec<KernelSpec>, String> {
    let repl_state = app.state::<REPLState>();
    let mut guard = repl_state
        .0
        .lock()
        .map_err(|_| "Failed to acquire REPL lock")?;

    if guard.is_none() {
        let (tx, mut rx) = mpsc::unbounded_channel::<KernelEvent>();
        let app_clone = app.clone();

        tauri::async_runtime::spawn(async move {
            while let Some(event) = rx.recv().await {
                let _ = app_clone.emit("repl:event", &event);
            }
        });

        *guard = Some(KernelManager::new(tx));
    }

    match guard.as_ref() {
        Some(manager) => Ok(manager.list_kernel_specs()),
        None => Err("Kernel manager not initialized".to_string()),
    }
}

#[tauri::command]
async fn repl_start_kernel(app: AppHandle, spec_id: String) -> Result<KernelInfo, String> {
    let repl_state = app.state::<REPLState>();
    let mut guard = repl_state
        .0
        .lock()
        .map_err(|_| "Failed to acquire REPL lock")?;

    if guard.is_none() {
        let (tx, mut rx) = mpsc::unbounded_channel::<KernelEvent>();
        let app_clone = app.clone();

        tauri::async_runtime::spawn(async move {
            while let Some(event) = rx.recv().await {
                let _ = app_clone.emit("repl:event", &event);
            }
        });

        *guard = Some(KernelManager::new(tx));
    }

    match guard.as_mut() {
        Some(manager) => manager.start_kernel(&spec_id),
        None => Err("Kernel manager not initialized".to_string()),
    }
}

#[tauri::command]
async fn repl_list_kernels(app: AppHandle) -> Result<Vec<KernelInfo>, String> {
    let repl_state = app.state::<REPLState>();
    let guard = repl_state
        .0
        .lock()
        .map_err(|_| "Failed to acquire REPL lock")?;

    match guard.as_ref() {
        Some(manager) => Ok(manager.list_kernels()),
        None => Ok(Vec::new()),
    }
}

#[tauri::command]
async fn repl_execute(
    app: AppHandle,
    kernel_id: String,
    code: String,
    cell_id: String,
) -> Result<u32, String> {
    let repl_state = app.state::<REPLState>();
    let mut guard = repl_state
        .0
        .lock()
        .map_err(|_| "Failed to acquire REPL lock")?;

    match guard.as_mut() {
        Some(manager) => manager.execute(&kernel_id, &code, &cell_id),
        None => Err("No kernel manager initialized".to_string()),
    }
}

#[tauri::command]
async fn repl_interrupt(app: AppHandle, kernel_id: String) -> Result<(), String> {
    let repl_state = app.state::<REPLState>();
    let mut guard = repl_state
        .0
        .lock()
        .map_err(|_| "Failed to acquire REPL lock")?;

    match guard.as_mut() {
        Some(manager) => manager.interrupt(&kernel_id),
        None => Err("No kernel manager initialized".to_string()),
    }
}

#[tauri::command]
async fn repl_shutdown_kernel(app: AppHandle, kernel_id: String) -> Result<(), String> {
    let repl_state = app.state::<REPLState>();
    let mut guard = repl_state
        .0
        .lock()
        .map_err(|_| "Failed to acquire REPL lock")?;

    match guard.as_mut() {
        Some(manager) => manager.shutdown(&kernel_id),
        None => Err("No kernel manager initialized".to_string()),
    }
}

#[tauri::command]
async fn repl_restart_kernel(app: AppHandle, kernel_id: String) -> Result<KernelInfo, String> {
    let repl_state = app.state::<REPLState>();
    let mut guard = repl_state
        .0
        .lock()
        .map_err(|_| "Failed to acquire REPL lock")?;

    match guard.as_mut() {
        Some(manager) => manager.restart(&kernel_id),
        None => Err("No kernel manager initialized".to_string()),
    }
}

#[tauri::command]
async fn repl_get_kernel(app: AppHandle, kernel_id: String) -> Result<Option<KernelInfo>, String> {
    let repl_state = app.state::<REPLState>();
    let guard = repl_state
        .0
        .lock()
        .map_err(|_| "Failed to acquire REPL lock")?;

    match guard.as_ref() {
        Some(manager) => Ok(manager.get_kernel(&kernel_id)),
        None => Ok(None),
    }
}

use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_notification::NotificationExt;

// ===== Notification Commands =====

#[tauri::command]
async fn show_notification(app: AppHandle, title: String, body: String) -> Result<(), String> {
    app.notification()
        .builder()
        .title(&title)
        .body(&body)
        .show()
        .map_err(|e| format!("Failed to show notification: {}", e))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize tracing early for debugging startup issues
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive(tracing::Level::INFO.into()),
        )
        .init();

    info!("Starting Cortex Desktop with optimized startup...");
    let startup_time = std::time::Instant::now();

    // ========== PLUGIN INITIALIZATION ==========
    // Only load essential plugins upfront
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_notification::init());

    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    let builder = builder
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_deep_link::init());

    // ========== LIGHTWEIGHT STATE INITIALIZATION ==========
    // These are cheap to create - just allocating empty containers
    // Actual heavy work (spawning processes, network connections) is deferred

    // Remote manager created but profiles loaded async in setup
    let remote_manager = Arc::new(RemoteManager::new());

    builder
        // Core server state (lightweight - just Option<None>)
        .manage(ServerState(Arc::new(Mutex::new(None))))
        .manage(LogState(Arc::new(Mutex::new(VecDeque::new()))))
        .manage(PortState(Arc::new(Mutex::new(0))))
        // Extensions - deferred loading until requested
        .manage(ExtensionsState(Arc::new(Mutex::new(
            ExtensionsManager::new(),
        ))))
        // Remote - profiles loaded async in setup
        .manage(remote_manager.clone())
        // LSP - creates channel but no servers started yet
        .manage(LspState::new())
        // REPL - Option<None>, kernel created on first use
        .manage(REPLState(Arc::new(Mutex::new(None))))
        // Debugger - empty session map, no processes started
        .manage(DebuggerState::new())
        // Toolchain - detection runs on-demand
        .manage(ToolchainState::new())
        // Auto-update - check triggered async in setup
        .manage(Arc::new(AutoUpdateState::new()))
        // Live metrics - not started until explicitly requested
        .manage(Arc::new(system_specs::LiveMetricsState::new()))
        // MCP context servers - empty, connections on-demand
        .manage(ContextServerState::new())
        // Activity tracking - empty task list
        .manage(Arc::new(ActivityState::new()))
        // Timeline / local history - empty, initialized on-demand
        .manage(Arc::new(TimelineState::new()))
        // Action log - tracks agent actions for diff/accept/reject workflows
        .manage(Arc::new(action_log::ActionLogState::new()))
        // Prompt store - loaded on-demand
        .manage(prompt_store::PromptStoreState::new())
        // ACP tools - empty registry
        .manage(acp::ACPState::new())
        // AI state - providers and threads initialized on-demand
        .manage(AIState::new())
        // AI tools - tool registry for AI agents
        .manage(AIToolsState::new())
        // Agent orchestrator state
        .manage(AgentState::new())
        // Agent store - persistent storage for custom agents
        .manage(AgentStoreState::new())
        // Terminal - no PTYs spawned until requested
        .manage(terminal::TerminalState::new())
        // Settings - defaults only, loaded async in setup
        .manage(settings::SettingsState::new())
        // File watcher - no watchers active until requested
        .manage(Arc::new(fs::FileWatcherState::new()))
        // Directory cache for parallel FS operations
        .manage(Arc::new(fs::DirectoryCache::new()))
        // IO semaphore for limiting concurrent file operations
        .manage(Arc::new(fs::IoSemaphore::new()))
        // Batch cache for IPC optimization
        .manage(Arc::new(batch::BatchCacheState::new()))
        // MCP (Model Context Protocol) for AI agent debugging
        .manage(mcp::McpState::<tauri::Wry>::new(
            mcp::McpConfig::new("Cortex Desktop").tcp("127.0.0.1", 4000),
        ))
        // WSL - Windows Subsystem for Linux integration
        .manage(wsl::WSLState::new())
        // SSH Terminal - remote SSH PTY sessions
        .manage(ssh_terminal::SSHTerminalState::new())
        // Rules Library - file watcher state
        .manage(rules_library::RulesWatcherState::new())
        // Testing - test watcher state for watch mode
        .manage(testing::TestWatcherState::new())
        // Agent Factory - workflow designer and orchestration
        .manage(factory::FactoryState::new())
        .invoke_handler(tauri::generate_handler![
            start_server,
            stop_server,
            get_server_info,
            get_logs,
            copy_logs_to_clipboard,
            get_version,
            open_in_browser,
            // Extension commands - basic management
            extensions::commands::get_extensions,
            extensions::commands::get_enabled_extensions,
            extensions::commands::get_extension,
            extensions::commands::load_extensions,
            extensions::commands::enable_extension,
            extensions::commands::disable_extension,
            extensions::commands::uninstall_extension,
            extensions::commands::install_extension_from_path,
            extensions::commands::get_extensions_directory,
            extensions::commands::open_extensions_directory,
            extensions::commands::validate_extension_manifest,
            extensions::commands::update_extension,
            // Extension commands - marketplace
            extensions::marketplace::search_marketplace,
            extensions::marketplace::get_featured_extensions,
            extensions::marketplace::install_from_marketplace,
            // Extension commands - API (themes, commands, languages, etc.)
            extensions::api::get_extension_themes,
            extensions::api::get_extension_commands,
            extensions::api::get_extension_languages,
            extensions::api::get_extension_panels,
            extensions::api::get_extension_settings,
            extensions::api::get_extension_keybindings,
            extensions::api::get_extension_snippets,
            extensions::api::execute_extension_command,
            // Remote development commands
            remote::commands::remote_connect,
            remote::commands::remote_disconnect,
            remote::commands::remote_get_status,
            remote::commands::remote_get_connections,
            remote::commands::remote_get_profiles,
            remote::commands::remote_save_profile,
            remote::commands::remote_delete_profile,
            remote::commands::remote_list_directory,
            remote::commands::remote_get_file_tree,
            remote::commands::remote_read_file,
            remote::commands::remote_write_file,
            remote::commands::remote_delete,
            remote::commands::remote_create_directory,
            remote::commands::remote_rename,
            remote::commands::remote_execute_command,
            remote::commands::remote_stat,
            remote::commands::remote_generate_profile_id,
            remote::commands::remote_get_default_key_paths,
            remote::commands::remote_connect_with_password,
            remote::commands::remote_connect_with_passphrase,
            remote::commands::remote_save_profile_with_credentials,
            remote::commands::remote_has_stored_password,
            remote::commands::remote_has_stored_passphrase,
            // LSP commands - server management
            lsp::commands::server::lsp_start_server,
            lsp::commands::server::lsp_stop_server,
            lsp::commands::server::lsp_stop_all_servers,
            lsp::commands::server::lsp_list_servers,
            lsp::commands::server::lsp_get_server_info,
            lsp::commands::server::lsp_restart,
            lsp::commands::server::lsp_get_logs,
            lsp::commands::server::lsp_clear_logs,
            lsp::commands::server::lsp_get_servers_for_language,
            // LSP commands - document sync
            lsp::commands::document::lsp_did_open,
            lsp::commands::document::lsp_did_change,
            lsp::commands::document::lsp_did_save,
            lsp::commands::document::lsp_did_close,
            // LSP commands - completion
            lsp::commands::completion::lsp_completion,
            // LSP commands - navigation
            lsp::commands::navigation::lsp_hover,
            lsp::commands::navigation::lsp_definition,
            lsp::commands::navigation::lsp_references,
            lsp::commands::navigation::lsp_type_definition,
            lsp::commands::navigation::lsp_implementation,
            // LSP commands - actions
            lsp::commands::actions::lsp_signature_help,
            lsp::commands::actions::lsp_rename,
            lsp::commands::actions::lsp_code_action,
            lsp::commands::actions::lsp_execute_command,
            // LSP commands - formatting
            lsp::commands::formatting::lsp_format,
            lsp::commands::formatting::lsp_format_range,
            // LSP commands - symbols
            lsp::commands::symbols::lsp_document_symbols,
            // Multi-provider LSP commands
            lsp::commands::multi_provider::lsp_multi_completion,
            lsp::commands::multi_provider::lsp_multi_hover,
            lsp::commands::multi_provider::lsp_multi_definition,
            lsp::commands::multi_provider::lsp_multi_references,
            lsp::commands::multi_provider::lsp_multi_type_definition,
            lsp::commands::multi_provider::lsp_multi_implementation,
            lsp::commands::multi_provider::lsp_multi_code_action,
            // CodeLens commands
            lsp::commands::code_lens::lsp_code_lens,
            lsp::commands::code_lens::lsp_multi_code_lens,
            lsp::commands::code_lens::lsp_code_lens_resolve,
            // Semantic Tokens commands
            lsp::commands::semantic_tokens::lsp_semantic_tokens,
            lsp::commands::semantic_tokens::lsp_multi_semantic_tokens,
            // Document highlights commands
            lsp::commands::features::lsp_document_highlights,
            lsp::commands::features::lsp_multi_document_highlights,
            // Document links commands
            lsp::commands::features::lsp_document_links,
            lsp::commands::features::lsp_multi_document_links,
            // Selection ranges commands
            lsp::commands::features::lsp_selection_ranges,
            // Document colors commands
            lsp::commands::features::lsp_document_colors,
            lsp::commands::features::lsp_color_presentations,
            // Folding ranges commands
            lsp::commands::features::lsp_folding_ranges,
            lsp::commands::features::lsp_multi_folding_ranges,
            // Linked editing ranges commands
            lsp::commands::features::lsp_linked_editing_ranges,
            // Inlay hints commands
            lsp::commands::features::lsp_inlay_hints,
            lsp::commands::features::lsp_multi_inlay_hints,
            // REPL commands
            repl_list_kernel_specs,
            repl_start_kernel,
            repl_list_kernels,
            repl_execute,
            repl_interrupt,
            repl_shutdown_kernel,
            repl_restart_kernel,
            repl_get_kernel,
            // Debugger commands
            dap::commands::debug_start_session,
            dap::commands::debug_stop_session,
            dap::commands::debug_get_sessions,
            dap::commands::debug_get_session_state,
            dap::commands::debug_set_breakpoints,
            dap::commands::debug_set_function_breakpoints,
            dap::commands::debug_toggle_breakpoint,
            dap::commands::debug_get_breakpoints,
            dap::commands::debug_continue,
            dap::commands::debug_pause,
            dap::commands::debug_step_over,
            dap::commands::debug_step_into,
            dap::commands::debug_step_out,
            dap::commands::debug_step_back,
            dap::commands::debug_reverse_continue,
            dap::commands::debug_restart,
            dap::commands::debug_get_threads,
            dap::commands::debug_get_stack_trace,
            dap::commands::debug_get_scopes,
            dap::commands::debug_get_variables,
            dap::commands::debug_expand_variable,
            dap::commands::debug_expand_variable_paged,
            dap::commands::debug_evaluate,
            dap::commands::debug_set_variable,
            dap::commands::debug_set_active_thread,
            dap::commands::debug_set_active_frame,
            dap::commands::debug_get_active_thread,
            dap::commands::debug_get_active_frame,
            dap::commands::debug_get_capabilities,
            // New DAP commands for disassembly, memory, and breakpoints
            dap::commands::debug_disassemble,
            dap::commands::debug_read_memory,
            dap::commands::debug_write_memory,
            dap::commands::debug_step_instruction,
            dap::commands::debug_set_instruction_breakpoint,
            dap::commands::debug_remove_instruction_breakpoint,
            dap::commands::debug_set_data_breakpoints,
            dap::commands::debug_set_exception_breakpoints,
            dap::commands::debug_completions,
            dap::commands::debug_restart_frame,
            dap::commands::debug_goto_targets,
            dap::commands::debug_goto,
            dap::commands::debug_step_in_targets,
            dap::commands::debug_step_in_target,
            dap::commands::debug_terminate_threads,
            dap::commands::debug_set_expression,
            dap::commands::debug_cancel_request,
            dap::commands::debug_loaded_sources,
            dap::commands::debug_source,
            dap::commands::debug_exception_info,
            dap::commands::debug_data_breakpoint_info,
            dap::commands::debug_modules,
            dap::commands::debug_terminate,
            dap::commands::debug_disconnect,
            dap::commands::debug_step_into_target,
            // Toolchain commands
            toolchain::commands::toolchain_detect_all,
            toolchain::commands::toolchain_detect_node,
            toolchain::commands::toolchain_detect_python,
            toolchain::commands::toolchain_detect_rust,
            toolchain::commands::toolchain_detect_project,
            toolchain::commands::toolchain_set_project,
            toolchain::commands::toolchain_get_project,
            toolchain::commands::toolchain_clear_cache,
            toolchain::commands::toolchain_get_env_for_project,
            // Formatter commands
            formatter::commands::formatter_format,
            formatter::commands::formatter_format_with,
            formatter::commands::formatter_detect_config,
            formatter::commands::formatter_check_available,
            formatter::commands::formatter_get_parser,
            // Language selector commands
            language_selector::language_detect_from_path,
            language_selector::language_detect_with_confidence,
            language_selector::language_get_all,
            language_selector::language_get_by_id,
            language_selector::language_get_by_extension,
            // Notification commands
            show_notification,
            // Auto-update commands
            auto_update::check_for_updates,
            auto_update::download_and_install_update,
            auto_update::get_update_status,
            auto_update::get_update_info,
            auto_update::dismiss_update,
            auto_update::restart_app,
            auto_update::get_app_version,
            auto_update::get_skipped_version,
            auto_update::set_skipped_version,
            // MCP Context Server commands
            // System specs commands
            system_specs::get_system_specs,
            system_specs::get_live_metrics,
            system_specs::start_live_metrics,
            system_specs::stop_live_metrics,
            system_specs::format_system_specs_for_clipboard,
            // Context server (MCP) commands
            context_server::commands::mcp_add_server,
            context_server::commands::mcp_remove_server,
            context_server::commands::mcp_list_servers,
            context_server::commands::mcp_get_server,
            context_server::commands::mcp_connect,
            context_server::commands::mcp_disconnect,
            context_server::commands::mcp_list_resources,
            context_server::commands::mcp_read_resource,
            context_server::commands::mcp_list_resource_templates,
            context_server::commands::mcp_list_tools,
            context_server::commands::mcp_call_tool,
            context_server::commands::mcp_list_prompts,
            context_server::commands::mcp_get_prompt,
            context_server::commands::mcp_query_context,
            context_server::commands::mcp_get_context_for_prompt,
            context_server::commands::mcp_ping,
            context_server::commands::mcp_set_log_level,
            // Activity Indicator commands
            activity::activity_create_task,
            activity::activity_update_task,
            activity::activity_complete_task,
            activity::activity_cancel_task,
            activity::activity_get_tasks,
            activity::activity_get_history,
            activity::activity_clear_history,
            activity::activity_get_task,
            activity::activity_set_progress,
            activity::activity_set_message,
            // Timeline / Local History commands
            timeline::timeline_init,
            timeline::timeline_get_entries,
            timeline::timeline_get_entry,
            timeline::timeline_create_snapshot,
            timeline::timeline_restore_snapshot,
            timeline::timeline_delete_entry,
            timeline::timeline_clear_file,
            timeline::timeline_clear_all,
            timeline::timeline_get_content,
            timeline::timeline_compare,
            timeline::timeline_set_label,
            timeline::timeline_get_stats,
            // Action Log commands
            action_log::action_log_entry,
            action_log::action_log_get_entries,
            action_log::action_log_track_file,
            action_log::action_log_record_edit,
            action_log::action_log_get_file_diff,
            action_log::action_log_get_tracked_files,
            action_log::action_log_accept_changes,
            action_log::action_log_reject_changes,
            action_log::action_log_untrack_file,
            action_log::action_log_clear_session,
            action_log::action_log_new_session,
            action_log::action_log_get_session,
            action_log::action_log_get_stats,
            action_log::action_log_set_config,
            action_log::action_log_get_config,
            // Diagnostics commands
            diagnostics::diagnostics_refresh,
            diagnostics::diagnostics_get_summary,
            diagnostics::write_file,
            // Rules Library commands
            rules_library::rules_scan_project,
            rules_library::rules_read_file,
            rules_library::rules_write_file,
            rules_library::rules_delete_file,
            rules_library::rules_create_file,
            rules_library::rules_get_user_dir,
            rules_library::rules_ensure_user_dir,
            rules_library::rules_watch_directory,
            rules_library::rules_unwatch_directory,
            rules_library::get_home_dir,
            // Prompt Store commands
            prompt_store::prompt_store_load,
            prompt_store::prompt_store_save,
            prompt_store::prompt_store_get,
            prompt_store::prompt_store_create,
            prompt_store::prompt_store_update,
            prompt_store::prompt_store_delete,
            prompt_store::prompt_store_export,
            prompt_store::prompt_store_import,
            prompt_store::prompt_store_get_path,
            // ACP Tools commands
            acp::commands::acp_list_tools,
            acp::commands::acp_get_tool,
            acp::commands::acp_get_tool_by_name,
            acp::commands::acp_search_tools,
            acp::commands::acp_register_tool,
            acp::commands::acp_unregister_tool,
            acp::commands::acp_update_tool,
            acp::commands::acp_execute_tool,
            acp::commands::acp_cancel_execution,
            acp::commands::acp_get_execution,
            acp::commands::acp_request_permission,
            acp::commands::acp_get_sandbox_config,
            acp::commands::acp_update_sandbox_config,
            acp::commands::acp_get_tools_for_ai,
            acp::commands::acp_handle_ai_tool_call,
            // AI commands
            ai_complete,
            ai_stream,
            ai_list_models,
            ai_get_provider_models,
            ai_configure_provider,
            ai_remove_provider,
            ai_init_threads,
            ai_create_thread,
            ai_get_thread,
            ai_list_threads,
            ai_delete_thread,
            ai_update_thread,
            ai_list_thread_summaries,
            ai_search_threads,
            ai_add_message,
            ai_get_messages,
            ai_clear_messages,
            ai_duplicate_thread,
            ai_export_thread,
            ai_import_thread,
            ai_thread_count,
            // Cortex Session commands
            cortex_create_session,
            cortex_send_message,
            cortex_approve_exec,
            cortex_cancel,
            cortex_get_status,
            cortex_list_stored_sessions,
            cortex_get_history,
            cortex_destroy_session,
            cortex_delete_session,
            cortex_update_model,
            cortex_update_cwd,
            cortex_submit_system,
            // AI tools commands
            tools_list,
            tools_execute,
            tools_execute_batch,
            tools_get,
            // Agent commands
            agent_spawn,
            agent_run_task,
            agent_cancel_task,
            agent_list,
            agent_get_status,
            agent_get_task,
            agent_list_tasks,
            agent_remove,
            agent_get_stats,
            agent_cleanup,
            agent_get_history,
            // Agent Store commands (persistent storage)
            agent_store_load,
            agent_store_save,
            agent_store_update_stats,
            agent_store_add_history,
            agent_generate_prompt,
            // AI predictions and misc commands
            ai_predict,
            submit_feedback,
            fetch_url,
            // Terminal PTY commands
            terminal::commands::terminal_create,
            terminal::commands::terminal_write,
            terminal::commands::terminal_update,
            terminal::commands::terminal_resize,
            terminal::commands::terminal_close,
            terminal::commands::terminal_list,
            terminal::commands::terminal_get,
            terminal::commands::terminal_send_interrupt,
            terminal::commands::terminal_send_eof,
            terminal::commands::terminal_ack,
            terminal::commands::terminal_close_all,
            terminal::commands::terminal_get_default_shell,
            // Port management commands
            terminal::commands::get_process_on_port,
            terminal::commands::kill_process_on_port,
            terminal::commands::list_listening_ports,
            // SSH Terminal PTY commands
            ssh_terminal::ssh_connect,
            ssh_terminal::ssh_pty_write,
            ssh_terminal::ssh_pty_resize,
            ssh_terminal::ssh_pty_ack,
            ssh_terminal::ssh_disconnect,
            ssh_terminal::ssh_get_session,
            ssh_terminal::ssh_list_sessions,
            ssh_terminal::ssh_exec,
            ssh_terminal::ssh_close_all,
            // Settings commands
            settings::commands::settings_load,
            settings::commands::settings_save,
            settings::commands::settings_get,
            settings::commands::settings_update,
            settings::commands::settings_reset,
            settings::commands::settings_reset_section,
            settings::commands::settings_get_path,
            settings::commands::settings_export,
            settings::commands::settings_import,
            settings::commands::settings_get_extension,
            settings::commands::settings_set_extension,
            // File System commands
            fs::fs_read_file,
            fs::fs_read_file_binary,
            fs::fs_write_file,
            fs::fs_write_file_binary,
            fs::fs_delete_file,
            fs::fs_create_file,
            fs::fs_create_directory,
            fs::fs_delete_directory,
            fs::fs_rename,
            fs::fs_copy_file,
            fs::fs_move,
            fs::fs_list_directory,
            fs::fs_get_file_tree,
            fs::fs_get_metadata,
            fs::fs_exists,
            fs::fs_is_file,
            fs::fs_is_directory,
            fs::fs_watch_directory,
            fs::fs_unwatch_directory,
            fs::fs_reveal_in_explorer,
            fs::fs_open_with_default,
            fs::shell_open,
            fs::fs_get_home_dir,
            fs::fs_get_documents_dir,
            fs::fs_get_desktop_dir,
            fs::fs_get_default_projects_dir,
            fs::fs_create_project,
            fs::fs_list_cortex_projects,
            fs::fs_search_files,
            fs::fs_search_content,
            fs::fs_trash,
            fs::fs_get_file_tree_shallow,
            fs::fs_prefetch_directory,
            fs::fs_clear_cache,
            fs::fs_detect_eol,
            fs::fs_convert_eol,
            // File encoding commands
            fs::fs_detect_encoding,
            fs::fs_read_file_with_encoding,
            fs::fs_write_file_with_encoding,
            fs::fs_get_supported_encodings,
            // Workspace edit support (for refactoring features)
            fs::apply_workspace_edit,
            // Batch command system for IPC optimization
            batch::batch_commands,
            batch::batch_commands_msgpack,
            batch::batch_cache_invalidate,
            batch::batch_cache_invalidate_directory,
            batch::batch_cache_stats,
            batch::batch_cache_clear,
            // MCP (Model Context Protocol) commands
            mcp::commands::mcp_get_status,
            mcp::commands::mcp_start,
            mcp::commands::mcp_stop,
            mcp::commands::mcp_get_config,
            // Git commands - status module
            git::status::git_is_repo,
            git::status::git_init,
            git::status::git_root,
            git::status::git_status,
            git::status::git_branches,
            git::status::git_remotes,
            git::status::git_remote,
            git::status::git_branch,
            git::status::git_head,
            // Git staging commands
            git::staging::git_stage,
            git::staging::git_unstage,
            git::staging::git_stage_all,
            git::staging::git_unstage_all,
            git::staging::git_commit,
            git::staging::git_is_gpg_configured,
            git::staging::git_discard,
            // Git diff commands
            git::diff::git_diff,
            // Git log commands
            git::log::git_log,
            git::log::git_get_refs,
            git::log::git_compare_branches,
            // Git stash commands
            git::stash::git_stashes,
            git::stash::git_stash_list,
            git::stash::git_stash_create,
            git::stash::git_stash_apply,
            git::stash::git_stash_pop,
            git::stash::git_stash_drop,
            git::stash::git_stash_show,
            // Git hunk staging commands
            git::hunk::git_stage_hunk,
            git::hunk::git_unstage_hunk,
            // Git bisect commands
            git::bisect::git_bisect_status,
            git::bisect::git_bisect_start,
            git::bisect::git_bisect_mark,
            git::bisect::git_bisect_reset,
            // Git cherry-pick commands
            git::cherry_pick::git_commit_files,
            git::cherry_pick::git_cherry_pick_status,
            git::cherry_pick::git_cherry_pick_start,
            git::cherry_pick::git_cherry_pick_continue,
            git::cherry_pick::git_cherry_pick_skip,
            git::cherry_pick::git_cherry_pick_abort,
            // Git rebase commands
            git::rebase::git_rebase_commits,
            git::rebase::git_rebase_status,
            git::rebase::git_rebase_start,
            git::rebase::git_rebase_continue,
            git::rebase::git_rebase_skip,
            git::rebase::git_rebase_abort,
            // Git submodule commands
            git::submodule::git_submodule_list,
            git::submodule::git_submodule_init,
            git::submodule::git_submodule_update,
            git::submodule::git_submodule_add,
            git::submodule::git_submodule_sync,
            git::submodule::git_submodule_deinit,
            // Git remote management commands
            git::remote::git_add_remote,
            git::remote::git_remove_remote,
            git::remote::git_set_remote_url,
            git::remote::git_set_remote_push_url,
            git::remote::git_rename_remote,
            // Git fetch/push/pull commands
            git::remote::git_fetch,
            git::remote::git_fetch_with_options,
            git::remote::git_push,
            git::remote::git_push_with_tags,
            git::remote::git_pull,
            git::remote::git_pull_rebase,
            // Git tag commands
            git::tag::git_list_tags,
            git::tag::git_create_tag,
            git::tag::git_delete_tag,
            git::tag::git_push_tag,
            git::tag::git_delete_remote_tag,
            git::tag::git_checkout_tag,
            // Git worktree commands
            git::worktree::git_worktree_list,
            git::worktree::git_worktree_add,
            git::worktree::git_worktree_remove,
            git::worktree::git_worktree_lock,
            git::worktree::git_worktree_unlock,
            git::worktree::git_worktree_move,
            git::worktree::git_worktree_repair,
            git::worktree::git_worktree_prune,
            // Git LFS commands
            git::lfs::git_lfs_status,
            git::lfs::git_lfs_init,
            git::lfs::git_lfs_track,
            git::lfs::git_lfs_untrack,
            git::lfs::git_lfs_track_preview,
            git::lfs::git_lfs_fetch,
            git::lfs::git_lfs_pull,
            git::lfs::git_lfs_push,
            git::lfs::git_lfs_prune,
            git::lfs::git_lfs_lock,
            git::lfs::git_lfs_unlock,
            git::lfs::git_lfs_locks,
            git::lfs::git_lfs_file_info,
            git::lfs::git_lfs_dir_summary,
            // Git clone commands
            git::clone::git_clone,
            git::clone::git_clone_recursive,
            // Git merge commands
            git::merge::git_merge,
            git::merge::git_merge_abort,
            git::merge::git_merge_continue,
            // Git branch commands
            git::branch::git_publish_branch,
            git::branch::git_set_upstream,
            git::branch::git_branch_rename,
            git::branch::git_reset_soft,
            git::branch::git_clean,
            // Git repository watcher
            git::watcher::git_watch_repository,
            // Testing commands
            testing::detection::testing_detect_framework,
            testing::discovery::testing_discover,
            testing::execution::testing_run,
            testing::single_test::testing_run_single_test,
            testing::execution::glob_files,
            testing::watch::testing_watch,
            testing::watch::testing_stop_watch,
            testing::watch::testing_stop_all_watchers,
            testing::coverage::testing_coverage,
            testing::coverage::testing_get_file_coverage,
            testing::execution::testing_run_streaming,
            // Tasks commands
            tasks::tasks_run_task,
            tasks::tasks_list,
            tasks::tasks_get_config,
            // Window management commands
            window::create_new_window,
            window::create_auxiliary_window,
            window::register_window_project,
            window::unregister_window,
            window::update_window_state,
            window::show_window,
            window::toggle_devtools,
            // WSL commands
            wsl::wsl_detect,
            wsl::wsl_connect,
            wsl::wsl_disconnect,
            wsl::wsl_execute,
            wsl::wsl_open_folder,
            wsl::wsl_open_terminal,
            wsl::wsl_get_shells,
            wsl::wsl_list_distributions,
            // Shell detection commands
            terminal::commands::terminal_detect_shells,
            terminal::commands::path_exists,
            // Browser webview commands (Tauri WebviewWindow)
            browser::browser_create,
            browser::browser_destroy,
            browser::browser_navigate,
            browser::browser_set_bounds,
            browser::browser_set_visible,
            browser::browser_list,
            browser::browser_get,
            browser::browser_focus,
            browser::browser_eval,
            browser::browser_back,
            browser::browser_forward,
            browser::browser_reload,
            // Workspace Settings commands
            workspace_settings::settings_get_workspace,
            workspace_settings::settings_set_workspace,
            workspace_settings::settings_remove_workspace,
            workspace_settings::settings_set_workspace_file,
            workspace_settings::settings_get_folder,
            workspace_settings::settings_set_folder,
            workspace_settings::settings_set_folder_file,
            workspace_settings::settings_get_language,
            workspace_settings::settings_set_language,
            workspace_settings::settings_get_effective,
            workspace_settings::settings_has_vscode_folder,
            workspace_settings::settings_ensure_vscode_folder,
            workspace_settings::settings_get_workspace_path,
            workspace_settings::settings_load_code_workspace,
            workspace_settings::settings_save_code_workspace,
            workspace_settings::settings_merge_hierarchy,
            // Agent Factory commands
            factory::commands::factory_create_workflow,
            factory::commands::factory_update_workflow,
            factory::commands::factory_delete_workflow,
            factory::commands::factory_list_workflows,
            factory::commands::factory_get_workflow,
            factory::commands::factory_export_workflow,
            factory::commands::factory_import_workflow,
            factory::commands::factory_start_workflow,
            factory::commands::factory_stop_workflow,
            factory::commands::factory_pause_workflow,
            factory::commands::factory_resume_workflow,
            factory::commands::factory_get_execution_state,
            factory::commands::factory_list_agents,
            factory::commands::factory_create_agent,
            factory::commands::factory_update_agent,
            factory::commands::factory_delete_agent,
            factory::commands::factory_get_agent_state,
            factory::commands::factory_list_pending_approvals,
            factory::commands::factory_approve_action,
            factory::commands::factory_deny_action,
            factory::commands::factory_modify_action,
            factory::commands::factory_get_audit_log,
            factory::commands::factory_export_audit_log,
            factory::commands::factory_get_audit_entry,
            // Search and Replace commands
            search::search_replace_all,
            search::search_replace_in_file,
            search::search_replace_match,
            // Notebook kernel commands
            notebook::notebook_execute_cell,
            notebook::notebook_interrupt_kernel,
            notebook::notebook_shutdown_kernel,
            notebook::notebook_start_kernel,
            // Process management commands
            process::terminate_cortex_process,
            // Additional Git commands for frontend compatibility
            git::lines::git_stage_lines,
            git::lines::git_unstage_lines,
            git::remote::git_remote_add,
            git::remote::git_remote_remove,
            git::remote::git_remote_rename,
            // Testing stop command (for stopping tests in terminal)
            testing::execution::testing_stop,
            // WASM extension runtime commands
            extensions::wasm::load_wasm_extension,
            extensions::wasm::unload_wasm_extension,
            extensions::wasm::execute_wasm_command,
            extensions::wasm::get_wasm_runtime_states,
            // Profile management commands
            settings::profiles::profiles_save,
            settings::profiles::profiles_load,
            // Remote port forwarding commands
            remote::commands::remote_forward_port,
            remote::commands::remote_stop_forward,
            remote::commands::tunnel_close,
            // DevContainer commands (stub implementations)
            remote::commands::devcontainer_connect,
            remote::commands::devcontainer_start,
            remote::commands::devcontainer_stop,
            remote::commands::devcontainer_remove,
            remote::commands::devcontainer_build,
            remote::commands::devcontainer_load_config,
            remote::commands::devcontainer_save_config,
            remote::commands::devcontainer_list_features,
            remote::commands::devcontainer_list_templates,
            // SSH profile management commands
            ssh_terminal::ssh_save_profile,
            ssh_terminal::ssh_delete_profile,
            ssh_terminal::ssh_generate_profile_id,
            ssh_terminal::ssh_list_profiles,
            // Rules file save command (alias for write)
            rules_library::rules_save_file,
        ])
        .setup(move |app| {
            app.manage(window::WindowManagerState::new());

            let app_handle = app.handle().clone();

            // NOTE: window::restore_windows is now async and called in the parallel init block below

            // ========== DEEP LINK HANDLING ==========
            // Handle deep links that launched the app (desktop only)
            #[cfg(not(any(target_os = "android", target_os = "ios")))]
            {
                use tauri_plugin_deep_link::DeepLinkExt;

                // Handle any URLs that were used to launch the app
                let app_handle_for_deep_link = app_handle.clone();
                tauri::async_runtime::spawn(async move {
                    // Small delay to ensure frontend is ready
                    tokio::time::sleep(std::time::Duration::from_millis(500)).await;

                    if let Ok(Some(urls)) = app_handle_for_deep_link.deep_link().get_current() {
                        let url_strings: Vec<String> = urls.iter().map(|u| u.to_string()).collect();
                        if !url_strings.is_empty() {
                            info!("Handling initial deep links: {:?}", url_strings);
                            deep_link::handle_deep_link(&app_handle_for_deep_link, url_strings);
                        }
                    }
                });

                // Register listener for future deep links while app is running
                let app_handle_for_listener = app_handle.clone();
                app.deep_link().on_open_url(move |event| {
                    let urls: Vec<String> = event.urls().iter().map(|u| u.to_string()).collect();
                    info!("Received deep link while running: {:?}", urls);
                    deep_link::handle_deep_link(&app_handle_for_listener, urls);
                });
            }

            let remote_manager_for_setup = remote_manager.clone();

            // ========== PARALLEL INITIALIZATION ==========
            // Use tokio::spawn to run initialization tasks concurrently
            // This significantly reduces startup time by parallelizing independent operations
            // All tasks run in parallel using tokio::join! for maximum performance

            tauri::async_runtime::spawn(async move {
                // Run all independent initialization tasks in parallel using tokio::join!
                let (
                    _windows_result,
                    _settings_result,
                    _extensions_result,
                    _lsp_result,
                    _profiles_result,
                    _update_result,
                    _ai_result,
                    _mcp_result,
                ) = tokio::join!(
                    // Task 1: Restore windows (async file I/O)
                    async {
                        window::restore_windows(&app_handle).await;
                        info!("Windows restored");
                    },
                    // Task 2: Preload settings from disk (async file I/O)
                    async {
                        if let Err(e) = settings::preload_settings(&app_handle).await {
                            warn!("Failed to preload settings: {}", e);
                        }
                    },
                    // Task 3: Preload extensions (sync but wrapped)
                    async {
                        let app_for_ext = app_handle.clone();
                        if let Err(e) = tokio::task::spawn_blocking(move || {
                            extensions::preload_extensions(&app_for_ext)
                        })
                        .await
                        .unwrap_or_else(|e| Err(format!("Task join error: {}", e)))
                        {
                            warn!("Failed to preload extensions: {}", e);
                        }
                    },
                    // Task 4: Setup LSP event listeners (fast, just wires up channels)
                    async {
                        lsp::setup_lsp_events(&app_handle);
                        info!("LSP event listeners initialized");
                    },
                    // Task 5: Load SSH profiles from disk (may involve I/O)
                    async {
                        if let Err(e) = remote_manager_for_setup.load_profiles().await {
                            warn!("Failed to load SSH profiles: {}", e);
                        } else {
                            info!("SSH profiles loaded");
                        }
                    },
                    // Task 6: Initialize auto-update and check for updates (network I/O, NO delay)
                    async {
                        auto_update::init_auto_update(&app_handle, true);
                        info!("Auto-update initialized");
                    },
                    // Task 7: Initialize AI providers from saved settings
                    async {
                        let ai_state = app_handle.state::<AIState>();
                        if let Err(e) = ai_state.initialize_from_settings(&app_handle).await {
                            warn!("Failed to initialize AI providers: {}", e);
                        } else {
                            info!("AI providers initialized");
                        }
                    },
                    // Task 8: Start MCP socket server for AI agent debugging
                    async {
                        #[cfg(debug_assertions)]
                        {
                            let mcp_state = app_handle.state::<mcp::McpState<tauri::Wry>>();
                            if let Err(e) = mcp_state.start(&app_handle) {
                                warn!("Failed to start MCP server: {}", e);
                            } else {
                                info!("MCP socket server started on port 4000");
                            }
                        }
                    }
                );

                // Log parallel initialization completion
                info!("Parallel initialization completed");

                // Emit backend:ready event to signal frontend that preloading is complete
                // This allows the frontend to skip redundant IPC calls
                if let Err(e) = app_handle.emit(
                    "backend:ready",
                    serde_json::json!({
                        "preloaded": ["settings", "extensions", "ai_providers", "windows"]
                    }),
                ) {
                    warn!("Failed to emit backend:ready event: {}", e);
                } else {
                    info!("Backend ready - all data preloaded");
                }
            });

            // Log startup time for performance monitoring
            info!("Setup phase completed in {:?}", startup_time.elapsed());

            // Show window after setup is complete (if using visible: false in config)
            if let Some(window) = app.get_webview_window("main") {
                // Vibrancy disabled - using solid JetBrains-style background
                // To re-enable vibrancy, uncomment the code below and set transparent: true in tauri.conf.json
                /*
                #[cfg(target_os = "windows")]
                {
                    use window_vibrancy::apply_acrylic;
                    match apply_acrylic(&window, Some((18, 18, 18, 180))) {
                        Ok(_) => info!("Acrylic blur effect applied successfully"),
                        Err(e) => error!("Failed to apply acrylic effect: {:?}", e),
                    }
                }

                #[cfg(target_os = "macos")]
                {
                    use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};
                    if let Err(e) = apply_vibrancy(&window, NSVisualEffectMaterial::HudWindow, None, None) {
                        warn!("Failed to apply vibrancy effect: {}", e);
                    } else {
                        info!("macOS vibrancy effect applied");
                    }
                }
                */

                show_main_window(&window);
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { .. } = event {
                let label = window.label();
                let app = window.app_handle();
                window::remove_window_session(app, label);
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            match event {
                RunEvent::Ready => {
                    info!("Application ready");
                }
                RunEvent::WindowEvent {
                    label,
                    event: tauri::WindowEvent::Destroyed,
                    ..
                } => {
                    // Exit app when all windows are closed
                    let windows = app.webview_windows();
                    if windows.is_empty() || (windows.len() == 1 && windows.contains_key(&label)) {
                        info!("All windows closed, exiting application");
                        app.exit(0);
                    }
                }
                RunEvent::ExitRequested { .. } => {
                    // Set exiting flag to preserve window sessions
                    let window_state = app.state::<window::WindowManagerState>();
                    if let Ok(mut exiting) = window_state.is_exiting.lock() {
                        *exiting = true;
                    }

                    info!("Application exit requested, cleaning up all child processes...");

                    // Close all terminals when the app exits
                    let terminal_state = app.state::<terminal::TerminalState>();
                    let _ = terminal_state.close_all(app);
                    info!("All terminals closed on app exit");

                    // Close all SSH sessions
                    let ssh_state = app.state::<ssh_terminal::SSHTerminalState>();
                    let _ = ssh_state.close_all(app);
                    info!("All SSH sessions closed on app exit");

                    // Stop all LSP servers
                    let lsp_state = app.state::<LspState>();
                    let _ = lsp_state.stop_all_servers();
                    info!("All LSP servers stopped on app exit");

                    // Stop all debugger sessions
                    let debugger_state = app.state::<DebuggerState>();
                    debugger_state.stop_all_sessions();
                    info!("All debugger sessions stopped on app exit");

                    // Disconnect all MCP context servers
                    let context_server_state = app.state::<ContextServerState>();
                    context_server_state.disconnect_all();
                    info!("All context servers disconnected on app exit");

                    // Stop all test watchers
                    let test_watcher_state = app.state::<testing::TestWatcherState>();
                    let _ = test_watcher_state.stop_all();
                    info!("All test watchers stopped on app exit");

                    // Stop live metrics if running
                    {
                        let live_metrics_state = app.state::<Arc<system_specs::LiveMetricsState>>();
                        live_metrics_state.stop();
                        info!("Live metrics stopped on app exit");
                    }

                    // Shutdown all REPL kernels
                    if let Ok(mut guard) = app.state::<REPLState>().0.lock() {
                        if let Some(manager) = guard.as_mut() {
                            manager.shutdown_all();
                            info!("All REPL kernels shut down on app exit");
                        }
                    }

                    // Stop the MCP socket server (debug only)
                    #[cfg(debug_assertions)]
                    {
                        let mcp_state = app.state::<mcp::McpState<tauri::Wry>>();
                        let _ = mcp_state.stop();
                        info!("MCP socket server stopped on app exit");
                    }

                    // Stop the WASM extension runtime when the app exits
                    if let Ok(manager) = app.state::<ExtensionsState>().0.lock() {
                        manager.wasm_runtime.unload_all();
                        info!("WASM extension runtime stopped on app exit");
                    }

                    info!("All child processes cleaned up, exiting application");
                }
                _ => {}
            }
        });
}
