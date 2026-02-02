/**
 * MCP (Model Context Protocol) Listeners
 * 
 * These listeners enable AI agents to interact with the Cortex Desktop webview.
 * They respond to events from the Tauri backend MCP server.
 */

import { emit } from '@tauri-apps/api/event';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';

let executeJsUnlisten: (() => void) | null = null;
let getDomUnlisten: (() => void) | null = null;

/**
 * Set up MCP event listeners for the current window
 */
export async function setupMcpListeners() {
  const currentWindow = getCurrentWebviewWindow();
  
  // Listen for JavaScript execution requests
  executeJsUnlisten = await currentWindow.listen('mcp-execute-js', handleExecuteJs);
  
  // Listen for DOM content requests
  getDomUnlisten = await currentWindow.listen('mcp-get-dom', handleGetDom);
  
  console.log('[MCP] Event listeners set up for execute-js and get-dom');
}

/**
 * Clean up MCP event listeners
 */
export function cleanupMcpListeners() {
  if (executeJsUnlisten) {
    executeJsUnlisten();
    executeJsUnlisten = null;
  }
  if (getDomUnlisten) {
    getDomUnlisten();
    getDomUnlisten = null;
  }
  console.log('[MCP] Event listeners cleaned up');
}

/**
 * Handle JavaScript execution request from MCP
 * 
 * SECURITY: This function is disabled in production builds to prevent
 * arbitrary code execution attacks via the MCP socket.
 */
async function handleExecuteJs(event: { payload: string }) {
  console.log('[MCP] Received execute-js request');
  
  // SECURITY: Only allow JS execution in development mode
  // In production, this could be exploited for arbitrary code execution
  // @ts-expect-error - __DEV__ is defined in vite.config.ts
  if (typeof __DEV__ !== 'undefined' && !__DEV__) {
    console.warn('[MCP] execute-js is disabled in production for security reasons');
    await emit('mcp-execute-js-response', {
      success: false,
      error: 'JavaScript execution via MCP is disabled in production builds',
      type: 'error'
    });
    return;
  }
  
  try {
    const code = event.payload;
    
    // Additional safety: Block obviously dangerous patterns even in dev
    const dangerousPatterns = [
      /\bfetch\s*\(/i,
      /\bXMLHttpRequest\b/i,
      /\bWebSocket\b/i,
      /\bdocument\.cookie\b/i,
      /\blocalStorage\b/i,
      /\bsessionStorage\b/i,
      /\bindexedDB\b/i,
    ];
    
    if (dangerousPatterns.some(pattern => pattern.test(code))) {
      throw new Error('Code contains potentially dangerous operations');
    }
    
    // Execute the code using Function constructor (safer than eval)
    let result: unknown;
    try {
      // Try as expression first
      result = new Function(`return (${code})`)();
    } catch {
      // Fall back to statement execution
      result = new Function(code)();
    }
    
    // Prepare response
    const response = {
      success: true,
      result: result === undefined ? null : result,
      type: typeof result
    };
    
    await emit('mcp-execute-js-response', response);
    console.log('[MCP] Emitted execute-js-response (success)');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    await emit('mcp-execute-js-response', {
      success: false,
      error: errorMessage,
      type: 'error'
    });
    console.error('[MCP] Emitted execute-js-response (error):', errorMessage);
  }
}

/**
 * Handle DOM content request from MCP
 */
async function handleGetDom(event: { payload: { selector?: string } }) {
  console.log('[MCP] Received get-dom request');
  
  try {
    const { selector } = event.payload || {};
    
    let html: string;
    if (selector) {
      const element = document.querySelector(selector);
      html = element ? element.outerHTML : '';
    } else {
      html = document.documentElement.outerHTML;
    }
    
    await emit('mcp-get-dom-response', {
      success: true,
      html
    });
    console.log('[MCP] Emitted get-dom-response (success), length:', html.length);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    await emit('mcp-get-dom-response', {
      success: false,
      error: errorMessage
    });
    console.error('[MCP] Emitted get-dom-response (error):', errorMessage);
  }
}
