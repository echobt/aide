/**
 * Menu Contribution System
 *
 * Provides a complete menu contribution system for extensions to register
 * menu items, submenus, and context-aware visibility via when clauses.
 * Follows VSCode's menu contribution model.
 */

import {
  Disposable,
  DisposableStore,
  createDisposable,
  EventEmitter,
  Event,
  Command,
} from "../types";

// ============================================================================
// Menu Location Types
// ============================================================================

/**
 * Standard menu locations where items can be contributed.
 */
export type MenuLocation =
  | "editor/context"
  | "editor/title"
  | "editor/title/context"
  | "editor/title/run"
  | "editor/lineNumber/context"
  | "explorer/context"
  | "view/title"
  | "view/item/context"
  | "commandPalette"
  | "scm/title"
  | "scm/sourceControl"
  | "scm/resourceGroup/context"
  | "scm/resourceState/context"
  | "scm/resourceFolder/context"
  | "scm/change/title"
  | "debug/callstack/context"
  | "debug/variables/context"
  | "debug/toolBar"
  | "terminal/context"
  | "terminal/title/context"
  | "timeline/title"
  | "timeline/item/context"
  | "comments/commentThread/title"
  | "comments/commentThread/context"
  | "comments/comment/title"
  | "comments/comment/context"
  | "notebook/toolbar"
  | "notebook/cell/title"
  | "notebook/cell/execute"
  | "testing/item/context"
  | "testing/item/gutter"
  | "extension/context"
  | "webview/context"
  | (string & {}); // Allow custom locations

// ============================================================================
// Menu Item Types
// ============================================================================

/**
 * Represents a menu item that can be contributed to a menu location.
 */
export interface MenuItem {
  /** The command to execute when the menu item is activated */
  command: string;
  /** When clause expression for conditional visibility */
  when?: string;
  /** Group identifier for organizing menu items */
  group?: string;
  /** Order within the group (lower numbers appear first) */
  order?: number;
  /** Alternative command for when alt-clicking */
  alt?: string;
  /** Arguments to pass to the command */
  args?: unknown[];
}

/**
 * Internal representation of a registered menu item with metadata.
 */
export interface RegisteredMenuItem extends MenuItem {
  /** Unique identifier for this registration */
  id: string;
  /** The extension that registered this item */
  extensionId: string;
  /** Registration timestamp */
  registeredAt: number;
}

/**
 * Represents a submenu that can be contributed to a menu location.
 */
export interface Submenu {
  /** Unique identifier for the submenu */
  id: string;
  /** Display label for the submenu */
  label: string;
  /** Optional icon */
  icon?: string | { light: string; dark: string };
  /** When clause expression for conditional visibility */
  when?: string;
  /** Group identifier for organizing within parent menu */
  group?: string;
  /** Order within the group */
  order?: number;
}

/**
 * Internal representation of a registered submenu.
 */
export interface RegisteredSubmenu extends Submenu {
  /** The extension that registered this submenu */
  extensionId: string;
  /** Registration timestamp */
  registeredAt: number;
}

/**
 * Resolved menu item ready for display.
 */
export interface ResolvedMenuItem {
  /** The command to execute */
  command: Command;
  /** Alternative command (for alt-click) */
  alt?: Command;
  /** Group identifier */
  group: string;
  /** Order within group */
  order: number;
  /** Whether this is a submenu */
  isSubmenu: boolean;
  /** Submenu ID if this is a submenu */
  submenuId?: string;
  /** Child items if this is a submenu */
  children?: ResolvedMenuItem[];
  /** Whether item is currently enabled */
  enabled: boolean;
  /** Whether item is currently visible */
  visible: boolean;
}

// ============================================================================
// When Clause Context
// ============================================================================

/**
 * Context values used for evaluating when clauses.
 */
export interface WhenClauseContext {
  // Editor context
  editorFocus?: boolean;
  editorTextFocus?: boolean;
  editorHasSelection?: boolean;
  editorHasMultipleSelections?: boolean;
  editorReadonly?: boolean;
  editorLangId?: string;
  
