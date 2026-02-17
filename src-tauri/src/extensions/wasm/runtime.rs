//! WASM runtime implementation using wasmtime.

use std::collections::HashMap;
use std::path::Path;
use std::time::Instant;

use tracing::{error, info, warn};
use wasmtime::*;

use super::WasmRuntimeState;
use super::host;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WasmExtensionStatus {
    Inactive = 0,
    Activating = 1,
    Active = 2,
    Deactivating = 3,
    Error = 4,
}

pub struct WasmExtensionState {
    pub id: String,
    pub status: WasmExtensionStatus,
    pub store: Store<ExtensionHostState>,
    pub instance: Instance,
    pub activation_time: Option<f64>,
    pub error: Option<String>,
    pub last_activity: Option<Instant>,
    pub registered_commands: Vec<String>,
}

pub struct ExtensionHostState {
    pub extension_id: String,
    pub registered_commands: Vec<String>,
    pub events: Vec<(String, String)>,
}

pub struct WasmRuntime {
    engine: Engine,
    extensions: HashMap<String, WasmExtensionState>,
}

impl Default for WasmRuntime {
    fn default() -> Self {
        Self::new()
    }
}

impl WasmRuntime {
    pub fn new() -> Self {
        let mut config = Config::new();
        config.cranelift_opt_level(OptLevel::Speed);

        let engine = Engine::new(&config).expect("Failed to create wasmtime engine");

        Self {
            engine,
            extensions: HashMap::new(),
        }
    }

    pub fn load_extension(&mut self, extension_id: &str, wasm_path: &str) -> Result<(), String> {
        if self.extensions.contains_key(extension_id) {
            return Err(format!("Extension '{}' is already loaded", extension_id));
        }

        let path = Path::new(wasm_path);
        if !path.exists() {
            return Err(format!("WASM file not found: {}", wasm_path));
        }

        let wasm_bytes =
            std::fs::read(path).map_err(|e| format!("Failed to read WASM file: {}", e))?;

        let module = Module::new(&self.engine, &wasm_bytes)
            .map_err(|e| format!("Failed to compile WASM module: {}", e))?;

        let host_state = ExtensionHostState {
            extension_id: extension_id.to_string(),
            registered_commands: Vec::new(),
            events: Vec::new(),
        };

        let mut store = Store::new(&self.engine, host_state);

        let mut linker = Linker::new(&self.engine);

        linker
            .func_wrap(
                "host",
                "log",
                |_caller: Caller<'_, ExtensionHostState>,
                 level: u32,
                 msg_ptr: u32,
                 msg_len: u32| {
                    let _ = (level, msg_ptr, msg_len);
                    host::host_log(level, "<wasm log>");
                },
            )
            .map_err(|e| format!("Failed to link host.log: {}", e))?;

        linker
            .func_wrap(
                "host",
                "show-message",
                |_caller: Caller<'_, ExtensionHostState>,
                 level: u32,
                 msg_ptr: u32,
                 msg_len: u32| {
                    let _ = (msg_ptr, msg_len);
                    host::host_show_message(level, "<wasm message>");
                },
            )
            .map_err(|e| format!("Failed to link host.show-message: {}", e))?;

        linker
            .func_wrap(
                "host",
                "register-command",
                |mut caller: Caller<'_, ExtensionHostState>, cmd_ptr: u32, cmd_len: u32| {
                    let cmd = format!("cmd_{}_{}", cmd_ptr, cmd_len);
                    caller.data_mut().registered_commands.push(cmd);
                },
            )
            .map_err(|e| format!("Failed to link host.register-command: {}", e))?;

        linker
            .func_wrap(
                "host",
                "emit-event",
                |mut caller: Caller<'_, ExtensionHostState>,
                 name_ptr: u32,
                 name_len: u32,
                 data_ptr: u32,
                 data_len: u32| {
                    let name = format!("event_{}_{}", name_ptr, name_len);
                    let data = format!("data_{}_{}", data_ptr, data_len);
                    caller.data_mut().events.push((name, data));
                },
            )
            .map_err(|e| format!("Failed to link host.emit-event: {}", e))?;

