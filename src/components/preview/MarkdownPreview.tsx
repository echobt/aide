import { createSignal, createEffect, Show, createMemo } from "solid-js";
import { Icon } from "@/components/ui/Icon";
import { marked } from "marked";
import { codeToHtml } from "shiki";

export interface MarkdownPreviewProps {
  content: string;
  filePath?: string;
  showToolbar?: boolean;
  onClose?: () => void;
  syncScroll?: boolean;
  editorScrollTop?: number;
  editorScrollHeight?: number;
}

const SHIKI_THEME = "github-dark";

async function highlightCode(code: string, lang: string): Promise<string> {
  try {
    const html = await codeToHtml(code, {
      lang: lang || "text",
      theme: SHIKI_THEME,
    });
    return html;
  } catch {
    return `<pre><code>${escapeHtml(code)}</code></pre>`;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function MarkdownPreview(props: MarkdownPreviewProps) {
  const [html, setHtml] = createSignal("");
  const [isLoading, setIsLoading] = createSignal(true);
  const [_scrollPosition, setScrollPosition] = createSignal(0);
  let containerRef: HTMLDivElement | undefined;

  const fileName = createMemo(() => {
    if (!props.filePath) return "Preview";
    const parts = props.filePath.split("/");
    return parts[parts.length - 1] || "Preview";
  });

  const renderMarkdown = async (content: string) => {
    setIsLoading(true);

    const codeBlocks: Map<string, { code: string; lang: string }> = new Map();
    let blockIndex = 0;

    const preprocessed = content.replace(
      /```(\w*)\n([\s\S]*?)```/g,
      (_match, lang, code) => {
        const placeholder = `__CODE_BLOCK_${blockIndex}__`;
        codeBlocks.set(placeholder, { code: code.trim(), lang: lang || "text" });
        blockIndex++;
        return placeholder;
      }
    );

    let renderedHtml = await marked.parse(preprocessed, {
      gfm: true,
      breaks: true,
    });

    for (const [placeholder, { code, lang }] of codeBlocks) {
      const highlighted = await highlightCode(code, lang);
      renderedHtml = renderedHtml.replace(
        `<p>${placeholder}</p>`,
        `<div class="code-block">${highlighted}</div>`
      );
      renderedHtml = renderedHtml.replace(placeholder, highlighted);
    }

    setHtml(renderedHtml);
    setIsLoading(false);
  };

  createEffect(() => {
    renderMarkdown(props.content);
  });

  createEffect(() => {
    if (
      props.syncScroll &&
      props.editorScrollTop !== undefined &&
      props.editorScrollHeight !== undefined &&
      containerRef
    ) {
      const ratio = props.editorScrollTop / Math.max(props.editorScrollHeight, 1);
      const targetScroll = ratio * containerRef.scrollHeight;
      containerRef.scrollTop = targetScroll;
    }
  });

  const handleScroll = () => {
    if (containerRef) {
      setScrollPosition(containerRef.scrollTop);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        "flex-direction": "column",
        height: "100%",
        background: "var(--cortex-bg-primary)",
        "border-radius": "var(--cortex-radius-lg)",
        border: "1px solid var(--cortex-border-default)",
        overflow: "hidden",
      }}
    >
      <Show when={props.showToolbar !== false}>
        <div
          style={{
            display: "flex",
            "align-items": "center",
            "justify-content": "space-between",
            padding: "8px 12px",
            "border-bottom": "1px solid var(--cortex-border-default)",
            background: "var(--cortex-bg-secondary)",
          }}
        >
          <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
            <Icon
              name="file-lines"
              style={{
                width: "14px",
                height: "14px",
                color: "var(--cortex-text-secondary)",
              }}
            />
            <span
              style={{
                "font-size": "12px",
                "font-weight": "500",
                color: "var(--cortex-text-primary)",
              }}
            >
              {fileName()}
            </span>
            <span
              style={{
                "font-size": "11px",
                color: "var(--cortex-text-inactive)",
                padding: "2px 6px",
                background: "var(--cortex-bg-tertiary)",
                "border-radius": "var(--cortex-radius-sm)",
              }}
            >
              Preview
            </span>
          </div>

          <div style={{ display: "flex", "align-items": "center", gap: "4px" }}>
            <Show when={props.onClose}>
              <button
                onClick={props.onClose}
                title="Close preview"
                style={{
                  display: "flex",
                  "align-items": "center",
                  "justify-content": "center",
                  width: "28px",
                  height: "28px",
                  background: "transparent",
                  border: "none",
                  "border-radius": "var(--cortex-radius-sm)",
                  color: "var(--cortex-text-secondary)",
                  cursor: "pointer",
                }}
              >
                <Icon name="xmark" style={{ width: "14px", height: "14px" }} />
              </button>
            </Show>
          </div>
        </div>
      </Show>

      <div
        ref={containerRef}
        onScroll={handleScroll}
        class="markdown-preview-content"
        style={{
          flex: "1",
          overflow: "auto",
          padding: "24px 32px",
        }}
      >
        <Show
          when={!isLoading()}
          fallback={
            <div
              style={{
                display: "flex",
                "align-items": "center",
                "justify-content": "center",
                height: "100%",
                color: "var(--cortex-text-inactive)",
              }}
            >
              <Icon
                name="spinner"
                style={{
                  width: "24px",
                  height: "24px",
                  animation: "spin 1s linear infinite",
                }}
              />
            </div>
          }
        >
          <div
            class="markdown-body"
            innerHTML={html()}
          />
        </Show>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .markdown-body {
          font-family: var(--cortex-font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
          font-size: 14px;
          line-height: 1.6;
          color: var(--cortex-text-primary);
        }

        .markdown-body h1,
        .markdown-body h2,
        .markdown-body h3,
        .markdown-body h4,
        .markdown-body h5,
        .markdown-body h6 {
          margin-top: 24px;
          margin-bottom: 16px;
          font-weight: 600;
          line-height: 1.25;
          color: var(--cortex-text-primary);
        }

        .markdown-body h1 {
          font-size: 2em;
          padding-bottom: 0.3em;
          border-bottom: 1px solid var(--cortex-border-default);
        }

        .markdown-body h2 {
          font-size: 1.5em;
          padding-bottom: 0.3em;
          border-bottom: 1px solid var(--cortex-border-default);
        }

        .markdown-body h3 { font-size: 1.25em; }
        .markdown-body h4 { font-size: 1em; }
        .markdown-body h5 { font-size: 0.875em; }
        .markdown-body h6 { font-size: 0.85em; color: var(--cortex-text-secondary); }

        .markdown-body p {
          margin-top: 0;
          margin-bottom: 16px;
        }

        .markdown-body a {
          color: var(--cortex-accent-primary);
          text-decoration: none;
        }

        .markdown-body a:hover {
          text-decoration: underline;
        }

        .markdown-body code {
          font-family: var(--cortex-font-mono, "JetBrains Mono", monospace);
          font-size: 85%;
          padding: 0.2em 0.4em;
          background: var(--cortex-bg-tertiary);
          border-radius: 4px;
        }

        .markdown-body pre {
          margin: 16px 0;
          padding: 16px;
          overflow: auto;
          font-size: 85%;
          line-height: 1.45;
          background: var(--cortex-bg-secondary);
          border-radius: 8px;
          border: 1px solid var(--cortex-border-default);
        }

        .markdown-body pre code {
          padding: 0;
          background: transparent;
          font-size: 100%;
        }

        .markdown-body .code-block {
          margin: 16px 0;
          border-radius: 8px;
          overflow: hidden;
          border: 1px solid var(--cortex-border-default);
        }

        .markdown-body .code-block pre {
          margin: 0;
          border: none;
          border-radius: 0;
        }

        .markdown-body blockquote {
          margin: 0 0 16px 0;
          padding: 0 1em;
          color: var(--cortex-text-secondary);
          border-left: 4px solid var(--cortex-border-default);
        }

        .markdown-body ul,
        .markdown-body ol {
          margin-top: 0;
          margin-bottom: 16px;
          padding-left: 2em;
        }

        .markdown-body li {
          margin-bottom: 4px;
        }

        .markdown-body li + li {
          margin-top: 4px;
        }

        .markdown-body hr {
          height: 1px;
          margin: 24px 0;
          background: var(--cortex-border-default);
          border: none;
        }

        .markdown-body table {
          width: 100%;
          margin-bottom: 16px;
          border-collapse: collapse;
          border-spacing: 0;
        }

        .markdown-body th,
        .markdown-body td {
          padding: 8px 12px;
          border: 1px solid var(--cortex-border-default);
        }

        .markdown-body th {
          font-weight: 600;
          background: var(--cortex-bg-secondary);
        }

        .markdown-body tr:nth-child(even) {
          background: var(--cortex-bg-tertiary);
        }

        .markdown-body img {
          max-width: 100%;
          height: auto;
          border-radius: 4px;
        }

        .markdown-body input[type="checkbox"] {
          margin-right: 8px;
        }

        .markdown-body .task-list-item {
          list-style-type: none;
          margin-left: -1.5em;
        }
      `}</style>
    </div>
  );
}

export default MarkdownPreview;
