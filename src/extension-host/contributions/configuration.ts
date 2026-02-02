/**
 * Configuration Contribution System
 *
 * Provides a complete system for extensions to contribute configuration settings
 * to Cortex IDE. This mirrors VS Code's configuration contribution model.
 *
 * Features:
 * - Register configuration schemas
 * - JSON Schema validation
 * - Configuration scopes (application, machine, window, resource)
 * - Merge with existing settings
 * - Change event notifications
 * - Default value resolution
 *
 * @module extension-host/contributions/configuration
 */

import {
  Disposable,
  DisposableStore,
  EventEmitter,
  Event,
  createDisposable,
} from "../types";

import {
  type JSONSchema,
  validateSetting,
  getSchemaDefault,
  type ValidationResult,
} from "../../utils/settingsValidation";

import type {
  ConfigurationScope,
  ConfigurationTarget,
  SettingRegistration,
  SettingChangeEvent,
} from "../../types/settings";

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration property definition following JSON Schema with VS Code extensions.
 */
export interface ConfigurationPropertySchema extends JSONSchema {
  /** Unique setting identifier (e.g., "myExtension.enableFeature") */
  id?: string;
  /** Configuration scope determining where setting can be applied */
  scope?: ConfigurationScope;
  /** Allowed values for enum-style settings */
  enum?: unknown[];
  /** Descriptions for each enum value */
  enumDescriptions?: string[];
  /** Items marked as deprecated and descriptions for each */
  enumItemLabels?: string[];
  /** Tags for categorization and search */
  tags?: string[];
  /** Display order within the settings category */
  order?: number;
  /** Message shown when setting is deprecated */
  deprecationMessage?: string;
  /** Markdown description (supports links, formatting) */
  markdownDescription?: string;
  /** How string settings should be edited */
  editPresentation?: "singlelineText" | "multilineText";
  /** Restricted setting - cannot be set in workspace */
  restricted?: boolean;
  /** Settings that must be set for this setting to take effect */
  included?: string[];
  /** This setting is only applicable when another setting has a certain value */
  disallowSyncIgnore?: boolean;
  /** Custom error message for pattern validation */
  patternErrorMessage?: string;
}

/**
 * Configuration node (category/section) definition.
 */
export interface ConfigurationNode {
  /** Node identifier (e.g., "myExtension") */
  id?: string;
  /** Display title */
  title: string;
  /** Sort order */
  order?: number;
  /** Properties in this node */
  properties?: Record<string, ConfigurationPropertySchema>;
}

/**
 * Full configuration contribution from an extension.
 */
export interface ConfigurationContribution {
  /** Configuration nodes/sections */
  configurations: ConfigurationNode[];
}

/**
 * Registered configuration with metadata.
 */
export interface RegisteredConfiguration {
  /** Extension ID that registered this configuration */
  extensionId: string;
  /** Configuration node ID */
  nodeId: string;
  /** Display title */
  title: string;
  /** Sort order */
  order: number;
  /** Properties in this configuration */
  properties: Map<string, RegisteredConfigurationProperty>;
  /** Registration timestamp */
  registeredAt: number;
}

/**
 * Registered configuration property with full metadata.
 */
export interface RegisteredConfigurationProperty {
  /** Full setting key (e.g., "myExtension.enableFeature") */
  key: string;
  /** JSON Schema for validation */
  schema: ConfigurationPropertySchema;
  /** Default value */
  defaultValue: unknown;
  /** Configuration scope */
  scope: ConfigurationScope;
  /** Extension that registered this property */
  extensionId: string;
  /** Registration timestamp */
  registeredAt: number;
}

/**
 * Configuration change event data.
 */
export interface ConfigurationChangedEvent {
  /** Keys that changed */
  affectedKeys: string[];
  /** Source of the change */
  source: ConfigurationTarget;
}

/**
 * Options for registering a configuration.
 */
export interface ConfigurationRegistrationOptions {
  /** Configuration node/section ID */
  id?: string;
  /** Display title for the section */
  title: string;
  /** Sort order in settings UI */
  order?: number;
  /** Configuration properties */
  properties: Record<string, ConfigurationPropertySchema>;
}

