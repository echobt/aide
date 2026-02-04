/**
 * Notebooks API for Cortex IDE Extensions
 *
 * Provides the cortex.notebooks namespace for extensions to work with
 * notebook documents, cells, and editors, similar to VS Code's notebooks API.
 */

import {
  Disposable,
  DisposableStore,
  EventEmitter,
  Event,
  createDisposable,
  Uri,
  CancellationToken,
} from "../types";

import type { ExtensionApiBridge } from "../ExtensionAPI";

// ============================================================================
// Notebook Types
// ============================================================================

/**
 * The type of a notebook cell.
 */
export enum NotebookCellKind {
  /**
   * A markup cell (markdown).
   */
  Markup = 1,

  /**
   * A code cell.
   */
  Code = 2,
}

/**
 * The execution state of a notebook cell.
 */
export enum NotebookCellExecutionState {
  /**
   * The cell is idle.
   */
  Idle = 1,

  /**
   * The cell is pending execution.
   */
  Pending = 2,

  /**
   * The cell is currently executing.
   */
  Executing = 3,
}

/**
 * The output of a notebook cell.
 */
export interface NotebookCellOutput {
  /**
   * The output items.
   */
  readonly items: readonly NotebookCellOutputItem[];

  /**
   * Optional metadata for this output.
   */
  readonly metadata?: Record<string, unknown>;
}

/**
 * A single output item in a notebook cell output.
 */
export interface NotebookCellOutputItem {
  /**
   * The mime type of this output item.
   */
  readonly mime: string;

  /**
   * The data of this output item.
   */
  readonly data: Uint8Array;
}

/**
 * Represents the data of a notebook cell.
 */
export interface NotebookCellData {
  /**
   * The kind of cell (code or markup).
   */
  kind: NotebookCellKind;

  /**
   * The source value of the cell.
   */
  value: string;

  /**
   * The language identifier of the cell.
   */
  languageId: string;

  /**
   * The outputs of the cell.
   */
  outputs?: NotebookCellOutput[];

  /**
   * The metadata of the cell.
   */
  metadata?: Record<string, unknown>;

  /**
   * The execution summary of the cell.
   */
  executionSummary?: NotebookCellExecutionSummary;
}

/**
 * Execution summary of a notebook cell.
 */
export interface NotebookCellExecutionSummary {
  /**
   * The execution order.
   */
  executionOrder?: number;

  /**
   * Whether the execution was successful.
   */
  success?: boolean;

  /**
   * The timing of the execution.
   */
  timing?: {
    startTime: number;
    endTime: number;
  };
}

/**
 * A notebook cell in a notebook document.
 */
export interface NotebookCell {
  /**
   * The index of the cell in the notebook.
   */
  readonly index: number;

  /**
   * The containing notebook document.
   */
  readonly notebook: NotebookDocument;

  /**
   * The kind of cell.
   */
  readonly kind: NotebookCellKind;

  /**
   * The URI of the cell's text document.
   */
  readonly document: { uri: Uri; getText(): string; languageId: string };

  /**
   * The metadata of the cell.
   */
  readonly metadata: Record<string, unknown>;

  /**
   * The outputs of the cell.
   */
  readonly outputs: readonly NotebookCellOutput[];

  /**
   * The execution summary of the cell.
   */
  readonly executionSummary: NotebookCellExecutionSummary | undefined;
}

/**
 * A notebook document.
 */
export interface NotebookDocument {
  /**
   * The URI of this notebook document.
   */
  readonly uri: Uri;

  /**
   * The type of this notebook.
   */
  readonly notebookType: string;

  /**
   * The version number of this notebook document.
   */
  readonly version: number;

  /**
   * Whether this notebook document has been closed.
   */
  readonly isClosed: boolean;

  /**
   * Whether this notebook document has been modified.
   */
  readonly isDirty: boolean;

  /**
   * The cells of this notebook.
   */
  readonly cellCount: number;

  /**
   * Get the cell at the given index.
   */
  cellAt(index: number): NotebookCell;

  /**
   * Get cells in the given range.
   */
  getCells(range?: NotebookRange): NotebookCell[];

