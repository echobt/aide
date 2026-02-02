import {
  createContext,
  useContext,
  ParentProps,
  createMemo,
  Accessor,
  batch,
} from "solid-js";
import { createStore, produce } from "solid-js/store";

// ============================================================================
// Types - Re-exported from centralized types for backward compatibility
// ============================================================================

import type {
  SplitDirection,
  EditorGroup,
  EditorSplit,
  EditorLayout,
} from "../../types";

// Re-export types for backward compatibility with existing imports
export type { SplitDirection, EditorGroup, EditorSplit, EditorLayout };

// ============================================================================
// State
// ============================================================================

interface EditorUIState {
  activeGroupId: string;
  groups: EditorGroup[];
  splits: EditorSplit[];
}

const DEFAULT_GROUP_ID = "group-default";

// ============================================================================
// Context Value
// ============================================================================

export interface EditorUIContextValue {
  // State accessors (granular)
  activeGroupId: Accessor<string>;
  groups: Accessor<EditorGroup[]>;
  splits: Accessor<EditorSplit[]>;
  activeGroup: Accessor<EditorGroup | undefined>;
  groupCount: Accessor<number>;
  isSplit: Accessor<boolean>;

  // Group operations
  setActiveGroup: (groupId: string) => void;
  splitEditor: (direction: SplitDirection, activeFileId: string | null) => string;
  closeGroup: (groupId: string) => void;
  unsplit: () => void;

  // File-to-group operations
  addFileToGroup: (fileId: string, groupId: string) => void;
  removeFileFromGroup: (fileId: string, groupId: string) => void;
  moveFileToGroup: (fileId: string, sourceGroupId: string, targetGroupId: string) => void;
  setGroupActiveFile: (groupId: string, fileId: string | null) => void;
  reorderTabs: (sourceFileId: string, targetFileId: string, groupId: string) => void;
  getGroupFiles: (groupId: string) => string[];
  findGroupContainingFile: (fileId: string) => EditorGroup | undefined;

  // Internal for composition
  _state: EditorUIState;
  _setState: (fn: (state: EditorUIState) => void) => void;
}

// ============================================================================
// Utilities
// ============================================================================

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// Context
// ============================================================================

const EditorUIContext = createContext<EditorUIContextValue>();

