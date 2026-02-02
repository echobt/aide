/**
 * CortexInput - Pixel-perfect input component for Cortex UI Design System
 * Used in chat prompt and other input fields
 */

import { Component, JSX, splitProps, createSignal, Show } from "solid-js";
import { CortexIcon } from "./CortexIcon";

export interface CortexInputProps {
  value?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  disabled?: boolean;
  error?: boolean;
  size?: "sm" | "md" | "lg";
  leftIcon?: string;
  rightIcon?: string;
  onRightIconClick?: () => void;
  class?: string;
  style?: JSX.CSSProperties;
  type?: "text" | "password" | "email" | "search";
  autoFocus?: boolean;
  multiline?: boolean;
  rows?: number;
}

const SIZE_SPECS = {
  sm: { height: 32, padding: 8, fontSize: 14, iconSize: 14 },
  md: { height: 40, padding: 12, fontSize: 14, iconSize: 16 },
  lg: { height: 48, padding: 16, fontSize: 16, iconSize: 18 },
};

export const CortexInput: Component<CortexInputProps> = (props) => {
  const [local] = splitProps(props, [
    "value",
    "placeholder",
    "onChange",
    "onSubmit",
    "onFocus",
    "onBlur",
    "disabled",
    "error",
    "size",
    "leftIcon",
    "rightIcon",
    "onRightIconClick",
    "class",
    "style",
    "type",
    "autoFocus",
    "multiline",
    "rows",
  ]);

  const [isFocused, setIsFocused] = createSignal(false);
  const size = () => local.size || "md";
  const specs = () => SIZE_SPECS[size()];

  const containerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: "8px",
    height: local.multiline ? "auto" : `${specs().height}px`,
    "min-height": local.multiline ? `${specs().height}px` : undefined,
    padding: `${local.multiline ? specs().padding : 0}px ${specs().padding}px`,
    background: isFocused()
      ? "var(--cortex-input-bg-focus, var(--cortex-bg-hover))"
      : "var(--cortex-input-bg, var(--cortex-bg-hover))",
    border: local.error
      ? "1px solid var(--cortex-input-border-error, var(--cortex-error))"
      : isFocused()
      ? "1px solid var(--cortex-input-border-focus, var(--cortex-accent-primary))"
      : "1px solid var(--cortex-input-border, rgba(255,255,255,0.1))",
    "border-radius": "var(--cortex-input-radius, 8px)",
    transition: "all var(--cortex-transition-normal, 150ms ease)",
    opacity: local.disabled ? "0.5" : "1",
    cursor: local.disabled ? "not-allowed" : "text",
    ...local.style,
  });

  const inputStyle = (): JSX.CSSProperties => ({
    flex: "1",
    height: local.multiline ? "auto" : "100%",
    background: "transparent",
    border: "none",
    outline: "none",
    color: "var(--cortex-input-text, var(--cortex-text-primary))",
    "font-family": "var(--cortex-font-sans, Inter, sans-serif)",
    "font-size": `${specs().fontSize}px`,
    "line-height": local.multiline ? "1.5" : "1",
    resize: local.multiline ? "vertical" : "none",
  });

  const iconStyle = (clickable: boolean): JSX.CSSProperties => ({
    "flex-shrink": "0",
    color: "var(--cortex-text-muted, var(--cortex-text-inactive))",
    cursor: clickable ? "pointer" : "default",
    transition: "color var(--cortex-transition-fast, 100ms ease)",
  });

  const handleInput = (e: InputEvent) => {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement;
    local.onChange?.(target.value);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !local.multiline && !e.shiftKey) {
      e.preventDefault();
      local.onSubmit?.(local.value || "");
    }
  };

  const handleFocus = () => {
    setIsFocused(true);
    local.onFocus?.();
  };

  const handleBlur = () => {
    setIsFocused(false);
    local.onBlur?.();
  };

  return (
    <div class={local.class} style={containerStyle()}>
      <Show when={local.leftIcon}>
        <CortexIcon
          name={local.leftIcon!}
          size={specs().iconSize}
          style={iconStyle(false)}
        />
      </Show>

      {local.multiline ? (
        <textarea
          value={local.value || ""}
          placeholder={local.placeholder}
          disabled={local.disabled}
          autofocus={local.autoFocus}
          rows={local.rows || 3}
          style={inputStyle()}
          onInput={handleInput}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
        />
      ) : (
        <input
          type={local.type || "text"}
          value={local.value || ""}
          placeholder={local.placeholder}
          disabled={local.disabled}
          autofocus={local.autoFocus}
          style={inputStyle()}
          onInput={handleInput}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
        />
      )}

      <Show when={local.rightIcon}>
        <CortexIcon
          name={local.rightIcon!}
          size={specs().iconSize}
          style={iconStyle(!!local.onRightIconClick)}
          onClick={local.onRightIconClick}
        />
      </Show>
    </div>
  );
};

/**
 * CortexPromptInput - Specialized chat prompt input matching Figma design
 * Figma node 1579:54517: x:432, y:559, 697×127px
 * - Card background: var(--cortex-bg-hover) (visible dark card)
 * - border-radius: var(--cortex-radius-xl) (rounded corners)
 * - Placeholder: x:456, y:583, 259×14px
 * - Plus/Upload icons: x:456, y:642, 60×24px (24×24 icons)
 * - Send Button: x:1113, y:606, 32×32px (lime var(--cortex-accent-primary))
 * - Model Selector: x:1113, y:670, 171×32px
 */
