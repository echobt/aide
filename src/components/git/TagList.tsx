import { For, Show } from "solid-js";
import { Icon } from "@/components/ui/Icon";
import { tokens } from "@/design-system/tokens";
import {
  Button,
  IconButton,
  Badge,
  Text,
  ListItem,
} from "@/components/ui";
import type { GitTag } from "@/utils/tauri-api";

export interface TagItemProps {
  tag: GitTag; selected: boolean; isOperating: boolean;
  onSelect: (tag: GitTag) => void; onPush: (tagName: string) => void; onDelete: (tag: GitTag) => void;
}

export function TagItem(props: TagItemProps) {
  const tag = () => props.tag;
  return (
    <ListItem
      selected={props.selected}
      onClick={() => props.onSelect(tag())}
      icon={
        <Icon
          name="tag"
          style={{
            width: "14px",
            height: "14px",
            color: tag().isAnnotated ? tokens.colors.semantic.primary : tokens.colors.icon.default,
          }}
        />
      }
      style={{
        "border-bottom": `1px solid ${tokens.colors.border.divider}`,
        padding: `${tokens.spacing.md} ${tokens.spacing.lg}`,
      }}
      iconRight={
        <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.sm }}>
          <Show when={props.isOperating}>
            <Icon
              name="spinner"
              style={{
                width: "14px",
                height: "14px",
                animation: "spin 1s linear infinite",
                color: tokens.colors.icon.default,
              }}
            />
          </Show>

          <Show when={!props.isOperating}>
            <Show when={!tag().isPushed}>
              <IconButton
                size="sm"
                tooltip="Push tag to remote"
                onClick={(e) => { e.stopPropagation(); props.onPush(tag().name); }}
              >
                <Icon name="upload" style={{ width: "12px", height: "12px" }} />
              </IconButton>
            </Show>

            <IconButton
              size="sm"
              tooltip="Delete tag"
              onClick={(e) => { e.stopPropagation(); props.onDelete(tag()); }}
            >
              <Icon name="trash" style={{ width: "12px", height: "12px", color: tokens.colors.semantic.error }} />
            </IconButton>
          </Show>

          <Show when={tag().isAnnotated}>
            <span title="Annotated tag">
              <Badge variant="default" size="sm">
                A
              </Badge>
            </span>
          </Show>
          <Show when={tag().isPushed}>
            <span title="Pushed to remote">
              <Icon name="cloud" style={{ width: "12px", height: "12px", color: tokens.colors.semantic.success }} />
            </span>
          </Show>
          <Show when={!tag().isPushed}>
            <span title="Local only">
              <Icon name="cloud-slash" style={{ width: "12px", height: "12px", color: tokens.colors.text.muted }} />
            </span>
          </Show>
        </div>
      }
    >
      <div style={{ flex: "1", "min-width": "0" }}>
        <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.md }}>
          <Text
            style={{
              "font-size": "13px",
              "font-weight": "500",
              color: props.selected ? tokens.colors.semantic.primary : tokens.colors.text.primary,
              overflow: "hidden",
              "text-overflow": "ellipsis",
              "white-space": "nowrap",
            }}
          >
            {tag().name}
          </Text>
        </div>
        <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.md, "margin-top": "2px" }}>
          <Text style={{ "font-size": "10px", color: tokens.colors.text.muted }}>
            {tag().commitShort}
          </Text>
          <Show when={tag().message}>
            <Text
              style={{
                "font-size": "10px",
                color: tokens.colors.text.muted,
                overflow: "hidden",
                "text-overflow": "ellipsis",
                "white-space": "nowrap",
                "max-width": "200px",
              }}
            >
              {tag().message}
            </Text>
          </Show>
        </div>
      </div>
    </ListItem>
  );
}

export interface SectionHeaderProps {
  title: string; iconName: string; count: number; expanded: boolean; onToggle: () => void;
}

export function SectionHeader(props: SectionHeaderProps) {
  return (
    <div
      style={{
        display: "flex",
        "align-items": "center",
        "justify-content": "space-between",
        height: "28px",
        padding: `0 ${tokens.spacing.lg}`,
        cursor: "pointer",
        "user-select": "none",
        background: tokens.colors.surface.panel,
        transition: "background var(--cortex-transition-fast)",
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = tokens.colors.interactive.hover}
      onMouseLeave={(e) => e.currentTarget.style.background = tokens.colors.surface.panel}
      onClick={props.onToggle}
    >
      <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.sm }}>
        {props.expanded ? (
          <Icon name="chevron-down" style={{ width: "12px", height: "12px", color: tokens.colors.icon.default }} />
        ) : (
          <Icon name="chevron-right" style={{ width: "12px", height: "12px", color: tokens.colors.icon.default }} />
        )}
        <Icon name={props.iconName} style={{ width: "12px", height: "12px", color: tokens.colors.icon.default }} />
        <Text style={{
          "font-size": "11px",
          "font-weight": "600",
          "text-transform": "uppercase",
          "letter-spacing": "0.5px",
          color: tokens.colors.text.muted,
        }}>
          {props.title}
        </Text>
        <Badge variant="default" size="sm">
          {props.count}
        </Badge>
      </div>
    </div>
  );
}