export function EditorUIProvider(props: ParentProps) {
  const [state, setState] = createStore<EditorUIState>({
    activeGroupId: DEFAULT_GROUP_ID,
    groups: [
      {
        id: DEFAULT_GROUP_ID,
        fileIds: [],
        activeFileId: null,
        splitRatio: 1,
      },
    ],
    splits: [],
  });

  // Granular selectors
  const activeGroupId = createMemo(() => state.activeGroupId);
  const groups = createMemo(() => state.groups);
  const splits = createMemo(() => state.splits);
  const activeGroup = createMemo(() =>
    state.groups.find((g) => g.id === state.activeGroupId)
  );
  const groupCount = createMemo(() => state.groups.length);
  const isSplit = createMemo(() => state.groups.length > 1);

  const setActiveGroup = (groupId: string) => {
    setState("activeGroupId", groupId);
  };

  const splitEditor = (
    direction: SplitDirection,
    activeFileId: string | null
  ): string => {
    const currentActiveGroup = state.groups.find((g) => g.id === state.activeGroupId);
    if (!currentActiveGroup || currentActiveGroup.fileIds.length === 0) {
      return state.activeGroupId;
    }

    const newGroupId = `group-${generateId()}`;
    const splitId = `split-${generateId()}`;

    const newGroup: EditorGroup = {
      id: newGroupId,
      fileIds: activeFileId ? [activeFileId] : [],
      activeFileId: activeFileId,
      splitRatio: 0.5,
    };

    const newSplit: EditorSplit = {
      id: splitId,
      direction,
      firstGroupId: state.activeGroupId,
      secondGroupId: newGroupId,
      ratio: 0.5,
    };

    batch(() => {
      setState("groups", (groups) => [...groups, newGroup]);
      setState("splits", (splits) => [...splits, newSplit]);
      setState("activeGroupId", newGroupId);
    });

    return newGroupId;
  };

  const closeGroup = (groupId: string) => {
    if (state.groups.length <= 1) return;

    batch(() => {
      // Remove associated split
      const splitIndex = state.splits.findIndex(
        (s) => s.firstGroupId === groupId || s.secondGroupId === groupId
      );
      if (splitIndex !== -1) {
        setState("splits", (splits) => splits.filter((_, i) => i !== splitIndex));
      }

      // Remove group
      setState("groups", (groups) => groups.filter((g) => g.id !== groupId));

      // Update active group if needed
      if (state.activeGroupId === groupId) {
        const remainingGroup = state.groups.find((g) => g.id !== groupId);
        if (remainingGroup) {
          setState("activeGroupId", remainingGroup.id);
        }
      }
    });
  };

  const unsplit = () => {
    if (state.groups.length <= 1) return;

    const defaultGroup = state.groups[0];
    const allFileIds = new Set<string>();

    state.groups.forEach((group) => {
      group.fileIds.forEach((id) => allFileIds.add(id));
    });

    // Find the current active file ID
    const currentActiveGroup = state.groups.find((g) => g.id === state.activeGroupId);
    const preservedActiveFileId = currentActiveGroup?.activeFileId || null;

    batch(() => {
      setState("groups", [
        {
          ...defaultGroup,
          fileIds: Array.from(allFileIds),
          activeFileId: preservedActiveFileId,
        },
      ]);
      setState("splits", []);
      setState("activeGroupId", defaultGroup.id);
    });
  };

  const addFileToGroup = (fileId: string, groupId: string) => {
    setState(
      "groups",
      (g) => g.id === groupId,
      produce((group) => {
        if (!group.fileIds.includes(fileId)) {
          group.fileIds.push(fileId);
        }
        group.activeFileId = fileId;
      })
    );
  };

  const removeFileFromGroup = (fileId: string, groupId: string) => {
    setState(
      "groups",
      (g) => g.id === groupId,
      produce((group) => {
        const fileIdIndex = group.fileIds.indexOf(fileId);
        if (fileIdIndex === -1) return;

        group.fileIds = group.fileIds.filter((id) => id !== fileId);
        if (group.activeFileId === fileId) {
          group.activeFileId = group.fileIds[Math.max(0, fileIdIndex - 1)] || null;
        }
      })
    );
  };

  const moveFileToGroup = (
    fileId: string,
    sourceGroupId: string,
    targetGroupId: string
  ) => {
    if (sourceGroupId === targetGroupId) return;

    batch(() => {
      // Remove from source group
      setState(
        "groups",
        (g) => g.id === sourceGroupId,
        produce((group) => {
          group.fileIds = group.fileIds.filter((id) => id !== fileId);
          if (group.activeFileId === fileId) {
            group.activeFileId = group.fileIds[0] || null;
          }
        })
      );

      // Add to target group
      setState(
        "groups",
        (g) => g.id === targetGroupId,
        produce((group) => {
          group.fileIds.push(fileId);
          group.activeFileId = fileId;
        })
      );

      setState("activeGroupId", targetGroupId);
    });
  };

  const setGroupActiveFile = (groupId: string, fileId: string | null) => {
    setState("groups", (g) => g.id === groupId, "activeFileId", fileId);
  };

  const reorderTabs = (
    sourceFileId: string,
    targetFileId: string,
    groupId: string
  ) => {
    const group = state.groups.find((g) => g.id === groupId);
    if (!group) return;

    const fileIds = [...group.fileIds];
    const sourceIndex = fileIds.indexOf(sourceFileId);
    const targetIndex = fileIds.indexOf(targetFileId);

    if (sourceIndex === -1 || targetIndex === -1) return;
    if (sourceIndex === targetIndex) return;

    fileIds.splice(sourceIndex, 1);
    fileIds.splice(targetIndex, 0, sourceFileId);

    setState("groups", (g) => g.id === groupId, "fileIds", fileIds);
  };

  const getGroupFiles = (groupId: string): string[] => {
    const group = state.groups.find((g) => g.id === groupId);
    return group?.fileIds || [];
  };

  const findGroupContainingFile = (fileId: string): EditorGroup | undefined => {
    return state.groups.find((g) => g.fileIds.includes(fileId));
  };

  // Internal methods for composition
  const _setState = (fn: (state: EditorUIState) => void) => {
    setState(produce(fn));
  };

  const value: EditorUIContextValue = {
    activeGroupId,
    groups,
    splits,
    activeGroup,
    groupCount,
    isSplit,
    setActiveGroup,
    splitEditor,
    closeGroup,
    unsplit,
    addFileToGroup,
    removeFileFromGroup,
    moveFileToGroup,
    setGroupActiveFile,
    reorderTabs,
    getGroupFiles,
    findGroupContainingFile,
    _state: state,
    _setState,
  };

  return (
    <EditorUIContext.Provider value={value}>
      {props.children}
    </EditorUIContext.Provider>
  );
}

export function useEditorUI() {
  const context = useContext(EditorUIContext);
  if (!context) {
    throw new Error("useEditorUI must be used within EditorUIProvider");
  }
  return context;
}
