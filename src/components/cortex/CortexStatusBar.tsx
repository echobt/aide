/**
 * CortexStatusBar - Pixel-perfect status bar matching Figma design
 * Dimensions: Full width × 28px (Figma: x:8, y:930, 249×28px in Home mode)
 * 
 * Structure per Figma (node 0:196):
 * - Left: Layout, Terminal, Git, Info icons (16×16px, 16px gap between icon edges)
 * - Right: Docker indicator + project name
 * 
 * Icon positions in Figma: x:0, x:32, x:64, x:96 (32px center-to-center = 16px edge gap)
 */

import { Component, JSX, splitProps, createSignal, Show, For } from "solid-js";
import { CortexIcon, CortexTooltip } from "./primitives";
import { useI18n, SUPPORTED_LOCALES, Locale } from "@/context/I18nContext";

export interface StatusBarItem {
  id: string;
  icon: string;
  label: string;
  onClick?: () => void;
}

export interface CortexStatusBarProps {
  projectType?: string;
  projectName?: string;
  leftItems?: StatusBarItem[];
  rightItems?: StatusBarItem[];
  onProjectClick?: () => void;
  class?: string;
  style?: JSX.CSSProperties;
}

// Default right items matching Figma design
const DEFAULT_RIGHT_ITEMS: StatusBarItem[] = [
  { id: "layout", icon: "layout", label: "Toggle Panel" },
  { id: "terminal", icon: "terminal", label: "Toggle Terminal" },
  { id: "git", icon: "git", label: "Source Control" },
  { id: "info", icon: "info", label: "Notifications" },
];

export const CortexStatusBar: Component<CortexStatusBarProps> = (props) => {
  const [local, others] = splitProps(props, [
    "projectType",
    "projectName",
    "leftItems",
    "rightItems",
    "onProjectClick",
    "class",
    "style",
  ]);

  const rightItems = () => local.rightItems || DEFAULT_RIGHT_ITEMS;

  // Main container - Full width × 28px
  const containerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    "justify-content": "space-between",
    width: "100%",
    height: "28px",
    background: "var(--cortex-bg-primary)",
    padding: "0 8px",
    "border-top": "1px solid var(--cortex-border-default, rgba(255,255,255,0.1))",
    "flex-shrink": "0",
    ...local.style,
  });

  // Left section - icons (Layout, Terminal, Git, Info)
  // Figma: icons at x:0, x:32, x:64, x:96 within 233×17px container
  const leftSectionStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: "16px", // 32px center-to-center - 16px icon = 16px gap
    height: "17px",
  });

  // Right section - Docker project indicator
  const rightSectionStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: "8px",
    height: "17px",
  });

  return (
    <footer class={local.class} style={containerStyle()} {...others}>
      {/* Left Section - Icons (Layout, Terminal, Git, Info) per Figma */}
      <div style={leftSectionStyle()}>
        <For each={rightItems()}>
          {(item) => (
            <StatusBarIconButton
              icon={item.icon}
              label={item.label}
              onClick={item.onClick}
            />
          )}
        </For>

        {/* Additional left items */}
        <Show when={local.leftItems}>
          <For each={local.leftItems}>
            {(item) => (
              <StatusBarIconButton
                icon={item.icon}
                label={item.label}
                onClick={item.onClick}
              />
            )}
          </For>
        </Show>
      </div>

      {/* Right Section - Language Selector and Docker Project Indicator */}
      <div style={rightSectionStyle()}>
        <LanguageSelector />
        <StatusBarProjectIndicator
          type={local.projectType}
          name={local.projectName}
          onClick={local.onProjectClick}
        />
      </div>
    </footer>
  );
};

/**
 * StatusBarProjectIndicator - Project type and name display
 */
interface StatusBarProjectIndicatorProps {
  type?: string;
  name?: string;
  onClick?: () => void;
}

const StatusBarProjectIndicator: Component<StatusBarProjectIndicatorProps> = (props) => {
  const [isHovered, setIsHovered] = createSignal(false);

  const containerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: "4px",
    cursor: "pointer",
    padding: "2px 4px",
    "border-radius": "var(--cortex-radius-sm, 4px)",
    background: isHovered()
      ? "var(--cortex-bg-hover, rgba(255,255,255,0.05))"
      : "transparent",
    transition: "background var(--cortex-transition-fast, 100ms ease)",
  });

  const iconStyle = (): JSX.CSSProperties => ({
    width: "15px",
    height: "15px",
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    color: isHovered()
      ? "var(--cortex-text-primary, var(--cortex-text-primary))"
      : "var(--cortex-text-muted, var(--cortex-text-inactive))",
    transition: "color var(--cortex-transition-fast, 100ms ease)",
  });

  const textStyle = (): JSX.CSSProperties => ({
    "font-family": "var(--cortex-font-sans, Inter, sans-serif)",
    "font-size": "12px",
    "line-height": "17px",
    color: isHovered()
      ? "var(--cortex-text-primary, var(--cortex-text-primary))"
      : "var(--cortex-text-muted, var(--cortex-text-inactive))",
    transition: "color var(--cortex-transition-fast, 100ms ease)",
  });

  // Get icon based on project type
  const getProjectIcon = (type?: string): string => {
    switch (type?.toLowerCase()) {
      case "docker":
        return "container";
      case "node":
        return "box";
      case "rust":
        return "box";
      case "python":
        return "box";
      default:
        return "container";
    }
  };

  return (
    <CortexTooltip content={`${props.type || "Docker"} Project`} position="top">
      <div
        style={containerStyle()}
        onClick={props.onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div style={iconStyle()}>
          <CortexIcon name={getProjectIcon(props.type)} size={13} />
        </div>
        <span style={textStyle()}>
          {props.name || `${props.type || "Docker"} Project`}
        </span>
      </div>
    </CortexTooltip>
  );
};