  // Resource context
  resourceScheme?: string;
  resourceFilename?: string;
  resourceExtname?: string;
  resourcePath?: string;
  resourceLangId?: string;
  resourceDirname?: string;
  
  // Explorer context
  explorerViewletVisible?: boolean;
  explorerViewletFocus?: boolean;
  filesExplorerFocus?: boolean;
  explorerResourceIsFolder?: boolean;
  explorerResourceIsRoot?: boolean;
  explorerResourceReadonly?: boolean;
  
  // View context
  view?: string;
  viewItem?: string;
  
  // SCM context
  scmProvider?: string;
  scmResourceGroup?: string;
  
  // Debug context
  debugType?: string;
  debugState?: string;
  inDebugMode?: boolean;
  
  // Terminal context
  terminalFocus?: boolean;
  terminalIsOpen?: boolean;
  
  // General context
  isWindows?: boolean;
  isMac?: boolean;
  isLinux?: boolean;
  isWeb?: boolean;
  
  // Extension-provided context
  [key: string]: unknown;
}

// ============================================================================
// Menu Events
// ============================================================================

/**
 * Event fired when menu items change for a location.
 */
export interface MenusChangedEvent {
  /** The menu location that changed */
  location: MenuLocation;
  /** Type of change */
  changeType: "added" | "removed" | "updated";
}

// ============================================================================
// When Clause Evaluator
// ============================================================================

/**
 * Evaluates when clause expressions against a context.
 */
export class WhenClauseEvaluator {
  /**
   * Evaluate a when clause expression.
   * Supports: ==, !=, &&, ||, !, =~, in, not in, and context key checks.
   */
  evaluate(expression: string | undefined, context: WhenClauseContext): boolean {
    if (!expression || expression.trim() === "") {
      return true;
    }

    try {
      return this.evaluateExpression(expression.trim(), context);
    } catch (error) {
      console.warn(`[WhenClauseEvaluator] Failed to evaluate "${expression}":`, error);
      return false;
    }
  }

  private evaluateExpression(expr: string, context: WhenClauseContext): boolean {
    // Handle OR expressions (lowest precedence)
    const orParts = this.splitByOperator(expr, "||");
    if (orParts.length > 1) {
      return orParts.some((part) => this.evaluateExpression(part.trim(), context));
    }

    // Handle AND expressions
    const andParts = this.splitByOperator(expr, "&&");
    if (andParts.length > 1) {
      return andParts.every((part) => this.evaluateExpression(part.trim(), context));
    }

    // Handle NOT expressions
    if (expr.startsWith("!")) {
      return !this.evaluateExpression(expr.slice(1).trim(), context);
    }

    // Handle parentheses
    if (expr.startsWith("(") && expr.endsWith(")")) {
      return this.evaluateExpression(expr.slice(1, -1).trim(), context);
    }

    // Handle comparison operators
    return this.evaluateComparison(expr, context);
  }

  private evaluateComparison(expr: string, context: WhenClauseContext): boolean {
    // Regex match: key =~ /pattern/
    const regexMatch = expr.match(/^(\S+)\s*=~\s*\/(.+)\/([gimsuy]*)$/);
    if (regexMatch) {
      const [, key, pattern, flags] = regexMatch;
      const value = this.getContextValue(key, context);
      if (typeof value !== "string") return false;
      try {
        const regex = new RegExp(pattern, flags);
        return regex.test(value);
      } catch {
        return false;
      }
    }

    // Equality: key == value
    const eqMatch = expr.match(/^(\S+)\s*==\s*(.+)$/);
    if (eqMatch) {
      const [, key, rawValue] = eqMatch;
      const contextValue = this.getContextValue(key, context);
      const compareValue = this.parseValue(rawValue.trim());
      return contextValue === compareValue;
    }

    // Inequality: key != value
    const neqMatch = expr.match(/^(\S+)\s*!=\s*(.+)$/);
    if (neqMatch) {
      const [, key, rawValue] = neqMatch;
      const contextValue = this.getContextValue(key, context);
      const compareValue = this.parseValue(rawValue.trim());
      return contextValue !== compareValue;
    }

    // In operator: key in list
    const inMatch = expr.match(/^(\S+)\s+in\s+'([^']+)'$/);
    if (inMatch) {
      const [, key, listStr] = inMatch;
      const contextValue = this.getContextValue(key, context);
      const list = listStr.split(",").map((s) => s.trim());
      return list.includes(String(contextValue));
    }

