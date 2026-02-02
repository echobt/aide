/**
 * CortexIcon - Pixel-perfect icon wrapper for Cortex UI Design System
 * Uses the existing Icon component with Font Awesome Pro icons
 */

import { Component, JSX, splitProps } from "solid-js";
import { Icon } from "../../ui/Icon";

// Icon size tokens from Cortex UI specs
export const CORTEX_ICON_SIZES = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
  "2xl": 40,
  "3xl": 48,
} as const;

export type CortexIconSize = keyof typeof CORTEX_ICON_SIZES | number;

export interface CortexIconProps {
  name: string;
  size?: CortexIconSize;
  color?: string;
  class?: string;
  style?: JSX.CSSProperties;
  onClick?: (e: MouseEvent) => void;
}

// Map Figma design icon names to Font Awesome icon names
const ICON_NAME_MAP: Record<string, string> = {
  // Navigation
  home: "house",
  house: "house",
  plus: "plus",
  "circle-plus": "circle-plus",
  folder: "folder",
  "folder-open": "folder-open",
  "code-branch": "code-branch",
  git: "code-branch",
  play: "play",
  "play-circle": "circle-play",
  box: "box",
  cube: "cube",
  users: "users",
  "grid-2": "grid-2",
  grid: "grid-2",
  book: "book",
  "book-open": "book-open",
  map: "map",
  paintbrush: "paintbrush",
  brush: "paintbrush",
  settings: "gear",
  gear: "gear",
  
  // Actions
  menu: "bars", // Hamburger menu icon
  bars: "bars",
  search: "magnifying-glass",
  "search-sm": "magnifying-glass",
  refresh: "arrows-rotate",
  "refresh-cw": "arrows-rotate",
  "refresh-cw-02": "arrows-rotate",
  "rotate-cw": "arrows-rotate",
  "chevron-down": "chevron-down",
  "chevron-up": "chevron-up",
  "chevron-left": "chevron-left",
  "chevron-right": "chevron-right",
  "chevron-up-double": "chevrons-up",
  "x-close": "xmark",
  x: "xmark",
  close: "xmark",
  minus: "minus",
  copy: "copy",
  "copy-06": "copy",
  maximize: "expand",
  minimize: "compress",
  
  // Theme
  sun: "sun",
  moon: "moon",
  
  // Files
  file: "file",
  "file-text": "file-lines",
  "file-code": "file-code",
  
  // Communication
  send: "paper-plane",
  "paper-plane": "paper-plane",
  upload: "upload",
  "corner-up-left": "arrow-turn-up",
  undo: "arrow-turn-up",
  
  // Status
  check: "check",
  "check-circle": "circle-check",
  star: "star",
  "star-05": "star",
  stop: "stop",
  square: "square",
  "info-circle": "circle-info",
  info: "circle-info",
  alert: "circle-exclamation",
  warning: "triangle-exclamation",
  
  // Layout
  layout: "table-columns",
  terminal: "terminal",
  "terminal-square": "terminal",
  panel: "sidebar",
  
  // User
  user: "user",
  "user-circle": "circle-user",
  
  // Misc
  lock: "lock",
  road: "file-lines",
  docker: "docker",
  container: "docker",
  "caret-left": "caret-left",
  "caret-right": "caret-right",
  "help-circle": "circle-question",
};

export const CortexIcon: Component<CortexIconProps> = (props) => {
  const [local] = splitProps(props, [
    "name",
    "size",
    "color",
    "class",
    "style",
    "onClick",
  ]);

  const getSize = (): number => {
    if (typeof local.size === "number") return local.size;
    return CORTEX_ICON_SIZES[local.size || "md"];
  };

  const getIconName = (): string => {
    const lowercaseName = local.name.toLowerCase();
    return ICON_NAME_MAP[lowercaseName] || lowercaseName;
  };

  const iconStyle = (): JSX.CSSProperties => ({
    width: `${getSize()}px`,
    height: `${getSize()}px`,
    color: local.color || "currentColor",
    "flex-shrink": "0",
    transition: "color var(--cortex-transition-normal, 150ms ease)",
    ...local.style,
  });

  return (
    <Icon
      name={getIconName()}
      size={getSize()}
      color={local.color}
      class={local.class}
      style={iconStyle()}
      onClick={local.onClick}
    />
  );
};

export default CortexIcon;


