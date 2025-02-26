# 国际化 (i18n) 解决方案

本项目使用 i18next 作为国际化解决方案，统一管理 VSCode 扩展中的 Node 代码和 React 代码的国际化需求。

## 目录结构

```
src/shared/localize/
├── README.md                 # 本文档
├── index.ts                  # i18next 配置和初始化
├── types.ts                  # 类型定义
└── locales/                  # 翻译文件
    ├── en/                   # 英文翻译
    │   ├── extension.ts      # 扩展部分的英文翻译
    │   ├── shared.ts         # 共享部分的英文翻译
    │   ├── webview.ts        # Webview 部分的英文翻译
    │   └── index.ts          # 导出所有英文翻译
    └── zh-cn/                # 中文翻译
        ├── extension.ts      # 扩展部分的中文翻译
        ├── shared.ts         # 共享部分的中文翻译
        ├── webview.ts        # Webview 部分的中文翻译
        └── index.ts          # 导出所有中文翻译
```

## 使用方法

### 在扩展 (Node) 代码中使用

```typescript
import { t } from 'i18next'

// 简单使用
console.log(t('extension.command.copyAsPrompt')) // "✨ Aide: Copy As AI Prompt"

// 带参数使用
console.log(
  t('extension.info.batchProcessorSuccess', { count: 5, tasks: 'task1, task2' })
)
// "AI batch processor success! Total 5 files generated, you can review and replace manually. Tasks completed: task1, task2"
```

### 在 React 组件中使用

```tsx
import { useTranslation } from 'react-i18next'

const MyComponent = () => {
  const { t, i18n } = useTranslation()

  return (
    <div>
      <h1>{t('webview.common.loading')}</h1>
    </div>
  )
}
```

## 添加新的翻译

1. 在相应的翻译文件中添加新的翻译项：

```typescript
// src/shared/localize/locales/en/extension.ts
export default {
  newFeature: {
    title: 'New Feature',
    description: 'This is a new feature'
  }
}

// src/shared/localize/locales/zh-cn/extension.ts
export default {
  newFeature: {
    title: '新功能',
    description: '这是一个新功能'
  }
}
```

2. 运行生成脚本更新 package.nls.json 文件：

```bash
pnpm run generate-nls
```

## 添加新的语言

1. 在 `src/shared/localize/types.ts` 中更新 `Locale` 类型：

```typescript
export type Locale = 'en' | 'zh-cn' | 'ja' | '' // 添加日语
```

2. 创建新语言的翻译文件目录和文件：

```
src/shared/localize/locales/ja/
├── extension.ts
├── shared.ts
├── webview.ts
└── index.ts
```

3. 在 `src/shared/localize/index.ts` 中导入并添加新语言：

```typescript
import en from './locales/en'
import ja from './locales/ja' // 导入日语翻译
import zhCn from './locales/zh-cn'

// Combine all resources
const resources: LocaleResources = {
  en,
  'zh-cn': zhCn,
  ja // 添加日语资源
}
```

4. 更新 VSCode 语言映射（如果需要）：

```typescript
// src/shared/localize/types.ts
export const vscodeLocaleMap: Record<string, Locale> = {
  // 现有语言...

  // 日语
  ja: 'ja',
  'ja-jp': 'ja',

  // Default to English for other languages
  default: 'en'
}
```

5. 更新生成脚本以支持新语言：

```typescript
// scripts/generate-nls.ts
import jaExtension from '../src/shared/localize/locales/ja/extension'

// 添加生成日语 nls 文件的代码
fs.writeFileSync(
  path.join(rootDir, 'package.nls.ja.json'),
  JSON.stringify(flattenObject(jaExtension), null, 2)
)
```
