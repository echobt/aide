//! Extension type definitions and manifest schemas.
//!
//! This module contains all the data structures used to represent extensions,
//! their manifests, and their contributions.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

/// Extension manifest schema - defines the structure of extension.json
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtensionManifest {
    /// Unique identifier for the extension
    pub name: String,
    /// Semantic version string
    pub version: String,
    /// Human-readable description
    pub description: String,
    /// Extension author
    pub author: String,
    /// Main entry point (JavaScript file for legacy extensions)
    #[serde(default)]
    pub main: Option<String>,
    /// WASM entry point (compiled .wasm file)
    #[serde(default)]
    pub wasm: Option<String>,
    /// WIT world name for the WASM module
    #[serde(default)]
    pub wit_world: Option<String>,
    /// Extension contributions
    #[serde(default)]
    pub contributes: ExtensionContributes,
    /// Extension icon path (relative to extension directory)
    #[serde(default)]
    pub icon: Option<String>,
    /// Extension repository URL
    #[serde(default)]
    pub repository: Option<String>,
    /// Minimum Cortex Desktop version required
    #[serde(default)]
    pub engines: Option<EngineRequirements>,
    /// Extension keywords for search
    #[serde(default)]
    pub keywords: Vec<String>,
    /// Extension license
    #[serde(default)]
    pub license: Option<String>,
}

/// Engine requirements for compatibility checking
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[allow(non_snake_case)]
pub struct EngineRequirements {
    /// Minimum Cortex Desktop version
    #[serde(default)]
    pub Cortex: Option<String>,
}

/// Extension contributions - what the extension provides
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ExtensionContributes {
    /// Theme contributions
    #[serde(default)]
    pub themes: Vec<ThemeContribution>,
    /// Language contributions (syntax highlighting)
    #[serde(default)]
    pub languages: Vec<LanguageContribution>,
    /// Command contributions
    #[serde(default)]
    pub commands: Vec<CommandContribution>,
    /// Panel contributions
    #[serde(default)]
    pub panels: Vec<PanelContribution>,
    /// Settings contributions
    #[serde(default)]
    pub settings: Vec<SettingsContribution>,
    /// Keybinding contributions
    #[serde(default)]
    pub keybindings: Vec<KeybindingContribution>,
    /// Snippet contributions
    #[serde(default)]
    pub snippets: Vec<SnippetContribution>,
}

/// Theme contribution definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThemeContribution {
    /// Theme identifier
    pub id: String,
    /// Display label
    pub label: String,
    /// Path to theme JSON file
    pub path: String,
    /// UI theme type: "dark" or "light"
    #[serde(rename = "uiTheme", default = "default_ui_theme")]
    pub ui_theme: String,
}

fn default_ui_theme() -> String {
    "dark".to_string()
}

/// Language contribution definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LanguageContribution {
    /// Language identifier
    pub id: String,
    /// Display name
    pub name: String,
    /// File extensions associated with this language
    #[serde(default)]
    pub extensions: Vec<String>,
    /// File aliases
    #[serde(default)]
    pub aliases: Vec<String>,
    /// Path to TextMate grammar file
    #[serde(default)]
    pub grammar: Option<String>,
    /// Path to language configuration file
    #[serde(default)]
    pub configuration: Option<String>,
    /// MIME types
    #[serde(rename = "mimetypes", default)]
    pub mime_types: Vec<String>,
}

/// Command contribution definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandContribution {
    /// Command identifier
    pub command: String,
    /// Display title
    pub title: String,
    /// Category for grouping
    #[serde(default)]
    pub category: Option<String>,
    /// Icon path or icon identifier
    #[serde(default)]
    pub icon: Option<String>,
    /// Enablement condition
    #[serde(default)]
    pub enablement: Option<String>,
}

/// Panel contribution definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PanelContribution {
    /// Panel identifier
    pub id: String,
    /// Display title
    pub title: String,
    /// Icon path or identifier
    #[serde(default)]
    pub icon: Option<String>,
    /// Panel location: "left", "right", "bottom"
    #[serde(default = "default_panel_location")]
    pub location: String,
    /// Path to panel component
    #[serde(default)]
    pub component: Option<String>,
}

fn default_panel_location() -> String {
    "left".to_string()
}

/// Settings contribution definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettingsContribution {
    /// Settings group title
    pub title: String,
    /// Settings properties
    pub properties: HashMap<String, SettingsProperty>,
}

/// Individual setting property
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettingsProperty {
    /// Setting type: "string", "boolean", "number", "array", "object"
    #[serde(rename = "type")]
    pub property_type: String,
    /// Default value
    #[serde(default)]
    pub default: Option<serde_json::Value>,
    /// Setting description
    #[serde(default)]
    pub description: Option<String>,
    /// Enum values (for dropdown)
    #[serde(rename = "enum", default)]
    pub enum_values: Option<Vec<serde_json::Value>>,
    /// Enum descriptions
    #[serde(rename = "enumDescriptions", default)]
    pub enum_descriptions: Option<Vec<String>>,
}

/// Keybinding contribution definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeybindingContribution {
    /// Associated command
    pub command: String,
    /// Key combination
    pub key: String,
    /// macOS key combination override
    #[serde(default)]
    pub mac: Option<String>,
    /// When condition
    #[serde(default)]
    pub when: Option<String>,
}

/// Snippet contribution definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SnippetContribution {
    /// Language scope
    pub language: String,
    /// Path to snippets file
    pub path: String,
}

/// Extension runtime state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Extension {
    /// Extension manifest
    pub manifest: ExtensionManifest,
    /// Path to extension directory
    pub path: PathBuf,
    /// Whether the extension is enabled
    pub enabled: bool,
    /// Installation source
    #[serde(default)]
    pub source: ExtensionSource,
}

/// Extension installation source
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum ExtensionSource {
    #[default]
    Local,
    Marketplace,
    Git,
}

/// Theme definition loaded from extension
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtensionTheme {
    /// Theme identifier
    pub id: String,
    /// Display name
    pub name: String,
    /// Extension that provides this theme
    pub extension_name: String,
    /// Theme type
    pub ui_theme: String,
    /// Theme colors and tokens
    pub colors: serde_json::Value,
}

/// Marketplace extension listing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketplaceExtension {
    pub name: String,
    pub version: String,
    pub description: String,
    pub author: String,
    pub downloads: u64,
    pub rating: f32,
    pub icon_url: Option<String>,
    pub repository_url: Option<String>,
    pub download_url: String,
    pub categories: Vec<String>,
    pub updated_at: String,
}