  /**
   * The metadata for this notebook.
   */
  readonly metadata: Record<string, unknown>;

  /**
   * Save this notebook document.
   */
  save(): Promise<boolean>;
}

/**
 * A range of notebook cells.
 */
export interface NotebookRange {
  /**
   * The start index (inclusive).
   */
  readonly start: number;

  /**
   * The end index (exclusive).
   */
  readonly end: number;

  /**
   * Whether this range is empty.
   */
  readonly isEmpty: boolean;
}

/**
 * Create a notebook range.
 */
export function createNotebookRange(start: number, end: number): NotebookRange {
  return {
    start,
    end,
    isEmpty: start >= end,
  };
}

/**
 * The data for a notebook document.
 */
export interface NotebookData {
  /**
   * The cells of the notebook.
   */
  cells: NotebookCellData[];

  /**
   * The metadata of the notebook.
   */
  metadata?: Record<string, unknown>;
}

/**
 * Notebook editor.
 */
export interface NotebookEditor {
  /**
   * The notebook document associated with this editor.
   */
  readonly notebook: NotebookDocument;

  /**
   * The current selected cell ranges.
   */
  selections: readonly NotebookRange[];

  /**
   * The current visible ranges.
   */
  readonly visibleRanges: readonly NotebookRange[];

  /**
   * The view column of this editor.
   */
  readonly viewColumn: number | undefined;

  /**
   * Reveal a cell in this editor.
   */
  revealRange(range: NotebookRange, revealType?: NotebookEditorRevealType): void;
}

/**
 * Reveal type for notebook editor.
 */
export enum NotebookEditorRevealType {
  /**
   * Default reveal type.
   */
  Default = 0,

  /**
   * Reveal at the center of the viewport.
   */
  InCenter = 1,

  /**
   * Reveal in center if outside viewport.
   */
  InCenterIfOutsideViewport = 2,

  /**
   * Reveal at the top of the viewport.
   */
  AtTop = 3,
}

/**
 * Notebook serializer for opening and saving notebooks.
 */
export interface NotebookSerializer {
  /**
   * Deserialize contents into notebook data.
   */
  deserializeNotebook(
    content: Uint8Array,
    token: CancellationToken
  ): NotebookData | Promise<NotebookData>;

  /**
   * Serialize notebook data into contents.
   */
  serializeNotebook(
    data: NotebookData,
    token: CancellationToken
  ): Uint8Array | Promise<Uint8Array>;
}

/**
 * Options for notebook serializer registration.
 */
export interface NotebookDocumentContentOptions {
  /**
   * Whether to include outputs when saving.
   */
  transientOutputs?: boolean;

  /**
   * Cell metadata keys that are transient.
   */
  transientCellMetadata?: Record<string, boolean>;

  /**
   * Document metadata keys that are transient.
   */
  transientDocumentMetadata?: Record<string, boolean>;
}

/**
 * Notebook controller.
 */
export interface NotebookController {
  /**
   * The unique identifier of this controller.
   */
  readonly id: string;

  /**
   * The notebook type this controller is associated with.
   */
  readonly notebookType: string;

  /**
   * The supported languages for this controller.
   */
  supportedLanguages?: string[];

  /**
   * Human-readable label for this controller.
   */
  label: string;

  /**
   * Optional description.
   */
  description?: string;

  /**
   * Optional detail.
   */
  detail?: string;

  /**
   * Whether this controller supports execution order.
   */
  supportsExecutionOrder?: boolean;

  /**
   * The execute handler for this controller.
   */
  executeHandler: (
    cells: NotebookCell[],
    notebook: NotebookDocument,
    controller: NotebookController
  ) => void | Promise<void>;

  /**
   * Optional interrupt handler.
   */
  interruptHandler?: (notebook: NotebookDocument) => void | Promise<void>;

  /**
   * Create a cell execution.
   */
  createNotebookCellExecution(cell: NotebookCell): NotebookCellExecution;

  /**
   * Dispose this controller.
   */
  dispose(): void;
}

/**
 * Notebook cell execution.
 */
