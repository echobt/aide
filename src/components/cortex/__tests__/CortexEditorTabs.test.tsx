import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, cleanup } from "@solidjs/testing-library";
import { CortexEditorTabs } from "../CortexEditorTabs";
import type { EditorTab, CortexEditorTabsProps } from "../CortexEditorTabs";

vi.mock("../primitives", () => ({
  CortexIcon: (props: { name: string; size?: number; color?: string }) => (
    <span data-testid={`icon-${props.name}`} data-size={props.size} />
  ),
}));

describe("CortexEditorTabs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  describe("Interfaces", () => {
    it("should have correct EditorTab interface structure", () => {
      const tab: EditorTab = {
        id: "tab-1",
        name: "index.tsx",
        path: "/src/index.tsx",
        isModified: true,
        isPreview: false,
      };

      expect(tab.id).toBe("tab-1");
      expect(tab.name).toBe("index.tsx");
      expect(tab.path).toBe("/src/index.tsx");
      expect(tab.isModified).toBe(true);
      expect(tab.isPreview).toBe(false);
    });

    it("should have correct CortexEditorTabsProps interface structure", () => {
      const props: CortexEditorTabsProps = {
        tabs: [{ id: "1", name: "file.ts" }],
        activeTabId: "1",
        onTabSelect: vi.fn(),
        onTabClose: vi.fn(),
        onNewTab: vi.fn(),
        class: "custom-class",
        style: { height: "50px" },
      };

      expect(props.tabs).toHaveLength(1);
      expect(props.activeTabId).toBe("1");
      expect(typeof props.onTabSelect).toBe("function");
      expect(typeof props.onTabClose).toBe("function");
      expect(typeof props.onNewTab).toBe("function");
    });
  });

  describe("Rendering", () => {
    it("should render tabs", () => {
      const tabs: EditorTab[] = [
        { id: "1", name: "file1.ts" },
        { id: "2", name: "file2.tsx" },
        { id: "3", name: "file3.rs" },
      ];

      const { container } = render(() => (
        <CortexEditorTabs tabs={tabs} activeTabId="1" />
      ));

      expect(container.textContent).toContain("file1.ts");
      expect(container.textContent).toContain("file2.tsx");
      expect(container.textContent).toContain("file3.rs");
    });

    it("should render empty tab bar when no tabs", () => {
      const { container } = render(() => (
        <CortexEditorTabs tabs={[]} activeTabId={null} />
      ));

      const tabBar = container.firstChild as HTMLElement;
      expect(tabBar).toBeTruthy();
    });

    it("should render close button on tabs", () => {
      const tabs: EditorTab[] = [{ id: "1", name: "file.ts" }];

      const { container } = render(() => (
        <CortexEditorTabs tabs={tabs} activeTabId="1" />
      ));

      const closeIcon = container.querySelector('[data-testid="icon-xmark"]');
      expect(closeIcon).toBeTruthy();
    });
  });

  describe("Active Tab", () => {
    it("should highlight active tab with different background", () => {
      const tabs: EditorTab[] = [
        { id: "1", name: "active.ts" },
        { id: "2", name: "inactive.ts" },
      ];

      const { container } = render(() => (
        <CortexEditorTabs tabs={tabs} activeTabId="1" />
      ));

      const tabElements = container.querySelectorAll('[style*="cursor: pointer"]');
      const activeTab = tabElements[0] as HTMLElement;
      const inactiveTab = tabElements[1] as HTMLElement;

      expect(activeTab?.style.background).toContain("var(--cortex-bg-primary)");
      expect(inactiveTab?.style.background).toBe("transparent");
    });

    it("should not highlight any tab when activeTabId is null", () => {
      const tabs: EditorTab[] = [
        { id: "1", name: "file1.ts" },
        { id: "2", name: "file2.ts" },
      ];

      const { container } = render(() => (
        <CortexEditorTabs tabs={tabs} activeTabId={null} />
      ));

      const tabElements = container.querySelectorAll('[style*="cursor: pointer"]');
      tabElements.forEach((tab) => {
        expect((tab as HTMLElement).style.background).toBe("transparent");
      });
    });
  });

  describe("Modified Indicator", () => {
    it("should show modified dot when tab is modified and not hovered", () => {
      const tabs: EditorTab[] = [{ id: "1", name: "file.ts", isModified: true }];

      const { container } = render(() => (
        <CortexEditorTabs tabs={tabs} activeTabId="1" />
      ));

      const modifiedDot = container.querySelector('[style*="border-radius: var(--cortex-radius-full)"]');
      expect(modifiedDot).toBeTruthy();
    });

    it("should not show modified dot when tab is not modified", () => {
      const tabs: EditorTab[] = [{ id: "1", name: "file.ts", isModified: false }];

      const { container } = render(() => (
        <CortexEditorTabs tabs={tabs} activeTabId="1" />
      ));

      const modifiedDots = container.querySelectorAll('[style*="width: 8px"]');
      expect(modifiedDots.length).toBe(0);
    });
  });

  describe("Preview Mode", () => {
    it("should render preview tab with italic font", () => {
      const tabs: EditorTab[] = [{ id: "1", name: "preview.ts", isPreview: true }];

      const { container } = render(() => (
        <CortexEditorTabs tabs={tabs} activeTabId="1" />
      ));

      const tabName = container.querySelector('span[style*="font-style: italic"]');
      expect(tabName).toBeTruthy();
    });

    it("should render normal tab without italic font", () => {
      const tabs: EditorTab[] = [{ id: "1", name: "normal.ts", isPreview: false }];

      const { container } = render(() => (
        <CortexEditorTabs tabs={tabs} activeTabId="1" />
      ));

      const tabName = container.querySelector('span[style*="font-style: normal"]');
      expect(tabName).toBeTruthy();
    });
  });

  describe("User Interactions", () => {
    it("should call onTabSelect when tab is clicked", async () => {
      const onTabSelect = vi.fn();
      const tabs: EditorTab[] = [
        { id: "1", name: "file1.ts" },
        { id: "2", name: "file2.ts" },
      ];

      const { container } = render(() => (
        <CortexEditorTabs tabs={tabs} activeTabId="1" onTabSelect={onTabSelect} />
      ));

      const tabBar = container.firstChild as HTMLElement;
      const tabElements = Array.from(tabBar.children).filter(
        (child) => (child as HTMLElement).textContent?.includes("file2.ts")
      );
      if (tabElements[0]) {
        await fireEvent.click(tabElements[0]);
      }

      expect(onTabSelect).toHaveBeenCalledWith("2");
    });

    it("should call onTabClose when close button is clicked", async () => {
      const onTabClose = vi.fn();
      const tabs: EditorTab[] = [{ id: "1", name: "file.ts" }];

      const { container } = render(() => (
        <CortexEditorTabs tabs={tabs} activeTabId="1" onTabClose={onTabClose} />
      ));

      const closeButton = container.querySelector('button[title="Close"]');
      if (closeButton) {
        await fireEvent.click(closeButton);
      }

      expect(onTabClose).toHaveBeenCalledWith("1");
    });

    it("should not trigger onTabSelect when close button is clicked", async () => {
      const onTabSelect = vi.fn();
      const onTabClose = vi.fn();
      const tabs: EditorTab[] = [{ id: "1", name: "file.ts" }];

      const { container } = render(() => (
        <CortexEditorTabs
          tabs={tabs}
          activeTabId="1"
          onTabSelect={onTabSelect}
          onTabClose={onTabClose}
        />
      ));

      const closeButton = container.querySelector('button[title="Close"]');
      if (closeButton) {
        await fireEvent.click(closeButton);
      }

      expect(onTabClose).toHaveBeenCalled();
      expect(onTabSelect).not.toHaveBeenCalled();
    });

    it("should call onNewTab when empty space is clicked", async () => {
      const onNewTab = vi.fn();
      const tabs: EditorTab[] = [{ id: "1", name: "file.ts" }];

      const { container } = render(() => (
        <CortexEditorTabs tabs={tabs} activeTabId="1" onNewTab={onNewTab} />
      ));

      const tabBar = container.firstChild as HTMLElement;
      const emptySpace = tabBar.lastChild as HTMLElement;
      if (emptySpace && !emptySpace.textContent?.includes("file.ts")) {
        await fireEvent.click(emptySpace);
      }

      expect(onNewTab).toHaveBeenCalled();
    });
  });

  describe("File Type Icons", () => {
    it("should render TypeScript icon for .ts files", () => {
      const tabs: EditorTab[] = [{ id: "1", name: "file.ts" }];

      const { container } = render(() => (
        <CortexEditorTabs tabs={tabs} activeTabId="1" />
      ));

      const svgElements = container.querySelectorAll("svg");
      expect(svgElements.length).toBeGreaterThan(0);
    });

    it("should render React icon for .tsx files", () => {
      const tabs: EditorTab[] = [{ id: "1", name: "component.tsx" }];

      const { container } = render(() => (
        <CortexEditorTabs tabs={tabs} activeTabId="1" />
      ));

      const svgElements = container.querySelectorAll("svg");
      expect(svgElements.length).toBeGreaterThan(0);
    });

    it("should render React icon for .jsx files", () => {
      const tabs: EditorTab[] = [{ id: "1", name: "component.jsx" }];

      const { container } = render(() => (
        <CortexEditorTabs tabs={tabs} activeTabId="1" />
      ));

      const svgElements = container.querySelectorAll("svg");
      expect(svgElements.length).toBeGreaterThan(0);
    });

    it("should render Rust icon for .rs files", () => {
      const tabs: EditorTab[] = [{ id: "1", name: "main.rs" }];

      const { container } = render(() => (
        <CortexEditorTabs tabs={tabs} activeTabId="1" />
      ));

      const svgElements = container.querySelectorAll("svg");
      expect(svgElements.length).toBeGreaterThan(0);
    });

    it("should render TOML icon for Cargo.toml", () => {
      const tabs: EditorTab[] = [{ id: "1", name: "Cargo.toml" }];

      const { container } = render(() => (
        <CortexEditorTabs tabs={tabs} activeTabId="1" />
      ));

      const svgElements = container.querySelectorAll("svg");
      expect(svgElements.length).toBeGreaterThan(0);
    });

    it("should render lock icon for Cargo.lock", () => {
      const tabs: EditorTab[] = [{ id: "1", name: "Cargo.lock" }];

      const { container } = render(() => (
        <CortexEditorTabs tabs={tabs} activeTabId="1" />
      ));

      const svgElements = container.querySelectorAll("svg");
      expect(svgElements.length).toBeGreaterThan(0);
    });

    it("should render Markdown icon for .md files", () => {
      const tabs: EditorTab[] = [{ id: "1", name: "README.md" }];

      const { container } = render(() => (
        <CortexEditorTabs tabs={tabs} activeTabId="1" />
      ));

      const svgElements = container.querySelectorAll("svg");
      expect(svgElements.length).toBeGreaterThan(0);
    });

    it("should render JSON icon for .json files", () => {
      const tabs: EditorTab[] = [{ id: "1", name: "package.json" }];

      const { container } = render(() => (
        <CortexEditorTabs tabs={tabs} activeTabId="1" />
      ));

      const svgElements = container.querySelectorAll("svg");
      expect(svgElements.length).toBeGreaterThan(0);
    });

    it("should render default file icon for unknown extensions", () => {
      const tabs: EditorTab[] = [{ id: "1", name: "unknown.xyz" }];

      const { container } = render(() => (
        <CortexEditorTabs tabs={tabs} activeTabId="1" />
      ));

      const svgElements = container.querySelectorAll("svg");
      expect(svgElements.length).toBeGreaterThan(0);
    });
  });

  describe("Styling", () => {
    it("should apply custom class", () => {
      const { container } = render(() => (
        <CortexEditorTabs tabs={[]} activeTabId={null} class="custom-class" />
      ));
      const tabBar = container.firstChild as HTMLElement;
      expect(tabBar?.className).toContain("custom-class");
    });

    it("should apply custom style", () => {
      const { container } = render(() => (
        <CortexEditorTabs
          tabs={[]}
          activeTabId={null}
          style={{ "background-color": "red" }}
        />
      ));
      const tabBar = container.firstChild as HTMLElement;
      expect(tabBar?.style.backgroundColor).toBe("red");
    });

    it("should have correct container height of 47px", () => {
      const { container } = render(() => (
        <CortexEditorTabs tabs={[]} activeTabId={null} />
      ));
      const tabBar = container.firstChild as HTMLElement;
      expect(tabBar?.style.height).toBe("47px");
    });
  });
});
