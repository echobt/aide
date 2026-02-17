import { Show } from "solid-js";
import { Icon } from "@/components/ui/Icon";
import type { RebaseState, RebaseCommit } from "@/components/git/InteractiveRebase";

export interface RebaseActionFooterProps {
  rebaseState: RebaseState;
  isRebaseActive: boolean;
  canStartRebase: boolean;
  commits: RebaseCommit[];
  onStartRebase: () => void;
  onContinueRebase: () => void;
  onAbortRebase: () => void;
  onSkipCommit: () => void;
  onResolveConflicts: () => void;
  onClose?: () => void;
}

export function RebaseActionFooter(props: RebaseActionFooterProps) {
  return (
    <div
      class="px-4 py-3 border-t shrink-0"
      style={{ "border-color": "var(--border-weak)" }}
    >
      <Show when={!props.isRebaseActive}>
        <div class="flex items-center justify-between">
          <div class="text-xs" style={{ color: "var(--text-weak)" }}>
            {props.commits.length} commit{props.commits.length !== 1 ? "s" : ""} selected
            <Show when={props.commits.filter(c => c.action === "drop").length > 0}>
              <span class="ml-2 text-red-400">
                ({props.commits.filter(c => c.action === "drop").length} will be dropped)
              </span>
            </Show>
          </div>
          <div class="flex items-center gap-2">
            <Show when={props.onClose}>
              <button
                class="px-4 py-2 rounded text-sm transition-colors"
                style={{ color: "var(--text-weak)" }}
                onClick={() => props.onClose?.()}
              >
                Cancel
              </button>
            </Show>
            <button
              class="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: "var(--accent-primary)", color: "white" }}
              disabled={!props.canStartRebase}
              onClick={props.onStartRebase}
            >
              <Show when={props.rebaseState === "preparing"}>
                <Icon name="spinner" class="w-4 h-4 animate-spin" />
                Starting...
              </Show>
              <Show when={props.rebaseState !== "preparing"}>
                <Icon name="play" class="w-4 h-4" />
                Start Rebase
              </Show>
            </button>
          </div>
        </div>
      </Show>

      <Show when={props.isRebaseActive}>
        <div class="flex items-center justify-between">
          <button
            class="flex items-center gap-2 px-4 py-2 rounded text-sm transition-colors hover:bg-red-500/20"
            style={{ color: "var(--cortex-error)" }}
            onClick={props.onAbortRebase}
            disabled={props.rebaseState === "aborting"}
          >
            <Icon name="xmark" class="w-4 h-4" />
            Abort Rebase
          </button>

          <div class="flex items-center gap-2">
            <Show when={props.rebaseState === "paused-conflict"}>
              <button
                class="flex items-center gap-2 px-4 py-2 rounded text-sm transition-colors border"
                style={{ "border-color": "var(--border-weak)", color: "var(--text-base)" }}
                onClick={props.onResolveConflicts}
              >
                <Icon name="code-merge" class="w-4 h-4" />
                Resolve Conflicts
              </button>
              <button
                class="flex items-center gap-2 px-4 py-2 rounded text-sm transition-colors border"
                style={{ "border-color": "var(--border-weak)", color: "var(--text-weak)" }}
                onClick={props.onSkipCommit}
              >
                <Icon name="forward-step" class="w-4 h-4" />
                Skip Commit
              </button>
            </Show>

            <button
              class="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition-colors disabled:opacity-50"
              style={{ background: "var(--accent-primary)", color: "white" }}
              onClick={props.onContinueRebase}
              disabled={props.rebaseState === "in-progress" || props.rebaseState === "completing"}
            >
              <Show when={props.rebaseState === "in-progress" || props.rebaseState === "completing"}>
                <Icon name="spinner" class="w-4 h-4 animate-spin" />
                Processing...
              </Show>
              <Show when={props.rebaseState === "paused-conflict" || props.rebaseState === "paused-edit"}>
                <Icon name="play" class="w-4 h-4" />
                Continue Rebase
              </Show>
            </button>
          </div>
        </div>
      </Show>
    </div>
  );
}