    // Not in operator: key not in list
    const notInMatch = expr.match(/^(\S+)\s+not\s+in\s+'([^']+)'$/);
    if (notInMatch) {
      const [, key, listStr] = notInMatch;
      const contextValue = this.getContextValue(key, context);
      const list = listStr.split(",").map((s) => s.trim());
      return !list.includes(String(contextValue));
    }

    // Simple context key check (truthy)
    const value = this.getContextValue(expr, context);
    return Boolean(value);
  }

  private splitByOperator(expr: string, operator: string): string[] {
    const parts: string[] = [];
    let current = "";
    let depth = 0;
    let i = 0;

    while (i < expr.length) {
      const char = expr[i];

      if (char === "(") {
        depth++;
        current += char;
      } else if (char === ")") {
        depth--;
        current += char;
      } else if (depth === 0 && expr.slice(i, i + operator.length) === operator) {
        parts.push(current);
        current = "";
        i += operator.length - 1;
      } else {
        current += char;
      }
      i++;
    }

    if (current) {
      parts.push(current);
    }

    return parts;
  }

  private getContextValue(key: string, context: WhenClauseContext): unknown {
    // Handle nested keys like "config.editor.fontSize"
    const parts = key.split(".");
    let value: unknown = context;

    for (const part of parts) {
      if (value === null || value === undefined) {
        return undefined;
      }
      value = (value as Record<string, unknown>)[part];
    }

    return value;
  }

  private parseValue(raw: string): unknown {
    // String literals
    if ((raw.startsWith("'") && raw.endsWith("'")) || 
        (raw.startsWith('"') && raw.endsWith('"'))) {
      return raw.slice(1, -1);
    }

    // Boolean
    if (raw === "true") return true;
    if (raw === "false") return false;

    // Number
    const num = Number(raw);
    if (!isNaN(num)) return num;

    // Return as-is (could be a context key reference)
    return raw;
  }
}

// ============================================================================
// Menu Registry
// ============================================================================

/**
 * Registry for managing menu contributions from extensions.
 */
export class MenuRegistry {
  private readonly _items = new Map<MenuLocation, Map<string, RegisteredMenuItem>>();
  private readonly _submenus = new Map<string, RegisteredSubmenu>();
  private readonly _submenuItems = new Map<string, Map<string, RegisteredMenuItem>>();
  private readonly _disposables = new DisposableStore();
  private readonly _whenEvaluator = new WhenClauseEvaluator();

  private readonly _onDidChangeMenus = new EventEmitter<MenusChangedEvent>();
  readonly onDidChangeMenus: Event<MenusChangedEvent> = this._onDidChangeMenus.event;

  private _idCounter = 0;

  constructor() {
    this._disposables.add(this._onDidChangeMenus);
  }

  /**
   * Register a menu item at a specific location.
   */
  registerMenuItem(
    extensionId: string,
    location: MenuLocation,
    item: MenuItem
  ): Disposable {
    const id = `${extensionId}.menu.${++this._idCounter}`;

    const registered: RegisteredMenuItem = {
      ...item,
      id,
      extensionId,
      registeredAt: Date.now(),
    };

    if (!this._items.has(location)) {
      this._items.set(location, new Map());
    }

    this._items.get(location)!.set(id, registered);

    this._onDidChangeMenus.fire({ location, changeType: "added" });

    return createDisposable(() => {
      const locationItems = this._items.get(location);
      if (locationItems) {
        locationItems.delete(id);
        if (locationItems.size === 0) {
          this._items.delete(location);
        }
        this._onDidChangeMenus.fire({ location, changeType: "removed" });
      }
    });
  }

