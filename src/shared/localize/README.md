# i18n solution

This project uses i18next as the internationalization solution, unifying the internationalization needs of Node code and React code in the VSCode extension.

## Directory structure

```
src/shared/localize/
├── README.md                 # This document
├── index.ts                  # i18next configuration and initialization
├── types.ts                  # Type definitions
└── locales/                  # Translation files
    ├── en/                   # English translation
    │   ├── extension.ts      # English translation of the extension part
    │   ├── shared.ts         # English translation of the shared part
    │   ├── webview.ts        # English translation of the webview part
    │   └── index.ts          # Export all English translations
    └── zh-cn/                # Chinese translation
        ├── extension.ts      # Chinese translation of the extension part
        ├── shared.ts         # Chinese translation of the shared part
        ├── webview.ts        # Chinese translation of the webview part
        └── index.ts          # Export all Chinese translations
```

## Usage

### Use in extension (Node) code

```typescript
import { t } from 'i18next'

// Simple usage
console.log(t('extension.command.copyAsPrompt')) // "✨ Aide: Copy As AI Prompt"

// Usage with parameters
console.log(
  t('extension.info.batchProcessorSuccess', { count: 5, tasks: 'task1, task2' })
)
// "AI batch processor success! Total 5 files generated, you can review and replace manually. Tasks completed: task1, task2"
```

### Use in React component

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

## Add new translations

1. Add new translation items in the corresponding translation file:

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

2. Run the generation script to update the package.nls.json file:

```bash
pnpm run generate-nls
```

## Add new languages

1. Update the `Locale` type in `src/shared/localize/types.ts`:

```typescript
export type Locale = 'en' | 'zh-cn' | 'ja' | '' // Add Japanese
```

2. Create a new language translation file directory and file:

```
src/shared/localize/locales/ja/
├── extension.ts
├── shared.ts
├── webview.ts
└── index.ts
```

3. Import and add the new language in `src/shared/localize/index.ts`:

```typescript
import en from './locales/en'
import ja from './locales/ja' // Import Japanese translation
import zhCn from './locales/zh-cn'

// Combine all resources
const resources: LocaleResources = {
  en,
  'zh-cn': zhCn,
  ja // Add Japanese resources
}
```

4. Update VSCode language mapping (if needed):

```typescript
// src/shared/localize/types.ts
export const vscodeLocaleMap: Record<string, Locale> = {
  // Existing languages...

  // Japanese
  ja: 'ja',
  'ja-jp': 'ja',

  // Default to English for other languages
  default: 'en'
}
```

5. Update the generation script to support the new language:

```typescript
// scripts/generate-nls.ts
import jaExtension from '../src/shared/localize/locales/ja/extension'

// Add code to generate the Japanese nls file
fs.writeFileSync(
  path.join(rootDir, 'package.nls.ja.json'),
  JSON.stringify(flattenObject(jaExtension), null, 2)
)
```
