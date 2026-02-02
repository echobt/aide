//! Windows Sandbox utilities for Cortex GUI
//!
//! This module provides Windows-specific sandboxing capabilities including:
//! - Capability SID generation and management
//! - Restricted token creation for sandbox isolation
//! - Environment variable handling for network blocking
//! - ACL (Access Control List) manipulation
//! - User management for sandbox isolation
//!
//! # Safety
//! This module uses Windows APIs through windows-sys which require unsafe blocks.
//! All unsafe operations are carefully documented and validated.

#[cfg(windows)]
mod acl;
#[cfg(windows)]
mod audit;
#[cfg(windows)]
mod cap;
#[cfg(windows)]
mod dpapi;
#[cfg(windows)]
mod env;
#[cfg(windows)]
mod identity;
#[cfg(windows)]
mod process;
#[cfg(windows)]
mod sandbox_users;
#[cfg(windows)]
mod token;
#[cfg(windows)]
mod winutil;

#[cfg(windows)]
pub use acl::*;
#[cfg(windows)]
pub use audit::*;
#[cfg(windows)]
pub use cap::*;
#[cfg(windows)]
pub use dpapi::*;
#[cfg(windows)]
pub use env::*;
#[cfg(windows)]
pub use identity::*;
#[cfg(windows)]
pub use process::*;
#[cfg(windows)]
pub use sandbox_users::*;
#[cfg(windows)]
pub use token::*;
#[cfg(windows)]
pub use winutil::*;
