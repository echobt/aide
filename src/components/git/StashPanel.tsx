import { createSignal, Show, onMount } from "solid-js";
import { Icon } from "../ui/Icon";
import {
  gitStashListEnhanced,
  gitStashApply,
  gitStashPop,
  gitStashDrop,
  gitStashCreate,
  StashEntry as TauriStashEntry
} from "../../utils/tauri-api";
import { getProjectPath } from "../../utils/workspace";
import { StashList } from "@/components/git/StashList";
import { CreateStashDialog, ConfirmStashDialog } from "@/components/git/StashDialogs";
import type { ConfirmAction } from "@/components/git/StashDialogs";

export interface StashEntry {
  index: number;
  message: string;
  branch: string | null;
  timestamp: number;
  date: string;
}

export interface StashPanelProps {
  onStashApply?: (index: number) => void;
  onStashPop?: (index: number) => void;
  onStashDrop?: (index: number) => void;
  onStashView?: (entry: StashEntry) => void;
  onCreateStash?: (message: string, includeUntracked: boolean) => void;
}

export function StashPanel(props: StashPanelProps) {
  const [stashes, setStashes] = createSignal<StashEntry[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [selectedIndex, setSelectedIndex] = createSignal<number | null>(null);
  const [searchQuery, setSearchQuery] = createSignal("");
  const [showCreateDialog, setShowCreateDialog] = createSignal(false);
  const [newStashMessage, setNewStashMessage] = createSignal("");
  const [includeUntracked, setIncludeUntracked] = createSignal(true);
  const [expandedStash, setExpandedStash] = createSignal<number | null>(null);
  const [confirmAction, setConfirmAction] = createSignal<ConfirmAction | null>(null);

  onMount(() => {
    fetchStashes();
  });

  const fetchStashes = async () => {
    setLoading(true);
    try {
      const projectPath = getProjectPath();
      const data = await gitStashListEnhanced(projectPath);

      const mappedStashes: StashEntry[] = data.map((s: TauriStashEntry) => ({
        index: s.index,
        message: s.message,
        branch: s.branch,
        timestamp: s.date ? new Date(s.date).getTime() / 1000 : Date.now() / 1000,
        date: s.date || new Date().toISOString(),
      }));

      setStashes(mappedStashes);
    } catch (err) {
      console.error("Failed to fetch stashes:", err);
    } finally {
      setLoading(false);
    }
  };

  const applyStash = async (index: number) => {
    try {
      const projectPath = getProjectPath();
      await gitStashApply(projectPath, index);
      props.onStashApply?.(index);
      fetchStashes();
    } catch (err) {
      console.error("Failed to apply stash:", err);
    }
  };

  const popStash = async (index: number) => {
    try {
      const projectPath = getProjectPath();
      await gitStashPop(projectPath, index);
      props.onStashPop?.(index);
      setConfirmAction(null);
      fetchStashes();
    } catch (err) {
      console.error("Failed to pop stash:", err);
    }
  };

  const dropStash = async (index: number) => {
    try {
      const projectPath = getProjectPath();
      await gitStashDrop(projectPath, index);
      props.onStashDrop?.(index);
      setConfirmAction(null);
      fetchStashes();
    } catch (err) {
      console.error("Failed to drop stash:", err);
    }
  };

  const createStash = async () => {
    if (!newStashMessage().trim()) return;

    try {
      const projectPath = getProjectPath();
      await gitStashCreate(projectPath, newStashMessage(), includeUntracked());
      props.onCreateStash?.(newStashMessage(), includeUntracked());
      setShowCreateDialog(false);
      setNewStashMessage("");
      fetchStashes();
    } catch (err) {
      console.error("Failed to create stash:", err);
    }
  };

  const filteredStashes = () => {
    const query = searchQuery().toLowerCase();
    if (!query) return stashes();

    return stashes().filter(stash =>
      stash.message.toLowerCase().includes(query) ||
      stash.branch?.toLowerCase().includes(query)
    );
  };

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      if (diffHours === 0) {
        const diffMins = Math.floor(diffMs / (1000 * 60));
        return `${diffMins} minutes ago`;
      }
      return `${diffHours} hours ago`;
    }
    if (diffDays === 1) return "yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  const toggleExpanded = (index: number) => {
    setExpandedStash(expandedStash() === index ? null : index);
  };

  const handleConfirm = (action: ConfirmAction) => {
    if (action.type === "drop") {
      dropStash(action.index);
    } else {
      popStash(action.index);
    }
  };

  return (
    <div
      class="h-full flex flex-col overflow-hidden"
      style={{ background: "var(--background-base)" }}
    >
      <div
        class="flex items-center justify-between px-3 py-2 border-b shrink-0"
        style={{ "border-color": "var(--border-weak)" }}
      >
        <div class="flex items-center gap-2">
          <Icon name="box-archive" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
          <span class="text-sm font-medium" style={{ color: "var(--text-base)" }}>
            Stashes
          </span>
          <span
            class="text-xs px-1.5 rounded"
            style={{ background: "var(--surface-active)", color: "var(--text-weak)" }}
          >
            {stashes().length}
          </span>
        </div>
        <div class="flex items-center gap-1">
          <button
            class="p-1.5 rounded hover:bg-white/10 transition-colors"
            onClick={() => setShowCreateDialog(true)}
            title="Create new stash"
          >
            <Icon name="plus" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
          </button>
          <button
            class="p-1.5 rounded hover:bg-white/10 transition-colors"
            onClick={fetchStashes}
            disabled={loading()}
          >
            <Icon
              name="rotate"
              class={`w-4 h-4 ${loading() ? "animate-spin" : ""}`}
              style={{ color: "var(--text-weak)" }}
            />
          </button>
        </div>
      </div>

      <Show when={stashes().length > 0}>
        <div class="px-3 py-2 border-b" style={{ "border-color": "var(--border-weak)" }}>
          <div
            class="flex items-center gap-2 px-2 py-1.5 rounded"
            style={{ background: "var(--background-stronger)" }}
          >
            <Icon name="magnifying-glass" class="w-4 h-4 shrink-0" style={{ color: "var(--text-weak)" }} />
            <input
              type="text"
              placeholder="Search stashes..."
              class="flex-1 bg-transparent text-sm outline-none"
              style={{ color: "var(--text-base)" }}
              value={searchQuery()}
              onInput={(e) => setSearchQuery(e.currentTarget.value)}
            />
          </div>
        </div>
      </Show>

      <div class="flex-1 overflow-auto">
        <Show when={loading()}>
          <div class="flex items-center justify-center h-32">
            <span style={{ color: "var(--text-weak)" }}>Loading stashes...</span>
          </div>
        </Show>

        <Show when={!loading() && filteredStashes().length === 0}>
          <div class="flex flex-col items-center justify-center h-32 gap-2">
            <Icon name="box-archive" class="w-8 h-8" style={{ color: "var(--text-weaker)" }} />
            <span style={{ color: "var(--text-weak)" }}>
              {stashes().length === 0 ? "No stashes" : "No matching stashes"}
            </span>
            <Show when={stashes().length === 0}>
              <button
                class="mt-2 px-3 py-1.5 rounded text-sm transition-colors"
                style={{ background: "var(--accent-primary)", color: "white" }}
                onClick={() => setShowCreateDialog(true)}
              >
                Create stash
              </button>
            </Show>
          </div>
        </Show>

        <Show when={!loading() && filteredStashes().length > 0}>
          <StashList
            stashes={filteredStashes()}
            expandedStash={expandedStash()}
            selectedIndex={selectedIndex()}
            onToggleExpanded={toggleExpanded}
            onSelect={setSelectedIndex}
            onApply={applyStash}
            onView={(entry) => props.onStashView?.(entry)}
            onConfirmAction={setConfirmAction}
            formatTimestamp={formatTimestamp}
          />
        </Show>
      </div>

      <CreateStashDialog
        open={showCreateDialog()}
        message={newStashMessage()}
        includeUntracked={includeUntracked()}
        onMessageChange={setNewStashMessage}
        onIncludeUntrackedChange={setIncludeUntracked}
        onSubmit={createStash}
        onClose={() => setShowCreateDialog(false)}
      />

      <ConfirmStashDialog
        action={confirmAction()}
        onConfirm={handleConfirm}
        onClose={() => setConfirmAction(null)}
      />
    </div>
  );
}

export default StashPanel;
