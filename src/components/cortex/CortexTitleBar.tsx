/**
 * CortexTitleBar - Pixel-perfect title bar matching Figma design
 * Dimensions: Full width × 53px height (per Figma node 0:138)
 * 
 * Elements (Figma exact positions):
 * - Logo Container: x:8, y:8, 40×40px
 * - Mode Toggle Vibe/IDE: x:60, y:14, 75×28px
 * - Breadcrumbs: x:147, y:15, 230×27px
 * - Theme Toggle: x:1247, y:12, 100×28px
 * - Vertical Separator: x:1371, height:52px
 * - Window Controls: x:1375, y:0, 168×53px (3 buttons × 56px)
 * - Horizontal Separator: y:53
 */

import { Component, JSX, splitProps, Show, createSignal, For } from "solid-js";
import { CortexIcon, CortexModeToggle, CortexThemeToggle, CortexTooltip } from "./primitives";

export interface CortexTitleBarProps {
  appName?: string;
  currentPage?: string;
  isDraft?: boolean;
  mode?: "vibe" | "ide";
  onModeChange?: (mode: "vibe" | "ide") => void;
  isDarkMode?: boolean;
  onThemeChange?: (isDark: boolean) => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
  onClose?: () => void;
  isMenuOpen?: boolean; // Menu expanded state (shows inline menu items)
  onMenuToggle?: () => void; // Toggle menu open/closed
  activeMenu?: string | null; // Currently active menu (File, Edit, etc.)
  onMenuSelect?: (menu: string | null) => void; // Select a menu to show dropdown
  menuItems?: Record<string, MenuItem[]>; // Menu items for each menu
  class?: string;
  style?: JSX.CSSProperties;
}

// Menu item interface
interface MenuItem {
  label: string;
  shortcut?: string;
  action?: () => void;
  separator?: boolean;
}

// Menu items for inline menu bar
const MENU_LABELS = ["File", "Edit", "Selection", "View", "Go", "Terminal", "Help"];

