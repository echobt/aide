/**
 * CortexEditorTabs - Pixel-perfect editor tab bar matching Figma design
 * 
 * Design specs from Figma nodes 0:1134, 0:1617, 0:1622:
 * - Tab bar height: 47px
 * - Active tab: darker background (var(--cortex-bg-primary)), file icon, name, close button
 * - Inactive tabs: lighter/transparent background, same structure
 * - File icons: 16x16px based on file type
 * - Close button: 16x16px X icon, visible on hover or when modified
 * - Font: 13px Inter/system font
 * - Tab padding: 24px left, 16px right
 */

import { Component, JSX, For, Show, createSignal } from "solid-js";
import { CortexIcon } from "./primitives";



export interface EditorTab {
  id: string;
  name: string;
  path?: string;
  isModified?: boolean;
  isPreview?: boolean;
}

export interface CortexEditorTabsProps {
  tabs: EditorTab[];
  activeTabId: string | null;
  onTabSelect?: (id: string) => void;
  onTabClose?: (id: string) => void;
  onNewTab?: () => void;
  class?: string;
  style?: JSX.CSSProperties;
}

export const CortexEditorTabs: Component<CortexEditorTabsProps> = (props) => {
  // Container style - 47px height, dark background
  const containerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "flex-end",
    height: "47px",
    background: "var(--cortex-bg-secondary)",
    "border-bottom": "1px solid var(--cortex-border-default, rgba(255,255,255,0.1))",
    overflow: "hidden",
    "flex-shrink": "0",
    ...props.style,
  });

  return (
    <div class={props.class} style={containerStyle()}>
      <For each={props.tabs}>
        {(tab) => (
          <EditorTabItem
            tab={tab}
            isActive={props.activeTabId === tab.id}
            onSelect={() => props.onTabSelect?.(tab.id)}
            onClose={() => props.onTabClose?.(tab.id)}
          />
        )}
      </For>
      
      {/* Remaining space - clickable to create new tab */}
      <div 
        style={{
          flex: "1",
          height: "100%",
          cursor: "default",
        }}
        onClick={props.onNewTab}
      />
    </div>
  );
};

interface EditorTabItemProps {
  tab: EditorTab;
  isActive: boolean;
  onSelect: () => void;
  onClose: () => void;
}

const EditorTabItem: Component<EditorTabItemProps> = (props) => {
  const [isHovered, setIsHovered] = createSignal(false);
  
  // Tab container style
  const tabStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: "8px",
    height: props.isActive ? "46px" : "46px",
    "padding-left": "24px",
    "padding-right": "16px",
    background: props.isActive 
      ? "var(--cortex-bg-primary)" 
      : "transparent",
    "border-top-left-radius": "8px",
    "border-top-right-radius": "8px",
    cursor: "pointer",
    transition: "background 100ms ease",
    position: "relative",
    // Active tab extends to bottom, inactive has gap
    "margin-bottom": props.isActive ? "0" : "1px",
  });

  // File name style
  const nameStyle = (): JSX.CSSProperties => ({
    "font-family": "var(--cortex-font-sans, Inter, -apple-system, sans-serif)",
    "font-size": "13px",
    "font-weight": "400",
    color: props.isActive 
      ? "var(--cortex-text-primary, var(--cortex-text-primary))" 
      : "var(--cortex-text-muted, var(--cortex-text-inactive))",
    "white-space": "nowrap",
    "font-style": props.tab.isPreview ? "italic" : "normal",
  });

  // Close button style
  const closeButtonStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    width: "16px",
    height: "16px",
    "border-radius": "var(--cortex-radius-sm)",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    opacity: (isHovered() || props.tab.isModified) ? "1" : "0",
    transition: "opacity 100ms ease, background 100ms ease",
    padding: "0",
  });

  // Modified dot style (shown instead of close when modified and not hovered)
  const modifiedDotStyle = (): JSX.CSSProperties => ({
    width: "8px",
    height: "8px",
    "border-radius": "var(--cortex-radius-full)",
    background: "var(--cortex-text-muted, var(--cortex-text-inactive))",
  });

  const handleClose = (e: MouseEvent) => {
    e.stopPropagation();
    props.onClose();
  };

  return (
    <div
      style={tabStyle()}
      onClick={props.onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* File icon */}
      <FileTypeIcon name={props.tab.name} size={16} />
      
      {/* File name */}
      <span style={nameStyle()}>{props.tab.name}</span>
      
      {/* Close button or modified indicator */}
      <Show
        when={!props.tab.isModified || isHovered()}
        fallback={<span style={modifiedDotStyle()} />}
      >
        <button
          style={closeButtonStyle()}
          onClick={handleClose}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.1)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
          }}
          title="Close"
        >
          <CortexIcon 
            name="xmark" 
            size={12} 
            color="var(--cortex-text-muted, var(--cortex-text-inactive))" 
          />
        </button>
      </Show>
    </div>
  );
};

