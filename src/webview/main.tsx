import React, { useEffect, useState } from 'react'
import { NuqsAdapter } from 'nuqs/adapters/react-router'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'

import './styles/global.css'

import { ThemeSync } from './components/theme-sync'
import { SparklesText } from './components/ui/sparkles-text'
import { GlobalContextProvider } from './contexts/global-context'
import { initMonaco } from './utils/monaco'
import { initWebviewMessage } from './utils/webview-message'

const root = ReactDOM.createRoot(document.getElementById('app')!)

const AppWrapper = () => {
  const [isLoading, setIsLoading] = useState(true)
  const [isApiInit, setIsApiInit] = useState(false)
  const [App, setApp] = useState<React.ComponentType | null>(null)

  useEffect(() => {
    const init = async () => {
      await initMonaco()

      const { default: AppComponent } = await import('./App')
      const { api, initApi } = await import('./network/actions-api')

      await initApi()
      setIsApiInit(true)

      await api.actions().server.chatSession.ensureASessionExists({
        actionParams: {}
      })

      setApp(() => AppComponent)
      setIsLoading(false)
    }

    init()
  }, [])

  if (isLoading || !App) {
    return (
      <div className="h-screen w-screen flex items-center justify-center">
        <SparklesText text="AIDE" />
      </div>
    )
  }

  return (
    <GlobalContextProvider isApiInit={isApiInit}>
      <HashRouter>
        <ThemeSync />
        <App />
      </HashRouter>
    </GlobalContextProvider>
  )
}

initWebviewMessage()

root.render(
  <React.StrictMode>
    <NuqsAdapter>
      <AppWrapper />
    </NuqsAdapter>
  </React.StrictMode>
)
