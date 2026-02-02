/**
 * Views Contribution System
 *
 * Provides a complete system for extensions to contribute views and view containers
 * to the Cortex IDE sidebar. This mirrors VS Code's view contribution model.
 *
 * Features:
 * - Register view containers (sidebar panels)
 * - Register views within containers
 * - Show/hide views dynamically
 * - Event system for view lifecycle
 * - Integration with ActivityBar
 *
 * @module extension-host/contributions/views
 */

import {
  Disposable,
  DisposableStore,
  EventEmitter,
  Event,
  createDisposable,
} from "../types";

import type { ViewContainer, View } from "../../types/workbench";

// ============================================================================
// Types
// ============================================================================

/**
 * Extended ViewContainer with registration metadata
 */
export interface RegisteredViewContainer extends ViewContainer {
  /** Extension ID that registered this container */
  extensionId: string;
  /** Whether the container is currently visible */
  visible: boolean;
  /** Registration timestamp */
  registeredAt: number;
}

/**
 * Extended View with registration metadata
 */
export interface RegisteredView extends View {
  /** ID of the container this view belongs to */
  containerId: string;
  /** Extension ID that registered this view */
  extensionId: string;
  /** Whether the view is currently visible */
  visible: boolean;
  /** Registration timestamp */
  registeredAt: number;
}

/**
 * Options for registering a view container
 */
export interface ViewContainerRegistrationOptions {
  /** Unique identifier for the container */
  id: string;
  /** Display title */
  title: string;
  /** Icon (codicon name or themed icon paths) */
  icon?: string | { light: string; dark: string };
  /** Sort order within the activity bar */
  order?: number;
}

/**
 * Options for registering a view
 */
export interface ViewRegistrationOptions {
  /** Unique identifier for the view */
  id: string;
  /** Display name */
  name: string;
  /** Icon (codicon name) */
  icon?: string;
  /** When clause for conditional visibility */
  when?: string;
  /** Contextual title shown when focused */
  contextualTitle?: string;
  /** Initial visibility state */
  visibility?: "visible" | "hidden" | "collapsed";
  /** Initial size */
  initialSize?: number;
  /** Type of view content */
  type?: "tree" | "webview";
  /** Whether user can toggle visibility */
  canToggleVisibility?: boolean;
  /** Whether user can move this view */
  canMoveView?: boolean;
}

/**
 * Event fired when a view container is registered
 */
export interface ViewContainerRegisteredEvent {
  /** The registered container */
  container: RegisteredViewContainer;
}

/**
 * Event fired when a view is registered
 */
export interface ViewRegisteredEvent {
  /** The registered view */
  view: RegisteredView;
  /** The container it was registered in */
  containerId: string;
}

/**
 * Event fired when a view visibility changes
 */
export interface ViewVisibilityChangedEvent {
  /** The view ID */
  viewId: string;
  /** New visibility state */
  visible: boolean;
}

/**
 * Event fired when a view container visibility changes
 */
export interface ViewContainerVisibilityChangedEvent {
  /** The container ID */
  containerId: string;
  /** New visibility state */
  visible: boolean;
}

// ============================================================================
// Views Contribution Registry
// ============================================================================

/**
 * Views contribution registry.
 * Manages registration and lifecycle of views and view containers.
 */
export class ViewsContributionRegistry implements Disposable {
  private readonly _disposables = new DisposableStore();
  
  /** Map of registered view containers by ID */
  private readonly _viewContainers = new Map<string, RegisteredViewContainer>();
  
  /** Map of registered views by ID */
  private readonly _views = new Map<string, RegisteredView>();
  
  /** Map of container ID to view IDs */
  private readonly _containerViews = new Map<string, Set<string>>();

  // Event emitters
  private readonly _onDidRegisterViewContainer = new EventEmitter<ViewContainerRegisteredEvent>();
  private readonly _onDidUnregisterViewContainer = new EventEmitter<string>();
  private readonly _onDidRegisterView = new EventEmitter<ViewRegisteredEvent>();
  private readonly _onDidUnregisterView = new EventEmitter<string>();
  private readonly _onDidChangeViewVisibility = new EventEmitter<ViewVisibilityChangedEvent>();
  private readonly _onDidChangeViewContainerVisibility = new EventEmitter<ViewContainerVisibilityChangedEvent>();