export interface CortexPromptInputProps {
  value?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
  onPlusClick?: () => void;
  onUploadClick?: () => void;
  onModelClick?: () => void;
  modelName?: string;
  modelIcon?: string;
  isProcessing?: boolean;
  onStop?: () => void;
  class?: string;
  style?: JSX.CSSProperties;
}

export const CortexPromptInput: Component<CortexPromptInputProps> = (props) => {
  const [local, others] = splitProps(props, [
    "value",
    "placeholder",
    "onChange",
    "onSubmit",
    "onPlusClick",
    "onUploadClick",
    "onModelClick",
    "modelName",
    "modelIcon",
    "isProcessing",
    "onStop",
    "class",
    "style",
  ]);

  // Container: Figma node 0:341 - var(--cortex-bg-primary) bg, border rgba(255,255,255,0.15), rounded 16px
  const containerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "flex-direction": "column",
    width: "100%",
    "max-width": "697px",
    "min-width": "345px",
    padding: "24px",
    background: "var(--cortex-bg-primary)", // Figma: Prompt Input Background
    "border-radius": "var(--cortex-radius-xl)",
    border: "1px solid rgba(255, 255, 255, 0.15)",
    gap: "24px",
    ...local.style,
  });

  // Input row with send button
  const inputRowStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: "12px",
    height: "32px", // Match send button height
  });

  // Text input: placeholder 259×14px
  const inputStyle = (): JSX.CSSProperties => ({
    flex: "1",
    background: "transparent",
    border: "none",
    outline: "none",
    color: "var(--cortex-text-primary, var(--cortex-text-primary))",
    "font-family": "var(--cortex-font-sans, Inter, sans-serif)",
    "font-size": "14px",
    "line-height": "14px",
  });

  // Send button: Figma node 0:355 - 32×32px, var(--cortex-accent-primary) bg, rounded 16px
  const sendButtonStyle = (): JSX.CSSProperties => ({
    width: "32px",
    height: "32px",
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    background: local.isProcessing ? "var(--cortex-error)" : "var(--cortex-accent-primary)",
    "border-radius": "var(--cortex-radius-xl)", // Figma: fully rounded
    border: "1px solid rgba(255, 255, 255, 0.16)",
    cursor: "pointer",
    "flex-shrink": "0",
    transition: "background 100ms ease",
    padding: "8px",
  });

  const actionBarStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    "justify-content": "space-between",
    height: "32px",
  });

  const leftActionsStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: "12px",
  });

  const actionButtonStyle = (): JSX.CSSProperties => ({
    width: "24px",
    height: "24px",
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    color: "var(--cortex-text-muted, var(--cortex-text-inactive))",
    transition: "color var(--cortex-transition-fast, 100ms ease)",
  });

  // Model selector: Figma node 0:352 - var(--cortex-text-inactive) text, 14px
  const modelSelectorStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: "8px",
    padding: "8px",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    color: "var(--cortex-text-inactive)",
    "font-family": "'Inter', sans-serif",
    "font-size": "14px",
  });

  const handleSubmit = () => {
    if (local.isProcessing) {
      local.onStop?.();
    } else {
      local.onSubmit?.(local.value || "");
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div class={local.class} style={containerStyle()} {...others}>
      {/* Input Row */}
      <div style={inputRowStyle()}>
        <input
          type="text"
          value={local.value || ""}
          placeholder={local.placeholder || "Send a prompt or run a command..."}
          style={inputStyle()}
          onInput={(e) => local.onChange?.(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
        />
        {/* Send button: Figma node 0:355 */}
        <button style={sendButtonStyle()} onClick={handleSubmit}>
          <img 
            src="/assets/send-icon.svg" 
            alt="Send" 
            style={{ 
              width: "16px", 
              height: "16px", 
              transform: "rotate(180deg)",
              filter: local.isProcessing ? "invert(1)" : "none",
            }} 
          />
        </button>
      </div>

      {/* Action Bar */}
      <div style={actionBarStyle()}>
        <div style={leftActionsStyle()}>
          {/* Plus icon: Figma node 0:345 */}
          <button style={actionButtonStyle()} onClick={local.onPlusClick}>
            <CortexIcon name="plus" size={20} color="var(--cortex-text-inactive)" />
          </button>
          {/* Upload icon: Figma node 0:346 */}
          <button style={actionButtonStyle()} onClick={local.onUploadClick}>
            <CortexIcon name="upload" size={20} color="var(--cortex-text-inactive)" />
          </button>
        </div>

        {/* Model selector: Figma nodes 0:352, 0:353 */}
        <button style={modelSelectorStyle()} onClick={local.onModelClick}>
          {/* Claude icon */}
          <img 
            src="/assets/claude-logo.svg" 
            alt="" 
            style={{ width: "16px", height: "16px" }} 
          />
          <span>{local.modelName || "Claude 3.5 Sonnet"}</span>
          <CortexIcon name="chevron-down" size={16} color="var(--cortex-text-inactive)" />
        </button>
      </div>
    </div>
  );
};

export default CortexInput;


