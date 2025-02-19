/* eslint-disable unused-imports/no-unused-vars */
import path from 'path'
import vue from '@vitejs/plugin-vue'

import { WebVMPresetName } from '../_base/constants'
import { commonPresetFiles } from '../_base/shared-files'
import {
  IFrameworkPreset,
  WebVMFiles,
  type IAIPrompt,
  type ViteConfig
} from '../../types'
import { getAIPrompts } from './get-ai-prompts'

export class Vue3ElementPlusPreset implements IFrameworkPreset {
  getPresetName(): string {
    return WebVMPresetName.Vue3ElementPlus
  }

  getAIPrompts(): IAIPrompt {
    return getAIPrompts()
  }

  getBaseProjectFiles(): WebVMFiles {
    return [
      ...commonPresetFiles,
      {
        relativePathOrSchemeUri: 'index.html',
        content: `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vue + Element Plus</title>
    <script type="importmap">
      {
        "imports": {
          "vue": "https://esm.sh/vue",
          "vue/": "https://esm.sh/vue/",
          "vue-router": "https://esm.sh/vue-router@latest&external=vue",
          "vue-router/": "https://esm.sh/vue-router@latest&external=vue/",
          "element-plus": "https://esm.sh/element-plus@latest&external=vue",
          "element-plus/": "https://esm.sh/element-plus@latest&external=vue/"
        }
      }
    </script>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>`
      },
      {
        relativePathOrSchemeUri: 'src/main.ts',
        content: `
import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import routes from '~pages'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import App from './App.vue'
import './styles/global.css'

const router = createRouter({
  history: createWebHistory(),
  routes,
})

const app = createApp(App)
app.use(router)
app.use(ElementPlus)
app.mount('#app')`
      },
      {
        relativePathOrSchemeUri: 'src/styles/global.css',
        content: `
*,
*::before,
*::after {
  box-sizing: border-box;
}

html,
body,
#app {
  width: 100%;
  height: 100%;
}

body {
  margin: 0;
  padding: 0;
  font-family: 'Inter', sans-serif;
}

`
      },
      {
        relativePathOrSchemeUri: 'src/App.vue',
        content: `
<template>
  <router-view />
</template>`
      },
      {
        relativePathOrSchemeUri: 'tsconfig.json',
        content: `{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "preserve",

    /* Type Checking */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,

    /* Paths */
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*.ts", "src/**/*.d.ts", "src/**/*.tsx", "src/**/*.vue"],
  "references": [{ "path": "./tsconfig.node.json" }]
}`
      },
      {
        relativePathOrSchemeUri: 'tsconfig.node.json',
        content: `{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}`
      }
    ]
  }

  getProjectFilesForInstructions(): WebVMFiles {
    return this.getBaseProjectFiles()
  }

  isKnownDeps(dep: string): boolean {
    if (['vue', 'vue-router', 'element-plus'].includes(dep)) {
      return true
    }

    if (
      ['vue/', 'vue-router/', 'element-plus/'].some(prefix =>
        dep.startsWith(prefix)
      )
    ) {
      return true
    }

    return false
  }

  processUnknownDepsLink(cdnLink: string): string {
    return `${cdnLink}?external=vue,vue-router,element-plus`
  }

  getViteConfig(rootDir: string): ViteConfig {
    return {
      plugins: [
        vue()
        // cdn(this.getViteCdnConfig())
      ],
      resolve: {
        alias: {
          '@': path.resolve(rootDir, './src')
        }
      }
    }
  }
}
