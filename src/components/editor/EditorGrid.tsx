/**
 * EditorGrid - SerializableGrid System for Complex Editor Layouts
 * 
 * Supports complex N×M grid layouts for editors (like VS Code's 2x2, 3x1, etc.)
 * Features:
 * 1. Recursive grid rendering (grids within grids)
 * 2. Drag to resize cells (sash between cells)
 * 3. Drop editors into cells or edges to split
 * 4. Double-click sash to equalize sizes
 * 5. Minimum cell size constraints
 * 6. Serialize/deserialize grid state for persistence
 */

import {
  createSignal,
  createMemo,
  For,
  Show,
  JSX,
  type Component,
} from "solid-js";
import { GridSash } from "./GridSash";

// ============================================================================
// Types
// ============================================================================

export interface GridCell {
  /** Unique identifier for this cell */
  id: string;
  /** Type of cell content */
  type: "editor" | "group" | "grid";
  /** For editor type: the file ID being edited */
  fileId?: string;
  /** For grid type: nested children */
  children?: GridCell[];
  /** For grid type: direction of the split */
  direction?: "horizontal" | "vertical";
  /** For grid type: relative sizes of children (ratios that sum to 1) */
  sizes?: number[];
}

export interface EditorGridState {
  /** Root cell of the grid tree */
  root: GridCell;
  /** Currently active cell ID */
  activeCell: string;
}

export interface EditorGridProps {
  /** Current grid state */
  state: EditorGridState;
  /** Callback when state changes */
  onStateChange: (state: EditorGridState) => void;
  /** Render function for editor content */
  renderEditor: (fileId: string, cellId: string) => JSX.Element;
  /** Render function for empty cells */
  renderEmpty?: (cellId: string) => JSX.Element;
  /** Minimum cell size in pixels */
  minCellSize?: number;
  /** Callback when a cell is activated */
  onCellActivate?: (cellId: string) => void;
  /** Callback when an editor is dropped into a cell */
  onEditorDrop?: (fileId: string, targetCellId: string, position: DropPosition) => void;
}

export type DropPosition = "center" | "left" | "right" | "top" | "bottom";

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MIN_CELL_SIZE = 100;
const EDGE_DROP_THRESHOLD = 0.25; // 25% of cell size for edge drops

/**
 * Deep clone a grid cell tree
 */
function cloneCell(cell: GridCell): GridCell {
  return {
    ...cell,
    children: cell.children?.map(cloneCell),
    sizes: cell.sizes ? [...cell.sizes] : undefined,
  };
}

/**
 * Find a cell by ID in the tree
 */
function findCell(root: GridCell, id: string): GridCell | undefined {
  if (root.id === id) return root;
  if (root.children) {
    for (const child of root.children) {
      const found = findCell(child, id);
      if (found) return found;
    }
  }
  return undefined;
}

/**
 * Replace a cell in the tree by ID
 */
function replaceCell(root: GridCell, id: string, newCell: GridCell): GridCell {
  if (root.id === id) return newCell;
  if (root.children) {
    return {
      ...root,
      children: root.children.map((child) => replaceCell(child, id, newCell)),
    };
  }
  return root;
}

/**
 * Get all leaf cell IDs
 */
function getLeafCellIds(root: GridCell): string[] {
  if (root.type === "editor" || root.type === "group") {
    return [root.id];
  }
  if (root.children) {
    return root.children.flatMap(getLeafCellIds);
  }
  return [];
}

// ============================================================================
// Grid Cell Component
// ============================================================================

interface GridCellViewProps {
  cell: GridCell;
  isActive: boolean;
  onActivate: () => void;
  onResize: (index: number, delta: number, containerSize: number) => void;
  onDoubleClickSash: (index: number) => void;
  renderEditor: (fileId: string, cellId: string) => JSX.Element;
  renderEmpty?: (cellId: string) => JSX.Element;
  minCellSize: number;
  depth: number;
  onDrop?: (fileId: string, position: DropPosition) => void;
}