export interface NotebookCellExecution {
  /**
   * The cell being executed.
   */
  readonly cell: NotebookCell;

  /**
   * The execution token.
   */
  readonly token: CancellationToken;

  /**
   * The execution order.
   */
  executionOrder: number | undefined;

  /**
   * Start the execution.
   */
  start(startTime?: number): void;

  /**
   * End the execution.
   */
  end(success: boolean | undefined, endTime?: number): void;

  /**
   * Clear the outputs.
   */
  clearOutput(cell?: NotebookCell): Promise<void>;

  /**
   * Replace the outputs.
   */
  replaceOutput(
    out: NotebookCellOutput | readonly NotebookCellOutput[],
    cell?: NotebookCell
  ): Promise<void>;

  /**
   * Append outputs.
   */
  appendOutput(
    out: NotebookCellOutput | readonly NotebookCellOutput[],
    cell?: NotebookCell
  ): Promise<void>;

  /**
   * Replace output items.
   */
  replaceOutputItems(
    items: NotebookCellOutputItem | readonly NotebookCellOutputItem[],
    output: NotebookCellOutput
  ): Promise<void>;

  /**
   * Append output items.
   */
  appendOutputItems(
    items: NotebookCellOutputItem | readonly NotebookCellOutputItem[],
    output: NotebookCellOutput
  ): Promise<void>;
}

/**
 * Event for notebook document changes.
 */
export interface NotebookDocumentChangeEvent {
  /**
   * The notebook document that changed.
   */
  readonly notebook: NotebookDocument;

  /**
   * Metadata changes.
   */
  readonly metadata?: Record<string, unknown>;

  /**
   * Content changes (cells added, removed, or changed).
   */
  readonly contentChanges: readonly NotebookDocumentContentChange[];

  /**
   * Cell changes.
   */
  readonly cellChanges: readonly NotebookDocumentCellChange[];
}

/**
 * A content change in a notebook document.
 */
export interface NotebookDocumentContentChange {
  /**
   * The range of cells that were replaced.
   */
  readonly range: NotebookRange;

  /**
   * The cells that were added.
   */
  readonly addedCells: readonly NotebookCell[];

  /**
   * The cells that were removed.
   */
  readonly removedCells: readonly NotebookCell[];
}

/**
 * A cell change in a notebook document.
 */
export interface NotebookDocumentCellChange {
  /**
   * The cell that changed.
   */
  readonly cell: NotebookCell;

  /**
   * The document changes for this cell.
   */
  readonly document?: { uri: Uri };

  /**
   * The metadata changes for this cell.
   */
  readonly metadata?: Record<string, unknown>;

  /**
   * The output changes for this cell.
   */
  readonly outputs?: readonly NotebookCellOutput[];

  /**
   * The execution summary changes for this cell.
   */
  readonly executionSummary?: NotebookCellExecutionSummary;
}

// ============================================================================
// Notebooks API
// ============================================================================

/**
 * The notebooks API exposed to extensions.
 */
export interface NotebooksApi {
  /**
   * All notebook documents currently open.
   */
  readonly notebookDocuments: readonly NotebookDocument[];

  /**
   * Event fired when a notebook document is opened.
   */
  readonly onDidOpenNotebookDocument: Event<NotebookDocument>;

  /**
   * Event fired when a notebook document is closed.
   */
  readonly onDidCloseNotebookDocument: Event<NotebookDocument>;

  /**
   * Event fired when a notebook document changes.
   */
  readonly onDidChangeNotebookDocument: Event<NotebookDocumentChangeEvent>;

  /**
   * Event fired when a notebook document is saved.
   */
  readonly onDidSaveNotebookDocument: Event<NotebookDocument>;

  /**
   * Register a notebook serializer.
   */
  registerNotebookSerializer(
    notebookType: string,
    serializer: NotebookSerializer,
    options?: NotebookDocumentContentOptions
  ): Disposable;

  /**
   * Create a notebook controller.
   */
  createNotebookController(
    id: string,
    notebookType: string,
    label: string,
    handler?: (
      cells: NotebookCell[],
      notebook: NotebookDocument,
      controller: NotebookController
    ) => void | Promise<void>
  ): NotebookController;

