//! Cortex Desktop Extension System
//!
//! This module provides the extension management system for Cortex Desktop,
//! including loading, installing, enabling/disabling, and managing extensions.

pub mod api;
pub mod commands;
pub mod host;
pub mod marketplace;
pub mod state;
pub mod types;
pub mod utils;
pub mod vscode;

// Re-export state types
pub use state::{ExtensionsManager, ExtensionsState};

// Re-export preload_extensions for lib.rs setup
pub use commands::preload_extensions;
