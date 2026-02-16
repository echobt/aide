# AGENTS.md — src/ (Frontend)

## Purpose

SolidJS frontend for Cortex Desktop. Provides the full IDE UI including code editor (Monaco), integrated terminal (xterm.js), file explorer, Git panel, AI chat, debugging views, extension management, and 92 context providers for state management.

## Architecture

- **Entry:** `index.tsx` → renders `AppShell.tsx` (minimal shell for instant first paint)
- **App:** `App.tsx` → wraps everything in `OptimizedProviders` (flat provider composer)
- **Core:** `AppCore.tsx` → lazy-loaded main application logic (heavy, deferred after first paint)
- **Routing:** `@solidjs/router` with `Home` and `Session` pages
- **State:** 92 SolidJS context providers in `context/` (85 top-level + 3 editor + 4 AI sub-contexts) — composed via `context/utils/ProviderComposer.tsx`

### Directory Structure

| Directory | Description |
|-----------|-------------|
| `components/` | 487 UI components organized by feature (editor, terminal, git, debug, chat, factory, etc.) |
| `components/ui/` | Shared UI primitives (Button, Dialog, Tooltip, etc.) |
| `components/Chat/` | AI chat components |
| `components/editor/` | Monaco editor components |
| `components/terminal/` | Terminal components |
| `components/debug/` | Debugger components |
| `components/git/` | Git panel components |
| `components/factory/` | Agent workflow designer components |
| `components/extensions/` | Extension management components |
| `context/` | 92 SolidJS context providers (85 top-level + 3 editor + 4 AI sub-contexts) — each manages a domain of app state |
| `context/editor/` | Editor-specific contexts (`EditorCursorContext`, `EditorFilesContext`, `EditorUIContext`) |
| `context/ai/` | AI-specific contexts (`AIAgentContext`, `AIProviderContext`, `AIStreamContext`, `AIThreadContext`) |
| `context/utils/` | `ProviderComposer.tsx` (flat composition), `LazyProvider.tsx` (deferred loading) |
| `hooks/` | 25 custom SolidJS hooks + 4 factory hooks in `hooks/factory/` (keyboard, subscriptions, local storage, animations, etc.) — 31 files total |
| `pages/` | Route-level page components (`Home.tsx`, `Session.tsx`) |
| `providers/` | 12 Monaco editor providers bridging LSP to Monaco API (CodeLens, InlayHints, InlineCompletions, etc.) + 9 quickaccess providers |
| `sdk/` | TypeScript SDK for Tauri IPC — wraps `invoke()` calls (`client.ts`, `executor.ts`, `types.ts`, `errors.ts`) |
| `services/` | Business logic services (factory, etc.) |
| `design-system/` | Design tokens and layout primitives (Flex, etc.) |
| `styles/` | Global CSS and Tailwind configuration |
| `layout/` | Layout containers for panel arrangement |
| `lib/` | Utility libraries |
| `api/` | API client modules |
| `types/` | Shared TypeScript type definitions |
| `utils/` | Utility functions |
| `test/` | Test setup and utilities |
| `extension-host/` | In-app extension host UI integration |

### Key Contexts

| Context | File | Manages |
|---------|------|---------|
| `EditorContext` | `context/EditorContext.tsx` | Open editors, tabs, active file |
| `WorkspaceContext` | `context/WorkspaceContext.tsx` | Project root, file tree |
| `LayoutContext` | `context/LayoutContext.tsx` | Panel layout, sidebar, bottom panel |
| `ThemeContext` | `context/ThemeContext.tsx` | Color theme, dark/light mode |
| `SettingsContext` | `context/SettingsContext.tsx` | User preferences |
| `AIContext` | `context/AIContext.tsx` | AI chat threads, providers, streaming |
| `LSPContext` | `context/LSPContext.tsx` | Language server connections |
| `DebugContext` | `context/DebugContext.tsx` | Debug sessions, breakpoints |
| `CommandContext` | `context/CommandContext.tsx` | Command palette registry |
| `FactoryContext` | `context/FactoryContext.tsx` | Agent workflow designer |
| `TerminalsContext` | `context/TerminalsContext.tsx` | Terminal instances |
| `ExtensionsContext` | `context/ExtensionsContext.tsx` | Installed extensions |
| `SessionContext` | `context/SessionContext.tsx` | Current session state |
| `WindowsContext` | `context/WindowsContext.tsx` | Multi-window management |
| `TestingContext` | `context/TestingContext.tsx` | Test explorer/runner |
| `TasksContext` | `context/TasksContext.tsx` | Task runner |
| `GitHostingContext` | `context/GitHostingContext.tsx` | GitHub/GitLab integration |
| `VimContext` | `context/VimContext.tsx` | Vim mode keybindings |

