import { createSignal, createMemo, For, Show, JSX } from "solid-js";
import { useSearch } from "@/context/SearchContext";
import type { SearchResult, SearchMatch } from "@/context/SearchContext";
import { Icon } from "@/components/ui/Icon";
import { IconButton, Badge, Text, Checkbox } from "@/components/ui";
import { FileIcon } from "@/components/ui/FileIcon";

export interface SearchResultTreeProps {
  onMatchClick?: (filePath: string, line: number, column: number) => void;
}

const containerStyle: JSX.CSSProperties = {
  display: "flex",
  "flex-direction": "column",
  height: "100%",
  overflow: "hidden",
};

const summaryStyle: JSX.CSSProperties = {
  display: "flex",
  "align-items": "center",
  "justify-content": "space-between",
  padding: "6px 12px",
  "border-bottom": "1px solid var(--jb-border-default)",
  background: "var(--jb-bg-sidebar)",
  "flex-shrink": "0",
};

const summaryActionsStyle: JSX.CSSProperties = {
  display: "flex",
  "align-items": "center",
  gap: "2px",
};

const treeContainerStyle: JSX.CSSProperties = {
  flex: "1",
  overflow: "auto",
};

const fileRowStyle: JSX.CSSProperties = {
  display: "flex",
  "align-items": "center",
  gap: "4px",
  padding: "4px 8px",
  cursor: "pointer",
  "user-select": "none",
  transition: "background 0.15s ease",
};

const fileInfoStyle: JSX.CSSProperties = {
  display: "flex",
  "align-items": "center",
  gap: "6px",
  flex: "1",
  "min-width": "0",
  overflow: "hidden",
};

const filenameStyle: JSX.CSSProperties = {
  "font-weight": "500",
  color: "var(--jb-text-primary)",
  "white-space": "nowrap",
};

const relPathStyle: JSX.CSSProperties = {
  color: "var(--jb-text-muted-color)",
  "font-size": "12px",
  overflow: "hidden",
  "text-overflow": "ellipsis",
  "white-space": "nowrap",
  flex: "1",
};

const matchesListStyle: JSX.CSSProperties = {
  "padding-left": "28px",
};

const matchRowStyle: JSX.CSSProperties = {
  display: "flex",
  "align-items": "center",
  gap: "8px",
  padding: "3px 12px",
  cursor: "pointer",
  transition: "background 0.15s ease",
};

const lineNumStyle: JSX.CSSProperties = {
  "min-width": "36px",
  color: "var(--jb-text-muted-color)",
  "font-family": "var(--jb-font-code)",
  "font-size": "12px",
  "text-align": "right",
  "flex-shrink": "0",
};

const previewStyle: JSX.CSSProperties = {
  flex: "1",
  "font-family": "var(--jb-font-code)",
  "font-size": "12px",
  overflow: "hidden",
  "text-overflow": "ellipsis",
  "white-space": "nowrap",
};

const highlightStyle: JSX.CSSProperties = {
  background: "var(--jb-accent-bg)",
  color: "var(--jb-accent-text)",
  "border-radius": "var(--cortex-radius-sm)",
  padding: "0 2px",
};

function MatchPreview(props: { match: SearchMatch }) {
  const before = createMemo(() =>
    props.match.preview.slice(0, props.match.previewMatchStart)
  );
  const highlighted = createMemo(() =>
    props.match.preview.slice(
      props.match.previewMatchStart,
      props.match.previewMatchStart + props.match.previewMatchLength
    )
  );
  const after = createMemo(() =>
    props.match.preview.slice(
      props.match.previewMatchStart + props.match.previewMatchLength
    )
  );

  return (
    <span style={previewStyle}>
      {before()}
      <span style={highlightStyle}>{highlighted()}</span>
      {after()}
    </span>
  );
}

