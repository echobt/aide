/* eslint-disable react-compiler/react-compiler */
import { useRef } from 'react'
import { TooltipProvider } from '@radix-ui/react-tooltip'
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { Toaster } from '@webview/components/ui/sonner'
import { createQueryClient } from '@webview/network/react-query/query-client'
import type { ChatStore } from '@webview/stores/chat-store'
import type { ChatUIStore } from '@webview/stores/chat-ui-store'
import { ThemeProvider as NextThemesProvider } from 'next-themes'

import { ChatStoreProvider } from '../stores/chat-store-context'
import { ChatUIStoreProvider } from '../stores/chat-ui-store-context'
import { ActionContextProvider } from './action-context'
import { ChatContextProvider } from './chat-context'
import { GlobalSearchProvider } from './global-search-context'
import { PluginProvider } from './plugin-context/plugin-provider'

export interface StoreProvidersProps {
  chatStoreOverrides?: Partial<ChatStore>
  chatUIStoreOverrides?: Partial<ChatUIStore>
  children: React.ReactNode
}

export const StoreProviders = ({
  children,
  chatStoreOverrides,
  chatUIStoreOverrides
}: StoreProvidersProps) => (
  <ChatStoreProvider overrides={chatStoreOverrides}>
    <ChatUIStoreProvider overrides={chatUIStoreOverrides}>
      {children}
    </ChatUIStoreProvider>
  </ChatStoreProvider>
)

export interface ChatProvidersProps extends StoreProvidersProps {
  children: React.ReactNode
  disableEffect?: boolean
}

export const ChatProviders = ({
  children,
  disableEffect,
  ...props
}: ChatProvidersProps) => (
  <StoreProviders {...props}>
    <ChatContextProvider disableEffect={disableEffect}>
      <PluginProvider>{children}</PluginProvider>
    </ChatContextProvider>
  </StoreProviders>
)

export const Providers = ({ children }: React.PropsWithChildren) => {
  const queryClientRef = useRef<QueryClient>(null)
  if (!queryClientRef.current) {
    queryClientRef.current = createQueryClient()
  }

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <Toaster position="top-center" />
      <TooltipProvider>
        <QueryClientProvider client={queryClientRef.current}>
          <ChatProviders>
            <GlobalSearchProvider>
              <ActionContextProvider>{children}</ActionContextProvider>
            </GlobalSearchProvider>
          </ChatProviders>
        </QueryClientProvider>
      </TooltipProvider>
    </NextThemesProvider>
  )
}
