//! Sub-Agent Orchestration System
//!
//! This module provides agent management with support for:
//! - Runtime agent orchestration (spawn, run tasks, cancel)
//! - Persistent agent storage (OS-specific directories)
//! - AI-powered prompt generation

mod commands;
mod orchestrator;
mod prompt_generation;
mod storage;
mod storage_types;
mod types;

// Re-export orchestrator
pub use orchestrator::AgentState;

// Re-export storage
pub use storage::AgentStoreState;

// Re-export runtime commands
pub use commands::{
    agent_cancel_task, agent_cleanup, agent_get_history, agent_get_stats, agent_get_status,
    agent_get_task, agent_list, agent_list_tasks, agent_remove, agent_run_task, agent_spawn,
};

// Re-export storage commands
pub use storage::{
    agent_store_add_history, agent_store_load, agent_store_save, agent_store_update_stats,
};

// Re-export prompt generation
pub use prompt_generation::agent_generate_prompt;
