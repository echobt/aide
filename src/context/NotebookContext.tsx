import { createContext, useContext, ParentComponent, onMount, onCleanup, batch } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { getWsUrl } from "../utils/config";

// ============================================================================
// Types - Jupyter .ipynb format compatible
// ============================================================================

export type CellType = "code" | "markdown" | "raw";
export type KernelStatus = "idle" | "busy" | "disconnected" | "starting" | "restarting" | "error";
export type KernelLanguage = "python" | "javascript" | "typescript";
export type OutputType = "stream" | "execute_result" | "display_data" | "error";
export type StreamName = "stdout" | "stderr";

export interface NotebookMetadata {
  kernelspec?: {
    name: string;
    display_name: string;
    language: string;
  };
  language_info?: {
    name: string;
    version?: string;
    mimetype?: string;
    file_extension?: string;
  };
  title?: string;
  authors?: string[];
  created?: string;
  modified?: string;
}

export interface CellMetadata {
  collapsed?: boolean;
  scrolled?: boolean | "auto";
  tags?: string[];
  trusted?: boolean;
  editable?: boolean;
  deletable?: boolean;
  name?: string;
}

export interface StreamOutput {
  output_type: "stream";
  name: StreamName;
  text: string;
}

export interface ExecuteResultOutput {
  output_type: "execute_result";
  execution_count: number;
  data: Record<string, string>;
  metadata?: Record<string, unknown>;
}

export interface DisplayDataOutput {
  output_type: "display_data";
  data: Record<string, string>;
  metadata?: Record<string, unknown>;
}

export interface ErrorOutput {
  output_type: "error";
  ename: string;
  evalue: string;
  traceback: string[];
}

export type CellOutput = StreamOutput | ExecuteResultOutput | DisplayDataOutput | ErrorOutput;

export interface NotebookCell {
  id: string;
  cell_type: CellType;
  source: string;
  metadata: CellMetadata;
  outputs: CellOutput[];
  execution_count: number | null;
}

export interface JupyterNotebook {
  metadata: NotebookMetadata;
  nbformat: number;
  nbformat_minor: number;
  cells: NotebookCell[];
}

export interface NotebookData {
  path: string;
  name: string;
  notebook: JupyterNotebook;
  modified: boolean;
  kernelId: string | null;
  lastSaved: number | null;
}

export interface ExecutionQueueItem {
  notebookPath: string;
  cellId: string;
  status: "pending" | "executing";
  queuedAt: number;
}

export interface KernelInfo {
  id: string;
  language: KernelLanguage;
  status: KernelStatus;
  executionCount: number;
  displayName: string;
}

interface KernelEvent {
  event: "status" | "output" | "result" | "error" | "interrupt";
  data: {
    kernel_id: string;
    cell_id?: string;
    notebook_path?: string;
    status?: KernelStatus;
    output?: CellOutput;
    execution_count?: number;
    error?: string;
  };
}

// ============================================================================
// State Interface
// ============================================================================

interface NotebookState {
  notebooks: Map<string, NotebookData>;
  activeNotebookPath: string | null;
  activeCellId: string | null;
  kernels: Map<string, KernelInfo>;
  executionQueue: ExecutionQueueItem[];
  isLoading: boolean;
  error: string | null;
}

// ============================================================================
// Context Value Interface
// ============================================================================

interface NotebookContextValue {
  state: NotebookState;
  
  // Notebook file operations
  openNotebook: (path: string) => Promise<void>;
  saveNotebook: (path?: string) => Promise<void>;
  closeNotebook: (path: string) => void;
  createNotebook: (path: string, language?: KernelLanguage) => Promise<void>;
  
  // Cell management
  addCell: (type: CellType, afterIndex?: number) => void;
  deleteCell: (index: number) => void;
  moveCell: (fromIndex: number, toIndex: number) => void;
  updateCellSource: (cellId: string, source: string) => void;
  changeCellType: (index: number, type: CellType) => void;
  duplicateCell: (index: number) => void;
  mergeCells: (startIndex: number, endIndex: number) => void;
  splitCell: (index: number, splitPosition: number) => void;
  
  // Cell selection
  setActiveNotebook: (path: string | null) => void;
  setActiveCell: (cellId: string | null) => void;
  selectNextCell: () => void;
  selectPreviousCell: () => void;
  
  // Execution
  executeCell: (index: number) => Promise<void>;
  executeAllCells: () => Promise<void>;
  executeCellsAbove: (index: number) => Promise<void>;
  executeCellsBelow: (index: number) => Promise<void>;
  
  // Kernel management
  startKernel: (language: KernelLanguage) => Promise<KernelInfo>;
  interruptKernel: () => Promise<void>;
  restartKernel: (executeAll?: boolean) => Promise<void>;
  changeKernel: (language: KernelLanguage) => Promise<void>;
  getKernelStatus: () => KernelStatus;
  
  // Output management
  clearOutputs: () => void;
  clearCellOutput: (cellId: string) => void;
  
