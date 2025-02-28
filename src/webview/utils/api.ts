import { api } from '@webview/network/actions-api'

import { logAndToastError } from './common'

export const openLink = async (url: string) => {
  try {
    await api.actions().server.system.openLink({
      actionParams: {
        url
      }
    })
  } catch (error) {
    logAndToastError('Failed to open link', error)
  }
}

export const copyToClipboard = async (text: string) => {
  try {
    await api.actions().server.system.copyToClipboard({
      actionParams: {
        text
      }
    })
  } catch (error) {
    logAndToastError('Failed to copy to clipboard', error)
  }
}
