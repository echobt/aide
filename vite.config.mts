/* eslint-disable unused-imports/no-unused-vars */
/* eslint-disable no-console */
import fs from 'fs'
import path, { dirname } from 'path'
import { fileURLToPath } from 'url'
import vscode from '@tomjs/vite-plugin-vscode'
import react from '@vitejs/plugin-react'
import cpy from 'cpy'
import { defineConfig } from 'vite'
import pages from 'vite-plugin-pages'
import svgr from 'vite-plugin-svgr'
import tsconfigPaths from 'vite-tsconfig-paths'

import pkg from './package.json'

const dir =
  typeof __dirname === 'string'
    ? __dirname
    : dirname(fileURLToPath(import.meta.url))

const resolvePath = (...paths: string[]) => path.resolve(dir, ...paths)

const extensionDistPath = resolvePath('dist/extension')

const resolveExtensionDistPath = (...paths: string[]) =>
  path.resolve(extensionDistPath, ...paths)

const toUnixPath = (p: string) => p.replace(/\\/g, '/')

const define: Record<string, string> = {}

// https://vitejs.dev/config/
export default defineConfig(async env => {
  const isBuild = env.command === 'build'
  process.env.APP_BUILD_TIME = `${Date.now()}`
  process.env.APP_VERSION = pkg.version

  // Get UI components and add to define
  const shadcnFiles = await getShadcnFiles()

  const serverDefine = {
    ...define,
    __SHADCN_FILES__: JSON.stringify(shadcnFiles)
  }

  return {
    define,
    plugins: [
      tsconfigPaths(),
      // react(),
      react({
        babel: {
          plugins: [['babel-plugin-react-compiler']]
        }
      }),
      svgr(),
      pages({
        dirs: 'src/webview/pages',
        routeStyle: 'next',
        importMode: 'sync',
        exclude: ['**/components/**']
      }),
      vscode({
        extension: {
          entry: toUnixPath(resolvePath('./src/extension/index.ts')),
          platform: 'node',
          target: 'node18',
          sourcemap: true,
          skipNodeModulesBundle: false,
          define: serverDefine,
          external: [
            './index.node' // shit, vectordb need this
          ],
          esbuildOptions(options) {
            options.alias = {
              ...options.alias,
              'onnxruntime-node': resolvePath(
                'node_modules/onnxruntime-node/dist/index.js'
              ),
              '@huggingface/transformers': resolvePath(
                'node_modules/@huggingface/transformers/src/transformers.js'
              ),
              rollup: '@rollup/wasm-node',
              esbuild: resolvePath('node_modules/esbuild-wasm/lib/main.js')
            }
          },
          plugins: [
            {
              name: 'copy-files',
              async buildStart() {
                await tsupCopyFiles()
              }
            }
          ]
        },
        webview: {
          csp: isBuild ? '<meta>' : undefined
        }
      })
    ],
    resolve: {
      dedupe: ['react', 'react-dom']
    },
    experimental: {
      renderBuiltUrl(filename: string, { hostType }: { hostType: string }) {
        if (hostType === 'js' && isBuild) {
          return { runtime: `window.__assetsPath(${JSON.stringify(filename)})` }
        }
        return { relative: true }
      }
    }
  }
})

const tsupCopyFiles = async () => {
  const targets = [
    // copy node_modules to extension dist
    {
      src: resolvePath('node_modules/tree-sitter-wasms/out/*.wasm'),
      dest: resolveExtensionDistPath('tree-sitter-wasms/')
    },
    {
      src: resolvePath('node_modules/web-tree-sitter/*.wasm'),
      dest: resolveExtensionDistPath('./')
    },
    // {
    //   src: resolvePath('node_modules/onnxruntime-node/bin/**'),
    //   dest: resolveExtensionDistPath('onnxruntime/bin/')
    // },
    {
      src: resolvePath(
        'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm'
      ),
      dest: resolveExtensionDistPath('./')
    },
    {
      src: resolvePath(
        'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs'
      ),
      dest: resolveExtensionDistPath('./')
    },
    {
      src: resolvePath('node_modules/@lancedb/**'),
      dest: resolveExtensionDistPath('node_modules/@lancedb/')
    },
    {
      src: resolvePath('src/extension/chat/models/**'),
      dest: resolveExtensionDistPath('models/')
    },
    {
      src: resolvePath('node_modules/vite/dist/client/**'),
      dest: resolveExtensionDistPath('../client/')
    },
    {
      src: resolvePath(
        'node_modules/@vitejs/plugin-react/dist/refreshUtils.js'
      ),
      dest: resolveExtensionDistPath('./')
    },
    {
      src: resolvePath('node_modules/tailwindcss3/src/css/**'),
      dest: resolveExtensionDistPath('./css/')
    },
    {
      src: resolvePath('node_modules/esbuild-wasm/bin/**'),
      dest: resolveExtensionDistPath('./esbuild-wasm/bin/')
    },
    {
      src: resolvePath('node_modules/esbuild-wasm/wasm_exec_node.js'),
      dest: resolveExtensionDistPath('./esbuild-wasm/')
    },
    {
      src: resolvePath('node_modules/esbuild-wasm/wasm_exec.js'),
      dest: resolveExtensionDistPath('./esbuild-wasm/')
    },
    {
      src: resolvePath('node_modules/esbuild-wasm/esbuild.wasm'),
      dest: resolveExtensionDistPath('./esbuild-wasm/')
    },
    {
      src: resolvePath(
        'node_modules/@rollup/wasm-node/dist/wasm-node/bindings_wasm_bg.wasm'
      ),
      dest: resolveExtensionDistPath('./')
    },
    {
      src: resolvePath('node_modules/react-refresh/**'),
      dest: resolveExtensionDistPath('./node_modules/react-refresh/')
    },

    // copy fix-packages to node_modules
    {
      src: resolvePath('scripts/fix-package/@huggingface/transformers/**'),
      dest: resolvePath('node_modules/@huggingface/transformers/src/')
    },
    // {
    //   src: resolvePath('scripts/fix-package/onnxruntime-node/**'),
    //   dest: resolvePath('node_modules/onnxruntime-node/dist/')
    // },
    {
      src: resolvePath('scripts/fix-package/esbuild-wasm/main.js'),
      dest: resolvePath('node_modules/esbuild-wasm/lib/')
    },
    {
      src: resolvePath('scripts/fix-package/lightningcss/index.js'),
      dest: resolvePath('node_modules/lightningcss/node/')
    }
  ]

  const promises = targets.map(async ({ src, dest }) => {
    await cpy(src, dest, {
      cwd: dir,
      overwrite: true
    })
  })

  await Promise.all(promises)
}

const getShadcnFiles = async () => {
  const uiDir = resolvePath('src/webview/components/ui')
  const shadcnFiles: Array<{
    relativePath: string
    content: string
  }> = []

  // Read all files recursively
  const readFilesRecursively = async (dir: string) => {
    const files = fs.readdirSync(dir)

    await Promise.allSettled(
      files.map(async file => {
        const fullPath = path.join(dir, file)
        const stat = await fs.promises.stat(fullPath)

        if (stat.isDirectory()) {
          await readFilesRecursively(fullPath)
        } else {
          const relativePath = path.join(
            'src/components/ui',
            path.relative(uiDir, fullPath)
          )
          const content = fs.readFileSync(fullPath, 'utf-8')

          shadcnFiles.push({
            relativePath,
            content
          })
        }
      })
    )
  }

  await readFilesRecursively(uiDir)

  return shadcnFiles
}