  // Utilities
  getActiveNotebook: () => NotebookData | null;
  getActiveCell: () => NotebookCell | null;
  getCellByIndex: (index: number) => NotebookCell | null;
  getCellIndex: (cellId: string) => number;
  isExecuting: () => boolean;
  exportToScript: () => string;
}

// ============================================================================
// Context Creation
// ============================================================================

const NotebookContext = createContext<NotebookContextValue>();

// ============================================================================
// Utility Functions
// ============================================================================

function generateCellId(): string {
  return `cell-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

function generateKernelId(): string {
  return `kernel-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function createEmptyCell(type: CellType): NotebookCell {
  return {
    id: generateCellId(),
    cell_type: type,
    source: "",
    metadata: {},
    outputs: [],
    execution_count: null,
  };
}

function createDefaultNotebook(language: KernelLanguage = "python"): JupyterNotebook {
  const languageInfo = {
    python: { name: "python", file_extension: ".py", mimetype: "text/x-python" },
    javascript: { name: "javascript", file_extension: ".js", mimetype: "text/javascript" },
    typescript: { name: "typescript", file_extension: ".ts", mimetype: "text/typescript" },
  };

  return {
    metadata: {
      kernelspec: {
        name: language,
        display_name: language.charAt(0).toUpperCase() + language.slice(1),
        language,
      },
      language_info: languageInfo[language],
      created: new Date().toISOString(),
    },
    nbformat: 4,
    nbformat_minor: 5,
    cells: [createEmptyCell("code")],
  };
}

function parseNotebookFile(content: string): JupyterNotebook {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    throw new Error(`Invalid notebook JSON: ${e instanceof Error ? e.message : String(e)}`);
  }
  
  if (typeof parsed.nbformat !== "number" || parsed.nbformat < 4) {
    throw new Error("Unsupported notebook format. Only nbformat 4+ is supported.");
  }

  const cells: NotebookCell[] = (parsed.cells || []).map((cell: Record<string, unknown>, index: number) => {
    const source = Array.isArray(cell.source) 
      ? (cell.source as string[]).join("") 
      : (cell.source as string) || "";
    
    const outputs: CellOutput[] = Array.isArray(cell.outputs) 
      ? (cell.outputs as Record<string, unknown>[]).map(normalizeOutput)
      : [];

    return {
      id: (cell.id as string) || `cell-${Date.now()}-${index}`,
      cell_type: (cell.cell_type as CellType) || "code",
      source,
      metadata: (cell.metadata as CellMetadata) || {},
      outputs,
      execution_count: (cell.execution_count as number | null) ?? null,
    };
  });

  return {
    metadata: (parsed.metadata as NotebookMetadata) || {},
    nbformat: parsed.nbformat,
    nbformat_minor: parsed.nbformat_minor || 0,
    cells,
  };
}

function normalizeOutput(output: Record<string, unknown>): CellOutput {
  const outputType = output.output_type as string;
  
  switch (outputType) {
    case "stream":
      return {
        output_type: "stream",
        name: (output.name as StreamName) || "stdout",
        text: Array.isArray(output.text) 
          ? (output.text as string[]).join("") 
          : (output.text as string) || "",
      };
    case "execute_result":
      return {
        output_type: "execute_result",
        execution_count: (output.execution_count as number) || 0,
        data: normalizeOutputData(output.data as Record<string, unknown>),
        metadata: output.metadata as Record<string, unknown>,
      };
    case "display_data":
      return {
        output_type: "display_data",
        data: normalizeOutputData(output.data as Record<string, unknown>),
        metadata: output.metadata as Record<string, unknown>,
      };
    case "error":
      return {
        output_type: "error",
        ename: (output.ename as string) || "Error",
        evalue: (output.evalue as string) || "",
        traceback: (output.traceback as string[]) || [],
      };
    default:
      return {
        output_type: "stream",
        name: "stdout",
        text: JSON.stringify(output),
      };
  }
}

function normalizeOutputData(data: Record<string, unknown> | undefined): Record<string, string> {
  if (!data) return {};
  
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    normalized[key] = Array.isArray(value) ? value.join("") : String(value);
  }
  return normalized;
}

function serializeNotebook(notebook: JupyterNotebook): string {
  const serialized = {
    metadata: notebook.metadata,
    nbformat: notebook.nbformat,
    nbformat_minor: notebook.nbformat_minor,
    cells: notebook.cells.map((cell) => ({
      id: cell.id,
      cell_type: cell.cell_type,
      source: cell.source.split("\n").map((line, i, arr) => 
        i < arr.length - 1 ? line + "\n" : line
      ),
      metadata: cell.metadata,
      ...(cell.cell_type === "code" ? {
        outputs: cell.outputs,
        execution_count: cell.execution_count,
      } : {}),
    })),
  };
  
  return JSON.stringify(serialized, null, 1);
}

function getNotebookNameFromPath(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] || "Untitled.ipynb";
}

// ============================================================================
// Provider Component
// ============================================================================

