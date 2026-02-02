/**
 * CortexToggle - Pixel-perfect toggle/switch component for Cortex UI Design System
 * Used for theme toggle and other binary switches
 */

import { Component, JSX, splitProps } from "solid-js";
import { CortexIcon } from "./CortexIcon";

export interface CortexToggleProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  leftIcon?: string;
  rightIcon?: string;
  leftLabel?: string;
  rightLabel?: string;
  class?: string;
  style?: JSX.CSSProperties;
}

const SIZE_SPECS = {
  sm: {
    track: { width: 32, height: 16 },
    thumb: { size: 12, offset: 2 },
    travel: 16,
  },
  md: {
    track: { width: 44, height: 24 },
    thumb: { size: 18, offset: 3 },
    travel: 20,
  },
  lg: {
    track: { width: 56, height: 28 },
    thumb: { size: 22, offset: 3 },
    travel: 28,
  },
};

export const CortexToggle: Component<CortexToggleProps> = (props) => {
  const [local, others] = splitProps(props, [
    "checked",
    "onChange",
    "disabled",
    "size",
    "leftIcon",
    "rightIcon",
    "leftLabel",
    "rightLabel",
    "class",
    "style",
  ]);

  const size = () => local.size || "md";
  const specs = () => SIZE_SPECS[size()];

  const trackStyle = (): JSX.CSSProperties => ({
    position: "relative",
    display: "flex",
    "align-items": "center",
    width: `${specs().track.width}px`,
    height: `${specs().track.height}px`,
    background: local.checked
      ? "var(--cortex-switch-bg-on, var(--cortex-accent-primary))"
      : "var(--cortex-switch-bg-off, var(--cortex-bg-hover))",
    "border-radius": "var(--cortex-radius-full, 9999px)",
    border: local.checked
      ? "1px solid transparent"
      : "1px solid var(--cortex-switch-border, rgba(255,255,255,0.1))",
    cursor: local.disabled ? "not-allowed" : "pointer",
    opacity: local.disabled ? "0.5" : "1",
    transition: "all var(--cortex-transition-normal, 150ms ease)",
    "flex-shrink": "0",
    ...local.style,
  });

  const thumbStyle = (): JSX.CSSProperties => ({
    position: "absolute",
    width: `${specs().thumb.size}px`,
    height: `${specs().thumb.size}px`,
    background: "var(--cortex-switch-thumb, var(--cortex-text-primary))",
    "border-radius": "var(--cortex-radius-full)",
    "box-shadow": "0 1px 3px rgba(0, 0, 0, 0.3)",
    transform: local.checked
      ? `translateX(${specs().travel}px)`
      : "translateX(0)",
    left: `${specs().thumb.offset}px`,
    transition: "transform var(--cortex-transition-slow, 300ms) cubic-bezier(0.4, 0, 0.2, 1)",
  });

  const handleClick = () => {
    if (local.disabled) return;
    local.onChange?.(!local.checked);
  };

  return (
    <button
      type="button"
      class={local.class}
      style={trackStyle()}
      onClick={handleClick}
      disabled={local.disabled}
      aria-pressed={local.checked}
      role="switch"
      {...others}
    >
      <div style={thumbStyle()} />
    </button>
  );
};

/**
 * CortexThemeToggle - Specialized theme toggle with sun/moon icons
 * Figma: x:1247, y:12, 100×28px
 * ASYMMETRIC DESIGN:
 * - Sun Container: x:2, y:0, 48×28px (full height)
 * - Moon Container: x:50, y:2, 48×24px (shorter, offset by 2px)
 */
export interface CortexThemeToggleProps {
  isDark?: boolean;
  onChange?: (isDark: boolean) => void;
  class?: string;
  style?: JSX.CSSProperties;
}

export const CortexThemeToggle: Component<CortexThemeToggleProps> = (props) => {
  const [local, others] = splitProps(props, [
    "isDark",
    "onChange",
    "class",
    "style",
  ]);

  // Container: 100×28px with pill shape
  const containerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    width: "100px",
    height: "28px",
    background: "var(--cortex-bg-tertiary, var(--cortex-bg-hover))",
    "border-radius": "var(--cortex-radius-full, 9999px)",
    position: "relative",
    ...local.style,
  });

  // Sliding indicator - matches active button size
  const indicatorStyle = (): JSX.CSSProperties => ({
    position: "absolute",
    width: "48px",
    height: local.isDark ? "24px" : "28px", // Sun: 28px, Moon: 24px
    background: "var(--cortex-bg-hover, var(--cortex-bg-hover))",
    "border-radius": "var(--cortex-radius-full, 9999px)",
    transition: "all var(--cortex-transition-slow, 300ms) cubic-bezier(0.4, 0, 0.2, 1)",
    transform: local.isDark ? "translateX(50px)" : "translateX(2px)",
    top: local.isDark ? "2px" : "0px", // Moon at y:2, Sun at y:0
    left: "0px",
  });

  // Sun button: 48×28px at x:2 (full height)
  const sunButtonStyle = (isActive: boolean): JSX.CSSProperties => ({
    position: "absolute",
    left: "2px",
    top: "0px",
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    width: "48px",
    height: "28px",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    "z-index": "1",
    color: isActive
      ? "var(--cortex-accent-primary, var(--cortex-accent-primary))"
      : "var(--cortex-text-muted, var(--cortex-text-inactive))",
    transition: "color var(--cortex-transition-normal, 150ms ease)",
  });

  // Moon button: 48×24px at x:50, y:2 (shorter, offset)
  const moonButtonStyle = (isActive: boolean): JSX.CSSProperties => ({
    position: "absolute",
    left: "50px",
    top: "2px",
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    width: "48px",
    height: "24px",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    "z-index": "1",
    color: isActive
      ? "var(--cortex-accent-primary, var(--cortex-accent-primary))"
      : "var(--cortex-text-muted, var(--cortex-text-inactive))",
    transition: "color var(--cortex-transition-normal, 150ms ease)",
  });

  return (
    <div class={local.class} style={containerStyle()} {...others}>
      <div style={indicatorStyle()} />
      
      {/* Sun button: 48×28px at x:2 */}
      <button
        type="button"
        style={sunButtonStyle(!local.isDark)}
        onClick={() => local.onChange?.(false)}
        aria-label="Light mode"
      >
        <CortexIcon name="sun" size={16} />
      </button>
      
      {/* Moon button: 48×24px at x:50, y:2 */}
      <button
        type="button"
        style={moonButtonStyle(local.isDark ?? false)}
        onClick={() => local.onChange?.(true)}
        aria-label="Dark mode"
      >
        <CortexIcon name="moon" size={16} />
      </button>
    </div>
  );
};

