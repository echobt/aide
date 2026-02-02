import { JSX, splitProps, Show, createSignal, onCleanup } from "solid-js";
import { Portal } from "solid-js/web";

export type TooltipPosition = "top" | "bottom" | "left" | "right";

export interface TooltipProps {
  /** Tooltip content */
  content: JSX.Element | string;
  /** Trigger element */
  children: JSX.Element;
  /** Position relative to trigger */
  position?: TooltipPosition;
  /** Show delay in ms */
  delay?: number;
  /** Whether tooltip is disabled */
  disabled?: boolean;
  /** Custom max width */
  maxWidth?: number;
  /** Custom styles */
  style?: JSX.CSSProperties;
}

export function Tooltip(props: TooltipProps) {
  const [local] = splitProps(props, [
    "content", "children", "position", "delay", "disabled", "maxWidth", "style"
  ]);

  const [visible, setVisible] = createSignal(false);
  const [coords, setCoords] = createSignal({ x: 0, y: 0 });
  
  let triggerRef: HTMLDivElement | undefined;
  let timeoutId: number | undefined;

  const position = () => local.position || "top";
  const delay = () => local.delay ?? 200;
  const maxWidth = () => local.maxWidth ?? 300;

  const updatePosition = () => {
    if (!triggerRef) return;
    const rect = triggerRef.getBoundingClientRect();
    const gap = 6;
    let x = 0, y = 0;

    switch (position()) {
      case "top":
        x = rect.left + rect.width / 2;
        y = rect.top - gap;
        break;
      case "bottom":
        x = rect.left + rect.width / 2;
        y = rect.bottom + gap;
        break;
      case "left":
        x = rect.left - gap;
        y = rect.top + rect.height / 2;
        break;
      case "right":
        x = rect.right + gap;
        y = rect.top + rect.height / 2;
        break;
    }
    setCoords({ x, y });
  };

  const show = () => {
    if (local.disabled) return;
    clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => {
      updatePosition();
      setVisible(true);
    }, delay());
  };

  const hide = () => {
    clearTimeout(timeoutId);
    setVisible(false);
  };

  onCleanup(() => clearTimeout(timeoutId));

  const tooltipStyle = (): JSX.CSSProperties => {
    const pos = position();
    const c = coords();
    const base: JSX.CSSProperties = {
      position: "fixed",
      "z-index": "10000",
      padding: "6px 10px",
      background: "var(--surface-elevated)",
      "border-radius": "var(--radius-sm)",
      "box-shadow": "var(--shadow-popup)",
      border: "1px solid var(--border-default)",
      "font-family": "var(--jb-font-ui)",
      "font-size": "12px",
      color: "var(--text-primary)",
      "max-width": `${maxWidth()}px`,
      "white-space": "normal",
      "line-height": "1.4",
      "word-wrap": "break-word",
      "pointer-events": "none",
      ...local.style,
    };

    switch (pos) {
      case "top":
        return { ...base, left: `${c.x}px`, top: `${c.y}px`, transform: "translate(-50%, -100%)" };
      case "bottom":
        return { ...base, left: `${c.x}px`, top: `${c.y}px`, transform: "translate(-50%, 0)" };
      case "left":
        return { ...base, left: `${c.x}px`, top: `${c.y}px`, transform: "translate(-100%, -50%)" };
      case "right":
        return { ...base, left: `${c.x}px`, top: `${c.y}px`, transform: "translate(0, -50%)" };
    }
  };

  return (
    <>
      <div
        ref={triggerRef}
        style={{ display: "inline-block" }}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        {local.children}
      </div>
      <Show when={visible()}>
        <Portal>
          <div role="tooltip" style={tooltipStyle()}>
            {local.content}
          </div>
        </Portal>
      </Show>
    </>
  );
}

/** Simple tooltip wrapper for common use cases */
export interface SimpleTooltipProps {
  text: string;
  children: JSX.Element;
  position?: TooltipPosition;
  delay?: number;
  disabled?: boolean;
}

export function SimpleTooltip(props: SimpleTooltipProps) {
  return (
    <Tooltip
      content={props.text}
      position={props.position}
      delay={props.delay}
      disabled={props.disabled}
    >
      {props.children}
    </Tooltip>
  );
}
