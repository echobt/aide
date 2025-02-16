import path from 'path'
import { vfs } from '@extension/file-utils/vfs'
import { type Plugin } from 'vite'

const whitePathIds = ['unfonts.css']

// Create a plugin to redirect unknown deps to ESM
export const depsRedirectPlugin = (
  rootDir: string,
  isKnownDeps: (dep: string) => boolean,
  processUnknownDepsLink: (cdnLink: string, pathId: string) => string
): Plugin => ({
  name: 'deps-redirect',
  async resolveId(id: string) {
    let isKnown = false

    if (isKnownDeps(id)) {
      isKnown = true
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

    if (isKnownDeps(pkgName)) {
      isKnown = true
    }

    let cdnLink = processUnknownDepsLink(`https://esm.sh/${id}`, id)

    if (id.endsWith('.css')) {
      cdnLink = processUnknownDepsLink(`https://esm.sh/${id}.js`, id)
      return {
        id: `virtual-link:${cdnLink}`
      }
    }

    if (isKnown) {
      return {
        id,
        external: true
      }
    }

    // Redirect to ESM.sh
    return {
      id: cdnLink,
      external: true
    }
  },
  load(id) {
    const linkRegex = /virtual-link:([\w\W]+)/
    const matchLink = id.match(linkRegex)?.[1]
    let decodedLink = ''
    let isCssUrl = false

    try {
      const url = new URL(matchLink || '')
      url.pathname = url.pathname.replace(/\.js$/, '')
      isCssUrl = url.pathname.endsWith('.css')
      decodedLink = url.toString()
    } catch (error) {}

    if (decodedLink && isCssUrl) {
      // return js that dynamically inserts a link tag
      return `
          ;(function() {
            /* check if the stylesheet is already loaded */
            if (document.querySelector('link[href="${decodedLink}"]')) return;

            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = '${decodedLink}';
            document.head.appendChild(link);
          })();
          export default {};
        `
    }
    return null
  }
})
