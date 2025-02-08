import path from 'path'
import { vfs } from '@extension/file-utils/vfs'
import { defineConfig, mergeConfig, type Plugin } from 'vite'

import type { ViteConfig } from '../types'

interface CreateBaseViteConfigOptions {
  rootDir: string
  isKnownDeps: (dep: string) => boolean
  processUnknownDepsLink: (cdnLink: string, pathId: string) => string
}

const whitePathIds = ['unfonts.css']

// Create a plugin to redirect unknown deps to ESM
const createDepsRedirectPlugin = (
  rootDir: string,
  isKnownDeps: (dep: string) => boolean,
  processUnknownDepsLink: (cdnLink: string, pathId: string) => string
): Plugin => ({
  name: 'deps-redirect',
  async resolveId(id: string) {
    if (isKnownDeps(id))
      return {
        id,
        external: true
      }

    // Skip relative imports and known deps
    if (id.startsWith('.') || id.startsWith('/') || whitePathIds.includes(id)) {
      return null
    }

    // must start with a letter or @
    if (!/^[a-z@]/.test(id)) return null

    const fullPath = path.resolve(rootDir, id)
    if (await vfs.isExists(fullPath)) return null

    // Get package name from import path
    let pkgName = id.split('/')[0]
    if (pkgName && pkgName.startsWith('@')) {
      pkgName = id.split('/').slice(0, 2).join('/')
    }

    if (!pkgName) return null

    if (isKnownDeps(pkgName))
      return {
        id,
        external: true
      }

    const finalCdnLink = processUnknownDepsLink(`https://esm.sh/${id}`, id)

    if (id.endsWith('.css')) {
      return {
        id: `virtual-link:${finalCdnLink}.virtual-import.js`
      }
    }

    // Redirect to ESM.sh
    return {
      id: finalCdnLink,
      external: true
    }
  },
  load(id) {
    const linkRegex = /virtual-link:([\w\W]+)\.virtual-import\.js/
    const matchLink = id.match(linkRegex)?.[1]

    if (matchLink && matchLink.endsWith('.css')) {
      // return js that dynamically inserts a link tag
      return `
          ;(function() {
            /* check if the stylesheet is already loaded */
            if (document.querySelector('link[href="${matchLink}"]')) return;

            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = '${matchLink}';
            document.head.appendChild(link);
          })();
          export default {};
        `
    }
    return null
  }
})

const createBaseViteConfig = ({
  rootDir,
  isKnownDeps,
  processUnknownDepsLink
}: CreateBaseViteConfigOptions): ViteConfig =>
  defineConfig({
    mode: 'production',
    root: rootDir,
    plugins: [
      createDepsRedirectPlugin(rootDir, isKnownDeps, processUnknownDepsLink)
    ],
    // disable esbuild optimization
    esbuild: false,
    optimizeDeps: {
      noDiscovery: true
    },
    build: {
      outDir: path.resolve(rootDir, './dist'),
      rollupOptions: {
        output: {
          importAttributesKey: 'with'
        }
      }
    }
  })

export const mergeWithBaseViteConfig = (
  viteConfig: ViteConfig,
  baseViteConfigOptions: CreateBaseViteConfigOptions
): ViteConfig => {
  const baseViteConfig = createBaseViteConfig(baseViteConfigOptions)
  return mergeConfig(baseViteConfig, viteConfig)
}
