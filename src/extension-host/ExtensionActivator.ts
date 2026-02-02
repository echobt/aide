/**
 * Extension Activator
 *
 * Manages extension activation lifecycle including:
 * - Activation event matching
 * - Dependency resolution
 * - Lazy activation
 * - Deactivation cleanup
 */

import {
  Disposable,
  DisposableStore,
  EventEmitter,
  createDisposable,
  ExtensionDescription,
  ExtensionStatus,
  ExtensionRuntimeState,
  LogLevel,
} from "./types";
import {
  ExtensionContext,
  ExtensionApiBridge,
  OrionAPI,
  createOrionAPI,
} from "./ExtensionAPI";
import {
  createExtensionContext,
  createExtensionLogger,
  CreateExtensionContextOptions,
  ExtensionLogger,
} from "./ExtensionContext";
import { WorkspaceFolder } from "./types";

// ============================================================================
// Activation Event Types
// ============================================================================

/**
 * Supported activation event types.
 */
export type ActivationEventType =
  | "onLanguage"
  | "onCommand"
  | "onDebug"
  | "onDebugResolve"
  | "onDebugDynamicConfigurations"
  | "workspaceContains"
  | "onFileSystem"
  | "onView"
  | "onUri"
  | "onWebviewPanel"
  | "onCustomEditor"
  | "onAuthenticationRequest"
  | "onStartupFinished"
  | "*";

/**
 * Parsed activation event.
 */
export interface ParsedActivationEvent {
  type: ActivationEventType;
  value?: string;
  raw: string;
}

/**
 * Parse an activation event string.
 */
export function parseActivationEvent(event: string): ParsedActivationEvent {
  if (event === "*") {
    return { type: "*", raw: event };
  }

  const colonIndex = event.indexOf(":");
  if (colonIndex === -1) {
    return { type: event as ActivationEventType, raw: event };
  }

  const type = event.substring(0, colonIndex) as ActivationEventType;
  const value = event.substring(colonIndex + 1);

  return { type, value, raw: event };
}

/**
 * Check if an activation event matches a trigger.
 */
export function matchesActivationEvent(
  event: ParsedActivationEvent,
  trigger: { type: ActivationEventType; value?: string }
): boolean {
  // Eager activation matches everything
  if (event.type === "*") {
    return true;
  }

  // Type must match
  if (event.type !== trigger.type) {
    return false;
  }

  // If event has no value requirement, type match is enough
  if (!event.value) {
    return true;
  }

  // Value must match exactly
  return event.value === trigger.value;
}

// ============================================================================
// Extension Module Interface
// ============================================================================

/**
 * Interface for an extension's main module.
 */
export interface ExtensionModule {
  activate?(context: ExtensionContext): void | Promise<unknown>;
  deactivate?(): void | Promise<void>;
}

// ============================================================================
// Extension Activation Record
// ============================================================================

/**
 * Record of an activated extension.
 */
export interface ActivatedExtension {
  id: string;
  description: ExtensionDescription;
  module: ExtensionModule;
  context: ExtensionContext;
  api: OrionAPI;
  disposables: DisposableStore;
  logger: ExtensionLogger;
  exports: unknown;
  activatedTime: number;
  status: ExtensionStatus;
}

// ============================================================================
// Dependency Graph
// ============================================================================

/**
 * Manages extension dependency resolution.
 */
export class ExtensionDependencyGraph {
  private readonly nodes = new Map<string, ExtensionDescription>();
  private readonly edges = new Map<string, Set<string>>(); // extension -> dependencies

  /**
   * Add an extension to the graph.
   */
  add(extension: ExtensionDescription): void {
    this.nodes.set(extension.id, extension);
    this.edges.set(extension.id, new Set(extension.dependencies));
  }

  /**
   * Remove an extension from the graph.
   */
  remove(extensionId: string): void {
    this.nodes.delete(extensionId);
    this.edges.delete(extensionId);
    // Remove from other extensions' dependencies
    for (const deps of this.edges.values()) {
      deps.delete(extensionId);
    }
  }

  /**
   * Get extensions that depend on the given extension.
   */
  getDependents(extensionId: string): string[] {
    const dependents: string[] = [];
    for (const [id, deps] of this.edges) {
      if (deps.has(extensionId)) {
        dependents.push(id);
      }
    }
    return dependents;
  }

