import { createSignal, createEffect, For, Show, onMount, onCleanup, createMemo } from "solid-js";
import { Icon } from "@/components/ui/Icon";
import { VirtualList } from "@/components/ui/VirtualList";
import { gitLog, gitGetRefs, GitCommit as TauriGitCommit } from "@/utils/tauri-api";
import { getProjectPath } from "@/utils/workspace";
import { CommitRow, COMMIT_ROW_HEIGHT } from "./CommitRow";
import { CommitContextMenu } from "./CommitContextMenu";
import { computeGraphNodes, formatRelativeDate } from "./commitGraphLayout";

const VIRTUALIZE_THRESHOLD = 100;

export interface Commit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  email: string;
  date: string;
  timestamp: number;
  parents: string[];
  refs: CommitRef[];
  isMerge: boolean;
}

export interface CommitRef {
  name: string;
  type: "branch" | "tag" | "remote" | "head";
  isHead?: boolean;
}

interface CommitGraphProps {
  commits?: Commit[];
  onCommitSelect?: (commit: Commit) => void;
  onCherryPick?: (commit: Commit) => void;
  onRevert?: (commit: Commit) => void;
  onCreateBranch?: (commit: Commit) => void;
  onCreateTag?: (commit: Commit) => void;
  selectedCommit?: string | null;
  currentBranch?: string;
  maxCommits?: number;
}

export interface GraphNode {
  commit: Commit;
  column: number;
  parents: { hash: string; column: number }[];
  color: string;
}

