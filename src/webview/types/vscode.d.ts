import type { WebviewToExtensionsMsg } from '@shared/types'

import type { WebviewState } from './chat'

declare global {
  interface Window {
    acquireVsCodeApi(): {
      postMessage(msg: WebviewToExtensionsMsg): void
      setState(state: any): void
      getState(): any
    }
    vscode: ReturnType<typeof window.acquireVsCodeApi>
    vscodeWebviewState?: WebviewState
    sessionIdSendMessageAbortControllerMap?: Record<string, AbortController>
  }
}
