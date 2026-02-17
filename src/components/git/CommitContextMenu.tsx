import { Show } from "solid-js";
import { Icon } from "@/components/ui/Icon";
import type { Commit } from "./CommitGraph";

interface CommitContextMenuProps {
  position: { x: number; y: number; commit: Commit } | null;
  onCopyHash: (hash: string) => Promise<void>;
  onCherryPick?: (commit: Commit) => void;
  onRevert?: (commit: Commit) => void;
  onCreateBranch?: (commit: Commit) => void;
  onCreateTag?: (commit: Commit) => void;
  onClose: () => void;
}

export function CommitContextMenu(props: CommitContextMenuProps) {
  return (
    <Show when={props.position}>
      {(pos) => (
        <div
          class="fixed z-50 py-1 rounded shadow-lg"
          style={{
            left: `${pos().x}px`,
            top: `${pos().y}px`,
            background: "var(--surface-raised)",
            border: "1px solid var(--border-weak)"
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            class="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-white/10"
            style={{ color: "var(--text-base)" }}
            onClick={() => props.onCopyHash(pos().commit.hash)}
          >
            <Icon name="copy" class="w-4 h-4" />
            Copy SHA
          </button>
          <button
            class="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-white/10"
            style={{ color: "var(--text-base)" }}
            onClick={() => {
              props.onCherryPick?.(pos().commit);
              props.onClose();
            }}
          >
            <Icon name="code-commit" class="w-4 h-4" />
            Cherry-pick
          </button>
          <button
            class="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-white/10"
            style={{ color: "var(--text-base)" }}
            onClick={() => {
              props.onRevert?.(pos().commit);
              props.onClose();
            }}
          >
            <Icon name="rotate" class="w-4 h-4" />
            Revert
          </button>
          <div class="my-1 border-t" style={{ "border-color": "var(--border-weak)" }} />
          <button
            class="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-white/10"
            style={{ color: "var(--text-base)" }}
            onClick={() => {
              props.onCreateBranch?.(pos().commit);
              props.onClose();
            }}
          >
            <Icon name="code-branch" class="w-4 h-4" />
            Create branch here
          </button>
          <button
            class="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-white/10"
            style={{ color: "var(--text-base)" }}
            onClick={() => {
              props.onCreateTag?.(pos().commit);
              props.onClose();
            }}
          >
            <Icon name="tag" class="w-4 h-4" />
            Create tag here
          </button>
        </div>
      )}
    </Show>
  );
}
