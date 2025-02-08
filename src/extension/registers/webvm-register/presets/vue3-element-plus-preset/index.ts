/* eslint-disable unused-imports/no-unused-vars */
import path from 'path'
import vue from '@vitejs/plugin-vue'

import { IFrameworkPreset, WebVMFiles, type ViteConfig } from '../../types'

export class Vue3ElementPlusPreset implements IFrameworkPreset {
  getPresetName(): string {
    return 'vue3-element-plus'
  }

  getBaseProjectFiles(): WebVMFiles {
    return [
      {
        relativePathOrSchemeUri: 'index.html',
        content: `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vue + Element Plus</title>
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
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import App from './App.vue'

const app = createApp(App)
app.use(ElementPlus)
app.mount('#app')`
      },
      {
        relativePathOrSchemeUri: 'src/App.vue',
        content: `
<template>
  <div class="container">
    <h1>Welcome to Vue + Element Plus</h1>
    <el-button type="primary">Click me</el-button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
</script>

<style scoped>
.container {
  padding: 20px;
}
</style>`
      }
    ]
  }

  isKnownDeps(dep: string): boolean {
    return false
  }

  processUnknownDepsLink(cdnLink: string): string {
    return cdnLink
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