  constructor() {
    this._disposables.add(this._onDidRegisterViewContainer);
    this._disposables.add(this._onDidUnregisterViewContainer);
    this._disposables.add(this._onDidRegisterView);
    this._disposables.add(this._onDidUnregisterView);
    this._disposables.add(this._onDidChangeViewVisibility);
    this._disposables.add(this._onDidChangeViewContainerVisibility);
  }

  // ============================================================================
  // Events
  // ============================================================================

  /**
   * Event fired when a view container is registered
   */
  get onDidRegisterViewContainer(): Event<ViewContainerRegisteredEvent> {
    return this._onDidRegisterViewContainer.event;
  }

  /**
   * Event fired when a view container is unregistered
   */
  get onDidUnregisterViewContainer(): Event<string> {
    return this._onDidUnregisterViewContainer.event;
  }

  /**
   * Event fired when a view is registered
   */
  get onDidRegisterView(): Event<ViewRegisteredEvent> {
    return this._onDidRegisterView.event;
  }

  /**
   * Event fired when a view is unregistered
   */
  get onDidUnregisterView(): Event<string> {
    return this._onDidUnregisterView.event;
  }

  /**
   * Event fired when a view visibility changes
   */
  get onDidChangeViewVisibility(): Event<ViewVisibilityChangedEvent> {
    return this._onDidChangeViewVisibility.event;
  }

  /**
   * Event fired when a view container visibility changes
   */
  get onDidChangeViewContainerVisibility(): Event<ViewContainerVisibilityChangedEvent> {
    return this._onDidChangeViewContainerVisibility.event;
  }

  // ============================================================================
  // View Container Registration
  // ============================================================================

  /**
   * Register a view container.
   * 
   * @param extensionId - The ID of the extension registering the container
   * @param options - Container registration options
   * @returns The registered container and a disposable to unregister it
   */
  registerViewContainer(
    extensionId: string,
    options: ViewContainerRegistrationOptions
  ): { container: RegisteredViewContainer; disposable: Disposable } {
    const { id, title, icon, order } = options;

    // Validate ID uniqueness
    if (this._viewContainers.has(id)) {
      throw new Error(`View container with ID '${id}' is already registered`);
    }

    // Create registered container
    const container: RegisteredViewContainer = {
      id,
      title,
      icon,
      order: order ?? this._viewContainers.size,
      views: [],
      extensionId,
      visible: true,
      registeredAt: Date.now(),
    };

    // Store container
    this._viewContainers.set(id, container);
    this._containerViews.set(id, new Set());

    // Fire event
    this._onDidRegisterViewContainer.fire({ container });

    // Dispatch DOM event for UI components to react
    this._dispatchContainerRegistered(container);

    // Create disposable
    const disposable = createDisposable(() => {
      this.unregisterViewContainer(id);
    });

    return { container, disposable };
  }

  /**
   * Unregister a view container and all its views.
   * 
   * @param containerId - The container ID to unregister
   */
  unregisterViewContainer(containerId: string): void {
    const container = this._viewContainers.get(containerId);
    if (!container) {
      return;
    }

    // Unregister all views in the container
    const viewIds = this._containerViews.get(containerId);
    if (viewIds) {
      for (const viewId of viewIds) {
        this._unregisterViewInternal(viewId);
      }
    }

    // Remove container
    this._viewContainers.delete(containerId);
    this._containerViews.delete(containerId);

    // Fire event
    this._onDidUnregisterViewContainer.fire(containerId);

    // Dispatch DOM event
    this._dispatchContainerUnregistered(containerId);
  }

  /**
   * Get a view container by ID.
   * 
   * @param containerId - The container ID
   * @returns The container or undefined if not found
   */
  getViewContainer(containerId: string): RegisteredViewContainer | undefined {
    return this._viewContainers.get(containerId);
  }