// ============================================================================
// Configuration Registry
// ============================================================================

/**
 * Configuration contribution registry.
 * Manages registration and lifecycle of configuration schemas.
 */
export class ConfigurationContributionRegistry implements Disposable {
  private readonly _disposables = new DisposableStore();

  /** Map of registered configuration nodes by ID */
  private readonly _configurations = new Map<string, RegisteredConfiguration>();

  /** Map of all registered properties by key */
  private readonly _properties = new Map<string, RegisteredConfigurationProperty>();

  /** Map of extension ID to configuration node IDs */
  private readonly _extensionConfigurations = new Map<string, Set<string>>();

  /** Current configuration values (merged) */
  private readonly _values = new Map<string, unknown>();

  /** Default values from schemas */
  private readonly _defaults = new Map<string, unknown>();

  /** User values (user settings) */
  private readonly _userValues = new Map<string, unknown>();

  /** Workspace values (workspace settings) */
  private readonly _workspaceValues = new Map<string, unknown>();

  /** Resource values (folder-specific settings) */
  private readonly _resourceValues = new Map<string, Map<string, unknown>>();

  // Event emitters
  private readonly _onDidRegisterConfiguration = new EventEmitter<RegisteredConfiguration>();
  private readonly _onDidUnregisterConfiguration = new EventEmitter<string>();
  private readonly _onDidChangeConfiguration = new EventEmitter<ConfigurationChangedEvent>();
  private readonly _onDidChangeDefaults = new EventEmitter<string[]>();

  private _idCounter = 0;

  constructor() {
    this._disposables.add(this._onDidRegisterConfiguration);
    this._disposables.add(this._onDidUnregisterConfiguration);
    this._disposables.add(this._onDidChangeConfiguration);
    this._disposables.add(this._onDidChangeDefaults);
  }

  // ============================================================================
  // Events
  // ============================================================================

  /**
   * Event fired when a configuration is registered.
   */
  get onDidRegisterConfiguration(): Event<RegisteredConfiguration> {
    return this._onDidRegisterConfiguration.event;
  }

  /**
   * Event fired when a configuration is unregistered.
   */
  get onDidUnregisterConfiguration(): Event<string> {
    return this._onDidUnregisterConfiguration.event;
  }

  /**
   * Event fired when configuration values change.
   */
  get onDidChangeConfiguration(): Event<ConfigurationChangedEvent> {
    return this._onDidChangeConfiguration.event;
  }

  /**
   * Event fired when default values change (due to schema registration).
   */
  get onDidChangeDefaults(): Event<string[]> {
    return this._onDidChangeDefaults.event;
  }

  // ============================================================================
  // Configuration Registration
  // ============================================================================

  /**
   * Register a configuration contribution.
   *
   * @param extensionId - The ID of the extension registering the configuration
   * @param options - Configuration registration options
   * @returns Disposable to unregister the configuration
   */
  registerConfiguration(
    extensionId: string,
    options: ConfigurationRegistrationOptions
  ): Disposable {
    const nodeId = options.id || `${extensionId}.config.${++this._idCounter}`;

    // Validate ID uniqueness
    if (this._configurations.has(nodeId)) {
      throw new Error(`Configuration node '${nodeId}' is already registered`);
    }

    // Create registered configuration
    const config: RegisteredConfiguration = {
      extensionId,
      nodeId,
      title: options.title,
      order: options.order ?? this._configurations.size,
      properties: new Map(),
      registeredAt: Date.now(),
    };

    // Process properties
    const changedKeys: string[] = [];

    for (const [key, schema] of Object.entries(options.properties)) {
      // Determine full key (may already include prefix)
      const fullKey = key;

      // Validate key uniqueness
      if (this._properties.has(fullKey)) {
        console.warn(
          `[ConfigurationRegistry] Property '${fullKey}' is already registered, skipping`
        );
        continue;
      }

      // Determine scope
      const scope = schema.scope ?? "window";

      // Get default value
      const defaultValue = getSchemaDefault(schema);

      // Create registered property
      const property: RegisteredConfigurationProperty = {
        key: fullKey,
        schema,
        defaultValue,
        scope,
        extensionId,
        registeredAt: Date.now(),
      };

      // Store property
      config.properties.set(fullKey, property);
      this._properties.set(fullKey, property);

      // Store default value
      if (defaultValue !== undefined) {
        this._defaults.set(fullKey, defaultValue);
        changedKeys.push(fullKey);
      }
    }

    // Store configuration
    this._configurations.set(nodeId, config);

    // Track extension configurations
    if (!this._extensionConfigurations.has(extensionId)) {
      this._extensionConfigurations.set(extensionId, new Set());
    }
    this._extensionConfigurations.get(extensionId)!.add(nodeId);

    // Recompute merged values for changed keys
    this._recomputeValues(changedKeys);

    // Fire events
    this._onDidRegisterConfiguration.fire(config);

    if (changedKeys.length > 0) {
      this._onDidChangeDefaults.fire(changedKeys);
    }

    // Dispatch DOM event for UI components
    this._dispatchConfigurationRegistered(config);

    // Return disposable
    return createDisposable(() => {
      this.unregisterConfiguration(nodeId);
    });
  }

