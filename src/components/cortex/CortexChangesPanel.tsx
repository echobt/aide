/**
 * CortexChangesPanel - Changes & Terminal panel for Vibe mode
 * Split vertical: Changes on top, Terminal on bottom (Conductor style)
 */

import { Component, For, Show, createSignal, JSX } from "solid-js";

export interface FileChange {
  path: string;
  additions: number;
  deletions: number;
  status: "modified" | "added" | "deleted" | "renamed";
}

export interface CortexChangesPanelProps {
  changes: FileChange[];
  terminalOutput?: string[];
  branchName?: string;
  onFileClick?: (path: string) => void;
  onRunCommand?: (command: string) => void;
  onRun?: () => void;
  class?: string;
  style?: JSX.CSSProperties;
}

export const CortexChangesPanel: Component<CortexChangesPanelProps> = (props) => {
  const [terminalInput, setTerminalInput] = createSignal("");
  const [terminalHeight, setTerminalHeight] = createSignal(200);
  const [changesTab, setChangesTab] = createSignal<"changes" | "all_files">("changes");
  const [terminalTab, setTerminalTab] = createSignal<"run" | "terminal">("terminal");

  const containerStyle = (): JSX.CSSProperties => ({
    width: "320px",
    height: "100%",
    background: "var(--cortex-bg-secondary)",
    "border-left": "1px solid rgba(255,255,255,0.08)",
    display: "flex",
    "flex-direction": "column",
    overflow: "hidden",
    ...props.style,
  });

  // Changes header tabs
  const headerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    padding: "0 12px",
    height: "40px",
    "border-bottom": "1px solid rgba(255,255,255,0.08)",
    gap: "4px",
  });

  const tabStyle = (isActive: boolean): JSX.CSSProperties => ({
    padding: "8px 12px",
    "font-family": "'Inter', sans-serif",
    "font-size": "13px",
    color: isActive ? "var(--cortex-text-primary)" : "var(--cortex-text-inactive)",
    background: "transparent",
    border: "none",
    "border-bottom": isActive ? "2px solid var(--cortex-accent-primary)" : "2px solid transparent",
    cursor: "pointer",
    transition: "all 100ms",
    "margin-bottom": "-1px",
    display: "flex",
    "align-items": "center",
    gap: "6px",
  });

  const tabCountStyle = (): JSX.CSSProperties => ({
    "font-size": "11px",
    background: "var(--cortex-accent-primary)",
    color: "var(--cortex-text-primary)",
    padding: "1px 5px",
    "border-radius": "var(--cortex-radius-md)",
    "font-weight": "500",
  });

  // Changes list (top section)
  const changesListStyle = (): JSX.CSSProperties => ({
    flex: "1",
    overflow: "auto",
    "min-height": "100px",
  });

  const fileItemStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: "8px",
    padding: "6px 12px",
    cursor: "pointer",
    transition: "background 100ms",
  });

  const fileIconStyle = (status: FileChange["status"]): JSX.CSSProperties => ({
    width: "16px",
    height: "16px",
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    "font-size": "12px",
    color: status === "added" ? "var(--cortex-success)" :
           status === "deleted" ? "var(--cortex-error)" :
           status === "renamed" ? "var(--cortex-info)" : "var(--cortex-warning)",
  });

  const filePathStyle = (): JSX.CSSProperties => ({
    flex: "1",
    "font-family": "'JetBrains Mono', monospace",
    "font-size": "12px",
    color: "var(--cortex-text-secondary)",
    overflow: "hidden",
    "text-overflow": "ellipsis",
    "white-space": "nowrap",
  });

  const diffStatsStyle = (): JSX.CSSProperties => ({
    display: "flex",
    gap: "4px",
    "font-family": "'JetBrains Mono', monospace",
    "font-size": "11px",
  });

  const additionsStyle = (): JSX.CSSProperties => ({
    color: "var(--cortex-success)",
  });

  const deletionsStyle = (): JSX.CSSProperties => ({
    color: "var(--cortex-error)",
  });

  // Draggable divider
  const dividerStyle = (): JSX.CSSProperties => ({
    height: "4px",
    background: "rgba(255,255,255,0.08)",
    cursor: "row-resize",
    transition: "background 100ms",
  });

  // Terminal section (bottom)
  const terminalSectionStyle = (): JSX.CSSProperties => ({
    height: `${terminalHeight()}px`,
    display: "flex",
    "flex-direction": "column",
    "border-top": "1px solid rgba(255,255,255,0.08)",
  });

  const terminalHeaderStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    padding: "0 12px",
    height: "36px",
    "border-bottom": "1px solid rgba(255,255,255,0.08)",
    gap: "4px",
  });

  const terminalTabStyle = (isActive: boolean): JSX.CSSProperties => ({
    padding: "6px 10px",
    "font-family": "'Inter', sans-serif",
    "font-size": "12px",
    color: isActive ? "var(--cortex-text-primary)" : "var(--cortex-text-inactive)",
    background: "transparent",
    border: "none",
    cursor: "pointer",
  });

  const runButtonStyle = (): JSX.CSSProperties => ({
    "margin-left": "auto",
    padding: "4px 10px",
    "font-family": "'Inter', sans-serif",
    "font-size": "12px",
    color: "var(--cortex-text-primary)",
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.15)",
    "border-radius": "var(--cortex-radius-sm)",
    cursor: "pointer",
    display: "flex",
    "align-items": "center",
    gap: "4px",
  });

  const terminalOutputStyle = (): JSX.CSSProperties => ({
    flex: "1",
    overflow: "auto",
    padding: "8px 12px",
    background: "var(--cortex-bg-secondary)",
    "font-family": "'JetBrains Mono', monospace",
    "font-size": "12px",
    "line-height": "1.5",
    color: "var(--cortex-text-secondary)",
  });

  const terminalLineStyle = (type?: "success" | "error" | "command" | "branch"): JSX.CSSProperties => ({
    color: type === "success" ? "var(--cortex-success)" :
           type === "error" ? "var(--cortex-error)" :
           type === "command" ? "var(--cortex-accent-primary)" :
           type === "branch" ? "var(--cortex-info)" : "var(--cortex-text-secondary)",
    "white-space": "pre-wrap",
    "word-break": "break-all",
  });

  const terminalInputContainerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    padding: "8px 12px",
    background: "var(--cortex-bg-secondary)",
    "border-top": "1px solid rgba(255,255,255,0.08)",
    gap: "8px",
  });

  const terminalPromptStyle = (): JSX.CSSProperties => ({
    "font-family": "'JetBrains Mono', monospace",
    "font-size": "12px",
    color: "var(--cortex-accent-primary)",
  });

  const terminalInputStyle = (): JSX.CSSProperties => ({
    flex: "1",
    background: "transparent",
    border: "none",
    outline: "none",
    "font-family": "'JetBrains Mono', monospace",
    "font-size": "12px",
    color: "var(--cortex-text-primary)",
  });

  const getFileIcon = (status: FileChange["status"]) => {
    switch (status) {
      case "added": return "A";
      case "deleted": return "D";
      case "renamed": return "R";
      default: return "M";
    }
  };

  const handleTerminalSubmit = (e: KeyboardEvent) => {
    if (e.key === "Enter" && terminalInput().trim()) {
      props.onRunCommand?.(terminalInput());
      setTerminalInput("");
    }
  };

  const handleDividerMouseDown = (e: MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = terminalHeight();
    
    const onMouseMove = (e: MouseEvent) => {
      const delta = startY - e.clientY;
      setTerminalHeight(Math.max(100, Math.min(400, startHeight + delta)));
    };
    
    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
    
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  return (
    <div class={props.class} style={containerStyle()}>
      {/* Changes Header */}
      <div style={headerStyle()}>
        <button
          style={tabStyle(changesTab() === "changes")}
          onClick={() => setChangesTab("changes")}
        >
          Changes
          <Show when={props.changes.length > 0}>
            <span style={tabCountStyle()}>{props.changes.length}</span>
          </Show>
        </button>
        <button
          style={tabStyle(changesTab() === "all_files")}
          onClick={() => setChangesTab("all_files")}
        >
          All files
        </button>
      </div>

      {/* Changes List */}
      <div style={changesListStyle()}>
        <For each={props.changes}>
          {(file) => (
            <div
              style={fileItemStyle()}
              onClick={() => props.onFileClick?.(file.path)}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "transparent";
              }}
            >
              <div style={fileIconStyle(file.status)}>
                {getFileIcon(file.status)}
              </div>
              <span style={filePathStyle()}>{file.path}</span>
              <div style={diffStatsStyle()}>
                <Show when={file.additions > 0}>
                  <span style={additionsStyle()}>+{file.additions}</span>
                </Show>
                <Show when={file.deletions > 0}>
                  <span style={deletionsStyle()}>-{file.deletions}</span>
                </Show>
              </div>
            </div>
          )}
        </For>
        <Show when={props.changes.length === 0}>
          <div style={{
            padding: "24px",
            "text-align": "center",
            color: "var(--cortex-text-inactive)",
            "font-size": "13px",
          }}>
            No changes yet
          </div>
        </Show>
      </div>

      {/* Draggable Divider */}
      <div
        style={dividerStyle()}
        onMouseDown={handleDividerMouseDown}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = "var(--cortex-accent-primary)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)";
        }}
      />

      {/* Terminal Section */}
      <div style={terminalSectionStyle()}>
        {/* Terminal Header */}
        <div style={terminalHeaderStyle()}>
          <button
            style={terminalTabStyle(terminalTab() === "run")}
            onClick={() => setTerminalTab("run")}
          >
            Run
          </button>
          <button
            style={terminalTabStyle(terminalTab() === "terminal")}
            onClick={() => setTerminalTab("terminal")}
          >
            Terminal
          </button>
          <button style={runButtonStyle()} onClick={props.onRun}>
            ▶ Run
          </button>
        </div>

        {/* Terminal Output */}
        <div style={terminalOutputStyle()}>
          {/* Branch prompt */}
          <Show when={props.branchName}>
            <div>
              <span style={terminalLineStyle("branch")}>{props.branchName}</span>
              <span style={terminalLineStyle()}> git:(</span>
              <span style={terminalLineStyle("command")}>master</span>
              <span style={terminalLineStyle()}>)</span>
            </div>
          </Show>
          <For each={props.terminalOutput || []}>
            {(line) => {
              const type = line.startsWith("$") ? "command" :
                          line.includes("error") ? "error" :
                          line.includes("success") || line.includes("✓") ? "success" : undefined;
              return <div style={terminalLineStyle(type)}>{line}</div>;
            }}
          </For>
        </div>

        {/* Terminal Input */}
        <div style={terminalInputContainerStyle()}>
          <span style={terminalPromptStyle()}>$</span>
          <input
            type="text"
            value={terminalInput()}
            onInput={(e) => setTerminalInput(e.currentTarget.value)}
            onKeyDown={handleTerminalSubmit}
            style={terminalInputStyle()}
            placeholder="Enter command..."
          />
        </div>
      </div>
    </div>
  );
};

export default CortexChangesPanel;


