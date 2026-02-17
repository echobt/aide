import { createMemo, For, Show, JSX } from "solid-js";
import { useSearch } from "@/context/SearchContext";
import type { ReplacePreviewItem } from "@/context/SearchContext";
import { Icon } from "@/components/ui/Icon";
import { Button, Badge, Text, EmptyState } from "@/components/ui";

export interface ReplacePreviewProps {
  onApply?: () => void;
  onCancel?: () => void;
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
  gap: "6px",
};

const listStyle: JSX.CSSProperties = {
  flex: "1",
  overflow: "auto",
  padding: "4px 0",
};

const itemStyle: JSX.CSSProperties = {
  padding: "6px 12px",
  "border-bottom": "1px solid var(--jb-border)",
};

const filePathStyle: JSX.CSSProperties = {
  "font-size": "var(--jb-text-muted-size)",
  color: "var(--jb-text-muted-color)",
  "margin-bottom": "4px",
  display: "flex",
  "align-items": "center",
  gap: "6px",
};

const diffContainerStyle: JSX.CSSProperties = {
  display: "flex",
  "flex-direction": "column",
  gap: "2px",
  "font-family": "var(--cortex-font-mono, monospace)",
  "font-size": "12px",
  "line-height": "1.5",
};

const oldLineStyle: JSX.CSSProperties = {
  background: "rgba(239, 68, 68, 0.12)",
  color: "var(--cortex-text-primary, #e0e0e0)",
  padding: "2px 8px",
  "border-radius": "var(--jb-radius-sm)",
  "white-space": "pre-wrap",
  "word-break": "break-all",
};

const newLineStyle: JSX.CSSProperties = {
  background: "rgba(34, 197, 94, 0.12)",
  color: "var(--cortex-text-primary, #e0e0e0)",
  padding: "2px 8px",
  "border-radius": "var(--jb-radius-sm)",
  "white-space": "pre-wrap",
  "word-break": "break-all",
};

const prefixOldStyle: JSX.CSSProperties = {
  color: "var(--cortex-error, #ef4444)",
  "font-weight": "600",
  "margin-right": "4px",
  "user-select": "none",
};

const prefixNewStyle: JSX.CSSProperties = {
  color: "var(--cortex-success, #22c55e)",
  "font-weight": "600",
  "margin-right": "4px",
  "user-select": "none",
};

const lineNumStyle: JSX.CSSProperties = {
  color: "var(--jb-text-muted-color)",
  "font-size": "11px",
  "min-width": "32px",
  "text-align": "right",
  "margin-right": "8px",
  "user-select": "none",
};

interface GroupedPreview {
  filePath: string;
  items: ReplacePreviewItem[];
}

export function ReplacePreview(props: ReplacePreviewProps) {
  const search = useSearch();

  const previews = () => search.replacePreview();

  const grouped = createMemo((): GroupedPreview[] => {
    const map = new Map<string, ReplacePreviewItem[]>();
    for (const item of previews()) {
      const list = map.get(item.filePath) || [];
      list.push(item);
      map.set(item.filePath, list);
    }
    return Array.from(map.entries()).map(([filePath, items]) => ({
      filePath,
      items,
    }));
  });

  const totalReplacements = createMemo(() => previews().length);
  const totalFiles = createMemo(() => grouped().length);

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div style={headerLeftStyle}>
          <Icon name="exchange-alt" size={14} />
          <Text variant="muted" size="sm">
            Replace Preview
          </Text>
          <Show when={totalReplacements() > 0}>
            <Badge variant="accent">
              {totalReplacements()} replacement{totalReplacements() !== 1 ? "s" : ""} in{" "}
              {totalFiles()} file{totalFiles() !== 1 ? "s" : ""}
            </Badge>
          </Show>
        </div>
        <div style={headerActionsStyle}>
          <Show when={totalReplacements() > 0}>
            <Button variant="primary" size="sm" onClick={() => props.onApply?.()}>
              Apply All
            </Button>
          </Show>
          <Button variant="ghost" size="sm" onClick={() => props.onCancel?.()}>
            Cancel
          </Button>
        </div>
      </div>

      <div style={listStyle}>
        <Show
          when={totalReplacements() > 0}
          fallback={
            <EmptyState
              icon="search"
              title="No replacements to preview"
              description="Run a search and click Preview to see replacements before applying."
            />
          }
        >
          <For each={grouped()}>
            {(group) => (
              <div>
                <div style={filePathStyle}>
                  <Icon name="file" size={12} />
                  <span>{group.filePath}</span>
                  <Badge variant="default">{group.items.length}</Badge>
                </div>
                <For each={group.items}>
                  {(item) => (
                    <div style={itemStyle}>
                      <div style={diffContainerStyle}>
                        <div style={oldLineStyle}>
                          <span style={lineNumStyle}>{item.line}</span>
                          <span style={prefixOldStyle}>-</span>
                          {item.oldText}
                        </div>
                        <div style={newLineStyle}>
                          <span style={lineNumStyle}>{item.line}</span>
                          <span style={prefixNewStyle}>+</span>
                          {item.newText}
                        </div>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            )}
          </For>
        </Show>
      </div>
    </div>
  );
}