  /**
   * Unregister a configuration node.
   *
   * @param nodeId - The configuration node ID
   */
  unregisterConfiguration(nodeId: string): void {
    const config = this._configurations.get(nodeId);
    if (!config) {
      return;
    }

    const changedKeys: string[] = [];

    // Remove all properties
    for (const [key] of config.properties) {
      this._properties.delete(key);
      this._defaults.delete(key);
      changedKeys.push(key);
    }

    // Remove from extension tracking
    const extensionConfigs = this._extensionConfigurations.get(config.extensionId);
    if (extensionConfigs) {
      extensionConfigs.delete(nodeId);
      if (extensionConfigs.size === 0) {
        this._extensionConfigurations.delete(config.extensionId);
      }
    }

    // Remove configuration
    this._configurations.delete(nodeId);

    // Recompute values
    this._recomputeValues(changedKeys);

    // Fire events
    this._onDidUnregisterConfiguration.fire(nodeId);

    if (changedKeys.length > 0) {
      this._onDidChangeDefaults.fire(changedKeys);
    }

    // Dispatch DOM event
    this._dispatchConfigurationUnregistered(nodeId);
  }

  // ============================================================================
  // Value Management
  // ============================================================================

  /**
   * Get the effective value for a configuration key.
   *
   * @param key - The configuration key
   * @param resourceUri - Optional resource URI for resource-scoped settings
   * @returns The effective value
   */
  getValue<T>(key: string, resourceUri?: string): T | undefined {
    // Check resource values first (if applicable)
    if (resourceUri) {
      const resourceValues = this._resourceValues.get(resourceUri);
      if (resourceValues?.has(key)) {
        return resourceValues.get(key) as T;
      }
    }

    // Check workspace values
    if (this._workspaceValues.has(key)) {
      return this._workspaceValues.get(key) as T;
    }

    // Check user values
    if (this._userValues.has(key)) {
      return this._userValues.get(key) as T;
    }

    // Return default value
    return this._defaults.get(key) as T;
  }

  /**
   * Get all configuration defaults.
   *
   * @returns Record of all default values
   */
  getConfigurationDefaults(): Record<string, unknown> {
    const defaults: Record<string, unknown> = {};
    for (const [key, value] of this._defaults) {
      defaults[key] = value;
    }
    return defaults;
  }

