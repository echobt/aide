import { Show } from "solid-js";
import { Icon } from "@/components/ui/Icon";

export interface ConfirmAction {
  type: "drop" | "pop";
  index: number;
}

export interface CreateStashDialogProps {
  open: boolean;
  message: string;
  includeUntracked: boolean;
  onMessageChange: (value: string) => void;
  onIncludeUntrackedChange: (value: boolean) => void;
  onSubmit: () => void;
  onClose: () => void;
}

export function CreateStashDialog(props: CreateStashDialogProps) {
  return (
    <Show when={props.open}>
      <div
        class="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: "rgba(0, 0, 0, 0.5)" }}
        onClick={() => props.onClose()}
      >
        <div
          class="w-96 p-4 rounded-lg shadow-xl"
          style={{ background: "var(--surface-raised)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-medium" style={{ color: "var(--text-base)" }}>
              Create Stash
            </h3>
            <button
              class="p-1 rounded hover:bg-white/10"
              onClick={() => props.onClose()}
            >
              <Icon name="xmark" class="w-5 h-5" style={{ color: "var(--text-weak)" }} />
            </button>
          </div>

          <div class="space-y-4">
            <div>
              <label class="block text-sm mb-1.5" style={{ color: "var(--text-weak)" }}>
                Message
              </label>
              <input
                type="text"
                placeholder="Stash message..."
                class="w-full px-3 py-2 rounded text-sm outline-none"
                style={{
                  background: "var(--background-stronger)",
                  color: "var(--text-base)",
                  border: "1px solid var(--border-weak)"
                }}
                value={props.message}
                onInput={(e) => props.onMessageChange(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && props.message.trim()) {
                    props.onSubmit();
                  }
                }}
              />
            </div>

            <label class="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={props.includeUntracked}
                onChange={(e) => props.onIncludeUntrackedChange(e.currentTarget.checked)}
                class="rounded"
              />
              <span class="text-sm" style={{ color: "var(--text-base)" }}>
                Include untracked files
              </span>
            </label>

            <div class="flex justify-end gap-2 pt-2">
              <button
                class="px-4 py-2 rounded text-sm transition-colors"
                style={{ color: "var(--text-weak)" }}
                onClick={() => props.onClose()}
              >
                Cancel
              </button>
              <button
                class="px-4 py-2 rounded text-sm transition-colors disabled:opacity-50"
                style={{ background: "var(--accent-primary)", color: "white" }}
                disabled={!props.message.trim()}
                onClick={props.onSubmit}
              >
                Create Stash
              </button>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
}

export interface ConfirmStashDialogProps {
  action: ConfirmAction | null;
  onConfirm: (action: ConfirmAction) => void;
  onClose: () => void;
}

export function ConfirmStashDialog(props: ConfirmStashDialogProps) {
  return (
    <Show when={props.action}>
      {(action) => (
        <div
          class="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0, 0, 0, 0.5)" }}
          onClick={() => props.onClose()}
        >
          <div
            class="w-80 p-4 rounded-lg shadow-xl"
            style={{ background: "var(--surface-raised)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 class="text-lg font-medium mb-2" style={{ color: "var(--text-base)" }}>
              {action().type === "drop" ? "Drop Stash?" : "Pop Stash?"}
            </h3>
            <p class="text-sm mb-4" style={{ color: "var(--text-weak)" }}>
              {action().type === "drop"
                ? `This will permanently delete stash@{${action().index}}. This action cannot be undone.`
                : `This will apply and remove stash@{${action().index}}.`}
            </p>
            <div class="flex justify-end gap-2">
              <button
                class="px-4 py-2 rounded text-sm transition-colors"
                style={{ color: "var(--text-weak)" }}
                onClick={() => props.onClose()}
              >
                Cancel
              </button>
              <button
                class={`px-4 py-2 rounded text-sm transition-colors ${
                  action().type === "drop" ? "bg-red-500 hover:bg-red-600" : ""
                }`}
                style={action().type === "pop" ? { background: "var(--accent-primary)", color: "white" } : { color: "white" }}
                onClick={() => props.onConfirm(action())}
              >
                {action().type === "drop" ? "Drop" : "Pop"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Show>
  );
}
