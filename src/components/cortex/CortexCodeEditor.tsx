/**
 * CortexCodeEditor - Pixel-perfect code editor shell matching Figma design
 * Dimensions: 1146×882px
 * 
 * Structure:
 * - Tab Bar: y:70, h:47px
 * - Editor Content: y:124, 1145×826px (Monaco wrapper)
 * - Status Bar: y:1014, 1145×34px
 * 
 * Note: This is a shell component - actual editing uses Monaco Editor
 */

import { Component, JSX, splitProps, createSignal, For, Show } from "solid-js";
import { CortexIcon, CortexTooltip } from "./primitives";

export interface EditorTab {
  id: string;
  name: string;
  icon?: string;
  isModified?: boolean;
  isActive?: boolean;
}

export interface CortexCodeEditorProps {
  tabs?: EditorTab[];
  activeTabId?: string | null;
  onTabClick?: (id: string) => void;
  onTabClose?: (id: string) => void;
  onNewTab?: () => void;
  currentLine?: number;
  currentColumn?: number;
  language?: string;
  encoding?: string;
  lineEnding?: "LF" | "CRLF" | "CR";
  indentSize?: number;
  onRunClick?: () => void;
  children?: JSX.Element; // Monaco Editor slot
  class?: string;
  style?: JSX.CSSProperties;
}

// Sample tabs matching Figma design
const SAMPLE_TABS: EditorTab[] = [
  { id: "1", name: "SurveyQuestion.tsx", icon: "file-code", isActive: true },
  { id: "2", name: "Cargo.toml", icon: "file-text" },
  { id: "3", name: "build.rs", icon: "file-code" },
];

export const CortexCodeEditor: Component<CortexCodeEditorProps> = (props) => {
  const [local, others] = splitProps(props, [
    "tabs",
    "activeTabId",
    "onTabClick",
    "onTabClose",
    "onNewTab",
    "currentLine",
    "currentColumn",
    "language",
    "encoding",
    "lineEnding",
    "indentSize",
    "onRunClick",
    "children",
    "class",
    "style",
  ]);

  const tabs = () => local.tabs || SAMPLE_TABS;
  const activeTabId = () => local.activeTabId || tabs()[0]?.id;

  // Main container
  const containerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "flex-direction": "column",
    width: "100%",
    height: "100%",
    background: "var(--cortex-bg-primary)",
    overflow: "hidden",
    ...local.style,
  });

  // Tab bar - height: 47px
  const tabBarStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "flex-end",
    height: "47px",
    background: "transparent",
    "border-bottom": "1px solid var(--cortex-border-default, rgba(255,255,255,0.1))",
    "flex-shrink": "0",
    "overflow-x": "auto",
    "overflow-y": "hidden",
  });

  // Editor content area
  const editorContentStyle = (): JSX.CSSProperties => ({
    flex: "1",
    display: "flex",
    "flex-direction": "column",
    overflow: "hidden",
    background: "var(--cortex-bg-secondary)",
  });

  // Bottom status bar - height: 34px
  const statusBarStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    "justify-content": "space-between",
    height: "34px",
    padding: "0 8px",
    background: "var(--cortex-bg-primary)",
    "border-top": "1px solid var(--cortex-border-default, rgba(255,255,255,0.1))",
    "flex-shrink": "0",
  });

  // Status bar left (tabs switcher)
  const statusLeftStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: "4px",
    "overflow-x": "auto",
    flex: "1",
  });

  // Status bar right (actions + info)
  const statusRightStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: "16px",
  });

  const statusTextStyle = (): JSX.CSSProperties => ({
    "font-family": "var(--cortex-font-sans, Inter, sans-serif)",
    "font-size": "12px",
    color: "var(--cortex-text-muted, var(--cortex-text-inactive))",
    "white-space": "nowrap",
  });

  return (
    <div class={local.class} style={containerStyle()} {...others}>
      {/* Tab Bar */}
      <div style={tabBarStyle()}>
        <For each={tabs()}>
          {(tab) => (
            <EditorTabButton
              tab={tab}
              isActive={activeTabId() === tab.id}
              onClick={() => local.onTabClick?.(tab.id)}
              onClose={() => local.onTabClose?.(tab.id)}
            />
          )}
        </For>
        
        {/* New tab button */}
        <CortexTooltip content="New Tab" position="bottom">
          <button
            style={{
              width: "32px",
              height: "46px",
              display: "flex",
              "align-items": "center",
              "justify-content": "center",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--cortex-text-muted, var(--cortex-text-inactive))",
            }}
            onClick={local.onNewTab}
          >
            <CortexIcon name="plus" size={16} />
          </button>
        </CortexTooltip>
      </div>

      {/* Editor Content (Monaco slot) */}
      <div style={editorContentStyle()}>
        {local.children || <EditorPlaceholder />}
      </div>

      {/* Bottom Status Bar */}
      <div style={statusBarStyle()}>
        <div style={statusLeftStyle()}>
          {/* Mini tab switcher */}
          <For each={tabs()}>
            {(tab) => (
              <MiniTabButton
                tab={tab}
                isActive={activeTabId() === tab.id}
                onClick={() => local.onTabClick?.(tab.id)}
              />
            )}
          </For>
          
          {/* Add button */}
          <button
            style={{
              width: "16px",
              height: "16px",
              display: "flex",
              "align-items": "center",
              "justify-content": "center",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--cortex-text-muted, var(--cortex-text-inactive))",
              "flex-shrink": "0",
            }}
            onClick={local.onNewTab}
          >
            <CortexIcon name="plus" size={14} />
          </button>
        </div>

        <div style={statusRightStyle()}>
          {/* Run button */}
          <CortexTooltip content="Run" position="top">
            <button
              style={{
                display: "flex",
                "align-items": "center",
                gap: "4px",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "var(--cortex-text-muted, var(--cortex-text-inactive))",
                padding: "4px",
              }}
              onClick={local.onRunClick}
            >
              <CortexIcon name="play" size={16} />
            </button>
          </CortexTooltip>

          {/* Cursor position */}
          <span style={statusTextStyle()}>
            Ln {local.currentLine || 1}, Col {local.currentColumn || 1}
          </span>

          {/* Indent */}
          <span style={statusTextStyle()}>
            Spaces: {local.indentSize || 2}
          </span>

          {/* Encoding */}
          <span style={statusTextStyle()}>
            {local.encoding || "UTF-8"}
          </span>

          {/* Line ending */}
          <span style={statusTextStyle()}>
            {local.lineEnding || "LF"}
          </span>

          {/* Language */}
          <span style={statusTextStyle()}>
            {local.language || "TypeScript"}
          </span>
        </div>
      </div>
    </div>
  );
};

