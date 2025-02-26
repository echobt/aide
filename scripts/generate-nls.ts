import * as fs from 'fs'
import * as path from 'path'

// Import extension translations
import enExtension from '../src/shared/localize/locales/en/extension'
import zhCnExtension from '../src/shared/localize/locales/zh-cn/extension'

/**
 * Flatten nested object to dot notation
 * @param obj Object to flatten
 * @param prefix Prefix for keys
 * @returns Flattened object
 */
function flattenObject(
  obj: Record<string, any>,
  prefix = ''
): Record<string, string> {
  return Object.keys(obj).reduce((acc: Record<string, string>, key: string) => {
    const pre = prefix.length ? `${prefix}.` : ''

    if (
      typeof obj[key] === 'object' &&
      obj[key] !== null &&
      !Array.isArray(obj[key])
    ) {
      Object.assign(acc, flattenObject(obj[key], `${pre}${key}`))
    } else {
      acc[`${pre}${key}`] = obj[key]
    }

    return acc
  }, {})
}

/**
 * Generate package.nls.json files
 */
async function generateNlsFiles() {
  const rootDir = path.resolve(__dirname, '..')

  // Flatten the nested objects to dot notation
  const enFlat = flattenObject(enExtension)
  const zhCnFlat = flattenObject(zhCnExtension)

  // Write English (default) file
  fs.writeFileSync(
    path.join(rootDir, 'package.nls.json'),
    JSON.stringify(enFlat, null, 2)
  )

  // Write English file
  fs.writeFileSync(
    path.join(rootDir, 'package.nls.en.json'),
    JSON.stringify(enFlat, null, 2)
  )

  // Write Chinese file
  fs.writeFileSync(
    path.join(rootDir, 'package.nls.zh-cn.json'),
    JSON.stringify(zhCnFlat, null, 2)
  )

  console.log('Generated package.nls.json files successfully!')
}

// Run the script
generateNlsFiles().catch(err => {
  console.error('Error generating NLS files:', err)
  process.exit(1)
})
