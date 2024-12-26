import type { WebviewState } from '@extension/registers/webview-register/types'
import type { WebviewToExtensionsMsg } from '@shared/types'

declare global {
  interface Window {
    acquireVsCodeApi(): {
      postMessage(msg: WebviewToExtensionsMsg): void
      setState(state: any): void
      getState(): any
    }
    vscode: ReturnType<typeof window.acquireVsCodeApi>
    vscodeWebviewState?: WebviewState
  }
}
