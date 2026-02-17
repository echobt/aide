import { createSignal, createEffect, For, Show, onMount, onCleanup, createMemo, batch } from "solid-js";
import { Icon } from "@/components/ui/Icon";
import { gitRebaseCommits, gitRebaseStatus, gitRebaseStart, gitRebaseContinue, gitRebaseSkip, gitRebaseAbort, RebaseCommit as ApiRebaseCommit, RebaseAction as ApiRebaseAction } from "@/utils/tauri-api";
import { getProjectPath } from "@/utils/workspace";
import { RebaseCommitRow } from "@/components/git/RebaseCommitRow";
import { RebaseStatusBanner } from "@/components/git/RebaseStatusBanner";
import { RebaseActionFooter } from "@/components/git/RebaseActionFooter";

export type RebaseAction = "pick" | "reword" | "edit" | "squash" | "fixup" | "drop";

export interface RebaseCommit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  email: string;
  date: string;
  action: RebaseAction;
  originalIndex: number;
}

export type RebaseState =
  | "idle" | "preparing" | "in-progress"
  | "paused-edit" | "paused-conflict" | "completing" | "aborting";

export interface RebaseConflict {
  files: string[];
  currentCommit: string;
  message: string;
}

export interface InteractiveRebaseProps {
  targetBranch?: string;
  ontoCommit?: string;
  commits?: RebaseCommit[];
  onRebaseStart?: (commits: RebaseCommit[]) => void;
  onRebaseAbort?: () => void;
  onRebaseContinue?: () => void;
  onResolveConflicts?: () => void;
  onClose?: () => void;
}

export interface ActionConfig {
  value: RebaseAction;
  label: string;
  shortLabel: string;
  iconName: string;
  color: string;
  description: string;
}

export const REBASE_ACTIONS: ActionConfig[] = [
  { value: "pick", label: "Pick", shortLabel: "pick", iconName: "check", color: "var(--cortex-success)", description: "Use commit as-is" },
  { value: "reword", label: "Reword", shortLabel: "reword", iconName: "pen", color: "var(--cortex-info)", description: "Edit commit message" },
  { value: "edit", label: "Edit", shortLabel: "edit", iconName: "stop", color: "var(--cortex-warning)", description: "Stop for amending" },
  { value: "squash", label: "Squash", shortLabel: "squash", iconName: "code-merge", color: "var(--cortex-info)", description: "Meld into previous commit" },
  { value: "fixup", label: "Fixup", shortLabel: "fixup", iconName: "turn-down-right", color: "var(--cortex-error)", description: "Like squash, discard message" },
  { value: "drop", label: "Drop", shortLabel: "drop", iconName: "trash", color: "var(--cortex-error)", description: "Remove commit" }
];

export function formatRebaseDate(dateStr: string): string {
  const date = new Date(dateStr);
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / 3600000);
    return diffHours === 0 ? `${Math.floor(diffMs / 60000)}m ago` : `${diffHours}h ago`;
  }
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString();
}

function toPausedCommit(c: ApiRebaseCommit): RebaseCommit {
  return { hash: c.hash, shortHash: c.shortHash, message: c.message, author: c.author, email: "", date: c.date, action: "pick", originalIndex: 0 };
}

