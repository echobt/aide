import type { ActionRegister } from '@extension/registers/action-register'
import type { Mention } from '@shared/entities'
import type { MentionServerUtilsProvider } from '@shared/plugins/mentions/_base/server/create-mention-provider-manager'

import { DocMentionType } from '../types'

export class DocMentionServerUtilsProvider
  implements MentionServerUtilsProvider
{
  async createRefreshMentionFn(actionRegister: ActionRegister) {
    const docSites = await actionRegister.actions().server.doc.getDocSites({
      actionParams: {}
    })

    // Create a map of doc site names for quick lookup
    const docSiteMap = new Map<string, string>()
    for (const site of docSites) {
      docSiteMap.set(site.name, site.name)
    }

    return (_mention: Mention) => {
      const mention = { ..._mention } as Mention
      switch (mention.type) {
        case DocMentionType.Doc:
          const siteName = docSiteMap.get(mention.data)
          if (siteName) mention.data = siteName
          break
        default:
          break
      }

      return mention
    }
  }
}