/**
 * CortexModeToggle - Vibe/IDE mode toggle from Figma design
 * Figma node-id: 0:1712
 * Container: var(--cortex-bg-primary) with border rgba(255,255,255,0.15), border-radius 8px
 * Active state: Blue glow effect with sliding animation
 */
export interface CortexModeToggleProps {
  mode: "vibe" | "ide";
  onChange?: (mode: "vibe" | "ide") => void;
  class?: string;
  style?: JSX.CSSProperties;
}

export const CortexModeToggle: Component<CortexModeToggleProps> = (props) => {
  const [local, others] = splitProps(props, [
    "mode",
    "onChange",
    "class",
    "style",
  ]);

  // Container style from Figma
  const containerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    position: "relative",
    background: "var(--cortex-bg-primary)",
    border: "1px solid rgba(255, 255, 255, 0.15)",
    "border-radius": "var(--cortex-radius-md)",
    padding: "5px 8px",
    gap: "8px",
    ...local.style,
  });

  // Sliding indicator - moves behind active text
  const indicatorStyle = (): JSX.CSSProperties => ({
    position: "absolute",
    height: "18px",
    "border-radius": "var(--cortex-radius-sm)",
    transition: "all 250ms cubic-bezier(0.4, 0, 0.2, 1)",
    "pointer-events": "none",
    ...(local.mode === "ide" ? {
      // IDE active - blue glow, positioned over IDE text
      left: "calc(8px + 30px + 8px)", // padding + vibe width + gap
      width: "28px",
      background: "linear-gradient(180deg, rgba(97, 147, 255, 0.2) 21.21%, rgba(0, 48, 111, 0.2) 75.67%)",
      border: "1px solid var(--cortex-info)",
      "box-shadow": "0px 0px 3px 0px rgba(144, 181, 255, 0.25), 0px 0px 25px 0px rgba(144, 181, 255, 0.25), inset 0px -4.5px 5px -4px var(--cortex-info), inset 0px -10px 12px -8px var(--cortex-info), inset 0px -20px 30px -12px var(--cortex-info), inset 0px 0px 5px 1px var(--cortex-info), inset 0px 0px 12px 0px var(--cortex-info), inset 0px 0px 30px 0px var(--cortex-info)",
    } : {
      // Vibe active - green glow, positioned over Vibe text
      left: "8px", // just padding
      width: "34px",
      background: "linear-gradient(180deg, rgba(191, 255, 0, 0.2) 21.21%, rgba(48, 111, 0, 0.2) 75.67%)",
      border: "1px solid var(--cortex-accent-primary)",
      "box-shadow": "0px 0px 3px 0px rgba(178, 255, 34, 0.25), 0px 0px 25px 0px rgba(178, 255, 34, 0.25), inset 0px -4.5px 5px -4px var(--cortex-accent-primary), inset 0px -10px 12px -8px var(--cortex-accent-primary), inset 0px 0px 5px 1px var(--cortex-accent-primary)",
    }),
  });

  // Fixed text style - position doesn't change
  const textStyle = (isVibe: boolean): JSX.CSSProperties => ({
    "font-family": "'Inter', sans-serif",
    "font-size": "14px",
    "font-weight": "400",
    "line-height": "18px",
    cursor: "pointer",
    transition: "color 200ms ease",
    "z-index": "1",
    width: isVibe ? "30px" : "24px",
    "text-align": "center",
    color: isVibe
      ? (local.mode === "vibe" ? "var(--cortex-accent-hover)" : "var(--cortex-text-inactive)")
      : (local.mode === "ide" ? "var(--cortex-text-accent-blue)" : "var(--cortex-text-inactive)"),
  });

  return (
    <div class={local.class} style={containerStyle()} {...others}>
      {/* Sliding indicator */}
      <div style={indicatorStyle()} />
      
      {/* Vibe text - fixed position */}
      <span 
        style={textStyle(true)} 
        onClick={() => local.onChange?.("vibe")}
      >
        Vibe
      </span>

      {/* IDE text - fixed position */}
      <span 
        style={textStyle(false)} 
        onClick={() => local.onChange?.("ide")}
      >
        IDE
      </span>
    </div>
  );
};

export default CortexToggle;


