import { Component, createSignal, For, Show } from "solid-js";

interface Variable {
  name: string;
  value: string;
  type: string;
  children?: Variable[];
}

interface StackFrame {
  name: string;
  file: string;
  line: number;
}

interface Breakpoint {
  file: string;
  line: number;
  enabled: boolean;
  condition?: string;
}

export const CortexDebugPanel: Component = () => {
  const [isRunning, setIsRunning] = createSignal(false);
  const [isPaused, setIsPaused] = createSignal(false);
  const [expandedSections, setExpandedSections] = createSignal<Set<string>>(new Set(["variables", "callstack", "breakpoints"]));
  const [expandedVars, setExpandedVars] = createSignal<Set<string>>(new Set());

  const [variables] = createSignal<Variable[]>([
    { name: "count", value: "42", type: "number" },
    { name: "items", value: "Array(3)", type: "array", children: [
      { name: "0", value: '"apple"', type: "string" },
      { name: "1", value: '"banana"', type: "string" },
      { name: "2", value: '"cherry"', type: "string" },
    ]},
    { name: "user", value: "Object", type: "object", children: [
      { name: "name", value: '"John"', type: "string" },
      { name: "age", value: "30", type: "number" },
    ]},
  ]);

  const [callStack] = createSignal<StackFrame[]>([
    { name: "handleClick", file: "src/App.tsx", line: 45 },
    { name: "processData", file: "src/utils/data.ts", line: 12 },
    { name: "main", file: "src/index.ts", line: 8 },
  ]);

  const [breakpoints, setBreakpoints] = createSignal<Breakpoint[]>([
    { file: "src/App.tsx", line: 42, enabled: true },
    { file: "src/utils/data.ts", line: 15, enabled: true, condition: "count > 10" },
    { file: "src/index.ts", line: 5, enabled: false },
  ]);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const toggleVar = (name: string) => {
    setExpandedVars(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const toggleBreakpoint = (index: number) => {
    setBreakpoints(prev => prev.map((bp, i) => 
      i === index ? { ...bp, enabled: !bp.enabled } : bp
    ));
  };

  const removeBreakpoint = (index: number) => {
    setBreakpoints(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div style={{
      display: "flex",
      "flex-direction": "column",
      height: "100%",
      background: "var(--cortex-bg-secondary)",
      color: "var(--cortex-text-primary)",
      "font-family": "'SF Pro Text', -apple-system, sans-serif",
      "font-size": "13px",
    }}>
      {/* Header */}
      <div style={{
        display: "flex",
        "align-items": "center",
        "justify-content": "space-between",
        padding: "12px 16px",
        "border-bottom": "1px solid var(--cortex-bg-hover)",
      }}>
        <span style={{ "font-weight": "500" }}>Run and Debug</span>
      </div>

      {/* Controls */}
      <div style={{
        display: "flex",
        "align-items": "center",
        gap: "4px",
        padding: "8px 16px",
        "border-bottom": "1px solid var(--cortex-bg-hover)",
      }}>
        <Show when={!isRunning()}>
          <ControlButton onClick={() => { setIsRunning(true); setIsPaused(false); }} color="var(--cortex-success)" title="Start Debugging">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4 2v12l10-6L4 2z"/>
            </svg>
          </ControlButton>
        </Show>
        <Show when={isRunning()}>
          <Show when={isPaused()}>
            <ControlButton onClick={() => setIsPaused(false)} color="var(--cortex-success)" title="Continue">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4 2v12l10-6L4 2z"/>
              </svg>
            </ControlButton>
          </Show>
          <Show when={!isPaused()}>
            <ControlButton onClick={() => setIsPaused(true)} color="var(--cortex-warning)" title="Pause">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4 2h3v12H4V2zm5 0h3v12H9V2z"/>
              </svg>
            </ControlButton>
          </Show>
          <ControlButton onClick={() => { setIsRunning(false); setIsPaused(false); }} color="var(--cortex-error)" title="Stop">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M3 3h10v10H3V3z"/>
            </svg>
          </ControlButton>
          <ControlButton onClick={() => {}} title="Step Over">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M14.5 8.5l-3.5 3v-2H4V8h7V6l3.5 2.5z"/>
            </svg>
          </ControlButton>
          <ControlButton onClick={() => {}} title="Step Into">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 14l3.5-3.5H9V5h7V4H8v6.5H5.5L8 14z"/>
            </svg>
          </ControlButton>
          <ControlButton onClick={() => {}} title="Step Out">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 2L4.5 5.5H7V11H1v1h7V5.5h2.5L8 2z"/>
            </svg>
          </ControlButton>
        </Show>
      </div>

      {/* Sections */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {/* Variables */}
        <Section
          title="Variables"
          expanded={expandedSections().has("variables")}
          onToggle={() => toggleSection("variables")}
        >
          <Show when={isRunning() && isPaused()}>
            <For each={variables()}>
              {(v) => (
                <VariableRow
                  variable={v}
                  depth={0}
                  expanded={expandedVars().has(v.name)}
                  onToggle={() => toggleVar(v.name)}
                  expandedVars={expandedVars()}
                  onToggleVar={toggleVar}
                />
              )}
            </For>
          </Show>
          <Show when={!isRunning() || !isPaused()}>
            <div style={{ padding: "8px 16px", color: "var(--cortex-text-inactive)", "font-size": "12px" }}>
              Not paused
            </div>
          </Show>
        </Section>

        {/* Call Stack */}
        <Section
          title="Call Stack"
          expanded={expandedSections().has("callstack")}
          onToggle={() => toggleSection("callstack")}
        >
          <Show when={isRunning() && isPaused()}>
            <For each={callStack()}>
              {(frame, index) => (
                <div
                  style={{
                    display: "flex",
                    "align-items": "center",
                    padding: "4px 16px 4px 32px",
                    cursor: "pointer",
                    background: index() === 0 ? "rgba(178,255,34,0.1)" : "transparent",
                  }}
                  class="stack-row"
                >
                  <span style={{ flex: 1 }}>{frame.name}</span>
                  <span style={{ color: "var(--cortex-text-inactive)", "font-size": "12px" }}>
                    {frame.file.split("/").pop()}:{frame.line}
                  </span>
                </div>
              )}
            </For>
          </Show>
          <Show when={!isRunning() || !isPaused()}>
            <div style={{ padding: "8px 16px", color: "var(--cortex-text-inactive)", "font-size": "12px" }}>
              Not paused
            </div>
          </Show>
        </Section>

        {/* Breakpoints */}
        <Section
          title="Breakpoints"
          expanded={expandedSections().has("breakpoints")}
          onToggle={() => toggleSection("breakpoints")}
        >
          <For each={breakpoints()}>
            {(bp, index) => (
              <div
                style={{
                  display: "flex",
                  "align-items": "center",
                  padding: "4px 16px 4px 32px",
                  gap: "8px",
                  opacity: bp.enabled ? 1 : 0.5,
                }}
                class="breakpoint-row"
              >
                <input
                  type="checkbox"
                  checked={bp.enabled}
                  onChange={() => toggleBreakpoint(index())}
                  style={{ "accent-color": "var(--cortex-accent-primary)" }}
                />
                <svg width="14" height="14" viewBox="0 0 16 16" fill={bp.enabled ? "var(--cortex-error)" : "var(--cortex-text-inactive)"}>
                  <circle cx="8" cy="8" r="6"/>
                </svg>
                <span style={{ flex: 1 }}>
                  {bp.file.split("/").pop()}:{bp.line}
                  <Show when={bp.condition}>
                    <span style={{ color: "var(--cortex-warning)", "margin-left": "8px", "font-size": "11px" }}>
                      {bp.condition}
                    </span>
                  </Show>
                </span>
                <button
                  onClick={() => removeBreakpoint(index())}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--cortex-text-inactive)",
                    cursor: "pointer",
                    padding: "2px",
                    opacity: 0,
                  }}
                  class="bp-remove"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm3.5 9.5l-1 1L8 9l-2.5 2.5-1-1L7 8 4.5 5.5l1-1L8 7l2.5-2.5 1 1L9 8l2.5 2.5z"/>
                  </svg>
                </button>
              </div>
            )}
          </For>
          <Show when={breakpoints().length === 0}>
            <div style={{ padding: "8px 16px", color: "var(--cortex-text-inactive)", "font-size": "12px" }}>
              No breakpoints
            </div>
          </Show>
        </Section>
      </div>

      <style>{`
        .stack-row:hover { background: rgba(255,255,255,0.05) !important; }
        .breakpoint-row:hover { background: rgba(255,255,255,0.05); }
        .breakpoint-row:hover .bp-remove { opacity: 1; }
      `}</style>
    </div>
  );
};

const ControlButton: Component<{ onClick: () => void; color?: string; title: string; children: any }> = (props) => (
  <button
    onClick={props.onClick}
    title={props.title}
    style={{
      background: "transparent",
      border: "none",
      color: props.color || "var(--cortex-text-inactive)",
      cursor: "pointer",
      padding: "6px",
      "border-radius": "var(--cortex-radius-sm)",
      display: "flex",
      "align-items": "center",
      "justify-content": "center",
    }}
    class="control-btn"
  >
    {props.children}
    <style>{`.control-btn:hover { background: rgba(255,255,255,0.1); }`}</style>
  </button>
);

interface SectionProps {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: any;
}

const Section: Component<SectionProps> = (props) => (
  <div style={{ "border-bottom": "1px solid var(--cortex-bg-hover)" }}>
    <div
      onClick={props.onToggle}
      style={{
        display: "flex",
        "align-items": "center",
        padding: "8px 16px",
        cursor: "pointer",
        "user-select": "none",
      }}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 16 16"
        fill="var(--cortex-text-inactive)"
        style={{
          transform: props.expanded ? "rotate(90deg)" : "rotate(0deg)",
          transition: "transform 0.15s",
          "margin-right": "8px",
        }}
      >
        <path d="M6 4l4 4-4 4V4z"/>
      </svg>
      <span style={{ "font-size": "12px", "text-transform": "uppercase", color: "var(--cortex-text-inactive)" }}>
        {props.title}
      </span>
    </div>
    <Show when={props.expanded}>
      <div style={{ "padding-bottom": "4px" }}>{props.children}</div>
    </Show>
  </div>
);

interface VariableRowProps {
  variable: Variable;
  depth: number;
  expanded: boolean;
  onToggle: () => void;
  expandedVars: Set<string>;
  onToggleVar: (name: string) => void;
}

const typeColors: Record<string, string> = {
  string: "var(--cortex-syntax-string)",
  number: "var(--cortex-syntax-number)",
  boolean: "var(--cortex-syntax-keyword)",
  object: "var(--cortex-syntax-function)",
  array: "var(--cortex-syntax-function)",
};

const VariableRow: Component<VariableRowProps> = (props) => (
  <>
    <div
      onClick={() => props.variable.children && props.onToggle()}
      style={{
        display: "flex",
        "align-items": "center",
        padding: `4px 16px 4px ${16 + props.depth * 16}px`,
        cursor: props.variable.children ? "pointer" : "default",
        "font-family": "monospace",
        "font-size": "12px",
      }}
      class="var-row"
    >
      <Show when={props.variable.children}>
        <svg
          width="12"
          height="12"
          viewBox="0 0 16 16"
          fill="var(--cortex-text-inactive)"
          style={{
            transform: props.expanded ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 0.15s",
            "margin-right": "4px",
          }}
        >
          <path d="M6 4l4 4-4 4V4z"/>
        </svg>
      </Show>
      <Show when={!props.variable.children}>
        <span style={{ width: "16px" }} />
      </Show>
      <span style={{ color: "var(--cortex-syntax-variable)" }}>{props.variable.name}</span>
      <span style={{ color: "var(--cortex-text-inactive)", margin: "0 4px" }}>:</span>
      <span style={{ color: typeColors[props.variable.type] || "var(--cortex-text-primary)" }}>{props.variable.value}</span>
    </div>
    <Show when={props.expanded && props.variable.children}>
      <For each={props.variable.children}>
        {(child) => (
          <VariableRow
            variable={child}
            depth={props.depth + 1}
            expanded={props.expandedVars.has(child.name)}
            onToggle={() => props.onToggleVar(child.name)}
            expandedVars={props.expandedVars}
            onToggleVar={props.onToggleVar}
          />
        )}
      </For>
    </Show>
    <style>{`.var-row:hover { background: rgba(255,255,255,0.05); }`}</style>
  </>
);

export default CortexDebugPanel;


