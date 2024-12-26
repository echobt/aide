import { logger } from '@extension/logger'
import * as vscode from 'vscode'

import type { WebviewState } from './types'

export const DEV_SERVER = process.env.VITE_DEV_SERVER_URL
export const setupHtml = (
  state: WebviewState,
  webview: vscode.Webview,
  context: vscode.ExtensionContext
) => {
  let html = ''

  if (DEV_SERVER) {
    html = __getWebviewHtml__(DEV_SERVER)
  } else {
    html = __getWebviewHtml__(webview, context)

    const baseUri = vscode.Uri.joinPath(
      context.extensionUri,
      process.env.VITE_WEBVIEW_DIST || 'dist'
    )

    const injectScriptRegex =
      /(<script[\w\W]*?>\s*)(\/\*\s*inject\s+script\s*\*\/)(\s*<\/script>)/g
    const injectScriptContent = `
    window.__assetsPath = filename => {
        const baseUrl = document.baseURI;
        return baseUrl + (filename.startsWith('/') ? filename.slice(1) : filename);
    }
    `
    html = html
      .replace(
        /\s+(href|src)="(.+?)"/g,
        (_, attr, url) =>
          ` ${attr}="${webview.asWebviewUri(vscode.Uri.joinPath(baseUri, url))}"`
      )
      .replace(injectScriptRegex, `$1${injectScriptContent}$3`)
  }

  html = mergeStateIntoHtml(html, state)

  return html
}

export const mergeStateIntoHtml = (
  html: string,
  newState: Record<string, any>
): string => {
  // Regular expression to match and capture the vscodeWebviewState object in the HTML
  const regex =
    /(<script class="vscode-webview-state">[\s\S]*?window\.vscodeWebviewState\s*=\s*)(\{[^}]*\})([\s\S]*?<\/script>)/

  if (regex.test(html)) {
    // If the script tag exists, merge the state
    return html.replace(regex, (match, prefix, existingStateStr, suffix) => {
      let existingState: Record<string, any> = {}

      try {
        // Attempt to parse the existing state object
        // eslint-disable-next-line @typescript-eslint/no-implied-eval
        existingState = Function(`return ${existingStateStr}`)()
      } catch (error) {
        logger.warn(
          'Failed to parse existing state, using empty object:',
          error
        )
      }

      // Merge the existing state with the new state
      const mergedState = { ...existingState, ...newState }

      // Convert the merged state to a string, maintaining good formatting
      const mergedStateStr = JSON.stringify(mergedState, null, 2)
        .replace(/^/gm, '    ') // Add indentation
        .replace(/\n/g, '\n    ') // Maintain consistent indentation

      // Return the updated script tag with the merged state
      return `${prefix}${mergedStateStr}${suffix}`
    })
  }
  // If the script tag doesn't exist, create a new one and insert it before </head>
  const stateScript = `
  <script class="vscode-webview-state">
    window.vscodeWebviewState = ${JSON.stringify(newState, null, 2)}
  </script>`

  html = html.replace(
    /(<html[\w\W]*?>\s*<head>\s*)([\w\W]+?)(<)/,
    `$1${stateScript}\n$3`
  )

  if (DEV_SERVER) {
    // for vite dev server, we need to set the state to the window.name via iframe
    const iframeTagInnerCode = `
    name = ${JSON.stringify(newState)}
    `
    html = html.replace(
      /(<iframe\s+)([\w\W]+?>)/,
      `$1${iframeTagInnerCode}\n$2`
    )
  }

  return html
}
