/**
 * Cortex UI Design System Components
 * 
 * Pixel-perfect implementations of Figma designs for Cortex GUI
 * Theme: Dark mode with Lime (#BFFF00) accent
 * 
 * Usage:
 *   import { CortexLayout, CortexTitleBar, ... } from '@/components/cortex';
 */

// Main Layout
export { CortexLayout, default as CortexLayoutDefault } from "./CortexLayout";
export type { CortexLayoutProps } from "./CortexLayout";

// Desktop Layout (production - connected to contexts)
export { CortexDesktopLayout, default as CortexDesktopLayoutDefault } from "./CortexDesktopLayout";

// Core Components
export { CortexTitleBar, default as CortexTitleBarDefault } from "./CortexTitleBar";
export type { CortexTitleBarProps } from "./CortexTitleBar";

export { CortexActivityBar, default as CortexActivityBarDefault } from "./CortexActivityBar";
export type { CortexActivityBarProps, ActivityBarItem } from "./CortexActivityBar";

export { CortexFileExplorer, default as CortexFileExplorerDefault } from "./CortexFileExplorer";
export type { CortexFileExplorerProps } from "./CortexFileExplorer";

export { CortexCodeEditor, default as CortexCodeEditorDefault } from "./CortexCodeEditor";
export type { CortexCodeEditorProps, EditorTab } from "./CortexCodeEditor";

export { CortexEditorTabs, default as CortexEditorTabsDefault } from "./CortexEditorTabs";
export type { CortexEditorTabsProps, EditorTab as CortexEditorTab } from "./CortexEditorTabs";

export { CortexChatPanel, default as CortexChatPanelDefault } from "./CortexChatPanel";
export type {
  CortexChatPanelProps,
  ChatPanelState,
  ChatMessage,
  ChatAction,
  ChatProgress,
} from "./CortexChatPanel";

export { CortexStatusBar, default as CortexStatusBarDefault } from "./CortexStatusBar";
export type { CortexStatusBarProps, StatusBarItem } from "./CortexStatusBar";

// Primitives
export {
  CortexIcon,
  CORTEX_ICON_SIZES,
  CortexButton,
  CortexToggle,
  CortexThemeToggle,
  CortexModeToggle,
  CortexInput,
  CortexPromptInput,
  CortexTooltip,
  CortexTreeItem,
  IndentGuide,
} from "./primitives";

export type {
  CortexIconProps,
  CortexIconSize,
  CortexButtonProps,
  CortexButtonVariant,
  CortexButtonSize,
  CortexToggleProps,
  CortexThemeToggleProps,
  CortexModeToggleProps,
  CortexInputProps,
  CortexPromptInputProps,
  CortexTooltipProps,
  CortexTooltipPosition,
  CortexTreeItemProps,
  TreeItemData,
  IndentGuideProps,
} from "./primitives";


