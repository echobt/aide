import { useMutation } from '@tanstack/react-query'
import { api } from '@webview/network/actions-api'
import { logger } from '@webview/utils/logger'

export const useExportErrorLogs = () =>
  useMutation({
    mutationFn: () =>
      api.actions().server.system.openEditorWithLogs({
        actionParams: {
          webviewLogs: logger.logBuffer
        }
      })
  })
