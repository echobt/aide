import { Input } from '@webview/components/ui/input'
import { ScrollArea } from '@webview/components/ui/scroll-area'
import { cn } from '@webview/utils/common'

import { useConsoleContext } from './context/console-context'

interface ConsoleProps {
  className?: string
}

export const Console = ({ className }: ConsoleProps) => {
  const { logs, input, setInput, handleExecute } = useConsoleContext()

  return (
    <div
      className={cn(
        'flex flex-col h-full bg-background text-primary font-mono',
        className
      )}
    >
      <ScrollArea className="flex-1 p-4">
        {logs.map((log, index) => (
          <div key={index} className="mb-1">
            <span className="text-muted-foreground">{log.timestamp}</span>
            <span
              className={`ml-2 ${log.type === 'error' ? 'text-destructive' : ''}`}
            >
              {log.content}
            </span>
          </div>
        ))}
      </ScrollArea>

      <div className="border-t border-gray-800 p-2">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleExecute()}
          className="bg-transparent border-none text-primary"
          placeholder="Type your command..."
        />
      </div>
    </div>
  )
}