// File type icon component using SVG icons
interface FileTypeIconProps {
  name: string;
  size?: number;
}

const FileTypeIcon: Component<FileTypeIconProps> = (props) => {
  const size = () => props.size || 16;
  const ext = props.name.split('.').pop()?.toLowerCase() || '';
  const filename = props.name.toLowerCase();
  
  // React/TSX icon
  if (ext === 'tsx' || ext === 'jsx') {
    return (
      <svg width={size()} height={size()} viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="2" fill="var(--cortex-info)"/>
        <ellipse cx="8" cy="8" rx="7" ry="2.5" stroke="var(--cortex-info)" stroke-width="1" fill="none" transform="rotate(0 8 8)"/>
        <ellipse cx="8" cy="8" rx="7" ry="2.5" stroke="var(--cortex-info)" stroke-width="1" fill="none" transform="rotate(60 8 8)"/>
        <ellipse cx="8" cy="8" rx="7" ry="2.5" stroke="var(--cortex-info)" stroke-width="1" fill="none" transform="rotate(-60 8 8)"/>
      </svg>
    );
  }
  
  // TypeScript icon
  if (ext === 'ts') {
    return (
      <svg width={size()} height={size()} viewBox="0 0 16 16" fill="none">
        <rect width="16" height="16" rx="2" fill="var(--cortex-info)"/>
        <path d="M4 8h5M6.5 8v4.5" stroke="white" stroke-width="1.5"/>
        <path d="M10 12.5c.5.3 1 .5 1.5.5.8 0 1.5-.4 1.5-1.2 0-.6-.4-1-1.2-1.2l-.6-.2c-.5-.1-.8-.3-.8-.6 0-.4.3-.6.8-.6.4 0 .8.1 1.2.4" stroke="white" stroke-width="1"/>
      </svg>
    );
  }
  
  // Rust icon
  if (ext === 'rs') {
    return (
      <svg width={size()} height={size()} viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6" stroke="var(--cortex-warning)" stroke-width="1.5" fill="none"/>
        <circle cx="8" cy="8" r="2" fill="var(--cortex-warning)"/>
        <path d="M8 2v2M8 12v2M2 8h2M12 8h2" stroke="var(--cortex-warning)" stroke-width="1.5"/>
      </svg>
    );
  }
  
  // TOML icon (Cargo.toml)
  if (filename === 'cargo.toml' || ext === 'toml') {
    return (
      <svg width={size()} height={size()} viewBox="0 0 16 16" fill="none">
        <rect x="2" y="2" width="12" height="12" rx="2" stroke="var(--cortex-warning)" stroke-width="1.5" fill="none"/>
        <path d="M5 5h6M5 8h4M5 11h5" stroke="var(--cortex-warning)" stroke-width="1"/>
      </svg>
    );
  }
  
  // Lock icon (Cargo.lock)
  if (filename === 'cargo.lock' || ext === 'lock') {
    return (
      <svg width={size()} height={size()} viewBox="0 0 16 16" fill="none">
        <rect x="3" y="7" width="10" height="7" rx="1" stroke="var(--cortex-warning)" stroke-width="1.5" fill="none"/>
        <path d="M5 7V5a3 3 0 016 0v2" stroke="var(--cortex-warning)" stroke-width="1.5" fill="none"/>
        <circle cx="8" cy="10.5" r="1" fill="var(--cortex-warning)"/>
      </svg>
    );
  }
  
  // Markdown icon
  if (ext === 'md') {
    return (
      <svg width={size()} height={size()} viewBox="0 0 16 16" fill="none">
        <rect x="1" y="3" width="14" height="10" rx="1" stroke="var(--cortex-info)" stroke-width="1" fill="none"/>
        <path d="M3 10V6l2 2.5L7 6v4M10 10V7l1.5 2 1.5-2v3" stroke="var(--cortex-info)" stroke-width="1"/>
      </svg>
    );
  }
  
  // JSON icon
  if (ext === 'json') {
    return (
      <svg width={size()} height={size()} viewBox="0 0 16 16" fill="none">
        <path d="M5 3c-1.5 0-2 1-2 2v2c0 1-1 1-1 1s1 0 1 1v2c0 1 .5 2 2 2" stroke="var(--cortex-warning)" stroke-width="1.5" fill="none"/>
        <path d="M11 3c1.5 0 2 1 2 2v2c0 1 1 1 1 1s-1 0-1 1v2c0 1-.5 2-2 2" stroke="var(--cortex-warning)" stroke-width="1.5" fill="none"/>
      </svg>
    );
  }
  
  // Default file icon
  return (
    <svg width={size()} height={size()} viewBox="0 0 16 16" fill="none">
      <path d="M4 2h5l4 4v8a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="var(--cortex-text-inactive)" stroke-width="1.2" fill="none"/>
      <path d="M9 2v4h4" stroke="var(--cortex-text-inactive)" stroke-width="1.2" fill="none"/>
    </svg>
  );
};

export default CortexEditorTabs;


