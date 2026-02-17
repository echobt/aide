import { Component, createSignal, Show, JSX } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { getProjectPath } from "@/utils/workspace";
import type { SearchResultEntry, ContentSearchResponse } from "@/utils/tauri-api";
import { CortexSearchResultList } from "@/components/cortex/CortexSearchResultList";
import { CortexSearchFilters } from "@/components/cortex/CortexSearchFilters";

const HISTORY_KEY = "cortex_search_panel_history";
const MAX_HISTORY = 20;

function loadHistory(): string[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]"); }
  catch { return []; }
}

function saveHistory(entries: string[]): void {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY))); }
  catch { /* ignore */ }
}

export const CortexSearchPanel: Component = () => {
  const [searchQuery, setSearchQuery] = createSignal("");
  const [replaceQuery, setReplaceQuery] = createSignal("");
  const [caseSensitive, setCaseSensitive] = createSignal(false);
  const [wholeWord, setWholeWord] = createSignal(false);
  const [useRegex, setUseRegex] = createSignal(false);
  const [showReplace, setShowReplace] = createSignal(false);
  const [showFilters, setShowFilters] = createSignal(false);
  const [includePattern, setIncludePattern] = createSignal("");
  const [excludePattern, setExcludePattern] = createSignal("");
  const [results, setResults] = createSignal<SearchResultEntry[]>([]);
  const [expandedFiles, setExpandedFiles] = createSignal<Set<string>>(new Set());
  const [isSearching, setIsSearching] = createSignal(false);
  const [searchError, setSearchError] = createSignal<string | null>(null);
  const [history, setHistory] = createSignal<string[]>(loadHistory());
  const [showHistory, setShowHistory] = createSignal(false);

  const toggleFile = (file: string) => {
    setExpandedFiles(prev => {
      const next = new Set(prev);
      if (next.has(file)) next.delete(file); else next.add(file);
      return next;
    });
  };

  const totalMatches = () => results().reduce((sum, r) => sum + r.matches.length, 0);

  const addToHistory = (query: string) => {
    const updated = [query, ...history().filter(h => h !== query)].slice(0, MAX_HISTORY);
    setHistory(updated);
    saveHistory(updated);
  };

  const handleSearch = async () => {
    const query = searchQuery().trim();
    if (!query) return;
    const projectPath = getProjectPath();
    if (!projectPath) { setSearchError("No project open"); return; }

    setIsSearching(true);
    setSearchError(null);
    setResults([]);
    addToHistory(query);
    setShowHistory(false);

    try {
      const response = await invoke<ContentSearchResponse>("fs_search_content", {
        path: projectPath, query,
        caseSensitive: caseSensitive(), regex: useRegex(),
        wholeWord: wholeWord(),
        include: includePattern() || undefined,
        exclude: excludePattern() || undefined,
        maxResults: 1000,
      });
      setResults(response.results);
      setExpandedFiles(new Set(response.results.map(r => r.file)));
    } catch (err) { setSearchError(String(err)); }
    finally { setIsSearching(false); }
  };

  const toBackendMatch = (file: string, m: { line: number; column: number; text: string; matchStart: number; matchEnd: number }) => ({
    id: `${file}:${m.line}:${m.column}`,
    line: m.line, column: m.column,
    length: m.matchEnd - m.matchStart,
    line_text: m.text, preview: m.text,
  });

  const handleReplaceInFile = async (file: string) => {
    const fileResult = results().find(r => r.file === file);
    if (!fileResult) return;
    try {
      await invoke("search_replace_in_file", {
        uri: `file://${file}`,
        matches: fileResult.matches.map(m => toBackendMatch(file, m)),
        replaceText: replaceQuery(), useRegex: useRegex(), preserveCase: caseSensitive(),
      });
      setResults(prev => prev.filter(r => r.file !== file));
    } catch (err) { setSearchError(`Replace failed: ${String(err)}`); }
  };

  const handleReplaceAll = async () => {
    const current = results();
    if (!current.length) return;
    try {
      await invoke("search_replace_all", {
        results: current.map(r => ({
          uri: `file://${r.file}`,
          matches: r.matches.map(m => toBackendMatch(r.file, m)),
          totalMatches: r.matches.length,
        })),
        replaceText: replaceQuery(), useRegex: useRegex(), preserveCase: caseSensitive(),
      });
      setResults([]);
    } catch (err) { setSearchError(`Replace all failed: ${String(err)}`); }
  };

  const dismissFile = (file: string) => setResults(prev => prev.filter(r => r.file !== file));

  const handleMatchClick = (file: string, line: number, column: number) => {
    window.dispatchEvent(new CustomEvent("editor:goto", { detail: { file, line, column } }));
  };

  const inputBase: JSX.CSSProperties = {
    width: "100%", background: "var(--cortex-bg-primary)",
    border: "1px solid var(--cortex-bg-hover)", "border-radius": "var(--cortex-radius-sm)",
    color: "var(--cortex-text-primary)", "font-size": "13px", outline: "none",
  };

  return (
    <div style={{ display: "flex", "flex-direction": "column", height: "100%", background: "var(--cortex-bg-secondary)", color: "var(--cortex-text-primary)", "font-family": "'SF Pro Text', -apple-system, sans-serif", "font-size": "13px" }}>
      <div style={{ padding: "12px 16px", "border-bottom": "1px solid var(--cortex-bg-hover)" }}>
        <span style={{ "font-weight": "500" }}>Search</span>
      </div>

      <div style={{ padding: "12px 16px", "border-bottom": "1px solid var(--cortex-bg-hover)" }}>
        <div style={{ position: "relative", "margin-bottom": "8px" }}>
          <input type="text" value={searchQuery()} onInput={(e) => setSearchQuery(e.currentTarget.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            onFocus={() => history().length > 0 && setShowHistory(true)}
            onBlur={() => setTimeout(() => setShowHistory(false), 200)}
            placeholder="Search" style={{ ...inputBase, padding: "8px 80px 8px 32px" }} />
          <svg width="16" height="16" viewBox="0 0 16 16" fill="var(--cortex-text-inactive)" style={{ position: "absolute", left: "8px", top: "50%", transform: "translateY(-50%)" }}>
            <path d="M11.7 10.3c.9-1.2 1.4-2.6 1.4-4.2 0-3.9-3.1-7-7-7S-.1 2.2-.1 6.1s3.1 7 7 7c1.6 0 3.1-.5 4.2-1.4l3.8 3.8.7-.7-3.9-3.5zM6.9 12c-3.3 0-6-2.7-6-6s2.7-6 6-6 6 2.7 6 6-2.7 6-6 6z"/>
          </svg>
          <div style={{ position: "absolute", right: "4px", top: "50%", transform: "translateY(-50%)", display: "flex", gap: "2px" }}>
            <ToggleButton active={caseSensitive()} onClick={() => setCaseSensitive(!caseSensitive())} title="Match Case">Aa</ToggleButton>
            <ToggleButton active={wholeWord()} onClick={() => setWholeWord(!wholeWord())} title="Match Whole Word">ab</ToggleButton>
            <ToggleButton active={useRegex()} onClick={() => setUseRegex(!useRegex())} title="Use Regex">.*</ToggleButton>
          </div>
          <Show when={showHistory()}>
            <div style={{ position: "absolute", top: "100%", left: "0", right: "0", background: "var(--cortex-bg-primary)", border: "1px solid var(--cortex-bg-hover)", "border-radius": "var(--cortex-radius-sm)", "z-index": "10", "max-height": "160px", overflow: "auto", "margin-top": "2px" }}>
              {history().map(h => (
                <div style={{ padding: "6px 8px", "font-size": "12px", cursor: "pointer", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}
                  onMouseDown={() => { setSearchQuery(h); setShowHistory(false); }} class="search-history-item">{h}</div>
              ))}
            </div>
          </Show>
        </div>

        <button onClick={() => setShowReplace(!showReplace())} style={{ background: "transparent", border: "none", color: "var(--cortex-text-inactive)", cursor: "pointer", padding: "4px 0", "font-size": "12px", display: "flex", "align-items": "center", gap: "4px" }}>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" style={{ transform: showReplace() ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}>
            <path d="M6 4l4 4-4 4V4z"/>
          </svg>
          Replace
        </button>

        <Show when={showReplace()}>
          <input type="text" value={replaceQuery()} onInput={(e) => setReplaceQuery(e.currentTarget.value)}
            placeholder="Replace" style={{ ...inputBase, padding: "8px", "margin-top": "8px" }} />
          <div style={{ display: "flex", gap: "8px", "margin-top": "8px" }}>
            <button style={{ flex: "1", background: "var(--cortex-bg-hover)", border: "none", color: "var(--cortex-text-primary)", padding: "6px", "border-radius": "var(--cortex-radius-sm)", cursor: "pointer", "font-size": "12px" }} onClick={handleReplaceAll}>Replace All</button>
          </div>
        </Show>

        <CortexSearchFilters includePattern={includePattern()} excludePattern={excludePattern()}
          onIncludeChange={setIncludePattern} onExcludeChange={setExcludePattern}
          expanded={showFilters()} onToggleExpanded={() => setShowFilters(!showFilters())} />
      </div>

      <div style={{ flex: 1, overflow: "auto" }}>
        <Show when={isSearching()}>
          <div style={{ padding: "16px", color: "var(--cortex-text-inactive)", "text-align": "center" }}>Searching...</div>
        </Show>
        <Show when={searchError()}>
          <div style={{ padding: "16px", color: "var(--cortex-error)", "text-align": "center" }}>{searchError()}</div>
        </Show>
        <Show when={!isSearching() && results().length > 0}>
          <div style={{ padding: "8px 16px", color: "var(--cortex-text-inactive)", "font-size": "12px", "border-bottom": "1px solid var(--cortex-bg-hover)" }}>
            {totalMatches()} results in {results().length} files
          </div>
          <CortexSearchResultList results={results()} expandedFiles={expandedFiles()} replaceText={replaceQuery()}
            showReplace={showReplace()} onToggleFile={toggleFile} onMatchClick={handleMatchClick}
            onReplaceInFile={handleReplaceInFile} onDismissFile={dismissFile} />
        </Show>
        <Show when={!isSearching() && results().length === 0 && searchQuery() && !searchError()}>
          <div style={{ padding: "16px", color: "var(--cortex-text-inactive)", "text-align": "center" }}>No results found</div>
        </Show>
      </div>

      <style>{`.search-history-item:hover { background: var(--cortex-bg-hover); }`}</style>
    </div>
  );
};

const ToggleButton: Component<{ active: boolean; onClick: () => void; title: string; children: JSX.Element }> = (props) => (
  <button onClick={props.onClick} title={props.title} style={{
    background: props.active ? "rgba(178,255,34,0.2)" : "transparent",
    border: props.active ? "1px solid var(--cortex-accent-primary)" : "1px solid transparent",
    color: props.active ? "var(--cortex-accent-primary)" : "var(--cortex-text-inactive)",
    cursor: "pointer", padding: "2px 4px", "border-radius": "var(--cortex-radius-sm)",
    "font-size": "11px", "font-family": "monospace",
  }}>{props.children}</button>
);

export default CortexSearchPanel;
