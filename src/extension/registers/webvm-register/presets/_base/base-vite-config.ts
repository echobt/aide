import path from 'path'
import Unfonts from 'unplugin-fonts/vite'
import { defineConfig, mergeConfig } from 'vite'
import externalize from 'vite-plugin-externalize-dependencies'
import pages from 'vite-plugin-pages'

import type { ViteConfig } from '../../types'
import { connectWMCode } from './constants'
import { depsRedirectPlugin } from './plugins/deps-redirect-plugin'
import { imageQueryPlugin } from './plugins/image-query-plugin'
import { injectHtmlPlugin } from './plugins/inject-html-plugin'

interface CreateBaseViteConfigOptions {
  port: number
  rootDir: string
  isKnownDeps: (dep: string) => boolean
  processUnknownDepsLink: (cdnLink: string, pathId: string) => string
}

const createBaseViteConfig = ({
  rootDir,
  port,
  isKnownDeps,
  processUnknownDepsLink
}: CreateBaseViteConfigOptions): ViteConfig =>
  defineConfig({
    mode: 'production',
    root: path.normalize(rootDir),
    plugins: [
      Unfonts(),
      externalize({
        externals: [
          moduleName => {
            // will be handled by depsRedirectPlugin
            if (moduleName.endsWith('.css')) return false

            return isKnownDeps(moduleName)
          }
        ]
      }),
      depsRedirectPlugin(rootDir, isKnownDeps, processUnknownDepsLink),
      imageQueryPlugin(),
      injectHtmlPlugin({
        target: 'head',
        elements: [
          {
            tagName: 'script',
            attributes: {
              type: 'text/javascript'
            },
            children: connectWMCode
          }
        ]
      }),
      pages({
        dirs: 'src/pages',
        routeStyle: 'next',
        importMode: 'sync',
        exclude: ['**/components/**']
      })
    ],
    // disable esbuild optimization
    esbuild: false,
    optimizeDeps: {
      noDiscovery: true
    },
    build: {
      outDir: path.normalize(path.resolve(rootDir, './dist')),
      rollupOptions: {
        output: {
          importAttributesKey: 'with'
        }
      }
    },
    server: {
      port
    }
  })

export const mergeWithBaseViteConfig = (
  viteConfig: ViteConfig,
  baseViteConfigOptions: CreateBaseViteConfigOptions
): ViteConfig => {
  const baseViteConfig = createBaseViteConfig(baseViteConfigOptions)
  return mergeConfig(baseViteConfig, viteConfig)
}
