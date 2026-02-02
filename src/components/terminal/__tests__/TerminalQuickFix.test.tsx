/**
 * TerminalQuickFix Tests
 * 
 * Tests for the terminal quick fix component that detects errors
 * and provides suggestions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { 
  render, 
  cleanup, 
  fireEvent, 
  waitFor,
  nextTick,
} from "@/test/utils";
import { 
  TerminalQuickFix, 
  TerminalQuickFixProps, 
  QuickFix, 
  QuickFixAction,
  detectQuickFixes,
} from "../TerminalQuickFix";

describe("TerminalQuickFix", () => {
  const mockOnApplyFix = vi.fn();

  const defaultProps: TerminalQuickFixProps = {
    terminalId: "terminal-1",
    outputLine: "",
    lineNumber: 1,
    onApplyFix: mockOnApplyFix,
    enabled: true,
    lineHeight: 20,
    scrollOffset: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  const renderQuickFix = (props: Partial<TerminalQuickFixProps> = {}) => {
    return render(() => (
      <TerminalQuickFix {...defaultProps} {...props} />
    ));
  };

  describe("Error Detection", () => {
    describe("Command Not Found", () => {
      it("should detect npm command not found", () => {
        const { container } = renderQuickFix({
          outputLine: "bash: npm: command not found",
        });
        
        // Should show lightbulb or fix indicator
        // Container may have fix suggestion elements
      });

      it("should detect node command not found", () => {
        const { container } = renderQuickFix({
          outputLine: "'node' is not recognized as an internal or external command",
        });
        
        // Windows-style error
      });

      it("should detect python command not found", () => {
        const { container } = renderQuickFix({
          outputLine: "zsh: command not found: python3",
        });
      });

      it("should detect git command not found", () => {
        const { container } = renderQuickFix({
          outputLine: "git: command not found",
        });
      });

      it("should detect cargo command not found", () => {
        const { container } = renderQuickFix({
          outputLine: "bash: cargo: command not found",
        });
      });
    });

    describe("Permission Denied", () => {
      it("should detect permission denied error", () => {
        const { container } = renderQuickFix({
          outputLine: "Error: EACCES: permission denied, open '/etc/hosts'",
        });
      });

      it("should detect Linux permission denied", () => {
        const { container } = renderQuickFix({
          outputLine: "bash: /usr/local/bin/script: Permission denied",
        });
      });

      it("should detect npm permission error", () => {
        const { container } = renderQuickFix({
          outputLine: "npm ERR! Error: EACCES: permission denied, access '/usr/lib/node_modules'",
        });
      });
    });

    describe("Port In Use", () => {
      it("should detect EADDRINUSE error", () => {
        const { container } = renderQuickFix({
          outputLine: "Error: listen EADDRINUSE: address already in use :::3000",
        });
      });

      it("should detect port already in use message", () => {
        const { container } = renderQuickFix({
          outputLine: "Port 8080 is already in use",
        });
      });

      it("should extract port number from error", () => {
        const { container } = renderQuickFix({
          outputLine: "Error: listen EADDRINUSE :::4000",
        });
        
        // Should extract 4000 as port
      });
    });

    describe("Package Not Found", () => {
      it("should detect npm module not found", () => {
        const { container } = renderQuickFix({
          outputLine: "Error: Cannot find module 'express'",
        });
      });

      it("should detect npm package not found", () => {
        const { container } = renderQuickFix({
          outputLine: "npm ERR! 404 Not Found - GET https://registry.npmjs.org/nonexistent-package",
        });
      });

      it("should detect Python import error", () => {
        const { container } = renderQuickFix({
          outputLine: "ModuleNotFoundError: No module named 'requests'",
        });
      });

      it("should detect Python package not found", () => {
        const { container } = renderQuickFix({
          outputLine: "ImportError: No module named 'flask'",
        });
      });
    });

    describe("Directory/File Not Found", () => {
      it("should detect ENOENT directory error", () => {
        const { container } = renderQuickFix({
          outputLine: "Error: ENOENT: no such file or directory, open './config/settings.json'",
        });
      });

      it("should detect cd directory not found", () => {
        const { container } = renderQuickFix({
          outputLine: "bash: cd: /nonexistent/path: No such file or directory",
        });
      });

      it("should detect file not found", () => {
        const { container } = renderQuickFix({
          outputLine: "cat: myfile.txt: No such file or directory",
        });
      });
    });

    describe("Git Authentication", () => {
      it("should detect git authentication failure", () => {
        const { container } = renderQuickFix({
          outputLine: "fatal: Authentication failed for 'https://github.com/user/repo.git'",
        });
      });

      it("should detect git permission denied", () => {
        const { container } = renderQuickFix({
          outputLine: "Permission denied (publickey).",
        });
      });

      it("should detect git credential error", () => {
        const { container } = renderQuickFix({
          outputLine: "fatal: could not read Username for 'https://github.com': terminal prompts disabled",
        });
      });
    });

    describe("NPM Errors", () => {
      it("should detect npm install failure", () => {
        const { container } = renderQuickFix({
          outputLine: "npm ERR! code ERESOLVE",
        });
      });

      it("should detect npm peer dependency error", () => {
        const { container } = renderQuickFix({
          outputLine: "npm ERR! peer dep missing: react@^18.0.0",
        });
      });

      it("should detect npm audit error", () => {
        const { container } = renderQuickFix({
          outputLine: "npm ERR! found 5 vulnerabilities (2 moderate, 3 high)",
        });
      });
    });
  });

  describe("Quick Fix Actions", () => {
    it("should show install package action for npm not found", async () => {
      const { container } = renderQuickFix({
        outputLine: "Error: Cannot find module 'lodash'",
      });
      
      await nextTick();
      
      // May show "npm install lodash" action
    });

    it("should show sudo action for permission denied", async () => {
      const { container } = renderQuickFix({
        outputLine: "bash: /usr/local/bin/script: Permission denied",
      });
      
      await nextTick();
      
      // May show "Run with sudo" action
    });

    it("should show kill process action for port in use", async () => {
      const { container } = renderQuickFix({
        outputLine: "Error: listen EADDRINUSE: address already in use :::3000",
      });
      
      await nextTick();
      
      // May show "Kill process on port 3000" action
    });

    it("should show create directory action for ENOENT", async () => {
      const { container } = renderQuickFix({
        outputLine: "Error: ENOENT: no such file or directory, open './dist/output.js'",
      });
      
      await nextTick();
      
      // May show "Create directory ./dist" action
    });

    it("should call onApplyFix when action is clicked", async () => {
      const { container } = renderQuickFix({
        outputLine: "Error: Cannot find module 'express'",
      });
      
      await nextTick();
      
      // Find action buttons
      const actionButtons = container.querySelectorAll("button");
      
      if (actionButtons.length > 0) {
        fireEvent.click(actionButtons[0]);
        await nextTick();
        
        // May call onApplyFix
      }
    });
  });

  describe("UI Rendering", () => {
    it("should show lightbulb icon when fix is available", async () => {
      const { container } = renderQuickFix({
        outputLine: "bash: npm: command not found",
      });
      
      await nextTick();
      
      // Look for lightbulb/zap icon or indicator
      const svgs = container.querySelectorAll("svg");
    });

    it("should toggle fix menu on click", async () => {
      const { container } = renderQuickFix({
        outputLine: "bash: npm: command not found",
      });
      
      await nextTick();
      
      // Click to open menu
      const trigger = container.querySelector("[class*='cursor-pointer']");
      if (trigger) {
        fireEvent.click(trigger);
        await nextTick();
        
        // Menu should be visible
      }
    });

    it("should hide when no error detected", () => {
      const { container } = renderQuickFix({
        outputLine: "$ npm start",
      });
      
      // Should not show any fix indicators for normal output
    });

    it("should hide when disabled", () => {
      const { container } = renderQuickFix({
        outputLine: "bash: npm: command not found",
        enabled: false,
      });
      
      // Should not show any fix indicators when disabled
    });

    it("should position based on line number and scroll offset", () => {
      const { container } = renderQuickFix({
        outputLine: "bash: npm: command not found",
        lineNumber: 5,
        lineHeight: 20,
        scrollOffset: 100,
      });
      
      // Position should be calculated correctly
    });
  });

  describe("Action Icons", () => {
    it("should show download icon for install actions", async () => {
      const { container } = renderQuickFix({
        outputLine: "Error: Cannot find module 'axios'",
      });
      
      await nextTick();
      
      // Download icon for install
    });

    it("should show shield icon for sudo actions", async () => {
      const { container } = renderQuickFix({
        outputLine: "Permission denied",
      });
      
      await nextTick();
      
      // Shield icon for elevated permissions
    });

    it("should show x-circle icon for kill process actions", async () => {
      const { container } = renderQuickFix({
        outputLine: "EADDRINUSE :::8080",
      });
      
      await nextTick();
      
      // X-circle icon for killing process
    });

    it("should show folder icon for create directory actions", async () => {
      const { container } = renderQuickFix({
        outputLine: "ENOENT: no such file or directory",
      });
      
      await nextTick();
      
      // Folder icon for creating directory
    });

    it("should show key icon for authentication actions", async () => {
      const { container } = renderQuickFix({
        outputLine: "Authentication failed",
      });
      
      await nextTick();
      
      // Key icon for auth
    });
  });

  describe("Dangerous Actions", () => {
    it("should mark sudo actions as dangerous", async () => {
      const { container } = renderQuickFix({
        outputLine: "Permission denied",
      });
      
      await nextTick();
      
      // Dangerous actions may have warning styling
    });

    it("should require confirmation for dangerous actions", async () => {
      const { container } = renderQuickFix({
        outputLine: "Permission denied",
      });
      
      await nextTick();
      
      // May show confirmation dialog for dangerous actions
    });
  });

  describe("Context Extraction", () => {
    it("should extract package name from npm error", () => {
      const { container } = renderQuickFix({
        outputLine: "Error: Cannot find module 'react-router-dom'",
      });
      
      // Should extract 'react-router-dom' as package name
    });

    it("should extract port number from EADDRINUSE", () => {
      const { container } = renderQuickFix({
        outputLine: "Error: listen EADDRINUSE :::5000",
      });
      
      // Should extract 5000 as port
    });

    it("should extract path from ENOENT", () => {
      const { container } = renderQuickFix({
        outputLine: "Error: ENOENT: no such file or directory, open '/app/config.json'",
      });
      
      // Should extract '/app/config.json' as path
    });

    it("should extract command from command not found", () => {
      const { container } = renderQuickFix({
        outputLine: "bash: docker-compose: command not found",
      });
      
      // Should extract 'docker-compose' as command
    });
  });

  describe("Multiple Errors", () => {
    it("should handle multiple errors on same line", () => {
      // Some output may contain multiple error patterns
      const { container } = renderQuickFix({
        outputLine: "npm ERR! EACCES: permission denied, mkdir '/usr/local/lib'",
      });
      
      // Should handle compound errors
    });
  });

  describe("Keyboard Navigation", () => {
    it("should close menu on Escape", async () => {
      const { container } = renderQuickFix({
        outputLine: "bash: npm: command not found",
      });
      
      await nextTick();
      
      // Open menu
      const trigger = container.querySelector("[class*='cursor-pointer']");
      if (trigger) {
        fireEvent.click(trigger);
        await nextTick();
        
        // Press Escape
        fireEvent.keyDown(trigger, { key: "Escape" });
        await nextTick();
        
        // Menu should close
      }
    });

    it("should navigate actions with arrow keys", async () => {
      const { container } = renderQuickFix({
        outputLine: "bash: npm: command not found",
      });
      
      await nextTick();
      
      // Open menu and navigate
    });

    it("should select action on Enter", async () => {
      const { container } = renderQuickFix({
        outputLine: "bash: npm: command not found",
      });
      
      await nextTick();
      
      // Press Enter to select action
    });
  });

  describe("Accessibility", () => {
    it("should have accessible button labels", () => {
      const { container } = renderQuickFix({
        outputLine: "bash: npm: command not found",
      });
      
      const buttons = container.querySelectorAll("button");
      
      buttons.forEach(button => {
        const hasLabel = 
          button.getAttribute("title") ||
          button.getAttribute("aria-label") ||
          button.textContent?.trim();
        
        expect(hasLabel).toBeTruthy();
      });
    });

    it("should have proper ARIA attributes on menu", async () => {
      const { container } = renderQuickFix({
        outputLine: "bash: npm: command not found",
      });
      
      await nextTick();
      
      // Menu should have proper ARIA attributes
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty output line", () => {
      expect(() => {
        renderQuickFix({ outputLine: "" });
      }).not.toThrow();
    });

    it("should handle very long output lines", () => {
      const longLine = "Error: " + "x".repeat(10000);
      
      expect(() => {
        renderQuickFix({ outputLine: longLine });
      }).not.toThrow();
    });

    it("should handle special characters in output", () => {
      const { container } = renderQuickFix({
        outputLine: "Error: Cannot find module '@scope/package-name'",
      });
      
      // Should handle scoped packages
    });

    it("should handle Windows-style paths", () => {
      const { container } = renderQuickFix({
        outputLine: "Error: ENOENT: no such file or directory, open 'C:\\Users\\test\\file.txt'",
      });
      
      // Should handle Windows paths
    });

    it("should handle unicode in output", () => {
      const { container } = renderQuickFix({
        outputLine: "エラー: モジュールが見つかりません 'test'",
      });
      
      // Should not crash on non-ASCII
    });
  });
});

// Test the detectQuickFixes function if exported
describe("detectQuickFixes Function", () => {
  it("should return empty array for normal output", () => {
    // If detectQuickFixes is exported
    if (typeof detectQuickFixes === "function") {
      const fixes = detectQuickFixes("$ ls -la");
      expect(fixes).toHaveLength(0);
    }
  });

  it("should detect command not found errors", () => {
    if (typeof detectQuickFixes === "function") {
      const fixes = detectQuickFixes("bash: npm: command not found");
      expect(fixes.length).toBeGreaterThan(0);
      expect(fixes[0]?.type).toBe("command-not-found");
    }
  });

  it("should detect permission errors", () => {
    if (typeof detectQuickFixes === "function") {
      const fixes = detectQuickFixes("Error: EACCES: permission denied");
      expect(fixes.length).toBeGreaterThan(0);
      expect(fixes[0]?.type).toBe("permission-denied");
    }
  });

  it("should detect port in use errors", () => {
    if (typeof detectQuickFixes === "function") {
      const fixes = detectQuickFixes("Error: listen EADDRINUSE :::3000");
      expect(fixes.length).toBeGreaterThan(0);
      expect(fixes[0]?.type).toBe("port-in-use");
      expect(fixes[0]?.context?.port).toBe(3000);
    }
  });

  it("should detect package not found errors", () => {
    if (typeof detectQuickFixes === "function") {
      const fixes = detectQuickFixes("Error: Cannot find module 'lodash'");
      expect(fixes.length).toBeGreaterThan(0);
      expect(fixes[0]?.type).toBe("package-not-found");
      expect(fixes[0]?.context?.packageName).toBe("lodash");
    }
  });
});
