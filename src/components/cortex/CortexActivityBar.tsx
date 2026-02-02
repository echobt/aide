/**
 * CortexActivityBar - Pixel-perfect activity bar matching Figma design
 * Figma node 1579:54342: x:8, y:69, 40×480px
 * 
 * Structure:
 * - Card container: 40×480px with rounded corners and dark background
 * - Inner padding: 4px
 * - Icons: 32×32px containers with 20×20px icons, 8px gap (40px total per item)
 * - Active icon: lime background with dark icon
 */

import { Component, JSX, splitProps, createSignal, For, Show } from "solid-js";
import { CortexIcon, CortexTooltip, CortexToggle } from "./primitives";

export interface ActivityBarItem {
  id: string;
  icon: string;
  label: string;
  badge?: number;
}

export interface CortexActivityBarProps {
  items?: ActivityBarItem[];
  activeId?: string | null;
  onItemClick?: (id: string) => void;
  avatarUrl?: string;
  onAvatarClick?: () => void;
  showToggle?: boolean;
  toggleValue?: boolean;
  onToggleChange?: (value: boolean) => void;
  class?: string;
  style?: JSX.CSSProperties;
}

// Default navigation items matching Figma design (12 items)
// Figma: Sidebar Container at x:8, y:69, 40×481px
const DEFAULT_ITEMS: ActivityBarItem[] = [
  { id: "home", icon: "home", label: "Home" },
  { id: "new", icon: "plus", label: "New" },
  { id: "files", icon: "folder", label: "Explorer" },
  { id: "git", icon: "git", label: "Source Control" },
  { id: "debug", icon: "play", label: "Run & Debug" },
  { id: "extensions", icon: "box", label: "Extensions" },
  { id: "agents", icon: "users", label: "AI Agents" },
  { id: "packages", icon: "cube", label: "Packages" },
  { id: "factory", icon: "grid", label: "Factory" },
  { id: "docs", icon: "book", label: "Documentation" },
  { id: "maps", icon: "map", label: "Code Maps" },
  { id: "themes", icon: "paintbrush", label: "Themes" },
];

export const CortexActivityBar: Component<CortexActivityBarProps> = (props) => {
  const [local, others] = splitProps(props, [
    "items",
    "activeId",
    "onItemClick",
    "avatarUrl",
    "onAvatarClick",
    "showToggle",
    "toggleValue",
    "onToggleChange",
    "class",
    "style",
  ]);

  const items = () => local.items || DEFAULT_ITEMS;

  // Main container - 40px width with card background (Figma: Sidebar Container)
  // Figma: x:8, y:69, 40×481px (main nav) + 40×77px (bottom section)
  const containerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "flex-direction": "column",
    width: "40px",
    height: "calc(100% - 16px)", // Full height minus margins
    "margin-left": "8px", // Figma: x:8
    "margin-top": "8px", // Gap from titlebar (y:69 - titlebar 58 = 11, rounded to 8)
    "margin-bottom": "8px",
    background: "var(--cortex-bg-primary)", // Card background per Figma
    "border-radius": "var(--cortex-radius-lg)", // Rounded card corners
    border: "1px solid var(--cortex-border-default, rgba(255,255,255,0.1))",
    padding: "0",
    "flex-shrink": "0",
    ...local.style,
  });

  // Main navigation section - inner container with 4px padding
  const mainNavStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "flex-direction": "column",
    padding: "4px",
    gap: "8px", // 40px total per item (32px icon + 8px gap)
    flex: "1",
    "overflow-y": "auto",
    "overflow-x": "hidden",
  });

  // Bottom section - 40×77px
  const bottomSectionStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "flex-direction": "column",
    "align-items": "center",
    padding: "4px",
    gap: "12px",
    "border-top": "1px solid var(--cortex-border-default, rgba(255,255,255,0.1))",
  });

  // Hide scrollbar
  const scrollbarHideStyle = `
    .figma-activity-bar-nav::-webkit-scrollbar {
      display: none;
    }
  `;

  return (
    <>
      <style>{scrollbarHideStyle}</style>
      <aside class={`${local.class || ""}`} style={containerStyle()} {...others}>
        {/* Main Navigation */}
        <nav class="figma-activity-bar-nav" style={mainNavStyle()}>
          <For each={items()}>
            {(item) => (
              <ActivityBarButton
                item={item}
                isActive={local.activeId === item.id}
                onClick={() => local.onItemClick?.(item.id)}
              />
            )}
          </For>
        </nav>

        {/* Bottom Section */}
        <div style={bottomSectionStyle()}>
          {/* Avatar */}
          <AvatarButton
            avatarUrl={local.avatarUrl}
            onClick={local.onAvatarClick}
          />

          {/* Toggle (if enabled) */}
          <Show when={local.showToggle}>
            <CortexToggle
              checked={local.toggleValue}
              onChange={local.onToggleChange}
              size="sm"
            />
          </Show>
        </div>
      </aside>
    </>
  );
};