export const NotebookProvider: ParentComponent = (props) => {
  const [state, setState] = createStore<NotebookState>({
    notebooks: new Map(),
    activeNotebookPath: null,
    activeCellId: null,
    kernels: new Map(),
    executionQueue: [],
    isLoading: false,
    error: null,
  });

  let eventUnlisten: UnlistenFn | null = null;
  let wsConnection: WebSocket | null = null;

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleKernelEvent = (event: KernelEvent) => {
    const { data } = event;
    
    switch (event.event) {
      case "status": {
        if (data.kernel_id && data.status) {
          setState(produce((s) => {
            const kernel = s.kernels.get(data.kernel_id!);
            if (kernel) {
              kernel.status = data.status!;
              s.kernels.set(data.kernel_id!, kernel);
            }
          }));
        }
        break;
      }
      
      case "output": {
        if (data.notebook_path && data.cell_id && data.output) {
          setState(produce((s) => {
            const notebookData = s.notebooks.get(data.notebook_path!);
            if (notebookData) {
              const cellIndex = notebookData.notebook.cells.findIndex(
                (c) => c.id === data.cell_id
              );
              if (cellIndex !== -1) {
                notebookData.notebook.cells[cellIndex].outputs.push(data.output!);
                notebookData.modified = true;
                s.notebooks.set(data.notebook_path!, notebookData);
              }
            }
          }));
        }
        break;
      }
      
      case "result": {
        if (data.notebook_path && data.cell_id) {
          setState(produce((s) => {
            const notebookData = s.notebooks.get(data.notebook_path!);
            if (notebookData) {
              const cellIndex = notebookData.notebook.cells.findIndex(
                (c) => c.id === data.cell_id
              );
              if (cellIndex !== -1) {
                notebookData.notebook.cells[cellIndex].execution_count = 
                  data.execution_count ?? null;
                notebookData.modified = true;
                s.notebooks.set(data.notebook_path!, notebookData);
              }
            }
            
            // Remove from execution queue
            s.executionQueue = s.executionQueue.filter(
              (item) => !(item.notebookPath === data.notebook_path && 
                         item.cellId === data.cell_id)
            );
            
            // Update kernel status
            const activeNotebook = s.notebooks.get(s.activeNotebookPath || "");
            if (activeNotebook?.kernelId) {
              const kernel = s.kernels.get(activeNotebook.kernelId);
              if (kernel && s.executionQueue.length === 0) {
                kernel.status = "idle";
                if (data.execution_count !== undefined) {
                  kernel.executionCount = data.execution_count;
                }
                s.kernels.set(activeNotebook.kernelId, kernel);
              }
            }
          }));
        }
        break;
      }
      
      case "error": {
        setState("error", data.error || "Unknown kernel error");
        
        if (data.notebook_path && data.cell_id) {
          setState(produce((s) => {
            const notebookData = s.notebooks.get(data.notebook_path!);
            if (notebookData) {
              const cellIndex = notebookData.notebook.cells.findIndex(
                (c) => c.id === data.cell_id
              );
              if (cellIndex !== -1) {
                notebookData.notebook.cells[cellIndex].outputs.push({
                  output_type: "error",
                  ename: "ExecutionError",
                  evalue: data.error || "Unknown error",
                  traceback: [],
                });
                notebookData.modified = true;
                s.notebooks.set(data.notebook_path!, notebookData);
              }
            }
            
            // Remove from execution queue
            s.executionQueue = s.executionQueue.filter(
              (item) => !(item.notebookPath === data.notebook_path && 
                         item.cellId === data.cell_id)
            );
          }));
        }
        break;
      }
      
      case "interrupt": {
        setState(produce((s) => {
          // Clear execution queue for the interrupted kernel
          if (data.kernel_id) {
            const notebookPath = Array.from(s.notebooks.entries())
              .find(([_, nb]) => nb.kernelId === data.kernel_id)?.[0];
            
            if (notebookPath) {
              s.executionQueue = s.executionQueue.filter(
                (item) => item.notebookPath !== notebookPath
              );
            }
            
            const kernel = s.kernels.get(data.kernel_id);
            if (kernel) {
              kernel.status = "idle";
              s.kernels.set(data.kernel_id, kernel);
            }
          }
        }));
        break;
      }
    }
  };

  const setupWebSocketConnection = (kernelId: string): Promise<WebSocket> => {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(getWsUrl(`/kernel/${kernelId}/ws`));
      
      ws.onopen = () => {
        wsConnection = ws;
        resolve(ws);
      };
      
      ws.onmessage = (event) => {
        try {
          const kernelEvent: KernelEvent = JSON.parse(event.data);
          handleKernelEvent(kernelEvent);
        } catch (e) {
          console.error("[Notebook] Failed to parse WebSocket message:", e);
        }
      };
      
      ws.onerror = (error) => {
        console.error("[Notebook] WebSocket error:", error);
        reject(error);
      };
      
      ws.onclose = () => {
        wsConnection = null;
        setState(produce((s) => {
          const kernel = s.kernels.get(kernelId);
          if (kernel) {
            kernel.status = "disconnected";
            s.kernels.set(kernelId, kernel);
          }
        }));
      };
    });
  };

  // ============================================================================
  // Lifecycle
  // ============================================================================

  onMount(async () => {
    try {
      eventUnlisten = await listen<KernelEvent>("notebook:kernel_event", (e) => {
        handleKernelEvent(e.payload);
      });
    } catch (e) {
      console.warn("[Notebook] Tauri event listener not available:", e);
    }

    onCleanup(() => {
      if (eventUnlisten) {
        eventUnlisten();
      }
      if (wsConnection) {
        wsConnection.close();
      }
    });
  });

  // ============================================================================
  // Notebook File Operations
  // ============================================================================

  const openNotebook = async (path: string): Promise<void> => {
    const existingNotebook = state.notebooks.get(path);
    if (existingNotebook) {
      batch(() => {
        setState("activeNotebookPath", path);
        const firstCellId = existingNotebook.notebook.cells[0]?.id || null;
        setState("activeCellId", firstCellId);
      });
      return;
    }

    setState("isLoading", true);
    setState("error", null);

    try {
      const content = await invoke<string>("fs_read_file", { path });
      const notebook = parseNotebookFile(content);
      
      const notebookData: NotebookData = {
        path,
        name: getNotebookNameFromPath(path),
        notebook,
        modified: false,
        kernelId: null,
        lastSaved: Date.now(),
      };

      batch(() => {
        setState(produce((s) => {
          s.notebooks.set(path, notebookData);
        }));
        setState("activeNotebookPath", path);
        setState("activeCellId", notebook.cells[0]?.id || null);
        setState("isLoading", false);
      });
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      setState("error", `Failed to open notebook: ${errorMessage}`);
      setState("isLoading", false);
      throw e;
    }
  };

  const saveNotebook = async (path?: string): Promise<void> => {
    const targetPath = path || state.activeNotebookPath;
    if (!targetPath) {
      throw new Error("No notebook to save");
    }

    const notebookData = state.notebooks.get(targetPath);
    if (!notebookData) {
      throw new Error("Notebook not found");
    }

    setState("isLoading", true);
    setState("error", null);

    try {
      const content = serializeNotebook(notebookData.notebook);
      
      await invoke("fs_write_file", { 
        path: targetPath, 
        content 
      });

      setState(produce((s) => {
        const nb = s.notebooks.get(targetPath);
        if (nb) {
          nb.modified = false;
          nb.lastSaved = Date.now();
          nb.notebook.metadata.modified = new Date().toISOString();
          s.notebooks.set(targetPath, nb);
        }
      }));
      setState("isLoading", false);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      setState("error", `Failed to save notebook: ${errorMessage}`);
      setState("isLoading", false);
      throw e;
    }
  };

  const closeNotebook = (path: string): void => {
    setState(produce((s) => {
      const notebookData = s.notebooks.get(path);
      if (notebookData?.kernelId) {
        s.kernels.delete(notebookData.kernelId);
      }
      s.notebooks.delete(path);
      
      if (s.activeNotebookPath === path) {
        const remainingPaths = Array.from(s.notebooks.keys());
        s.activeNotebookPath = remainingPaths[0] || null;
        
        if (s.activeNotebookPath) {
          const activeNb = s.notebooks.get(s.activeNotebookPath);
          s.activeCellId = activeNb?.notebook.cells[0]?.id || null;
        } else {
          s.activeCellId = null;
        }
      }
      
      s.executionQueue = s.executionQueue.filter(
        (item) => item.notebookPath !== path
      );
    }));
  };

  const createNotebook = async (path: string, language: KernelLanguage = "python"): Promise<void> => {
    const notebook = createDefaultNotebook(language);
    
    const notebookData: NotebookData = {
      path,
      name: getNotebookNameFromPath(path),
      notebook,
      modified: true,
      kernelId: null,
      lastSaved: null,
    };

    batch(() => {
      setState(produce((s) => {
        s.notebooks.set(path, notebookData);
      }));
      setState("activeNotebookPath", path);
      setState("activeCellId", notebook.cells[0]?.id || null);
    });

    await saveNotebook(path);
  };

  // ============================================================================
  // Cell Management
  // ============================================================================

  const addCell = (type: CellType, afterIndex?: number): void => {
    const notebookPath = state.activeNotebookPath;
    if (!notebookPath) return;

    const newCell = createEmptyCell(type);

    setState(produce((s) => {
      const notebookData = s.notebooks.get(notebookPath);
      if (!notebookData) return;

      const cells = notebookData.notebook.cells;
      const insertIndex = afterIndex !== undefined 
        ? Math.min(afterIndex + 1, cells.length)
        : cells.length;

      cells.splice(insertIndex, 0, newCell);
      notebookData.modified = true;
      s.notebooks.set(notebookPath, notebookData);
      s.activeCellId = newCell.id;
    }));
  };

  const deleteCell = (index: number): void => {
    const notebookPath = state.activeNotebookPath;
    if (!notebookPath) return;

    setState(produce((s) => {
      const notebookData = s.notebooks.get(notebookPath);
      if (!notebookData) return;

      const cells = notebookData.notebook.cells;
      if (cells.length <= 1) {
        cells[0] = createEmptyCell(cells[0].cell_type);
        s.activeCellId = cells[0].id;
      } else if (index >= 0 && index < cells.length) {
        const deletedCellId = cells[index].id;
        cells.splice(index, 1);
        
        if (s.activeCellId === deletedCellId) {
          const newIndex = Math.min(index, cells.length - 1);
          s.activeCellId = cells[newIndex]?.id || null;
        }
      }
      
      notebookData.modified = true;
      s.notebooks.set(notebookPath, notebookData);
    }));
  };

  const moveCell = (fromIndex: number, toIndex: number): void => {
    const notebookPath = state.activeNotebookPath;
    if (!notebookPath || fromIndex === toIndex) return;

    setState(produce((s) => {
      const notebookData = s.notebooks.get(notebookPath);
      if (!notebookData) return;

      const cells = notebookData.notebook.cells;
      if (fromIndex < 0 || fromIndex >= cells.length ||
          toIndex < 0 || toIndex >= cells.length) {
        return;
      }

      const [movedCell] = cells.splice(fromIndex, 1);
      cells.splice(toIndex, 0, movedCell);
      notebookData.modified = true;
      s.notebooks.set(notebookPath, notebookData);
    }));
  };

  const updateCellSource = (cellId: string, source: string): void => {
    const notebookPath = state.activeNotebookPath;
    if (!notebookPath) return;

    setState(produce((s) => {
      const notebookData = s.notebooks.get(notebookPath);
      if (!notebookData) return;

      const cell = notebookData.notebook.cells.find((c) => c.id === cellId);
      if (cell) {
        cell.source = source;
        notebookData.modified = true;
        s.notebooks.set(notebookPath, notebookData);
      }
    }));
  };

  const changeCellType = (index: number, type: CellType): void => {
    const notebookPath = state.activeNotebookPath;
    if (!notebookPath) return;

    setState(produce((s) => {
      const notebookData = s.notebooks.get(notebookPath);
      if (!notebookData) return;

      const cells = notebookData.notebook.cells;
      if (index >= 0 && index < cells.length) {
        const cell = cells[index];
        const previousType = cell.cell_type;
        cell.cell_type = type;
        
        if (type !== "code" && previousType === "code") {
          cell.outputs = [];
          cell.execution_count = null;
        }
        
        notebookData.modified = true;
        s.notebooks.set(notebookPath, notebookData);
      }
    }));
  };

  const duplicateCell = (index: number): void => {
    const notebookPath = state.activeNotebookPath;
    if (!notebookPath) return;

    setState(produce((s) => {
      const notebookData = s.notebooks.get(notebookPath);
      if (!notebookData) return;

      const cells = notebookData.notebook.cells;
      if (index >= 0 && index < cells.length) {
        const originalCell = cells[index];
        const duplicatedCell: NotebookCell = {
          ...originalCell,
          id: generateCellId(),
          outputs: [],
          execution_count: null,
        };
        
        cells.splice(index + 1, 0, duplicatedCell);
        notebookData.modified = true;
        s.notebooks.set(notebookPath, notebookData);
        s.activeCellId = duplicatedCell.id;
      }
    }));
  };

  const mergeCells = (startIndex: number, endIndex: number): void => {
    const notebookPath = state.activeNotebookPath;
    if (!notebookPath || startIndex >= endIndex) return;

    setState(produce((s) => {
      const notebookData = s.notebooks.get(notebookPath);
      if (!notebookData) return;

      const cells = notebookData.notebook.cells;
      if (startIndex < 0 || endIndex >= cells.length) return;

      const mergedSource = cells
        .slice(startIndex, endIndex + 1)
        .map((c) => c.source)
        .join("\n\n");

      const mergedCell: NotebookCell = {
        id: generateCellId(),
        cell_type: cells[startIndex].cell_type,
        source: mergedSource,
        metadata: { ...cells[startIndex].metadata },
        outputs: [],
        execution_count: null,
      };

      cells.splice(startIndex, endIndex - startIndex + 1, mergedCell);
      notebookData.modified = true;
      s.notebooks.set(notebookPath, notebookData);
      s.activeCellId = mergedCell.id;
    }));
  };

  const splitCell = (index: number, splitPosition: number): void => {
    const notebookPath = state.activeNotebookPath;
    if (!notebookPath) return;

    setState(produce((s) => {
      const notebookData = s.notebooks.get(notebookPath);
      if (!notebookData) return;

      const cells = notebookData.notebook.cells;
      if (index < 0 || index >= cells.length) return;

      const originalCell = cells[index];
      const source = originalCell.source;
      
      if (splitPosition <= 0 || splitPosition >= source.length) return;

      const firstPart = source.substring(0, splitPosition);
      const secondPart = source.substring(splitPosition);

      const newCell: NotebookCell = {
        id: generateCellId(),
        cell_type: originalCell.cell_type,
        source: secondPart.trimStart(),
        metadata: {},
        outputs: [],
        execution_count: null,
      };

      originalCell.source = firstPart.trimEnd();
      originalCell.outputs = [];
      originalCell.execution_count = null;

      cells.splice(index + 1, 0, newCell);
      notebookData.modified = true;
      s.notebooks.set(notebookPath, notebookData);
      s.activeCellId = newCell.id;
    }));
  };

  // ============================================================================
  // Cell Selection
  // ============================================================================

  const setActiveNotebook = (path: string | null): void => {
    if (path === state.activeNotebookPath) return;
    
    batch(() => {
      setState("activeNotebookPath", path);
      
      if (path) {
        const notebookData = state.notebooks.get(path);
        const firstCellId = notebookData?.notebook.cells[0]?.id || null;
        setState("activeCellId", firstCellId);
      } else {
        setState("activeCellId", null);
      }
    });
  };

  const setActiveCell = (cellId: string | null): void => {
    setState("activeCellId", cellId);
  };

  const selectNextCell = (): void => {
    const notebookPath = state.activeNotebookPath;
    if (!notebookPath) return;

    const notebookData = state.notebooks.get(notebookPath);
    if (!notebookData) return;

    const cells = notebookData.notebook.cells;
    const currentIndex = cells.findIndex((c) => c.id === state.activeCellId);
    
    if (currentIndex < cells.length - 1) {
      setState("activeCellId", cells[currentIndex + 1].id);
    }
  };

  const selectPreviousCell = (): void => {
    const notebookPath = state.activeNotebookPath;
    if (!notebookPath) return;

    const notebookData = state.notebooks.get(notebookPath);
    if (!notebookData) return;

    const cells = notebookData.notebook.cells;
    const currentIndex = cells.findIndex((c) => c.id === state.activeCellId);
    
    if (currentIndex > 0) {
      setState("activeCellId", cells[currentIndex - 1].id);
    }
  };

  // ============================================================================
  // Execution
  // ============================================================================

  const executeCell = async (index: number): Promise<void> => {
    const notebookPath = state.activeNotebookPath;
    if (!notebookPath) {
      throw new Error("No active notebook");
    }

    const notebookData = state.notebooks.get(notebookPath);
    if (!notebookData) {
      throw new Error("Notebook not found");
    }

    const cells = notebookData.notebook.cells;
    if (index < 0 || index >= cells.length) {
      throw new Error("Invalid cell index");
    }

    const cell = cells[index];
    if (cell.cell_type !== "code") {
      return;
    }

    if (!notebookData.kernelId) {
      const language = notebookData.notebook.metadata.kernelspec?.language as KernelLanguage || "python";
      await startKernel(language);
    }

    const kernelId = state.notebooks.get(notebookPath)?.kernelId;
    if (!kernelId) {
      throw new Error("Failed to start kernel");
    }

    setState(produce((s) => {
      const nb = s.notebooks.get(notebookPath);
      if (nb) {
        const c = nb.notebook.cells[index];
        c.outputs = [];
        s.notebooks.set(notebookPath, nb);
      }
      
      s.executionQueue.push({
        notebookPath,
        cellId: cell.id,
        status: "executing",
        queuedAt: Date.now(),
      });
      
      const kernel = s.kernels.get(kernelId);
      if (kernel) {
        kernel.status = "busy";
        s.kernels.set(kernelId, kernel);
      }
    }));

    try {
      await invoke("notebook_execute_cell", {
        kernelId,
        cellId: cell.id,
        code: cell.source,
        notebookPath,
      });
    } catch (e) {
      setState(produce((s) => {
        s.executionQueue = s.executionQueue.filter(
          (item) => !(item.notebookPath === notebookPath && item.cellId === cell.id)
        );
        
        const nb = s.notebooks.get(notebookPath);
        if (nb) {
          const c = nb.notebook.cells[index];
          c.outputs.push({
            output_type: "error",
            ename: "ExecutionError",
            evalue: e instanceof Error ? e.message : String(e),
            traceback: [],
          });
          s.notebooks.set(notebookPath, nb);
        }
        
        const kernel = s.kernels.get(kernelId);
        if (kernel) {
          kernel.status = "idle";
          s.kernels.set(kernelId, kernel);
        }
      }));
      throw e;
    }
  };

  const executeAllCells = async (): Promise<void> => {
    const notebookPath = state.activeNotebookPath;
    if (!notebookPath) return;

    const notebookData = state.notebooks.get(notebookPath);
    if (!notebookData) return;

    const cells = notebookData.notebook.cells;
    for (let i = 0; i < cells.length; i++) {
      if (cells[i].cell_type === "code") {
        await executeCell(i);
      }
    }
  };

  const executeCellsAbove = async (index: number): Promise<void> => {
    const notebookPath = state.activeNotebookPath;
    if (!notebookPath) return;

    const notebookData = state.notebooks.get(notebookPath);
    if (!notebookData) return;

    const cells = notebookData.notebook.cells;
    for (let i = 0; i < index && i < cells.length; i++) {
      if (cells[i].cell_type === "code") {
        await executeCell(i);
      }
    }
  };

  const executeCellsBelow = async (index: number): Promise<void> => {
    const notebookPath = state.activeNotebookPath;
    if (!notebookPath) return;

    const notebookData = state.notebooks.get(notebookPath);
    if (!notebookData) return;

    const cells = notebookData.notebook.cells;
    for (let i = index; i < cells.length; i++) {
      if (cells[i].cell_type === "code") {
        await executeCell(i);
      }
    }
  };

  // ============================================================================
  // Kernel Management
  // ============================================================================

  const startKernel = async (language: KernelLanguage): Promise<KernelInfo> => {
    const notebookPath = state.activeNotebookPath;
    if (!notebookPath) {
      throw new Error("No active notebook");
    }

    setState("isLoading", true);
    setState("error", null);

    try {
      const kernelId = generateKernelId();
      
      const result = await invoke<{ id: string; language: string; display_name: string }>(
        "notebook_start_kernel",
        { kernelId, language, notebookPath }
      );

      const kernelInfo: KernelInfo = {
        id: result.id || kernelId,
        language: result.language as KernelLanguage || language,
        status: "idle",
        executionCount: 0,
        displayName: result.display_name || `${language} kernel`,
      };

      try {
        await setupWebSocketConnection(kernelInfo.id);
      } catch (wsError) {
        console.warn("[Notebook] WebSocket connection failed, using Tauri events:", wsError);
      }

      setState(produce((s) => {
        s.kernels.set(kernelInfo.id, kernelInfo);
        
        const nb = s.notebooks.get(notebookPath);
        if (nb) {
          nb.kernelId = kernelInfo.id;
          s.notebooks.set(notebookPath, nb);
        }
      }));
      setState("isLoading", false);

      return kernelInfo;
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      setState("error", `Failed to start kernel: ${errorMessage}`);
      setState("isLoading", false);
      throw e;
    }
  };

  const interruptKernel = async (): Promise<void> => {
    const notebookPath = state.activeNotebookPath;
    if (!notebookPath) return;

    const notebookData = state.notebooks.get(notebookPath);
    if (!notebookData?.kernelId) return;

    try {
      await invoke("notebook_interrupt_kernel", { 
        kernelId: notebookData.kernelId 
      });

      setState(produce((s) => {
        s.executionQueue = s.executionQueue.filter(
          (item) => item.notebookPath !== notebookPath
        );
        
        const kernel = s.kernels.get(notebookData.kernelId!);
        if (kernel) {
          kernel.status = "idle";
          s.kernels.set(notebookData.kernelId!, kernel);
        }
      }));
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      setState("error", `Failed to interrupt kernel: ${errorMessage}`);
      throw e;
    }
  };

  const restartKernel = async (executeAll = false): Promise<void> => {
    const notebookPath = state.activeNotebookPath;
    if (!notebookPath) return;

    const notebookData = state.notebooks.get(notebookPath);
    if (!notebookData) return;

    const language = notebookData.notebook.metadata.kernelspec?.language as KernelLanguage || "python";

    if (notebookData.kernelId) {
      setState(produce((s) => {
        const kernel = s.kernels.get(notebookData.kernelId!);
        if (kernel) {
          kernel.status = "restarting";
          s.kernels.set(notebookData.kernelId!, kernel);
        }
      }));

      try {
        await invoke("notebook_shutdown_kernel", { 
          kernelId: notebookData.kernelId 
        });
      } catch (e) {
        console.warn("[Notebook] Failed to shutdown kernel:", e);
      }

      if (wsConnection) {
        wsConnection.close();
        wsConnection = null;
      }

      setState(produce((s) => {
        s.kernels.delete(notebookData.kernelId!);
        
        const nb = s.notebooks.get(notebookPath);
        if (nb) {
          nb.kernelId = null;
          nb.notebook.cells.forEach((cell) => {
            cell.outputs = [];
            cell.execution_count = null;
          });
          s.notebooks.set(notebookPath, nb);
        }
        
        s.executionQueue = s.executionQueue.filter(
          (item) => item.notebookPath !== notebookPath
        );
      }));
    }

    await startKernel(language);

    if (executeAll) {
      await executeAllCells();
    }
  };

  const changeKernel = async (language: KernelLanguage): Promise<void> => {
    const notebookPath = state.activeNotebookPath;
    if (!notebookPath) return;

    const notebookData = state.notebooks.get(notebookPath);
    if (!notebookData) return;

    if (notebookData.kernelId) {
      try {
        await invoke("notebook_shutdown_kernel", { 
          kernelId: notebookData.kernelId 
        });
      } catch (e) {
        console.warn("[Notebook] Failed to shutdown kernel:", e);
      }

      setState(produce((s) => {
        s.kernels.delete(notebookData.kernelId!);
        
        const nb = s.notebooks.get(notebookPath);
        if (nb) {
          nb.kernelId = null;
          s.notebooks.set(notebookPath, nb);
        }
      }));
    }

    setState(produce((s) => {
      const nb = s.notebooks.get(notebookPath);
      if (nb) {
        nb.notebook.metadata.kernelspec = {
          name: language,
          display_name: language.charAt(0).toUpperCase() + language.slice(1),
          language,
        };
        nb.modified = true;
        s.notebooks.set(notebookPath, nb);
      }
    }));

    await startKernel(language);
  };

  const getKernelStatus = (): KernelStatus => {
    const notebookPath = state.activeNotebookPath;
    if (!notebookPath) return "disconnected";

    const notebookData = state.notebooks.get(notebookPath);
    if (!notebookData?.kernelId) return "disconnected";

    const kernel = state.kernels.get(notebookData.kernelId);
    return kernel?.status || "disconnected";
  };

  // ============================================================================
  // Output Management
  // ============================================================================

  const clearOutputs = (): void => {
    const notebookPath = state.activeNotebookPath;
    if (!notebookPath) return;

    setState(produce((s) => {
      const notebookData = s.notebooks.get(notebookPath);
      if (!notebookData) return;

      notebookData.notebook.cells.forEach((cell) => {
        if (cell.cell_type === "code") {
          cell.outputs = [];
          cell.execution_count = null;
        }
      });
      
      notebookData.modified = true;
      s.notebooks.set(notebookPath, notebookData);
    }));
  };

  const clearCellOutput = (cellId: string): void => {
    const notebookPath = state.activeNotebookPath;
    if (!notebookPath) return;

    setState(produce((s) => {
      const notebookData = s.notebooks.get(notebookPath);
      if (!notebookData) return;

      const cell = notebookData.notebook.cells.find((c) => c.id === cellId);
      if (cell && cell.cell_type === "code") {
        cell.outputs = [];
        cell.execution_count = null;
        notebookData.modified = true;
        s.notebooks.set(notebookPath, notebookData);
      }
    }));
  };

  // ============================================================================
  // Utilities
  // ============================================================================

  const getActiveNotebook = (): NotebookData | null => {
    if (!state.activeNotebookPath) return null;
    return state.notebooks.get(state.activeNotebookPath) || null;
  };

  const getActiveCell = (): NotebookCell | null => {
    const notebookData = getActiveNotebook();
    if (!notebookData || !state.activeCellId) return null;
    return notebookData.notebook.cells.find((c) => c.id === state.activeCellId) || null;
  };

  const getCellByIndex = (index: number): NotebookCell | null => {
    const notebookData = getActiveNotebook();
    if (!notebookData) return null;
    return notebookData.notebook.cells[index] || null;
  };

  const getCellIndex = (cellId: string): number => {
    const notebookData = getActiveNotebook();
    if (!notebookData) return -1;
    return notebookData.notebook.cells.findIndex((c) => c.id === cellId);
  };

  const isExecuting = (): boolean => {
    return state.executionQueue.length > 0;
  };

  const exportToScript = (): string => {
    const notebookData = getActiveNotebook();
    if (!notebookData) return "";

    const lines: string[] = [];
    const language = notebookData.notebook.metadata.kernelspec?.language || "python";
    
    lines.push(`# Exported from ${notebookData.name}`);
    lines.push(`# Language: ${language}`);
    lines.push("");

    notebookData.notebook.cells.forEach((cell, index) => {
      if (cell.cell_type === "code") {
        lines.push(`# Cell ${index + 1}`);
        lines.push(cell.source);
        lines.push("");
      } else if (cell.cell_type === "markdown") {
        const commentPrefix = language === "python" ? "#" : "//";
        cell.source.split("\n").forEach((line) => {
          lines.push(`${commentPrefix} ${line}`);
        });
        lines.push("");
      }
    });

    return lines.join("\n");
  };

  // ============================================================================
  // Context Value
  // ============================================================================

  const contextValue: NotebookContextValue = {
    state,
    
    openNotebook,
    saveNotebook,
    closeNotebook,
    createNotebook,
    
    addCell,
    deleteCell,
    moveCell,
    updateCellSource,
    changeCellType,
    duplicateCell,
    mergeCells,
    splitCell,
    
    setActiveNotebook,
    setActiveCell,
    selectNextCell,
    selectPreviousCell,
    
    executeCell,
    executeAllCells,
    executeCellsAbove,
    executeCellsBelow,
    
    startKernel,
    interruptKernel,
    restartKernel,
    changeKernel,
    getKernelStatus,
    
    clearOutputs,
    clearCellOutput,
    
    getActiveNotebook,
    getActiveCell,
    getCellByIndex,
    getCellIndex,
    isExecuting,
    exportToScript,
  };

  return (
    <NotebookContext.Provider value={contextValue}>
      {props.children}
    </NotebookContext.Provider>
  );
};

// ============================================================================
// Hook
// ============================================================================

export function useNotebook(): NotebookContextValue {
  const context = useContext(NotebookContext);
  if (!context) {
    throw new Error("useNotebook must be used within NotebookProvider");
  }
  return context;
}
