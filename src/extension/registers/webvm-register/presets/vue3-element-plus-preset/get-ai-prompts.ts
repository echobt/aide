import { IAIPrompt } from '../../types'

export const getAIPrompts = (): IAIPrompt => ({
  frameworkName: 'Vue3',
  iconPkgName: '@element-plus/icons-vue',
  stackInstructionsPrompt: `Vue 3 + Element Plus + vite + vue-router hash router`,
  stylingPrompt: ``,
  frameworkExamplesPrompt: ``,
  projectsExamplesPrompt: ``
})
