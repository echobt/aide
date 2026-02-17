import {
  Component,
  For,
  Show,
  createSignal,
  JSX,
} from "solid-js";
import { useWorkspace, RecentWorkspace } from "@/context/WorkspaceContext";
import { Icon } from "@/components/ui/Icon";
import { IconButton, Badge, Text, EmptyState } from "@/components/ui";

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);

  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  if (weeks < 5) return `${weeks}w ago`;
  return `${months}mo ago`;
}

export interface WorkspaceSwitcherProps {
  class?: string;
  style?: JSX.CSSProperties;
}

export const WorkspaceSwitcher: Component<WorkspaceSwitcherProps> = (props) => {
  const workspace = useWorkspace();
  const [isOpen, setIsOpen] = createSignal(false);

  const recentList = () => workspace.recentWorkspaces();

  const handleOpen = (item: RecentWorkspace) => {
    void workspace.openRecentWorkspace(item);
    setIsOpen(false);
  };

  const handleRemove = (e: MouseEvent, id: string) => {
    e.stopPropagation();
    workspace.removeFromRecentWorkspaces(id);
  };

  const handleClearAll = () => {
    workspace.clearRecentWorkspaces();
  };

  const toggleOpen = () => {
    setIsOpen((prev) => !prev);
  };

  const containerStyle = (): JSX.CSSProperties => ({
    position: "relative",
    display: "inline-block",
    ...props.style,
  });

  const dropdownStyle = (): JSX.CSSProperties => ({
    position: "absolute",
    top: "100%",
    left: "0",
    "z-index": "1000",
    "min-width": "320px",
    "max-height": "400px",
    "overflow-y": "auto",
    background: "var(--cortex-bg-elevated, #1e1e1e)",
    border: "1px solid var(--cortex-border-default, rgba(255,255,255,0.1))",
    "border-radius": "6px",
    "box-shadow": "0 4px 12px rgba(0,0,0,0.3)",
    "margin-top": "4px",
  });

  const headerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    "justify-content": "space-between",
    padding: "8px 12px",
    "border-bottom": "1px solid var(--cortex-border-default, rgba(255,255,255,0.1))",
  });

  const titleStyle = (): JSX.CSSProperties => ({
    "font-family": "var(--cortex-font-sans, Inter, sans-serif)",
    "font-size": "11px",
    "font-weight": "600",
    "text-transform": "uppercase",
    "letter-spacing": "0.5px",
    color: "var(--cortex-text-muted)",
  });

  const clearButtonStyle = (): JSX.CSSProperties => ({
    "font-family": "var(--cortex-font-sans, Inter, sans-serif)",
    "font-size": "11px",
    color: "var(--cortex-text-muted)",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    padding: "2px 6px",
    "border-radius": "4px",
  });

  const listStyle = (): JSX.CSSProperties => ({
    padding: "4px 0",
  });

  return (
    <div class={props.class} style={containerStyle()}>
      <IconButton
        size="md"
        variant="ghost"
        onClick={toggleOpen}
        aria-label="Toggle recent workspaces"
        tooltip="Recent Workspaces"
        icon={<Icon name="clock-rotate-left" size={16} />}
      />

      <Show when={isOpen()}>
        <div style={dropdownStyle()}>
          <div style={headerStyle()}>
            <span style={titleStyle()}>Recent Workspaces</span>
            <Show when={recentList().length > 0}>
              <button
                style={clearButtonStyle()}
                onClick={handleClearAll}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--cortex-bg-hover, rgba(255,255,255,0.05))";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                Clear All
              </button>
            </Show>
          </div>

          <div style={listStyle()}>
            <Show
              when={recentList().length > 0}
              fallback={
                <EmptyState
                  icon={<Icon name="folder-open" size={28} />}
                  title="No Recent Workspaces"
                  description="Workspaces you open will appear here."
                  style={{ padding: "24px 16px" }}
                />
              }
            >
              <For each={recentList()}>
                {(item) => (
                  <RecentWorkspaceItem
                    workspace={item}
                    onOpen={() => handleOpen(item)}
                    onRemove={(e) => handleRemove(e, item.id)}
                  />
                )}
              </For>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  );
};

interface RecentWorkspaceItemProps {
  workspace: RecentWorkspace;
  onOpen: () => void;
  onRemove: (e: MouseEvent) => void;
}

const RecentWorkspaceItem: Component<RecentWorkspaceItemProps> = (props) => {
  const [isHovered, setIsHovered] = createSignal(false);

  const itemStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: "8px",
    padding: "6px 12px",
    cursor: "pointer",
    background: isHovered()
      ? "var(--cortex-bg-hover, rgba(255,255,255,0.05))"
      : "transparent",
    transition: "background 100ms ease",
  });

  const contentStyle = (): JSX.CSSProperties => ({
    flex: "1",
    "min-width": "0",
    display: "flex",
    "flex-direction": "column",
    gap: "2px",
  });

  const nameRowStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: "6px",
  });

  const nameStyle = (): JSX.CSSProperties => ({
    "font-family": "var(--cortex-font-sans, Inter, sans-serif)",
    "font-size": "13px",
    color: "var(--cortex-text-primary, #e0e0e0)",
    "white-space": "nowrap",
    overflow: "hidden",
    "text-overflow": "ellipsis",
  });

  const pathStyle = (): JSX.CSSProperties => ({
    "font-family": "var(--cortex-font-mono, monospace)",
    "font-size": "10px",
    color: "var(--cortex-text-muted, #888)",
    "white-space": "nowrap",
    overflow: "hidden",
    "text-overflow": "ellipsis",
  });

  const metaStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: "6px",
  });

  const timeStyle = (): JSX.CSSProperties => ({
    "font-family": "var(--cortex-font-sans, Inter, sans-serif)",
    "font-size": "10px",
    color: "var(--cortex-text-muted, #888)",
    "white-space": "nowrap",
    "flex-shrink": "0",
  });

  return (
    <div
      style={itemStyle()}
      onClick={props.onOpen}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Icon
        name={props.workspace.isWorkspaceFile ? "briefcase" : "folder"}
        size={16}
        color="var(--cortex-accent-primary)"
      />

      <div style={contentStyle()}>
        <div style={nameRowStyle()}>
          <Text
            variant="body"
            truncate
            style={nameStyle()}
          >
            {props.workspace.name}
          </Text>
          <Show when={props.workspace.folderCount > 1}>
            <Badge variant="muted" size="sm">
              {props.workspace.folderCount} folders
            </Badge>
          </Show>
        </div>
        <span style={pathStyle()}>{props.workspace.path}</span>
      </div>

      <div style={metaStyle()}>
        <span style={timeStyle()}>
          {formatRelativeTime(props.workspace.lastOpened)}
        </span>
        <Show when={isHovered()}>
          <IconButton
            size="sm"
            variant="ghost"
            onClick={(e) => props.onRemove(e)}
            aria-label={`Remove ${props.workspace.name}`}
            icon={<Icon name="xmark" size={12} />}
          />
        </Show>
      </div>
    </div>
  );
};

export default WorkspaceSwitcher;