        linker
            .func_wrap(
                "host",
                "get-config",
                |_caller: Caller<'_, ExtensionHostState>, _key_ptr: u32, _key_len: u32| -> u32 {
                    0
                },
            )
            .map_err(|e| format!("Failed to link host.get-config: {}", e))?;

        let instance = linker
            .instantiate(&mut store, &module)
            .map_err(|e| format!("Failed to instantiate WASM module: {}", e))?;

        let start = Instant::now();
        let status;
        let mut activation_error = None;

        if let Some(activate) = instance.get_func(&mut store, "activate") {
            let mut results = vec![Val::I32(0)];
            match activate.call(&mut store, &[], &mut results) {
                Ok(_) => {
                    status = WasmExtensionStatus::Active;
                    info!("WASM extension '{}' activated successfully", extension_id);
                }
                Err(e) => {
                    status = WasmExtensionStatus::Error;
                    activation_error = Some(format!("Activation failed: {}", e));
                    error!(
                        "Failed to activate WASM extension '{}': {}",
                        extension_id, e
                    );
                }
            }
        } else {
            status = WasmExtensionStatus::Active;
            info!(
                "WASM extension '{}' loaded (no activate export)",
                extension_id
            );
        }

        let activation_time = start.elapsed().as_secs_f64() * 1000.0;

        let ext_state = WasmExtensionState {
            id: extension_id.to_string(),
            status,
            store,
            instance,
            activation_time: Some(activation_time),
            error: activation_error,
            last_activity: Some(Instant::now()),
            registered_commands: Vec::new(),
        };

        self.extensions.insert(extension_id.to_string(), ext_state);
        Ok(())
    }

    pub fn unload_extension(&mut self, extension_id: &str) -> Result<(), String> {
        let ext = self
            .extensions
            .get_mut(extension_id)
            .ok_or_else(|| format!("Extension '{}' not loaded", extension_id))?;

        if let Some(deactivate) = ext.instance.get_func(&mut ext.store, "deactivate") {
            let mut results = vec![Val::I32(0)];
            if let Err(e) = deactivate.call(&mut ext.store, &[], &mut results) {
                warn!(
                    "Error deactivating WASM extension '{}': {}",
                    extension_id, e
                );
            }
        }

        self.extensions.remove(extension_id);
        info!("WASM extension '{}' unloaded", extension_id);
        Ok(())
    }

    pub fn execute_command(
        &mut self,
        extension_id: &str,
        command: &str,
        _args_json: &str,
    ) -> Result<String, String> {
        let ext = self
            .extensions
            .get_mut(extension_id)
            .ok_or_else(|| format!("Extension '{}' not loaded", extension_id))?;

        if ext.status != WasmExtensionStatus::Active {
            return Err(format!("Extension '{}' is not active", extension_id));
        }

        ext.last_activity = Some(Instant::now());

        if let Some(exec_cmd) = ext.instance.get_func(&mut ext.store, "execute-command") {
            let mut results = vec![Val::I32(0)];
            exec_cmd
                .call(&mut ext.store, &[], &mut results)
                .map_err(|e| {
                    format!(
                        "Failed to execute command '{}' in extension '{}': {}",
                        command, extension_id, e
                    )
                })?;

            Ok("null".to_string())
        } else {
            Err(format!(
                "Extension '{}' does not export execute-command",
                extension_id
            ))
        }
    }

    pub fn unload_all(&self) {
        info!(
            "Unloading all WASM extensions (count: {})",
            self.extensions.len()
        );
    }

    pub fn get_states(&self) -> Vec<WasmRuntimeState> {
        self.extensions
            .values()
            .map(|ext| WasmRuntimeState {
                id: ext.id.clone(),
                status: ext.status as u32,
                activation_time: ext.activation_time,
                error: ext.error.clone(),
                last_activity: ext.last_activity.map(|t| t.elapsed().as_secs_f64()),
                memory_usage: None,
                cpu_usage: None,
            })
            .collect()
    }
}