  /**
   * Get dependencies of an extension.
   */
  getDependencies(extensionId: string): string[] {
    return Array.from(this.edges.get(extensionId) ?? []);
  }

  /**
   * Check if all dependencies of an extension are satisfied.
   */
  areDependenciesSatisfied(
    extensionId: string,
    activeExtensions: Set<string>
  ): boolean {
    const deps = this.edges.get(extensionId);
    if (!deps) return true;

    for (const dep of deps) {
      if (!activeExtensions.has(dep)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Get activation order for a set of extensions.
   * Returns extensions in order such that dependencies come before dependents.
   */
  getActivationOrder(extensionIds: string[]): string[] {
    const order: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (id: string): void => {
      if (visited.has(id)) return;
      if (visiting.has(id)) {
        throw new Error(`Circular dependency detected involving extension: ${id}`);
      }

      visiting.add(id);

      const deps = this.edges.get(id);
      if (deps) {
        for (const dep of deps) {
          if (extensionIds.includes(dep)) {
            visit(dep);
          }
        }
      }

      visiting.delete(id);
      visited.add(id);
      order.push(id);
    };

    for (const id of extensionIds) {
      visit(id);
    }

    return order;
  }

  /**
   * Get deactivation order (reverse of activation order).
   */
  getDeactivationOrder(extensionIds: string[]): string[] {
    return this.getActivationOrder(extensionIds).reverse();
  }

  /**
   * Check for missing dependencies.
   */
  getMissingDependencies(extensionId: string): string[] {
    const deps = this.edges.get(extensionId);
    if (!deps) return [];

    const missing: string[] = [];
    for (const dep of deps) {
      if (!this.nodes.has(dep)) {
        missing.push(dep);
      }
    }
    return missing;
  }
}

// ============================================================================
// Extension Activator
// ============================================================================

export interface ExtensionActivatorOptions {
  bridge: ExtensionApiBridge;
  workspaceFolders: WorkspaceFolder[];
  storageBasePath: string;
  globalStorageBasePath: string;
  logPath: string;
  logLevel: LogLevel;
}

/**
 * Manages extension activation and deactivation.
 */
export class ExtensionActivator {
  private readonly options: ExtensionActivatorOptions;
  private readonly extensions = new Map<string, ExtensionDescription>();
  private readonly activated = new Map<string, ActivatedExtension>();
  private readonly pending = new Map<string, Promise<ActivatedExtension>>();
  private readonly dependencyGraph = new ExtensionDependencyGraph();

  private readonly _onDidActivate = new EventEmitter<ActivatedExtension>();
  private readonly _onDidDeactivate = new EventEmitter<string>();
  private readonly _onActivationError = new EventEmitter<{
    extensionId: string;
    error: Error;
  }>();

  readonly onDidActivate = this._onDidActivate.event;
  readonly onDidDeactivate = this._onDidDeactivate.event;
  readonly onActivationError = this._onActivationError.event;

  constructor(options: ExtensionActivatorOptions) {
    this.options = options;
  }

  /**
   * Register an extension for potential activation.
   */
  register(extension: ExtensionDescription): void {
    this.extensions.set(extension.id, extension);
    this.dependencyGraph.add(extension);
  }

  /**
   * Unregister an extension.
   */
  unregister(extensionId: string): void {
    this.extensions.delete(extensionId);
    this.dependencyGraph.remove(extensionId);
  }

  /**
   * Get all registered extensions.
   */
  getRegistered(): ExtensionDescription[] {
    return Array.from(this.extensions.values());
  }

  /**
   * Get activated extension by ID.
   */
  getActivated(extensionId: string): ActivatedExtension | undefined {
    return this.activated.get(extensionId);
  }

  /**
   * Check if an extension is activated.
   */
  isActivated(extensionId: string): boolean {
    return this.activated.has(extensionId);
  }

  /**
   * Get runtime state of an extension.
   */
  getRuntimeState(extensionId: string): ExtensionRuntimeState {
    const activated = this.activated.get(extensionId);
    if (activated) {
      return {
        id: extensionId,
        status: activated.status,
        activationTime: activated.activatedTime,
        lastActivity: Date.now(),
      };
    }

    const registered = this.extensions.has(extensionId);
    return {
      id: extensionId,
      status: registered ? ExtensionStatus.Inactive : ExtensionStatus.Error,
      error: registered ? undefined : "Extension not found",
    };
  }

  /**
   * Activate an extension by ID.
   */
  async activate(extensionId: string): Promise<ActivatedExtension> {
    // Already activated
    const existing = this.activated.get(extensionId);
    if (existing) {
      return existing;
    }

    // Already activating
    const pending = this.pending.get(extensionId);
    if (pending) {
      return pending;
    }

    // Get extension description
    const description = this.extensions.get(extensionId);
    if (!description) {
      throw new Error(`Extension '${extensionId}' not found`);
    }

    // Check for missing dependencies
    const missing = this.dependencyGraph.getMissingDependencies(extensionId);
    if (missing.length > 0) {
      throw new Error(
        `Extension '${extensionId}' has missing dependencies: ${missing.join(", ")}`
      );
    }

    // Create activation promise
    const activationPromise = this.doActivate(description);
    this.pending.set(extensionId, activationPromise);

    try {
      const activated = await activationPromise;
      return activated;
    } finally {
      this.pending.delete(extensionId);
    }
  }

  /**
   * Perform the actual activation.
   */
  private async doActivate(description: ExtensionDescription): Promise<ActivatedExtension> {
    const { id } = description;
    const startTime = Date.now();

    // First, activate dependencies
    const deps = this.dependencyGraph.getDependencies(id);
    for (const depId of deps) {
      if (!this.isActivated(depId)) {
        await this.activate(depId);
      }
    }

    // Create disposables store
    const disposables = new DisposableStore();

    // Create logger
    const logger = createExtensionLogger(id, this.options.bridge, this.options.logLevel);

    try {
      logger.info(`Activating extension: ${id}`);

      // Create context
      const contextOptions: CreateExtensionContextOptions = {
        extensionId: id,
        extensionPath: description.path,
        storageBasePath: this.options.storageBasePath,
        globalStorageBasePath: this.options.globalStorageBasePath,
        logPath: this.options.logPath,
        mode: 1, // Production - would be determined from environment
      };

      const context = createExtensionContext(
        contextOptions,
        this.options.bridge,
        disposables
      );

      // Create API
      const api = createOrionAPI(
        id,
        this.options.bridge,
        disposables,
        this.options.workspaceFolders
      );

      // Load and execute extension module
      const module = await this.loadExtensionModule(description, api);

      // Call activate function
      let exports: unknown;
      if (module.activate) {
        exports = await module.activate(context);
      }

      const activationTime = Date.now() - startTime;

      // Create activated record
      const activated: ActivatedExtension = {
        id,
        description,
        module,
        context,
        api,
        disposables,
        logger,
        exports,
        activatedTime: activationTime,
        status: ExtensionStatus.Active,
      };

      this.activated.set(id, activated);
      this._onDidActivate.fire(activated);

      logger.info(`Extension activated in ${activationTime}ms`);

      return activated;
    } catch (error) {
      disposables.dispose();

      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`Activation failed: ${err.message}`);

      this._onActivationError.fire({ extensionId: id, error: err });
      throw err;
    }
  }

  /**
   * Load an extension's module.
   */
  private async loadExtensionModule(
    description: ExtensionDescription,
    _api: OrionAPI
  ): Promise<ExtensionModule> {
    const mainPath = `${description.path}/${description.main}`;

    // In a real implementation, this would:
    // 1. Fetch the extension code
    // 2. Evaluate it in a sandbox
    // 3. Return the module exports

    // For now, we'll use dynamic import (would need bundler support)
    try {
      // This would be replaced with actual module loading in the worker
      const module = await import(/* @vite-ignore */ mainPath);
      return module;
    } catch (error) {
      // Fallback for development - assume extension is already bundled
      console.warn(`Could not dynamically import extension: ${mainPath}`, error);
      return {};
    }
  }

  /**
   * Deactivate an extension by ID.
   */
  async deactivate(extensionId: string): Promise<void> {
    const activated = this.activated.get(extensionId);
    if (!activated) {
      return; // Not activated
    }

    // First, deactivate dependents
    const dependents = this.dependencyGraph.getDependents(extensionId);
    for (const depId of dependents) {
      if (this.isActivated(depId)) {
        await this.deactivate(depId);
      }
    }

    activated.status = ExtensionStatus.Deactivating;
    activated.logger.info(`Deactivating extension: ${extensionId}`);

    try {
      // Call deactivate function
      if (activated.module.deactivate) {
        await activated.module.deactivate();
      }

      // Dispose context subscriptions
      for (const sub of activated.context.subscriptions) {
        try {
          sub.dispose();
        } catch (e) {
          activated.logger.warn(`Error disposing subscription: ${e}`);
        }
      }

      // Dispose all disposables
      activated.disposables.dispose();

      this.activated.delete(extensionId);
      this._onDidDeactivate.fire(extensionId);

      activated.logger.info("Extension deactivated");
    } catch (error) {
      activated.status = ExtensionStatus.Error;
      const err = error instanceof Error ? error : new Error(String(error));
      activated.logger.error(`Deactivation failed: ${err.message}`);
      throw err;
    }
  }

  /**
   * Deactivate all extensions.
   */
  async deactivateAll(): Promise<void> {
    const ids = Array.from(this.activated.keys());
    const order = this.dependencyGraph.getDeactivationOrder(ids);

    for (const id of order) {
      await this.deactivate(id);
    }
  }

  /**
   * Find extensions that should be activated for an event.
   */
  findExtensionsForActivationEvent(
    type: ActivationEventType,
    value?: string
  ): ExtensionDescription[] {
    const matching: ExtensionDescription[] = [];

    for (const extension of this.extensions.values()) {
      if (this.isActivated(extension.id)) {
        continue; // Already activated
      }

      for (const eventStr of extension.activationEvents) {
        const event = parseActivationEvent(eventStr);
        if (matchesActivationEvent(event, { type, value })) {
          matching.push(extension);
          break;
        }
      }
    }

    return matching;
  }

  /**
   * Activate extensions for an activation event.
   */
  async activateByEvent(
    type: ActivationEventType,
    value?: string
  ): Promise<ActivatedExtension[]> {
    const toActivate = this.findExtensionsForActivationEvent(type, value);

    if (toActivate.length === 0) {
      return [];
    }

    // Get activation order
    const ids = toActivate.map((e) => e.id);
    const order = this.dependencyGraph.getActivationOrder(ids);

    const activated: ActivatedExtension[] = [];

    for (const id of order) {
      try {
        const ext = await this.activate(id);
        activated.push(ext);
      } catch (error) {
        console.error(`Failed to activate extension ${id}:`, error);
        // Continue with other extensions
      }
    }

    return activated;
  }

  /**
   * Activate all eagerly-activated extensions.
   */
  async activateEager(): Promise<ActivatedExtension[]> {
    return this.activateByEvent("*");
  }

  /**
   * Activate extensions when startup is finished.
   */
  async activateOnStartupFinished(): Promise<ActivatedExtension[]> {
    return this.activateByEvent("onStartupFinished");
  }

  /**
   * Dispose the activator and all extensions.
   */
  async dispose(): Promise<void> {
    await this.deactivateAll();
    this._onDidActivate.dispose();
    this._onDidDeactivate.dispose();
    this._onActivationError.dispose();
  }
}

// ============================================================================
// Activation Event Utilities
// ============================================================================

/**
 * Common activation events.
 */
export const ActivationEvents = {
  onLanguage: (languageId: string) => `onLanguage:${languageId}`,
  onCommand: (commandId: string) => `onCommand:${commandId}`,
  workspaceContains: (pattern: string) => `workspaceContains:${pattern}`,
  onView: (viewId: string) => `onView:${viewId}`,
  onUri: (scheme: string) => `onUri:${scheme}`,
  onFileSystem: (scheme: string) => `onFileSystem:${scheme}`,
  onDebug: (type?: string) => (type ? `onDebug:${type}` : "onDebug"),
  onWebviewPanel: (viewType: string) => `onWebviewPanel:${viewType}`,
  onCustomEditor: (viewType: string) => `onCustomEditor:${viewType}`,
  onStartupFinished: () => "onStartupFinished",
  eager: () => "*",
} as const;
