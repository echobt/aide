/**
 * =============================================================================
 * ACTIVITY BAR COMPONENT - VS Code-style Vertical Icon Bar
 * =============================================================================
 * 
 * A production-quality Activity Bar component for Orion Desktop, modeled after
 * VS Code's left vertical icon bar with JetBrains-inspired styling.
 * 
 * Features:
 * - Vertical icon bar with configurable position (left/right)
 * - View container icons (Explorer, Search, Git, Debug, Extensions, etc.)
 * - Icon badges for notification counts
 * - Active/selected state with indicator
 * - Drag to reorder icons
 * - Context menu (hide, move, reset order)
 * - Bottom section for Settings and Accounts
 * - State persistence via localStorage
 * - Respects workbench.activityBar.visible and location settings
 * 
 * @module components/ActivityBar
 * =============================================================================
 */

import {
  createSignal,
  createEffect,
  createMemo,
  onMount,
  onCleanup,
  For,
  Show,
  JSX,
  Component,
} from "solid-js";
import { Portal } from "solid-js/web";
import { createStore, produce } from "solid-js/store";
import { Icon } from "./ui/Icon";
import { tokens } from "@/design-system/tokens";
import { Tooltip } from "@/components/ui/Tooltip";
import { useSettings, ActivityBarLocation } from "@/context/SettingsContext";

// =============================================================================
// Types & Constants
// =============================================================================

/** View container identifiers */
export type ActivityBarViewId = 
  | "explorer"
  | "search"
  | "scm"
  | "debug"
  | "extensions"
  | "agents"
  | "testing"
  | "remote"
  | "factory"
  | "custom";

/** Activity bar item configuration */
export interface ActivityBarItem {
  id: string;
  viewId: ActivityBarViewId;
  iconName: string;
  label: string;
  badge?: number;
  visible: boolean;
  order: number;
  isBuiltin: boolean;
}

/** Activity bar state */
export interface ActivityBarState {
  items: ActivityBarItem[];
  activeItemId: string | null;
  hiddenItems: Set<string>;
  order: string[];
  sidebarVisible: boolean;
}

/** Context menu item */
interface ContextMenuItem {
  id: string;
  label: string;
  iconName?: string;
  checked?: boolean;
  disabled?: boolean;
  separator?: boolean;
  action?: () => void;
}

// Storage keys
const STORAGE_KEY_ORDER = "activitybar_order";
const STORAGE_KEY_HIDDEN = "activitybar_hidden";
const STORAGE_KEY_ACTIVE = "activitybar_active";

// Default items configuration
const DEFAULT_ITEMS: ActivityBarItem[] = [
  { id: "explorer", viewId: "explorer", iconName: "folder", label: "Explorer", visible: true, order: 0, isBuiltin: true },
  { id: "search", viewId: "search", iconName: "magnifying-glass", label: "Search", visible: true, order: 1, isBuiltin: true },
  { id: "scm", viewId: "scm", iconName: "code-branch", label: "Source Control", visible: true, order: 2, isBuiltin: true },
  { id: "debug", viewId: "debug", iconName: "play", label: "Run and Debug", visible: true, order: 3, isBuiltin: true },
  { id: "extensions", viewId: "extensions", iconName: "box", label: "Extensions", visible: true, order: 4, isBuiltin: true },
  { id: "agents", viewId: "agents", iconName: "users", label: "AI Agents", visible: true, order: 5, isBuiltin: true },
  { id: "factory", viewId: "factory", iconName: "grid", label: "Agent Factory", visible: true, order: 6, isBuiltin: true },
  { id: "testing", viewId: "testing", iconName: "code", label: "Testing", visible: true, order: 7, isBuiltin: true },
  { id: "remote", viewId: "remote", iconName: "cloud", label: "Remote Explorer", visible: true, order: 8, isBuiltin: true },
];

// =============================================================================
// Helper Functions
// =============================================================================

function loadPersistedState(): { order: string[]; hidden: string[]; active: string | null } {
  try {
    const order = JSON.parse(localStorage.getItem(STORAGE_KEY_ORDER) || "[]");
    const hidden = JSON.parse(localStorage.getItem(STORAGE_KEY_HIDDEN) || "[]");
    const active = localStorage.getItem(STORAGE_KEY_ACTIVE);
    return { order, hidden, active };
  } catch {
    return { order: [], hidden: [], active: null };
  }
}