  /**
   * Update a configuration value.
   *
   * @param key - The configuration key
   * @param value - The new value
   * @param target - The configuration target
   * @param resourceUri - Optional resource URI for resource-scoped settings
   */
  updateValue(
    key: string,
    value: unknown,
    target: ConfigurationTarget = "user",
    resourceUri?: string
  ): void {
    const property = this._properties.get(key);

    // Validate value if property is registered
    if (property) {
      const result = this.validateValue(key, value);
      if (!result.valid) {
        throw new Error(
          `Invalid value for '${key}': ${result.errors.map((e) => e.message).join(", ")}`
        );
      }

      // Check scope restrictions
      if (!this._isScopeAllowed(property.scope, target, resourceUri)) {
        throw new Error(
          `Setting '${key}' with scope '${property.scope}' cannot be set at target '${target}'`
        );
      }
    }

    // Store value at appropriate level
    switch (target) {
      case "user":
      case "userLocal":
      case "userRemote":
        this._userValues.set(key, value);
        break;

      case "workspace":
        this._workspaceValues.set(key, value);
        break;

      case "workspaceFolder":
        if (!resourceUri) {
          throw new Error("Resource URI required for workspaceFolder target");
        }
        if (!this._resourceValues.has(resourceUri)) {
          this._resourceValues.set(resourceUri, new Map());
        }
        this._resourceValues.get(resourceUri)!.set(key, value);
        break;

      case "memory":
        // Memory values are temporary and don't persist
        this._values.set(key, value);
        break;

      default:
        throw new Error(`Invalid configuration target: ${target}`);
    }

    // Recompute merged value
    this._recomputeValues([key]);

    // Fire change event
    this._onDidChangeConfiguration.fire({
      affectedKeys: [key],
      source: target,
    });

    // Dispatch DOM event
    this._dispatchConfigurationChanged(key, value, target);
  }

  /**
   * Remove a configuration value.
   *
   * @param key - The configuration key
   * @param target - The configuration target
   * @param resourceUri - Optional resource URI
   */
  removeValue(
    key: string,
    target: ConfigurationTarget = "user",
    resourceUri?: string
  ): void {
    switch (target) {
      case "user":
      case "userLocal":
      case "userRemote":
        this._userValues.delete(key);
        break;

      case "workspace":
        this._workspaceValues.delete(key);
        break;

      case "workspaceFolder":
        if (resourceUri) {
          this._resourceValues.get(resourceUri)?.delete(key);
        }
        break;

      case "memory":
        this._values.delete(key);
        break;
    }

    // Recompute merged value
    this._recomputeValues([key]);

    // Fire change event
    this._onDidChangeConfiguration.fire({
      affectedKeys: [key],
      source: target,
    });
  }

  /**
   * Merge external settings into the registry.
   *
   * @param settings - Settings to merge
   * @param target - The configuration target
   */
  mergeSettings(
    settings: Record<string, unknown>,
    target: ConfigurationTarget = "user"
  ): void {
    const changedKeys: string[] = [];

    for (const [key, value] of Object.entries(settings)) {
      switch (target) {
        case "user":
        case "userLocal":
        case "userRemote":
          this._userValues.set(key, value);
          break;

        case "workspace":
          this._workspaceValues.set(key, value);
          break;

        case "default":
          // Only update defaults if not already registered
          if (!this._defaults.has(key)) {
            this._defaults.set(key, value);
          }
          break;
      }
      changedKeys.push(key);
    }

    // Recompute values
    this._recomputeValues(changedKeys);

    // Fire change event
    if (changedKeys.length > 0) {
      this._onDidChangeConfiguration.fire({
        affectedKeys: changedKeys,
        source: target,
      });
    }
  }

  // ============================================================================
  // Validation
  // ============================================================================

  /**
   * Validate a value against its registered schema.
   *
   * @param key - The configuration key
   * @param value - The value to validate
   * @returns Validation result
   */
  validateValue(key: string, value: unknown): ValidationResult {
    const property = this._properties.get(key);

    if (!property) {
      // No schema registered, consider valid
      return {
        valid: true,
        errors: [],
        warnings: [],
      };
    }

    return validateSetting(value, property.schema, key);
  }

  /**
   * Validate multiple values.
   *
   * @param values - Values to validate
   * @returns Map of key to validation result
   */
  validateValues(
    values: Record<string, unknown>
  ): Map<string, ValidationResult> {
    const results = new Map<string, ValidationResult>();

    for (const [key, value] of Object.entries(values)) {
      results.set(key, this.validateValue(key, value));
    }

    return results;
  }

  // ============================================================================
  // Query Methods
  // ============================================================================

  /**
   * Get a registered property by key.
   *
   * @param key - The property key
   * @returns The registered property or undefined
   */
  getProperty(key: string): RegisteredConfigurationProperty | undefined {
    return this._properties.get(key);
  }

