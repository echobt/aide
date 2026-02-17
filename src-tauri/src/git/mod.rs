//! Git operations module.
//!
//! This module provides comprehensive Git functionality for the Cortex GUI application,
//! including repository status, staging, commits, branches, remotes, rebasing, cherry-picking,
//! bisecting, LFS support, worktrees, and more.

pub mod bisect;
pub mod blame;
pub mod branch;
pub(crate) mod cache;
pub mod cherry_pick;
pub mod clone;
pub(crate) mod command;
pub mod diff;
pub(crate) mod helpers;
pub mod hunk;
pub mod lfs;
pub mod lines;
pub mod log;
pub mod merge;
pub mod providers;
pub mod rebase;
pub mod remote;
pub mod staging;
pub mod stash;
pub mod status;
pub mod submodule;
pub mod tag;
pub mod types;
pub mod watcher;
pub mod worktree;
