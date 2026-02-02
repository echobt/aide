/**
 * Button - Cortex UI Design System Button Component
 * 
 * Cortex UI specs:
 * - Primary: var(--cortex-accent-primary) bg, var(--cortex-accent-text) text
 * - Secondary: transparent bg, var(--cortex-text-primary) text, rgba(255,255,255,0.15) border
 * - Border radius: 8px (--cortex-radius-md)
 */
import { JSX, splitProps, Show } from "solid-js";

export interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: JSX.Element;
  iconRight?: JSX.Element;
}

export function Button(props: ButtonProps) {
  const [local, rest] = splitProps(props, [
    "variant",
    "size",
    "loading",
    "icon",
    "iconRight",
    "children",
    "style",
    "disabled",
  ]);

  const variant = () => local.variant || "secondary";
  const size = () => local.size || "md";

  const baseStyle: JSX.CSSProperties = {
    display: "inline-flex",
    "align-items": "center",
    "justify-content": "center",
    gap: "6px",
    "font-family": "var(--cortex-font-sans)",
    "font-size": "var(--cortex-text-sm)",
    "font-weight": "500",
    "border-radius": "var(--cortex-radius-md)",
    cursor: local.disabled || local.loading ? "not-allowed" : "pointer",
    opacity: local.disabled ? "0.5" : "1",
    transition: "all var(--cortex-transition-fast)",
    "white-space": "nowrap",
    "flex-shrink": "0",
  };

  const sizeStyles: Record<string, JSX.CSSProperties> = {
    sm: { height: "24px", padding: "0 10px", "font-size": "12px" },
    md: { height: "32px", padding: "0 16px" },
    lg: { height: "40px", padding: "0 20px" },
  };

  const variantStyles: Record<string, JSX.CSSProperties> = {
    primary: {
      background: "var(--cortex-accent-primary)",
      color: "var(--cortex-accent-text)",
      border: "none",
    },
    secondary: {
      background: "transparent",
      color: "var(--cortex-text-primary)",
      border: "1px solid var(--cortex-border-default)",
    },
    ghost: {
      background: "transparent",
      color: "var(--cortex-text-primary)",
      border: "none",
    },
    danger: {
      background: "var(--cortex-error)",
      color: "var(--cortex-text-primary)",
      border: "none",
    },
  };

  const computedStyle = (): JSX.CSSProperties => ({
    ...baseStyle,
    ...sizeStyles[size()],
    ...variantStyles[variant()],
    ...(typeof local.style === "object" ? local.style : {}),
  });

  const handleMouseEnter = (e: MouseEvent) => {
    if (!local.disabled && !local.loading) {
      const el = e.currentTarget as HTMLElement;
      if (variant() === "primary") {
        el.style.background = "var(--cortex-accent-hover)";
      } else if (variant() === "secondary" || variant() === "ghost") {
        el.style.background = "var(--cortex-bg-hover)";
      } else if (variant() === "danger") {
        el.style.background = "var(--cortex-error-hover)";
      }
    }
  };

  const handleMouseLeave = (e: MouseEvent) => {
    const el = e.currentTarget as HTMLElement;
    el.style.background = variantStyles[variant()].background as string;
  };

  const handleMouseDown = (e: MouseEvent) => {
    if (!local.disabled && !local.loading) {
      const el = e.currentTarget as HTMLElement;
      if (variant() === "primary") {
        el.style.background = "var(--cortex-accent-pressed)";
      } else if (variant() === "secondary" || variant() === "ghost") {
        el.style.background = "var(--cortex-bg-active)";
      }
    }
  };

  const handleMouseUp = (e: MouseEvent) => {
    if (!local.disabled && !local.loading) {
      const el = e.currentTarget as HTMLElement;
      if (variant() === "primary") {
        el.style.background = "var(--cortex-accent-hover)";
      } else if (variant() === "secondary" || variant() === "ghost") {
        el.style.background = "var(--cortex-bg-hover)";
      }
    }
  };

  return (
    <button
      {...rest}
      disabled={local.disabled || local.loading}
      style={computedStyle()}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
    >
      <Show when={local.loading}>
        <LoadingSpinner />
      </Show>
      <Show when={local.icon && !local.loading}>
        {local.icon}
      </Show>
      {local.children}
      <Show when={local.iconRight}>
        {local.iconRight}
      </Show>
    </button>
  );
}

function LoadingSpinner() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      style={{ animation: "spin 1s linear infinite" }}
    >
      <circle
        cx="7"
        cy="7"
        r="5"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-dasharray="25"
        stroke-dashoffset="10"
      />
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </svg>
  );
}


