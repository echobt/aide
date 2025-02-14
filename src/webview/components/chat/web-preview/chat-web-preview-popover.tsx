import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@webview/components/ui/popover'
import { useControllableState } from '@webview/hooks/use-controllable-state'

import { ChatWebPreview } from './chat-web-preview'

export interface ChatWebPreviewPopoverProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

export const ChatWebPreviewPopover = ({
  open,
  onOpenChange,
  children
}: ChatWebPreviewPopoverProps) => {
  const [isOpen, setIsOpen] = useControllableState({
    prop: open,
    defaultProp: false,
    onChange: onOpenChange
  })

  const handleFullScreenChange = () => {
    setIsOpen(false)
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className="w-screen mx-auto h-[100vh-4rem] p-0 border-primary rounded-md"
        side="top"
        align="start"
        onCloseAutoFocus={e => e.preventDefault()}
      >
        <div
          className="w-full h-[90vh] bg-background overflow-auto"
          suppressContentEditableWarning
        >
          <ChatWebPreview
            isFullScreen={false}
            onFullScreenChange={handleFullScreenChange}
            allowAutoRestart={false}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}
