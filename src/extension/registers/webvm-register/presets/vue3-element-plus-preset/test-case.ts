import type { RegisterManager } from '@extension/registers/register-manager'

import { Vue3ElementPlusPreset } from '.'
import { WebVMRegister } from '../../index'

export const runTestCase = async (registerManager: RegisterManager) => {
  const webvmRegister = registerManager.getRegister(WebVMRegister)!
  const projectId = 'test'
  const presetName = new Vue3ElementPlusPreset().getPresetName()
  const orchestrator = await webvmRegister.addOrchestrator({
    projectId,
    presetName
  })
  orchestrator.startPreviewWithFiles([
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
  <h1>Welcome to Vue3 + Element Plus</h1>
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
  ])
}
