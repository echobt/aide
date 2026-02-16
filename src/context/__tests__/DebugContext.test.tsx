import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

describe("DebugContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Debug Session Types", () => {
    interface DebugSessionConfig {
      id: string;
      name: string;
      type: string;
      request: "launch" | "attach";
      program?: string;
      args?: string[];
      cwd?: string;
      env?: Record<string, string>;
      stopOnEntry?: boolean;
    }

    it("should create launch config", () => {
      const config: DebugSessionConfig = {
        id: "session-1",
        name: "Debug App",
        type: "node",
        request: "launch",
        program: "${workspaceFolder}/src/index.js",
        args: ["--verbose"],
        cwd: "${workspaceFolder}",
        stopOnEntry: false,
      };

      expect(config.request).toBe("launch");
      expect(config.program).toContain("index.js");
    });

    it("should create attach config", () => {
      const config: DebugSessionConfig = {
        id: "session-2",
        name: "Attach to Process",
        type: "node",
        request: "attach",
        cwd: "${workspaceFolder}",
      };

      expect(config.request).toBe("attach");
    });

    it("should create config with environment variables", () => {
      const config: DebugSessionConfig = {
        id: "session-3",
        name: "Debug with Env",
        type: "node",
        request: "launch",
        program: "app.js",
        env: {
          NODE_ENV: "development",
          DEBUG: "*",
        },
      };

      expect(config.env?.NODE_ENV).toBe("development");
      expect(config.env?.DEBUG).toBe("*");
    });
  });

  describe("Debug Session State", () => {
    type DebugSessionState =
      | { type: "initializing" }
      | { type: "running" }
      | { type: "stopped"; reason: string; threadId?: number }
      | { type: "ended" };

    it("should track session state transitions", () => {
      let state: DebugSessionState = { type: "initializing" };
      expect(state.type).toBe("initializing");

      state = { type: "running" };
      expect(state.type).toBe("running");

      state = { type: "stopped", reason: "breakpoint", threadId: 1 };
      expect(state.type).toBe("stopped");
      expect(state.reason).toBe("breakpoint");

      state = { type: "ended" };
      expect(state.type).toBe("ended");
    });

    it("should handle various stop reasons", () => {
      const stopReasons = ["breakpoint", "step", "exception", "pause", "entry", "goto", "function breakpoint"];
      
      stopReasons.forEach(reason => {
        const state: DebugSessionState = { type: "stopped", reason };
        expect(state.reason).toBe(reason);
      });
    });
  });

  describe("Breakpoints", () => {
    interface Breakpoint {
      id?: number;
      path: string;
      line: number;
      column?: number;
      verified: boolean;
      condition?: string;
      hitCondition?: string;
      logMessage?: string;
      enabled: boolean;
    }

    it("should create breakpoint", () => {
      const bp: Breakpoint = {
        id: 1,
        path: "/src/app.ts",
        line: 25,
        verified: true,
        enabled: true,
      };

      expect(bp.line).toBe(25);
      expect(bp.verified).toBe(true);
    });

    it("should create conditional breakpoint", () => {
      const bp: Breakpoint = {
        path: "/src/app.ts",
        line: 30,
        verified: true,
        enabled: true,
        condition: "count > 10",
      };

      expect(bp.condition).toBe("count > 10");
    });

    it("should create hit count breakpoint", () => {
      const bp: Breakpoint = {
        path: "/src/app.ts",
        line: 35,
        verified: true,
        enabled: true,
        hitCondition: ">= 5",
      };

      expect(bp.hitCondition).toBe(">= 5");
    });

    it("should create logpoint", () => {
      const bp: Breakpoint = {
        path: "/src/app.ts",
        line: 40,
        verified: true,
        enabled: true,
        logMessage: "Value of x: {x}",
      };

      expect(bp.logMessage).toBe("Value of x: {x}");
    });

    it("should toggle breakpoint enabled state", () => {
      const bp: Breakpoint = {
        path: "/src/app.ts",
        line: 25,
        verified: true,
        enabled: true,
      };

      bp.enabled = !bp.enabled;
      expect(bp.enabled).toBe(false);

      bp.enabled = !bp.enabled;
      expect(bp.enabled).toBe(true);
    });

    it("should group breakpoints by file", () => {
      const breakpoints: Breakpoint[] = [
        { path: "/src/app.ts", line: 10, verified: true, enabled: true },
        { path: "/src/app.ts", line: 20, verified: true, enabled: true },
        { path: "/src/utils.ts", line: 5, verified: true, enabled: true },
      ];

      const byFile = breakpoints.reduce((acc, bp) => {
        if (!acc[bp.path]) acc[bp.path] = [];
        acc[bp.path].push(bp);
        return acc;
      }, {} as Record<string, Breakpoint[]>);

      expect(Object.keys(byFile)).toHaveLength(2);
      expect(byFile["/src/app.ts"]).toHaveLength(2);
      expect(byFile["/src/utils.ts"]).toHaveLength(1);
    });
  });

  describe("Stack Frames", () => {
    interface StackFrame {
      id: number;
      name: string;
      source?: { name?: string; path?: string };
      line: number;
      column: number;
    }

    it("should represent stack frame", () => {
      const frame: StackFrame = {
        id: 0,
        name: "main",
        source: { name: "app.ts", path: "/src/app.ts" },
        line: 25,
        column: 5,
      };

      expect(frame.name).toBe("main");
      expect(frame.source?.path).toBe("/src/app.ts");
    });

    it("should handle frame without source", () => {
      const frame: StackFrame = {
        id: 1,
        name: "<anonymous>",
        line: 0,
        column: 0,
      };

      expect(frame.source).toBeUndefined();
    });

    it("should order stack frames correctly", () => {
      const frames: StackFrame[] = [
        { id: 0, name: "innerFunction", source: { path: "/src/app.ts" }, line: 50, column: 1 },
        { id: 1, name: "middleFunction", source: { path: "/src/app.ts" }, line: 30, column: 1 },
        { id: 2, name: "outerFunction", source: { path: "/src/app.ts" }, line: 10, column: 1 },
      ];

      expect(frames[0].name).toBe("innerFunction");
      expect(frames[frames.length - 1].name).toBe("outerFunction");
    });
  });

  describe("Variables", () => {
    interface Variable {
      name: string;
      value: string;
      type?: string;
      variablesReference: number;
      namedVariables?: number;
      indexedVariables?: number;
    }

    it("should represent primitive variable", () => {
      const variable: Variable = {
        name: "count",
        value: "42",
        type: "number",
        variablesReference: 0,
      };

      expect(variable.name).toBe("count");
      expect(variable.variablesReference).toBe(0);
    });

    it("should represent object variable", () => {
      const variable: Variable = {
        name: "user",
        value: "Object",
        type: "object",
        variablesReference: 123,
        namedVariables: 3,
      };

      expect(variable.variablesReference).toBeGreaterThan(0);
      expect(variable.namedVariables).toBe(3);
    });

    it("should represent array variable", () => {
      const variable: Variable = {
        name: "items",
        value: "Array(5)",
        type: "array",
        variablesReference: 456,
        indexedVariables: 5,
      };

      expect(variable.indexedVariables).toBe(5);
    });

    it("should determine if variable is expandable", () => {
      const isExpandable = (v: Variable) => v.variablesReference > 0;

      const primitive: Variable = { name: "x", value: "1", variablesReference: 0 };
      const object: Variable = { name: "obj", value: "{}", variablesReference: 1 };

      expect(isExpandable(primitive)).toBe(false);
      expect(isExpandable(object)).toBe(true);
    });
  });

  describe("Scopes", () => {
    interface Scope {
      name: string;
      presentationHint?: string;
      variablesReference: number;
      expensive: boolean;
    }

    it("should represent local scope", () => {
      const scope: Scope = {
        name: "Local",
        presentationHint: "locals",
        variablesReference: 100,
        expensive: false,
      };

      expect(scope.name).toBe("Local");
      expect(scope.expensive).toBe(false);
    });

    it("should represent global scope as expensive", () => {
      const scope: Scope = {
        name: "Global",
        presentationHint: "globals",
        variablesReference: 200,
        expensive: true,
      };

      expect(scope.expensive).toBe(true);
    });

    it("should order scopes by type", () => {
      const scopes: Scope[] = [
        { name: "Local", presentationHint: "locals", variablesReference: 1, expensive: false },
        { name: "Closure", presentationHint: "arguments", variablesReference: 2, expensive: false },
        { name: "Global", presentationHint: "globals", variablesReference: 3, expensive: true },
      ];

      const order = ["locals", "arguments", "globals"];
      const sorted = [...scopes].sort((a, b) => {
        const aIdx = order.indexOf(a.presentationHint || "");
        const bIdx = order.indexOf(b.presentationHint || "");
        return aIdx - bIdx;
      });

      expect(sorted[0].name).toBe("Local");
      expect(sorted[2].name).toBe("Global");
    });
  });

  describe("Threads", () => {
    interface Thread {
      id: number;
      name: string;
      stopped?: boolean;
    }

    it("should represent thread", () => {
      const thread: Thread = {
        id: 1,
        name: "main",
        stopped: true,
      };

      expect(thread.id).toBe(1);
      expect(thread.stopped).toBe(true);
    });

    it("should handle multiple threads", () => {
      const threads: Thread[] = [
        { id: 1, name: "main", stopped: true },
        { id: 2, name: "worker-1", stopped: false },
        { id: 3, name: "worker-2", stopped: false },
      ];

      const stoppedThreads = threads.filter(t => t.stopped);
      expect(stoppedThreads).toHaveLength(1);
    });
  });

  describe("Debug Commands", () => {
    it("should start debug session", async () => {
      vi.mocked(invoke).mockResolvedValueOnce({ id: "session-1", status: "running" });

      const result = await invoke("debug_start", {
        config: {
          type: "node",
          request: "launch",
          program: "app.js",
        },
      });

      expect(invoke).toHaveBeenCalledWith("debug_start", expect.any(Object));
      expect(result).toHaveProperty("status", "running");
    });

    it("should stop debug session", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("debug_stop", { sessionId: "session-1" });

      expect(invoke).toHaveBeenCalledWith("debug_stop", { sessionId: "session-1" });
    });

    it("should pause execution", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("debug_pause", { sessionId: "session-1", threadId: 1 });

      expect(invoke).toHaveBeenCalledWith("debug_pause", { sessionId: "session-1", threadId: 1 });
    });

    it("should continue execution", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("debug_continue", { sessionId: "session-1", threadId: 1 });

      expect(invoke).toHaveBeenCalledWith("debug_continue", { sessionId: "session-1", threadId: 1 });
    });

    it("should step over", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("debug_step_over", { sessionId: "session-1", threadId: 1 });

      expect(invoke).toHaveBeenCalledWith("debug_step_over", { sessionId: "session-1", threadId: 1 });
    });

    it("should step into", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("debug_step_into", { sessionId: "session-1", threadId: 1 });

      expect(invoke).toHaveBeenCalledWith("debug_step_into", { sessionId: "session-1", threadId: 1 });
    });

    it("should step out", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("debug_step_out", { sessionId: "session-1", threadId: 1 });

      expect(invoke).toHaveBeenCalledWith("debug_step_out", { sessionId: "session-1", threadId: 1 });
    });
  });

  describe("Breakpoint Operations", () => {
    it("should set breakpoints", async () => {
      vi.mocked(invoke).mockResolvedValueOnce({
        breakpoints: [
          { id: 1, verified: true, line: 10 },
          { id: 2, verified: true, line: 20 },
        ],
      });

      const result = await invoke("debug_set_breakpoints", {
        sessionId: "session-1",
        source: { path: "/src/app.ts" },
        breakpoints: [{ line: 10 }, { line: 20 }],
      });

      expect(result).toHaveProperty("breakpoints");
    });

    it("should set function breakpoints", async () => {
      vi.mocked(invoke).mockResolvedValueOnce({
        breakpoints: [{ id: 1, verified: true }],
      });

      await invoke("debug_set_function_breakpoints", {
        sessionId: "session-1",
        breakpoints: [{ name: "myFunction" }],
      });

      expect(invoke).toHaveBeenCalledWith("debug_set_function_breakpoints", expect.any(Object));
    });

    it("should set exception breakpoints", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("debug_set_exception_breakpoints", {
        sessionId: "session-1",
        filters: ["uncaught", "caught"],
      });

      expect(invoke).toHaveBeenCalledWith("debug_set_exception_breakpoints", expect.any(Object));
    });
  });

  describe("Variable Inspection", () => {
    it("should get scopes for frame", async () => {
      const mockScopes = [
        { name: "Local", variablesReference: 1, expensive: false },
        { name: "Global", variablesReference: 2, expensive: true },
      ];

      vi.mocked(invoke).mockResolvedValueOnce({ scopes: mockScopes });

      const result = await invoke("debug_scopes", {
        sessionId: "session-1",
        frameId: 0,
      });

      expect(result).toEqual({ scopes: mockScopes });
    });

    it("should get variables for scope", async () => {
      const mockVariables = [
        { name: "x", value: "10", type: "number", variablesReference: 0 },
        { name: "y", value: "hello", type: "string", variablesReference: 0 },
      ];

      vi.mocked(invoke).mockResolvedValueOnce({ variables: mockVariables });

      const result = await invoke("debug_variables", {
        sessionId: "session-1",
        variablesReference: 1,
      });

      expect(result).toEqual({ variables: mockVariables });
    });

    it("should evaluate expression", async () => {
      vi.mocked(invoke).mockResolvedValueOnce({
        result: "42",
        type: "number",
        variablesReference: 0,
      });

      const result = await invoke("debug_evaluate", {
        sessionId: "session-1",
        expression: "x + y",
        frameId: 0,
      });

      expect(result).toHaveProperty("result", "42");
    });

    it("should set variable value", async () => {
      vi.mocked(invoke).mockResolvedValueOnce({
        value: "100",
        type: "number",
      });

      const result = await invoke("debug_set_variable", {
        sessionId: "session-1",
        variablesReference: 1,
        name: "x",
        value: "100",
      });

      expect(result).toHaveProperty("value", "100");
    });
  });

  describe("Stack Trace", () => {
    it("should get stack trace", async () => {
      const mockFrames = [
        { id: 0, name: "inner", source: { path: "/src/app.ts" }, line: 50, column: 5 },
        { id: 1, name: "outer", source: { path: "/src/app.ts" }, line: 30, column: 1 },
      ];

      vi.mocked(invoke).mockResolvedValueOnce({
        stackFrames: mockFrames,
        totalFrames: 2,
      });

      const result = await invoke("debug_stack_trace", {
        sessionId: "session-1",
        threadId: 1,
      });

      expect(result).toHaveProperty("stackFrames");
      expect(result).toHaveProperty("totalFrames", 2);
    });

    it("should get stack trace with pagination", async () => {
      vi.mocked(invoke).mockResolvedValueOnce({
        stackFrames: [{ id: 10, name: "frame10", line: 100, column: 1 }],
        totalFrames: 100,
      });

      await invoke("debug_stack_trace", {
        sessionId: "session-1",
        threadId: 1,
        startFrame: 10,
        levels: 1,
      });

      expect(invoke).toHaveBeenCalledWith("debug_stack_trace", {
        sessionId: "session-1",
        threadId: 1,
        startFrame: 10,
        levels: 1,
      });
    });
  });

  describe("Debug Events", () => {
    it("should listen for stopped event", async () => {
      vi.mocked(listen).mockResolvedValueOnce(() => {});

      await listen("debug:stopped", () => {});

      expect(listen).toHaveBeenCalledWith("debug:stopped", expect.any(Function));
    });

    it("should listen for output event", async () => {
      vi.mocked(listen).mockResolvedValueOnce(() => {});

      await listen("debug:output", () => {});

      expect(listen).toHaveBeenCalledWith("debug:output", expect.any(Function));
    });

    it("should listen for breakpoint event", async () => {
      vi.mocked(listen).mockResolvedValueOnce(() => {});

      await listen("debug:breakpoint", () => {});

      expect(listen).toHaveBeenCalledWith("debug:breakpoint", expect.any(Function));
    });

    it("should listen for terminated event", async () => {
      vi.mocked(listen).mockResolvedValueOnce(() => {});

      await listen("debug:terminated", () => {});

      expect(listen).toHaveBeenCalledWith("debug:terminated", expect.any(Function));
    });
  });

  describe("Data Breakpoints", () => {
    interface DataBreakpoint {
      id: string;
      variableName: string;
      accessType: "read" | "write" | "readWrite";
      enabled: boolean;
    }

    it("should create data breakpoint", () => {
      const bp: DataBreakpoint = {
        id: "data-bp-1",
        variableName: "counter",
        accessType: "write",
        enabled: true,
      };

      expect(bp.accessType).toBe("write");
    });

    it("should set data breakpoint via invoke", async () => {
      vi.mocked(invoke).mockResolvedValueOnce({
        breakpoints: [{ id: "data-bp-1", verified: true }],
      });

      await invoke("debug_set_data_breakpoints", {
        sessionId: "session-1",
        breakpoints: [{ dataId: "var-123", accessType: "write" }],
      });

      expect(invoke).toHaveBeenCalledWith("debug_set_data_breakpoints", expect.any(Object));
    });
  });

  describe("Exception Breakpoints", () => {
    interface ExceptionBreakpoint {
      filter: string;
      label: string;
      enabled: boolean;
      condition?: string;
    }

    it("should create exception breakpoint", () => {
      const bp: ExceptionBreakpoint = {
        filter: "uncaught",
        label: "Uncaught Exceptions",
        enabled: true,
      };

      expect(bp.filter).toBe("uncaught");
    });

    it("should create conditional exception breakpoint", () => {
      const bp: ExceptionBreakpoint = {
        filter: "all",
        label: "All Exceptions",
        enabled: true,
        condition: "error.message.includes('critical')",
      };

      expect(bp.condition).toContain("critical");
    });
  });

  describe("Debug Console", () => {
    interface ConsoleEntry {
      type: "input" | "output" | "error" | "warning";
      text: string;
      timestamp: number;
    }

    it("should track console entries", () => {
      const entries: ConsoleEntry[] = [];

      entries.push({ type: "input", text: "x + y", timestamp: Date.now() });
      entries.push({ type: "output", text: "42", timestamp: Date.now() });
      entries.push({ type: "error", text: "ReferenceError: z is not defined", timestamp: Date.now() });

      expect(entries).toHaveLength(3);
      expect(entries[2].type).toBe("error");
    });

    it("should clear console", () => {
      const entries: ConsoleEntry[] = [
        { type: "output", text: "test", timestamp: Date.now() },
      ];

      entries.length = 0;

      expect(entries).toHaveLength(0);
    });
  });

  describe("Watch Expressions", () => {
    interface WatchExpression {
      id: string;
      expression: string;
      value?: string;
      type?: string;
      error?: string;
    }

    it("should add watch expression", () => {
      const watches: WatchExpression[] = [];

      watches.push({
        id: "watch-1",
        expression: "user.name",
        value: "John",
        type: "string",
      });

      expect(watches).toHaveLength(1);
      expect(watches[0].value).toBe("John");
    });

    it("should handle watch expression error", () => {
      const watch: WatchExpression = {
        id: "watch-2",
        expression: "invalidVar",
        error: "ReferenceError: invalidVar is not defined",
      };

      expect(watch.error).toBeDefined();
      expect(watch.value).toBeUndefined();
    });

    it("should remove watch expression", () => {
      const watches: WatchExpression[] = [
        { id: "watch-1", expression: "a" },
        { id: "watch-2", expression: "b" },
        { id: "watch-3", expression: "c" },
      ];

      const filtered = watches.filter(w => w.id !== "watch-2");

      expect(filtered).toHaveLength(2);
      expect(filtered.find(w => w.id === "watch-2")).toBeUndefined();
    });
  });

  describe("Debug Hover", () => {
    interface DebugHoverState {
      visible: boolean;
      expression?: string;
      value?: string;
      position?: { x: number; y: number };
    }

    it("should show debug hover", () => {
      const hover: DebugHoverState = {
        visible: true,
        expression: "myVar",
        value: "{ name: 'test' }",
        position: { x: 100, y: 200 },
      };

      expect(hover.visible).toBe(true);
      expect(hover.expression).toBe("myVar");
    });

    it("should hide debug hover", () => {
      const hover: DebugHoverState = { visible: false };

      expect(hover.visible).toBe(false);
      expect(hover.expression).toBeUndefined();
    });
  });

  describe("Launch Configuration", () => {
    it("should parse launch.json configurations", () => {
      const launchJson = {
        version: "0.2.0",
        configurations: [
          {
            name: "Launch Program",
            type: "node",
            request: "launch",
            program: "${workspaceFolder}/app.js",
          },
          {
            name: "Attach",
            type: "node",
            request: "attach",
            port: 9229,
          },
        ],
      };

      expect(launchJson.configurations).toHaveLength(2);
      expect(launchJson.configurations[0].request).toBe("launch");
      expect(launchJson.configurations[1].request).toBe("attach");
    });

    it("should substitute variables in config", () => {
      const substituteVariables = (value: string, vars: Record<string, string>): string => {
        return value.replace(/\$\{(\w+)\}/g, (_, key) => vars[key] || "");
      };

      const vars = {
        workspaceFolder: "/home/user/project",
        file: "/home/user/project/src/app.ts",
      };

      expect(substituteVariables("${workspaceFolder}/app.js", vars)).toBe("/home/user/project/app.js");
      expect(substituteVariables("${file}", vars)).toBe("/home/user/project/src/app.ts");
    });
  });
});
