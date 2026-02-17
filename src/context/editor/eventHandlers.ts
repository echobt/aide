import { onMount, onCleanup } from "solid-js";
import type { SplitDirection } from "../../types";
import type { EditorState } from "./editorTypes";

interface EventOperations {
  splitEditorInGrid: (direction: "horizontal" | "vertical") => void;
  splitEditor: (direction: SplitDirection) => void;
  setActiveFile: (fileId: string) => void;
}

export function setupEventHandlers(
  state: EditorState,
  operations: EventOperations,
) {
  onMount(() => {
    const handleSplitRight = () => {
      if (state.useGridLayout) {
        operations.splitEditorInGrid("vertical");
      } else {
        operations.splitEditor("vertical");
      }
    };

    const handleSplitDown = () => {
      if (state.useGridLayout) {
        operations.splitEditorInGrid("horizontal");
      } else {
        operations.splitEditor("horizontal");
      }
    };

    const handleEditorSplit = (e: CustomEvent<{ direction: "vertical" | "horizontal" }>) => {
      if (state.useGridLayout) {
        operations.splitEditorInGrid(e.detail.direction);
      } else {
        operations.splitEditor(e.detail.direction);
      }
    };

    const handleNextTab = () => {
      const files = state.openFiles;
      if (files.length < 2) return;
      const currentIndex = files.findIndex(f => f.id === state.activeFileId);
      const nextIndex = (currentIndex + 1) % files.length;
      operations.setActiveFile(files[nextIndex].id);
    };

    const handlePrevTab = () => {
      const files = state.openFiles;
      if (files.length < 2) return;
      const currentIndex = files.findIndex(f => f.id === state.activeFileId);
      const prevIndex = currentIndex <= 0 ? files.length - 1 : currentIndex - 1;
      operations.setActiveFile(files[prevIndex].id);
    };

    const handleGetSelectionForTerminal = () => {
      window.dispatchEvent(new CustomEvent("monaco:get-selection-for-terminal"));
    };

    const handleGetActiveFileForTerminal = () => {
      const activeFile = state.openFiles.find(f => f.id === state.activeFileId);
      if (activeFile && activeFile.path && !activeFile.path.startsWith("virtual://")) {
        window.dispatchEvent(new CustomEvent("editor:active-file-for-terminal", {
          detail: { filePath: activeFile.path }
        }));
      } else {
        window.dispatchEvent(new CustomEvent("notification", {
          detail: {
            type: "warning",
            title: "No file to run",
            message: "Please open a file first to run it in the terminal.",
          }
        }));
      }
    };

    const handleTerminalRunActiveFile = () => {
      const activeFile = state.openFiles.find(f => f.id === state.activeFileId);
      if (activeFile && activeFile.path && !activeFile.path.startsWith("virtual://")) {
        window.dispatchEvent(new CustomEvent("terminal:run-active-file", {
          detail: { filePath: activeFile.path }
        }));
      } else {
        window.dispatchEvent(new CustomEvent("notification", {
          detail: {
            type: "warning",
            title: "No file to run",
            message: "Please open a file first to run it in the terminal.",
          }
        }));
      }
    };

    window.addEventListener("editor-split", handleEditorSplit as EventListener);
    window.addEventListener("editor:split-right", handleSplitRight);
    window.addEventListener("editor:split-down", handleSplitDown);
    window.addEventListener("editor:next-tab", handleNextTab);
    window.addEventListener("editor:prev-tab", handlePrevTab);
    window.addEventListener("editor:get-selection-for-terminal", handleGetSelectionForTerminal);
    window.addEventListener("editor:get-active-file-for-terminal", handleGetActiveFileForTerminal);
    window.addEventListener("terminal:run-active-file", handleTerminalRunActiveFile);

    onCleanup(() => {
      window.removeEventListener("editor-split", handleEditorSplit as EventListener);
      window.removeEventListener("editor:split-right", handleSplitRight);
      window.removeEventListener("editor:split-down", handleSplitDown);
      window.removeEventListener("editor:next-tab", handleNextTab);
      window.removeEventListener("editor:prev-tab", handlePrevTab);
      window.removeEventListener("editor:get-selection-for-terminal", handleGetSelectionForTerminal);
      window.removeEventListener("editor:get-active-file-for-terminal", handleGetActiveFileForTerminal);
      window.removeEventListener("terminal:run-active-file", handleTerminalRunActiveFile);
    });
  });
}
