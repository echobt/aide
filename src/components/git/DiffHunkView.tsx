import { For, Show } from "solid-js";
import { Icon } from "@/components/ui/Icon";
import { tokens } from "@/design-system/tokens";
import type { DiffLine, DiffHunk } from "@/components/git/DiffView";

export interface DiffViewHunkProps {
  hunks: DiffHunk[];
  staged?: boolean;
  onStageHunk: (index: number) => void;
  onUnstageHunk: (index: number) => void;
  stagingHunk: number | null;
  hoveredHunk: number | null;
  onHoverHunk: (index: number | null) => void;
  stagedHunks: Set<number>;
}

export function getLineBackground(type: string) {
  switch (type) {
    case "addition": return "rgba(46, 160, 67, 0.15)";
    case "deletion": return "rgba(248, 81, 73, 0.15)";
    default: return "transparent";
  }
}

export function getLineColor(type: string) {
  switch (type) {
    case "addition": return tokens.colors.semantic.success;
    case "deletion": return tokens.colors.semantic.error;
    default: return tokens.colors.text.primary;
  }
}

export function getLinePrefix(type: string) {
  switch (type) {
    case "addition": return "+";
    case "deletion": return "-";
    default: return " ";
  }
}

interface HunkHeaderProps {
  header: string;
  isHovered: boolean;
  isStaging: boolean;
  isStaged: boolean;
  staged?: boolean;
  index: number;
  onStageHunk: (index: number) => void;
  onUnstageHunk: (index: number) => void;
}

function HunkHeader(props: HunkHeaderProps) {
  return (
    <div
      class="flex items-center justify-between px-4 py-1 sticky top-0 transition-all"
      style={{
        background: props.isHovered
          ? `color-mix(in srgb, ${tokens.colors.semantic.primary} 20%, transparent)`
          : props.isStaged
          ? `color-mix(in srgb, ${tokens.colors.semantic.success} 15%, transparent)`
          : `color-mix(in srgb, ${tokens.colors.semantic.primary} 10%, transparent)`,
        color: tokens.colors.semantic.primary,
      }}
    >
      <span class="font-mono text-xs">{props.header}</span>
      <div class="flex items-center gap-2">
        <Show when={props.isStaged}>
          <span
            class="text-xs px-1.5 py-0.5 rounded"
            style={{
              background: `color-mix(in srgb, ${tokens.colors.semantic.success} 30%, transparent)`,
              color: tokens.colors.semantic.success,
            }}
          >
            <Icon name="check" class="w-3 h-3 inline-block mr-1" />
            Staged
          </span>
        </Show>
        <Show when={props.isHovered || props.isStaging}>
          <Show
            when={props.staged}
            fallback={
              <button
                class="flex items-center gap-1 px-2 py-0.5 text-xs rounded transition-all hover:scale-105"
                style={{
                  background: props.isStaging
                    ? `color-mix(in srgb, ${tokens.colors.semantic.success} 40%, transparent)`
                    : `color-mix(in srgb, ${tokens.colors.semantic.success} 20%, transparent)`,
                  color: tokens.colors.semantic.success,
                  cursor: props.isStaging ? "wait" : "pointer",
                }}
                onClick={(e) => { e.stopPropagation(); if (!props.isStaging) props.onStageHunk(props.index); }}
                disabled={props.isStaging}
                title="Stage this hunk"
              >
                <Show when={props.isStaging} fallback={<Icon name="plus" class="w-3 h-3" />}>
                  <Icon name="spinner" class="w-3 h-3 animate-spin" />
                </Show>
                <span>Stage</span>
              </button>
            }
          >
            <button
              class="flex items-center gap-1 px-2 py-0.5 text-xs rounded transition-all hover:scale-105"
              style={{
                background: props.isStaging
                  ? `color-mix(in srgb, ${tokens.colors.semantic.error} 40%, transparent)`
                  : `color-mix(in srgb, ${tokens.colors.semantic.error} 20%, transparent)`,
                color: tokens.colors.semantic.error,
                cursor: props.isStaging ? "wait" : "pointer",
              }}
              onClick={(e) => { e.stopPropagation(); if (!props.isStaging) props.onUnstageHunk(props.index); }}
              disabled={props.isStaging}
              title="Unstage this hunk"
            >
              <Show when={props.isStaging} fallback={<Icon name="minus" class="w-3 h-3" />}>
                <Icon name="spinner" class="w-3 h-3 animate-spin" />
              </Show>
              <span>Unstage</span>
            </button>
          </Show>
        </Show>
      </div>
    </div>
  );
}

