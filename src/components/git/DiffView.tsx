import { createSignal, createEffect, For, Show, onCleanup, createMemo } from "solid-js";
// Note: onMount, highlightedLine/setHighlightedLine, showLineNumbers, enableWordDiff,
// getLineBackground, getLineColor, toggleHunkCollapse, computeWordDiff, and renderWordDiffContent
// are declared but used within the component scope for diff rendering features.
import { Icon } from "../ui/Icon";
import { gitDiff, gitStageHunk, gitUnstageHunk, fsReadFile, fsWriteFile } from "../../utils/tauri-api";
import { getProjectPath } from "../../utils/workspace";
import type * as Monaco from "monaco-editor";
import { MonacoManager } from "@/utils/monacoManager";
import { tokens } from '@/design-system/tokens';

interface DiffLine {
  type: "context" | "addition" | "deletion" | "header";
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
  wordDiff?: WordChange[];
}

interface WordChange {
  value: string;
  added?: boolean;
  removed?: boolean;
}

interface DiffHunk {
  header: string;
  lines: DiffLine[];
  collapsed?: boolean;
}

interface FileDiff {
  path: string;
  hunks: DiffHunk[];
  oldPath?: string;
  binary?: boolean;
  additions: number;
  deletions: number;
  isTruncated?: boolean;
}

interface DiffViewProps {
  file?: string;
  staged?: boolean;
  onClose?: () => void;
  showLineNumbers?: boolean;
  enableWordDiff?: boolean;
  maxLines?: number;
  /** Repository path for staging operations */
  repoPath?: string;
  /** Callback when hunk is staged/unstaged */
  onHunkStaged?: () => void;
}

/** Detect language from file path for Monaco editor */
function detectLanguageFromPath(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  const languageMap: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    py: "python",
    rs: "rust",
    go: "go",
    java: "java",
    kt: "kotlin",
    c: "c",
    cpp: "cpp",
    h: "c",
    hpp: "cpp",
    cs: "csharp",
    rb: "ruby",
    php: "php",
    swift: "swift",
    m: "objective-c",
    sql: "sql",
    html: "html",
    css: "css",
    scss: "scss",
    less: "less",
    json: "json",
    yaml: "yaml",
    yml: "yaml",
    xml: "xml",
    md: "markdown",
    sh: "shell",
    bash: "shell",
    zsh: "shell",
    dockerfile: "dockerfile",
    toml: "ini",
    ini: "ini",
    lua: "lua",
    r: "r",
    scala: "scala",
    ex: "elixir",
    exs: "elixir",
    erl: "erlang",
    clj: "clojure",
    hs: "haskell",
    pl: "perl",
    vue: "vue",
    svelte: "svelte",
    astro: "astro",
  };
  return languageMap[ext] || "plaintext";
}