// Default menu items
const DEFAULT_MENUS: Record<string, MenuItem[]> = {
  File: [
    { label: "New File", shortcut: "Ctrl+N", action: () => window.dispatchEvent(new CustomEvent("file:new")) },
    { label: "New Window", shortcut: "Ctrl+Shift+N", action: () => window.dispatchEvent(new CustomEvent("window:new")) },
    { separator: true, label: "" },
    { label: "Open File...", shortcut: "Ctrl+O", action: () => window.dispatchEvent(new CustomEvent("file:open")) },
    { label: "Open Folder...", shortcut: "Ctrl+K Ctrl+O", action: () => window.dispatchEvent(new CustomEvent("folder:open")) },
    { separator: true, label: "" },
    { label: "Save", shortcut: "Ctrl+S", action: () => window.dispatchEvent(new CustomEvent("file:save")) },
    { label: "Save As...", shortcut: "Ctrl+Shift+S", action: () => window.dispatchEvent(new CustomEvent("file:save-as")) },
    { label: "Save All", shortcut: "Ctrl+K S", action: () => window.dispatchEvent(new CustomEvent("file:save-all")) },
    { separator: true, label: "" },
    { label: "Close", shortcut: "Ctrl+W", action: () => window.dispatchEvent(new CustomEvent("file:close")) },
    { label: "Close Folder", action: () => window.dispatchEvent(new CustomEvent("folder:close")) },
  ],
  Edit: [
    { label: "Undo", shortcut: "Ctrl+Z", action: () => window.dispatchEvent(new CustomEvent("edit:undo")) },
    { label: "Redo", shortcut: "Ctrl+Shift+Z", action: () => window.dispatchEvent(new CustomEvent("edit:redo")) },
    { separator: true, label: "" },
    { label: "Cut", shortcut: "Ctrl+X", action: () => window.dispatchEvent(new CustomEvent("edit:cut")) },
    { label: "Copy", shortcut: "Ctrl+C", action: () => window.dispatchEvent(new CustomEvent("edit:copy")) },
    { label: "Paste", shortcut: "Ctrl+V", action: () => window.dispatchEvent(new CustomEvent("edit:paste")) },
    { separator: true, label: "" },
    { label: "Find", shortcut: "Ctrl+F", action: () => window.dispatchEvent(new CustomEvent("edit:find")) },
    { label: "Replace", shortcut: "Ctrl+H", action: () => window.dispatchEvent(new CustomEvent("edit:replace")) },
  ],
  Selection: [
    { label: "Select All", shortcut: "Ctrl+A", action: () => window.dispatchEvent(new CustomEvent("selection:select-all")) },
    { label: "Expand Selection", shortcut: "Shift+Alt+→", action: () => window.dispatchEvent(new CustomEvent("selection:expand")) },
    { label: "Shrink Selection", shortcut: "Shift+Alt+←", action: () => window.dispatchEvent(new CustomEvent("selection:shrink")) },
  ],
  View: [
    { label: "Command Palette...", shortcut: "Ctrl+Shift+P", action: () => window.dispatchEvent(new CustomEvent("command-palette:open")) },
    { label: "Quick Open...", shortcut: "Ctrl+P", action: () => window.dispatchEvent(new CustomEvent("quick-open:show")) },
    { separator: true, label: "" },
    { label: "Explorer", shortcut: "Ctrl+Shift+E", action: () => window.dispatchEvent(new CustomEvent("view:explorer")) },
    { label: "Search", shortcut: "Ctrl+Shift+F", action: () => window.dispatchEvent(new CustomEvent("view:search")) },
    { label: "Terminal", shortcut: "Ctrl+`", action: () => window.dispatchEvent(new CustomEvent("terminal:toggle")) },
  ],
  Go: [
    { label: "Go to File...", shortcut: "Ctrl+P", action: () => window.dispatchEvent(new CustomEvent("goto:file")) },
    { label: "Go to Line...", shortcut: "Ctrl+G", action: () => window.dispatchEvent(new CustomEvent("goto:line")) },
    { separator: true, label: "" },
    { label: "Go Back", shortcut: "Alt+←", action: () => window.dispatchEvent(new CustomEvent("goto:back")) },
    { label: "Go Forward", shortcut: "Alt+→", action: () => window.dispatchEvent(new CustomEvent("goto:forward")) },
  ],
  Terminal: [
    { label: "New Terminal", shortcut: "Ctrl+Shift+`", action: () => window.dispatchEvent(new CustomEvent("terminal:new")) },
    { label: "Split Terminal", action: () => window.dispatchEvent(new CustomEvent("terminal:split")) },
  ],
  Help: [
    { label: "Welcome", action: () => window.dispatchEvent(new CustomEvent("help:welcome")) },
    { label: "Documentation", action: () => window.dispatchEvent(new CustomEvent("help:docs")) },
    { separator: true, label: "" },
    { label: "About", action: () => window.dispatchEvent(new CustomEvent("help:about")) },
  ],
};

// Cortex Logo SVG Component
const CortexLogo: Component<{ size?: number }> = (props) => {
  const size = props.size || 40;
  
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M22.5293 13.416L26.9454 13.4167L32.0016 22.1533H27.5855L22.5293 13.416Z" fill="var(--cortex-accent-primary)"/>
      <path d="M19.2225 17.5391L21.4295 13.7241L26.4863 22.4613L24.2786 26.2764L19.2225 17.5391Z" fill="var(--cortex-accent-primary)"/>
      <path d="M19.2225 27.3857L21.4316 23.5707L23.6386 27.3843L21.4309 31.1993L19.2225 27.3857Z" fill="var(--cortex-accent-primary)"/>
      <path d="M26.6635 31.997L31.7203 23.2598H27.3049L22.248 31.997H26.6635Z" fill="var(--cortex-accent-primary)"/>
      <path d="M8.00781 17.8477H12.4218L17.4787 26.5849L13.0626 26.5842L8.00781 17.8477Z" fill="var(--cortex-accent-primary)"/>
      <path d="M13.5195 17.5403L15.7272 13.7246L20.7834 22.4619L18.575 26.2769L13.5195 17.5403Z" fill="var(--cortex-accent-primary)"/>
      <path d="M16.3691 12.6178L18.5768 8.80273L20.7853 12.6164L18.5776 16.4314L16.3691 12.6178Z" fill="var(--cortex-accent-primary)"/>
      <path d="M13.3426 8.00195L8.28711 16.7399L12.7011 16.7385L17.758 8.00195H13.3426Z" fill="var(--cortex-accent-primary)"/>
    </svg>
  );
};

