import { vscode } from '@webview/utils/vscode'

const focusNotify = () => {
  window.addEventListener('focus', () => {
    vscode.postMessage({
      type: 'webview-focused'
    })
  })
}

export const initWebviewMessage = () => {
  focusNotify()
}
