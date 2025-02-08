import path from 'path'
import react from '@vitejs/plugin-react'
import Unfonts from 'unplugin-fonts/vite'

import { IFrameworkPreset, WebVMFiles, type ViteConfig } from '../../types'
import tailwindcss3Config from './tailwindcss3-config'

export class React19ShadcnPreset implements IFrameworkPreset {
  getPresetName(): string {
    return 'react19-shadcn'
  }

  getBaseProjectFiles(): WebVMFiles {
    return [
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
    <style type="text/tailwindcss">
      @tailwind base;
      @tailwind components;
      @tailwind utilities;

      @layer base {
        :root {
          --background: 0 0% 100%;
          --foreground: 240 10% 3.9%;
          --card: 0 0% 100%;
          --card-foreground: 240 10% 3.9%;
          --popover: 0 0% 100%;
          --popover-foreground: 240 10% 3.9%;
          --primary: 240 5.9% 10%;
          --primary-foreground: 0 0% 98%;
          --secondary: 240 4.8% 95.9%;
          --secondary-foreground: 240 5.9% 10%;
          --muted: 240 4.8% 95.9%;
          --muted-foreground: 240 3.8% 46.1%;
          --accent: 240 4.8% 95.9%;
          --accent-foreground: 240 5.9% 10%;
          --destructive: 0 72.22% 50.59%;
          --destructive-foreground: 0 0% 98%;
          --border: 240 5.9% 90%;
          --input: 240 5.9% 90%;
          --ring: 240 5% 64.9%;
          --radius: 0.5rem;
          --chart-1: 12 76% 61%;
          --chart-2: 173 58% 39%;
          --chart-3: 197 37% 24%;
          --chart-4: 43 74% 66%;
          --chart-5: 27 87% 67%;
          --sidebar-background: 0 0% 98%;
          --sidebar-foreground: 240 5.3% 26.1%;
          --sidebar-primary: 240 5.9% 10%;
          --sidebar-primary-foreground: 0 0% 98%;
          --sidebar-accent: 240 4.8% 95.9%;
          --sidebar-accent-foreground: 240 5.9% 10%;
          --sidebar-border: 220 13% 91%;
          --sidebar-ring: 240 5% 64.9%;
        }

        .dark {
          --background: 240 10% 3.9%;
          --foreground: 0 0% 98%;
          --card: 240 10% 3.9%;
          --card-foreground: 0 0% 98%;
          --popover: 240 10% 3.9%;
          --popover-foreground: 0 0% 98%;
          --primary: 0 0% 98%;
          --primary-foreground: 240 5.9% 10%;
          --secondary: 240 3.7% 15.9%;
          --secondary-foreground: 0 0% 98%;
          --muted: 240 3.7% 15.9%;
          --muted-foreground: 240 5% 64.9%;
          --accent: 240 3.7% 15.9%;
          --accent-foreground: 0 0% 98%;
          --destructive: 0 62.8% 30.6%;
          --destructive-foreground: 0 85.7% 97.3%;
          --border: 240 3.7% 15.9%;
          --input: 240 3.7% 15.9%;
          --ring: 240 4.9% 83.9%;
          --chart-1: 220 70% 50%;
          --chart-2: 160 60% 45%;
          --chart-3: 30 80% 55%;
          --chart-4: 280 65% 60%;
          --chart-5: 340 75% 55%;
          --sidebar-background: 240 5.9% 10%;
          --sidebar-foreground: 240 4.8% 95.9%;
          --sidebar-primary: 224.3 76.3% 48%;
          --sidebar-primary-foreground: 0 0% 100%;
          --sidebar-accent: 240 3.7% 15.9%;
          --sidebar-accent-foreground: 240 4.8% 95.9%;
          --sidebar-border: 240 3.7% 15.9%;
          --sidebar-ring: 240 4.9% 83.9%;
        }
      }

      @layer base {
        * {
          @apply border-border;
        }
        html {
          @apply scroll-smooth;
        }
        body {
          @apply bg-background text-foreground overscroll-none;
          /* font-feature-settings: "rlig" 1, "calt" 1; */
          font-synthesis-weight: none;
          text-rendering: optimizeLegibility;
        }

        @supports (font: -apple-system-body) and (-webkit-appearance: none) {
          [data-wrapper] {
            @apply min-[1800px]:border-t;
          }
        }

        /* Custom scrollbar styling. Thanks @pranathiperii. */
        ::-webkit-scrollbar {
          width: 5px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: hsl(var(--border));
          border-radius: 5px;
        }
        * {
          scrollbar-width: thin;
          scrollbar-color: hsl(var(--border)) transparent;
        }
      }

      @layer utilities {
        .step {
          counter-increment: step;
        }

        .step:before {
          @apply absolute w-9 h-9 bg-muted rounded-full font-mono font-medium text-center text-base inline-flex items-center justify-center -indent-px border-4 border-background;
          @apply ml-[-50px] mt-[-4px];
          content: counter(step);
        }

        .chunk-container {
          @apply shadow-none;
        }

        .chunk-container::after {
          content: "";
          @apply absolute -inset-4 shadow-xl rounded-xl border;
        }

        /* Hide scrollbar for Chrome, Safari and Opera */
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        /* Hide scrollbar for IE, Edge and Firefox */
        .no-scrollbar {
          -ms-overflow-style: none; /* IE and Edge */
          scrollbar-width: none; /* Firefox */
        }

        .border-grid {
          @apply border-border/30 dark:border-border;
        }

        .container-wrapper {
          @apply min-[1800px]:max-w-[1536px] min-[1800px]:border-x border-border/30 dark:border-border mx-auto w-full;
        }

        .container {
          @apply px-4 xl:px-6 2xl:px-4 mx-auto max-w-[1536px];
        }
      }
    </style>
    <script src="https://cdn.tailwindcss.com/3.4.16"></script>
    <script type="importmap">
      {
        "imports": {
          "react": "https://esm.sh/react",
          "react/": "https://esm.sh/react/",
          "react-dom": "https://esm.sh/react-dom",
          "react-dom/": "https://esm.sh/react-dom@latest&external=react/"
        }
      }
    </script>
    <script>
      tailwind.config = ${JSON.stringify(tailwindcss3Config, null, 2)}
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
import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@radix-ui/react-tooltip'
import { ThemeProvider as NextThemesProvider } from 'next-themes'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <NextThemesProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <Toaster />
        <TooltipProvider>
          <App />
        </TooltipProvider>
      </NextThemesProvider>
    </HashRouter>
  </React.StrictMode>
)`
      },
      {
        relativePathOrSchemeUri: 'src/App.tsx',
        content: `
import { Button } from "@/components/ui/button"

export default function App() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Welcome to React + Shadcn/ui</h1>
      <Button>Click me</Button>
    </div>
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

  isKnownDeps(dep: string): boolean {
    if (['react', 'react-dom'].includes(dep)) {
      return true
    }

    if (['react/', 'react-dom/'].some(prefix => dep.startsWith(prefix))) {
      return true
    }

    return /^@webview\//.test(dep)
  }

  processUnknownDepsLink(cdnLink: string): string {
    return `${cdnLink}?external=react,react-dom`
  }

  getViteConfig(rootDir: string): ViteConfig {
    return {
      plugins: [react(), Unfonts()],
      resolve: {
        alias: {
          '@': path.resolve(rootDir, './src'),
          '@webview': path.resolve(rootDir, './src')
        }
      }
    }
  }
}