export function CommitGraph(props: CommitGraphProps) {
  const [commits, setCommits] = createSignal<Commit[]>(props.commits || []);
  const [loading, setLoading] = createSignal(false);
  const [searchQuery, setSearchQuery] = createSignal("");
  const [selectedHash, setSelectedHash] = createSignal<string | null>(props.selectedCommit || null);
  const [contextMenuPos, setContextMenuPos] = createSignal<{ x: number; y: number; commit: Commit } | null>(null);
  const [expandedDetails, setExpandedDetails] = createSignal<Set<string>>(new Set());

  const maxCommits = () => props.maxCommits || 100;

  createEffect(() => {
    if (props.commits) {
      setCommits(props.commits);
    } else {
      fetchCommitHistory();
    }
  });

  createEffect(() => {
    if (props.selectedCommit !== undefined) {
      setSelectedHash(props.selectedCommit);
    }
  });

  const fetchCommitHistory = async () => {
    setLoading(true);
    try {
      const projectPath = getProjectPath();

      const [data, refsMap] = await Promise.all([
        gitLog(projectPath, maxCommits()),
        gitGetRefs(projectPath).catch(() => ({} as Record<string, string[]>))
      ]);

      const parseRef = (refName: string): CommitRef => {
        if (refName === "HEAD") {
          return { name: "HEAD", type: "head", isHead: true };
        } else if (refName.startsWith("tag: ")) {
          return { name: refName.replace("tag: ", ""), type: "tag" };
        } else if (refName.includes("/")) {
          return { name: refName, type: "remote" };
        } else {
          return { name: refName, type: "branch" };
        }
      };

      const mappedCommits: Commit[] = data.map((c: TauriGitCommit) => ({
        hash: c.hash,
        shortHash: c.shortHash,
        message: c.message,
        author: c.author,
        email: c.authorEmail,
        date: c.date,
        timestamp: new Date(c.date).getTime(),
        parents: c.parents || [],
        refs: (refsMap[c.hash] || []).map(parseRef),
        isMerge: (c.parents || []).length > 1
      }));

      setCommits(mappedCommits);
    } catch (err) {
      console.error("Failed to fetch commit history:", err);
    } finally {
      setLoading(false);
    }
  };

  const graphNodes = createMemo(() => computeGraphNodes(commits()));

  const filteredNodes = createMemo(() => {
    const query = searchQuery().toLowerCase();
    if (!query) return graphNodes();

    return graphNodes().filter(node =>
      node.commit.message.toLowerCase().includes(query) ||
      node.commit.author.toLowerCase().includes(query) ||
      node.commit.hash.toLowerCase().includes(query) ||
      node.commit.refs.some(ref => ref.name.toLowerCase().includes(query))
    );
  });

  const handleCommitClick = (commit: Commit) => {
    setSelectedHash(commit.hash);
    props.onCommitSelect?.(commit);
  };

  const handleContextMenu = (e: MouseEvent, commit: Commit) => {
    e.preventDefault();
    setContextMenuPos({ x: e.clientX, y: e.clientY, commit });
  };

  const closeContextMenu = () => setContextMenuPos(null);

  const copyCommitHash = async (hash: string) => {
    try {
      await navigator.clipboard.writeText(hash);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
    closeContextMenu();
  };

  const toggleDetails = (hash: string) => {
    const expanded = new Set(expandedDetails());
    if (expanded.has(hash)) {
      expanded.delete(hash);
    } else {
      expanded.add(hash);
    }
    setExpandedDetails(expanded);
  };

  onMount(() => {
    const handleClickOutside = () => closeContextMenu();
    document.addEventListener("click", handleClickOutside);
    onCleanup(() => document.removeEventListener("click", handleClickOutside));
  });

  const maxColumns = createMemo(() => {
    return Math.max(...graphNodes().map(n => n.column), 0) + 1;
  });

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
          <Icon name="code-commit" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
          <span class="text-sm font-medium" style={{ color: "var(--text-base)" }}>
            Commit History
          </span>
          <span
            class="text-xs px-1.5 rounded"
            style={{ background: "var(--surface-active)", color: "var(--text-weak)" }}
          >
            {commits().length}
          </span>
        </div>
        <button
          class="p-1 rounded hover:bg-white/10 transition-colors"
          onClick={fetchCommitHistory}
          disabled={loading()}
        >
          <Icon
            name="rotate"
            class={`w-4 h-4 ${loading() ? "animate-spin" : ""}`}
            style={{ color: "var(--text-weak)" }}
          />
        </button>
      </div>

      <div class="px-3 py-2 border-b" style={{ "border-color": "var(--border-weak)" }}>
        <div
          class="flex items-center gap-2 px-2 py-1.5 rounded"
          style={{ background: "var(--background-stronger)" }}
        >
          <Icon name="magnifying-glass" class="w-4 h-4 shrink-0" style={{ color: "var(--text-weak)" }} />
          <input
            type="text"
            placeholder="Search commits..."
            class="flex-1 bg-transparent text-sm outline-none"
            style={{ color: "var(--text-base)" }}
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
          />
        </div>
      </div>

      <div class="flex-1 overflow-auto">
        <Show when={loading()}>
          <div class="flex items-center justify-center h-32">
            <span style={{ color: "var(--text-weak)" }}>Loading commits...</span>
          </div>
        </Show>

        <Show when={!loading() && filteredNodes().length === 0}>
          <div class="flex items-center justify-center h-32">
            <span style={{ color: "var(--text-weak)" }}>No commits found</span>
          </div>
        </Show>

        <Show when={!loading() && filteredNodes().length > 0}>
          <div class="min-w-max">
            <Show
              when={filteredNodes().length >= VIRTUALIZE_THRESHOLD && expandedDetails().size === 0}
              fallback={
                <For each={filteredNodes()}>
                  {(node) => (
                    <CommitRow
                      node={node}
                      maxCols={maxColumns()}
                      isSelected={selectedHash() === node.commit.hash}
                      isExpanded={expandedDetails().has(node.commit.hash)}
                      onCommitClick={handleCommitClick}
                      onContextMenu={handleContextMenu}
                      onToggleDetails={toggleDetails}
                      onCopyHash={copyCommitHash}
                      formatDate={formatRelativeDate}
                    />
                  )}
                </For>
              }
            >
              <VirtualList
                items={filteredNodes()}
                itemHeight={COMMIT_ROW_HEIGHT}
                height="100%"
                overscan={10}
                class="h-full"
              >
                {(node) => (
                  <CommitRow
                    node={node}
                    maxCols={maxColumns()}
                    isSelected={selectedHash() === node.commit.hash}
                    isExpanded={false}
                    onCommitClick={handleCommitClick}
                    onContextMenu={handleContextMenu}
                    onToggleDetails={toggleDetails}
                    onCopyHash={copyCommitHash}
                    formatDate={formatRelativeDate}
                  />
                )}
              </VirtualList>
            </Show>
          </div>
        </Show>
      </div>

      <CommitContextMenu
        position={contextMenuPos()}
        onCopyHash={copyCommitHash}
        onCherryPick={props.onCherryPick}
        onRevert={props.onRevert}
        onCreateBranch={props.onCreateBranch}
        onCreateTag={props.onCreateTag}
        onClose={closeContextMenu}
      />
    </div>
  );
}

export default CommitGraph;