  /**
   * Get all registered properties.
   *
   * @returns Array of all registered properties
   */
  getAllProperties(): RegisteredConfigurationProperty[] {
    return Array.from(this._properties.values());
  }

  /**
   * Get properties registered by a specific extension.
   *
   * @param extensionId - The extension ID
   * @returns Array of properties
   */
  getPropertiesByExtension(
    extensionId: string
  ): RegisteredConfigurationProperty[] {
    return this.getAllProperties().filter(
      (p) => p.extensionId === extensionId
    );
  }

  /**
   * Get a configuration node by ID.
   *
   * @param nodeId - The configuration node ID
   * @returns The configuration node or undefined
   */
  getConfiguration(nodeId: string): RegisteredConfiguration | undefined {
    return this._configurations.get(nodeId);
  }

  /**
   * Get all registered configuration nodes.
   *
   * @returns Array of all configuration nodes
   */
  getAllConfigurations(): RegisteredConfiguration[] {
    return Array.from(this._configurations.values());
  }

  /**
   * Get configuration nodes registered by a specific extension.
   *
   * @param extensionId - The extension ID
   * @returns Array of configuration nodes
   */
  getConfigurationsByExtension(
    extensionId: string
  ): RegisteredConfiguration[] {
    const nodeIds = this._extensionConfigurations.get(extensionId);
    if (!nodeIds) {
      return [];
    }

    return Array.from(nodeIds)
      .map((id) => this._configurations.get(id))
      .filter((c): c is RegisteredConfiguration => c !== undefined);
  }

  /**
   * Check if a property key is registered.
   *
   * @param key - The property key
   * @returns True if registered
   */
  hasProperty(key: string): boolean {
    return this._properties.has(key);
  }

  /**
   * Get properties by scope.
   *
   * @param scope - The configuration scope
   * @returns Array of properties with the given scope
   */
  getPropertiesByScope(
    scope: ConfigurationScope
  ): RegisteredConfigurationProperty[] {
    return this.getAllProperties().filter((p) => p.scope === scope);
  }

  /**
   * Search properties by key pattern.
   *
   * @param pattern - Regex pattern to match keys
   * @returns Array of matching properties
   */
  searchProperties(pattern: RegExp): RegisteredConfigurationProperty[] {
    return this.getAllProperties().filter((p) => pattern.test(p.key));
  }

  /**
   * Get the JSON Schema for a property.
   *
   * @param key - The property key
   * @returns The JSON Schema or undefined
   */
  getSchema(key: string): ConfigurationPropertySchema | undefined {
    return this._properties.get(key)?.schema;
  }

  /**
   * Get all schemas as a combined JSON Schema.
   *
   * @returns Combined JSON Schema for all properties
   */
  getAllSchemas(): JSONSchema {
    const properties: Record<string, JSONSchema> = {};

    for (const [key, property] of this._properties) {
      properties[key] = property.schema;
    }

    return {
      type: "object",
      properties,
      additionalProperties: true,
    };
  }

  // ============================================================================
  // Inspection
  // ============================================================================

