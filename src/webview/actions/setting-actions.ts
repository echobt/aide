import { ClientActionCollection } from '@shared/actions/client-action-collection'
import type { ActionContext } from '@shared/actions/types'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import { emitter } from './utils/emitter'
import { useOn } from './utils/use-on'

export class SettingActionsCollection extends ClientActionCollection {
  readonly categoryName = 'setting'

  openSettingPage(
    context: ActionContext<{
      settingPageId: string
      toastMessage?: string
    }>
  ) {
    emitter.emit('setting.openSettingPage', context)
  }
}

export const useSettingActions = () => {
  const navigate = useNavigate()

  useOn('setting.openSettingPage', context => {
    const { toastMessage, settingPageId } = context.actionParams

    if (toastMessage) {
      toast.info(toastMessage)
    }

    navigate(`/settings?pageId=${settingPageId}`)
  })
}
