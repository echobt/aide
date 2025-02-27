/* eslint-disable unused-imports/no-unused-vars */
import React from 'react'
import { Cross1Icon, ImageIcon } from '@radix-ui/react-icons'
import {
  chatContextTypeModelSettingKeyMap,
  type ImageInfo
} from '@shared/entities'
import { removeDuplicates } from '@shared/utils/common'
import { ButtonWithTooltip } from '@webview/components/button-with-tooltip'
import { useChatContext } from '@webview/contexts/chat-context'
import { useConversationContext } from '@webview/contexts/conversation-context'
import { useTranslation } from 'react-i18next'

import { ModelSelector } from './model-selector'

interface ContextSelectorProps {
  onFocusOnEditor?: () => void
  onClickMentionSelector?: () => void
  showExitEditModeButton?: boolean
  onExitEditMode?: () => void
  hideModelSelector?: boolean
}

export const ContextSelector: React.FC<ContextSelectorProps> = ({
  onFocusOnEditor,
  onClickMentionSelector,
  showExitEditModeButton,
  onExitEditMode,
  hideModelSelector = false
}) => {
  const { t } = useTranslation()
  const { context } = useChatContext()
  const { setConversation } = useConversationContext()
  const addSelectedImage = (image: ImageInfo) => {
    setConversation(draft => {
      draft.state.selectedImagesFromOutsideUrl = removeDuplicates(
        [...draft.state.selectedImagesFromOutsideUrl, image],
        ['url']
      )
    })
  }

  const handleSelectImage = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = event => {
      const file = (event.target as HTMLInputElement).files?.[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = e => {
          const base64Image = e.target?.result as string
          addSelectedImage?.({
            url: base64Image,
            name: file.name
          })
        }
        reader.readAsDataURL(file)
      }
    }
    input.click()
  }

  return (
    <div className="context-selector flex items-center flex-1">
      {!hideModelSelector && (
        <ModelSelector
          featureModelSettingKey={
            chatContextTypeModelSettingKeyMap[context.type]
          }
          onOpenChange={isOpen => !isOpen && onFocusOnEditor?.()}
          renderTrigger={({ tooltip, title }) => (
            <ButtonWithTooltip tooltip={tooltip} variant="ghost" size="xs">
              {title}
            </ButtonWithTooltip>
          )}
        />
      )}
      <ButtonWithTooltip
        tooltip={t('webview.contextSelector.addMention')}
        variant="ghost"
        size="iconXs"
        onClick={onClickMentionSelector}
      >
        @
      </ButtonWithTooltip>
      <ButtonWithTooltip
        tooltip={t('webview.contextSelector.addImage')}
        variant="ghost"
        size="iconXs"
        onClick={handleSelectImage}
      >
        <ImageIcon className="size-3" />
      </ButtonWithTooltip>
      {showExitEditModeButton && (
        <ButtonWithTooltip
          tooltip={t('webview.contextSelector.exitEditMode')}
          variant="ghost"
          size="iconXs"
          onClick={onExitEditMode}
        >
          <Cross1Icon className="size-3" />
        </ButtonWithTooltip>
      )}
    </div>
  )
}