const GridCellView: Component<GridCellViewProps> = (props) => {
  let containerRef: HTMLDivElement | undefined;
  const [isDragOver, setIsDragOver] = createSignal(false);
  const [dropPosition, setDropPosition] = createSignal<DropPosition | null>(null);

  // Calculate sizes as CSS flex values
  const flexSizes = createMemo(() => {
    if (!props.cell.children || !props.cell.sizes) return [];
    return props.cell.sizes.map((size) => `${size * 100}%`);
  });

  const isVertical = () => props.cell.direction === "vertical";

  // Handle drag events for dropping editors
  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (props.cell.type !== "editor" && props.cell.type !== "group") return;
    
    setIsDragOver(true);
    
    const rect = containerRef?.getBoundingClientRect();
    if (!rect) return;
    
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    
    // Determine drop position based on cursor location
    if (x < EDGE_DROP_THRESHOLD) {
      setDropPosition("left");
    } else if (x > 1 - EDGE_DROP_THRESHOLD) {
      setDropPosition("right");
    } else if (y < EDGE_DROP_THRESHOLD) {
      setDropPosition("top");
    } else if (y > 1 - EDGE_DROP_THRESHOLD) {
      setDropPosition("bottom");
    } else {
      setDropPosition("center");
    }
    
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "move";
    }
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    setDropPosition(null);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const fileId = e.dataTransfer?.getData("text/plain");
    const pos = dropPosition();
    
    setIsDragOver(false);
    setDropPosition(null);
    
    if (fileId && pos && props.onDrop) {
      props.onDrop(fileId, pos);
    }
  };

  // Render drop indicator overlay
  const renderDropIndicator = () => {
    const pos = dropPosition();
    if (!isDragOver() || !pos) return null;

    const indicatorStyle: JSX.CSSProperties = {
      position: "absolute",
      background: "var(--accent)",
      opacity: "0.3",
      "pointer-events": "none",
      transition: "all 150ms ease",
      "z-index": "10",
    };

    switch (pos) {
      case "left":
        return <div style={{ ...indicatorStyle, left: "0", top: "0", width: "50%", height: "100%" }} />;
      case "right":
        return <div style={{ ...indicatorStyle, right: "0", top: "0", width: "50%", height: "100%" }} />;
      case "top":
        return <div style={{ ...indicatorStyle, left: "0", top: "0", width: "100%", height: "50%" }} />;
      case "bottom":
        return <div style={{ ...indicatorStyle, left: "0", bottom: "0", width: "100%", height: "50%" }} />;
      case "center":
        return <div style={{ ...indicatorStyle, inset: "8px", "border-radius": "var(--cortex-radius-sm)" }} />;
    }
  };

  // Render leaf cell (editor or group)
  if (props.cell.type === "editor" || props.cell.type === "group") {
    return (
      <div
        ref={containerRef}
        class="grid-cell"
        style={{
          flex: "1",
          display: "flex",
          "flex-direction": "column",
          position: "relative",
          "min-width": `${props.minCellSize}px`,
          "min-height": `${props.minCellSize}px`,
          overflow: "hidden",
          outline: props.isActive ? "2px solid var(--accent)" : "none",
          "outline-offset": "-2px",
        }}
        onClick={(e) => {
          e.stopPropagation();
          props.onActivate();
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        data-cell-id={props.cell.id}
        data-cell-type={props.cell.type}
      >
        <Show
          when={props.cell.fileId}
          fallback={props.renderEmpty?.(props.cell.id) ?? <div class="empty-cell" />}
        >
          {props.renderEditor(props.cell.fileId!, props.cell.id)}
        </Show>
        {renderDropIndicator()}
      </div>
    );
  }

  // Render grid cell with children
  if (props.cell.type === "grid" && props.cell.children) {
    return (
      <div
        ref={containerRef}
        class="grid-container"
        style={{
          flex: "1",
          display: "flex",
          "flex-direction": isVertical() ? "row" : "column",
          position: "relative",
          overflow: "hidden",
          "min-width": `${props.minCellSize}px`,
          "min-height": `${props.minCellSize}px`,
        }}
        data-cell-id={props.cell.id}
        data-cell-type="grid"
        data-direction={props.cell.direction}
      >
        <For each={props.cell.children}>
          {(child, index) => (
            <>
              <div
                style={{
                  flex: `0 0 ${flexSizes()[index()]}`,
                  display: "flex",
                  overflow: "hidden",
                  "min-width": isVertical() ? `${props.minCellSize}px` : undefined,
                  "min-height": !isVertical() ? `${props.minCellSize}px` : undefined,
                }}
              >
                <GridCellView
                  cell={child}
                  isActive={props.isActive}
                  onActivate={props.onActivate}
                  onResize={(i, delta, size) => {
                    // Pass resize up to parent with correct indices
                    props.onResize(i, delta, size);
                  }}
                  onDoubleClickSash={(i) => props.onDoubleClickSash(i)}
                  renderEditor={props.renderEditor}
                  renderEmpty={props.renderEmpty}
                  minCellSize={props.minCellSize}
                  depth={props.depth + 1}
                  onDrop={props.onDrop}
                />
              </div>
              {/* Add sash between children */}
              <Show when={index() < props.cell.children!.length - 1}>
                <GridSash
                  direction={props.cell.direction!}
                  onResize={(delta) => {
                    const containerSize = isVertical()
                      ? containerRef?.clientWidth ?? 0
                      : containerRef?.clientHeight ?? 0;
                    props.onResize(index(), delta, containerSize);
                  }}
                  onDoubleClick={() => props.onDoubleClickSash(index())}
                />
              </Show>
            </>
          )}
        </For>
      </div>
    );
  }

  return null;
};

// ============================================================================
// Main EditorGrid Component
// ============================================================================

export const EditorGrid: Component<EditorGridProps> = (props) => {
  let containerRef: HTMLDivElement | undefined;
  const minCellSize = () => props.minCellSize ?? DEFAULT_MIN_CELL_SIZE;

  // Handle resize between cells
  const handleResize = (cellId: string, childIndex: number, delta: number, containerSize: number) => {
    const newState = { ...props.state };
    const root = cloneCell(newState.root);
    const cell = findCell(root, cellId);

    if (!cell || !cell.sizes || !cell.children) return;

    const currentSizes = [...cell.sizes];
    const deltaRatio = delta / containerSize;

    // Adjust sizes ensuring minimum sizes
    const minRatio = minCellSize() / containerSize;
    const newSize1 = Math.max(minRatio, Math.min(1 - minRatio, currentSizes[childIndex] + deltaRatio));
    const newSize2 = Math.max(minRatio, Math.min(1 - minRatio, currentSizes[childIndex + 1] - deltaRatio));

    // Only apply if both sides maintain minimum
    if (newSize1 >= minRatio && newSize2 >= minRatio) {
      currentSizes[childIndex] = newSize1;
      currentSizes[childIndex + 1] = newSize2;

      // Normalize to ensure sum is 1
      const sum = currentSizes.reduce((a, b) => a + b, 0);
      cell.sizes = currentSizes.map((s) => s / sum);

      newState.root = replaceCell(root, cellId, cell);
      props.onStateChange(newState);
    }
  };

  // Handle double-click to equalize sizes
  const handleDoubleClickSash = (cellId: string, _childIndex: number) => {
    const newState = { ...props.state };
    const root = cloneCell(newState.root);
    const cell = findCell(root, cellId);

    if (!cell || !cell.children) return;

    // Equalize all children sizes
    const equalSize = 1 / cell.children.length;
    cell.sizes = cell.children.map(() => equalSize);

    newState.root = replaceCell(root, cellId, cell);
    props.onStateChange(newState);
  };

  // Handle cell activation
  const handleCellActivate = (cellId: string) => {
    if (props.state.activeCell !== cellId) {
      props.onStateChange({
        ...props.state,
        activeCell: cellId,
      });
      props.onCellActivate?.(cellId);
    }
  };

  // Handle editor drop
  const handleEditorDrop = (cellId: string, fileId: string, position: DropPosition) => {
    if (props.onEditorDrop) {
      props.onEditorDrop(fileId, cellId, position);
    }
  };

  // Recursive render with resize handlers
  const renderCell = (cell: GridCell): JSX.Element => {
    const isActive = createMemo(() => {
      const leafIds = getLeafCellIds(cell);
      return leafIds.includes(props.state.activeCell);
    });

    return (
      <GridCellView
        cell={cell}
        isActive={isActive()}
        onActivate={() => {
          const leafIds = getLeafCellIds(cell);
          if (leafIds.length > 0) {
            handleCellActivate(leafIds[0]);
          }
        }}
        onResize={(index, delta, containerSize) => {
          handleResize(cell.id, index, delta, containerSize);
        }}
        onDoubleClickSash={(index) => handleDoubleClickSash(cell.id, index)}
        renderEditor={props.renderEditor}
        renderEmpty={props.renderEmpty}
        minCellSize={minCellSize()}
        depth={0}
        onDrop={(fileId, position) => {
          const leafIds = getLeafCellIds(cell);
          if (leafIds.length > 0) {
            handleEditorDrop(leafIds[0], fileId, position);
          }
        }}
      />
    );
  };

  return (
    <div
      ref={containerRef}
      class="editor-grid"
      style={{
        flex: "1",
        display: "flex",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {renderCell(props.state.root)}
    </div>
  );
};

// Re-export GridSash for external use
export { GridSash } from "./GridSash";

export default EditorGrid;

