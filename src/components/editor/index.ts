export { TabBar } from "./TabBar";
export { TabSwitcher } from "./TabSwitcher";
export { CodeEditor } from "./CodeEditor";
export { EditorPanel } from "./EditorPanel";
export { MultiBuffer, DiffView } from "./MultiBuffer";
export { VimMode } from "./VimMode";
export { Breadcrumbs } from "./Breadcrumbs";
export { DiagnosticsPanel, DiagnosticsSummary, InlineDiagnostics, ProblemsBottomPanel } from "./DiagnosticsPanel";
export { setupLSPIntegration, updateDiagnosticsMarkers, clearDiagnosticsMarkers, filePathToUri, uriToFilePath } from "./LSPIntegration";
export { setupFormatterIntegration, useFormatterIntegration, formatEditorDocument, formatEditorSelection } from "./FormatterIntegration";
export { OutlinePanel, OutlinePanelSidebar } from "./OutlinePanel";
export { EditorContextMenu, useEditorContextMenu } from "./EditorContextMenu";
export { LanguageTools } from "./LanguageTools";
export { GitGutterDecorations } from "./GitGutterDecorations";
export { BookmarksGutter } from "./BookmarksGutter";
export type {
  CodeAction,
  CodeActionKind,
  CodeActionContext,
  WorkspaceEdit,
  TextDocumentEdit,
  Command,
  LanguageToolsProps,
} from "./LanguageTools";
export { LanguageSelector, LanguageStatus, LanguageSelectorModal } from "./LanguageSelector";
export type { LanguageStatusProps } from "./LanguageSelector";
export { 
  InlineBlameManager, 
  createInlineBlameManager, 
  useInlineBlame,
  getInlineBlameMode, 
  setInlineBlameMode, 
  toggleInlineBlame 
} from "./InlineBlame";
export type { InlineBlameMode, InlineBlameOptions, BlameLineInfo } from "./InlineBlame";
export { PeekWidget, showPeekWidget, hidePeekWidget } from "./PeekWidget";
export type { PeekLocation, PeekWidgetProps, PeekWidgetState } from "./PeekWidget";
export { PeekReferences, showPeekReferences, hidePeekReferences } from "./PeekReferences";
export type { ReferenceItem, FileGroup, PeekReferencesState, PeekReferencesProps } from "./PeekReferences";
export { MultiDiffEditor } from "./MultiDiffEditor";
export type { MultiDiffEditorProps, FileDiff, FileStatus } from "./MultiDiffEditor";
export { EditorGrid, GridSash } from "./EditorGrid";
export { GridSash as GridSashComponent } from "./GridSash";
export { EditorGridPanel } from "./EditorGridPanel";
export type { GridCell, EditorGridState, EditorGridProps, DropPosition } from "./EditorGrid";

// Extracted Editor Features
export {
  // Inlay Hints
  createInlayHintsManager,
  getInlayHintsEditorOptions,
  type InlayHintSettings,
  type InlayHintsManager,
  // CodeLens
  createCodeLensManager,
  getCodeLensEditorOptions,
  type CodeLensSettings,
  type CodeLensManager,
  // Format On Type
  createFormatOnTypeManager,
  getFormatOnTypeEditorOptions,
  type FormatOnTypeSettings,
  type FormatOnTypeManager,
  // Linked Editing
  createLinkedEditingManager,
  getLinkedEditingEditorOptions,
  getTagAtPosition,
  findOpeningTag,
  findClosingTag,
  type LinkedEditingSettings,
  type LinkedEditingManager,
  // Smart Select
  SmartSelectManager,
  createSmartSelectManager,
  registerSmartSelectActions,
  // Coverage
  createCoverageManager,
  getCoverageEditorStyles,
  type LineCoverageStatus,
  type LineCoverageData,
  type CoverageSettings,
  type CoverageManager,
  // UI Panels
  CallHierarchyPanel,
  TypeHierarchyPanel,
  type CallHierarchyDirection,
  type CallHierarchyPanelProps,
  type TypeHierarchyPanelProps,
} from "./features";
