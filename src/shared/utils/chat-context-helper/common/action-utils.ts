import type { Conversation, ConversationAction } from '@shared/entities'
import type { IsSameAction } from '@shared/plugins/agents/_base/client/agent-client-plugin-types'
import type { MaybePromise } from '@shared/types/common'
import { settledPromiseResults } from '@shared/utils/common'
import type { Updater } from 'use-immer'
import { v4 as uuidv4 } from 'uuid'

export type ActionPatchType = 'add' | 'update'

export interface ActionPatchInput<
  T extends ConversationAction = ConversationAction
> {
  action: Omit<T, 'id' | 'weight'> & Partial<Pick<T, 'id' | 'weight'>>
  relatedConversationContent?: string // for calculate weight
  onApplySuccess?: (actionPatch: ActionPatch<T>) => MaybePromise<void>
}

export interface ActionPatch<
  T extends ConversationAction = ConversationAction
> {
  conversationId: string
  actionIndex: number
  newAction: T
  oldAction: T | undefined
  type: ActionPatchType
  onApplySuccess?: (actionPatch: ActionPatch<T>) => MaybePromise<void>
}

export interface CreateActionsPatchesProps<
  T extends ConversationAction = ConversationAction
> {
  conversation: Conversation
  isSameAction: IsSameAction
  inputActions: ActionPatchInput<T>[]
}

export const createActionsPatches = <
  T extends ConversationAction = ConversationAction
>({
  conversation,
  isSameAction,
  inputActions
}: CreateActionsPatchesProps<T>) => {
  const results: ActionPatch<T>[] = []

  if (!conversation) return results

  // Pre-calculate text positions for relatedConversationContent lookup
  const textPositions = new Map<string, number>()
  let currentPosition = 0

  for (const content of conversation.contents) {
    if (content.type === 'text') {
      for (const { relatedConversationContent } of inputActions) {
        if (
          relatedConversationContent &&
          !textPositions.has(relatedConversationContent) &&
          content.text.includes(relatedConversationContent)
        ) {
          textPositions.set(
            relatedConversationContent,
            currentPosition + content.text.indexOf(relatedConversationContent)
          )
        }
      }
      currentPosition += content.text.length
    } else {
      currentPosition += 1
    }
  }

  // Use Map to store unique actions with highest weights
  const uniqueActionsMap = new Map<string, T>()

  for (const { action, relatedConversationContent } of inputActions) {
    const weight = relatedConversationContent
      ? (textPositions.get(relatedConversationContent) ?? Infinity)
      : (action.weight ?? Infinity)

    const newAction = {
      ...action,
      id: action.id || uuidv4(),
      weight
    } as T

    // Find if there's a similar action already in the map
    let found = false
    for (const [key, existingAction] of uniqueActionsMap) {
      if (isSameAction(newAction, existingAction)) {
        found = true
        if (newAction.weight > existingAction.weight) {
          uniqueActionsMap.set(key, newAction)
        }
        break
      }
    }

    if (!found) {
      uniqueActionsMap.set(newAction.id, newAction)
    }
  }

  // Create patches by comparing with existing actions
  const existingActionsMap = new Map<string, { action: T; index: number }>()
  conversation.actions.forEach((action, index) => {
    existingActionsMap.set(action.id, { action: action as T, index })
  })

  for (const newAction of uniqueActionsMap.values()) {
    let found = false
    for (const {
      action: existingAction,
      index
    } of existingActionsMap.values()) {
      if (isSameAction(newAction, existingAction)) {
        found = true
        if (newAction.weight > existingAction.weight) {
          // Find the corresponding inputAction for onApplySuccess
          const inputAction = inputActions.find(({ action }) =>
            isSameAction(newAction, action as T)
          )
          results.push({
            conversationId: conversation.id,
            actionIndex: index,
            newAction,
            oldAction: existingAction,
            type: 'update',
            onApplySuccess: inputAction?.onApplySuccess
          })
        }
        break
      }
    }

    if (!found) {
      // Find the corresponding inputAction for onApplySuccess
      const inputAction = inputActions.find(({ action }) =>
        isSameAction(newAction, action as T)
      )
      results.push({
        conversationId: conversation.id,
        actionIndex: conversation.actions.length,
        newAction,
        oldAction: undefined,
        type: 'add',
        onApplySuccess: inputAction?.onApplySuccess
      })
    }
  }

  return results
}

export interface ApplyActionsPatchesProps<
  T extends ConversationAction = ConversationAction
> {
  conversation: Conversation
  setConversation: Updater<Conversation>
  patches: ActionPatch<T>[]
}

export const applyActionsPatches = <
  T extends ConversationAction = ConversationAction
>({
  conversation,
  setConversation,
  patches
}: ApplyActionsPatchesProps<T>) => {
  if (!conversation || !setConversation) {
    throw new Error(
      'applyActionsPatches: Please provide conversation and setConversation'
    )
  }

  const events: (() => MaybePromise<void>)[] = []

  // Sort patches by index in descending order to avoid index shifting
  const sortedPatches = [...patches].sort(
    (a, b) => b.actionIndex - a.actionIndex
  )

  setConversation(draft => {
    for (const patch of sortedPatches) {
      if (patch.type === 'add') {
        draft.actions.push(patch.newAction)

        if (patch.onApplySuccess)
          events.push(() => patch.onApplySuccess!(patch))
      } else if (patch.type === 'update') {
        if (
          patch.actionIndex >= 0 &&
          patch.actionIndex < draft.actions.length
        ) {
          draft.actions[patch.actionIndex] = patch.newAction

          if (patch.onApplySuccess)
            events.push(() => patch.onApplySuccess!(patch))
        }
      }
    }
  })

  return {
    runSuccessEvents: async () => {
      await settledPromiseResults(events.map(async event => await event()))
    }
  }
}

export interface AddOrUpdateActionsProps<
  InputActions extends ActionPatchInput[]
> {
  conversation: Conversation
  setConversation: Updater<Conversation>
  isSameAction: IsSameAction
  inputActions: InputActions
}

export const addOrUpdateActions = <InputActions extends ActionPatchInput[]>({
  conversation,
  setConversation,
  isSameAction,
  inputActions
}: AddOrUpdateActionsProps<InputActions>) => {
  if (!conversation || !setConversation) {
    throw new Error(
      'addOrUpdateActions: Please provide conversation and setConversation'
    )
  }

  // Create patches
  const patches = createActionsPatches({
    conversation,
    isSameAction,
    inputActions
  })

  let runSuccessEvents: () => Promise<void> = async () => {}

  // Apply patches if any
  if (patches.length > 0) {
    const result = applyActionsPatches({
      conversation,
      setConversation,
      patches
    })

    runSuccessEvents = result.runSuccessEvents
  }

  return {
    patches,
    runSuccessEvents
  }
}
