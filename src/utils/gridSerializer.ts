/**
 * Grid Serializer - Utilities for serializing/deserializing grid layouts
 * 
 * Provides functions to:
 * - Serialize grid state to JSON for localStorage persistence
 * - Deserialize JSON back to grid state
 * - Create common layout presets (single, split, 2x2, etc.)
 * - Validate grid state integrity
 */

import type { GridCell, EditorGridState } from "../components/editor/EditorGrid";

// ============================================================================
// Types
// ============================================================================

export interface SerializedGridState {
  version: number;
  root: GridCell;
  activeCell: string;
  timestamp: number;
}

// ============================================================================
// Constants
// ============================================================================

const CURRENT_VERSION = 1;
const STORAGE_KEY = "orion_editor_grid_state";

// ============================================================================
// ID Generation
// ============================================================================

function generateCellId(): string {
  return `cell-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// Serialization
// ============================================================================

/**
 * Serialize grid state to JSON string for storage
 */
export function serializeGrid(state: EditorGridState): string {
  const serialized: SerializedGridState = {
    version: CURRENT_VERSION,
    root: state.root,
    activeCell: state.activeCell,
    timestamp: Date.now(),
  };
  return JSON.stringify(serialized);
}

/**
 * Deserialize JSON string to grid state
 * Returns null if invalid or incompatible version
 */
export function deserializeGrid(json: string): EditorGridState | null {
  try {
    const parsed = JSON.parse(json) as SerializedGridState;
    
    // Version check
    if (!parsed.version || parsed.version > CURRENT_VERSION) {
      console.warn("[GridSerializer] Incompatible grid state version:", parsed.version);
      return null;
    }
    
    // Validate structure
    if (!validateGridCell(parsed.root)) {
      console.warn("[GridSerializer] Invalid grid cell structure");
      return null;
    }
    
    // Ensure activeCell exists in the grid
    const cellIds = getAllCellIds(parsed.root);
    if (!cellIds.includes(parsed.activeCell)) {
      // Default to first leaf cell
      const leafIds = getLeafCellIds(parsed.root);
      parsed.activeCell = leafIds[0] || parsed.root.id;
    }
    
    return {
      root: parsed.root,
      activeCell: parsed.activeCell,
    };
  } catch (e) {
    console.error("[GridSerializer] Failed to deserialize grid:", e);
    return null;
  }
}

/**
 * Validate grid cell structure recursively
 */
function validateGridCell(cell: unknown): cell is GridCell {
  if (!cell || typeof cell !== "object") return false;
  
  const c = cell as Record<string, unknown>;
  
  // Must have id and type
  if (typeof c.id !== "string" || !c.id) return false;
  if (!["editor", "group", "grid"].includes(c.type as string)) return false;
  
  // Grid type must have children, direction, and sizes
  if (c.type === "grid") {
    if (!Array.isArray(c.children) || c.children.length === 0) return false;
    if (!["horizontal", "vertical"].includes(c.direction as string)) return false;
    if (!Array.isArray(c.sizes) || c.sizes.length !== c.children.length) return false;
    
    // Validate sizes are valid numbers between 0 and 1
    for (const size of c.sizes) {
      if (typeof size !== "number" || size <= 0 || size > 1) return false;
    }
    
    // Validate children recursively
    for (const child of c.children) {
      if (!validateGridCell(child)) return false;
    }
  }
  
  return true;
}

/**
 * Get all cell IDs in the tree
 */
function getAllCellIds(cell: GridCell): string[] {
  const ids = [cell.id];
  if (cell.children) {
    for (const child of cell.children) {
      ids.push(...getAllCellIds(child));
    }
  }
  return ids;
}

/**
 * Get all leaf (editor/group) cell IDs
 */
function getLeafCellIds(cell: GridCell): string[] {
  if (cell.type === "editor" || cell.type === "group") {
    return [cell.id];
  }
  if (cell.children) {
    return cell.children.flatMap(getLeafCellIds);
  }
  return [];
}

// ============================================================================
// Storage Operations
// ============================================================================

/**
 * Save grid state to localStorage
 */
export function saveGridState(state: EditorGridState): void {
  try {
    const json = serializeGrid(state);
    localStorage.setItem(STORAGE_KEY, json);
  } catch (e) {
    console.error("[GridSerializer] Failed to save grid state:", e);
  }
}

/**
 * Load grid state from localStorage
 */
export function loadGridState(): EditorGridState | null {
  try {
    const json = localStorage.getItem(STORAGE_KEY);
    if (!json) return null;
    return deserializeGrid(json);
  } catch (e) {
    console.error("[GridSerializer] Failed to load grid state:", e);
    return null;
  }
}

/**
 * Clear saved grid state
 */
export function clearGridState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error("[GridSerializer] Failed to clear grid state:", e);
  }
}

// ============================================================================
// Layout Factory Functions
// ============================================================================

/**
 * Create a single editor layout
 */
export function createSingleEditorLayout(fileId?: string): EditorGridState {
  const cellId = generateCellId();
  return {
    root: {
      id: cellId,
      type: "editor",
      fileId,
    },
    activeCell: cellId,
  };
}

/**
 * Create a split layout (horizontal or vertical)
 */
export function createSplitLayout(
  direction: "h" | "v",
  fileIds: string[]
): EditorGridState {
  if (fileIds.length === 0) {
    return createSingleEditorLayout();
  }
  
  if (fileIds.length === 1) {
    return createSingleEditorLayout(fileIds[0]);
  }
  
  const children: GridCell[] = fileIds.map((fileId) => ({
    id: generateCellId(),
    type: "editor" as const,
    fileId,
  }));
  
  const equalSize = 1 / children.length;
  const rootId = generateCellId();
  
  return {
    root: {
      id: rootId,
      type: "grid",
      direction: direction === "h" ? "horizontal" : "vertical",
      children,
      sizes: children.map(() => equalSize),
    },
    activeCell: children[0].id,
  };
}

/**
 * Create a 2x2 grid layout
 */
export function create2x2Layout(
  fileIds: [string?, string?, string?, string?]
): EditorGridState {
  const topLeft: GridCell = { id: generateCellId(), type: "editor", fileId: fileIds[0] };
  const topRight: GridCell = { id: generateCellId(), type: "editor", fileId: fileIds[1] };
  const bottomLeft: GridCell = { id: generateCellId(), type: "editor", fileId: fileIds[2] };
  const bottomRight: GridCell = { id: generateCellId(), type: "editor", fileId: fileIds[3] };
  
  const topRow: GridCell = {
    id: generateCellId(),
    type: "grid",
    direction: "vertical",
    children: [topLeft, topRight],
    sizes: [0.5, 0.5],
  };
  
  const bottomRow: GridCell = {
    id: generateCellId(),
    type: "grid",
    direction: "vertical",
    children: [bottomLeft, bottomRight],
    sizes: [0.5, 0.5],
  };
  
  const rootId = generateCellId();
  
  return {
    root: {
      id: rootId,
      type: "grid",
      direction: "horizontal",
      children: [topRow, bottomRow],
      sizes: [0.5, 0.5],
    },
    activeCell: topLeft.id,
  };
}

/**
 * Create a 3-column layout
 */
export function create3ColumnLayout(fileIds: [string?, string?, string?]): EditorGridState {
  const left: GridCell = { id: generateCellId(), type: "editor", fileId: fileIds[0] };
  const center: GridCell = { id: generateCellId(), type: "editor", fileId: fileIds[1] };
  const right: GridCell = { id: generateCellId(), type: "editor", fileId: fileIds[2] };
  
  const rootId = generateCellId();
  
  return {
    root: {
      id: rootId,
      type: "grid",
      direction: "vertical",
      children: [left, center, right],
      sizes: [0.333, 0.334, 0.333],
    },
    activeCell: left.id,
  };
}

/**
 * Create layout with main editor and side panel (e.g., for preview)
 */
export function createMainWithSideLayout(
  mainFileId?: string,
  sideFileId?: string,
  sidePosition: "left" | "right" = "right",
  sideRatio: number = 0.3
): EditorGridState {
  const main: GridCell = { id: generateCellId(), type: "editor", fileId: mainFileId };
  const side: GridCell = { id: generateCellId(), type: "editor", fileId: sideFileId };
  
  const mainRatio = 1 - sideRatio;
  const rootId = generateCellId();
  
  return {
    root: {
      id: rootId,
      type: "grid",
      direction: "vertical",
      children: sidePosition === "left" ? [side, main] : [main, side],
      sizes: sidePosition === "left" ? [sideRatio, mainRatio] : [mainRatio, sideRatio],
    },
    activeCell: main.id,
  };
}

// ============================================================================
// Grid Manipulation Utilities
// ============================================================================

/**
 * Split a cell in the grid
 */
export function splitCell(
  state: EditorGridState,
  cellId: string,
  direction: "horizontal" | "vertical",
  newFileId?: string
): EditorGridState {
  const newState = cloneState(state);
  const cell = findCell(newState.root, cellId);
  
  if (!cell) return state;
  
  // Create the new cell
  const newCell: GridCell = {
    id: generateCellId(),
    type: "editor",
    fileId: newFileId,
  };
  
  // If this is a leaf cell, wrap it in a grid with the new cell
  if (cell.type === "editor" || cell.type === "group") {
    const originalCell: GridCell = {
      id: generateCellId(),
      type: cell.type,
      fileId: cell.fileId,
    };
    
    // Transform the current cell into a grid
    cell.type = "grid";
    cell.direction = direction;
    cell.children = [originalCell, newCell];
    cell.sizes = [0.5, 0.5];
    delete cell.fileId;
    
    newState.activeCell = newCell.id;
  }
  
  return newState;
}

/**
 * Close a cell in the grid
 */
export function closeCell(state: EditorGridState, cellId: string): EditorGridState {
  const newState = cloneState(state);
  
  // Cannot close the root cell if it's the only one
  if (newState.root.id === cellId) {
    if (newState.root.type === "editor" || newState.root.type === "group") {
      // Reset to empty single cell
      return createSingleEditorLayout();
    }
  }
  
  const newRoot = removeCellFromTree(newState.root, cellId);
  if (!newRoot) {
    return createSingleEditorLayout();
  }
  
  newState.root = newRoot;
  
  // Update active cell if needed
  const leafIds = getLeafCellIds(newState.root);
  if (!leafIds.includes(newState.activeCell)) {
    newState.activeCell = leafIds[0] || newState.root.id;
  }
  
  return newState;
}

/**
 * Move editor to another cell
 */
export function moveEditorToCell(
  state: EditorGridState,
  fileId: string,
  targetCellId: string
): EditorGridState {
  const newState = cloneState(state);
  const targetCell = findCell(newState.root, targetCellId);
  
  if (!targetCell || (targetCell.type !== "editor" && targetCell.type !== "group")) {
    return state;
  }
  
  // Find and clear the source cell
  clearFileIdFromTree(newState.root, fileId);
  
  // Set the file in the target cell
  targetCell.fileId = fileId;
  newState.activeCell = targetCellId;
  
  return newState;
}

// ============================================================================
// Internal Helpers
// ============================================================================

function cloneState(state: EditorGridState): EditorGridState {
  return {
    root: cloneCell(state.root),
    activeCell: state.activeCell,
  };
}

function cloneCell(cell: GridCell): GridCell {
  return {
    ...cell,
    children: cell.children?.map(cloneCell),
    sizes: cell.sizes ? [...cell.sizes] : undefined,
  };
}

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

function removeCellFromTree(root: GridCell, id: string): GridCell | null {
  if (root.id === id) return null;
  
  if (root.children) {
    const newChildren: GridCell[] = [];
    const newSizes: number[] = [];
    let removedSize = 0;
    
    root.children.forEach((child, index) => {
      if (child.id === id) {
        removedSize = root.sizes?.[index] ?? 1 / root.children!.length;
      } else {
        const processed = removeCellFromTree(child, id);
        if (processed) {
          newChildren.push(processed);
          newSizes.push(root.sizes?.[index] ?? 1 / root.children!.length);
        }
      }
    });
    
    if (newChildren.length === 0) return null;
    if (newChildren.length === 1) return newChildren[0];
    
    // Redistribute removed size
    const totalRemaining = newSizes.reduce((a, b) => a + b, 0);
    const redistributedSizes = newSizes.map(
      (s) => (s / totalRemaining) * (totalRemaining + removedSize)
    );
    
    // Normalize
    const sum = redistributedSizes.reduce((a, b) => a + b, 0);
    const normalizedSizes = redistributedSizes.map((s) => s / sum);
    
    return {
      ...root,
      children: newChildren,
      sizes: normalizedSizes,
    };
  }
  
  return root;
}

function clearFileIdFromTree(root: GridCell, fileId: string): void {
  if (root.fileId === fileId) {
    delete root.fileId;
  }
  if (root.children) {
    root.children.forEach((child) => clearFileIdFromTree(child, fileId));
  }
}

// ============================================================================
// Export Additional Types
// ============================================================================

export type { GridCell, EditorGridState } from "../components/editor/EditorGrid";