  /**
   * Get all registered view containers.
   * 
   * @returns Array of all containers
   */
  getAllViewContainers(): RegisteredViewContainer[] {
    return Array.from(this._viewContainers.values());
  }

  /**
   * Get view containers registered by a specific extension.
   * 
   * @param extensionId - The extension ID
   * @returns Array of containers registered by the extension
   */
  getViewContainersByExtension(extensionId: string): RegisteredViewContainer[] {
    return this.getAllViewContainers().filter(c => c.extensionId === extensionId);
  }

  // ============================================================================
  // View Registration
  // ============================================================================

  /**
   * Register a view in a container.
   * 
   * @param extensionId - The ID of the extension registering the view
   * @param containerId - The container ID to register the view in
   * @param options - View registration options
   * @returns The registered view and a disposable to unregister it
   */
  registerView(
    extensionId: string,
    containerId: string,
    options: ViewRegistrationOptions
  ): { view: RegisteredView; disposable: Disposable } {
    const { id, name, icon, when, contextualTitle, visibility, initialSize, type, canToggleVisibility, canMoveView } = options;

    // Validate container exists
    const container = this._viewContainers.get(containerId);
    if (!container) {
      throw new Error(`View container '${containerId}' not found`);
    }

    // Validate view ID uniqueness
    if (this._views.has(id)) {
      throw new Error(`View with ID '${id}' is already registered`);
    }

    // Create registered view
    const view: RegisteredView = {
      id,
      name,
      icon,
      when,
      contextualTitle,
      visibility: visibility ?? "visible",
      initialSize,
      type: type ?? "tree",
      canToggleVisibility: canToggleVisibility ?? true,
      canMoveView: canMoveView ?? true,
      containerId,
      extensionId,
      visible: visibility !== "hidden",
      registeredAt: Date.now(),
    };

    // Store view
    this._views.set(id, view);
    this._containerViews.get(containerId)!.add(id);

    // Update container's views array
    container.views = this.getViews(containerId);

    // Fire event
    this._onDidRegisterView.fire({ view, containerId });

    // Dispatch DOM event
    this._dispatchViewRegistered(view, containerId);

    // Create disposable
    const disposable = createDisposable(() => {
      this.unregisterView(id);
    });

    return { view, disposable };
  }

  /**
   * Unregister a view.
   * 
   * @param viewId - The view ID to unregister
   */
  unregisterView(viewId: string): void {
    this._unregisterViewInternal(viewId);
  }

  private _unregisterViewInternal(viewId: string): void {
    const view = this._views.get(viewId);
    if (!view) {
      return;
    }

    // Remove from container's view set
    const containerViews = this._containerViews.get(view.containerId);
    if (containerViews) {
      containerViews.delete(viewId);
    }

    // Update container's views array
    const container = this._viewContainers.get(view.containerId);
    if (container) {
      container.views = this.getViews(view.containerId);
    }

    // Remove view
    this._views.delete(viewId);

    // Fire event
    this._onDidUnregisterView.fire(viewId);

    // Dispatch DOM event
    this._dispatchViewUnregistered(viewId, view.containerId);
  }

  /**
   * Get a view by ID.
   * 
   * @param viewId - The view ID
   * @returns The view or undefined if not found
   */
  getView(viewId: string): RegisteredView | undefined {
    return this._views.get(viewId);
  }

  /**
   * Get all views in a container.
   * 
   * @param containerId - The container ID
   * @returns Array of views in the container
   */
  getViews(containerId: string): RegisteredView[] {
    const viewIds = this._containerViews.get(containerId);
    if (!viewIds) {
      return [];
    }

    return Array.from(viewIds)
      .map(id => this._views.get(id)!)
      .filter(Boolean)
      .sort((a, b) => a.registeredAt - b.registeredAt);
  }

  /**
   * Get all registered views.
   * 
   * @returns Array of all views
   */
  getAllViews(): RegisteredView[] {
    return Array.from(this._views.values());
  }

