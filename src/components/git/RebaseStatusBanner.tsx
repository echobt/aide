import { For, Show } from "solid-js";
import { Icon } from "@/components/ui/Icon";
import type { RebaseState, RebaseConflict, RebaseCommit } from "@/components/git/InteractiveRebase";

export interface RebaseStatusBannerProps {
  rebaseState: RebaseState;
  conflict: RebaseConflict | null;
  pausedCommit: RebaseCommit | null;
  currentStep: number;
  totalSteps: number;
  progressPercent: number;
}

export function RebaseStatusBanner(props: RebaseStatusBannerProps) {
  return (
    <div
      class="px-4 py-3 border-b shrink-0"
      style={{
        background: props.rebaseState === "paused-conflict"
          ? "rgba(248, 81, 73, 0.1)"
          : props.rebaseState === "paused-edit"
            ? "rgba(240, 136, 62, 0.1)"
            : "rgba(88, 166, 255, 0.1)",
        "border-color": "var(--border-weak)"
      }}
    >
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <Show when={props.rebaseState === "paused-conflict"}>
            <Icon name="triangle-exclamation" class="w-5 h-5 text-red-400" />
            <div>
              <div class="text-sm font-medium text-red-400">Conflicts Detected</div>
              <div class="text-xs" style={{ color: "var(--text-weak)" }}>
                {props.conflict?.files.length || 0} file(s) with conflicts
              </div>
            </div>
          </Show>

          <Show when={props.rebaseState === "paused-edit"}>
            <Icon name="stop" class="w-5 h-5 text-orange-400" />
            <div>
              <div class="text-sm font-medium text-orange-400">Rebase Paused</div>
              <div class="text-xs" style={{ color: "var(--text-weak)" }}>
                Stopped for editing at {props.pausedCommit?.shortHash || "commit"}
              </div>
            </div>
          </Show>

          <Show when={props.rebaseState === "in-progress" || props.rebaseState === "completing"}>
            <Icon name="spinner" class="w-5 h-5 text-blue-400 animate-spin" />
            <div>
              <div class="text-sm font-medium text-blue-400">Rebase In Progress</div>
              <div class="text-xs" style={{ color: "var(--text-weak)" }}>
                Step {props.currentStep} of {props.totalSteps}
              </div>
            </div>
          </Show>

          <Show when={props.rebaseState === "aborting"}>
            <Icon name="spinner" class="w-5 h-5 text-red-400 animate-spin" />
            <div>
              <div class="text-sm font-medium text-red-400">Aborting Rebase...</div>
            </div>
          </Show>
        </div>

        <Show when={props.totalSteps > 0}>
          <div class="flex items-center gap-2">
            <div
              class="w-32 h-2 rounded-full overflow-hidden"
              style={{ background: "var(--surface-active)" }}
            >
              <div
                class="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${props.progressPercent}%`,
                  background: props.rebaseState === "paused-conflict"
                    ? "var(--cortex-error)"
                    : props.rebaseState === "paused-edit"
                      ? "var(--cortex-warning)"
                      : "var(--cortex-info)"
                }}
              />
            </div>
            <span class="text-xs" style={{ color: "var(--text-weak)" }}>
              {props.progressPercent}%
            </span>
          </div>
        </Show>
      </div>

      <Show when={props.rebaseState === "paused-conflict" && props.conflict}>
        <div class="mt-3 pt-3 border-t" style={{ "border-color": "var(--border-weak)" }}>
          <div class="text-xs font-medium mb-2" style={{ color: "var(--text-weak)" }}>
            Conflicting files:
          </div>
          <div class="flex flex-wrap gap-2">
            <For each={props.conflict?.files || []}>
              {(file) => (
                <span
                  class="text-xs px-2 py-1 rounded"
                  style={{ background: "rgba(248, 81, 73, 0.2)", color: "var(--cortex-error)" }}
                >
                  {file}
                </span>
              )}
            </For>
          </div>
        </div>
      </Show>
    </div>
  );
}
