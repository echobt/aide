import { createSignal, createEffect, For, Show } from "solid-js";
import { Icon } from "../ui/Icon";
import { gitBlame } from "../../utils/tauri-api";
import { getProjectPath } from "../../utils/workspace";

interface BlameLine {
  lineNumber: number;
  content: string;
  commit: {
    hash: string;
    shortHash: string;
    author: string;
    email: string;
    date: string;
    message: string;
  };
}

interface BlameViewProps {
  filePath: string;
}

export function BlameView(props: BlameViewProps) {
  const [blameData, setBlameData] = createSignal<BlameLine[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [hoveredCommit, setHoveredCommit] = createSignal<string | null>(null);
  const [selectedCommit, setSelectedCommit] = createSignal<string | null>(null);

  createEffect(() => {
    if (props.filePath) {
      fetchBlame(props.filePath);
    }
  });

  const fetchBlame = async (file: string) => {
    setLoading(true);
    try {
      const projectPath = getProjectPath();
      const entries = await gitBlame(projectPath, file);
      // Transform entries to BlameLine format
      const lines: BlameLine[] = entries.map((entry, _idx) => ({
        lineNumber: entry.lineStart,
        content: entry.content,
        commit: {
          hash: entry.hash,
          shortHash: entry.hash.substring(0, 7),
          author: entry.author,
          email: entry.authorEmail,
          date: entry.date,
          message: "",
        },
      }));
      setBlameData(lines);
    } catch (err) {
      console.error("Failed to fetch blame:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "today";
    if (diffDays === 1) return "yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  const getCommitColor = (hash: string) => {
    // Generate consistent color from hash
    const colors = [
      "var(--cortex-info)", "var(--cortex-success)", "var(--cortex-warning)", "var(--cortex-info)", 
      "var(--cortex-error)", "var(--cortex-error)", "var(--cortex-info)", "var(--cortex-success)"
    ];
    const index = hash.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[index % colors.length];
  };

  // Note: groupedLines prepared for future grouped view feature
  // Would group consecutive lines by commit for collapsed display

  return (
    <div 
      class="h-full flex flex-col overflow-hidden font-mono text-sm"
      style={{ background: "var(--background-base)" }}
    >
      <Show when={loading()}>
        <div class="flex items-center justify-center h-full">
          <span style={{ color: "var(--text-weak)" }}>Loading blame...</span>
        </div>
      </Show>

      <Show when={!loading() && blameData().length > 0}>
        <div class="flex-1 overflow-auto">
          <table class="w-full border-collapse">
            <tbody>
              <For each={blameData()}>
                {(line, index) => {
                  const isFirstInGroup = index() === 0 || 
                    blameData()[index() - 1].commit.hash !== line.commit.hash;
                  const isHovered = hoveredCommit() === line.commit.hash;
                  const isSelected = selectedCommit() === line.commit.hash;
                  
                  return (
                    <tr 
                      class="group"
                      style={{
                        background: isHovered || isSelected 
                          ? "rgba(255, 255, 255, 0.05)" 
                          : "transparent",
                      }}
                      onMouseEnter={() => setHoveredCommit(line.commit.hash)}
                      onMouseLeave={() => setHoveredCommit(null)}
                      onClick={() => setSelectedCommit(
                        selectedCommit() === line.commit.hash ? null : line.commit.hash
                      )}
                    >
                      {/* Blame info */}
                      <td 
                        class="w-[200px] px-2 py-0 border-r align-top whitespace-nowrap overflow-hidden"
                        style={{ 
                          "border-color": "var(--border-weak)",
                          "border-left": `3px solid ${getCommitColor(line.commit.hash)}`,
                        }}
                      >
                        <Show when={isFirstInGroup}>
                          <div class="py-1">
                            <div 
                              class="text-xs truncate"
                              style={{ color: "var(--text-base)" }}
                            >
                              {line.commit.author}
                            </div>
                            <div 
                              class="text-xs flex items-center gap-1"
                              style={{ color: "var(--text-weak)" }}
                            >
                              <span>{line.commit.shortHash}</span>
                              <span>·</span>
                              <span>{formatDate(line.commit.date)}</span>
                            </div>
                          </div>
                        </Show>
                      </td>

                      {/* Line number */}
                      <td 
                        class="w-12 px-2 py-0 text-right select-none"
                        style={{ color: "var(--text-weaker)" }}
                      >
                        {line.lineNumber}
                      </td>

                      {/* Code */}
                      <td class="px-3 py-0">
                        <pre 
                          class="py-0"
                          style={{ color: "var(--text-base)" }}
                        >
                          {line.content}
                        </pre>
                      </td>
                    </tr>
                  );
                }}
              </For>
            </tbody>
          </table>
        </div>

        {/* Commit details panel */}
        <Show when={selectedCommit()}>
          {(() => {
            const commit = blameData().find(l => l.commit.hash === selectedCommit())?.commit;
            if (!commit) return null;
            
            return (
              <div 
                class="shrink-0 p-3 border-t"
                style={{ 
                  "border-color": "var(--border-weak)",
                  background: "var(--surface-base)",
                }}
              >
                <div class="flex items-start gap-3">
                  <div 
                    class="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: getCommitColor(commit.hash) }}
                  >
                    <Icon name="user" class="w-5 h-5 text-white" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="font-medium" style={{ color: "var(--text-base)" }}>
                        {commit.author}
                      </span>
                      <span class="text-xs" style={{ color: "var(--text-weak)" }}>
                        {commit.email}
                      </span>
                    </div>
                    <p class="text-sm mt-1" style={{ color: "var(--text-base)" }}>
                      {commit.message}
                    </p>
                    <div class="flex items-center gap-3 mt-2 text-xs" style={{ color: "var(--text-weak)" }}>
                      <span class="flex items-center gap-1">
                        <Icon name="code-commit" class="w-3.5 h-3.5" />
                        {commit.hash.slice(0, 12)}
                      </span>
                      <span class="flex items-center gap-1">
                        <Icon name="clock" class="w-3.5 h-3.5" />
                        {new Date(commit.date).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </Show>
      </Show>

      <Show when={!loading() && blameData().length === 0}>
        <div class="flex items-center justify-center h-full">
          <span style={{ color: "var(--text-weak)" }}>No blame data available</span>
        </div>
      </Show>
    </div>
  );
}

