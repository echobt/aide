import path from 'path'
import react from '@vitejs/plugin-react'

import { WebVMPresetName } from '../_base/constants'
import { commonPresetFiles } from '../_base/shared-files'
import {
  IFrameworkPreset,
  WebVMFiles,
  type IAIPrompt,
  type ViteConfig
} from '../../types'
import { getAIPrompts } from './get-ai-prompts'

export class React19ShadcnPreset implements IFrameworkPreset {
  getPresetName(): string {
    return WebVMPresetName.React19Shadcn
  }

  getAIPrompts(): IAIPrompt {
    return getAIPrompts()
  }

  getBaseProjectFiles(): WebVMFiles {
    return [
      ...commonPresetFiles,
      ...__SHADCN_FILES__.map(file => ({
        relativePathOrSchemeUri: file.relativePath,
        content: file.content
      })),
      {
        relativePathOrSchemeUri: 'index.html',
        content: `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>React19 + Shadcn/ui</title>
    <script src="https://unpkg.com/@tailwindcss/browser@4"></script>
    <style type="text/tailwindcss">
      @custom-variant dark (&:is(.dark *));

      :root {
        --background: oklch(1 0 0);
        --foreground: oklch(0.145 0 0);
        --card: oklch(1 0 0);
        --card-foreground: oklch(0.145 0 0);
        --popover: oklch(1 0 0);
        --popover-foreground: oklch(0.145 0 0);
        --primary: oklch(0.205 0 0);
        --primary-foreground: oklch(0.985 0 0);
        --secondary: oklch(0.97 0 0);
        --secondary-foreground: oklch(0.205 0 0);
        --muted: oklch(0.97 0 0);
        --muted-foreground: oklch(0.556 0 0);
        --accent: oklch(0.97 0 0);
        --accent-foreground: oklch(0.205 0 0);
        --destructive: oklch(0.577 0.245 27.325);
        --destructive-foreground: oklch(1 0 0);
        --border: oklch(0.922 0 0);
        --input: oklch(0.922 0 0);
        --ring: oklch(0.708 0 0);
        --chart-1: oklch(0.646 0.222 41.116);
        --chart-2: oklch(0.6 0.118 184.704);
        --chart-3: oklch(0.398 0.07 227.392);
        --chart-4: oklch(0.828 0.189 84.429);
        --chart-5: oklch(0.769 0.188 70.08);
        --radius: 0.625rem;
        --sidebar: oklch(0.985 0 0);
        --sidebar-foreground: oklch(0.145 0 0);
        --sidebar-primary: oklch(0.205 0 0);
        --sidebar-primary-foreground: oklch(0.985 0 0);
        --sidebar-accent: oklch(0.97 0 0);
        --sidebar-accent-foreground: oklch(0.205 0 0);
        --sidebar-border: oklch(0.922 0 0);
        --sidebar-ring: oklch(0.708 0 0);
      }

      .dark {
        --background: oklch(0.145 0 0);
        --foreground: oklch(0.985 0 0);
        --card: oklch(0.145 0 0);
        --card-foreground: oklch(0.985 0 0);
        --popover: oklch(0.145 0 0);
        --popover-foreground: oklch(0.985 0 0);
        --primary: oklch(0.985 0 0);
        --primary-foreground: oklch(0.205 0 0);
        --secondary: oklch(0.269 0 0);
        --secondary-foreground: oklch(0.985 0 0);
        --muted: oklch(0.269 0 0);
        --muted-foreground: oklch(0.708 0 0);
        --accent: oklch(0.269 0 0);
        --accent-foreground: oklch(0.985 0 0);
        --destructive: oklch(0.396 0.141 25.723);
        --destructive-foreground: oklch(0.985 0 0);
        --border: oklch(0.269 0 0);
        --input: oklch(0.269 0 0);
        --ring: oklch(0.556 0 0);
        --chart-1: oklch(0.488 0.243 264.376);
        --chart-2: oklch(0.696 0.17 162.48);
        --chart-3: oklch(0.769 0.188 70.08);
        --chart-4: oklch(0.627 0.265 303.9);
        --chart-5: oklch(0.645 0.246 16.439);
        --sidebar: oklch(0.205 0 0);
        --sidebar-foreground: oklch(0.985 0 0);
        --sidebar-primary: oklch(0.488 0.243 264.376);
        --sidebar-primary-foreground: oklch(0.985 0 0);
        --sidebar-accent: oklch(0.269 0 0);
        --sidebar-accent-foreground: oklch(0.985 0 0);
        --sidebar-border: oklch(0.269 0 0);
        --sidebar-ring: oklch(0.439 0 0);
      }

      .theme-login-one {
        --primary: #ce2a2d;
        --primary-foreground: #fff;
        --ring: #ce2a2d9c;
        --radius: 0rem;
        --radius-sm: calc(var(--radius) - 4px);
        --radius-md: calc(var(--radius) - 2px);
        --radius-lg: var(--radius);

        font-family: var(--font-sans);

        a {
          color: var(--primary);
        }

        [data-slot='card'] {
          border-radius: 0rem;
          box-shadow: none;
        }
      }

      .theme-login-two {
        --primary: #035fa8;
        --primary-foreground: #fff;
        --ring: #035fa89c;
        font-family: var(--font-serif);

        a {
          color: var(--primary);
        }
      }

      .theme-login-three {
        --primary: #22c55e;
        --primary-foreground: #000;
        --ring: #22c55e;
        --radius: 1.5rem;

        font-family: var(--font-manrope);

        a {
          color: var(--primary);
        }

        [data-slot='card'] {
          @apply shadow-xl;
        }

        [data-slot='input'] {
          @apply dark:bg-input;
        }
      }

      @theme inline {
        --font-sans: var(--font-sans);
        --font-mono: var(--font-mono);
        --color-background: var(--background);
        --color-foreground: var(--foreground);
        --color-card: var(--card);
        --color-card-foreground: var(--card-foreground);
        --color-popover: var(--popover);
        --color-popover-foreground: var(--popover-foreground);
        --color-primary: var(--primary);
        --color-primary-foreground: var(--primary-foreground);
        --color-secondary: var(--secondary);
        --color-secondary-foreground: var(--secondary-foreground);
        --color-muted: var(--muted);
        --color-muted-foreground: var(--muted-foreground);
        --color-accent: var(--accent);
        --color-accent-foreground: var(--accent-foreground);
        --color-destructive: var(--destructive);
        --color-destructive-foreground: var(--destructive-foreground);
        --color-border: var(--border);
        --color-input: var(--input);
        --color-ring: var(--ring);
        --color-chart-1: var(--chart-1);
        --color-chart-2: var(--chart-2);
        --color-chart-3: var(--chart-3);
        --color-chart-4: var(--chart-4);
        --color-chart-5: var(--chart-5);
        --radius-sm: calc(var(--radius) - 4px);
        --radius-md: calc(var(--radius) - 2px);
        --radius-lg: var(--radius);
        --radius-xl: calc(var(--radius) + 4px);
        --color-sidebar: var(--sidebar);
        --color-sidebar-foreground: var(--sidebar-foreground);
        --color-sidebar-primary: var(--sidebar-primary);
        --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
        --color-sidebar-accent: var(--sidebar-accent);
        --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
        --color-sidebar-border: var(--sidebar-border);
        --color-sidebar-ring: var(--sidebar-ring);
        --animate-accordion-down: accordion-down 0.2s ease-out;
        --animate-accordion-up: accordion-up 0.2s ease-out;

        @keyframes accordion-down {
          from {
            height: 0;
          }
          to {
            height: var(--radix-accordion-content-height);
          }
        }

        @keyframes accordion-up {
          from {
            height: var(--radix-accordion-content-height);
          }
          to {
            height: 0;
          }
        }
      }

      @layer base {
        * {
          @apply border-border outline-ring/50;
        }
        body {
          @apply bg-background text-foreground;
        }
      }

      html,
      html > body,
      #app {
        --radius: 0.5rem;
        height: 100%;
        color: var(--color-foreground);
        background-color: var(--color-background);
        pointer-events: auto;
      }

      html,
      body {
        padding: 0;
        margin: 0;
        overflow: hidden;
      }

      button {
        cursor: pointer;
      }

      a:focus,
      input:focus,
      select:focus,
      textarea:focus {
        outline: none !important;
      }
    </style>
    <script type="importmap">
      {
        "imports": {
          "react": "https://esm.sh/react",
          "react/": "https://esm.sh/react/",
          "react-dom": "https://esm.sh/react-dom@latest&external=react",
          "react-dom/": "https://esm.sh/react-dom@latest&external=react/",
          "react-router": "https://esm.sh/react-router@6.29.0&external=react,react-dom",
          "react-router/": "https://esm.sh/react-router@6.29.0&external=react,react-dom/",
          "react-router-dom": "https://esm.sh/react-router-dom@6.29.0&external=react,react-router,react-dom",
          "react-router-dom/": "https://esm.sh/react-router-dom@6.29.0&external=react,react-router,react-dom/"
        }
      }
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`
      },
      {
        relativePathOrSchemeUri: 'src/main.tsx',
        content: `
import 'unfonts.css'
import React, { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@radix-ui/react-tooltip'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import App from './app'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <NextThemesProvider
        attribute="class"
        defaultTheme="light"
        enableSystem
        disableTransitionOnChange
      >
        <Toaster />
        <TooltipProvider>
          <App />
        </TooltipProvider>
      </NextThemesProvider>
    </BrowserRouter>
  </StrictMode>
)`
      },
      {
        relativePathOrSchemeUri: 'src/app.tsx',
        content: `
import { Suspense } from 'react'
import { useRoutes } from 'react-router-dom'
import routes from '~react-pages'

export default function App() {
  return (
    <Suspense fallback={<p>Loading...</p>}>
      {useRoutes(routes)}
    </Suspense>
  )
}`
      },
      {
        relativePathOrSchemeUri: 'src/lib/utils.ts',
        content: `
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
`
      },
      {
        relativePathOrSchemeUri: 'src/utils/common.ts',
        content: `
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
`
      }
    ]
  }

  getProjectFilesForInstructions(): WebVMFiles {
    // exclude shadcn/ui components
    return this.getBaseProjectFiles().filter(
      file => !file.relativePathOrSchemeUri.includes('components/ui/')
    )
  }

  isKnownDeps(dep: string): boolean {
    if (
      ['react', 'react-dom', 'react-router', 'react-router-dom'].includes(dep)
    ) {
      return true
    }

    if (
      ['react/', 'react-dom/', 'react-router/', 'react-router-dom/'].some(
        prefix => dep.startsWith(prefix)
      )
    ) {
      return true
    }

    return /^@webview\//.test(dep)
  }

  processUnknownDepsLink(cdnLink: string): string {
    return `${cdnLink}?external=react,react-dom,react-router,react-router-dom`
  }

  getViteConfig(rootDir: string): ViteConfig {
    return {
      plugins: [react()],
      resolve: {
        alias: {
          '@': path.resolve(rootDir, './src'),
          '@webview': path.resolve(rootDir, './src')
        }
      }
    }
  }
}
