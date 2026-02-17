import type { Commit, GraphNode } from "./CommitGraph";
import { GRAPH_COLORS } from "./GraphSvgRenderer";

export function computeGraphNodes(commits: Commit[]): GraphNode[] {
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

  for (const commit of commits) {
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
}

export function formatRelativeDate(dateStr: string): string {
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
}