### Key Hooks

| Hook | File | Purpose |
|------|------|---------|
| `useKeyboard` | `hooks/useKeyboard.ts` | Keyboard shortcut handling |
| `useTauriListen` | `hooks/useTauriListen.ts` | Tauri event subscription with cleanup |
| `useLocalStorage` | `hooks/useLocalStorage.ts` | Persistent local storage |
| `useLSPEditor` | `hooks/useLSPEditor.ts` | LSP integration for Monaco |
| `useInlineCompletions` | `hooks/useInlineCompletions.ts` | AI inline completions |
| `useDebounce` | `hooks/useDebounce.ts` | Debounced values |
| `useAgents` | `hooks/useAgents.ts` | Agent management |

## Testing

Tests live in `__tests__/` directories next to the code they test:
- `src/sdk/__tests__/sdk.test.ts`
- `src/components/__tests__/KeyboardShortcutsEditor.test.tsx`
- `src/components/__tests__/StatusBar.test.tsx`
- `src/components/__tests__/Sidebar.test.tsx`
- `src/components/editor/__tests__/RenameWidget.test.tsx`
- `src/components/editor/__tests__/FindReplaceWidget.test.tsx`
- `src/components/terminal/__tests__/TerminalQuickFix.test.tsx`
- `src/components/debug/__tests__/DebugHoverWidget.test.tsx`
- `src/utils/__tests__/ansiParser.test.ts`
- `src/utils/__tests__/eventBus.test.ts`
- `src/utils/__tests__/diffAlgorithm.test.ts`
- `src/context/__tests__/LSPContext.test.tsx`
- `src/context/__tests__/ThemeContext.test.tsx`
- `src/context/__tests__/EditorContext.test.tsx`
- `src/context/__tests__/AIContext.test.tsx`
- `src/context/__tests__/TerminalsContext.test.tsx`
- `src/context/__tests__/WorkspaceContext.test.tsx`
- `src/context/__tests__/ExtensionsContext.test.tsx`
- `src/context/__tests__/DebugContext.test.tsx`
- `src/context/__tests__/SettingsContext.test.tsx`
- `src/context/__tests__/TestingContext.test.tsx`

```bash
npm run test           # Run all tests (vitest run)
npm run test:watch     # Watch mode (vitest)
npm run test:coverage  # With coverage (vitest run --coverage)
npm run typecheck      # tsc --noEmit
```

## Rules

- **SolidJS only** — use `createSignal`, `createMemo`, `createEffect`, `onMount`, `onCleanup`, `Show`, `For`, `Switch/Match`
- Use `@/` path alias for all imports (e.g., `@/context/EditorContext`)
- Lazy-load heavy components with `lazy(() => import(...))` and wrap in `<Suspense>`
- Context providers are composed in `context/utils/ProviderComposer.tsx` — add new providers to `OptimizedProviders` in `App.tsx`
- Monaco editor providers in `providers/` bridge LSP results to Monaco's API
- All Tauri IPC calls go through `@tauri-apps/api/core` `invoke()` or the SDK in `sdk/`
- CSS uses Tailwind v4 utility classes — no CSS modules for new components
- Keep components under 300 lines; extract hooks and sub-components
- Test files go in `__tests__/` directories adjacent to source files
- Use `jsdom` environment for component tests (configured in vitest)
- Never import React — JSX import source is `solid-js` (`tsconfig.json` line 14)