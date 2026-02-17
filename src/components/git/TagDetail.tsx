import { Show } from "solid-js";
import { Icon } from "@/components/ui/Icon";
import { tokens } from "@/design-system/tokens";
import {
  Button,
  IconButton,
  Badge,
  Text,
} from "@/components/ui";
import type { GitTag } from "@/utils/tauri-api";

export interface TagDetailPanelProps {
  tag: GitTag;
  tagDetailsLoading: boolean;
  operationLoading: string | null;
  copiedTag: string | null;
  onClose: () => void;
  onCheckout: (tagName: string) => void;
  onPush: (tagName: string) => void;
  onDelete: (tag: GitTag) => void;
  onCreateBranch: (tag: GitTag) => void;
  onCopyToClipboard: (text: string, tagName: string) => void;
  formatDate: (date?: Date) => string;
}

export function TagDetailPanel(props: TagDetailPanelProps) {
  const tag = () => props.tag;

  return (
    <div style={{ flex: "1", "overflow-y": "auto", display: "flex", "flex-direction": "column" }}>
      <div
        style={{
          display: "flex",
          "align-items": "center",
          "justify-content": "space-between",
          padding: `${tokens.spacing.md} ${tokens.spacing.lg}`,
          "border-bottom": `1px solid ${tokens.colors.border.divider}`,
          "flex-shrink": "0",
        }}
      >
        <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.md }}>
          <Icon name="circle-info" style={{ width: "14px", height: "14px", color: tokens.colors.icon.default }} />
          <Text style={{ "font-size": "12px", "font-weight": "600", color: tokens.colors.text.primary }}>
            Tag Details
          </Text>
        </div>
        <IconButton
          size="sm"
          tooltip="Close details"
          onClick={props.onClose}
        >
          <Icon name="xmark" style={{ width: "14px", height: "14px" }} />
        </IconButton>
      </div>

      <Show when={props.tagDetailsLoading}>
        <div style={{ display: "flex", "align-items": "center", "justify-content": "center", padding: "48px" }}>
          <Icon name="spinner" style={{ width: "20px", height: "20px", animation: "spin 1s linear infinite", color: tokens.colors.icon.default }} />
        </div>
      </Show>

      <Show when={!props.tagDetailsLoading}>
        <div style={{ padding: tokens.spacing.lg, display: "flex", "flex-direction": "column", gap: tokens.spacing.lg }}>
          <div>
            <Text style={{ "font-size": "18px", "font-weight": "600", color: tokens.colors.text.primary }}>
              {tag().name}
            </Text>
            <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.sm, "margin-top": tokens.spacing.sm }}>
              <Show when={tag().isAnnotated}>
                <Badge variant="default" size="sm">Annotated</Badge>
              </Show>
              <Show when={!tag().isAnnotated}>
                <Badge variant="default" size="sm">Lightweight</Badge>
              </Show>
              <Show when={tag().isPushed}>
                <Badge variant="success" size="sm">Pushed</Badge>
              </Show>
              <Show when={!tag().isPushed}>
                <Badge variant="warning" size="sm">Local only</Badge>
              </Show>
            </div>
          </div>

          <div style={{ display: "flex", "flex-direction": "column", gap: tokens.spacing.md }}>
            <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.md }}>
              <Icon name="code-commit" style={{ width: "14px", height: "14px", color: tokens.colors.icon.default, "flex-shrink": "0" }} />
              <Text style={{ "font-size": "12px", color: tokens.colors.text.muted }}>Commit</Text>
              <span
                style={{
                  "font-size": "12px",
                  "font-family": "var(--jb-font-code)",
                  color: tokens.colors.text.primary,
                  cursor: "pointer",
                }}
                onClick={() => props.onCopyToClipboard(tag().commit, tag().name)}
              >
                {tag().commitShort}
                <Show when={props.copiedTag === tag().name}>
                  <Icon name="check" style={{ width: "12px", height: "12px", "margin-left": "4px", color: tokens.colors.semantic.success }} />
                </Show>
              </span>
              <IconButton
                size="sm"
                tooltip="Copy full commit hash"
                onClick={() => props.onCopyToClipboard(tag().commit, tag().name)}
              >
                <Icon name="copy" style={{ width: "12px", height: "12px" }} />
              </IconButton>
            </div>

            <Show when={tag().tagger}>
              <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.md }}>
                <Icon name="user" style={{ width: "14px", height: "14px", color: tokens.colors.icon.default, "flex-shrink": "0" }} />
                <Text style={{ "font-size": "12px", color: tokens.colors.text.muted }}>Tagger</Text>
                <Text style={{ "font-size": "12px", color: tokens.colors.text.primary }}>
                  {tag().tagger}
                </Text>
              </div>
            </Show>

            <Show when={tag().date}>
              <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.md }}>
                <Icon name="calendar" style={{ width: "14px", height: "14px", color: tokens.colors.icon.default, "flex-shrink": "0" }} />
                <Text style={{ "font-size": "12px", color: tokens.colors.text.muted }}>Date</Text>
                <Text style={{ "font-size": "12px", color: tokens.colors.text.primary }}>
                  {props.formatDate(tag().date)}
                </Text>
              </div>
            </Show>
          </div>

          <Show when={tag().message}>
            <div style={{
              padding: tokens.spacing.md,
              background: tokens.colors.interactive.hover,
              "border-radius": tokens.radius.md,
            }}>
              <Text style={{ "font-size": "11px", "font-weight": "500", color: tokens.colors.text.muted, "margin-bottom": tokens.spacing.sm }}>
                Message
              </Text>
              <Text style={{ "font-size": "12px", color: tokens.colors.text.primary, "white-space": "pre-wrap" }}>
                {tag().message}
              </Text>
            </div>
          </Show>

          <div style={{ display: "flex", "flex-direction": "column", gap: tokens.spacing.sm }}>
            <Text style={{ "font-size": "11px", "font-weight": "500", color: tokens.colors.text.muted }}>
              Actions
            </Text>

            <div style={{ display: "flex", "flex-wrap": "wrap", gap: tokens.spacing.sm }}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => props.onCheckout(tag().name)}
                disabled={!!props.operationLoading}
                icon={<Icon name="eye" style={{ width: "12px", height: "12px" }} />}
              >
                Checkout
              </Button>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => props.onCreateBranch(tag())}
                disabled={!!props.operationLoading}
                icon={<Icon name="code-branch" style={{ width: "12px", height: "12px" }} />}
              >
                Create Branch
              </Button>

              <Show when={!tag().isPushed}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => props.onPush(tag().name)}
                  disabled={!!props.operationLoading}
                  icon={<Icon name="upload" style={{ width: "12px", height: "12px" }} />}
                >
                  Push
                </Button>
              </Show>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => props.onDelete(tag())}
                disabled={!!props.operationLoading}
                style={{ color: tokens.colors.semantic.error }}
                icon={<Icon name="trash" style={{ width: "12px", height: "12px" }} />}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
