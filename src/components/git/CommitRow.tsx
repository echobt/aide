import { For, Show } from "solid-js";
import { Icon } from "@/components/ui/Icon";
import { GraphSvgColumn, RefBadge } from "./GraphSvgRenderer";
import type { Commit, GraphNode } from "./CommitGraph";

export const COMMIT_ROW_HEIGHT = 40;

export interface CommitRowProps {
  node: GraphNode;
  maxCols: number;
  isSelected: boolean;
  isExpanded: boolean;
  onCommitClick: (commit: Commit) => void;
  onContextMenu: (e: MouseEvent, commit: Commit) => void;
  onToggleDetails: (hash: string) => void;
  onCopyHash: (hash: string) => Promise<void>;
  formatDate: (dateStr: string) => string;
}

export function CommitRow(props: CommitRowProps) {
  return (
    <div>
      <div
        class={`flex items-center gap-2 px-2 py-1 cursor-pointer transition-colors ${
          props.isSelected ? "bg-white/10" : "hover:bg-white/5"
        }`}
        style={{ height: `${COMMIT_ROW_HEIGHT}px` }}
        onClick={() => props.onCommitClick(props.node.commit)}
        onContextMenu={(e) => props.onContextMenu(e, props.node.commit)}
      >
        <GraphSvgColumn node={props.node} maxCols={props.maxCols} />

        <div class="flex-1 min-w-0 flex items-center gap-2">
          <div class="flex items-center gap-1 shrink-0">
            <For each={props.node.commit.refs}>
              {(ref) => <RefBadge ref={ref} />}
            </For>
          </div>

          <span
            class="flex-1 text-sm truncate"
            style={{ color: "var(--text-base)" }}
          >
            {props.node.commit.message.split("\n")[0]}
          </span>

          <span
            class="text-xs font-mono shrink-0"
            style={{ color: "var(--text-weak)" }}
          >
            {props.node.commit.shortHash}
          </span>

          <span
            class="text-xs shrink-0 max-w-24 truncate"
            style={{ color: "var(--text-weak)" }}
          >
            {props.node.commit.author}
          </span>

          <span
            class="text-xs shrink-0 w-16 text-right"
            style={{ color: "var(--text-weaker)" }}
          >
            {props.formatDate(props.node.commit.date)}
          </span>

          <button
            class="p-1 rounded hover:bg-white/10 shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              props.onToggleDetails(props.node.commit.hash);
            }}
          >
            {props.isExpanded ? (
              <Icon name="chevron-down" class="w-3.5 h-3.5" style={{ color: "var(--text-weak)" }} />
            ) : (
              <Icon name="chevron-right" class="w-3.5 h-3.5" style={{ color: "var(--text-weak)" }} />
            )}
          </button>
        </div>
      </div>

      <Show when={props.isExpanded}>
        <div
          class="ml-16 mr-2 mb-2 p-3 rounded"
          style={{ background: "var(--surface-base)" }}
        >
          <div class="space-y-2">
            <div class="flex items-start gap-2">
              <Icon name="user" class="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--text-weak)" }} />
              <div>
                <div class="text-sm" style={{ color: "var(--text-base)" }}>
                  {props.node.commit.author}
                </div>
                <div class="text-xs" style={{ color: "var(--text-weak)" }}>
                  {props.node.commit.email}
                </div>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <Icon name="clock" class="w-4 h-4 shrink-0" style={{ color: "var(--text-weak)" }} />
              <span class="text-sm" style={{ color: "var(--text-base)" }}>
                {new Date(props.node.commit.date).toLocaleString()}
              </span>
            </div>

            <div class="flex items-center gap-2">
              <Icon name="code-commit" class="w-4 h-4 shrink-0" style={{ color: "var(--text-weak)" }} />
              <span class="text-sm font-mono" style={{ color: "var(--text-base)" }}>
                {props.node.commit.hash}
              </span>
              <button
                class="p-1 rounded hover:bg-white/10"
                onClick={() => props.onCopyHash(props.node.commit.hash)}
              >
                <Icon name="copy" class="w-3.5 h-3.5" style={{ color: "var(--text-weak)" }} />
              </button>
            </div>

            <Show when={props.node.commit.parents.length > 0}>
              <div class="flex items-center gap-2">
                <Icon name="code-merge" class="w-4 h-4 shrink-0" style={{ color: "var(--text-weak)" }} />
                <span class="text-xs" style={{ color: "var(--text-weak)" }}>
                  Parents: {props.node.commit.parents.map(p => p.slice(0, 7)).join(", ")}
                </span>
              </div>
            </Show>

            <div
              class="mt-2 pt-2 border-t"
              style={{ "border-color": "var(--border-weak)" }}
            >
              <pre
                class="text-sm whitespace-pre-wrap"
                style={{ color: "var(--text-base)" }}
              >
                {props.node.commit.message}
              </pre>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
