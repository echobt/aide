/**
 * Modal - Cortex UI Design System Modal Component
 * 
 * Cortex UI specs:
 * - Background: var(--cortex-bg-primary) (--cortex-bg-primary)
 * - Border: rgba(255,255,255,0.15) (--cortex-border-default)
 * - Border radius: 16px (--cortex-radius-xl)
 * - Overlay: rgba(0,0,0,0.6)
 */
import { JSX, splitProps, Show, onMount, onCleanup } from "solid-js";
import { Portal } from "solid-js/web";

export interface ModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when modal should close */
  onClose: () => void;
  /** Modal title */
  title?: string;
  /** Modal content */
  children: JSX.Element;
  /** Modal size variant */
  size?: "sm" | "md" | "lg" | "xl";
  /** Footer content (buttons, etc.) */
  footer?: JSX.Element;
  /** Whether clicking overlay closes modal */
  closeOnOverlay?: boolean;
  /** Whether pressing Escape closes modal */
  closeOnEscape?: boolean;
  /** Custom styles for modal container */
  style?: JSX.CSSProperties;
}

export function Modal(props: ModalProps) {
  const [local] = splitProps(props, [
    "open", "onClose", "title", "children", "size", "footer",
    "closeOnOverlay", "closeOnEscape", "style"
  ]);

  const size = () => local.size || "md";
  const closeOnOverlay = () => local.closeOnOverlay !== false;
  const closeOnEscape = () => local.closeOnEscape !== false;

  const sizeStyles: Record<string, JSX.CSSProperties> = {
    sm: { width: "320px", "max-width": "90vw" },
    md: { width: "480px", "max-width": "90vw" },
    lg: { width: "640px", "max-width": "90vw" },
    xl: { width: "800px", "max-width": "90vw" },
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && closeOnEscape() && local.open) {
      e.preventDefault();
      local.onClose();
    }
  };

  const handleOverlayClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget && closeOnOverlay()) {
      local.onClose();
    }
  };

  onMount(() => {
    document.addEventListener("keydown", handleKeyDown);
  });

  onCleanup(() => {
    document.removeEventListener("keydown", handleKeyDown);
  });

  const overlayStyle: JSX.CSSProperties = {
    position: "fixed",
    inset: "0",
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    background: "var(--cortex-bg-overlay)",
    "backdrop-filter": "blur(4px)",
    "z-index": "var(--cortex-z-modal)",
  };

  const modalStyle = (): JSX.CSSProperties => ({
    background: "var(--cortex-bg-primary)",
    border: "1px solid var(--cortex-border-default)",
    "border-radius": "var(--cortex-radius-xl)",
    "box-shadow": "var(--cortex-elevation-4)",
    display: "flex",
    "flex-direction": "column",
    "max-height": "80vh",
    overflow: "hidden",
    ...sizeStyles[size()],
    ...local.style,
  });

  const headerStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    "justify-content": "space-between",
    padding: "16px 20px",
    "border-bottom": "1px solid var(--cortex-border-default)",
    "flex-shrink": "0",
  };

  const titleStyle: JSX.CSSProperties = {
    "font-size": "16px",
    "font-weight": "600",
    color: "var(--cortex-text-primary)",
    margin: "0",
  };

  const closeButtonStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    width: "28px",
    height: "28px",
    background: "transparent",
    border: "none",
    "border-radius": "var(--cortex-radius-sm)",
    color: "var(--cortex-text-inactive)",
    cursor: "pointer",
    transition: "background var(--cortex-transition-fast)",
  };

  const contentStyle: JSX.CSSProperties = {
    flex: "1",
    overflow: "auto",
    padding: "20px",
  };

  const footerStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    "justify-content": "flex-end",
    gap: "8px",
    padding: "16px 20px",
    "border-top": "1px solid var(--cortex-border-default)",
    "flex-shrink": "0",
  };

  return (
    <Show when={local.open}>
      <Portal>
        <div style={overlayStyle} onClick={handleOverlayClick}>
          <div style={modalStyle()} role="dialog" aria-modal="true">
            <Show when={local.title}>
              <div style={headerStyle}>
                <h2 style={titleStyle}>{local.title}</h2>
                <button
                  style={closeButtonStyle}
                  onClick={local.onClose}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--cortex-bg-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  aria-label="Close"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </Show>
            <div style={contentStyle}>{local.children}</div>
            <Show when={local.footer}>
              <div style={footerStyle}>{local.footer}</div>
            </Show>
          </div>
        </div>
      </Portal>
    </Show>
  );
}


