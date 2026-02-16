import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, cleanup } from "@solidjs/testing-library";
import { CortexStatusBar } from "../CortexStatusBar";
import type { StatusBarItem, CortexStatusBarProps } from "../CortexStatusBar";

vi.mock("../primitives", () => ({
  CortexIcon: (props: { name: string; size?: number; color?: string }) => (
    <span data-testid={`icon-${props.name}`} data-size={props.size} />
  ),
  CortexTooltip: (props: { content: string; position?: string; children: import("solid-js").JSX.Element }) => (
    <div data-tooltip={props.content}>{props.children}</div>
  ),
}));

describe("CortexStatusBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  describe("Interfaces", () => {
    it("should have correct StatusBarItem interface structure", () => {
      const item: StatusBarItem = {
        id: "terminal",
        icon: "terminal",
        label: "Toggle Terminal",
        onClick: vi.fn(),
      };

      expect(item.id).toBe("terminal");
      expect(item.icon).toBe("terminal");
      expect(item.label).toBe("Toggle Terminal");
      expect(typeof item.onClick).toBe("function");
    });

    it("should have correct CortexStatusBarProps interface structure", () => {
      const props: CortexStatusBarProps = {
        projectType: "Docker",
        projectName: "my-project",
        leftItems: [{ id: "custom", icon: "star", label: "Custom" }],
        rightItems: [{ id: "layout", icon: "layout", label: "Layout" }],
        onProjectClick: vi.fn(),
        class: "custom-class",
        style: { height: "30px" },
      };

      expect(props.projectType).toBe("Docker");
      expect(props.projectName).toBe("my-project");
      expect(props.leftItems).toHaveLength(1);
      expect(props.rightItems).toHaveLength(1);
    });
  });

  describe("Rendering", () => {
    it("should render with default right items when none provided", () => {
      const { container } = render(() => <CortexStatusBar />);
      
      const layoutIcon = container.querySelector('[data-testid="icon-layout"]');
      const terminalIcon = container.querySelector('[data-testid="icon-terminal"]');
      const gitIcon = container.querySelector('[data-testid="icon-git"]');
      const infoIcon = container.querySelector('[data-testid="icon-info"]');
      
      expect(layoutIcon).toBeTruthy();
      expect(terminalIcon).toBeTruthy();
      expect(gitIcon).toBeTruthy();
      expect(infoIcon).toBeTruthy();
    });

    it("should render custom right items when provided", () => {
      const customItems: StatusBarItem[] = [
        { id: "custom1", icon: "star", label: "Star" },
        { id: "custom2", icon: "heart", label: "Heart" },
      ];

      const { container } = render(() => <CortexStatusBar rightItems={customItems} />);
      
      const starIcon = container.querySelector('[data-testid="icon-star"]');
      const heartIcon = container.querySelector('[data-testid="icon-heart"]');
      
      expect(starIcon).toBeTruthy();
      expect(heartIcon).toBeTruthy();
    });

    it("should render additional left items when provided", () => {
      const leftItems: StatusBarItem[] = [
        { id: "left1", icon: "bolt", label: "Bolt" },
      ];

      const { container } = render(() => <CortexStatusBar leftItems={leftItems} />);
      
      const boltIcon = container.querySelector('[data-testid="icon-bolt"]');
      expect(boltIcon).toBeTruthy();
    });

    it("should render project indicator", () => {
      const { container } = render(() => (
        <CortexStatusBar projectType="Docker" projectName="my-app" />
      ));
      
      expect(container.textContent).toContain("my-app");
    });

    it("should render default project name when not provided", () => {
      const { container } = render(() => <CortexStatusBar projectType="Node" />);
      expect(container.textContent).toContain("Node Project");
    });

    it("should render Docker as default project type", () => {
      const { container } = render(() => <CortexStatusBar />);
      expect(container.textContent).toContain("Docker Project");
    });
  });

  describe("Project Type Icons", () => {
    it("should render container icon for Docker project", () => {
      const { container } = render(() => <CortexStatusBar projectType="Docker" />);
      const containerIcon = container.querySelector('[data-testid="icon-container"]');
      expect(containerIcon).toBeTruthy();
    });

    it("should render box icon for Node project", () => {
      const { container } = render(() => <CortexStatusBar projectType="Node" />);
      const boxIcon = container.querySelector('[data-testid="icon-box"]');
      expect(boxIcon).toBeTruthy();
    });

    it("should render box icon for Rust project", () => {
      const { container } = render(() => <CortexStatusBar projectType="Rust" />);
      const boxIcon = container.querySelector('[data-testid="icon-box"]');
      expect(boxIcon).toBeTruthy();
    });

    it("should render box icon for Python project", () => {
      const { container } = render(() => <CortexStatusBar projectType="Python" />);
      const boxIcon = container.querySelector('[data-testid="icon-box"]');
      expect(boxIcon).toBeTruthy();
    });

    it("should render container icon for unknown project type", () => {
      const { container } = render(() => <CortexStatusBar projectType="Unknown" />);
      const containerIcon = container.querySelector('[data-testid="icon-container"]');
      expect(containerIcon).toBeTruthy();
    });
  });

  describe("User Interactions", () => {
    it("should call onClick when right item button is clicked", async () => {
      const onClick = vi.fn();
      const rightItems: StatusBarItem[] = [
        { id: "test", icon: "terminal", label: "Terminal", onClick },
      ];

      const { container } = render(() => <CortexStatusBar rightItems={rightItems} />);
      
      const button = container.querySelector('[aria-label="Terminal"]');
      if (button) {
        await fireEvent.click(button);
      }

      expect(onClick).toHaveBeenCalled();
    });

    it("should call onClick when left item button is clicked", async () => {
      const onClick = vi.fn();
      const leftItems: StatusBarItem[] = [
        { id: "test", icon: "bolt", label: "Bolt", onClick },
      ];

      const { container } = render(() => <CortexStatusBar leftItems={leftItems} />);
      
      const button = container.querySelector('[aria-label="Bolt"]');
      if (button) {
        await fireEvent.click(button);
      }

      expect(onClick).toHaveBeenCalled();
    });

    it("should call onProjectClick when project indicator is clicked", async () => {
      const onProjectClick = vi.fn();

      const { container } = render(() => (
        <CortexStatusBar projectType="Docker" onProjectClick={onProjectClick} />
      ));
      
      const projectIndicator = container.querySelector('[data-tooltip="Docker Project"]');
      const clickableDiv = projectIndicator?.querySelector("div");
      if (clickableDiv) {
        await fireEvent.click(clickableDiv);
      }

      expect(onProjectClick).toHaveBeenCalled();
    });
  });

  describe("Styling", () => {
    it("should apply custom class", () => {
      const { container } = render(() => <CortexStatusBar class="custom-class" />);
      const footer = container.querySelector("footer");
      expect(footer?.className).toContain("custom-class");
    });

    it("should apply custom style", () => {
      const { container } = render(() => (
        <CortexStatusBar style={{ "background-color": "green" }} />
      ));
      const footer = container.querySelector("footer");
      expect(footer?.style.backgroundColor).toBe("green");
    });

    it("should have correct container height of 28px", () => {
      const { container } = render(() => <CortexStatusBar />);
      const footer = container.querySelector("footer");
      expect(footer?.style.height).toBe("28px");
    });

    it("should have full width", () => {
      const { container } = render(() => <CortexStatusBar />);
      const footer = container.querySelector("footer");
      expect(footer?.style.width).toBe("100%");
    });
  });

  describe("Tooltips", () => {
    it("should have tooltip on icon buttons", () => {
      const { container } = render(() => <CortexStatusBar />);
      const tooltips = container.querySelectorAll("[data-tooltip]");
      expect(tooltips.length).toBeGreaterThan(0);
    });

    it("should have correct tooltip content on project indicator", () => {
      const { container } = render(() => <CortexStatusBar projectType="Docker" />);
      const projectTooltip = container.querySelector('[data-tooltip="Docker Project"]');
      expect(projectTooltip).toBeTruthy();
    });
  });
});
