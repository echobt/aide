import type { ActionRegister } from '@extension/registers/action-register'
import type { Mention } from '@shared/entities'
import type { MentionUtilsProvider } from '@shared/plugins/base/server/create-provider-manager'

import { WebMentionType } from '../types'

export class WebMentionUtilsProvider implements MentionUtilsProvider {
  // eslint-disable-next-line unused-imports/no-unused-vars
  async createRefreshMentionFn(actionRegister: ActionRegister) {
    return (_mention: Mention) => {
      const mention = { ..._mention } as Mention
      switch (mention.type) {
        case WebMentionType.Web:
          // Web mention is just a boolean flag, no need to refresh
          break
        default:
          break
      }
      return mention
    }
  }
}
