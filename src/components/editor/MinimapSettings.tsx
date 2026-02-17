import { createSignal, Show, type JSX } from "solid-js";
import { useSettings } from "@/context/SettingsContext";
import { Icon } from "../ui/Icon";
import { tokens } from "@/design-system/tokens";

// ============================================================================
// Types
// ============================================================================

type MinimapSide = "left" | "right";
type MinimapRenderMode = "characters" | "blocks";

interface MinimapSettingsProps {
  onClose?: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const MIN_WIDTH = 50;
const MAX_WIDTH = 300;
const MIN_MAX_COLUMN = 40;
const MAX_MAX_COLUMN = 200;

// ============================================================================
// Styles
// ============================================================================

const panelStyle: JSX.CSSProperties = {
  display: "flex",
  "flex-direction": "column",
  gap: "12px",
  padding: "16px",
  background: "var(--vscode-editorWidget-background, var(--surface-panel))",
  border: `1px solid var(--vscode-editorWidget-border, ${tokens.colors.border.default})`,
  "border-radius": tokens.radius.md,
  "min-width": "280px",
  "font-size": "13px",
  color: tokens.colors.text.primary,
};

const headerStyle: JSX.CSSProperties = {
  display: "flex",
  "align-items": "center",
  "justify-content": "space-between",
  "padding-bottom": "8px",
  "border-bottom": `1px solid ${tokens.colors.border.default}`,
};

const rowStyle: JSX.CSSProperties = {
  display: "flex",
  "align-items": "center",
  "justify-content": "space-between",
  gap: "12px",
  "min-height": "28px",
};

const labelStyle: JSX.CSSProperties = {
  color: tokens.colors.text.secondary,
  "font-size": "12px",
  "white-space": "nowrap",
};

const toggleTrackStyle = (active: boolean): JSX.CSSProperties => ({
  position: "relative",
  width: "36px",
  height: "20px",
  "border-radius": tokens.radius.full,
  background: active ? tokens.colors.accent.primary : tokens.colors.surface.active,
  cursor: "pointer",
  transition: "background 0.2s",
  border: "none",
  padding: "0",
  "flex-shrink": "0",
});

const toggleThumbStyle = (active: boolean): JSX.CSSProperties => ({
  position: "absolute",
  top: "2px",
  left: active ? "18px" : "2px",
  width: "16px",
  height: "16px",
  "border-radius": tokens.radius.full,
  background: "#fff",
  transition: "left 0.2s",
  "pointer-events": "none",
});

const segmentGroupStyle: JSX.CSSProperties = {
  display: "flex",
  "border-radius": tokens.radius.sm,
  overflow: "hidden",
  border: `1px solid ${tokens.colors.border.default}`,
};

const segmentStyle = (active: boolean): JSX.CSSProperties => ({
  padding: "4px 12px",
  border: "none",
  background: active ? tokens.colors.accent.primary : tokens.colors.surface.input,
  color: active ? "#fff" : tokens.colors.text.secondary,
  cursor: "pointer",
  "font-size": "12px",
  "font-weight": active ? "600" : "400",
  transition: "background 0.15s, color 0.15s",
});

const sliderStyle: JSX.CSSProperties = {
  flex: "1",
  height: "4px",
  "accent-color": "var(--accent-primary)",
  cursor: "pointer",
};

const numberInputStyle: JSX.CSSProperties = {
  width: "56px",
  padding: "4px 6px",
  background: tokens.colors.surface.input,
  border: `1px solid ${tokens.colors.border.default}`,
  "border-radius": tokens.radius.sm,
  color: tokens.colors.text.primary,
  "font-size": "12px",
  "text-align": "center",
  outline: "none",
};

const applyButtonStyle: JSX.CSSProperties = {
  padding: "6px 16px",
  background: tokens.colors.accent.primary,
  color: "#fff",
  border: "none",
  "border-radius": tokens.radius.sm,
  cursor: "pointer",
  "font-size": "12px",
  "font-weight": "600",
  transition: "background 0.15s",
  "align-self": "flex-end",
};

// ============================================================================
// Component
// ============================================================================

export function MinimapSettings(props: MinimapSettingsProps) {
  const settings = useSettings();
  const editor = () => settings.effectiveSettings().editor;

  const [enabled, setEnabled] = createSignal(editor().minimapEnabled);
  const [side, setSide] = createSignal<MinimapSide>("right");
  const [width, setWidth] = createSignal(editor().minimapWidth ?? 100);
  const [showDecorations, setShowDecorations] = createSignal(true);
  const [renderMode, setRenderMode] = createSignal<MinimapRenderMode>("characters");
  const [maxColumn, setMaxColumn] = createSignal(120);

  const clampWidth = (val: number) => Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, val));
  const clampMaxCol = (val: number) => Math.max(MIN_MAX_COLUMN, Math.min(MAX_MAX_COLUMN, val));

  const handleWidthInput = (e: Event) => {
    const target = e.target as HTMLInputElement;
    setWidth(clampWidth(Number(target.value)));
  };

  const handleMaxColumnInput = (e: Event) => {
    const target = e.target as HTMLInputElement;
    const parsed = parseInt(target.value, 10);
    if (!isNaN(parsed)) {
      setMaxColumn(clampMaxCol(parsed));
    }
  };

  const handleApply = async () => {
    await settings.updateEditorSetting("minimapEnabled", enabled());
    await settings.updateEditorSetting("minimapWidth", width());
  };

  return (
    <div style={panelStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
          <Icon name="map" style={{ width: "16px", height: "16px", color: tokens.colors.accent.primary }} />
          <span style={{ "font-weight": "600", "font-size": "13px" }}>Minimap Settings</span>
        </div>
        <Show when={props.onClose}>
          <button
            style={{ background: "transparent", border: "none", cursor: "pointer", color: tokens.colors.text.muted, padding: "2px" } as JSX.CSSProperties}
            onClick={props.onClose}
            title="Close"
          >
            <Icon name="xmark" style={{ width: "14px", height: "14px" }} />
          </button>
        </Show>
      </div>

      {/* Enabled toggle */}
      <div style={rowStyle}>
        <span style={labelStyle}>Enable Minimap</span>
        <button style={toggleTrackStyle(enabled())} onClick={() => setEnabled(!enabled())} aria-label="Toggle minimap">
          <div style={toggleThumbStyle(enabled())} />
        </button>
      </div>

      {/* Side selector */}
      <div style={rowStyle}>
        <span style={labelStyle}>Side</span>
        <div style={segmentGroupStyle}>
          <button style={segmentStyle(side() === "left")} onClick={() => setSide("left")}>Left</button>
          <button style={segmentStyle(side() === "right")} onClick={() => setSide("right")}>Right</button>
        </div>
      </div>

      {/* Width slider */}
      <div style={{ display: "flex", "flex-direction": "column", gap: "4px" } as JSX.CSSProperties}>
        <div style={rowStyle}>
          <span style={labelStyle}>Width</span>
          <span style={{ ...labelStyle, color: tokens.colors.text.primary } as JSX.CSSProperties}>{width()}px</span>
        </div>
        <input
          type="range"
          min={MIN_WIDTH}
          max={MAX_WIDTH}
          value={width()}
          onInput={handleWidthInput}
          style={sliderStyle}
        />
      </div>

      {/* Show decorations toggle */}
      <div style={rowStyle}>
        <span style={labelStyle}>Show Slider Decorations</span>
        <button style={toggleTrackStyle(showDecorations())} onClick={() => setShowDecorations(!showDecorations())} aria-label="Toggle decorations">
          <div style={toggleThumbStyle(showDecorations())} />
        </button>
      </div>

      {/* Render mode */}
      <div style={rowStyle}>
        <span style={labelStyle}>Render</span>
        <div style={segmentGroupStyle}>
          <button style={segmentStyle(renderMode() === "characters")} onClick={() => setRenderMode("characters")}>Characters</button>
          <button style={segmentStyle(renderMode() === "blocks")} onClick={() => setRenderMode("blocks")}>Blocks</button>
        </div>
      </div>

      {/* Max column */}
      <div style={rowStyle}>
        <span style={labelStyle}>Max Column</span>
        <input
          type="number"
          min={MIN_MAX_COLUMN}
          max={MAX_MAX_COLUMN}
          value={maxColumn()}
          onInput={handleMaxColumnInput}
          style={numberInputStyle}
        />
      </div>

      {/* Apply button */}
      <button style={applyButtonStyle} onClick={handleApply}>
        Apply
      </button>
    </div>
  );
}