/**
 * ActivityBarButton - Individual navigation button
 * Container: 32×32px, Icon: 20×20px, Padding: 6px
 */
interface ActivityBarButtonProps {
  item: ActivityBarItem;
  isActive: boolean;
  onClick: () => void;
}

const ActivityBarButton: Component<ActivityBarButtonProps> = (props) => {
  const [isHovered, setIsHovered] = createSignal(false);

  const buttonStyle = (): JSX.CSSProperties => ({
    position: "relative",
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    width: "32px",
    height: "32px",
    background: props.isActive || isHovered()
      ? "var(--cortex-bg-hover, rgba(255,255,255,0.05))"
      : "transparent",
    border: "none",
    "border-radius": "var(--cortex-radius-md, 8px)",
    cursor: "pointer",
    transition: "all var(--cortex-transition-fast, 100ms ease)",
    padding: "0",
  });

  const activeIndicatorStyle = (): JSX.CSSProperties => ({
    position: "absolute",
    left: "0",
    top: "6px",
    bottom: "6px",
    width: "2px",
    background: "var(--cortex-accent-primary, var(--cortex-accent-primary))",
    "border-radius": "var(--cortex-radius-sm)",
    opacity: props.isActive ? "1" : "0",
    transition: "opacity var(--cortex-transition-fast, 100ms ease)",
  });

  const iconColor = () => {
    if (props.isActive) return "var(--cortex-accent-primary, var(--cortex-accent-primary))";
    if (isHovered()) return "var(--cortex-accent-primary, var(--cortex-accent-primary))";
    return "var(--cortex-text-muted, var(--cortex-text-inactive))";
  };

  const badgeStyle = (): JSX.CSSProperties => ({
    position: "absolute",
    top: "2px",
    right: "2px",
    "min-width": "14px",
    height: "14px",
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    padding: "0 4px",
    background: "var(--cortex-accent-primary, var(--cortex-accent-primary))",
    color: "var(--cortex-accent-text, var(--cortex-bg-secondary))",
    "font-family": "var(--cortex-font-sans, Inter, sans-serif)",
    "font-size": "9px",
    "font-weight": "600",
    "border-radius": "var(--cortex-radius-md)",
    "line-height": "1",
  });

  return (
    <CortexTooltip content={props.item.label} position="right">
      <button
        style={buttonStyle()}
        onClick={props.onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        aria-pressed={props.isActive}
        aria-label={props.item.label}
      >
        {/* Active Indicator */}
        <div style={activeIndicatorStyle()} />

        {/* Icon */}
        <CortexIcon
          name={props.item.icon}
          size={20}
          color={iconColor()}
          style={{ transition: "color var(--cortex-transition-fast, 100ms ease)" }}
        />

        {/* Badge */}
        <Show when={(props.item.badge ?? 0) > 0}>
          <span style={badgeStyle()}>
            {(props.item.badge ?? 0) > 99 ? "99+" : props.item.badge}
          </span>
        </Show>
      </button>
    </CortexTooltip>
  );
};

/**
 * AvatarButton - User avatar button
 * Size: 32×32px
 */
interface AvatarButtonProps {
  avatarUrl?: string;
  onClick?: () => void;
}

const AvatarButton: Component<AvatarButtonProps> = (props) => {
  const [isHovered, setIsHovered] = createSignal(false);

  const buttonStyle = (): JSX.CSSProperties => ({
    width: "32px",
    height: "32px",
    "border-radius": "var(--cortex-radius-full)",
    background: "var(--cortex-bg-tertiary, var(--cortex-bg-hover))",
    border: isHovered()
      ? "2px solid var(--cortex-accent-primary, var(--cortex-accent-primary))"
      : "2px solid var(--cortex-border-default, rgba(255,255,255,0.2))",
    cursor: "pointer",
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    overflow: "hidden",
    transition: "border-color var(--cortex-transition-fast, 100ms ease)",
    padding: "0",
  });

  return (
    <CortexTooltip content="Account" position="right">
      <button
        style={buttonStyle()}
        onClick={props.onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        aria-label="User account"
      >
        <Show
          when={props.avatarUrl}
          fallback={
            <CortexIcon
              name="user"
              size={18}
              color="var(--cortex-text-muted, var(--cortex-text-inactive))"
            />
          }
        >
          <img
            src={props.avatarUrl}
            alt="User avatar"
            style={{
              width: "100%",
              height: "100%",
              "object-fit": "cover",
            }}
          />
        </Show>
      </button>
    </CortexTooltip>
  );
};

export default CortexActivityBar;