  /**
   * Get views registered by a specific extension.
   * 
   * @param extensionId - The extension ID
   * @returns Array of views registered by the extension
   */
  getViewsByExtension(extensionId: string): RegisteredView[] {
    return this.getAllViews().filter(v => v.extensionId === extensionId);
  }

  // ============================================================================
  // View Visibility
  // ============================================================================

  /**
   * Show a view.
   * 
   * @param viewId - The view ID to show
   */
  showView(viewId: string): void {
    const view = this._views.get(viewId);
    if (!view) {
      throw new Error(`View '${viewId}' not found`);
    }

    if (!view.visible) {
      view.visible = true;
      view.visibility = "visible";

      this._onDidChangeViewVisibility.fire({ viewId, visible: true });
      this._dispatchViewVisibilityChanged(viewId, true);
    }
  }

  /**
   * Hide a view.
   * 
   * @param viewId - The view ID to hide
   */
  hideView(viewId: string): void {
    const view = this._views.get(viewId);
    if (!view) {
      throw new Error(`View '${viewId}' not found`);
    }

    if (view.visible) {
      view.visible = false;
      view.visibility = "hidden";

      this._onDidChangeViewVisibility.fire({ viewId, visible: false });
      this._dispatchViewVisibilityChanged(viewId, false);
    }
  }

  /**
   * Toggle a view's visibility.
   * 
   * @param viewId - The view ID to toggle
   * @returns The new visibility state
   */
  toggleView(viewId: string): boolean {
    const view = this._views.get(viewId);
    if (!view) {
      throw new Error(`View '${viewId}' not found`);
    }

    if (view.visible) {
      this.hideView(viewId);
      return false;
    } else {
      this.showView(viewId);
      return true;
    }
  }

  /**
   * Check if a view is visible.
   * 
   * @param viewId - The view ID
   * @returns True if visible
   */
  isViewVisible(viewId: string): boolean {
    return this._views.get(viewId)?.visible ?? false;
  }

  // ============================================================================
  // View Container Visibility
  // ============================================================================

  /**
   * Show a view container.
   * 
   * @param containerId - The container ID to show
   */
  showViewContainer(containerId: string): void {
    const container = this._viewContainers.get(containerId);
    if (!container) {
      throw new Error(`View container '${containerId}' not found`);
    }

    if (!container.visible) {
      container.visible = true;

      this._onDidChangeViewContainerVisibility.fire({ containerId, visible: true });
      this._dispatchContainerVisibilityChanged(containerId, true);
    }
  }

  /**
   * Hide a view container.
   * 
   * @param containerId - The container ID to hide
   */
  hideViewContainer(containerId: string): void {
    const container = this._viewContainers.get(containerId);
    if (!container) {
      throw new Error(`View container '${containerId}' not found`);
    }

    if (container.visible) {
      container.visible = false;

      this._onDidChangeViewContainerVisibility.fire({ containerId, visible: false });
      this._dispatchContainerVisibilityChanged(containerId, false);
    }
  }

  /**
   * Check if a view container is visible.
   * 
   * @param containerId - The container ID
   * @returns True if visible
   */
  isViewContainerVisible(containerId: string): boolean {
    return this._viewContainers.get(containerId)?.visible ?? false;
  }

  // ============================================================================
  // DOM Event Dispatching (for UI integration)
  // ============================================================================

