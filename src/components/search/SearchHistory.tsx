import { createMemo, For, Show, JSX } from "solid-js";
import { useSearch } from "@/context/SearchContext";
import type { SearchHistoryEntry } from "@/context/SearchContext";
import { Icon } from "@/components/ui/Icon";
import { IconButton, Badge, Text, EmptyState } from "@/components/ui";

export interface SearchHistoryProps {
  onClose?: () => void;
}

const containerStyle: JSX.CSSProperties = {
  display: "flex",
  "flex-direction": "column",
  height: "100%",
  overflow: "hidden",
  background: "var(--jb-canvas)",
};

const headerStyle: JSX.CSSProperties = {
  display: "flex",
  "align-items": "center",
  "justify-content": "space-between",
  padding: "8px 12px",
  "border-bottom": "1px solid var(--jb-border)",
  "flex-shrink": "0",
};

const headerLeftStyle: JSX.CSSProperties = {
  display: "flex",
  "align-items": "center",
  gap: "8px",
};

const headerActionsStyle: JSX.CSSProperties = {
  display: "flex",
  "align-items": "center",
  gap: "4px",
};

const listStyle: JSX.CSSProperties = {
  flex: "1",
  overflow: "auto",
  padding: "4px 0",
};

const itemStyle: JSX.CSSProperties = {
  display: "flex",
  "align-items": "center",
  padding: "6px 12px",
  gap: "8px",
  cursor: "pointer",
  transition: "background var(--cortex-transition-fast, 100ms)",
};

const itemContentStyle: JSX.CSSProperties = {
  flex: "1",
  "min-width": "0",
  display: "flex",
  "flex-direction": "column",
  gap: "2px",
};

const patternStyle: JSX.CSSProperties = {
  "font-family": "var(--cortex-font-mono, monospace)",
  "font-size": "12px",
  color: "var(--cortex-text-primary, #e0e0e0)",
  overflow: "hidden",
  "text-overflow": "ellipsis",
  "white-space": "nowrap",
};

const metaStyle: JSX.CSSProperties = {
  display: "flex",
  "align-items": "center",
  gap: "6px",
};

const deleteButtonStyle: JSX.CSSProperties = {
  "flex-shrink": "0",
  opacity: "0",
  transition: "opacity var(--cortex-transition-fast, 100ms)",
};

function formatTimestamp(ts: number): string {
  const now = Date.now();
  const diff = now - ts;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

function getOptionIcons(entry: SearchHistoryEntry): string[] {
  const icons: string[] = [];
  if (entry.query.options.caseSensitive) icons.push("Aa");
  if (entry.query.options.wholeWord) icons.push("W");
  if (entry.query.options.useRegex) icons.push(".*");
  return icons;
}

export function SearchHistory(props: SearchHistoryProps) {
  const search = useSearch();

  const history = () => search.searchHistory();

  const sortedHistory = createMemo(() => {
    return [...history()].sort((a, b) => b.timestamp - a.timestamp);
  });

  const handleClick = (entry: SearchHistoryEntry) => {
    search.loadFromHistory(entry.id);
    props.onClose?.();
  };

  const handleDelete = (e: MouseEvent, entryId: string) => {
    e.stopPropagation();
    search.removeFromHistory(entryId);
  };

  const handleClearAll = () => {
    search.clearHistory();
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div style={headerLeftStyle}>
          <Icon name="clock" size={14} />
          <Text variant="muted" size="sm">
            Search History
          </Text>
          <Show when={history().length > 0}>
            <Badge variant="default">{history().length}</Badge>
          </Show>
        </div>
        <div style={headerActionsStyle}>
          <Show when={history().length > 0}>
            <IconButton
              tooltip="Clear all history"
              size="sm"
              onClick={handleClearAll}
            >
              <Icon name="trash" size={14} />
            </IconButton>
          </Show>
          <Show when={props.onClose}>
            <IconButton
              tooltip="Close"
              size="sm"
              onClick={() => props.onClose?.()}
            >
              <Icon name="times" size={14} />
            </IconButton>
          </Show>
        </div>
      </div>

      <div style={listStyle}>
        <Show
          when={sortedHistory().length > 0}
          fallback={
            <EmptyState
              icon="clock"
              title="No search history"
              description="Your recent searches will appear here."
            />
          }
        >
          <For each={sortedHistory()}>
            {(entry) => (
              <div
                style={itemStyle}
                onClick={() => handleClick(entry)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--jb-list-hover)";
                  const btn = e.currentTarget.querySelector(
                    "[data-delete-btn]"
                  ) as HTMLElement;
                  if (btn) btn.style.opacity = "1";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  const btn = e.currentTarget.querySelector(
                    "[data-delete-btn]"
                  ) as HTMLElement;
                  if (btn) btn.style.opacity = "0";
                }}
              >
                <Icon name="search" size={12} color="var(--jb-text-muted-color)" />
                <div style={itemContentStyle}>
                  <span style={patternStyle}>{entry.query.pattern}</span>
                  <div style={metaStyle}>
                    <Text variant="muted" size="xs">
                      {formatTimestamp(entry.timestamp)}
                    </Text>
                    <Show when={entry.resultsCount !== undefined}>
                      <Badge variant="default">{entry.resultsCount} results</Badge>
                    </Show>
                    <For each={getOptionIcons(entry)}>
                      {(icon) => (
                        <span
                          style={{
                            "font-size": "10px",
                            "font-weight": "600",
                            color: "var(--jb-text-muted-color)",
                            padding: "0 3px",
                            "border-radius": "2px",
                            background: "var(--jb-canvas)",
                            border: "1px solid var(--jb-border)",
                          }}
                        >
                          {icon}
                        </span>
                      )}
                    </For>
                  </div>
                </div>
                <div style={deleteButtonStyle} data-delete-btn>
                  <IconButton
                    tooltip="Remove from history"
                    size="sm"
                    onClick={(e: MouseEvent) => handleDelete(e, entry.id)}
                  >
                    <Icon name="times" size={12} />
                  </IconButton>
                </div>
              </div>
            )}
          </For>
        </Show>
      </div>
    </div>
  );
}
