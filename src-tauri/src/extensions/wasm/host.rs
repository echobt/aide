//! Host functions exposed to WASM extensions.
//!
//! These functions are callable from within the WASM sandbox and provide
//! controlled access to Cortex Desktop capabilities.

use tracing::{debug, info, warn};

pub fn host_log(level: u32, message: &str) {
    match level {
        0 => debug!("[WasmExt] {}", message),
        1 => debug!("[WasmExt] {}", message),
        2 => info!("[WasmExt] {}", message),
        3 => warn!("[WasmExt] {}", message),
        4 => tracing::error!("[WasmExt] {}", message),
        _ => info!("[WasmExt] {}", message),
    }
}

pub fn host_get_config(_key: &str) -> Option<String> {
    None
}

pub fn host_show_message(level: u32, message: &str) {
    match level {
        0 => info!("[WasmExt:Info] {}", message),
        1 => warn!("[WasmExt:Warn] {}", message),
        2 => tracing::error!("[WasmExt:Error] {}", message),
        _ => info!("[WasmExt:Msg] {}", message),
    }
}