export function InteractiveRebase(props: InteractiveRebaseProps) {
  const [commits, setCommits] = createSignal<RebaseCommit[]>([]);
  const [rebaseState, setRebaseState] = createSignal<RebaseState>("idle");
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [conflict, setConflict] = createSignal<RebaseConflict | null>(null);
  const [currentStep, setCurrentStep] = createSignal(0);
  const [totalSteps, setTotalSteps] = createSignal(0);
  const [editingMessage, setEditingMessage] = createSignal<string | null>(null);
  const [editedMessage, setEditedMessage] = createSignal("");
  const [draggedIndex, setDraggedIndex] = createSignal<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = createSignal<number | null>(null);
  const [openDropdown, setOpenDropdown] = createSignal<string | null>(null);
  const [pausedCommit, setPausedCommit] = createSignal<RebaseCommit | null>(null);

  onMount(() => {
    if (props.commits && props.commits.length > 0) { setCommits(props.commits); }
    else { fetchCommitsForRebase(); }
    checkRebaseStatus();
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("[data-dropdown]")) { setOpenDropdown(null); }
    };
    document.addEventListener("click", handleClickOutside);
    onCleanup(() => document.removeEventListener("click", handleClickOutside));
  });

  createEffect(() => { if (props.commits) { setCommits(props.commits); } });

  const fetchCommitsForRebase = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await gitRebaseCommits(getProjectPath(), props.ontoCommit || "HEAD~10");
      setCommits(data.map((c: ApiRebaseCommit, idx: number) => ({
        hash: c.hash, shortHash: c.shortHash || c.hash.slice(0, 7), message: c.message,
        author: c.author, email: "", date: c.date, action: "pick" as RebaseAction, originalIndex: idx
      })));
    } catch (_err) { setError("Failed to fetch commits for rebase"); }
    finally { setLoading(false); }
  };

  const checkRebaseStatus = async () => {
    try {
      const data = await gitRebaseStatus(getProjectPath());
      if (!data.inProgress) return;
      batch(() => {
        setRebaseState(data.hasConflicts ? "paused-conflict" : "in-progress");
        setCurrentStep(data.total - data.remaining);
        setTotalSteps(data.total);
        if (data.hasConflicts && data.conflictFiles.length > 0) {
          setConflict({ files: data.conflictFiles, currentCommit: data.currentCommit || "", message: "Conflict detected" });
        }
        if (data.pausedCommit) {
          setPausedCommit(toPausedCommit(data.pausedCommit));
          if (!data.hasConflicts) { setRebaseState("paused-edit"); }
        }
      });
    } catch (_err) { /* best-effort */ }
  };

  const handleRebaseResponse = (data: { inProgress: boolean; hasConflicts?: boolean; conflictFiles?: string[]; currentCommit?: string | null; pausedCommit?: ApiRebaseCommit | null; total: number; remaining: number }) => {
    batch(() => {
      setCurrentStep(data.total - data.remaining);
      setConflict(null);
      setPausedCommit(null);
      if (!data.inProgress) { setRebaseState("idle"); props.onClose?.(); }
      else if (data.hasConflicts) {
        setRebaseState("paused-conflict");
        setConflict({ files: data.conflictFiles || [], currentCommit: data.currentCommit || "", message: "Conflicts detected" });
      } else if (data.pausedCommit) {
        setRebaseState("paused-edit");
        setPausedCommit(toPausedCommit(data.pausedCommit));
      }
    });
  };

  const setCommitAction = (hash: string, action: RebaseAction) => {
    setCommits(prev => prev.map(c => c.hash === hash ? { ...c, action } : c));
    setOpenDropdown(null);
  };

  const moveCommit = (from: number, to: number) => {
    if (from === to) return;
    setCommits(prev => { const r = [...prev]; const [rm] = r.splice(from, 1); r.splice(to, 0, rm); return r; });
  };

  const handleDragStart = (e: DragEvent, i: number) => { setDraggedIndex(i); if (e.dataTransfer) { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(i)); } };
  const handleDragOver = (e: DragEvent, i: number) => { e.preventDefault(); if (e.dataTransfer) { e.dataTransfer.dropEffect = "move"; } setDragOverIndex(i); };
  const handleDragLeave = () => { setDragOverIndex(null); };
  const handleDrop = (e: DragEvent, to: number) => { e.preventDefault(); const from = draggedIndex(); if (from !== null && from !== to) { moveCommit(from, to); } setDraggedIndex(null); setDragOverIndex(null); };
  const handleDragEnd = () => { setDraggedIndex(null); setDragOverIndex(null); };
  const startMessageEdit = (c: RebaseCommit) => { setEditingMessage(c.hash); setEditedMessage(c.message); };
  const saveMessageEdit = (hash: string) => { const m = editedMessage().trim(); if (m) { setCommits(prev => prev.map(c => c.hash === hash ? { ...c, message: m } : c)); } setEditingMessage(null); setEditedMessage(""); };
  const cancelMessageEdit = () => { setEditingMessage(null); setEditedMessage(""); };

  const startRebase = async () => {
    const list = commits();
    if (list.length === 0) return;
    setRebaseState("preparing"); setError(null);
    try {
      const todoList: ApiRebaseAction[] = list.map(c => ({ action: c.action, hash: c.hash }));
      const data = await gitRebaseStart(getProjectPath(), props.ontoCommit || `HEAD~${list.length}`, todoList);
      batch(() => { setTotalSteps(list.filter(c => c.action !== "drop").length); setCurrentStep(0); });
      if (!data.inProgress) { setRebaseState("idle"); props.onClose?.(); } else { handleRebaseResponse(data); }
      props.onRebaseStart?.(list);
    } catch (_err) { setError("Failed to start rebase"); setRebaseState("idle"); }
  };

  const continueRebase = async () => {
    setRebaseState("in-progress"); setError(null);
    try { handleRebaseResponse(await gitRebaseContinue(getProjectPath())); props.onRebaseContinue?.(); }
    catch (_err) { setError("Failed to continue rebase"); await checkRebaseStatus(); }
  };

  const skipCommit = async () => {
    setRebaseState("in-progress"); setError(null);
    try { handleRebaseResponse(await gitRebaseSkip(getProjectPath())); }
    catch (_err) { setError("Failed to skip commit"); await checkRebaseStatus(); }
  };

  const abortRebase = async () => {
    setRebaseState("aborting"); setError(null);
    try {
      await gitRebaseAbort(getProjectPath());
      batch(() => { setRebaseState("idle"); setConflict(null); setPausedCommit(null); setCurrentStep(0); setTotalSteps(0); });
      props.onRebaseAbort?.();
    } catch (_err) { setError("Failed to abort rebase"); await checkRebaseStatus(); }
  };

  const isRebaseActive = createMemo(() => { const s = rebaseState(); return s !== "idle" && s !== "preparing"; });
  const canStartRebase = createMemo(() => rebaseState() === "idle" && commits().length > 0 && !loading());
  const progressPercent = createMemo(() => { const t = totalSteps(); return t === 0 ? 0 : Math.round((currentStep() / t) * 100); });

  return (
    <div class="h-full flex flex-col overflow-hidden" style={{ background: "var(--background-base)" }}>
      <div class="flex items-center justify-between px-4 py-3 border-b shrink-0" style={{ "border-color": "var(--border-weak)" }}>
        <div class="flex items-center gap-3">
          <Icon name="code-commit" class="w-5 h-5" style={{ color: "var(--text-weak)" }} />
          <div>
            <h2 class="text-sm font-medium" style={{ color: "var(--text-base)" }}>Interactive Rebase</h2>
            <Show when={props.targetBranch || props.ontoCommit}>
              <p class="text-xs" style={{ color: "var(--text-weak)" }}>
                {props.targetBranch ? `Branch: ${props.targetBranch}` : `Onto: ${props.ontoCommit}`}
              </p>
            </Show>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <Show when={!isRebaseActive()}>
            <button class="p-1.5 rounded hover:bg-white/10 transition-colors" onClick={fetchCommitsForRebase} disabled={loading()} title="Refresh commits">
              <Icon name="rotate" class={`w-4 h-4 ${loading() ? "animate-spin" : ""}`} style={{ color: "var(--text-weak)" }} />
            </button>
          </Show>
          <Show when={props.onClose}>
            <button class="p-1.5 rounded hover:bg-white/10 transition-colors" onClick={() => props.onClose?.()} title="Close">
              <Icon name="xmark" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
            </button>
          </Show>
        </div>
      </div>

      <Show when={isRebaseActive()}>
        <RebaseStatusBanner rebaseState={rebaseState()} conflict={conflict()} pausedCommit={pausedCommit()} currentStep={currentStep()} totalSteps={totalSteps()} progressPercent={progressPercent()} />
      </Show>

      <Show when={error()}>
        <div class="flex items-center gap-2 px-4 py-2 text-xs border-b" style={{ background: "rgba(248, 81, 73, 0.1)", color: "var(--cortex-error)", "border-color": "var(--border-weak)" }}>
          <Icon name="circle-exclamation" class="w-4 h-4 shrink-0" />
          <span class="flex-1">{error()}</span>
          <button class="p-0.5 rounded hover:bg-white/10" onClick={() => setError(null)}><Icon name="xmark" class="w-3.5 h-3.5" /></button>
        </div>
      </Show>

      <Show when={!isRebaseActive() && commits().length > 0}>
        <div class="px-4 py-2 border-b text-xs" style={{ background: "var(--surface-base)", "border-color": "var(--border-weak)", color: "var(--text-weak)" }}>
          <span class="font-medium">Instructions:</span> Drag rows to reorder commits. Select an action for each commit.{" "}
          Use <span class="font-mono px-1 py-0.5 rounded" style={{ background: "var(--surface-active)" }}>squash</span> or{" "}
          <span class="font-mono px-1 py-0.5 rounded ml-1" style={{ background: "var(--surface-active)" }}>fixup</span> to combine commits.
        </div>
      </Show>

      <div class="flex-1 overflow-auto">
        <Show when={loading()}>
          <div class="flex items-center justify-center h-32"><Icon name="spinner" class="w-5 h-5 animate-spin" style={{ color: "var(--text-weak)" }} /></div>
        </Show>
        <Show when={!loading() && commits().length === 0}>
          <div class="flex flex-col items-center justify-center h-32 gap-2">
            <Icon name="code-commit" class="w-8 h-8" style={{ color: "var(--text-weaker)" }} />
            <span style={{ color: "var(--text-weak)" }}>No commits to rebase</span>
          </div>
        </Show>
        <Show when={!loading() && commits().length > 0}>
          <div>
            <For each={commits()}>
              {(commit, index) => (
                <RebaseCommitRow
                  commit={commit} index={index()} isRebaseActive={isRebaseActive()} editingMessage={editingMessage()}
                  editedMessage={editedMessage()} openDropdown={openDropdown()} draggedIndex={draggedIndex()} dragOverIndex={dragOverIndex()}
                  onSetCommitAction={setCommitAction} onSetOpenDropdown={setOpenDropdown} onSetEditedMessage={setEditedMessage}
                  onDragStart={handleDragStart} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} onDragEnd={handleDragEnd}
                  onStartMessageEdit={startMessageEdit} onSaveMessageEdit={saveMessageEdit} onCancelMessageEdit={cancelMessageEdit} formatDate={formatRebaseDate}
                />
              )}
            </For>
          </div>
        </Show>
      </div>

      <RebaseActionFooter
        rebaseState={rebaseState()} isRebaseActive={isRebaseActive()} canStartRebase={canStartRebase()} commits={commits()}
        onStartRebase={startRebase} onContinueRebase={continueRebase} onAbortRebase={abortRebase} onSkipCommit={skipCommit}
        onResolveConflicts={() => props.onResolveConflicts?.()} onClose={props.onClose}
      />
    </div>
  );
}

export default InteractiveRebase;
