import { For, Show } from "solid-js";
import { Icon } from "@/components/ui/Icon";
import { REBASE_ACTIONS, type RebaseAction, type RebaseCommit } from "@/components/git/InteractiveRebase";

export interface RebaseCommitRowProps {
  commit: RebaseCommit;
  index: number;
  isRebaseActive: boolean;
  editingMessage: string | null;
  editedMessage: string;
  openDropdown: string | null;
  draggedIndex: number | null;
  dragOverIndex: number | null;
  onSetCommitAction: (hash: string, action: RebaseAction) => void;
  onSetOpenDropdown: (hash: string | null) => void;
  onSetEditedMessage: (msg: string) => void;
  onDragStart: (e: DragEvent, index: number) => void;
  onDragOver: (e: DragEvent, index: number) => void;
  onDragLeave: () => void;
  onDrop: (e: DragEvent, index: number) => void;
  onDragEnd: () => void;
  onStartMessageEdit: (commit: RebaseCommit) => void;
  onSaveMessageEdit: (hash: string) => void;
  onCancelMessageEdit: () => void;
  formatDate: (dateStr: string) => string;
}

export function RebaseCommitRow(props: RebaseCommitRowProps) {
  const actionConfig = () => REBASE_ACTIONS.find(a => a.value === props.commit.action) || REBASE_ACTIONS[0];
  const isDragging = () => props.draggedIndex === props.index;
  const isDragOver = () => props.dragOverIndex === props.index;
  const isEditing = () => props.editingMessage === props.commit.hash;
  const isDropdownOpen = () => props.openDropdown === props.commit.hash;

  return (
    <div
      class={`group flex items-center gap-2 px-3 py-2 border-b transition-all ${
        isDragging() ? "opacity-50" : ""
      } ${isDragOver() ? "border-t-2 border-t-blue-500" : ""}`}
      style={{ "border-color": "var(--border-weak)" }}
      draggable={!props.isRebaseActive && !isEditing()}
      onDragStart={(e) => props.onDragStart(e, props.index)}
      onDragOver={(e) => props.onDragOver(e, props.index)}
      onDragLeave={props.onDragLeave}
      onDrop={(e) => props.onDrop(e, props.index)}
      onDragEnd={props.onDragEnd}
    >
      <div
        class={`cursor-grab p-1 rounded transition-colors ${
          props.isRebaseActive ? "opacity-30 cursor-not-allowed" : "hover:bg-white/10"
        }`}
        title={props.isRebaseActive ? "Cannot reorder during rebase" : "Drag to reorder"}
      >
        <Icon name="up-down-left-right" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
      </div>

      <div class="relative shrink-0" data-dropdown>
        <button
          class={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors ${
            props.isRebaseActive ? "opacity-60 cursor-not-allowed" : "hover:bg-white/10"
          }`}
          style={{
            background: `${actionConfig().color}20`,
            color: actionConfig().color,
            "min-width": "80px"
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (!props.isRebaseActive) {
              props.onSetOpenDropdown(isDropdownOpen() ? null : props.commit.hash);
            }
          }}
          disabled={props.isRebaseActive}
        >
          <Icon name={actionConfig().iconName} class="w-3.5 h-3.5" />
          {actionConfig().label}
          <Icon name="chevron-down" class="w-3 h-3 ml-auto" />
        </button>

        <Show when={isDropdownOpen()}>
          <div
            class="absolute left-0 top-full mt-1 z-20 w-48 rounded-md shadow-lg overflow-hidden"
            style={{ background: "var(--surface-raised)", border: "1px solid var(--border-weak)" }}
          >
            <For each={REBASE_ACTIONS}>
              {(action) => (
                <button
                  class={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-white/10 ${
                    props.commit.action === action.value ? "bg-white/5" : ""
                  }`}
                  onClick={() => props.onSetCommitAction(props.commit.hash, action.value)}
                >
                  <span style={{ color: action.color }}>
                    <Icon name={action.iconName} class="w-4 h-4" />
                  </span>
                  <div class="flex-1 min-w-0">
                    <div class="text-sm" style={{ color: "var(--text-base)" }}>
                      {action.label}
                    </div>
                    <div class="text-xs truncate" style={{ color: "var(--text-weak)" }}>
                      {action.description}
                    </div>
                  </div>
                  <Show when={props.commit.action === action.value}>
                    <Icon name="check" class="w-4 h-4 text-green-400 shrink-0" />
                  </Show>
                </button>
              )}
            </For>
          </div>
        </Show>
      </div>

      <span
        class="font-mono text-xs px-1.5 py-0.5 rounded shrink-0"
        style={{ background: "var(--surface-active)", color: "var(--text-weak)" }}
      >
        {props.commit.shortHash}
      </span>

      <Show when={!isEditing()}>
        <span
          class={`flex-1 text-sm truncate ${
            props.commit.action === "drop" ? "line-through opacity-50" : ""
          }`}
          style={{ color: "var(--text-base)" }}
          title={props.commit.message}
        >
          {props.commit.message.split("\n")[0]}
        </span>
      </Show>

      <Show when={isEditing()}>
        <input
          type="text"
          class="flex-1 px-2 py-1 rounded text-sm outline-none"
          style={{
            background: "var(--surface-base)",
            color: "var(--text-base)",
            border: "1px solid var(--accent-primary)"
          }}
          value={props.editedMessage}
          onInput={(e) => props.onSetEditedMessage(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              props.onSaveMessageEdit(props.commit.hash);
            } else if (e.key === "Escape") {
              props.onCancelMessageEdit();
            }
          }}
          autofocus
        />
      </Show>

      <span
        class="text-xs shrink-0 max-w-24 truncate"
        style={{ color: "var(--text-weak)" }}
        title={props.commit.author}
      >
        {props.commit.author}
      </span>

      <span
        class="text-xs shrink-0 w-16 text-right"
        style={{ color: "var(--text-weaker)" }}
      >
        {props.formatDate(props.commit.date)}
      </span>

      <Show when={!isEditing() && !props.isRebaseActive}>
        <button
          class="p-1.5 rounded hover:bg-white/10 transition-colors"
          onClick={() => props.onStartMessageEdit(props.commit)}
          title="Edit message"
        >
          <Icon name="pen" class="w-3.5 h-3.5" style={{ color: "var(--text-weak)" }} />
        </button>
      </Show>

      <Show when={isEditing()}>
        <div class="flex items-center gap-1">
          <button
            class="p-1 rounded hover:bg-white/10 transition-colors"
            onClick={() => props.onSaveMessageEdit(props.commit.hash)}
            title="Save"
          >
            <Icon name="check" class="w-4 h-4 text-green-400" />
          </button>
          <button
            class="p-1 rounded hover:bg-white/10 transition-colors"
            onClick={props.onCancelMessageEdit}
            title="Cancel"
          >
            <Icon name="xmark" class="w-4 h-4 text-red-400" />
          </button>
        </div>
      </Show>
    </div>
  );
}
