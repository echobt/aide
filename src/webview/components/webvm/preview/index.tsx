import { cn } from '@webview/utils/common'

import { PreviewContent } from './preview-content'
import { PreviewOperationBar } from './preview-operation-bar'

export interface PreviewProps {
  className?: string
}

export const Preview = ({ className }: PreviewProps) => (
  <div className={cn('flex flex-col h-full', className)}>
    {/* Operation Bar */}
    <PreviewOperationBar />

    {/* Main Content */}
    <div className="flex-1 flex flex-col">
      <PreviewContent className="flex-1" />
    </div>
  </div>
)