export const CortexTitleBar: Component<CortexTitleBarProps> = (props) => {
  const [local, others] = splitProps(props, [
    "appName",
    "currentPage",
    "isDraft",
    "mode",
    "onModeChange",
    "isDarkMode",
    "onThemeChange",
    "onMinimize",
    "onMaximize",
    "onClose",
    "isMenuOpen",
    "onMenuToggle",
    "activeMenu",
    "onMenuSelect",
    "menuItems",
    "class",
    "style",
  ]);
  
  // Get menu items (use props or defaults)
  const getMenuItems = (menu: string) => {
    return local.menuItems?.[menu] || DEFAULT_MENUS[menu] || [];
  };
  
  // Handle menu item click
  const handleMenuItemClick = (item: MenuItem) => {
    if (item.action) {
      item.action();
    }
    // Close the menu after action
    local.onMenuSelect?.(null);
  };

  const [isCloseHovered, setIsCloseHovered] = createSignal(false);
  const [isMenuHovered, setIsMenuHovered] = createSignal(false);
  
  // Menu stays open until click outside, hovering another menu switches to it
  const handleMenuEnter = (label: string) => {
    // Switch to this menu (or open it if none is open)
    local.onMenuSelect?.(label);
  };
  
  // Don't close on mouse leave - only close on click outside (backdrop)

  // Main container - Full width × 40px (compact titlebar)
  const containerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    width: "100%",
    height: "40px",
    background: "var(--cortex-bg-primary)",
    position: "relative",
    "-webkit-app-region": "drag",
    "user-select": "none",
    ...local.style,
  });

  // Logo container - compact 32×32px
  const logoContainerStyle = (): JSX.CSSProperties => ({
    position: "absolute",
    left: "8px",
    top: "4px",
    width: "32px",
    height: "32px",
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    "-webkit-app-region": "no-drag",
    cursor: "pointer",
  });

  // Mode toggle - compact positioning
  const modeToggleContainerStyle = (): JSX.CSSProperties => ({
    position: "absolute",
    left: "48px",
    top: "6px",
    "-webkit-app-region": "no-drag",
  });

  // Breadcrumb container - compact
  const breadcrumbContainerStyle = (): JSX.CSSProperties => ({
    position: "absolute",
    left: "160px",
    top: "10px",
    display: "flex",
    "align-items": "center",
    height: "20px",
    gap: "0",
  });

  const breadcrumbTextStyle = (): JSX.CSSProperties => ({
    "font-family": "var(--cortex-font-sans, Inter, sans-serif)",
    "font-size": "13px",
    "line-height": "13px",
    color: "var(--cortex-text-secondary, var(--cortex-text-secondary))",
  });

  const separatorStyle = (): JSX.CSSProperties => ({
    "font-family": "var(--cortex-font-sans, Inter, sans-serif)",
    "font-size": "16px",
    color: "var(--cortex-text-muted, var(--cortex-text-inactive))",
    margin: "0 4px",
  });

  // Draft badge - compact
  const draftBadgeStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: "2px",
    height: "20px",
    padding: "2px 8px",
    background: "var(--cortex-accent-primary, var(--cortex-accent-primary))",
    "border-radius": "var(--cortex-radius-sm, 4px)",
    "margin-left": "8px",
    "-webkit-app-region": "no-drag",
    cursor: "pointer",
  });

  const draftTextStyle = (): JSX.CSSProperties => ({
    "font-family": "var(--cortex-font-sans, Inter, sans-serif)",
    "font-size": "12px",
    color: "var(--cortex-bg-secondary)",
  });

  // Hamburger menu button - compact
  const hamburgerStyle = (): JSX.CSSProperties => ({
    position: "absolute",
    left: "128px",
    top: "8px",
    width: "24px",
    height: "24px",
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    background: isMenuHovered() ? "rgba(255,255,255,0.05)" : "transparent",
    "border-radius": "var(--cortex-radius-md)",
    border: "none",
    cursor: "pointer",
    "-webkit-app-region": "no-drag",
    transition: "background 100ms ease",
  });

  // Theme toggle - compact
  const themeToggleContainerStyle = (): JSX.CSSProperties => ({
    position: "absolute",
    right: "180px",
    top: "6px",
    "-webkit-app-region": "no-drag",
  });

  // Vertical separator
  const verticalSeparatorStyle = (right: number): JSX.CSSProperties => ({
    position: "absolute",
    right: `${right}px`,
    top: "0",
    width: "1px",
    height: "40px",
    background: "var(--cortex-border-default, rgba(255,255,255,0.1))",
  });

  // Window controls - Figma exact: 3 buttons × 56px = 168px
  const windowControlsStyle = (): JSX.CSSProperties => ({
    position: "absolute",
    right: "0",
    top: "0",
    display: "flex",
    height: "40px",
    "align-items": "center",
    "-webkit-app-region": "no-drag",
  });

  // Window button - Figma exact: padding 16px + icon 24px = 56×40px
  const windowButtonStyle = (isClose: boolean = false): JSX.CSSProperties => ({
    width: "56px",
    height: "40px",
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    background: isClose && isCloseHovered()
      ? "var(--cortex-error, var(--cortex-error))"
      : "transparent",
    border: "none",
    cursor: "pointer",
    color: isClose && isCloseHovered()
      ? "var(--cortex-text-primary)"
      : "var(--cortex-text-muted, var(--cortex-text-inactive))",
    transition: "all var(--cortex-transition-fast, 100ms ease)",
  });

  // Bottom horizontal separator - Line 1216: x:8, y:53 (at bottom of 53px header)
  const bottomSeparatorStyle = (): JSX.CSSProperties => ({
    position: "absolute",
    left: "8px",
    bottom: "0",
    width: "calc(100% - 8px)",
    height: "1px",
    background: "var(--cortex-border-default, rgba(255,255,255,0.1))",
  });



  return (
    <header class={local.class} style={containerStyle()} {...others}>
      {/* Logo Container */}
      <div style={logoContainerStyle()}>
        <CortexLogo size={32} />
      </div>

      {/* Mode Toggle (Vibe/IDE) */}
      <div style={modeToggleContainerStyle()}>
        <CortexModeToggle
          mode={local.mode || "vibe"}
          onChange={local.onModeChange}
        />
      </div>

      {/* Menu Area - Shows hamburger OR inline menus */}
      <Show 
        when={local.isMenuOpen}
        fallback={
          <>
            {/* Hamburger Menu - Click to expand inline menus */}
            <CortexTooltip content="Menu" position="bottom">
              <button
                style={hamburgerStyle()}
                onClick={local.onMenuToggle}
                onMouseEnter={() => setIsMenuHovered(true)}
                onMouseLeave={() => setIsMenuHovered(false)}
              >
                <CortexIcon name="menu" size={20} color="var(--cortex-text-muted, var(--cortex-text-inactive))" />
              </button>
            </CortexTooltip>

            {/* Breadcrumbs */}
            <div style={breadcrumbContainerStyle()}>
              <span style={breadcrumbTextStyle()}>
                {local.appName || "Webcore App"}
              </span>
              <span style={separatorStyle()}>/</span>
              <span style={breadcrumbTextStyle()}>
                {local.currentPage || "Home"}
              </span>

              {/* Draft Badge */}
              <Show when={local.isDraft !== false}>
                <div style={draftBadgeStyle()}>
                  <span style={draftTextStyle()}>Draft</span>
                  <CortexIcon name="chevron-down" size={16} color="var(--cortex-bg-secondary)" />
                </div>
              </Show>
            </div>
          </>
        }
      >
        {/* Inline Menu Bar - Replaces hamburger and breadcrumbs */}
        <div style={{
          position: "absolute",
          left: "143px",
          top: "14px",
          display: "flex",
          "align-items": "center",
          gap: "2px",
          "-webkit-app-region": "no-drag",
        }}>
          {/* Menu Items: File, Edit, Selection, View, Go, Terminal, Help */}
          <For each={MENU_LABELS}>
            {(label) => (
              <div style={{ position: "relative" }}>
                <button
                  onMouseEnter={() => handleMenuEnter(label)}
                  style={{
                    height: "28px",
                    padding: "0 12px",
                    "font-size": "13px",
                    "font-family": "var(--cortex-font-sans, Inter, sans-serif)",
                    "font-weight": "400",
                    color: local.activeMenu === label 
                      ? "var(--cortex-accent-primary, var(--cortex-accent-primary))" 
                      : "var(--cortex-text-secondary, var(--cortex-text-secondary))",
                    background: local.activeMenu === label 
                      ? "rgba(191, 255, 0, 0.1)" 
                      : "transparent",
                    border: "none",
                    "border-radius": "var(--cortex-radius-md)",
                    cursor: "pointer",
                    transition: "all 100ms ease",
                    "white-space": "nowrap",
                  }}
                >
                  {label}
                </button>
                
                {/* Dropdown for this menu - shows on hover */}
                <Show when={local.activeMenu === label}>
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: "0",
                      "padding-top": "8px",
                      "max-width": "280px",
                      background: "var(--cortex-bg-primary)",
                      "border-radius": "var(--cortex-radius-md)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      padding: "6px 0",
                      "box-shadow": "0 8px 32px rgba(0,0,0,0.5)",
                      "z-index": "9999",
                    }}
                  >
                    <For each={getMenuItems(label)}>
                      {(item) => (
                        <Show
                          when={!item.separator}
                          fallback={
                            <div style={{ 
                              height: "1px", 
                              background: "rgba(255,255,255,0.1)",
                              margin: "6px 0",
                            }} />
                          }
                        >
                          <button
                            onClick={() => handleMenuItemClick(item)}
                            style={{
                              width: "100%",
                              display: "flex",
                              "align-items": "center",
                              "justify-content": "space-between",
                              padding: "6px 12px",
                              background: "transparent",
                              border: "none",
                              cursor: "pointer",
                              "font-size": "13px",
                              "font-family": "var(--cortex-font-sans, Inter, sans-serif)",
                              color: "var(--cortex-text-secondary, var(--cortex-text-secondary))",
                              "text-align": "left",
                            }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)";
                              (e.currentTarget as HTMLElement).style.color = "var(--cortex-text-primary, var(--cortex-text-primary))";
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLElement).style.background = "transparent";
                              (e.currentTarget as HTMLElement).style.color = "var(--cortex-text-secondary, var(--cortex-text-secondary))";
                            }}
                          >
                            <span>{item.label}</span>
                            <Show when={item.shortcut}>
                              <span style={{ 
                                color: "var(--cortex-text-muted, var(--cortex-text-inactive))", 
                                "font-size": "12px",
                                "margin-left": "24px",
                              }}>
                                {item.shortcut}
                              </span>
                            </Show>
                          </button>
                        </Show>
                      )}
                    </For>
                  </div>
                </Show>
              </div>
            )}
          </For>
        </div>
        
        {/* Backdrop to close menu when clicking outside */}
        <div 
          style={{
            position: "fixed",
            top: "53px",
            left: "0",
            right: "0",
            bottom: "0",
            "z-index": "9000",
            background: "transparent",
          }}
          onClick={() => local.onMenuToggle?.()}
        />
      </Show>

      {/* Theme Toggle */}
      <div style={themeToggleContainerStyle()}>
        <CortexThemeToggle
          isDark={local.isDarkMode ?? true}
          onChange={local.onThemeChange}
        />
      </div>

      {/* Separator before window controls - 168px (3 × 56px) */}
      <div style={verticalSeparatorStyle(168)} />

      {/* Window Controls - 168px wide (3 × 56px) */}
      <div style={windowControlsStyle()}>
        {/* Minimize - 56×53px with 24×24px icon */}
        <CortexTooltip content="Minimize" position="bottom">
          <button
            style={windowButtonStyle()}
            onClick={local.onMinimize}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "var(--cortex-bg-hover, rgba(255,255,255,0.05))";
              const svg = e.currentTarget.querySelector("svg path");
              if (svg) (svg as SVGPathElement).style.stroke = "var(--cortex-text-primary)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
              const svg = e.currentTarget.querySelector("svg path");
              if (svg) (svg as SVGPathElement).style.stroke = "var(--cortex-text-inactive)";
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 12H18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </CortexTooltip>

        {/* Maximize - Figma: padding 16px, icon 24×24 */}
        <CortexTooltip content="Maximize" position="bottom">
          <button
            style={windowButtonStyle()}
            onClick={local.onMaximize}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "var(--cortex-bg-hover, rgba(255,255,255,0.05))";
              const svg = e.currentTarget.querySelector("svg path");
              if (svg) (svg as SVGPathElement).style.stroke = "var(--cortex-text-primary)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
              const svg = e.currentTarget.querySelector("svg path");
              if (svg) (svg as SVGPathElement).style.stroke = "var(--cortex-text-inactive)";
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8.5 5H14.0222C15.7646 5 16.6358 5 17.3013 5.33909C17.8867 5.63736 18.3626 6.1133 18.6609 6.6987C19 7.3642 19 8.23539 19 9.97778V15.5M7.48889 19H13.7889C14.6601 19 15.0957 19 15.4284 18.8305C15.7211 18.6813 15.9591 18.4433 16.1082 18.1507C16.2778 17.8179 16.2778 17.3823 16.2778 16.5111V10.2111C16.2778 9.33992 16.2778 8.90432 16.1082 8.57157C15.9591 8.27887 15.7211 8.0409 15.4284 7.89177C15.0957 7.72222 14.6601 7.72222 13.7889 7.72222H7.48889C6.6177 7.72222 6.1821 7.72222 5.84935 7.89177C5.55665 8.0409 5.31868 8.27887 5.16955 8.57157C5 8.90432 5 9.33992 5 10.2111V16.5111C5 17.3823 5 17.8179 5.16955 18.1507C5.31868 18.4433 5.55665 18.6813 5.84935 18.8305C6.1821 19 6.6177 19 7.48889 19Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </CortexTooltip>

        {/* Close - Figma: padding 16px, icon 24×24 */}
        <CortexTooltip content="Close" position="bottom">
          <button
            style={windowButtonStyle(true)}
            onClick={local.onClose}
            onMouseEnter={(e) => {
              setIsCloseHovered(true);
              const svg = e.currentTarget.querySelector("svg path");
              if (svg) (svg as SVGPathElement).style.stroke = "var(--cortex-text-primary)";
            }}
            onMouseLeave={(e) => {
              setIsCloseHovered(false);
              const svg = e.currentTarget.querySelector("svg path");
              if (svg) (svg as SVGPathElement).style.stroke = "var(--cortex-text-inactive)";
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </CortexTooltip>
      </div>

      {/* Bottom Separator */}
      <div style={bottomSeparatorStyle()} />
    </header>
  );
};

export default CortexTitleBar;


