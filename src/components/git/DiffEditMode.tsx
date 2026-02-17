import { createEffect, onCleanup, onMount } from "solid-js";
import { Icon } from "@/components/ui/Icon";
import { tokens } from "@/design-system/tokens";
import type * as Monaco from "monaco-editor";
import { MonacoManager } from "@/utils/monacoManager";

export interface DiffEditModeProps {
  file: string;
  originalContent: string;
  editedContent: string;
  viewMode: "unified" | "split";
  onContentChange: (content: string) => void;
}

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

export function DiffEditMode(props: DiffEditModeProps) {
  let containerRef: HTMLDivElement | undefined;
  let editorInstance: Monaco.editor.IStandaloneDiffEditor | null = null;
  const monacoManager = MonacoManager.getInstance();

  const initEditor = async () => {
    if (!containerRef) return;

    try {
      const monaco = await monacoManager.ensureLoaded();
      const language = detectLanguageFromPath(props.file);

      if (editorInstance) {
        const model = editorInstance.getModel();
        if (model) {
          model.original?.dispose?.();
          model.modified?.dispose?.();
        }
        editorInstance.dispose();
        editorInstance = null;
      }

      editorInstance = monaco.editor.createDiffEditor(containerRef, {
        theme: "cortex-dark",
        automaticLayout: true,
        renderSideBySide: props.viewMode === "split",
        enableSplitViewResizing: true,
        renderIndicators: true,
        renderMarginRevertIcon: true,
        ignoreTrimWhitespace: false,
        readOnly: false,
        originalEditable: false,
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

      const timestamp = Date.now();
      const originalUri = monaco.Uri.parse(`diff://original-${timestamp}/${props.file}`);
      const modifiedUri = monaco.Uri.parse(`diff://modified-${timestamp}/${props.file}`);

      const existingOriginal = monaco.editor.getModel(originalUri);
      const existingModified = monaco.editor.getModel(modifiedUri);
      if (existingOriginal) existingOriginal.dispose();
      if (existingModified) existingModified.dispose();

      const originalModel = monaco.editor.createModel(props.originalContent, language, originalUri);
      const modifiedModel = monaco.editor.createModel(props.editedContent, language, modifiedUri);

      editorInstance.setModel({ original: originalModel, modified: modifiedModel });

      modifiedModel.onDidChangeContent(() => {
        props.onContentChange(modifiedModel.getValue());
      });
    } catch (err) {
      console.error("Failed to initialize diff editor:", err);
    }
  };

  onMount(() => {
    setTimeout(() => initEditor(), 50);
  });

  createEffect(() => {
    const _mode = props.viewMode;
    if (editorInstance) {
      editorInstance.updateOptions({ renderSideBySide: _mode === "split" });
    }
  });

  onCleanup(() => {
    if (editorInstance) {
      const model = editorInstance.getModel();
      if (model) {
        model.original?.dispose?.();
        model.modified?.dispose?.();
      }
      editorInstance.dispose();
      editorInstance = null;
    }
  });

  return (
    <div class="flex-1 flex flex-col overflow-hidden">
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
        <span style={{ color: tokens.colors.text.muted }}>•</span>
        <span style={{ color: tokens.colors.text.muted }}>
          Changes on the right side will be saved to the file
        </span>
      </div>
      <div
        ref={containerRef}
        class="flex-1"
        style={{ "min-height": "200px" }}
      />
    </div>
  );
}
