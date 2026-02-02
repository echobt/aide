import { Component, createSignal, For, Show } from "solid-js";
import { useMultiRepo, type GitFile } from "@/context/MultiRepoContext";

interface FileItem {
  path: string;
  status: "M" | "A" | "D" | "R" | "U" | "?";
  staged: boolean;
}

const statusColors: Record<string, string> = {
  M: "var(--cortex-warning)",
  A: "var(--cortex-success)",
  D: "var(--cortex-error)",
  R: "var(--cortex-info)",
  U: "var(--cortex-warning)",
  "?": "var(--cortex-text-inactive)",
};

export const CortexGitPanel: Component = () => {
  let multiRepo: ReturnType<typeof useMultiRepo> | null = null;
  try {
    multiRepo = useMultiRepo();
  } catch {
    // Context not available
  }

  const [commitMessage, setCommitMessage] = createSignal("");
  const [expandedSections, setExpandedSections] = createSignal<Set<string>>(new Set(["staged", "changes"]));

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const activeRepo = () => multiRepo?.activeRepository();
  const stagedFiles = () => activeRepo()?.stagedFiles || [];
  const unstagedFiles = () => activeRepo()?.unstagedFiles || [];
  const currentBranch = () => (activeRepo() as any)?.currentBranch || "main";

  const mapStatus = (file: GitFile): FileItem => ({
    path: file.path,
    status: (file.status?.charAt(0) as FileItem["status"]) || "?",
    staged: file.staged || false,
  });

  const repoId = () => activeRepo()?.id;
  const handleStageAll = () => repoId() && multiRepo?.stageAll?.(repoId()!);
  const handleUnstageAll = () => repoId() && multiRepo?.unstageAll?.(repoId()!);
  const handleCommit = () => {
    if (commitMessage().trim() && repoId() && multiRepo?.commit) {
      multiRepo.commit(repoId()!, commitMessage());
      setCommitMessage("");
    }
  };
  const handleStageFile = (path: string) => repoId() && multiRepo?.stageFiles?.(repoId()!, [path]);
  const handleUnstageFile = (path: string) => repoId() && multiRepo?.unstageFiles?.(repoId()!, [path]);
  const handleDiscardFile = (path: string) => repoId() && multiRepo?.discardChanges?.(repoId()!, [path]);

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
        <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
          <span style={{ "font-weight": "500" }}>Source Control</span>
          <Show when={stagedFiles().length + unstagedFiles().length > 0}>
            <span style={{
              background: "var(--cortex-accent-primary)",
              color: "var(--cortex-accent-text)",
              padding: "2px 6px",
              "border-radius": "var(--cortex-radius-lg)",
              "font-size": "11px",
              "font-weight": "600",
            }}>
              {stagedFiles().length + unstagedFiles().length}
            </span>
          </Show>
        </div>
        <div style={{ display: "flex", gap: "4px" }}>
          <button onClick={handleStageAll} style={iconBtnStyle} title="Stage All">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M14 7v1H8v6H7V8H1V7h6V1h1v6h6z"/>
            </svg>
          </button>
          <button onClick={() => repoId() && multiRepo?.refreshRepository?.(repoId()!)} style={iconBtnStyle} title="Refresh">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M13.5 2a.5.5 0 0 0-.5.5V5a5 5 0 1 0-1.07 5.5.5.5 0 0 0-.76-.65A4 4 0 1 1 12 5.5H9.5a.5.5 0 0 0 0 1h4a.5.5 0 0 0 .5-.5v-4a.5.5 0 0 0-.5-.5z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Commit Input */}
      <div style={{ padding: "12px 16px", "border-bottom": "1px solid var(--cortex-bg-hover)" }}>
        <textarea
          value={commitMessage()}
          onInput={(e) => setCommitMessage(e.currentTarget.value)}
          placeholder="Message (press Ctrl+Enter to commit)"
          style={{
            width: "100%",
            background: "var(--cortex-bg-primary)",
            border: "1px solid var(--cortex-bg-hover)",
            "border-radius": "var(--cortex-radius-sm)",
            color: "var(--cortex-text-primary)",
            padding: "8px",
            "font-size": "13px",
            resize: "vertical",
            "min-height": "60px",
            outline: "none",
          }}
          onKeyDown={(e) => {
            if (e.ctrlKey && e.key === "Enter") handleCommit();
          }}
        />
        <button
          onClick={handleCommit}
          disabled={!commitMessage().trim() || stagedFiles().length === 0}
          style={{
            width: "100%",
            "margin-top": "8px",
            padding: "8px",
            background: stagedFiles().length > 0 && commitMessage().trim() ? "var(--cortex-accent-primary)" : "var(--cortex-bg-hover)",
            color: stagedFiles().length > 0 && commitMessage().trim() ? "var(--cortex-bg-secondary)" : "var(--cortex-text-inactive)",
            border: "none",
            "border-radius": "var(--cortex-radius-sm)",
            "font-weight": "500",
            cursor: stagedFiles().length > 0 && commitMessage().trim() ? "pointer" : "not-allowed",
          }}
        >
          Commit
        </button>
      </div>

      {/* Sections */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {/* Staged Changes */}
        <Section
          title="Staged Changes"
          count={stagedFiles().length}
          expanded={expandedSections().has("staged")}
          onToggle={() => toggleSection("staged")}
          actions={
            <button onClick={handleUnstageAll} style={iconBtnStyle} title="Unstage All">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1v6H1v1h7v6h1V8h6V7H9V1H8z"/>
              </svg>
            </button>
          }
        >
          <For each={stagedFiles().map(mapStatus)}>
            {(file) => (
              <FileRow
                file={file}
                onUnstage={() => handleUnstageFile(file.path)}
              />
            )}
          </For>
        </Section>

        {/* Changes */}
        <Section
          title="Changes"
          count={unstagedFiles().length}
          expanded={expandedSections().has("changes")}
          onToggle={() => toggleSection("changes")}
          actions={
            <>
              <button onClick={handleStageAll} style={iconBtnStyle} title="Stage All">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M14 7v1H8v6H7V8H1V7h6V1h1v6h6z"/>
                </svg>
              </button>
              <button onClick={() => repoId() && multiRepo?.discardChanges?.(repoId()!, unstagedFiles().map(f => f.path))} style={iconBtnStyle} title="Discard All">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8.5 3.5L8 3H5l-.5.5v1l.5.5h3l.5-.5v-1zM5 4h3v1H5V4zm8.5 1.5L13 5h-2l-.5.5v9l.5.5h2l.5-.5v-9zM11 6h2v8h-2V6zM5.5 7L5 6.5H2l-.5.5v7l.5.5h3l.5-.5v-7zM2 7h3v7H2V7z"/>
                </svg>
              </button>
            </>
          }
        >
          <For each={unstagedFiles().map(mapStatus)}>
            {(file) => (
              <FileRow
                file={file}
                onStage={() => handleStageFile(file.path)}
                onDiscard={() => handleDiscardFile(file.path)}
              />
            )}
          </For>
        </Section>
      </div>

      {/* Footer - Branch info */}
      <div style={{
        padding: "8px 16px",
        "border-top": "1px solid var(--cortex-bg-hover)",
        display: "flex",
        "align-items": "center",
        gap: "8px",
        color: "var(--cortex-text-inactive)",
        "font-size": "12px",
      }}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M14 4.5V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h5.5L14 4.5zm-3 0A1.5 1.5 0 0 1 9.5 3V1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4.5h-2z"/>
        </svg>
        <span>{currentBranch()}</span>
      </div>
    </div>
  );
};

