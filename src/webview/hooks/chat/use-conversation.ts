import { ConversationEntity, type Conversation } from '@shared/entities'
import { useTranslation } from 'react-i18next'
import { useImmer } from 'use-immer'

export const useConversation = (
  role: Conversation['role'] = 'human',
  initConversation?: Conversation
) => {
  const { t } = useTranslation()
  const [conversation, setConversation] = useImmer<Conversation>(
    () =>
      initConversation ??
      new ConversationEntity(t, {
        role
      }).entity
  )

  const resetConversation = () => {
    setConversation(new ConversationEntity(t, { role }).entity)
  }

  return {
    conversation,
    setConversation,
    resetConversation
  }
}