function savePersistedState(order: string[], hidden: string[], active: string | null): void {
  try {
    localStorage.setItem(STORAGE_KEY_ORDER, JSON.stringify(order));
    localStorage.setItem(STORAGE_KEY_HIDDEN, JSON.stringify(hidden));
    if (active) {
      localStorage.setItem(STORAGE_KEY_ACTIVE, active);
    } else {
      localStorage.removeItem(STORAGE_KEY_ACTIVE);
    }
  } catch (e) {
    console.error("Failed to save activity bar state:", e);
  }
}

// =============================================================================
// Activity Bar Item Component
// =============================================================================

interface ActivityBarItemProps {
  item: ActivityBarItem;
  isActive: boolean;
  position: "left" | "right";
  onClick: () => void;
  onDoubleClick: () => void;
  onContextMenu: (e: MouseEvent) => void;
  onDragStart: (e: DragEvent) => void;
  onDragOver: (e: DragEvent) => void;
  onDrop: (e: DragEvent) => void;
  onDragEnd: () => void;
  isDragging: boolean;
  isDragOver: boolean;
}

function ActivityBarItemComponent(props: ActivityBarItemProps) {
  const [showTooltip, setShowTooltip] = createSignal(false);
  const [tooltipPos, setTooltipPos] = createSignal({ x: 0, y: 0 });
  let buttonRef: HTMLButtonElement | undefined;
  let tooltipTimeout: ReturnType<typeof setTimeout> | null = null;

  const handleMouseEnter = () => {
    tooltipTimeout = setTimeout(() => {
      if (buttonRef) {
        const rect = buttonRef.getBoundingClientRect();
        setTooltipPos({
          x: props.position === "left" ? rect.right + 8 : rect.left - 8,
          y: rect.top + rect.height / 2,
        });
        setShowTooltip(true);
      }
    }, 500);
  };

  const handleMouseLeave = () => {
    if (tooltipTimeout) {
      clearTimeout(tooltipTimeout);
      tooltipTimeout = null;
    }
    setShowTooltip(false);
  };

  onCleanup(() => {
    if (tooltipTimeout) clearTimeout(tooltipTimeout);
  });

  return (
    <>
      <button
        ref={buttonRef}
        class="activity-bar-item"
        draggable={true}
        onClick={props.onClick}
        onDblClick={props.onDoubleClick}
        onContextMenu={props.onContextMenu}
        onDragStart={props.onDragStart}
        onDragOver={props.onDragOver}
        onDrop={props.onDrop}
        onDragEnd={props.onDragEnd}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        aria-pressed={props.isActive}
        aria-label={props.item.label}
        style={{
          position: "relative",
          display: "flex",
          "align-items": "center",
          "justify-content": "center",
          width: "44px",
          height: "44px",
          border: "none",
          background: props.isActive ? "rgba(255, 255, 255, 0.12)" : "transparent",
          color: props.isActive ? "var(--cortex-text-primary)" : tokens.colors.icon.inactive,
          opacity: props.isDragging ? "0.5" : props.isActive ? "1" : "0.7",
          cursor: "pointer",
          "border-radius": tokens.radius.sm,
          transition: "background-color 0.15s ease, color 0.15s ease, opacity 0.15s ease",
          outline: props.isDragOver ? `2px solid ${tokens.colors.accent.primary}` : "none",
          "outline-offset": "-2px",
        }}
      >
        {/* Active indicator line */}
        <Show when={props.isActive}>
          <div
            style={{
              position: "absolute",
              [props.position === "left" ? "left" : "right"]: "0",
              top: "8px",
              bottom: "8px",
              width: "2px",
              background: tokens.colors.semantic.primary,
              "border-radius": "var(--cortex-radius-sm)",
            }}
          />
        </Show>

        {/* Icon */}
        <Icon
          name={props.item.iconName}
          size={30}
        />

        {/* Badge */}
        <Show when={(props.item.badge ?? 0) > 0}>
          <div
            style={{
              position: "absolute",
              top: "6px",
              right: "6px",
              "min-width": "16px",
              height: "16px",
              display: "flex",
              "align-items": "center",
              "justify-content": "center",
              padding: "0 4px",
              background: tokens.colors.semantic.primary,
              color: "var(--cortex-text-primary)",
              "font-size": "10px",
              "font-weight": "600",
              "border-radius": "var(--cortex-radius-md)",
              "line-height": "1",
            }}
          >
            {(props.item.badge ?? 0) > 99 ? "99+" : props.item.badge}
          </div>
        </Show>
      </button>

      {/* Tooltip Portal */}
      <Show when={showTooltip()}>
        <Portal>
          <div
            class="activity-bar-tooltip"
            style={{
              position: "fixed",
              left: props.position === "left" ? `${tooltipPos().x}px` : "auto",
              right: props.position === "right" ? `calc(100vw - ${tooltipPos().x}px)` : "auto",
              top: `${tooltipPos().y}px`,
              transform: "translateY(-50%)",
              "z-index": String(tokens.zIndex.tooltip),
              "pointer-events": "none",
            }}
          >
            <div
              style={{
                background: tokens.colors.surface.popup,
                color: tokens.colors.text.primary,
                "font-size": tokens.typography.fontSize.base,
                "font-family": tokens.typography.fontFamily.ui,
                padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
                "border-radius": tokens.radius.md,
                "box-shadow": tokens.shadows.popup,
                "white-space": "nowrap",
                border: `1px solid ${tokens.colors.border.default}`,
              }}
            >
              {props.item.label}
              <Show when={(props.item.badge ?? 0) > 0}>
                <span
                  style={{
                    "margin-left": tokens.spacing.md,
                    padding: `2px ${tokens.spacing.sm}`,
                    background: tokens.colors.semantic.primary,
                    color: "var(--cortex-text-primary)",
                    "font-size": tokens.typography.fontSize.sm,
                    "border-radius": tokens.radius.sm,
                  }}
                >
                  {props.item.badge}
                </span>
              </Show>
            </div>
          </div>
        </Portal>
      </Show>
    </>
  );
}

