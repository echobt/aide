import { createContext, useContext, useState, type ReactNode } from 'react'

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
}

const ConsoleContext = createContext<ConsoleContextValue | null>(null)

interface ConsoleProviderProps {
  children: ReactNode
  value: {}
}

export const ConsoleProvider = ({ children, value }: ConsoleProviderProps) => {
  const [logs, setLogs] = useState<WebVMConsoleLog[]>([])
  const [input, setInput] = useState('')

  const handleExecute = () => {
    if (!input.trim()) return

    try {
      // eslint-disable-next-line no-eval
      const result = eval(input)
      setLogs(prev => [
        ...prev,
        {
          timestamp: new Date().toLocaleTimeString(),
          content: `> ${input}\n${result}`,
          type: 'log'
        }
      ])
    } catch (error) {
      setLogs(prev => [
        ...prev,
        {
          timestamp: new Date().toLocaleTimeString(),
          content: `> ${input}\n${error}`,
          type: 'error'
        }
      ])
    }

    setInput('')
  }

  return (
    <ConsoleContext.Provider
      value={{
        ...value,
        logs,
        setLogs,
        input,
        setInput,
        handleExecute
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
