import { Component, createSignal, For, Show } from "solid-js";

interface SearchResult {
  file: string;
  matches: { line: number; content: string; matchStart: number; matchEnd: number }[];
}

export const CortexSearchPanel: Component = () => {
  const [searchQuery, setSearchQuery] = createSignal("");
  const [replaceQuery, setReplaceQuery] = createSignal("");
  const [caseSensitive, setCaseSensitive] = createSignal(false);
  const [wholeWord, setWholeWord] = createSignal(false);
  const [useRegex, setUseRegex] = createSignal(false);
  const [showReplace, setShowReplace] = createSignal(false);
  const [results, setResults] = createSignal<SearchResult[]>([]);
  const [expandedFiles, setExpandedFiles] = createSignal<Set<string>>(new Set());
  const [isSearching, setIsSearching] = createSignal(false);

  const toggleFile = (file: string) => {
    setExpandedFiles(prev => {
      const next = new Set(prev);
      if (next.has(file)) next.delete(file);
      else next.add(file);
      return next;
    });
  };

  const totalMatches = () => results().reduce((sum, r) => sum + r.matches.length, 0);

  const handleSearch = async () => {
    if (!searchQuery().trim()) return;
    setIsSearching(true);
    // Simulate search - in production, connect to actual search API
    setTimeout(() => {
      setResults([
        {
          file: "src/components/Example.tsx",
          matches: [
            { line: 12, content: `const ${searchQuery()} = createSignal()`, matchStart: 6, matchEnd: 6 + searchQuery().length },
            { line: 45, content: `return <${searchQuery()} />`, matchStart: 8, matchEnd: 8 + searchQuery().length },
          ]
        },
        {
          file: "src/utils/helpers.ts",
          matches: [
            { line: 8, content: `export function ${searchQuery()}() {`, matchStart: 16, matchEnd: 16 + searchQuery().length },
          ]
        },
      ]);
      setExpandedFiles(new Set(["src/components/Example.tsx", "src/utils/helpers.ts"]));
      setIsSearching(false);
    }, 300);
  };

  return (
    <div style={{
      display: "flex",
      "flex-direction": "column",
      height: "100%",
      background: "var(--cortex-bg-secondary)",
      color: "var(--cortex-text-primary)",
      "font-family": "'SF Pro Text', -apple-system, sans-serif",
      "font-size": "13px",
    }}>
      {/* Header */}
      <div style={{
        padding: "12px 16px",
        "border-bottom": "1px solid var(--cortex-bg-hover)",
      }}>
        <span style={{ "font-weight": "500" }}>Search</span>
      </div>

      {/* Search Input */}
      <div style={{ padding: "12px 16px", "border-bottom": "1px solid var(--cortex-bg-hover)" }}>
        <div style={{ position: "relative", "margin-bottom": "8px" }}>
          <input
            type="text"
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Search"
            style={{
              width: "100%",
              background: "var(--cortex-bg-primary)",
              border: "1px solid var(--cortex-bg-hover)",
              "border-radius": "var(--cortex-radius-sm)",
              color: "var(--cortex-text-primary)",
              padding: "8px 80px 8px 32px",
              "font-size": "13px",
              outline: "none",
            }}
          />
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="var(--cortex-text-inactive)"
            style={{ position: "absolute", left: "8px", top: "50%", transform: "translateY(-50%)" }}
          >
            <path d="M11.7 10.3c.9-1.2 1.4-2.6 1.4-4.2 0-3.9-3.1-7-7-7S-.1 2.2-.1 6.1s3.1 7 7 7c1.6 0 3.1-.5 4.2-1.4l3.8 3.8.7-.7-3.9-3.5zM6.9 12c-3.3 0-6-2.7-6-6s2.7-6 6-6 6 2.7 6 6-2.7 6-6 6z"/>
          </svg>
          <div style={{ position: "absolute", right: "4px", top: "50%", transform: "translateY(-50%)", display: "flex", gap: "2px" }}>
            <ToggleButton active={caseSensitive()} onClick={() => setCaseSensitive(!caseSensitive())} title="Match Case">
              Aa
            </ToggleButton>
            <ToggleButton active={wholeWord()} onClick={() => setWholeWord(!wholeWord())} title="Match Whole Word">
              ab
            </ToggleButton>
            <ToggleButton active={useRegex()} onClick={() => setUseRegex(!useRegex())} title="Use Regex">
              .*
            </ToggleButton>
          </div>
        </div>

        {/* Replace toggle */}
        <button
          onClick={() => setShowReplace(!showReplace())}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--cortex-text-inactive)",
            cursor: "pointer",
            padding: "4px 0",
            "font-size": "12px",
            display: "flex",
            "align-items": "center",
            gap: "4px",
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 16 16"
            fill="currentColor"
            style={{ transform: showReplace() ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}
          >
            <path d="M6 4l4 4-4 4V4z"/>
          </svg>
          Replace
        </button>

        <Show when={showReplace()}>
          <input
            type="text"
            value={replaceQuery()}
            onInput={(e) => setReplaceQuery(e.currentTarget.value)}
            placeholder="Replace"
            style={{
              width: "100%",
              background: "var(--cortex-bg-primary)",
              border: "1px solid var(--cortex-bg-hover)",
              "border-radius": "var(--cortex-radius-sm)",
              color: "var(--cortex-text-primary)",
              padding: "8px",
              "font-size": "13px",
              outline: "none",
              "margin-top": "8px",
            }}
          />
          <div style={{ display: "flex", gap: "8px", "margin-top": "8px" }}>
            <button style={actionBtnStyle}>Replace</button>
            <button style={actionBtnStyle}>Replace All</button>
          </div>
        </Show>
      </div>

      {/* Results */}
      <div style={{ flex: 1, overflow: "auto" }}>
        <Show when={isSearching()}>
          <div style={{ padding: "16px", color: "var(--cortex-text-inactive)", "text-align": "center" }}>
            Searching...
          </div>
        </Show>

        <Show when={!isSearching() && results().length > 0}>
          <div style={{ padding: "8px 16px", color: "var(--cortex-text-inactive)", "font-size": "12px", "border-bottom": "1px solid var(--cortex-bg-hover)" }}>
            {totalMatches()} results in {results().length} files
          </div>
          <For each={results()}>
            {(result) => (
              <div>
                <div
                  onClick={() => toggleFile(result.file)}
                  style={{
                    display: "flex",
                    "align-items": "center",
                    padding: "6px 16px",
                    cursor: "pointer",
                    gap: "8px",
                  }}
                  class="search-file-row"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 16 16"
                    fill="var(--cortex-text-inactive)"
                    style={{
                      transform: expandedFiles().has(result.file) ? "rotate(90deg)" : "rotate(0deg)",
                      transition: "transform 0.15s",
                    }}
                  >
                    <path d="M6 4l4 4-4 4V4z"/>
                  </svg>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="var(--cortex-text-inactive)">
                    <path d="M14 4.5V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h5.5L14 4.5zm-3 0A1.5 1.5 0 0 1 9.5 3V1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4.5h-2z"/>
                  </svg>
                  <span style={{ flex: 1, overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>
                    {result.file.split("/").pop()}
                  </span>
                  <span style={{ color: "var(--cortex-text-inactive)", "font-size": "12px" }}>
                    {result.matches.length}
                  </span>
                </div>
                <Show when={expandedFiles().has(result.file)}>
                  <For each={result.matches}>
                    {(match) => (
                      <div
                        style={{
                          padding: "4px 16px 4px 48px",
                          cursor: "pointer",
                          "font-family": "monospace",
                          "font-size": "12px",
                          "white-space": "nowrap",
                          overflow: "hidden",
                          "text-overflow": "ellipsis",
                        }}
                        class="search-match-row"
                      >
                        <span style={{ color: "var(--cortex-text-inactive)", "margin-right": "8px" }}>{match.line}</span>
                        <span>
                          {match.content.slice(0, match.matchStart)}
                          <span style={{ background: "var(--cortex-accent-primary)", color: "var(--cortex-accent-text)", "border-radius": "var(--cortex-radius-sm)" }}>
                            {match.content.slice(match.matchStart, match.matchEnd)}
                          </span>
                          {match.content.slice(match.matchEnd)}
                        </span>
                      </div>
                    )}
                  </For>
                </Show>
              </div>
            )}
          </For>
        </Show>

        <Show when={!isSearching() && results().length === 0 && searchQuery()}>
          <div style={{ padding: "16px", color: "var(--cortex-text-inactive)", "text-align": "center" }}>
            No results found
          </div>
        </Show>
      </div>

      <style>{`
        .search-file-row:hover { background: rgba(255,255,255,0.05); }
        .search-match-row:hover { background: rgba(255,255,255,0.05); }
      `}</style>
    </div>
  );
};

const ToggleButton: Component<{ active: boolean; onClick: () => void; title: string; children: any }> = (props) => (
  <button
    onClick={props.onClick}
    title={props.title}
    style={{
      background: props.active ? "rgba(178,255,34,0.2)" : "transparent",
      border: props.active ? "1px solid var(--cortex-accent-primary)" : "1px solid transparent",
      color: props.active ? "var(--cortex-accent-primary)" : "var(--cortex-text-inactive)",
      cursor: "pointer",
      padding: "2px 4px",
      "border-radius": "var(--cortex-radius-sm)",
      "font-size": "11px",
      "font-family": "monospace",
    }}
  >
    {props.children}
  </button>
);

const actionBtnStyle = {
  flex: 1,
  background: "var(--cortex-bg-hover)",
  border: "none",
  color: "var(--cortex-text-primary)",
  padding: "6px",
  "border-radius": "var(--cortex-radius-sm)",
  cursor: "pointer",
  "font-size": "12px",
};

export default CortexSearchPanel;


