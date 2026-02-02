import { createContext, useContext, ParentComponent, createEffect } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { useTerminals } from "./TerminalsContext";
import { useSDK } from "./SDKContext";

export interface PreviewServer {
  url: string;
  port: number;
  name: string;
  terminalId?: string;
  detectedAt: number;
}

interface PreviewState {
  activeServer: PreviewServer | null;
  servers: PreviewServer[];
  showPreview: boolean;
  refreshKey: number;
}

interface PreviewContextValue {
  state: PreviewState;
  openPreview: (url: string, name?: string) => void;
  closePreview: () => void;
  togglePreview: () => void;
  refreshPreview: () => void;
  setActiveServer: (server: PreviewServer | null) => void;
}

const PreviewContext = createContext<PreviewContextValue>();

// Regex patterns to detect server URLs in terminal output
const SERVER_URL_PATTERNS = [
  // Common dev server patterns
  /(?:Local|Server|App|Dev|http)[:\s]+(?:running\s+(?:at|on)\s+)?(https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):\d+)/gi,
  /(?:listening|started|running)\s+(?:on|at)\s+(https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):\d+)/gi,
  /(?:ready|available)\s+(?:on|at)\s+(https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):\d+)/gi,
  // Vite
  /➜\s+Local:\s+(https?:\/\/(?:localhost|127\.0\.0\.1):\d+)/gi,
  // Next.js
  /ready\s+-\s+started.*on\s+(https?:\/\/(?:localhost|127\.0\.0\.1):\d+)/gi,
  // Generic port patterns
  /(https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):\d+)/gi,
];

// Extract port from URL
function extractPort(url: string): number {
  const match = url.match(/:(\d+)/);
  return match ? parseInt(match[1], 10) : 80;
}

// Normalize URL (convert 0.0.0.0 to localhost)
function normalizeUrl(url: string): string {
  return url.replace(/0\.0\.0\.0/, "localhost");
}

export const PreviewProvider: ParentComponent = (props) => {
  const terminals = useTerminals();
  const sdk = useSDK();
  
  const [state, setState] = createStore<PreviewState>({
    activeServer: null,
    servers: [],
    showPreview: false,
    refreshKey: 0,
  });

  // Detect server URLs from terminal output
  const detectServerFromOutput = (output: string, terminalId?: string): PreviewServer | null => {
    for (const pattern of SERVER_URL_PATTERNS) {
      // Reset regex lastIndex
      pattern.lastIndex = 0;
      const match = pattern.exec(output);
      if (match && match[1]) {
        const url = normalizeUrl(match[1]);
        const port = extractPort(url);
        
        // Skip common non-web ports
        if (port === 22 || port === 21 || port === 25) continue;
        
        return {
          url,
          port,
          name: `Server :${port}`,
          terminalId,
          detectedAt: Date.now(),
        };
      }
    }
    return null;
  };

  // Note: Terminal log-based server detection is not available with the new PTY-based terminal system.
  // Server URLs are now detected from SDK tool call outputs instead.
  // This could be enhanced in the future by having the PTY backend emit detected URLs.

  // Watch tool calls for server URLs (from Execute tool output)
  createEffect(() => {
    const messages = sdk.state.messages;
    
    for (const msg of messages) {
      if (msg.role !== "assistant") continue;
      
      for (const part of msg.parts) {
        if (part.type === "tool" && part.tool.output) {
          const server = detectServerFromOutput(part.tool.output);
          if (server) {
            const existing = state.servers.find(s => s.port === server.port);
            if (!existing) {
              setState(produce((s) => {
                s.servers.push(server);
                // Auto-open preview for new server
                if (!s.activeServer) {
                  s.activeServer = server;
                  s.showPreview = true;
                }
              }));
            }
          }
        }
      }
    }
  });

  // Clean up servers when terminals stop
  createEffect(() => {
    const terminalsList = terminals.state.terminals;
    
    setState(produce((s) => {
      s.servers = s.servers.filter(server => {
        if (!server.terminalId) return true;
        const terminal = terminalsList.find(t => t.id === server.terminalId);
        return terminal && terminal.status === "running";
      });
      
      // Clear active server if it was removed
      if (s.activeServer && !s.servers.find(srv => srv.port === s.activeServer!.port)) {
        s.activeServer = s.servers[0] || null;
        if (!s.activeServer) {
          s.showPreview = false;
        }
      }
    }));
  });

  // Clear preview when session changes
  let lastSessionId: string | null = null;
  createEffect(() => {
    const currentSessionId = sdk.state.currentSession?.id || null;
    
    // If session changed, clear the preview
    if (lastSessionId !== null && currentSessionId !== lastSessionId) {
      setState(produce((s) => {
        s.servers = [];
        s.activeServer = null;
        s.showPreview = false;
        s.refreshKey = 0;
      }));
    }
    
    lastSessionId = currentSessionId;
  });

  const openPreview = (url: string, name?: string) => {
    const normalizedUrl = normalizeUrl(url);
    const port = extractPort(normalizedUrl);
    
    const server: PreviewServer = {
      url: normalizedUrl,
      port,
      name: name || `Server :${port}`,
      detectedAt: Date.now(),
    };
    
    setState(produce((s) => {
      if (!s.servers.find(srv => srv.port === port)) {
        s.servers.push(server);
      }
      s.activeServer = server;
      s.showPreview = true;
    }));
  };

  const closePreview = () => {
    setState("showPreview", false);
  };

  const togglePreview = () => {
    setState("showPreview", !state.showPreview);
  };

  const refreshPreview = () => {
    setState("refreshKey", state.refreshKey + 1);
  };

  const setActiveServer = (server: PreviewServer | null) => {
    setState("activeServer", server);
    if (server) {
      setState("showPreview", true);
    }
  };

  return (
    <PreviewContext.Provider
      value={{
        state,
        openPreview,
        closePreview,
        togglePreview,
        refreshPreview,
        setActiveServer,
      }}
    >
      {props.children}
    </PreviewContext.Provider>
  );
};

export function usePreview() {
  const ctx = useContext(PreviewContext);
  if (!ctx) throw new Error("usePreview must be used within PreviewProvider");
  return ctx;
}