  /**
   * Register multiple menu items at once.
   */
  registerMenuItems(
    extensionId: string,
    items: Array<{ location: MenuLocation; item: MenuItem }>
  ): Disposable {
    const disposables = items.map(({ location, item }) =>
      this.registerMenuItem(extensionId, location, item)
    );

    return createDisposable(() => {
      disposables.forEach((d) => d.dispose());
    });
  }

  /**
   * Register a submenu.
   */
  registerSubmenu(
    extensionId: string,
    location: MenuLocation,
    submenu: Submenu
  ): Disposable {
    const registered: RegisteredSubmenu = {
      ...submenu,
      extensionId,
      registeredAt: Date.now(),
    };

    this._submenus.set(submenu.id, registered);
    this._submenuItems.set(submenu.id, new Map());

    // Register the submenu as a menu item at the location
    const menuItem: MenuItem = {
      command: `_submenu.${submenu.id}`,
      when: submenu.when,
      group: submenu.group,
      order: submenu.order,
    };

    const itemDisposable = this.registerMenuItem(extensionId, location, menuItem);

    this._onDidChangeMenus.fire({ location, changeType: "added" });

    return createDisposable(() => {
      itemDisposable.dispose();
      this._submenus.delete(submenu.id);
      this._submenuItems.delete(submenu.id);
    });
  }

  /**
   * Register an item within a submenu.
   */
  registerSubmenuItem(
    extensionId: string,
    submenuId: string,
    item: MenuItem
  ): Disposable {
    const submenuItems = this._submenuItems.get(submenuId);
    if (!submenuItems) {
      console.warn(`[MenuRegistry] Submenu "${submenuId}" not found`);
      return createDisposable(() => {});
    }

    const id = `${extensionId}.submenu.${submenuId}.${++this._idCounter}`;

    const registered: RegisteredMenuItem = {
      ...item,
      id,
      extensionId,
      registeredAt: Date.now(),
    };

    submenuItems.set(id, registered);

    return createDisposable(() => {
      submenuItems.delete(id);
    });
  }

  /**
   * Get all menu items for a location, filtered by context.
   */
  getMenuItems(
    location: MenuLocation,
    context: WhenClauseContext,
    commandResolver?: (commandId: string) => Command | undefined
  ): ResolvedMenuItem[] {
    const items = this._items.get(location);
    if (!items) {
      return [];
    }

    const resolved: ResolvedMenuItem[] = [];

    for (const item of items.values()) {
      // Evaluate when clause
      const visible = this._whenEvaluator.evaluate(item.when, context);
      if (!visible) {
        continue;
      }

      // Check if this is a submenu
      if (item.command.startsWith("_submenu.")) {
        const submenuId = item.command.slice(9);
        const submenu = this._submenus.get(submenuId);
        if (submenu) {
          const children = this.getSubmenuItems(submenuId, context, commandResolver);
          if (children.length > 0) {
            resolved.push({
              command: {
                title: submenu.label,
                command: item.command,
              },
              group: item.group || "navigation",
              order: item.order ?? 0,
              isSubmenu: true,
              submenuId,
              children,
              enabled: true,
              visible: true,
            });
          }
        }
        continue;
      }

      // Resolve the command
      const command = commandResolver?.(item.command) ?? {
        title: item.command,
        command: item.command,
        arguments: item.args,
      };

      let altCommand: Command | undefined;
      if (item.alt) {
        altCommand = commandResolver?.(item.alt) ?? {
          title: item.alt,
          command: item.alt,
        };
      }

      resolved.push({
        command,
        alt: altCommand,
        group: item.group || "navigation",
        order: item.order ?? 0,
        isSubmenu: false,
        enabled: true,
        visible: true,
      });
    }

    // Sort by group and order
    return this.sortMenuItems(resolved);
  }

