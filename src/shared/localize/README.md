# 国际化 (i18n) 解决方案

本项目使用 i18next 作为国际化解决方案，统一管理 VSCode 扩展中的 Node 代码和 React 代码的国际化需求。

## 目录结构

```
src/shared/localize/
├── README.md                 # 本文档
├── index.ts                  # i18next 配置和初始化
├── types.ts                  # 类型定义
└── locales/                  # 翻译文件
    ├── extension/            # 扩展部分的翻译
    │   ├── en.ts             # 英文
    │   └── zh-cn.ts          # 中文
    └── webview/              # Webview 部分的翻译
        ├── en.ts             # 英文
        └── zh-cn.ts          # 中文
```

## 使用方法

### 在扩展 (Node) 代码中使用

```typescript
import { t } from '../extension/i18n'

// 简单使用
console.log(t('command.copyAsPrompt')) // "✨ Aide: Copy As AI Prompt"

// 带参数使用
console.log(t('info.batchProcessorSuccess', 5, 'task1, task2'))
// "AI batch processor success! Total 5 files generated, you can review and replace manually. Tasks completed: task1, task2"
```

### 在 React 组件中使用

```tsx
import { useI18n } from '../webview/contexts/i18n-context'

const MyComponent = () => {
  const { t, locale, setLocale } = useI18n()

  return (
    <div>
      <h1>{t('common.loading')}</h1>
      <button onClick={() => setLocale('zh-cn')}>切换到中文</button>
      <button onClick={() => setLocale('en')}>Switch to English</button>
    </div>
  )
}
```

## 添加新的翻译

1. 在相应的翻译文件中添加新的翻译项：

```typescript
// src/shared/localize/locales/extension/en.ts
export default {
  newFeature: {
    title: 'New Feature',
    description: 'This is a new feature'
  }
}

// src/shared/localize/locales/extension/zh-cn.ts
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
export type Locale = 'en' | 'zh-cn' | 'ja' // 添加日语
```

2. 创建新语言的翻译文件：

```
src/shared/localize/locales/extension/ja.ts
src/shared/localize/locales/webview/ja.ts
```

3. 在 `src/shared/localize/index.ts` 中导入并添加新语言：

```typescript
import jaExtension from './locales/extension/ja'
import jaWebview from './locales/webview/ja'

const resources: LocaleResources = {
  // 现有语言...
  ja: {
    [NAMESPACES.extension]: { translation: jaExtension },
    [NAMESPACES.webview]: { translation: jaWebview }
  }
}
```

4. 更新生成脚本以支持新语言：

```typescript
// scripts/generate-nls.ts
import jaExtension from '../src/shared/localize/locales/extension/ja'

// 添加生成日语 nls 文件的代码
fs.writeFileSync(
  path.join(rootDir, 'package.nls.ja.json'),
  JSON.stringify(flattenObject(jaExtension), null, 2)
)
```