export interface TagListPanelProps {
  loading: boolean;
  tags: GitTag[];
  localTags: GitTag[];
  remoteTags: GitTag[];
  filteredTags: GitTag[];
  searchQuery: string;
  selectedTag: GitTag | null;
  expandedSections: Set<string>;
  operationLoading: string | null;
  onSelectTag: (tag: GitTag) => void;
  onToggleSection: (section: string) => void;
  onCreateTag: () => void;
  onPushTag: (tagName: string) => void;
  onDeleteTag: (tag: GitTag) => void;
}

function isTagOperating(operationLoading: string | null, tag: GitTag) {
  return operationLoading?.startsWith(`push-${tag.name}`) ||
    operationLoading?.startsWith(`delete-${tag.name}`) ||
    operationLoading?.startsWith(`checkout-${tag.name}`) ||
    operationLoading?.startsWith(`branch-${tag.name}`);
}

export function TagListPanel(props: TagListPanelProps) {
  return (
    <div style={{
      width: props.selectedTag ? "50%" : "100%",
      "border-right": props.selectedTag ? `1px solid ${tokens.colors.border.divider}` : undefined,
      "overflow-y": "auto",
      transition: "width var(--cortex-transition-normal)",
    }}>
      <Show when={props.loading}>
        <div style={{ display: "flex", "align-items": "center", "justify-content": "center", height: "128px" }}>
          <Icon name="spinner" style={{ width: "20px", height: "20px", animation: "spin 1s linear infinite", color: tokens.colors.icon.default }} />
        </div>
      </Show>

      <Show when={!props.loading && props.tags.length === 0}>
        <div style={{ display: "flex", "flex-direction": "column", "align-items": "center", "justify-content": "center", padding: "48px 16px", "text-align": "center" }}>
          <Icon name="tag" style={{ width: "48px", height: "48px", "margin-bottom": tokens.spacing.lg, color: tokens.colors.text.muted }} />
          <Text style={{ "font-size": "14px", "font-weight": "500", color: tokens.colors.text.primary }}>
            No tags found
          </Text>
          <Text style={{ "font-size": "12px", "margin-top": tokens.spacing.sm, color: tokens.colors.text.muted }}>
            Create a tag to mark important points in your repository's history
          </Text>
          <Button
            variant="primary"
            size="sm"
            onClick={props.onCreateTag}
            icon={<Icon name="plus" style={{ width: "14px", height: "14px" }} />}
            style={{ "margin-top": tokens.spacing.lg }}
          >
            Create Tag
          </Button>
        </div>
      </Show>

      <Show when={!props.loading && props.tags.length > 0}>
        <Show when={props.localTags.length > 0}>
          <SectionHeader
            title="Local Tags"
            iconName="cloud-slash"
            count={props.localTags.length}
            expanded={props.expandedSections.has("local")}
            onToggle={() => props.onToggleSection("local")}
          />
          <Show when={props.expandedSections.has("local")}>
            <For each={props.localTags}>
              {(tag) => (
                <TagItem
                  tag={tag}
                  selected={props.selectedTag?.name === tag.name}
                  isOperating={!!isTagOperating(props.operationLoading, tag)}
                  onSelect={props.onSelectTag}
                  onPush={props.onPushTag}
                  onDelete={props.onDeleteTag}
                />
              )}
            </For>
          </Show>
        </Show>

        <Show when={props.remoteTags.length > 0}>
          <SectionHeader
            title="Remote Tags"
            iconName="cloud"
            count={props.remoteTags.length}
            expanded={props.expandedSections.has("remote")}
            onToggle={() => props.onToggleSection("remote")}
          />
          <Show when={props.expandedSections.has("remote")}>
            <For each={props.remoteTags}>
              {(tag) => (
                <TagItem
                  tag={tag}
                  selected={props.selectedTag?.name === tag.name}
                  isOperating={!!isTagOperating(props.operationLoading, tag)}
                  onSelect={props.onSelectTag}
                  onPush={props.onPushTag}
                  onDelete={props.onDeleteTag}
                />
              )}
            </For>
          </Show>
        </Show>

        <Show when={props.filteredTags.length === 0 && props.searchQuery}>
          <div style={{ padding: "32px 16px", "text-align": "center" }}>
            <Text style={{ "font-size": "12px", color: tokens.colors.text.muted }}>
              No tags matching "{props.searchQuery}"
            </Text>
          </div>
        </Show>
      </Show>
    </div>
  );
}
