import type { Mention } from '@shared/entities'

import { MentionPluginId } from '../_base/types'

export enum WebMentionType {
  Web = `${MentionPluginId.Web}#web`
}

export type WebMention = Mention<WebMentionType.Web, boolean>
