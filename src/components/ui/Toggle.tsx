import { JSX, splitProps, Show, createSignal } from "solid-js";

export interface ToggleProps {
  /** Toggle state */
  checked?: boolean;
  /** Change handler */
  onChange?: (checked: boolean) => void;
  /** Label text */
  label?: string;
  /** Description text */
  description?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Size variant */
  size?: "sm" | "md";
  /** Custom styles */
  style?: JSX.CSSProperties;
  /** ARIA label */
  "aria-label"?: string;
}

export function Toggle(props: ToggleProps) {
  const [local] = splitProps(props, [
    "checked", "onChange", "label", "description", "disabled", "size", "style", "aria-label"
  ]);

  const [focused, setFocused] = createSignal(false);

  const isChecked = () => local.checked ?? false;
  const size = () => local.size || "md";

  const sizeConfig = {
    sm: { track: { w: 28, h: 14 }, knob: { size: 10, offset: 2 } },
    md: { track: { w: 36, h: 18 }, knob: { size: 14, offset: 2 } },
  };

  const config = () => sizeConfig[size()];

  const handleClick = () => {
    if (local.disabled) return;
    local.onChange?.(!isChecked());
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (local.disabled) return;
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      local.onChange?.(!isChecked());
    }
  };

  const containerStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "flex-start",
    gap: "10px",
    cursor: local.disabled ? "not-allowed" : "pointer",
    opacity: local.disabled ? "0.5" : "1",
    ...local.style,
  };

  const trackStyle = (): JSX.CSSProperties => ({
    position: "relative",
    width: `${config().track.w}px`,
    height: `${config().track.h}px`,
    "border-radius": `${config().track.h / 2}px`,
    background: isChecked() ? "var(--accent-primary)" : "var(--border-default)",
    transition: "background 150ms ease",
    "flex-shrink": "0",
    "box-shadow": focused() ? "0 0 0 2px var(--accent-muted)" : "none",
  });

  const knobStyle = (): JSX.CSSProperties => ({
    position: "absolute",
    top: `${config().knob.offset}px`,
    left: isChecked()
      ? `${config().track.w - config().knob.size - config().knob.offset}px`
      : `${config().knob.offset}px`,
    width: `${config().knob.size}px`,
    height: `${config().knob.size}px`,
    "border-radius": "var(--cortex-radius-full)",
    background: "var(--cortex-text-primary, var(--cortex-text-primary))",
    transition: "left 150ms ease",
    "box-shadow": "0 1px 3px rgba(0, 0, 0, 0.3)",
  });

  const labelContainerStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-direction": "column",
    gap: "2px",
  };

  const labelStyle: JSX.CSSProperties = {
    "font-family": "var(--jb-font-ui)",
    "font-size": "13px",
    color: "var(--text-primary)",
    "user-select": "none",
  };

  const descriptionStyle: JSX.CSSProperties = {
    "font-family": "var(--jb-font-ui)",
    "font-size": "12px",
    color: "var(--text-muted)",
    "user-select": "none",
  };

  return (
    <div
      style={containerStyle}
      onClick={handleClick}
    >
      <div
        role="switch"
        aria-checked={isChecked()}
        aria-disabled={local.disabled}
        aria-label={local["aria-label"] || local.label}
        tabIndex={local.disabled ? -1 : 0}
        style={trackStyle()}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      >
        <div style={knobStyle()} />
      </div>
      <Show when={local.label || local.description}>
        <div style={labelContainerStyle}>
          <Show when={local.label}>
            <span style={labelStyle}>{local.label}</span>
          </Show>
          <Show when={local.description}>
            <span style={descriptionStyle}>{local.description}</span>
          </Show>
        </div>
      </Show>
    </div>
  );
}