/**
 * StatusBarIconButton - Individual icon button in status bar
 * Size: 16×16px
 */
interface StatusBarIconButtonProps {
  icon: string;
  label: string;
  onClick?: () => void;
}

const StatusBarIconButton: Component<StatusBarIconButtonProps> = (props) => {
  const [isHovered, setIsHovered] = createSignal(false);

  const buttonStyle = (): JSX.CSSProperties => ({
    width: "16px",
    height: "16px",
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    padding: "0",
    color: isHovered()
      ? "var(--cortex-text-primary, var(--cortex-text-primary))"
      : "var(--cortex-text-muted, var(--cortex-text-inactive))",
    transition: "color var(--cortex-transition-fast, 100ms ease)",
  });

  return (
    <CortexTooltip content={props.label} position="top">
      <button
        style={buttonStyle()}
        onClick={props.onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        aria-label={props.label}
      >
        <CortexIcon name={props.icon} size={16} />
      </button>
    </CortexTooltip>
  );
};

/**
 * LanguageSelector - Language picker in status bar
 */
const LanguageSelector: Component = () => {
  const [isHovered, setIsHovered] = createSignal(false);
  const [isOpen, setIsOpen] = createSignal(false);

  let i18n: ReturnType<typeof useI18n> | null = null;
  try {
    i18n = useI18n();
  } catch {
    return null;
  }

  if (!i18n) return null;

  const currentLocale = () => {
    const locale = i18n!.locale();
    return SUPPORTED_LOCALES.find((l) => l.code === locale);
  };

  const handleSelect = (locale: Locale) => {
    i18n!.setLocale(locale);
    setIsOpen(false);
  };

  const containerStyle = (): JSX.CSSProperties => ({
    position: "relative",
    display: "flex",
    "align-items": "center",
  });

  const buttonStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: "4px",
    cursor: "pointer",
    padding: "2px 6px",
    "border-radius": "var(--cortex-radius-sm, 4px)",
    background: isHovered() || isOpen()
      ? "var(--cortex-bg-hover, rgba(255,255,255,0.05))"
      : "transparent",
    border: "none",
    transition: "background var(--cortex-transition-fast, 100ms ease)",
  });

  const textStyle = (): JSX.CSSProperties => ({
    "font-family": "var(--cortex-font-sans, Inter, sans-serif)",
    "font-size": "12px",
    "line-height": "17px",
    color: isHovered() || isOpen()
      ? "var(--cortex-text-primary, var(--cortex-text-primary))"
      : "var(--cortex-text-muted, var(--cortex-text-inactive))",
    transition: "color var(--cortex-transition-fast, 100ms ease)",
  });

  const dropdownStyle = (): JSX.CSSProperties => ({
    position: "absolute",
    bottom: "100%",
    right: "0",
    "margin-bottom": "4px",
    background: "var(--cortex-bg-elevated)",
    border: "1px solid var(--cortex-border-default)",
    "border-radius": "6px",
    "box-shadow": "0 4px 12px rgba(0,0,0,0.3)",
    "min-width": "120px",
    padding: "4px 0",
    "z-index": "1000",
  });

  const itemStyle = (isActive: boolean): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: "8px",
    padding: "6px 12px",
    cursor: "pointer",
    "font-size": "12px",
    color: isActive
      ? "var(--cortex-accent-primary)"
      : "var(--cortex-text-secondary)",
    background: "transparent",
    border: "none",
    width: "100%",
    "text-align": "left",
  });

  return (
    <div style={containerStyle()}>
      <CortexTooltip content="Select Language" position="top">
        <button
          style={buttonStyle()}
          onClick={() => setIsOpen(!isOpen())}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          aria-label="Select language"
        >
          <CortexIcon name="globe" size={13} />
          <span style={textStyle()}>{currentLocale()?.code.toUpperCase()}</span>
        </button>
      </CortexTooltip>

      <Show when={isOpen()}>
        <div
          style={{
            position: "fixed",
            inset: "0",
            "z-index": "999",
          }}
          onClick={() => setIsOpen(false)}
        />
        <div style={dropdownStyle()}>
          <For each={SUPPORTED_LOCALES}>
            {(locale) => (
              <button
                style={itemStyle(i18n!.locale() === locale.code)}
                onClick={() => handleSelect(locale.code)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--cortex-bg-hover)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <span>{locale.nativeName}</span>
                <Show when={i18n!.locale() === locale.code}>
                  <CortexIcon name="check" size={12} />
                </Show>
              </button>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};

export default CortexStatusBar;


