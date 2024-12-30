import { InlineDiffTaskState } from '@extension/registers/inline-diff-register/types'
import { ReloadIcon, StopIcon } from '@radix-ui/react-icons'
import { Button } from '@webview/components/ui/button'
import { useApplyCode } from '@webview/hooks/chat/use-apply-code'
import { PlayIcon } from 'lucide-react'

export interface UseApplyActionsProps {
  fileFullPath: string | undefined
  content: string
}
export const useApplyActions = ({
  fileFullPath,
  content
}: UseApplyActionsProps) => {
  const { isApplying, applyStatus, applyCode, cancelApply, reapplyCode } =
    useApplyCode(fileFullPath, content)

  const getButtonProps = () => {
    if (isApplying) {
      return {
        onClick: cancelApply,
        icon: <StopIcon className="size-3" />,
        text: 'Stopping...'
      }
    }
    if (applyStatus === InlineDiffTaskState.Finished) {
      return {
        onClick: () => reapplyCode(),
        icon: <ReloadIcon className="size-3" />,
        text: 'Reapply'
      }
    }
    return {
      onClick: () => applyCode(),
      icon: <PlayIcon className="size-3" />,
      text: 'Apply'
    }
  }

  const { onClick, icon, text } = getButtonProps()

  return (
    <Button
      onClick={onClick}
      size="xs"
      variant="ghost"
      aria-label={text}
      disabled={isApplying}
    >
      {icon}
      <span>{text}</span>
    </Button>
  )
}
