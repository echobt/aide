import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode
} from 'react'

export interface WebVMConsoleLog {
  timestamp: string
  content: string
  type: 'log' | 'error' | 'info' | 'warn'
}

interface ConsoleContextValue {
  logs: WebVMConsoleLog[]
  setLogs: React.Dispatch<React.SetStateAction<WebVMConsoleLog[]>>
  input: string
  setInput: React.Dispatch<React.SetStateAction<string>>
  handleExecute: () => void
  clearLogs: () => void
  isVMReady: boolean
}

const ConsoleContext = createContext<ConsoleContextValue | null>(null)

interface ConsoleProviderProps {
  children: ReactNode
  value: {
    url: string
    iframeRef: React.RefObject<HTMLIFrameElement | null>
  }
}

export const ConsoleProvider = ({ children, value }: ConsoleProviderProps) => {
  const { url, iframeRef } = value
  const [logs, setLogs] = useState<WebVMConsoleLog[]>([])
  const [input, setInput] = useState('')
  const [isVMReady, setIsVMReady] = useState(false)

  // Handle messages from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const { type, logs: initialLogs, log, result, error } = event.data

      // Handle VM ready notification
      if (type === 'VM_READY') {
        setIsVMReady(true)

        // Initiate handshake
        const iframe = iframeRef.current
        if (iframe?.contentWindow) {
          iframe.contentWindow.postMessage(
            {
              type: 'HANDSHAKE_REQUEST'
            },
            '*'
          )
        }
      }

      // Handle handshake completion
      if (type === 'HANDSHAKE_COMPLETE') {
        // Handshake is complete, no need to store this state as it's handled in the VM
      }

      if (type === 'INITIAL_LOGS') {
        setLogs(prev => [
          ...prev,
          ...initialLogs.map((log: any) => ({
            timestamp: new Date(log.timestamp).toLocaleTimeString(),
            content: log.content,
            type: log.type
          }))
        ])
      }

      if (type === 'CONSOLE_LOG') {
        setLogs(prev => [
          ...prev,
          {
            timestamp: new Date(log.timestamp).toLocaleTimeString(),
            content: log.content,
            type: log.type
          }
        ])
      }

      if (type === 'CODE_RESULT') {
        setLogs(prev => [
          ...prev,
          {
            timestamp: new Date().toLocaleTimeString(),
            content: `> ${result}`,
            type: 'log'
          }
        ])
      }

      if (type === 'CODE_ERROR') {
        setLogs(prev => [
          ...prev,
          {
            timestamp: new Date().toLocaleTimeString(),
            content: `> Error: ${error}`,
            type: 'error'
          }
        ])
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [iframeRef])

  const handleExecute = () => {
    if (!input.trim()) return

    const iframe = iframeRef.current
    if (!iframe?.contentWindow) return

    // Add input to logs
    setLogs(prev => [
      ...prev,
      {
        timestamp: new Date().toLocaleTimeString(),
        content: `> ${input}`,
        type: 'log'
      }
    ])

    // For localhost/127.0.0.1, use postMessage
    if (url.includes('localhost') || url.includes('127.0.0.1')) {
      const id = Date.now().toString()
      iframe.contentWindow.postMessage(
        {
          type: 'EXECUTE_CODE',
          id,
          code: input
        },
        '*'
      )
    } else {
      // For other domains, execute in parent context
      try {
        // eslint-disable-next-line no-eval
        const result = eval(input)
        setLogs(prev => [
          ...prev,
          {
            timestamp: new Date().toLocaleTimeString(),
            content: String(result),
            type: 'log'
          }
        ])
      } catch (error) {
        setLogs(prev => [
          ...prev,
          {
            timestamp: new Date().toLocaleTimeString(),
            content: String(error),
            type: 'error'
          }
        ])
      }
    }

    setInput('')
  }

  const clearLogs = () => {
    setLogs([])
  }

  return (
    <ConsoleContext.Provider
      value={{
        logs,
        setLogs,
        input,
        setInput,
        handleExecute,
        clearLogs,
        isVMReady
      }}
    >
      {children}
    </ConsoleContext.Provider>
  )
}

export const useConsoleContext = () => {
  const context = useContext(ConsoleContext)
  if (!context) {
    throw new Error('useConsoleContext must be used within a ConsoleProvider')
  }
  return context
}