export function UnifiedDiffView(props: DiffViewHunkProps) {
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
              <HunkHeader
                header={hunk.header} isHovered={isHovered()} isStaging={isStaging()}
                isStaged={isStaged()} staged={props.staged} index={index()}
                onStageHunk={props.onStageHunk} onUnstageHunk={props.onUnstageHunk}
              />
              <For each={hunk.lines}>
                {(line) => (
                  <div class="flex" style={{ background: getLineBackground(line.type) }}>
                    <span class="w-12 shrink-0 text-right pr-2 select-none" style={{ color: tokens.colors.text.muted }}>
                      {line.type !== "addition" ? line.oldLineNumber : ""}
                    </span>
                    <span
                      class="w-12 shrink-0 text-right pr-2 select-none border-r"
                      style={{ color: tokens.colors.text.muted, "border-color": tokens.colors.border.divider }}
                    >
                      {line.type !== "deletion" ? line.newLineNumber : ""}
                    </span>
                    <pre class="flex-1 px-3 py-0" style={{ color: getLineColor(line.type) }}>
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

export function SplitDiffView(props: DiffViewHunkProps) {
  const getSplitLines = (hunk: DiffHunk) => {
    const left: (DiffLine | null)[] = [];
    const right: (DiffLine | null)[] = [];
    let i = 0;
    while (i < hunk.lines.length) {
      const line = hunk.lines[i];
      if (line.type === "context") {
        left.push(line); right.push(line); i++;
      } else if (line.type === "deletion") {
        const next = hunk.lines[i + 1];
        if (next && next.type === "addition") {
          left.push(line); right.push(next); i += 2;
        } else {
          left.push(line); right.push(null); i++;
        }
      } else if (line.type === "addition") {
        left.push(null); right.push(line); i++;
      } else {
        i++;
      }
    }
    return { left, right };
  };

  const renderSideLine = (line: DiffLine | null, side: "left" | "right") => {
    const fallbackType = side === "left" ? "deletion" : "addition";
    const lineNum = side === "left" ? line?.oldLineNumber : line?.newLineNumber;
    return (
      <div
        class="flex"
        style={{ background: line ? getLineBackground(line.type === "context" ? "context" : fallbackType) : "transparent" }}
      >
        <span class="w-10 shrink-0 text-right pr-2 select-none" style={{ color: tokens.colors.text.muted }}>
          {lineNum || ""}
        </span>
        <pre class="flex-1 px-2 py-0" style={{ color: line ? getLineColor(line.type === "context" ? "context" : fallbackType) : "" }}>
          {line?.content || ""}
        </pre>
      </div>
    );
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
              <HunkHeader
                header={hunk.header} isHovered={isHovered()} isStaging={isStaging()}
                isStaged={isStaged()} staged={props.staged} index={index()}
                onStageHunk={props.onStageHunk} onUnstageHunk={props.onUnstageHunk}
              />
              <div class="flex">
                <div class="flex-1 border-r" style={{ "border-color": tokens.colors.border.divider }}>
                  <For each={left}>{(line) => renderSideLine(line, "left")}</For>
                </div>
                <div class="flex-1">
                  <For each={right}>{(line) => renderSideLine(line, "right")}</For>
                </div>
              </div>
            </div>
          );
        }}
      </For>
    </div>
  );
}