/**
 * EditorTabButton - Tab in the tab bar
 * Active: 222×47px, Inactive: 173×46px (roughly)
 */
interface EditorTabButtonProps {
  tab: EditorTab;
  isActive: boolean;
  onClick: () => void;
  onClose: () => void;
}

const EditorTabButton: Component<EditorTabButtonProps> = (props) => {
  const [isHovered, setIsHovered] = createSignal(false);
  const [isCloseHovered, setIsCloseHovered] = createSignal(false);

  const tabStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: "8px",
    height: props.isActive ? "47px" : "46px",
    padding: "0 16px 0 24px",
    background: props.isActive
      ? "var(--cortex-bg-tertiary, var(--cortex-bg-hover))"
      : isHovered()
      ? "var(--cortex-bg-hover, rgba(255,255,255,0.03))"
      : "transparent",
    border: "none",
    "border-bottom": props.isActive
      ? "none"
      : "1px solid transparent",
    cursor: "pointer",
    position: "relative",
    "flex-shrink": "0",
  });

  const iconStyle = (): JSX.CSSProperties => ({
    width: "16px",
    height: "16px",
    "flex-shrink": "0",
    color: props.isActive
      ? "var(--cortex-accent-primary, var(--cortex-accent-primary))"
      : "var(--cortex-text-muted, var(--cortex-text-inactive))",
  });

  const textStyle = (): JSX.CSSProperties => ({
    "font-family": "var(--cortex-font-sans, Inter, sans-serif)",
    "font-size": "14px",
    color: props.isActive
      ? "var(--cortex-text-primary, var(--cortex-text-primary))"
      : "var(--cortex-text-muted, var(--cortex-text-inactive))",
    "white-space": "nowrap",
  });

  const closeButtonStyle = (): JSX.CSSProperties => ({
    width: "16px",
    height: "16px",
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    background: isCloseHovered()
      ? "var(--cortex-bg-hover, rgba(255,255,255,0.1))"
      : "transparent",
    border: "none",
    "border-radius": "var(--cortex-radius-sm, 4px)",
    cursor: "pointer",
    color: "var(--cortex-text-muted, var(--cortex-text-inactive))",
    opacity: isHovered() || props.isActive ? "1" : "0",
    transition: "opacity var(--cortex-transition-fast, 100ms ease)",
    "flex-shrink": "0",
  });

  // Modified indicator dot
  const modifiedDotStyle = (): JSX.CSSProperties => ({
    width: "6px",
    height: "6px",
    "border-radius": "var(--cortex-radius-full)",
    background: "var(--cortex-text-muted, var(--cortex-text-inactive))",
    "flex-shrink": "0",
  });

  return (
    <button
      style={tabStyle()}
      onClick={props.onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* File icon */}
      <div style={iconStyle()}>
        <CortexIcon name={props.tab.icon || "file"} size={16} />
      </div>

      {/* File name */}
      <span style={textStyle()}>{props.tab.name}</span>

      {/* Modified dot or close button */}
      <Show
        when={!props.tab.isModified || isHovered()}
        fallback={<div style={modifiedDotStyle()} />}
      >
        <button
          style={closeButtonStyle()}
          onClick={(e) => {
            e.stopPropagation();
            props.onClose();
          }}
          onMouseEnter={() => setIsCloseHovered(true)}
          onMouseLeave={() => setIsCloseHovered(false)}
        >
          <CortexIcon name="x" size={12} />
        </button>
      </Show>
    </button>
  );
};