  /**
   * Open a notebook document.
   */
  openNotebookDocument(uri: Uri): Promise<NotebookDocument>;

  /**
   * Open a notebook document by type.
   */
  openNotebookDocument(
    notebookType: string,
    content?: NotebookData
  ): Promise<NotebookDocument>;

  /**
   * Create a new notebook document with the specified cells and type.
   * This is a convenience method that creates a new untitled notebook.
   */
  createNotebookDocument(
    cells: NotebookCellData[],
    notebookType?: string
  ): Promise<NotebookDocument>;

  /**
   * Register a notebook controller for executing notebook cells.
   * This is an alias for createNotebookController for VS Code API compatibility.
   */
  registerNotebookController(
    id: string,
    notebookType: string,
    label: string,
    handler?: (
      cells: NotebookCell[],
      notebook: NotebookDocument,
      controller: NotebookController
    ) => void | Promise<void>
  ): NotebookController;
}

/**
 * Create the notebooks API.
 */
export function createNotebooksApi(
  extensionId: string,
  bridge: ExtensionApiBridge,
  disposables: DisposableStore
): NotebooksApi {
  const notebooks: NotebookDocument[] = [];
  const controllers = new Map<string, NotebookController>();
  const serializers = new Map<string, NotebookSerializer>();

  const onDidOpenNotebookDocumentEmitter = new EventEmitter<NotebookDocument>();
  const onDidCloseNotebookDocumentEmitter = new EventEmitter<NotebookDocument>();
  const onDidChangeNotebookDocumentEmitter = new EventEmitter<NotebookDocumentChangeEvent>();
  const onDidSaveNotebookDocumentEmitter = new EventEmitter<NotebookDocument>();

  disposables.add(onDidOpenNotebookDocumentEmitter);
  disposables.add(onDidCloseNotebookDocumentEmitter);
  disposables.add(onDidChangeNotebookDocumentEmitter);
  disposables.add(onDidSaveNotebookDocumentEmitter);

  // Subscribe to notebook events from main thread
  disposables.add(
    bridge.subscribeEvent("notebooks.documentOpened", (data) => {
      const doc = data as NotebookDocument;
      notebooks.push(doc);
      onDidOpenNotebookDocumentEmitter.fire(doc);
    })
  );

  disposables.add(
    bridge.subscribeEvent("notebooks.documentClosed", (data) => {
      const { uri } = data as { uri: string };
      const index = notebooks.findIndex((n) => n.uri.toString() === uri);
      if (index >= 0) {
        const [doc] = notebooks.splice(index, 1);
        onDidCloseNotebookDocumentEmitter.fire(doc);
      }
    })
  );

  disposables.add(
    bridge.subscribeEvent("notebooks.documentChanged", (data) => {
      onDidChangeNotebookDocumentEmitter.fire(data as NotebookDocumentChangeEvent);
    })
  );

  disposables.add(
    bridge.subscribeEvent("notebooks.documentSaved", (data) => {
      const doc = data as NotebookDocument;
      onDidSaveNotebookDocumentEmitter.fire(doc);
    })
  );

  return {
    get notebookDocuments(): readonly NotebookDocument[] {
      return notebooks;
    },

    onDidOpenNotebookDocument: onDidOpenNotebookDocumentEmitter.event,
    onDidCloseNotebookDocument: onDidCloseNotebookDocumentEmitter.event,
    onDidChangeNotebookDocument: onDidChangeNotebookDocumentEmitter.event,
    onDidSaveNotebookDocument: onDidSaveNotebookDocumentEmitter.event,

    registerNotebookSerializer(
      notebookType: string,
      serializer: NotebookSerializer,
      options?: NotebookDocumentContentOptions
    ): Disposable {
      const serializerId = `${extensionId}.notebookSerializer.${notebookType}`;

      serializers.set(serializerId, serializer);

      bridge.callMainThread(extensionId, "notebooks", "registerSerializer", [
        serializerId,
        notebookType,
        options,
      ]);

      // Handle deserialize requests
      const deserializeSub = bridge.subscribeEvent(
        `notebooks.${serializerId}.deserialize`,
        async (data) => {
          const { requestId, content, token } = data as {
            requestId: string;
            content: Uint8Array;
            token: CancellationToken;
          };
          try {
            const notebookData = await serializer.deserializeNotebook(content, token);
            bridge.callMainThread(extensionId, "notebooks", "deserializeResponse", [
              requestId,
              notebookData,
            ]);
          } catch (error) {
            bridge.callMainThread(extensionId, "notebooks", "deserializeResponse", [
              requestId,
              null,
              String(error),
            ]);
          }
        }
      );

      // Handle serialize requests
      const serializeSub = bridge.subscribeEvent(
        `notebooks.${serializerId}.serialize`,
        async (data) => {
          const { requestId, notebookData, token } = data as {
            requestId: string;
            notebookData: NotebookData;
            token: CancellationToken;
          };
          try {
            const content = await serializer.serializeNotebook(notebookData, token);
            bridge.callMainThread(extensionId, "notebooks", "serializeResponse", [
              requestId,
              Array.from(content),
            ]);
          } catch (error) {
            bridge.callMainThread(extensionId, "notebooks", "serializeResponse", [
              requestId,
              null,
              String(error),
            ]);
          }
        }
      );

      const disposable = createDisposable(() => {
        deserializeSub.dispose();
        serializeSub.dispose();
        serializers.delete(serializerId);
        bridge.callMainThread(extensionId, "notebooks", "unregisterSerializer", [serializerId]);
      });

      disposables.add(disposable);
      return disposable;
    },

    createNotebookController(
      id: string,
      notebookType: string,
      label: string,
      handler?: (
        cells: NotebookCell[],
        notebook: NotebookDocument,
        controller: NotebookController
      ) => void | Promise<void>
    ): NotebookController {
      const controllerId = `${extensionId}.notebookController.${id}`;

      bridge.callMainThread(extensionId, "notebooks", "createController", [
        controllerId,
        id,
        notebookType,
        label,
      ]);

      let executeHandler = handler || (() => {});

      // Handle execution requests
      const executeSub = bridge.subscribeEvent(
        `notebooks.${controllerId}.execute`,
        async (data) => {
          const { requestId, cells, notebook } = data as {
            requestId: string;
            cells: NotebookCell[];
            notebook: NotebookDocument;
          };
          try {
            await executeHandler(cells, notebook, controller);
            bridge.callMainThread(extensionId, "notebooks", "executeResponse", [
              requestId,
              true,
            ]);
          } catch (error) {
            bridge.callMainThread(extensionId, "notebooks", "executeResponse", [
              requestId,
              false,
              String(error),
            ]);
          }
        }
      );

      const controller: NotebookController = {
        id,
        notebookType,
        supportedLanguages: undefined,
        label,
        description: undefined,
        detail: undefined,
        supportsExecutionOrder: false,

        get executeHandler() {
          return executeHandler;
        },

        set executeHandler(value) {
          executeHandler = value;
        },

        interruptHandler: undefined,

        createNotebookCellExecution(cell: NotebookCell): NotebookCellExecution {
          const executionId = `${controllerId}.execution.${crypto.randomUUID()}`;

          bridge.callMainThread(extensionId, "notebooks", "createCellExecution", [
            executionId,
            controllerId,
            cell.index,
          ]);

          return {
            cell,
            token: {
              isCancellationRequested: false,
              onCancellationRequested: new EventEmitter<void>().event,
            },
            executionOrder: undefined,

            start(startTime?: number) {
              bridge.callMainThread(extensionId, "notebooks", "startCellExecution", [
                executionId,
                startTime,
              ]);
            },

            end(success: boolean | undefined, endTime?: number) {
              bridge.callMainThread(extensionId, "notebooks", "endCellExecution", [
                executionId,
                success,
                endTime,
              ]);
            },

            async clearOutput(targetCell?: NotebookCell) {
              await bridge.callMainThread(extensionId, "notebooks", "clearCellOutput", [
                executionId,
                targetCell?.index,
              ]);
            },

            async replaceOutput(out, targetCell?: NotebookCell) {
              const outputs = Array.isArray(out) ? out : [out];
              await bridge.callMainThread(extensionId, "notebooks", "replaceCellOutput", [
                executionId,
                outputs,
                targetCell?.index,
              ]);
            },

            async appendOutput(out, targetCell?: NotebookCell) {
              const outputs = Array.isArray(out) ? out : [out];
              await bridge.callMainThread(extensionId, "notebooks", "appendCellOutput", [
                executionId,
                outputs,
                targetCell?.index,
              ]);
            },

            async replaceOutputItems(items, output) {
              const itemsArray = Array.isArray(items) ? items : [items];
              await bridge.callMainThread(extensionId, "notebooks", "replaceCellOutputItems", [
                executionId,
                itemsArray,
                output,
              ]);
            },

            async appendOutputItems(items, output) {
              const itemsArray = Array.isArray(items) ? items : [items];
              await bridge.callMainThread(extensionId, "notebooks", "appendCellOutputItems", [
                executionId,
                itemsArray,
                output,
              ]);
            },
          };
        },

        dispose() {
          executeSub.dispose();
          controllers.delete(controllerId);
          bridge.callMainThread(extensionId, "notebooks", "disposeController", [controllerId]);
        },
      };

      controllers.set(controllerId, controller);
      disposables.add(controller);
      return controller;
    },

    async openNotebookDocument(
      uriOrType: Uri | string,
      content?: NotebookData
    ): Promise<NotebookDocument> {
      if (typeof uriOrType === "string") {
        // Open by type
        return bridge.callMainThread<NotebookDocument>(
          extensionId,
          "notebooks",
          "openNotebookDocument",
          [null, uriOrType, content]
        );
      } else {
        // Open by URI
        return bridge.callMainThread<NotebookDocument>(
          extensionId,
          "notebooks",
          "openNotebookDocument",
          [uriOrType.toString(), null, null]
        );
      }
    },

    async createNotebookDocument(
      cells: NotebookCellData[],
      notebookType: string = "default"
    ): Promise<NotebookDocument> {
      const notebookData: NotebookData = {
        cells,
        metadata: {},
      };
      return bridge.callMainThread<NotebookDocument>(
        extensionId,
        "notebooks",
        "createNotebookDocument",
        [notebookType, notebookData]
      );
    },

    registerNotebookController(
      id: string,
      notebookType: string,
      label: string,
      handler?: (
        cells: NotebookCell[],
        notebook: NotebookDocument,
        controller: NotebookController
      ) => void | Promise<void>
    ): NotebookController {
      // This is an alias for createNotebookController for VS Code API compatibility
      return this.createNotebookController(id, notebookType, label, handler);
    },
  };
}