function FileNode(props: {
  result: SearchResult;
  onToggleExpand: () => void;
  onToggleSelect: () => void;
  onMatchClick: (match: SearchMatch) => void;
}) {
  const [fileHovered, setFileHovered] = createSignal(false);
  const [hoveredMatchId, setHoveredMatchId] = createSignal<string | null>(null);

  const dirPath = createMemo(() => {
    const rel = props.result.relativePath;
    const lastSlash = Math.max(rel.lastIndexOf("/"), rel.lastIndexOf("\\"));
    return lastSlash >= 0 ? rel.slice(0, lastSlash) : "";
  });

  return (
    <div>
      <div
        style={{
          ...fileRowStyle,
          background: fileHovered() ? "var(--jb-surface-hover)" : "transparent",
        }}
        onMouseEnter={() => setFileHovered(true)}
        onMouseLeave={() => setFileHovered(false)}
        onClick={props.onToggleExpand}
      >
        <Show
          when={props.result.isExpanded}
          fallback={<Icon name="chevron-right" size={14} />}
        >
          <Icon name="chevron-down" size={14} />
        </Show>
        <div
          onClick={(e: MouseEvent) => e.stopPropagation()}
          style={{ display: "flex", "align-items": "center" }}
        >
          <Checkbox
            checked={props.result.isSelected}
            onChange={() => props.onToggleSelect()}
            aria-label={`Select ${props.result.filename}`}
          />
        </div>
        <div style={fileInfoStyle}>
          <FileIcon filename={props.result.filename} size={16} />
          <span style={filenameStyle}>{props.result.filename}</span>
          <Show when={dirPath()}>
            <span style={relPathStyle}>{dirPath()}</span>
          </Show>
        </div>
        <Badge variant="muted" size="sm">
          {props.result.totalMatches}
        </Badge>
      </div>
      <Show when={props.result.isExpanded}>
        <div style={matchesListStyle}>
          <For each={props.result.matches}>
            {(match) => (
              <div
                style={{
                  ...matchRowStyle,
                  background:
                    hoveredMatchId() === match.id
                      ? "var(--jb-surface-hover)"
                      : "transparent",
                }}
                onMouseEnter={() => setHoveredMatchId(match.id)}
                onMouseLeave={() => setHoveredMatchId(null)}
                onClick={() => props.onMatchClick(match)}
              >
                <span style={lineNumStyle}>{match.range.startLine + 1}</span>
                <MatchPreview match={match} />
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

export function SearchResultTree(props: SearchResultTreeProps) {
  const search = useSearch();

  const results = createMemo(() => search.searchResults());

  const totalFiles = createMemo(() => results().length);

  const totalMatches = createMemo(() => search.getTotalMatchCount());

  const handleMatchClick = (result: SearchResult, match: SearchMatch) => {
    const line = match.range.startLine;
    const column = match.range.startColumn;

    props.onMatchClick?.(result.path, line, column);

    window.dispatchEvent(
      new CustomEvent("search:open-match", {
        detail: { filePath: result.path, line, column },
      })
    );
  };

  return (
    <div style={containerStyle}>
      <div style={summaryStyle}>
        <Text variant="muted" size="xs">
          <Show
            when={totalFiles() > 0}
            fallback="No results"
          >
            {totalMatches()} match{totalMatches() !== 1 ? "es" : ""} in{" "}
            {totalFiles()} file{totalFiles() !== 1 ? "s" : ""}
          </Show>
        </Text>
        <div style={summaryActionsStyle}>
          <IconButton
            size="sm"
            tooltip="Expand All"
            aria-label="Expand All"
            onClick={() => search.expandAllResults()}
            icon={<Icon name="maximize" size={14} />}
          />
          <IconButton
            size="sm"
            tooltip="Collapse All"
            aria-label="Collapse All"
            onClick={() => search.collapseAllResults()}
            icon={<Icon name="minimize" size={14} />}
          />
        </div>
      </div>
      <div style={treeContainerStyle}>
        <For each={results()}>
          {(result) => (
            <FileNode
              result={result}
              onToggleExpand={() => search.toggleResultExpanded(result.id)}
              onToggleSelect={() => search.toggleResultSelected(result.id)}
              onMatchClick={(match) => handleMatchClick(result, match)}
            />
          )}
        </For>
      </div>
    </div>
  );
}
