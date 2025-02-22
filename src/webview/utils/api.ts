import { api } from '@webview/network/actions-api'

export const openLink = async (url: string) => {
  await api.actions().server.system.openLink({
    actionParams: {
      url
    }
  })
}

export const copyToClipboard = async (text: string) => {
  await api.actions().server.system.copyToClipboard({
    actionParams: {
      text
    }
  })
}