const iconBtnStyle = {
  background: "transparent",
  border: "none",
  color: "var(--cortex-text-inactive)",
  cursor: "pointer",
  padding: "4px",
  "border-radius": "var(--cortex-radius-sm)",
  display: "flex",
  "align-items": "center",
  "justify-content": "center",
};

interface SectionProps {
  title: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  actions?: any;
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
      <span style={{ flex: 1, "font-size": "12px", "text-transform": "uppercase", color: "var(--cortex-text-inactive)" }}>
        {props.title}
      </span>
      <Show when={props.count > 0}>
        <span style={{ color: "var(--cortex-text-inactive)", "margin-right": "8px", "font-size": "12px" }}>
          {props.count}
        </span>
      </Show>
      <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", gap: "2px" }}>
        {props.actions}
      </div>
    </div>
    <Show when={props.expanded}>
      <div style={{ "padding-bottom": "4px" }}>{props.children}</div>
    </Show>
  </div>
);

interface FileRowProps {
  file: FileItem;
  onStage?: () => void;
  onUnstage?: () => void;
  onDiscard?: () => void;
}

const FileRow: Component<FileRowProps> = (props) => {
  const fileName = () => props.file.path.split("/").pop() || props.file.path;
  const dirPath = () => {
    const parts = props.file.path.split("/");
    return parts.length > 1 ? parts.slice(0, -1).join("/") : "";
  };

  return (
    <div
      style={{
        display: "flex",
        "align-items": "center",
        padding: "4px 16px 4px 32px",
        cursor: "pointer",
        gap: "8px",
      }}
      class="file-row"
    >
      <span style={{
        color: statusColors[props.file.status],
        "font-weight": "600",
        "font-size": "11px",
        width: "14px",
        "text-align": "center",
      }}>
        {props.file.status}
      </span>
      <span style={{ flex: 1, overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>
        {fileName()}
        <Show when={dirPath()}>
          <span style={{ color: "var(--cortex-text-inactive)", "margin-left": "8px", "font-size": "12px" }}>
            {dirPath()}
          </span>
        </Show>
      </span>
      <div style={{ display: "flex", gap: "2px", opacity: 0 }} class="file-actions">
        <Show when={props.onStage}>
          <button onClick={props.onStage} style={iconBtnStyle} title="Stage">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M14 7v1H8v6H7V8H1V7h6V1h1v6h6z"/>
            </svg>
          </button>
        </Show>
        <Show when={props.onUnstage}>
          <button onClick={props.onUnstage} style={iconBtnStyle} title="Unstage">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M1 8h14v1H1z"/>
            </svg>
          </button>
        </Show>
        <Show when={props.onDiscard}>
          <button onClick={props.onDiscard} style={iconBtnStyle} title="Discard">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm3.5 9.5l-1 1L8 9l-2.5 2.5-1-1L7 8 4.5 5.5l1-1L8 7l2.5-2.5 1 1L9 8l2.5 2.5z"/>
            </svg>
          </button>
        </Show>
      </div>
      <style>{`
        .file-row:hover { background: rgba(255,255,255,0.05); }
        .file-row:hover .file-actions { opacity: 1; }
      `}</style>
    </div>
  );
};

export default CortexGitPanel;


