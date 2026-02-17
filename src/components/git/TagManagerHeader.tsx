import { Show } from "solid-js";
import { Icon } from "@/components/ui/Icon";
import { tokens } from "@/design-system/tokens";
import { IconButton, Input, Badge, Text } from "@/components/ui";

export interface TagManagerHeaderProps {
  total: number;
  loading: boolean;
  operationLoading: string | null;
  localTagCount: number;
  onCreateTag: () => void;
  onPushAllTags: () => void;
  onRefresh: () => void;
  onClose?: () => void;
}

export function TagManagerHeader(props: TagManagerHeaderProps) {
  return (
    <div style={{
      display: "flex",
      "align-items": "center",
      "justify-content": "space-between",
      padding: `${tokens.spacing.md} ${tokens.spacing.lg}`,
      "border-bottom": `1px solid ${tokens.colors.border.divider}`,
      "flex-shrink": "0",
    }}>
      <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.md }}>
        <Icon name="tag" style={{ width: "16px", height: "16px", color: tokens.colors.icon.default }} />
        <Text style={{ "font-size": "14px", "font-weight": "600", color: tokens.colors.text.primary }}>Tags</Text>
        <Badge variant="default" size="sm">{props.total}</Badge>
      </div>
      <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.sm }}>
        <IconButton tooltip="Create Tag" onClick={props.onCreateTag}>
          <Icon name="plus" style={{ width: "16px", height: "16px" }} />
        </IconButton>
        <IconButton
          tooltip="Push All Tags"
          onClick={props.onPushAllTags}
          disabled={props.operationLoading === "push-all" || props.localTagCount === 0}
        >
          <Show
            when={props.operationLoading === "push-all"}
            fallback={<Icon name="upload" style={{ width: "16px", height: "16px" }} />}
          >
            <Icon name="spinner" style={{ width: "16px", height: "16px", animation: "spin 1s linear infinite" }} />
          </Show>
        </IconButton>
        <IconButton tooltip="Refresh" onClick={props.onRefresh} disabled={props.loading}>
          <Show
            when={props.loading}
            fallback={<Icon name="rotate" style={{ width: "16px", height: "16px" }} />}
          >
            <Icon name="spinner" style={{ width: "16px", height: "16px", animation: "spin 1s linear infinite" }} />
          </Show>
        </IconButton>
        <Show when={props.onClose}>
          <IconButton tooltip="Close" onClick={props.onClose}>
            <Icon name="xmark" style={{ width: "16px", height: "16px" }} />
          </IconButton>
        </Show>
      </div>
    </div>
  );
}

export interface ErrorBannerProps {
  error: string;
  onClear: () => void;
}

export function ErrorBanner(props: ErrorBannerProps) {
  return (
    <div style={{
      display: "flex",
      "align-items": "center",
      gap: tokens.spacing.md,
      padding: `${tokens.spacing.md} ${tokens.spacing.lg}`,
      "font-size": "12px",
      background: `color-mix(in srgb, ${tokens.colors.semantic.error} 10%, transparent)`,
      color: tokens.colors.semantic.error,
    }}>
      <Text as="span" style={{ flex: "1" }}>{props.error}</Text>
      <IconButton size="sm" onClick={props.onClear}>
        <Icon name="xmark" style={{ width: "12px", height: "12px" }} />
      </IconButton>
    </div>
  );
}

export interface TagManagerSearchBarProps {
  searchQuery: string;
  sortOrder: string;
  onSearchChange: (v: string) => void;
  onSortChange: (v: string) => void;
}

export function TagManagerSearchBar(props: TagManagerSearchBarProps) {
  return (
    <div style={{
      display: "flex",
      "align-items": "center",
      gap: tokens.spacing.md,
      padding: `${tokens.spacing.md} ${tokens.spacing.lg}`,
      "border-bottom": `1px solid ${tokens.colors.border.divider}`,
      "flex-shrink": "0",
    }}>
      <div style={{ flex: "1" }}>
        <Input
          placeholder="Search tags..."
          value={props.searchQuery}
          onInput={(e) => props.onSearchChange(e.currentTarget.value)}
          icon={<Icon name="magnifying-glass" style={{ width: "14px", height: "14px" }} />}
          iconRight={
            <Show when={props.searchQuery}>
              <IconButton
                size="sm"
                onClick={() => props.onSearchChange("")}
                style={{ position: "absolute", right: "4px" }}
              >
                <Icon name="xmark" style={{ width: "12px", height: "12px" }} />
              </IconButton>
            </Show>
          }
        />
      </div>
      <select
        value={props.sortOrder}
        onChange={(e) => props.onSortChange(e.currentTarget.value)}
        style={{
          height: "28px",
          padding: `0 ${tokens.spacing.md}`,
          background: "var(--jb-input-bg)",
          border: "var(--jb-input-border)",
          "border-radius": "var(--jb-input-radius)",
          color: "var(--jb-input-color)",
          "font-size": "12px",
          cursor: "pointer",
        }}
      >
        <option value="date-desc">Newest first</option>
        <option value="date-asc">Oldest first</option>
        <option value="name-asc">Name A-Z</option>
        <option value="name-desc">Name Z-A</option>
      </select>
    </div>
  );
}
