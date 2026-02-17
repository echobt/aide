/**
 * EditorGrid - Main grid component for complex editor layouts.
 */

import {
  createMemo,
  JSX,
  type Component,
} from "solid-js";
import type { EditorGridProps, GridCell, DropPosition } from "./types";
import { DEFAULT_MIN_CELL_SIZE } from "./types";
import { cloneCell, findCell, replaceCell, getLeafCellIds } from "./gridHelpers";
import { GridCellView } from "./GridCellView";

export const EditorGrid: Component<EditorGridProps> = (props) => {
  let containerRef: HTMLDivElement | undefined;
  const minCellSize = () => props.minCellSize ?? DEFAULT_MIN_CELL_SIZE;

  const handleResize = (cellId: string, childIndex: number, delta: number, containerSize: number) => {
    const newState = { ...props.state };
    const root = cloneCell(newState.root);
    const cell = findCell(root, cellId);

    if (!cell || !cell.sizes || !cell.children) return;

    const currentSizes = [...cell.sizes];
    const deltaRatio = delta / containerSize;

    const minRatio = minCellSize() / containerSize;
    const newSize1 = Math.max(minRatio, Math.min(1 - minRatio, currentSizes[childIndex] + deltaRatio));
    const newSize2 = Math.max(minRatio, Math.min(1 - minRatio, currentSizes[childIndex + 1] - deltaRatio));

    if (newSize1 >= minRatio && newSize2 >= minRatio) {
      currentSizes[childIndex] = newSize1;
      currentSizes[childIndex + 1] = newSize2;

      const sum = currentSizes.reduce((a, b) => a + b, 0);
      cell.sizes = currentSizes.map((s) => s / sum);

      newState.root = replaceCell(root, cellId, cell);
      props.onStateChange(newState);
    }
  };

  const handleDoubleClickSash = (cellId: string, _childIndex: number) => {
    const newState = { ...props.state };
    const root = cloneCell(newState.root);
    const cell = findCell(root, cellId);

    if (!cell || !cell.children) return;

    const equalSize = 1 / cell.children.length;
    cell.sizes = cell.children.map(() => equalSize);

    newState.root = replaceCell(root, cellId, cell);
    props.onStateChange(newState);
  };

  const handleCellActivate = (cellId: string) => {
    if (props.state.activeCell !== cellId) {
      props.onStateChange({
        ...props.state,
        activeCell: cellId,
      });
      props.onCellActivate?.(cellId);
    }
  };

  const handleEditorDrop = (cellId: string, fileId: string, position: DropPosition) => {
    if (props.onEditorDrop) {
      props.onEditorDrop(fileId, cellId, position);
    }
  };

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