// ============================================================================
// Factory Functions for Output Items
// ============================================================================

/**
 * Create a notebook cell output item from text.
 */
export function createTextOutputItem(text: string, mime = "text/plain"): NotebookCellOutputItem {
  return {
    mime,
    data: new TextEncoder().encode(text),
  };
}

/**
 * Create a notebook cell output item from JSON.
 */
export function createJsonOutputItem(value: unknown): NotebookCellOutputItem {
  return {
    mime: "application/json",
    data: new TextEncoder().encode(JSON.stringify(value)),
  };
}

/**
 * Create a notebook cell output item for an error.
 */
export function createErrorOutputItem(error: Error): NotebookCellOutputItem {
  return {
    mime: "application/vnd.code.notebook.error",
    data: new TextEncoder().encode(
      JSON.stringify({
        name: error.name,
        message: error.message,
        stack: error.stack,
      })
    ),
  };
}

/**
 * Create a notebook cell output.
 */
export function createNotebookCellOutput(
  items: NotebookCellOutputItem | NotebookCellOutputItem[],
  metadata?: Record<string, unknown>
): NotebookCellOutput {
  return {
    items: Array.isArray(items) ? items : [items],
    metadata,
  };
}

// Note: NotebookCellKind, NotebookCellExecutionState, NotebookEditorRevealType
// are already exported at their enum definitions
