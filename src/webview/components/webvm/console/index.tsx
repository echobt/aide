import { useEffect, useRef } from 'react'
import { Button } from '@webview/components/ui/button'
import { Input } from '@webview/components/ui/input'
import { ScrollArea } from '@webview/components/ui/scroll-area'
import { cn } from '@webview/utils/common'
import { Eraser } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useConsoleContext } from './context/console-context'

interface ConsoleProps {
  className?: string
}

export const Console = ({ className }: ConsoleProps) => {
  const { logs, input, setInput, handleExecute, clearLogs } =
    useConsoleContext()
  const scrollRef = useRef<HTMLDivElement>(null)
  const { t } = useTranslation()

  // Auto scroll to bottom when new logs come in
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs])

  return (
    <div
      className={cn(
        'flex flex-col h-full bg-background text-primary font-mono',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1 border-b">
        <span className="text-sm text-muted-foreground">
          {t('webview.webvm.console.title')}
        </span>
        <Button
          variant="ghost"
          size="iconXs"
          onClick={clearLogs}
          className="hover:text-destructive"
        >
          <Eraser className="h-3 w-3" />
        </Button>
      </div>

      {/* Logs Area */}
      <ScrollArea ref={scrollRef} className="flex-1 p-2">
        {logs.map((log, index) => (
          <div
            key={index}
            className={cn('mb-1 text-sm font-mono whitespace-pre-wrap', {
              'text-destructive': log.type === 'error',
              'text-yellow-500': log.type === 'warn',
              'text-blue-500': log.type === 'info'
            })}
          >
            <span className="text-muted-foreground text-xs mr-2">
              {log.timestamp}
            </span>
            <span>{log.content}</span>
          </div>
        ))}
      </ScrollArea>

      {/* Input Area */}
      <div className="border-t p-2">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">{'>'}</span>
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleExecute()}
            className="flex-1 bg-transparent border-none text-sm focus-visible:ring-0 focus-visible:ring-offset-0 px-0"
            placeholder={t('webview.webvm.console.enterJavaScript')}
          />
        </div>
      </div>
    </div>
  )
}
