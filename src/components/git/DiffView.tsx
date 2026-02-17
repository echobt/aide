import { createSignal, createEffect, Show, createMemo } from "solid-js";
import { gitDiff, gitStageHunk, gitUnstageHunk, fsReadFile, fsWriteFile } from "@/utils/tauri-api";
import { getProjectPath } from "@/utils/workspace";
import { tokens } from "@/design-system/tokens";
import { DiffToolbar } from "@/components/git/DiffToolbar";
import { DiffEditMode } from "@/components/git/DiffEditMode";
import { UnifiedDiffView, SplitDiffView, getLinePrefix } from "@/components/git/DiffHunkView";

export interface DiffLine {
  type: "context" | "addition" | "deletion" | "header";
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
  wordDiff?: WordChange[];
}

export interface WordChange {
  value: string;
  added?: boolean;
  removed?: boolean;
}

export interface DiffHunk {
  header: string;
  lines: DiffLine[];
  collapsed?: boolean;
}

export interface FileDiff {
  path: string;
  hunks: DiffHunk[];
  oldPath?: string;
  binary?: boolean;
  additions: number;
  deletions: number;
  isTruncated?: boolean;
}

export interface DiffViewProps {
  file?: string;
  staged?: boolean;
  onClose?: () => void;
  showLineNumbers?: boolean;
  enableWordDiff?: boolean;
  maxLines?: number;
  repoPath?: string;
  onHunkStaged?: () => void;
}

interface RawFileDiff extends FileDiff {
  content?: string;
  rawDiff?: string;
}

export function DiffView(props: DiffViewProps) {
  const [diff, setDiff] = createSignal<FileDiff | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [viewMode, setViewMode] = createSignal<"unified" | "split">("unified");
  const [isFullscreen, setIsFullscreen] = createSignal(false);
  const [copied, setCopied] = createSignal(false);
  const [stagingHunk, setStagingHunk] = createSignal<number | null>(null);
  const [hoveredHunk, setHoveredHunk] = createSignal<number | null>(null);
  const [stagedHunks, setStagedHunks] = createSignal<Set<number>>(new Set());

  const [editMode, setEditMode] = createSignal(false);
  const [editedContent, setEditedContent] = createSignal<string | null>(null);
  const [originalContent, setOriginalContent] = createSignal<string | null>(null);
  const [editLoading, setEditLoading] = createSignal(false);
  const [savingEdit, setSavingEdit] = createSignal(false);

  createEffect(() => {
    if (props.file) {
      fetchDiff(props.file, props.staged || false);
    }
  });

  const fetchDiff = async (file: string, staged: boolean) => {
    setLoading(true);
    try {
      const projectPath = getProjectPath();
      const diffText = await gitDiff(projectPath, file, staged);
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
      await gitStageHunk(repoPath, props.file, hunkIndex);

      const newStagedHunks = new Set(stagedHunks());
      newStagedHunks.add(hunkIndex);
      setStagedHunks(newStagedHunks);

      props.onHunkStaged?.();

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
      await gitUnstageHunk(repoPath, props.file, hunkIndex);

      const newStagedHunks = new Set(stagedHunks());
      newStagedHunks.delete(hunkIndex);
      setStagedHunks(newStagedHunks);

      props.onHunkStaged?.();

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
        sum + h.lines.filter(l => l.type === "deletion").length, 0),
    };
  });

  const getFullFilePath = (): string | null => {
    if (!props.file) return null;
    const projectPath = props.repoPath || getProjectPath();
    if (!projectPath) return null;
    const separator = projectPath.includes("\\") ? "\\" : "/";
    return `${projectPath}${separator}${props.file}`;
  };

  const handleEnterEditMode = async () => {
    const filePath = getFullFilePath();
    if (!filePath) {
      console.error("Cannot enter edit mode: no file path available");
      return;
    }

    setEditLoading(true);
    try {
      const currentContent = await fsReadFile(filePath);
      setEditedContent(currentContent);

      const projectPath = props.repoPath || getProjectPath();
      if (projectPath) {
        try {
          const { invoke } = await import("@tauri-apps/api/core");
          const originalFromGit = await invoke<string>("git_show_file", {
            path: projectPath,
            file: props.file,
            revision: "HEAD",
          });
          setOriginalContent(originalFromGit);
        } catch {
          setOriginalContent(currentContent);
        }
      } else {
        setOriginalContent(currentContent);
      }

      setEditMode(true);
    } catch (err) {
      console.error("Failed to enter edit mode:", err);
    } finally {
      setEditLoading(false);
    }
  };

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
      handleCancelEdit();

      if (props.file) {
        await fetchDiff(props.file, props.staged || false);
      }

      props.onHunkStaged?.();
    } catch (err) {
      console.error("Failed to save changes:", err);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    setEditedContent(null);
    setOriginalContent(null);
  };

  return (
    <div
      class={`flex flex-col overflow-hidden ${isFullscreen() ? "fixed inset-0 z-50" : "h-full"}`}
      style={{ background: tokens.colors.surface.canvas }}
    >
      <DiffToolbar
        diff={diff()}
        file={props.file}
        staged={props.staged}
        editMode={editMode()}
        editLoading={editLoading()}
        savingEdit={savingEdit()}
        copied={copied()}
        viewMode={viewMode()}
        isFullscreen={isFullscreen()}
        diffStats={diffStats()}
        onEnterEditMode={handleEnterEditMode}
        onSaveEdit={handleSaveEdit}
        onCancelEdit={handleCancelEdit}
        onCopyDiff={copyDiff}
        onSetViewMode={setViewMode}
        onToggleFullscreen={() => setIsFullscreen(!isFullscreen())}
        onClose={props.onClose}
      />

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
        <DiffEditMode
          file={props.file || "untitled"}
          originalContent={originalContent() || ""}
          editedContent={editedContent() || ""}
          viewMode={viewMode()}
          onContentChange={setEditedContent}
        />
      </Show>
    </div>
  );
}