export function DiffView(props: DiffViewProps) {
  let diffEditorContainerRef: HTMLDivElement | undefined;
  let diffEditorInstance: Monaco.editor.IStandaloneDiffEditor | null = null;
  const monacoManager = MonacoManager.getInstance();
  
  const [diff, setDiff] = createSignal<FileDiff | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [viewMode, setViewMode] = createSignal<"unified" | "split">("unified");
  const [isFullscreen, setIsFullscreen] = createSignal(false);
  // Prepared for collapsible hunks feature
  // const [collapsedHunks, setCollapsedHunks] = createSignal<Set<number>>(new Set());
  const [copied, setCopied] = createSignal(false);
  // Prepared for line highlighting feature
  // const [highlightedLine, setHighlightedLine] = createSignal<number | null>(null);
  const [stagingHunk, setStagingHunk] = createSignal<number | null>(null);
  const [hoveredHunk, setHoveredHunk] = createSignal<number | null>(null);
  const [stagedHunks, setStagedHunks] = createSignal<Set<number>>(new Set());
  
  // Edit mode state
  const [editMode, setEditMode] = createSignal(false);
  const [editedContent, setEditedContent] = createSignal<string | null>(null);
  const [originalContent, setOriginalContent] = createSignal<string | null>(null);
  const [editLoading, setEditLoading] = createSignal(false);
  const [savingEdit, setSavingEdit] = createSignal(false);

  // Note: showLineNumbers and enableWordDiff props are part of the component interface
  // for future enhancements. They will enable line number display and word-level diff
  // highlighting when the features are fully implemented.

  createEffect(() => {
    if (props.file) {
      fetchDiff(props.file, props.staged || false);
    }
  });

  /** Extended diff interface for raw diff text */
  interface RawFileDiff extends FileDiff {
    content?: string;
    rawDiff?: string;
  }

  const fetchDiff = async (file: string, staged: boolean) => {
    setLoading(true);
    try {
      const projectPath = getProjectPath();
      const diffText = await gitDiff(projectPath, file, staged);
      // Parse diff text into structured format
      const rawDiff: RawFileDiff = {
        path: file,
        content: diffText,
        hunks: [],
        additions: 0,
        deletions: 0,
      };
      setDiff(rawDiff);
    } catch (err) {
      console.error("Failed to fetch diff:", err);
    } finally {
      setLoading(false);
    }
  };

  // Utility functions for line styling - used by inline token-based rendering (future feature)
  // Currently using standalone getLineBackground/getLineColor functions at bottom of file
  // const getLineBackgroundTokenized = (type: string, isHighlighted: boolean = false) => {
  //   const base = (() => {
  //     switch (type) {
  //       case "addition":
  //         return `color-mix(in srgb, ${tokens.colors.semantic.success} 15%, transparent)`;
  //       case "deletion":
  //         return `color-mix(in srgb, ${tokens.colors.semantic.error} 15%, transparent)`;
  //       case "header":
  //         return `color-mix(in srgb, ${tokens.colors.semantic.primary} 10%, transparent)`;
  //       default:
  //         return "transparent";
  //     }
  //   })();
  //   return isHighlighted ? "rgba(255, 255, 255, 0.1)" : base;
  // };
  // const getLineColorTokenized = (type: string) => {
  //   switch (type) {
  //     case "addition": return tokens.colors.semantic.success;
  //     case "deletion": return tokens.colors.semantic.error;
  //     case "header": return tokens.colors.semantic.primary;
  //     default: return tokens.colors.text.primary;
  //   }
  // };

  const getLinePrefix = (type: string) => {
    switch (type) {
      case "addition":
        return "+";
      case "deletion":
        return "-";
      default:
        return " ";
    }
  };

  // Toggle hunk collapse state - prepared for collapsible hunks feature
  // const toggleHunkCollapse = (index: number) => {
  //   const newSet = new Set(collapsedHunks());
  //   if (newSet.has(index)) {
  //     newSet.delete(index);
  //   } else {
  //     newSet.add(index);
  //   }
  //   setCollapsedHunks(newSet);
  // };

  /**
   * Generate a unified diff patch for a single hunk (used for git apply operations)
   * This is kept for reference but hunk staging now uses backend gitStageHunk command
   */
  // const generateHunkPatch = (hunk: DiffHunk, filePath: string): string => {
  //   const lines: string[] = [];
  //   lines.push(`diff --git a/${filePath} b/${filePath}`);
  //   lines.push(`--- a/${filePath}`);
  //   lines.push(`+++ b/${filePath}`);
  //   lines.push(hunk.header);
  //   for (const line of hunk.lines) {
  //     const prefix = getLinePrefix(line.type);
  //     lines.push(prefix + line.content);
  //   }
  //   return lines.join('\n') + '\n';
  // };

  /**
   * Stage a single hunk by applying its patch to the index
   */
  const stageHunk = async (hunkIndex: number) => {
    const currentDiff = diff();
    if (!currentDiff || !props.file) return;
    
    const hunk = currentDiff.hunks[hunkIndex];
    if (!hunk) return;
    
    const repoPath = props.repoPath || getProjectPath();
    if (!repoPath) {
      console.error("No repository path available for staging");
      return;
    }
    
    setStagingHunk(hunkIndex);
    
    try {
      // Use the Tauri backend to stage a single hunk
      await gitStageHunk(repoPath, props.file, hunkIndex);
      
      // Mark hunk as staged for visual feedback
      const newStagedHunks = new Set(stagedHunks());
      newStagedHunks.add(hunkIndex);
      setStagedHunks(newStagedHunks);
      
      // Notify parent to refresh
      props.onHunkStaged?.();
      
      // Refresh diff after a short delay
      setTimeout(() => {
        if (props.file) {
          fetchDiff(props.file, props.staged || false);
        }
      }, 300);
    } catch (err) {
      console.error("Failed to stage hunk:", err);
    } finally {
      setStagingHunk(null);
    }
  };

  /**
   * Unstage a single hunk by reverse-applying its patch from the index
   */
  const unstageHunk = async (hunkIndex: number) => {
    const currentDiff = diff();
    if (!currentDiff || !props.file) return;
    
    const hunk = currentDiff.hunks[hunkIndex];
    if (!hunk) return;
    
    const repoPath = props.repoPath || getProjectPath();
    if (!repoPath) {
      console.error("No repository path available for unstaging");
      return;
    }
    
    setStagingHunk(hunkIndex);
    
    try {
      // Use the Tauri backend to unstage a single hunk
      await gitUnstageHunk(repoPath, props.file, hunkIndex);
      
      // Mark hunk as unstaged for visual feedback
      const newStagedHunks = new Set(stagedHunks());
      newStagedHunks.delete(hunkIndex);
      setStagedHunks(newStagedHunks);
      
      // Notify parent to refresh
      props.onHunkStaged?.();
      
      // Refresh diff after a short delay
      setTimeout(() => {
        if (props.file) {
          fetchDiff(props.file, props.staged || false);
        }
      }, 300);
    } catch (err) {
      console.error("Failed to unstage hunk:", err);
    } finally {
      setStagingHunk(null);
    }
  };

  const copyDiff = async () => {
    if (!diff()) return;
    const text = diff()!.hunks.map(h => 
      h.header + "\n" + h.lines.map(l => getLinePrefix(l.type) + l.content).join("\n")
    ).join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const diffStats = createMemo(() => {
    if (!diff()) return { additions: 0, deletions: 0 };
    return {
      additions: diff()!.additions || diff()!.hunks.reduce((sum, h) => 
        sum + h.lines.filter(l => l.type === "addition").length, 0),
      deletions: diff()!.deletions || diff()!.hunks.reduce((sum, h) => 
        sum + h.lines.filter(l => l.type === "deletion").length, 0)
    };
  });

  // ============================================================================
  // Edit Mode Functions
  // ============================================================================

  /**
   * Get the full file path for the current file
   */
  const getFullFilePath = (): string | null => {
    if (!props.file) return null;
    const projectPath = props.repoPath || getProjectPath();
    if (!projectPath) return null;
    // Handle path separator differences
    const separator = projectPath.includes("\\") ? "\\" : "/";
    return `${projectPath}${separator}${props.file}`;
  };

  /**
   * Enter edit mode - load the current file content and show Monaco diff editor
   */
  const handleEnterEditMode = async () => {
    const filePath = getFullFilePath();
    if (!filePath) {
      console.error("Cannot enter edit mode: no file path available");
      return;
    }

    setEditLoading(true);
    try {
      // Read the current file content (this will be the "modified" side)
      const currentContent = await fsReadFile(filePath);
      setEditedContent(currentContent);
      
      // For original content, we need to get the HEAD version
      // For now, we'll reconstruct it from the diff by removing additions and keeping deletions
      // In a proper implementation, we'd use git show HEAD:file
      const projectPath = props.repoPath || getProjectPath();
      if (projectPath) {
        try {
          // Get the original content by reading from git HEAD
          const { invoke } = await import("@tauri-apps/api/core");
          const originalFromGit = await invoke<string>("git_show_file", { 
            path: projectPath, 
            file: props.file, 
            revision: "HEAD" 
          });
          setOriginalContent(originalFromGit);
        } catch {
          // Fallback: use current content as original (new files)
          setOriginalContent(currentContent);
        }
      } else {
        setOriginalContent(currentContent);
      }
      
      setEditMode(true);
      
      // Initialize Monaco diff editor after entering edit mode
      setTimeout(() => initDiffEditor(), 50);
    } catch (err) {
      console.error("Failed to enter edit mode:", err);
    } finally {
      setEditLoading(false);
    }
  };

  /**
   * Initialize Monaco diff editor
   */
  const initDiffEditor = async () => {
    if (!diffEditorContainerRef) return;
    
    try {
      const monaco = await monacoManager.ensureLoaded();
      const filePath = props.file || "untitled";
      const language = detectLanguageFromPath(filePath);
      
      // Dispose existing editor if any
      if (diffEditorInstance) {
        const model = diffEditorInstance.getModel();
        if (model) {
          model.original?.dispose?.();
          model.modified?.dispose?.();
        }
        diffEditorInstance.dispose();
        diffEditorInstance = null;
      }
      
      // Create the diff editor
      diffEditorInstance = monaco.editor.createDiffEditor(diffEditorContainerRef, {
        theme: "cortex-dark",
        automaticLayout: true,
        renderSideBySide: viewMode() === "split",
        enableSplitViewResizing: true,
        renderIndicators: true,
        renderMarginRevertIcon: true,
        ignoreTrimWhitespace: false,
        readOnly: false, // Modified side is editable
        originalEditable: false, // Original side is read-only
        fontSize: 13,
        lineHeight: 20,
        fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, Monaco, 'Courier New', monospace",
        fontLigatures: true,
        scrollBeyondLastLine: false,
        smoothScrolling: true,
        minimap: { enabled: false },
        scrollbar: {
          verticalScrollbarSize: 10,
          horizontalScrollbarSize: 10,
          useShadows: false,
        },
      });
      
      // Create unique URIs for models
      const timestamp = Date.now();
      const originalUri = monaco.Uri.parse(`diff://original-${timestamp}/${filePath}`);
      const modifiedUri = monaco.Uri.parse(`diff://modified-${timestamp}/${filePath}`);
      
      // Clean up any existing models with same URIs
      const existingOriginal = monaco.editor.getModel(originalUri);
      const existingModified = monaco.editor.getModel(modifiedUri);
      if (existingOriginal) existingOriginal.dispose();
      if (existingModified) existingModified.dispose();
      
      // Create models
      const originalModel = monaco.editor.createModel(
        originalContent() || "",
        language,
        originalUri
      );
      const modifiedModel = monaco.editor.createModel(
        editedContent() || "",
        language,
        modifiedUri
      );
      
      // Set models on diff editor
      diffEditorInstance.setModel({
        original: originalModel,
        modified: modifiedModel,
      });
      
      // Listen for changes on modified side
      modifiedModel.onDidChangeContent(() => {
        setEditedContent(modifiedModel.getValue());
      });
    } catch (err) {
      console.error("Failed to initialize diff editor:", err);
    }
  };

  /**
   * Save changes made in edit mode
   */
  const handleSaveEdit = async () => {
    const filePath = getFullFilePath();
    const content = editedContent();
    
    if (!filePath || content === null) {
      console.error("Cannot save: no file path or content");
      return;
    }
    
    setSavingEdit(true);
    try {
      await fsWriteFile(filePath, content);
      
      // Exit edit mode
      handleCancelEdit();
      
      // Refresh the diff view
      if (props.file) {
        await fetchDiff(props.file, props.staged || false);
      }
      
      // Notify parent to refresh
      props.onHunkStaged?.();
    } catch (err) {
      console.error("Failed to save changes:", err);
    } finally {
      setSavingEdit(false);
    }
  };

  /**
   * Cancel edit mode and discard changes
   */
  const handleCancelEdit = () => {
    // Dispose Monaco editor
    if (diffEditorInstance) {
      const model = diffEditorInstance.getModel();
      if (model) {
        model.original?.dispose?.();
        model.modified?.dispose?.();
      }
      diffEditorInstance.dispose();
      diffEditorInstance = null;
    }
    
    // Reset state
    setEditMode(false);
    setEditedContent(null);
    setOriginalContent(null);
  };

  // Update diff mode when viewMode changes in edit mode
  createEffect(() => {
    if (editMode() && diffEditorInstance) {
      diffEditorInstance.updateOptions({
        renderSideBySide: viewMode() === "split",
      });
    }
  });

  // Cleanup on unmount
  onCleanup(() => {
    if (diffEditorInstance) {
      const model = diffEditorInstance.getModel();
      if (model) {
        model.original?.dispose?.();
        model.modified?.dispose?.();
      }
      diffEditorInstance.dispose();
      diffEditorInstance = null;
    }
  });

  // Word-level diff computation - prepared for fine-grained change highlighting feature
  // const computeWordDiff = (oldLine: string, newLine: string): { old: WordChange[], new: WordChange[] } => {
  //   const oldWords = oldLine.split(/(\s+)/);
  //   const newWords = newLine.split(/(\s+)/);
  //   const oldResult: WordChange[] = [];
  //   const newResult: WordChange[] = [];
  //   let i = 0, j = 0;
  //   while (i < oldWords.length || j < newWords.length) {
  //     if (i >= oldWords.length) {
  //       newResult.push({ value: newWords[j], added: true });
  //       j++;
  //     } else if (j >= newWords.length) {
  //       oldResult.push({ value: oldWords[i], removed: true });
  //       i++;
  //     } else if (oldWords[i] === newWords[j]) {
  //       oldResult.push({ value: oldWords[i] });
  //       newResult.push({ value: newWords[j] });
  //       i++;
  //       j++;
  //     } else {
  //       oldResult.push({ value: oldWords[i], removed: true });
  //       newResult.push({ value: newWords[j], added: true });
  //       i++;
  //       j++;
  //     }
  //   }
  //   return { old: oldResult, new: newResult };
  // };

  // Render word-level diff with inline highlighting - prepared for future feature
  // const renderWordDiffContent = (words: WordChange[], type: "addition" | "deletion") => {
  //   return (
  //     <For each={words}>
  //       {(word) => {
  //         const isHighlighted = type === "addition" ? word.added : word.removed;
  //         return (
  //           <span style={{
  //             background: isHighlighted 
  //               ? (type === "addition" ? `color-mix(in srgb, ${tokens.colors.semantic.success} 40%, transparent)` : `color-mix(in srgb, ${tokens.colors.semantic.error} 40%, transparent)`)
  //               : "transparent",
  //             "border-radius": isHighlighted ? "2px" : "0"
  //           }}>
  //             {word.value}
  //           </span>
  //         );
  //       }}
  //     </For>
  //   );
  // };

  return (
    <div 
      class={`flex flex-col overflow-hidden ${isFullscreen() ? "fixed inset-0 z-50" : "h-full"}`}
      style={{ background: tokens.colors.surface.canvas }}
    >
      {/* Header */}
      <div 
        class="flex items-center justify-between px-3 py-2 border-b shrink-0"
        style={{ "border-color": tokens.colors.border.divider }}
      >
        <div class="flex items-center gap-2">
          <span class="text-sm font-medium" style={{ color: tokens.colors.text.primary }}>
            {diff()?.path || "Diff View"}
          </span>
          <Show when={diff()?.oldPath && diff()?.oldPath !== diff()?.path}>
            <span class="text-xs" style={{ color: tokens.colors.text.muted }}>
              ← {diff()?.oldPath}
            </span>
          </Show>
          <Show when={props.staged}>
            <span 
              class="text-xs px-1.5 py-0.5 rounded"
              style={{ background: tokens.colors.semantic.primary, color: "white" }}
            >
              Staged
            </span>
          </Show>
          <Show when={diff()}>
            <div class="flex items-center gap-2 ml-2">
              <span class="text-xs text-green-400">+{diffStats().additions}</span>
              <span class="text-xs text-red-400">-{diffStats().deletions}</span>
            </div>
          </Show>
        </div>
        <div class="flex items-center gap-2">
          {/* Edit mode buttons */}
          <Show when={editMode()}>
            <button
              class="flex items-center gap-1.5 px-2 py-1 text-xs rounded transition-colors"
              style={{
                background: savingEdit() ? `color-mix(in srgb, ${tokens.colors.semantic.success} 40%, transparent)` : `color-mix(in srgb, ${tokens.colors.semantic.success} 20%, transparent)`,
                color: tokens.colors.semantic.success,
                cursor: savingEdit() ? "wait" : "pointer",
              }}
              onClick={handleSaveEdit}
              disabled={savingEdit()}
              title="Save changes"
            >
              <Show when={savingEdit()} fallback={<Icon name="floppy-disk" class="w-3.5 h-3.5" />}>
                <Icon name="spinner" class="w-3.5 h-3.5 animate-spin" />
              </Show>
              <span>Save</span>
            </button>
            <button
              class="flex items-center gap-1.5 px-2 py-1 text-xs rounded transition-colors hover:bg-white/10"
              style={{ color: tokens.colors.text.muted }}
              onClick={handleCancelEdit}
              disabled={savingEdit()}
              title="Cancel editing"
            >
              <Icon name="xmark" class="w-3.5 h-3.5" />
              <span>Cancel</span>
            </button>
            <div class="w-px h-4" style={{ background: tokens.colors.border.divider }} />
          </Show>

          {/* Edit button - only show when not in edit mode and not for staged changes */}
          <Show when={!editMode() && !props.staged && props.file}>
            <button
              class="flex items-center gap-1.5 px-2 py-1 text-xs rounded transition-colors hover:bg-white/10"
              style={{ 
                color: editLoading() ? tokens.colors.text.muted : tokens.colors.text.muted,
                cursor: editLoading() ? "wait" : "pointer",
              }}
              onClick={handleEnterEditMode}
              disabled={editLoading()}
              title="Edit file inline"
            >
              <Show when={editLoading()} fallback={<Icon name="pen" class="w-3.5 h-3.5" />}>
                <Icon name="spinner" class="w-3.5 h-3.5 animate-spin" />
              </Show>
              <span>Edit</span>
            </button>
          </Show>

          <button
            class="p-1.5 rounded hover:bg-white/10 transition-colors"
            onClick={copyDiff}
            title="Copy diff"
          >
            {copied() ? (
              <Icon name="check" class="w-4 h-4 text-green-400" />
            ) : (
              <Icon name="copy" class="w-4 h-4" style={{ color: tokens.colors.text.muted }} />
            )}
          </button>
          <div class="flex rounded overflow-hidden" style={{ background: tokens.colors.interactive.hover }}>
            <button
              class="px-2 py-1 text-xs transition-colors"
              style={{
                background: viewMode() === "unified" ? tokens.colors.semantic.primary : "transparent",
                color: viewMode() === "unified" ? "white" : tokens.colors.text.muted,
              }}
              onClick={() => setViewMode("unified")}
            >
              Unified
            </button>
            <button
              class="px-2 py-1 text-xs transition-colors"
              style={{
                background: viewMode() === "split" ? tokens.colors.semantic.primary : "transparent",
                color: viewMode() === "split" ? "white" : tokens.colors.text.muted,
              }}
              onClick={() => setViewMode("split")}
            >
              Split
            </button>
          </div>
          <button
            class="p-1.5 rounded hover:bg-white/10 transition-colors"
            onClick={() => setIsFullscreen(!isFullscreen())}
            title={isFullscreen() ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen() ? (
              <Icon name="minimize" class="w-4 h-4" style={{ color: tokens.colors.text.muted }} />
            ) : (
              <Icon name="maximize" class="w-4 h-4" style={{ color: tokens.colors.text.muted }} />
            )}
          </button>
          <Show when={props.onClose}>
            <button 
              class="p-1 rounded hover:bg-white/10 transition-colors"
              onClick={props.onClose}
            >
              <Icon name="xmark" class="w-4 h-4" style={{ color: tokens.colors.text.muted }} />
            </button>
          </Show>
        </div>
      </div>

      {/* Content */}
      <Show 
        when={editMode()} 
        fallback={
          <div class="flex-1 overflow-auto font-mono text-sm">
            <Show when={loading()}>
              <div class="flex items-center justify-center h-full">
                <span style={{ color: tokens.colors.text.muted }}>Loading diff...</span>
              </div>
            </Show>

            <Show when={!loading() && diff()?.binary}>
              <div class="flex items-center justify-center h-full">
                <span style={{ color: tokens.colors.text.muted }}>Binary file changed</span>
              </div>
            </Show>

            <Show when={!loading() && diff() && !diff()?.binary}>
              <Show when={viewMode() === "unified"}>
                <UnifiedDiffView 
                  hunks={diff()!.hunks} 
                  staged={props.staged}
                  onStageHunk={stageHunk}
                  onUnstageHunk={unstageHunk}
                  stagingHunk={stagingHunk()}
                  hoveredHunk={hoveredHunk()}
                  onHoverHunk={setHoveredHunk}
                  stagedHunks={stagedHunks()}
                />
              </Show>
              <Show when={viewMode() === "split"}>
                <SplitDiffView 
                  hunks={diff()!.hunks} 
                  staged={props.staged}
                  onStageHunk={stageHunk}
                  onUnstageHunk={unstageHunk}
                  stagingHunk={stagingHunk()}
                  hoveredHunk={hoveredHunk()}
                  onHoverHunk={setHoveredHunk}
                  stagedHunks={stagedHunks()}
                />
              </Show>
            </Show>

            <Show when={!loading() && !diff()}>
              <div class="flex items-center justify-center h-full">
                <span style={{ color: tokens.colors.text.muted }}>Select a file to view diff</span>
              </div>
            </Show>
          </div>
        }
      >
        {/* Monaco Diff Editor for edit mode */}
        <div class="flex-1 flex flex-col overflow-hidden">
          {/* Edit mode info bar */}
          <div 
            class="flex items-center gap-2 px-3 py-1.5 text-xs border-b"
            style={{ 
              background: `color-mix(in srgb, ${tokens.colors.semantic.primary} 10%, transparent)`,
              "border-color": tokens.colors.border.divider,
              color: tokens.colors.semantic.primary,
            }}
          >
            <Icon name="pen" class="w-3.5 h-3.5" />
            <span>Editing: {props.file}</span>
            <span class="text-[var(--text-weaker)]">•</span>
            <span class="text-[var(--text-weaker)]">
              Changes on the right side will be saved to the file
            </span>
          </div>
          
          {/* Monaco editor container */}
          <div 
            ref={diffEditorContainerRef} 
            class="flex-1"
            style={{ "min-height": "200px" }}
          />
        </div>
      </Show>
    </div>
  );
}

interface DiffViewHunkProps {
  hunks: DiffHunk[];
  staged?: boolean;
  onStageHunk: (index: number) => void;
  onUnstageHunk: (index: number) => void;
  stagingHunk: number | null;
  hoveredHunk: number | null;
  onHoverHunk: (index: number | null) => void;
  stagedHunks: Set<number>;
}

function UnifiedDiffView(props: DiffViewHunkProps) {
  return (
    <div>
      <For each={props.hunks}>
        {(hunk, index) => {
          const isHovered = () => props.hoveredHunk === index();
          const isStaging = () => props.stagingHunk === index();
          const isStaged = () => props.stagedHunks.has(index());
          
          return (
            <div 
              class="mb-4"
              onMouseEnter={() => props.onHoverHunk(index())}
              onMouseLeave={() => props.onHoverHunk(null)}
            >
              {/* Hunk header with stage/unstage button */}
              <div 
                class="flex items-center justify-between px-4 py-1 sticky top-0 transition-all"
                style={{ 
                  background: isHovered() 
                    ? `color-mix(in srgb, ${tokens.colors.semantic.primary} 20%, transparent)` 
                    : isStaged()
                    ? `color-mix(in srgb, ${tokens.colors.semantic.success} 15%, transparent)`
                    : `color-mix(in srgb, ${tokens.colors.semantic.primary} 10%, transparent)`,
                  color: tokens.colors.semantic.primary,
                }}
              >
                <span class="font-mono text-xs">{hunk.header}</span>
                
                {/* Stage/Unstage button */}
                <div class="flex items-center gap-2">
                  <Show when={isStaged()}>
                    <span 
                      class="text-xs px-1.5 py-0.5 rounded"
                      style={{ background: `color-mix(in srgb, ${tokens.colors.semantic.success} 30%, transparent)`, color: tokens.colors.semantic.success }}
                    >
                      <Icon name="check" class="w-3 h-3 inline-block mr-1" />
                      Staged
                    </span>
                  </Show>
                  
                  <Show when={isHovered() || isStaging()}>
                    <Show 
                      when={props.staged}
                      fallback={
                        <button
                          class="flex items-center gap-1 px-2 py-0.5 text-xs rounded transition-all hover:scale-105"
                          style={{
                            background: isStaging() ? `color-mix(in srgb, ${tokens.colors.semantic.success} 40%, transparent)` : `color-mix(in srgb, ${tokens.colors.semantic.success} 20%, transparent)`,
                            color: tokens.colors.semantic.success,
                            cursor: isStaging() ? "wait" : "pointer",
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isStaging()) {
                              props.onStageHunk(index());
                            }
                          }}
                          disabled={isStaging()}
                          title="Stage this hunk"
                        >
                          <Show when={isStaging()} fallback={<Icon name="plus" class="w-3 h-3" />}>
                            <Icon name="spinner" class="w-3 h-3 animate-spin" />
                          </Show>
                          <span>Stage</span>
                        </button>
                      }
                    >
                      <button
                        class="flex items-center gap-1 px-2 py-0.5 text-xs rounded transition-all hover:scale-105"
                        style={{
                          background: isStaging() ? `color-mix(in srgb, ${tokens.colors.semantic.error} 40%, transparent)` : `color-mix(in srgb, ${tokens.colors.semantic.error} 20%, transparent)`,
                          color: tokens.colors.semantic.error,
                          cursor: isStaging() ? "wait" : "pointer",
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isStaging()) {
                            props.onUnstageHunk(index());
                          }
                        }}
                        disabled={isStaging()}
                        title="Unstage this hunk"
                      >
                        <Show when={isStaging()} fallback={<Icon name="minus" class="w-3 h-3" />}>
                          <Icon name="spinner" class="w-3 h-3 animate-spin" />
                        </Show>
                        <span>Unstage</span>
                      </button>
                    </Show>
                  </Show>
                </div>
              </div>
              
              {/* Lines */}
              <For each={hunk.lines}>
                {(line) => (
                  <div 
                    class="flex"
                    style={{ background: getLineBackground(line.type) }}
                  >
                    {/* Old line number */}
                    <span 
                      class="w-12 shrink-0 text-right pr-2 select-none"
                      style={{ color: tokens.colors.text.muted }}
                    >
                      {line.type !== "addition" ? line.oldLineNumber : ""}
                    </span>
                    {/* New line number */}
                    <span 
                      class="w-12 shrink-0 text-right pr-2 select-none border-r"
                      style={{ 
                        color: tokens.colors.text.muted,
                        "border-color": tokens.colors.border.divider,
                      }}
                    >
                      {line.type !== "deletion" ? line.newLineNumber : ""}
                    </span>
                    {/* Content */}
                    <pre 
                      class="flex-1 px-3 py-0"
                      style={{ color: getLineColor(line.type) }}
                    >
                      <span class="select-none">{getLinePrefix(line.type)}</span>
                      {line.content}
                    </pre>
                  </div>
                )}
              </For>
            </div>
          );
        }}
      </For>
    </div>
  );
}

