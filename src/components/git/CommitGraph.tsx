import { createSignal, createEffect, For, Show, onMount, onCleanup, createMemo } from "solid-js";
import { Icon } from "../ui/Icon";
import { VirtualList } from "../ui/VirtualList";
import { gitLog, gitGetRefs, GitCommit as TauriGitCommit } from "../../utils/tauri-api";
import { getProjectPath } from "../../utils/workspace";

// Threshold for virtualizing commit list (virtualize if above this count)
const VIRTUALIZE_THRESHOLD = 100;
// Height of each commit row
const COMMIT_ROW_HEIGHT = 40;

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

interface GraphNode {
  commit: Commit;
  column: number;
  parents: { hash: string; column: number }[];
  color: string;
}

const GRAPH_COLORS = [
  "var(--cortex-info)", "var(--cortex-success)", "var(--cortex-warning)", "var(--cortex-info)",
  "var(--cortex-error)", "var(--cortex-error)", "var(--cortex-info)", "var(--cortex-success)",
  "var(--cortex-warning)", "var(--cortex-info)", "var(--cortex-error)", "var(--cortex-success)"
];

/** Props for CommitRow component */
interface CommitRowProps {
  node: GraphNode;
  maxCols: number;
  isSelected: boolean;
  isExpanded: boolean;
  onCommitClick: (commit: Commit) => void;
  onContextMenu: (e: MouseEvent, commit: Commit) => void;
  onToggleDetails: (hash: string) => void;
  onCopyHash: (hash: string) => Promise<void>;
  renderGraphColumn: (node: GraphNode, maxCols: number) => any;
  renderRefBadge: (ref: CommitRef) => any;
  formatDate: (dateStr: string) => string;
}