  /**
   * Get items within a submenu.
   */
  private getSubmenuItems(
    submenuId: string,
    context: WhenClauseContext,
    commandResolver?: (commandId: string) => Command | undefined
  ): ResolvedMenuItem[] {
    const items = this._submenuItems.get(submenuId);
    if (!items) {
      return [];
    }

    const resolved: ResolvedMenuItem[] = [];

    for (const item of items.values()) {
      const visible = this._whenEvaluator.evaluate(item.when, context);
      if (!visible) {
        continue;
      }

      const command = commandResolver?.(item.command) ?? {
        title: item.command,
        command: item.command,
        arguments: item.args,
      };

      resolved.push({
        command,
        group: item.group || "navigation",
        order: item.order ?? 0,
        isSubmenu: false,
        enabled: true,
        visible: true,
      });
    }

    return this.sortMenuItems(resolved);
  }

  /**
   * Sort menu items by group and order.
   * Groups are sorted alphabetically, with special handling for:
   * - "navigation" group appears first
   * - Groups with "@" prefix define explicit ordering
   */
  private sortMenuItems(items: ResolvedMenuItem[]): ResolvedMenuItem[] {
    return items.sort((a, b) => {
      // Parse group with potential order suffix (e.g., "1_modification@1")
      const parseGroup = (group: string): { name: string; priority: number } => {
        const atIndex = group.indexOf("@");
        if (atIndex >= 0) {
          return {
            name: group.slice(0, atIndex),
            priority: parseInt(group.slice(atIndex + 1), 10) || 0,
          };
        }
        // Handle numbered prefixes like "1_modification"
        const match = group.match(/^(\d+)_(.+)$/);
        if (match) {
          return { name: match[2], priority: parseInt(match[1], 10) };
        }
        return { name: group, priority: 50 }; // Default priority
      };

      const groupA = parseGroup(a.group);
      const groupB = parseGroup(b.group);

      // "navigation" always comes first
      if (groupA.name === "navigation" && groupB.name !== "navigation") return -1;
      if (groupB.name === "navigation" && groupA.name !== "navigation") return 1;

      // Sort by group priority
      if (groupA.priority !== groupB.priority) {
        return groupA.priority - groupB.priority;
      }

      // Sort by group name
      if (groupA.name !== groupB.name) {
        return groupA.name.localeCompare(groupB.name);
      }

      // Within same group, sort by order
      return a.order - b.order;
    });
  }

  /**
   * Check if a location has any registered items.
   */
  hasItems(location: MenuLocation): boolean {
    return this._items.has(location) && this._items.get(location)!.size > 0;
  }

  /**
   * Get all registered locations.
   */
  getLocations(): MenuLocation[] {
    return Array.from(this._items.keys());
  }

  /**
   * Get all items for a location (unfiltered, for debugging).
   */
  getAllItems(location: MenuLocation): RegisteredMenuItem[] {
    const items = this._items.get(location);
    return items ? Array.from(items.values()) : [];
  }

  /**
   * Get a registered submenu by ID.
   */
  getSubmenu(submenuId: string): RegisteredSubmenu | undefined {
    return this._submenus.get(submenuId);
  }

  /**
   * Remove all items registered by an extension.
   */
  removeExtensionItems(extensionId: string): void {
    const changedLocations = new Set<MenuLocation>();

    // Remove menu items
    for (const [location, items] of this._items) {
      for (const [id, item] of items) {
        if (item.extensionId === extensionId) {
          items.delete(id);
          changedLocations.add(location);
        }
      }
      if (items.size === 0) {
        this._items.delete(location);
      }
    }

    // Remove submenus
    for (const [id, submenu] of this._submenus) {
      if (submenu.extensionId === extensionId) {
        this._submenus.delete(id);
        this._submenuItems.delete(id);
      }
    }

    // Remove submenu items
    for (const items of this._submenuItems.values()) {
      for (const [id, item] of items) {
        if (item.extensionId === extensionId) {
          items.delete(id);
        }
      }
    }

    // Fire change events
    for (const location of changedLocations) {
      this._onDidChangeMenus.fire({ location, changeType: "removed" });
    }
  }