// =============================================================================
// Context Menu Component
// =============================================================================

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

function ContextMenu(props: ContextMenuProps) {
  let menuRef: HTMLDivElement | undefined;

  // Close on click outside
  const handleClickOutside = (e: MouseEvent) => {
    if (menuRef && !menuRef.contains(e.target as Node)) {
      props.onClose();
    }
  };

  // Close on escape
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      props.onClose();
    }
  };

  onMount(() => {
    document.addEventListener("click", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
  });

  onCleanup(() => {
    document.removeEventListener("click", handleClickOutside);
    document.removeEventListener("keydown", handleKeyDown);
  });

  // Adjust position to keep menu on screen
  const adjustedPosition = createMemo(() => {
    const menuWidth = 200;
    const menuHeight = props.items.length * 32;
    let x = props.x;
    let y = props.y;

    if (x + menuWidth > window.innerWidth) {
      x = window.innerWidth - menuWidth - 8;
    }
    if (y + menuHeight > window.innerHeight) {
      y = window.innerHeight - menuHeight - 8;
    }

    return { x, y };
  });

  return (
    <Portal>
      <div
        ref={menuRef}
        class="activity-bar-context-menu"
        style={{
          position: "fixed",
          left: `${adjustedPosition().x}px`,
          top: `${adjustedPosition().y}px`,
          "z-index": String(tokens.zIndex.dropdown),
          "min-width": "180px",
          background: tokens.colors.surface.popup,
          border: `1px solid ${tokens.colors.border.default}`,
          "border-radius": tokens.radius.md,
          "box-shadow": tokens.shadows.popup,
          padding: `${tokens.spacing.sm} 0`,
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <For each={props.items}>
          {(item) => (
            <Show
              when={!item.separator}
              fallback={
                <div
                  style={{
                    height: "1px",
                    background: tokens.colors.border.divider,
                    margin: `${tokens.spacing.sm} ${tokens.spacing.md}`,
                  }}
                />
              }
            >
              <button
                class="context-menu-item"
                disabled={item.disabled}
                onClick={() => {
                  item.action?.();
                  props.onClose();
                }}
                style={{
                  display: "flex",
                  "align-items": "center",
                  gap: tokens.spacing.md,
                  width: "100%",
                  padding: `${tokens.spacing.sm} ${tokens.spacing.lg}`,
                  border: "none",
                  background: "transparent",
                  color: item.disabled ? tokens.colors.text.disabled : tokens.colors.text.primary,
                  "font-size": tokens.typography.fontSize.base,
                  "font-family": tokens.typography.fontFamily.ui,
                  "text-align": "left",
                  cursor: item.disabled ? "not-allowed" : "pointer",
                  opacity: item.disabled ? "0.5" : "1",
                }}
                onMouseEnter={(e) => {
                  if (!item.disabled) {
                    e.currentTarget.style.background = tokens.colors.interactive.hover;
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <Show when={item.iconName}>
                  <Icon name={item.iconName!} size={14} />
                </Show>
                <span style={{ flex: "1" }}>{item.label}</span>
                <Show when={item.checked}>
                  <Icon name="check" size={14} style={{ color: tokens.colors.semantic.primary }} />
                </Show>
              </button>
            </Show>
          )}
        </For>
      </div>
    </Portal>
  );
}

// =============================================================================
// Main Activity Bar Component
// =============================================================================

export interface ActivityBarProps {
  /** Position of the activity bar */
  position?: "left" | "right";
  /** Currently active view ID */
  activeView?: string;
  /** Callback when a view is selected */
  onViewSelect?: (viewId: string) => void;
  /** Callback when sidebar visibility is toggled */
  onToggleSidebar?: () => void;
  /** Whether the sidebar is currently visible */
  sidebarVisible?: boolean;
  /** Badge counts for views */
  badges?: Partial<Record<string, number>>;
  /** Additional custom items */
  customItems?: ActivityBarItem[];
  /** Show account button in bottom section */
  showAccount?: boolean;
  /** Show settings button in bottom section */
  showSettings?: boolean;
  /** Callback when settings is clicked */
  onSettingsClick?: () => void;
  /** Callback when account is clicked */
  onAccountClick?: () => void;
}

export function ActivityBar(props: ActivityBarProps) {
  // Get settings
  let settingsContext: ReturnType<typeof useSettings> | null = null;
  try {
    settingsContext = useSettings();
  } catch {
    // Settings context not available
  }

  // State
  const [items, setItems] = createStore<ActivityBarItem[]>([...DEFAULT_ITEMS]);
  const [hiddenIds, setHiddenIds] = createSignal<Set<string>>(new Set());
  const [activeId, setActiveId] = createSignal<string | null>(null);
  const [draggedId, setDraggedId] = createSignal<string | null>(null);
  const [dragOverId, setDragOverId] = createSignal<string | null>(null);
  const [contextMenu, setContextMenu] = createSignal<{ x: number; y: number; itemId: string | null } | null>(null);

  // Computed values
  const position = () => props.position ?? "left";
  const showAccount = () => props.showAccount ?? true;
  const showSettings = () => props.showSettings ?? true;

  // Visibility based on settings
  const isVisible = createMemo(() => {
    if (!settingsContext) return true;
    const theme = settingsContext.effectiveSettings()?.theme;
    return theme?.activityBarVisible !== false;
  });

  const location = createMemo((): ActivityBarLocation => {
    if (!settingsContext) return "side";
    return settingsContext.effectiveSettings()?.theme?.activityBarPosition ?? "side";
  });

  // Sort items by order
  const sortedItems = createMemo(() => {
    return [...items]
      .filter(item => !hiddenIds().has(item.id))
      .sort((a, b) => a.order - b.order);
  });

  // Get badges from props
  const getBadge = (id: string) => props.badges?.[id] ?? 0;

  // Load persisted state
  onMount(() => {
    const { order, hidden, active } = loadPersistedState();
    
    // Apply hidden items
    setHiddenIds(new Set(hidden));
    
    // Apply order
    if (order.length > 0) {
      setItems(produce((items) => {
        order.forEach((id, index) => {
          const item = items.find(i => i.id === id);
          if (item) {
            item.order = index;
          }
        });
      }));
    }
    
    // Set active item
    if (active) {
      setActiveId(active);
    } else if (props.activeView) {
      setActiveId(props.activeView);
    } else {
      setActiveId(items[0]?.id ?? null);
    }
  });

  // Sync with props.activeView
  createEffect(() => {
    if (props.activeView !== undefined) {
      setActiveId(props.activeView);
    }
  });

  // Persist state changes
  createEffect(() => {
    const order = sortedItems().map(i => i.id);
    const hidden = Array.from(hiddenIds());
    const active = activeId();
    savePersistedState(order, hidden, active);
  });

  // Merge custom items
  createEffect(() => {
    if (props.customItems && props.customItems.length > 0) {
      setItems(produce((items) => {
        props.customItems!.forEach(custom => {
          const existing = items.find(i => i.id === custom.id);
          if (!existing) {
            items.push({ ...custom, order: items.length });
          }
        });
      }));
    }
  });

  // Event handlers
  const handleItemClick = (id: string) => {
    const currentActive = activeId();
    const sidebarVisible = props.sidebarVisible ?? true;

    // Special case: Factory mode switches to full-screen factory view
    if (id === "factory") {
      window.dispatchEvent(new CustomEvent("viewmode:change", { 
        detail: { mode: "factory" } 
      }));
      return;
    }

    // If we're in factory mode and clicking another item, switch back to IDE mode
    const currentMode = localStorage.getItem("cortex_view_mode");
    if (currentMode === "factory") {
      window.dispatchEvent(new CustomEvent("viewmode:change", { 
        detail: { mode: "ide" } 
      }));
    }

    if (currentActive === id && sidebarVisible) {
      // Clicking active item toggles sidebar
      props.onToggleSidebar?.();
    } else {
      // Switch to this view
      setActiveId(id);
      props.onViewSelect?.(id);
      
      // Ensure sidebar is visible
      if (!sidebarVisible) {
        props.onToggleSidebar?.();
      }
    }
  };

  const handleItemDoubleClick = () => {
    // Double-click toggles sidebar
    props.onToggleSidebar?.();
  };

  const handleContextMenu = (e: MouseEvent, itemId: string | null) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, itemId });
  };

  const handleDragStart = (e: DragEvent, id: string) => {
    setDraggedId(id);
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", id);
    }
  };

  const handleDragOver = (e: DragEvent, id: string) => {
    e.preventDefault();
    if (draggedId() && draggedId() !== id) {
      setDragOverId(id);
    }
  };

  const handleDrop = (e: DragEvent, targetId: string) => {
    e.preventDefault();
    const sourceId = draggedId();
    
    if (sourceId && sourceId !== targetId) {
      setItems(produce((items) => {
        const sourceIndex = items.findIndex(i => i.id === sourceId);
        const targetIndex = items.findIndex(i => i.id === targetId);
        
        if (sourceIndex !== -1 && targetIndex !== -1) {
          // Swap orders
          const sourceOrder = items[sourceIndex].order;
          items[sourceIndex].order = items[targetIndex].order;
          items[targetIndex].order = sourceOrder;
        }
      }));
    }
    
    setDraggedId(null);
    setDragOverId(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };

  const toggleItemVisibility = (id: string) => {
    setHiddenIds((prev: Set<string>) => {
      const next = new Set<string>(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const resetOrder = () => {
    setItems(produce((items) => {
      DEFAULT_ITEMS.forEach((def, index) => {
        const item = items.find(i => i.id === def.id);
        if (item) {
          item.order = index;
        }
      });
    }));
    setHiddenIds(new Set<string>());
  };

  // Context menu items
  const getContextMenuItems = (itemId: string | null): ContextMenuItem[] => {
    const menuItems: ContextMenuItem[] = [];

    if (itemId) {
      const item = items.find(i => i.id === itemId);
      if (item) {
        menuItems.push({
          id: "hide",
          label: `Hide ${item.label}`,
          iconName: "eye-slash",
          action: () => toggleItemVisibility(itemId),
        });
      }
    }

    // Hidden items submenu
    const hiddenItems = items.filter(i => hiddenIds().has(i.id));
    if (hiddenItems.length > 0) {
      menuItems.push({ id: "sep1", label: "", separator: true });
      hiddenItems.forEach(item => {
        menuItems.push({
          id: `show-${item.id}`,
          label: `Show ${item.label}`,
          iconName: "eye",
          action: () => toggleItemVisibility(item.id),
        });
      });
    }

    menuItems.push({ id: "sep2", label: "", separator: true });

    // Move position option
    menuItems.push({
      id: "move",
      label: `Move Activity Bar to ${position() === "left" ? "Right" : "Left"}`,
      iconName: "arrows-left-right",
      action: () => {
        if (settingsContext) {
          settingsContext.updateThemeSetting(
            "sidebarPosition",
            position() === "left" ? "right" : "left"
          );
        }
      },
    });

    // Reset order
    menuItems.push({
      id: "reset",
      label: "Reset Order",
      iconName: "rotate",
      action: resetOrder,
    });

    return menuItems;
  };

  // Don't render if not visible or location is not 'side'
  if (!isVisible() || location() !== "side") {
    return null;
  }

  return (
    <aside
      class="activity-bar"
      style={{
        display: "flex",
        "flex-direction": "column",
        width: "48px",
        height: "100%",
        background: "rgba(16, 18, 20, 0.7)",
        "flex-shrink": "0",
        "user-select": "none",
        contain: "layout style",
      }}
      onContextMenu={(e) => handleContextMenu(e, null)}
    >
      {/* Main items section */}
      <div
        class="activity-bar-top"
        style={{
          display: "flex",
          "flex-direction": "column",
          "align-items": "center",
          padding: `${tokens.spacing.sm} ${tokens.spacing.sm}`,
          gap: tokens.spacing.xs,
          flex: "1",
          "overflow-y": "auto",
          "overflow-x": "hidden",
        }}
      >
        <For each={sortedItems()}>
          {(item) => (
            <ActivityBarItemComponent
              item={{ ...item, badge: getBadge(item.id) }}
              isActive={activeId() === item.id}
              position={position()}
              onClick={() => handleItemClick(item.id)}
              onDoubleClick={handleItemDoubleClick}
              onContextMenu={(e) => handleContextMenu(e, item.id)}
              onDragStart={(e) => handleDragStart(e, item.id)}
              onDragOver={(e) => handleDragOver(e, item.id)}
              onDrop={(e) => handleDrop(e, item.id)}
              onDragEnd={handleDragEnd}
              isDragging={draggedId() === item.id}
              isDragOver={dragOverId() === item.id}
            />
          )}
        </For>
      </div>

      {/* Bottom section - Settings and Account */}
      <div
        class="activity-bar-bottom"
        style={{
          display: "flex",
          "flex-direction": "column",
          "align-items": "center",
          padding: `${tokens.spacing.sm} ${tokens.spacing.sm}`,
          gap: tokens.spacing.xs,
          "border-top": `1px solid ${tokens.colors.border.divider}`,
        }}
      >
        <Show when={showAccount()}>
          <Tooltip content="Account" position={position() === "left" ? "right" : "left"}>
            <button
              class="activity-bar-item"
              onClick={props.onAccountClick}
              style={{
                display: "flex",
                "align-items": "center",
                "justify-content": "center",
                width: "44px",
                height: "44px",
                border: "none",
                background: "transparent",
                color: tokens.colors.icon.inactive,
                opacity: "0.7",
                cursor: "pointer",
                "border-radius": tokens.radius.sm,
                transition: "background-color 0.15s ease, color 0.15s ease, opacity 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
                e.currentTarget.style.color = "var(--cortex-text-primary)";
                e.currentTarget.style.opacity = "1";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = tokens.colors.icon.inactive;
                e.currentTarget.style.opacity = "0.7";
              }}
              aria-label="Account"
            >
              <Icon name="user" size={30} />
            </button>
          </Tooltip>
        </Show>

        <Show when={showSettings()}>
          <Tooltip content="Settings" position={position() === "left" ? "right" : "left"}>
            <button
              class="activity-bar-item"
              onClick={props.onSettingsClick}
              style={{
                display: "flex",
                "align-items": "center",
                "justify-content": "center",
                width: "44px",
                height: "44px",
                border: "none",
                background: "transparent",
                color: tokens.colors.icon.inactive,
                opacity: "0.7",
                cursor: "pointer",
                "border-radius": tokens.radius.sm,
                transition: "background-color 0.15s ease, color 0.15s ease, opacity 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
                e.currentTarget.style.color = "var(--cortex-text-primary)";
                e.currentTarget.style.opacity = "1";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = tokens.colors.icon.inactive;
                e.currentTarget.style.opacity = "0.7";
              }}
              aria-label="Settings"
            >
              <Icon name="gear" size={30} />
            </button>
          </Tooltip>
        </Show>
      </div>

      {/* Context Menu */}
      <Show when={contextMenu()}>
        {(menu) => (
          <ContextMenu
            x={menu().x}
            y={menu().y}
            items={getContextMenuItems(menu().itemId)}
            onClose={() => setContextMenu(null)}
          />
        )}
      </Show>
    </aside>
  );
}

// =============================================================================
// Exports
// =============================================================================

export default ActivityBar;