/** Extracted commit row component for virtualization */
function CommitRow(props: CommitRowProps) {
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
        {/* Graph visualization */}
        {props.renderGraphColumn(props.node, props.maxCols)}

        {/* Commit info */}
        <div class="flex-1 min-w-0 flex items-center gap-2">
          {/* Refs */}
          <div class="flex items-center gap-1 shrink-0">
            <For each={props.node.commit.refs}>
              {(ref) => props.renderRefBadge(ref)}
            </For>
          </div>

          {/* Message */}
          <span
            class="flex-1 text-sm truncate"
            style={{ color: "var(--text-base)" }}
          >
            {props.node.commit.message.split("\n")[0]}
          </span>

          {/* Short hash */}
          <span
            class="text-xs font-mono shrink-0"
            style={{ color: "var(--text-weak)" }}
          >
            {props.node.commit.shortHash}
          </span>

          {/* Author */}
          <span
            class="text-xs shrink-0 max-w-24 truncate"
            style={{ color: "var(--text-weak)" }}
          >
            {props.node.commit.author}
          </span>

          {/* Date */}
          <span
            class="text-xs shrink-0 w-16 text-right"
            style={{ color: "var(--text-weaker)" }}
          >
            {props.formatDate(props.node.commit.date)}
          </span>

          {/* Expand button */}
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

      {/* Expanded details */}
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
      
      // Fetch commits and refs in parallel
      const [data, refsMap] = await Promise.all([
        gitLog(projectPath, maxCommits()),
        gitGetRefs(projectPath).catch(() => ({} as Record<string, string[]>))
      ]);
      
      // Helper to convert ref string to CommitRef
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
      
      // Map Tauri GitCommit to component's Commit interface
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

  const graphNodes = createMemo(() => {
    const nodes: GraphNode[] = [];
    const columnMap = new Map<string, number>();
    const activeColumns: (string | null)[] = [];

    const getNextColumn = (): number => {
      const idx = activeColumns.findIndex(c => c === null);
      if (idx >= 0) return idx;
      return activeColumns.length;
    };

    const releaseColumn = (col: number) => {
      if (col < activeColumns.length) {
        activeColumns[col] = null;
      }
    };

    for (const commit of commits()) {
      let column = columnMap.get(commit.hash);

      if (column === undefined) {
        column = getNextColumn();
        columnMap.set(commit.hash, column);
        if (column >= activeColumns.length) {
          activeColumns.push(commit.hash);
        } else {
          activeColumns[column] = commit.hash;
        }
      }

      const parentConnections: { hash: string; column: number }[] = [];

      for (let i = 0; i < commit.parents.length; i++) {
        const parentHash = commit.parents[i];
        let parentColumn = columnMap.get(parentHash);

        if (parentColumn === undefined) {
          if (i === 0) {
            parentColumn = column;
            columnMap.set(parentHash, parentColumn);
            activeColumns[parentColumn] = parentHash;
          } else {
            parentColumn = getNextColumn();
            columnMap.set(parentHash, parentColumn);
            if (parentColumn >= activeColumns.length) {
              activeColumns.push(parentHash);
            } else {
              activeColumns[parentColumn] = parentHash;
            }
          }
        }

        parentConnections.push({ hash: parentHash, column: parentColumn });
      }

      if (commit.parents.length === 0 || !commit.parents.some(p => columnMap.get(p) === column)) {
        releaseColumn(column);
      }

      nodes.push({
        commit,
        column,
        parents: parentConnections,
        color: GRAPH_COLORS[column % GRAPH_COLORS.length]
      });
    }

    return nodes;
  });

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

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      if (diffHours === 0) {
        const diffMins = Math.floor(diffMs / (1000 * 60));
        return `${diffMins}m ago`;
      }
      return `${diffHours}h ago`;
    }
    if (diffDays === 1) return "yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
    return `${Math.floor(diffDays / 365)}y ago`;
  };

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

  const renderRefBadge = (ref: CommitRef) => {
    const getBadgeStyle = () => {
      switch (ref.type) {
        case "head":
          return { background: "var(--accent-primary)", color: "white" };
        case "branch":
          return { background: "rgba(63, 185, 80, 0.2)", color: "var(--cortex-success)" };
        case "remote":
          return { background: "rgba(136, 87, 219, 0.2)", color: "var(--cortex-info)" };
        case "tag":
          return { background: "rgba(240, 136, 62, 0.2)", color: "var(--cortex-warning)" };
        default:
          return { background: "var(--surface-active)", color: "var(--text-weak)" };
      }
    };

    const style = getBadgeStyle();
    const iconName = ref.type === "tag" ? "tag" : ref.type === "branch" || ref.type === "head" ? "code-branch" : null;

    return (
      <span
        class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium whitespace-nowrap"
        style={style}
      >
        {iconName && <Icon name={iconName} class="w-3 h-3" />}
        {ref.name}
      </span>
    );
  };

  const renderGraphColumn = (node: GraphNode, maxCols: number) => {
    const width = Math.max(maxCols, 3) * 20;

    return (
      <svg 
        width={width} 
        height="40" 
        class="shrink-0"
        style={{ "min-width": `${width}px` }}
      >
        {/* Draw connections to parents */}
        <For each={node.parents}>
          {(parent) => {
            const startX = node.column * 20 + 10;
            const endX = parent.column * 20 + 10;
            const startY = 20;
            const endY = 40;

            if (startX === endX) {
              return (
                <line
                  x1={startX}
                  y1={startY}
                  x2={endX}
                  y2={endY}
                  stroke={node.color}
                  stroke-width="2"
                />
              );
            } else {
              const midY = (startY + endY) / 2;
              return (
                <path
                  d={`M ${startX} ${startY} Q ${startX} ${midY} ${(startX + endX) / 2} ${midY} Q ${endX} ${midY} ${endX} ${endY}`}
                  stroke={GRAPH_COLORS[parent.column % GRAPH_COLORS.length]}
                  stroke-width="2"
                  fill="none"
                />
              );
            }
          }}
        </For>

        {/* Draw commit node */}
        {node.commit.isMerge ? (
          <g>
            <circle
              cx={node.column * 20 + 10}
              cy={20}
              r="6"
              fill="var(--background-base)"
              stroke={node.color}
              stroke-width="2"
            />
            <circle
              cx={node.column * 20 + 10}
              cy={20}
              r="3"
              fill={node.color}
            />
          </g>
        ) : (
          <circle
            cx={node.column * 20 + 10}
            cy={20}
            r="5"
            fill={node.color}
          />
        )}
      </svg>
    );
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
      {/* Header */}
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

      {/* Search */}
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

      {/* Graph */}
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
            {/* Use VirtualList for large commit lists, fall back to For for smaller ones */}
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
                      renderGraphColumn={renderGraphColumn}
                      renderRefBadge={renderRefBadge}
                      formatDate={formatDate}
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
                    renderGraphColumn={renderGraphColumn}
                    renderRefBadge={renderRefBadge}
                    formatDate={formatDate}
                  />
                )}
              </VirtualList>
            </Show>
          </div>
        </Show>
      </div>

      {/* Context menu */}
      <Show when={contextMenuPos()}>
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
              onClick={() => copyCommitHash(pos().commit.hash)}
            >
              <Icon name="copy" class="w-4 h-4" />
              Copy SHA
            </button>
            <button
              class="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-white/10"
              style={{ color: "var(--text-base)" }}
              onClick={() => {
                props.onCherryPick?.(pos().commit);
                closeContextMenu();
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
                closeContextMenu();
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
                closeContextMenu();
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
                closeContextMenu();
              }}
            >
              <Icon name="tag" class="w-4 h-4" />
              Create tag here
            </button>
          </div>
        )}
      </Show>
    </div>
  );
}

export default CommitGraph;