  /**
   * Inspect a configuration value at all levels.
   *
   * @param key - The configuration key
   * @param resourceUri - Optional resource URI
   * @returns Inspection result
   */
  inspect(key: string, resourceUri?: string): ConfigurationInspection {
    const property = this._properties.get(key);

    return {
      key,
      defaultValue: this._defaults.get(key),
      userValue: this._userValues.get(key),
      workspaceValue: this._workspaceValues.get(key),
      workspaceFolderValue: resourceUri
        ? this._resourceValues.get(resourceUri)?.get(key)
        : undefined,
      effectiveValue: this.getValue(key, resourceUri),
      scope: property?.scope,
      schema: property?.schema,
    };
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  /**
   * Check if a scope allows setting at the given target.
   */
  private _isScopeAllowed(
    scope: ConfigurationScope,
    target: ConfigurationTarget,
    resourceUri?: string
  ): boolean {
    switch (scope) {
      case "application":
        // Application scope only allows user-level settings
        return target === "user" || target === "userLocal";

      case "machine":
        // Machine scope allows user and local settings
        return target === "user" || target === "userLocal";

      case "machineOverridable":
        // Machine overridable can be set at workspace level
        return (
          target === "user" ||
          target === "userLocal" ||
          target === "workspace"
        );

      case "window":
        // Window scope allows user and workspace
        return (
          target === "user" ||
          target === "userLocal" ||
          target === "workspace"
        );

      case "resource":
        // Resource scope allows all levels
        return true;

      case "languageOverridable":
        // Language overridable allows all levels
        return true;

      default:
        return true;
    }
  }

  /**
   * Recompute merged values for the given keys.
   */
  private _recomputeValues(keys: string[]): void {
    for (const key of keys) {
      // Priority: resource > workspace > user > default
      let value = this._defaults.get(key);

      if (this._userValues.has(key)) {
        value = this._userValues.get(key);
      }

      if (this._workspaceValues.has(key)) {
        value = this._workspaceValues.get(key);
      }

      if (value !== undefined) {
        this._values.set(key, value);
      } else {
        this._values.delete(key);
      }
    }
  }

  // ============================================================================
  // DOM Event Dispatching
  // ============================================================================

  private _dispatchConfigurationRegistered(config: RegisteredConfiguration): void {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("configuration:registered", {
          detail: { configuration: config },
        })
      );
    }
  }

  private _dispatchConfigurationUnregistered(nodeId: string): void {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("configuration:unregistered", {
          detail: { nodeId },
        })
      );
    }
  }

  private _dispatchConfigurationChanged(
    key: string,
    value: unknown,
    target: ConfigurationTarget
  ): void {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("configuration:changed", {
          detail: { key, value, target },
        })
      );
    }
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  /**
   * Unregister all configurations from a specific extension.
   *
   * @param extensionId - The extension ID
   */
  unregisterExtension(extensionId: string): void {
    const nodeIds = this._extensionConfigurations.get(extensionId);
    if (!nodeIds) {
      return;
    }

    for (const nodeId of Array.from(nodeIds)) {
      this.unregisterConfiguration(nodeId);
    }
  }

  /**
   * Clear all registrations.
   */
  clear(): void {
    for (const nodeId of Array.from(this._configurations.keys())) {
      this.unregisterConfiguration(nodeId);
    }

    this._userValues.clear();
    this._workspaceValues.clear();
    this._resourceValues.clear();
    this._values.clear();
  }

  /**
   * Dispose of the registry.
   */
  dispose(): void {
    this.clear();
    this._disposables.dispose();
  }
}

// ============================================================================
// Configuration Inspection Type
// ============================================================================

/**
 * Result of inspecting a configuration value.
 */
export interface ConfigurationInspection {
  /** Configuration key */
  key: string;
  /** Default value from schema */
  defaultValue?: unknown;
  /** User-level value */
  userValue?: unknown;
  /** Workspace-level value */
  workspaceValue?: unknown;
  /** Workspace folder-level value */
  workspaceFolderValue?: unknown;
  /** Effective (resolved) value */
  effectiveValue?: unknown;
  /** Configuration scope */
  scope?: ConfigurationScope;
  /** JSON Schema for the property */
  schema?: ConfigurationPropertySchema;
}

// ============================================================================
// Singleton Instance
// ============================================================================

let _globalRegistry: ConfigurationContributionRegistry | null = null;

/**
 * Get the global configuration contribution registry instance.
 * Creates the instance on first call.
 */
export function getConfigurationRegistry(): ConfigurationContributionRegistry {
  if (!_globalRegistry) {
    _globalRegistry = new ConfigurationContributionRegistry();
  }
  return _globalRegistry;
}

/**
 * Reset the global registry (mainly for testing).
 */
export function resetConfigurationRegistry(): void {
  if (_globalRegistry) {
    _globalRegistry.dispose();
    _globalRegistry = null;
  }
}

// ============================================================================
// Extension API Surface
// ============================================================================

/**
 * Configuration API exposed to extensions.
 * Provides methods for extensions to contribute and access configuration.
 */