  private _dispatchContainerRegistered(container: RegisteredViewContainer): void {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("views:container-registered", {
        detail: { container },
      }));
    }
  }

  private _dispatchContainerUnregistered(containerId: string): void {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("views:container-unregistered", {
        detail: { containerId },
      }));
    }
  }

  private _dispatchViewRegistered(view: RegisteredView, containerId: string): void {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("views:view-registered", {
        detail: { view, containerId },
      }));
    }
  }

  private _dispatchViewUnregistered(viewId: string, containerId: string): void {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("views:view-unregistered", {
        detail: { viewId, containerId },
      }));
    }
  }

  private _dispatchViewVisibilityChanged(viewId: string, visible: boolean): void {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("views:view-visibility-changed", {
        detail: { viewId, visible },
      }));
    }
  }

  private _dispatchContainerVisibilityChanged(containerId: string, visible: boolean): void {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("views:container-visibility-changed", {
        detail: { containerId, visible },
      }));
    }
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  /**
   * Unregister all contributions from a specific extension.
   * 
   * @param extensionId - The extension ID
   */
  unregisterExtension(extensionId: string): void {
    // Unregister views first
    for (const view of this.getViewsByExtension(extensionId)) {
      this.unregisterView(view.id);
    }

    // Then unregister containers
    for (const container of this.getViewContainersByExtension(extensionId)) {
      this.unregisterViewContainer(container.id);
    }
  }

  /**
   * Clear all registrations.
   */
  clear(): void {
    for (const containerId of this._viewContainers.keys()) {
      this.unregisterViewContainer(containerId);
    }
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
// Singleton Instance
// ============================================================================

let _globalRegistry: ViewsContributionRegistry | null = null;

/**
 * Get the global views contribution registry instance.
 * Creates the instance on first call.
 */
export function getViewsRegistry(): ViewsContributionRegistry {
  if (!_globalRegistry) {
    _globalRegistry = new ViewsContributionRegistry();
  }
  return _globalRegistry;
}

/**
 * Reset the global registry (mainly for testing).
 */
export function resetViewsRegistry(): void {
  if (_globalRegistry) {
    _globalRegistry.dispose();
    _globalRegistry = null;
  }
}

// ============================================================================
// Extension API Surface
// ============================================================================

/**
 * Views API exposed to extensions.
 * Provides methods for extensions to contribute views.
 */
export interface ViewsApi {
  /**
   * Register a view container in the activity bar.
   */
  registerViewContainer(
    id: string,
    title: string,
    icon?: string | { light: string; dark: string }
  ): ViewContainer;

  /**
   * Register a view in a container.
   */
  registerView(containerId: string, view: ViewRegistrationOptions): View;

  /**
   * Get a view container by ID.
   */
  getViewContainer(id: string): ViewContainer | undefined;

  /**
   * Get all views in a container.
   */
  getViews(containerId: string): View[];

  /**
   * Show a view.
   */
  showView(viewId: string): void;

  /**
   * Hide a view.
   */
  hideView(viewId: string): void;

  /**
   * Event fired when a view container is registered.
   */
  onDidRegisterViewContainer: Event<ViewContainerRegisteredEvent>;

  /**
   * Event fired when a view is registered.
   */
  onDidRegisterView: Event<ViewRegisteredEvent>;
}

/**
 * Create the Views API for an extension.
 * 
 * @param extensionId - The extension ID
 * @param disposables - DisposableStore to track registrations
 * @returns The Views API
 */
export function createViewsApi(
  extensionId: string,
  disposables: DisposableStore
): ViewsApi {
  const registry = getViewsRegistry();

  return {
    registerViewContainer(
      id: string,
      title: string,
      icon?: string | { light: string; dark: string }
    ): ViewContainer {
      const { container, disposable } = registry.registerViewContainer(extensionId, {
        id,
        title,
        icon,
      });
      disposables.add(disposable);
      return container;
    },

    registerView(containerId: string, options: ViewRegistrationOptions): View {
      const { view, disposable } = registry.registerView(extensionId, containerId, options);
      disposables.add(disposable);
      return view;
    },

    getViewContainer(id: string): ViewContainer | undefined {
      return registry.getViewContainer(id);
    },

    getViews(containerId: string): View[] {
      return registry.getViews(containerId);
    },

    showView(viewId: string): void {
      registry.showView(viewId);
    },

    hideView(viewId: string): void {
      registry.hideView(viewId);
    },

    onDidRegisterViewContainer: registry.onDidRegisterViewContainer,

    onDidRegisterView: registry.onDidRegisterView,
  };
}

// ============================================================================
// Exports
// ============================================================================

export type {
  ViewContainer,
  View,
};