/**
 * MiniTabButton - Small tab in status bar
 */
interface MiniTabButtonProps {
  tab: EditorTab;
  isActive: boolean;
  onClick: () => void;
}

const MiniTabButton: Component<MiniTabButtonProps> = (props) => {
  const [isHovered, setIsHovered] = createSignal(false);

  const buttonStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: "4px",
    padding: "4px 8px",
    background: props.isActive
      ? "var(--cortex-bg-tertiary, var(--cortex-bg-hover))"
      : isHovered()
      ? "var(--cortex-bg-hover, rgba(255,255,255,0.05))"
      : "transparent",
    border: "none",
    "border-radius": "var(--cortex-radius-sm, 4px)",
    cursor: "pointer",
    "flex-shrink": "0",
  });

  const iconStyle = (): JSX.CSSProperties => ({
    color: props.isActive
      ? "var(--cortex-accent-primary, var(--cortex-accent-primary))"
      : "var(--cortex-text-muted, var(--cortex-text-inactive))",
  });

  const textStyle = (): JSX.CSSProperties => ({
    "font-family": "var(--cortex-font-sans, Inter, sans-serif)",
    "font-size": "11px",
    color: props.isActive
      ? "var(--cortex-text-primary, var(--cortex-text-primary))"
      : "var(--cortex-text-muted, var(--cortex-text-inactive))",
    "white-space": "nowrap",
    "max-width": "100px",
    overflow: "hidden",
    "text-overflow": "ellipsis",
  });

  return (
    <button
      style={buttonStyle()}
      onClick={props.onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <CortexIcon name={props.tab.icon || "file"} size={12} style={iconStyle()} />
      <span style={textStyle()}>{props.tab.name}</span>
    </button>
  );
};

/**
 * EditorPlaceholder - Shown when no Monaco editor is provided
 */
const EditorPlaceholder: Component = () => {
  const containerStyle = (): JSX.CSSProperties => ({
    width: "100%",
    height: "100%",
    display: "flex",
    "flex-direction": "column",
    "align-items": "center",
    "justify-content": "center",
    background: "var(--cortex-bg-secondary)",
    color: "var(--cortex-text-muted, var(--cortex-text-inactive))",
    gap: "16px",
  });

  return (
    <div style={containerStyle()}>
      <CortexIcon name="file-code" size={48} />
      <span style={{ "font-size": "14px" }}>No file selected</span>
    </div>
  );
};

export default CortexCodeEditor;


