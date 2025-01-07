import type { Mention } from '@shared/entities'

import { MentionPluginId } from '../_base/types'

export enum DocMentionType {
  Docs = `${MentionPluginId.Doc}#docs`,
  Doc = `${MentionPluginId.Doc}#doc`,
  DocSetting = `${MentionPluginId.Doc}#doc-setting`
}

export type DocMention = Mention<DocMentionType.Doc, string>
