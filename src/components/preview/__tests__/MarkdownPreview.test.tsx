import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRoot } from "solid-js";

vi.mock("marked", () => ({
  marked: {
    parse: vi.fn().mockResolvedValue("<p>Hello <strong>world</strong></p>"),
  },
}));

vi.mock("shiki", () => ({
  codeToHtml: vi.fn().mockResolvedValue('<pre class="shiki"><code>const x = 1;</code></pre>'),
}));

vi.mock("@/components/ui/Icon", () => ({
  Icon: (props: { name: string }) => {
    const el = document.createElement("span");
    el.setAttribute("data-icon", props.name);
    return el;
  },
}));

describe("MarkdownPreview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should export MarkdownPreview component", async () => {
    const { MarkdownPreview } = await import("../MarkdownPreview");
    expect(MarkdownPreview).toBeDefined();
    expect(typeof MarkdownPreview).toBe("function");
  });

  it("should render without crashing", async () => {
    const { MarkdownPreview } = await import("../MarkdownPreview");
    
    createRoot((dispose) => {
      const element = MarkdownPreview({ content: "# Hello World" });
      expect(element).toBeDefined();
      dispose();
    });
  });

  it("should accept filePath prop", async () => {
    const { MarkdownPreview } = await import("../MarkdownPreview");
    
    createRoot((dispose) => {
      const element = MarkdownPreview({
        content: "# Test",
        filePath: "/path/to/README.md",
      });
      expect(element).toBeDefined();
      dispose();
    });
  });

  it("should accept onClose prop", async () => {
    const { MarkdownPreview } = await import("../MarkdownPreview");
    const onClose = vi.fn();
    
    createRoot((dispose) => {
      const element = MarkdownPreview({
        content: "# Test",
        onClose,
        showToolbar: true,
      });
      expect(element).toBeDefined();
      dispose();
    });
  });

  it("should handle code blocks", async () => {
    const { MarkdownPreview } = await import("../MarkdownPreview");
    
    createRoot((dispose) => {
      const element = MarkdownPreview({
        content: "```typescript\nconst x = 1;\n```",
      });
      expect(element).toBeDefined();
      dispose();
    });
  });

  it("should handle sync scroll props", async () => {
    const { MarkdownPreview } = await import("../MarkdownPreview");
    
    createRoot((dispose) => {
      const element = MarkdownPreview({
        content: "# Test",
        syncScroll: true,
        editorScrollTop: 100,
        editorScrollHeight: 500,
      });
      expect(element).toBeDefined();
      dispose();
    });
  });
});
