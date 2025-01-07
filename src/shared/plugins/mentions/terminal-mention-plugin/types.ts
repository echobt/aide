import type { TerminalInfo } from '@extension/registers/terminal-watcher-register'
import type { Mention } from '@shared/entities'

import { MentionPluginId } from '../_base/types'

export type {
  TerminalInfo,
  TerminalCommand
} from '@extension/registers/terminal-watcher-register'

export enum TerminalMentionType {
  Terminals = `${MentionPluginId.Terminal}#terminals`,
  Terminal = `${MentionPluginId.Terminal}#terminal`
}

export type TerminalMention = Mention<
  TerminalMentionType.Terminal,
  TerminalInfo
>