export interface ConfigurationApi {
  /**
   * Register configuration properties.
   *
   * @param options - Configuration registration options
   * @returns Disposable to unregister
   */
  registerConfiguration(options: ConfigurationRegistrationOptions): Disposable;

  /**
   * Get the effective value for a configuration key.
   *
   * @param key - Configuration key
   * @param defaultValue - Default value if not set
   * @returns The configuration value
   */
  get<T>(key: string, defaultValue?: T): T;

  /**
   * Check if a configuration key has a value.
   *
   * @param key - Configuration key
   * @returns True if the key has a value
   */
  has(key: string): boolean;

  /**
   * Inspect a configuration value at all levels.
   *
   * @param key - Configuration key
   * @returns Inspection result
   */
  inspect(key: string): ConfigurationInspection;

  /**
   * Update a configuration value.
   *
   * @param key - Configuration key
   * @param value - New value
   * @param target - Configuration target
   * @returns Promise that resolves when update is complete
   */
  update(
    key: string,
    value: unknown,
    target?: ConfigurationTarget
  ): Promise<void>;

  /**
   * Get all configuration defaults.
   *
   * @returns Record of all default values
   */
  getConfigurationDefaults(): Record<string, unknown>;

  /**
   * Event fired when configuration changes.
   */
  readonly onDidChangeConfiguration: Event<ConfigurationChangedEvent>;
}

/**
 * Create the Configuration API for an extension.
 *
 * @param extensionId - The extension ID
 * @param disposables - DisposableStore to track registrations
 * @returns The Configuration API
 */
export function createConfigurationApi(
  extensionId: string,
  disposables: DisposableStore
): ConfigurationApi {
  const registry = getConfigurationRegistry();

  return {
    registerConfiguration(options: ConfigurationRegistrationOptions): Disposable {
      const disposable = registry.registerConfiguration(extensionId, options);
      disposables.add(disposable);
      return disposable;
    },

    get<T>(key: string, defaultValue?: T): T {
      const value = registry.getValue<T>(key);
      return value !== undefined ? value : (defaultValue as T);
    },

    has(key: string): boolean {
      return registry.hasProperty(key) || registry.getValue(key) !== undefined;
    },

    inspect(key: string): ConfigurationInspection {
      return registry.inspect(key);
    },

    async update(
      key: string,
      value: unknown,
      target: ConfigurationTarget = "user"
    ): Promise<void> {
      registry.updateValue(key, value, target);
    },

    getConfigurationDefaults(): Record<string, unknown> {
      return registry.getConfigurationDefaults();
    },

    onDidChangeConfiguration: registry.onDidChangeConfiguration,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a setting change event with the affectsConfiguration helper.
 *
 * @param key - The changed key
 * @param previousValue - Previous value
 * @param newValue - New value
 * @param target - Configuration target
 * @returns Setting change event
 */
export function createSettingChangeEvent(
  key: string,
  previousValue: unknown,
  newValue: unknown,
  target: ConfigurationTarget
): SettingChangeEvent {
  return {
    key,
    previousValue,
    newValue,
    target,
    affectsConfiguration(section: string): boolean {
      // Check if the changed key affects the given section
      return key === section || key.startsWith(`${section}.`);
    },
  };
}

/**
 * Parse a configuration key into its parts.
 *
 * @param key - The configuration key (e.g., "editor.fontSize")
 * @returns Object with section and property parts
 */
export function parseConfigurationKey(key: string): {
  section: string;
  property: string;
} {
  const lastDot = key.lastIndexOf(".");
  if (lastDot === -1) {
    return { section: "", property: key };
  }
  return {
    section: key.substring(0, lastDot),
    property: key.substring(lastDot + 1),
  };
}

/**
 * Build a configuration key from parts.
 *
 * @param section - The section (e.g., "editor")
 * @param property - The property (e.g., "fontSize")
 * @returns The full key (e.g., "editor.fontSize")
 */
export function buildConfigurationKey(section: string, property: string): string {
  if (!section) {
    return property;
  }
  return `${section}.${property}`;
}

// ============================================================================
// Exports
// ============================================================================

export type {
  ConfigurationScope,
  ConfigurationTarget,
  SettingRegistration,
  SettingChangeEvent,
};