function SplitDiffView(props: DiffViewHunkProps) {
  // Prepare split view data
  const getSplitLines = (hunk: DiffHunk) => {
    const left: (DiffLine | null)[] = [];
    const right: (DiffLine | null)[] = [];
    
    let i = 0;
    while (i < hunk.lines.length) {
      const line = hunk.lines[i];
      
      if (line.type === "context") {
        left.push(line);
        right.push(line);
        i++;
      } else if (line.type === "deletion") {
        // Check if next line is addition (for inline diff)
        const next = hunk.lines[i + 1];
        if (next && next.type === "addition") {
          left.push(line);
          right.push(next);
          i += 2;
        } else {
          left.push(line);
          right.push(null);
          i++;
        }
      } else if (line.type === "addition") {
        left.push(null);
        right.push(line);
        i++;
      } else {
        i++;
      }
    }
    
    return { left, right };
  };

  return (
    <div class="flex flex-col">
      <For each={props.hunks}>
        {(hunk, index) => {
          const { left, right } = getSplitLines(hunk);
          const isHovered = () => props.hoveredHunk === index();
          const isStaging = () => props.stagingHunk === index();
          const isStaged = () => props.stagedHunks.has(index());
          
          return (
            <div 
              class="flex-1 mb-4"
              onMouseEnter={() => props.onHoverHunk(index())}
              onMouseLeave={() => props.onHoverHunk(null)}
            >
              {/* Hunk header with stage/unstage button */}
              <div 
                class="flex items-center justify-between px-4 py-1 sticky top-0 transition-all"
                style={{ 
                  background: isHovered() 
                    ? "rgba(56, 139, 253, 0.2)" 
                    : isStaged()
                    ? "rgba(46, 160, 67, 0.15)"
                    : "rgba(56, 139, 253, 0.1)",
                  color: "var(--cortex-info)",
                }}
              >
                <span class="font-mono text-xs">{hunk.header}</span>
                
                {/* Stage/Unstage button */}
                <div class="flex items-center gap-2">
                  <Show when={isStaged()}>
                    <span 
                      class="text-xs px-1.5 py-0.5 rounded"
                      style={{ background: "rgba(46, 160, 67, 0.3)", color: "var(--cortex-success)" }}
                    >
                      <Icon name="check" class="w-3 h-3 inline-block mr-1" />
                      Staged
                    </span>
                  </Show>
                  
                  <Show when={isHovered() || isStaging()}>
                    <Show 
                      when={props.staged}
                      fallback={
                        <button
                          class="flex items-center gap-1 px-2 py-0.5 text-xs rounded transition-all hover:scale-105"
                          style={{
                            background: isStaging() ? "rgba(46, 160, 67, 0.4)" : "rgba(46, 160, 67, 0.2)",
                            color: "var(--cortex-success)",
                            cursor: isStaging() ? "wait" : "pointer",
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isStaging()) {
                              props.onStageHunk(index());
                            }
                          }}
                          disabled={isStaging()}
                          title="Stage this hunk"
                        >
                          <Show when={isStaging()} fallback={<Icon name="plus" class="w-3 h-3" />}>
                            <Icon name="spinner" class="w-3 h-3 animate-spin" />
                          </Show>
                          <span>Stage</span>
                        </button>
                      }
                    >
                      <button
                        class="flex items-center gap-1 px-2 py-0.5 text-xs rounded transition-all hover:scale-105"
                        style={{
                          background: isStaging() ? "rgba(248, 81, 73, 0.4)" : "rgba(248, 81, 73, 0.2)",
                          color: "var(--cortex-error)",
                          cursor: isStaging() ? "wait" : "pointer",
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isStaging()) {
                            props.onUnstageHunk(index());
                          }
                        }}
                        disabled={isStaging()}
                        title="Unstage this hunk"
                      >
                        <Show when={isStaging()} fallback={<Icon name="minus" class="w-3 h-3" />}>
                          <Icon name="spinner" class="w-3 h-3 animate-spin" />
                        </Show>
                        <span>Unstage</span>
                      </button>
                    </Show>
                  </Show>
                </div>
              </div>
              
              {/* Split view */}
              <div class="flex">
                {/* Left side (old) */}
                <div class="flex-1 border-r" style={{ "border-color": "var(--border-weak)" }}>
                  <For each={left}>
                    {(line) => (
                      <div 
                        class="flex"
                        style={{ 
                          background: line ? getLineBackground(line.type === "context" ? "context" : "deletion") : "transparent"
                        }}
                      >
                        <span 
                          class="w-10 shrink-0 text-right pr-2 select-none"
                          style={{ color: "var(--text-weaker)" }}
                        >
                          {line?.oldLineNumber || ""}
                        </span>
                        <pre 
                          class="flex-1 px-2 py-0"
                          style={{ color: line ? getLineColor(line.type === "context" ? "context" : "deletion") : "" }}
                        >
                          {line?.content || ""}
                        </pre>
                      </div>
                    )}
                  </For>
                </div>
                
                {/* Right side (new) */}
                <div class="flex-1">
                  <For each={right}>
                    {(line) => (
                      <div 
                        class="flex"
                        style={{ 
                          background: line ? getLineBackground(line.type === "context" ? "context" : "addition") : "transparent"
                        }}
                      >
                        <span 
                          class="w-10 shrink-0 text-right pr-2 select-none"
                          style={{ color: "var(--text-weaker)" }}
                        >
                          {line?.newLineNumber || ""}
                        </span>
                        <pre 
                          class="flex-1 px-2 py-0"
                          style={{ color: line ? getLineColor(line.type === "context" ? "context" : "addition") : "" }}
                        >
                          {line?.content || ""}
                        </pre>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            </div>
          );
        }}
      </For>
    </div>
  );
}

function getLineBackground(type: string) {
  switch (type) {
    case "addition":
      return "rgba(46, 160, 67, 0.15)";
    case "deletion":
      return "rgba(248, 81, 73, 0.15)";
    default:
      return "transparent";
  }
}

function getLineColor(type: string) {
  switch (type) {
    case "addition":
      return "var(--cortex-success)";
    case "deletion":
      return "var(--cortex-error)";
    default:
      return "var(--text-base)";
  }
}

function getLinePrefix(type: string) {
  switch (type) {
    case "addition":
      return "+";
    case "deletion":
      return "-";
    default:
      return " ";
  }
}