  /**
   * Clear all registrations.
   */
  clear(): void {
    this._items.clear();
    this._submenus.clear();
    this._submenuItems.clear();
    this._idCounter = 0;
  }

  /**
   * Dispose the registry.
   */
  dispose(): void {
    this.clear();
    this._disposables.dispose();
  }
}

// ============================================================================
// Menu Contribution API
// ============================================================================

/**
 * API interface for extensions to contribute menus.
 */
export interface MenusApi {
  /**
   * Register a menu item at a location.
   */
  registerMenuItem(location: MenuLocation, item: MenuItem): Disposable;

  /**
   * Register multiple menu items.
   */
  registerMenuItems(
    items: Array<{ location: MenuLocation; item: MenuItem }>
  ): Disposable;

  /**
   * Register a submenu at a location.
   */
  registerSubmenu(location: MenuLocation, submenu: Submenu): Disposable;

  /**
   * Register an item within a submenu.
   */
  registerSubmenuItem(submenuId: string, item: MenuItem): Disposable;

  /**
   * Get menu items for a location with the current context.
   */
  getMenuItems(location: MenuLocation): ResolvedMenuItem[];

  /**
   * Event fired when menus change.
   */
  readonly onDidChangeMenus: Event<MenusChangedEvent>;
}

/**
 * Create the menus API for an extension.
 */
export function createMenusApi(
  extensionId: string,
  registry: MenuRegistry,
  disposables: DisposableStore,
  getContext: () => WhenClauseContext,
  commandResolver?: (commandId: string) => Command | undefined
): MenusApi {
  return {
    registerMenuItem(location: MenuLocation, item: MenuItem): Disposable {
      const disposable = registry.registerMenuItem(extensionId, location, item);
      disposables.add(disposable);
      return disposable;
    },

    registerMenuItems(
      items: Array<{ location: MenuLocation; item: MenuItem }>
    ): Disposable {
      const disposable = registry.registerMenuItems(extensionId, items);
      disposables.add(disposable);
      return disposable;
    },

    registerSubmenu(location: MenuLocation, submenu: Submenu): Disposable {
      const disposable = registry.registerSubmenu(extensionId, location, submenu);
      disposables.add(disposable);
      return disposable;
    },

    registerSubmenuItem(submenuId: string, item: MenuItem): Disposable {
      const disposable = registry.registerSubmenuItem(extensionId, submenuId, item);
      disposables.add(disposable);
      return disposable;
    },

    getMenuItems(location: MenuLocation): ResolvedMenuItem[] {
      return registry.getMenuItems(location, getContext(), commandResolver);
    },

    onDidChangeMenus: registry.onDidChangeMenus,
  };
}

// ============================================================================
// Default Context Provider
// ============================================================================

/**
 * Creates a default context provider for when clause evaluation.
 */
export function createDefaultContextProvider(): () => WhenClauseContext {
  // This would be connected to the actual application state
  const context: WhenClauseContext = {
    isWindows: typeof navigator !== "undefined" && navigator.platform.includes("Win"),
    isMac: typeof navigator !== "undefined" && navigator.platform.includes("Mac"),
    isLinux: typeof navigator !== "undefined" && navigator.platform.includes("Linux"),
    isWeb: typeof window !== "undefined",
  };

  return () => ({ ...context });
}

// ============================================================================
// Exports
// ============================================================================

// Note: WhenClauseEvaluator and MenuRegistry are already exported at their class definitions

/**
 * Global menu registry instance.
 */
let globalMenuRegistry: MenuRegistry | undefined;

/**
 * Get or create the global menu registry.
 */
export function getGlobalMenuRegistry(): MenuRegistry {
  if (!globalMenuRegistry) {
    globalMenuRegistry = new MenuRegistry();
  }
  return globalMenuRegistry;
}

/**
 * Reset the global menu registry (for testing).
 */
export function resetGlobalMenuRegistry(): void {
  globalMenuRegistry?.dispose();
  globalMenuRegistry = undefined;
}
