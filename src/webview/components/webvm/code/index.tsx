import { useState } from 'react'
import { cn } from '@webview/utils/common'
import { motion } from 'framer-motion'

import { CodeEditor } from './code-editor'
import { CodeExplorer } from './code-explorer'

interface CodeProps {
  className?: string
}

export const Code = ({ className }: CodeProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <div className={cn('flex h-full', className)}>
      {/* File Explorer with Animation */}
      <motion.div
        initial={false}
        animate={{ width: isCollapsed ? 0 : 256 }}
        transition={{ duration: 0.2 }}
        className="shrink-0"
      >
        <div className={cn('h-full w-64 border-r', isCollapsed && 'invisible')}>
          <CodeExplorer className="h-full" />
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="relative flex-1 flex">
        {/* Editor */}
        <CodeEditor
          className="flex-1"
          isCollapsed={isCollapsed}
          onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
        />
      </div>
    </div>
  )
}
