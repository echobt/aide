import { For, Show } from "solid-js";
import { Icon } from "@/components/ui/Icon";
import type { StashEntry } from "@/components/git/StashPanel";
import type { ConfirmAction } from "@/components/git/StashDialogs";

export interface StashListProps {
  stashes: StashEntry[];
  expandedStash: number | null;
  selectedIndex: number | null;
  onToggleExpanded: (index: number) => void;
  onSelect: (index: number) => void;
  onApply: (index: number) => void;
  onView: (entry: StashEntry) => void;
  onConfirmAction: (action: ConfirmAction) => void;
  formatTimestamp: (timestamp: number) => string;
}

export function StashList(props: StashListProps) {
  return (
    <div class="py-1">
      <For each={props.stashes}>
        {(stash) => {
          const isExpanded = () => props.expandedStash === stash.index;
          const isSelected = () => props.selectedIndex === stash.index;

          return (
            <div>
              <div
                class={`group px-3 py-2 cursor-pointer transition-colors ${
                  isSelected() ? "bg-white/10" : "hover:bg-white/5"
                }`}
                onClick={() => {
                  props.onSelect(stash.index);
                  props.onToggleExpanded(stash.index);
                }}
              >
                <div class="flex items-start gap-2">
                  <button
                    class="p-0.5 mt-0.5 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      props.onToggleExpanded(stash.index);
                    }}
                  >
                    {isExpanded() ? (
                      <Icon name="chevron-down" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
                    ) : (
                      <Icon name="chevron-right" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
                    )}
                  </button>

                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <span
                        class="text-xs font-mono px-1.5 py-0.5 rounded"
                        style={{ background: "var(--surface-active)", color: "var(--text-weak)" }}
                      >
                        stash@{`{${stash.index}}`}
                      </span>
                      <span class="text-sm truncate" style={{ color: "var(--text-base)" }}>
                        {stash.message}
                      </span>
                    </div>

                    <div class="flex items-center gap-3 mt-1">
                      <Show when={stash.branch}>
                        <span class="flex items-center gap-1 text-xs" style={{ color: "var(--text-weak)" }}>
                          <Icon name="code-branch" class="w-3 h-3" />
                          {stash.branch}
                        </span>
                      </Show>
                      <span class="text-xs" style={{ color: "var(--text-weaker)" }}>
                        {props.formatTimestamp(stash.timestamp)}
                      </span>
                    </div>
                  </div>

                  <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      class="p-1.5 rounded hover:bg-white/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        props.onApply(stash.index);
                      }}
                      title="Apply"
                    >
                      <Icon name="download" class="w-3.5 h-3.5" style={{ color: "var(--text-weak)" }} />
                    </button>
                    <button
                      class="p-1.5 rounded hover:bg-white/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        props.onConfirmAction({ type: "pop", index: stash.index });
                      }}
                      title="Pop"
                    >
                      <Icon name="play" class="w-3.5 h-3.5" style={{ color: "var(--text-weak)" }} />
                    </button>
                    <button
                      class="p-1.5 rounded hover:bg-white/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        props.onView(stash);
                      }}
                      title="View"
                    >
                      <Icon name="eye" class="w-3.5 h-3.5" style={{ color: "var(--text-weak)" }} />
                    </button>
                    <button
                      class="p-1.5 rounded hover:bg-white/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        props.onConfirmAction({ type: "drop", index: stash.index });
                      }}
                      title="Drop"
                    >
                      <Icon name="trash" class="w-3.5 h-3.5 text-red-400" />
                    </button>
                  </div>
                </div>
              </div>

              <Show when={isExpanded()}>
                <div
                  class="mx-3 mb-2 p-3 rounded"
                  style={{ background: "var(--surface-base)" }}
                >
                  <div class="space-y-3">
                    <div class="flex items-center gap-2">
                      <Icon name="clock" class="w-4 h-4 shrink-0" style={{ color: "var(--text-weak)" }} />
                      <span class="text-sm" style={{ color: "var(--text-base)" }}>
                        {new Date(stash.timestamp * 1000).toLocaleString()}
                      </span>
                    </div>

                    <div class="flex items-center gap-2 pt-2 border-t" style={{ "border-color": "var(--border-weak)" }}>
                      <button
                        class="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors"
                        style={{ background: "var(--accent-primary)", color: "white" }}
                        onClick={() => props.onApply(stash.index)}
                      >
                        <Icon name="download" class="w-4 h-4" />
                        Apply
                      </button>
                      <button
                        class="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors border"
                        style={{ "border-color": "var(--border-weak)", color: "var(--text-base)" }}
                        onClick={() => props.onConfirmAction({ type: "pop", index: stash.index })}
                      >
                        <Icon name="play" class="w-4 h-4" />
                        Pop
                      </button>
                      <button
                        class="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors hover:bg-red-500/20"
                        style={{ color: "var(--cortex-error)" }}
                        onClick={() => props.onConfirmAction({ type: "drop", index: stash.index })}
                      >
                        <Icon name="trash" class="w-4 h-4" />
                        Drop
                      </button>
                    </div>
                  </div>
                </div>
              </Show>
            </div>
          );
        }}
      </For>
    </div>
  );
}
