import { ActionRegister } from '@extension/registers/action-register'
import { ServerPluginRegister } from '@extension/registers/server-plugin-register'
import { ServerActionCollection } from '@shared/actions/server-action-collection'
import type { ActionContext } from '@shared/actions/types'
import type { Conversation, Mention } from '@shared/entities'
import type {
  RefreshMentionFn,
  ServerUtilsProvider
} from '@shared/plugins/base/server/create-provider-manager'
import { settledPromiseResults, tryParseJSON } from '@shared/utils/common'

export class MentionActionsCollection extends ServerActionCollection {
  readonly categoryName = 'mention'

  private getServerUtilsProviders(): ServerUtilsProvider[] {
    const serverPluginRegister =
      this.registerManager.getRegister(ServerPluginRegister)
    const serverUtilsProviders =
      serverPluginRegister?.serverPluginRegistry?.providerManagers.serverUtils.getValues()

    if (!serverUtilsProviders) {
      throw new Error('ServerUtilsProviders not found')
    }

    return serverUtilsProviders
  }

  private async createCompositeRefreshFunction(): Promise<RefreshMentionFn> {
    // Get mention utils providers
    const serverUtilsProviders = this.getServerUtilsProviders()

    // Get controller register
    const actionRegister = this.registerManager.getRegister(ActionRegister)
    if (!actionRegister) {
      throw new Error('ActionRegister not found')
    }

    // Create refresh functions from all providers
    const refreshFunctions = await settledPromiseResults(
      serverUtilsProviders.map(
        async provider => await provider.createRefreshMentionFn(actionRegister)
      )
    )

    return (mention: Mention) =>
      refreshFunctions.reduce(
        (updatedMention, refreshFn) => refreshFn(updatedMention),
        mention
      )
  }

  async getUpdatedRichTextMentions(
    context: ActionContext<{ richText: string }>
  ): Promise<{
    richText: string
    mentions: Mention[]
  }> {
    const { richText } = context.actionParams

    const compositeRefreshFn = await this.createCompositeRefreshFunction()

    const editorState = tryParseJSON(richText || '{}') as {
      root: LexicalNode
    }
    const collectedMentions: Mention[] = []

    const updatedEditorStateRoot = traverseLexicalMentionNode(
      editorState?.root,
      mention => {
        const updatedMention = compositeRefreshFn(mention)
        collectedMentions.push(updatedMention)
        return updatedMention
      }
    )
    const updatedEditorState = {
      ...editorState,
      root: updatedEditorStateRoot
    }

    return {
      richText: JSON.stringify(updatedEditorState),
      mentions: collectedMentions
    }
  }

  async refreshConversationMentions(
    context: ActionContext<{ conversation: Conversation }>
  ): Promise<Conversation> {
    const { actionParams } = context
    const { conversation } = actionParams

    const { richText, mentions } = await this.getUpdatedRichTextMentions({
      ...context,
      actionParams: { richText: conversation.richText || '' }
    })

    return {
      ...conversation,
      richText,
      mentions
    }
  }
}

interface LexicalNode {
  type: string | 'mention'
  version: number
  children?: LexicalNode[]
  mention?: Mention
}

/**
 * Traverses a Lexical editor tree and processes mention nodes
 * @param node Current node in the tree
 * @param processMention Function to process each mention
 * @returns Updated node
 */
const traverseLexicalMentionNode = (
  node: LexicalNode,
  processMention: (mention: Mention) => Mention
): LexicalNode => {
  // Process current node if it's a mention
  if (node.type === 'mention' && node.mention) {
    return {
      ...node,
      mention: processMention(node.mention)
    }
  }

  // Process children recursively
  return {
    ...node,
    children: node.children?.map(child =>
      traverseLexicalMentionNode(child, processMention)
    )
  }
}
