import { createContext, useContext, ParentProps, createSignal, createMemo } from "solid-js";

// ============================================================================
// Types
// ============================================================================

export interface IconDefinition {
  icon: string;
  color: string;
}

export interface IconTheme {
  id: string;
  name: string;
  description: string;
  icons: {
    file: IconDefinition;
    folder: IconDefinition;
    folderOpen: IconDefinition;
    fileExtensions: Record<string, IconDefinition>;
    fileNames: Record<string, IconDefinition>;
    folderNames: Record<string, IconDefinition>;
    folderNamesOpen: Record<string, IconDefinition>;
  };
}

export interface IconThemeState {
  activeThemeId: string;
}

export interface IconThemeContextValue {
  activeTheme: () => IconTheme;
  themes: () => IconTheme[];
  setIconTheme: (id: string) => void;
  getFileIcon: (filename: string) => IconDefinition;
  getFolderIcon: (name: string, open: boolean) => IconDefinition;
}

// ============================================================================
// Storage Key
// ============================================================================

const STORAGE_KEY = "cortex-icon-theme";
const DEFAULT_THEME_ID = "seti";

// ============================================================================
// Built-in Icon Themes
// ============================================================================

const setiTheme: IconTheme = {
  id: "seti",
  name: "Seti",
  description: "Classic file icons inspired by Seti UI",
  icons: {
    file: { icon: "📄", color: "#d4d4d8" },
    folder: { icon: "📁", color: "#dcb67a" },
    folderOpen: { icon: "📂", color: "#dcb67a" },
    fileExtensions: {
      // TypeScript/JavaScript
      ts: { icon: "📘", color: "#3178c6" },
      tsx: { icon: "⚛️", color: "#3178c6" },
      js: { icon: "📒", color: "#f7df1e" },
      jsx: { icon: "⚛️", color: "#f7df1e" },
      mjs: { icon: "📒", color: "#f7df1e" },
      cjs: { icon: "📒", color: "#f7df1e" },
      // Web
      html: { icon: "🌐", color: "#e34c26" },
      htm: { icon: "🌐", color: "#e34c26" },
      css: { icon: "🎨", color: "#563d7c" },
      scss: { icon: "🎨", color: "#c6538c" },
      sass: { icon: "🎨", color: "#c6538c" },
      less: { icon: "🎨", color: "#1d365d" },
      styl: { icon: "🎨", color: "#ff6347" },
      vue: { icon: "💚", color: "#42b883" },
      svelte: { icon: "🔥", color: "#ff3e00" },
      // Data/Config
      json: { icon: "📋", color: "#cbcb41" },
      jsonc: { icon: "📋", color: "#cbcb41" },
      json5: { icon: "📋", color: "#cbcb41" },
      yaml: { icon: "⚙️", color: "#cb171e" },
      yml: { icon: "⚙️", color: "#cb171e" },
      toml: { icon: "⚙️", color: "#9c4121" },
      xml: { icon: "📄", color: "#e37933" },
      ini: { icon: "⚙️", color: "#6d8086" },
      env: { icon: "🔐", color: "#faf743" },
      // Programming Languages
      py: { icon: "🐍", color: "#3572a5" },
      pyw: { icon: "🐍", color: "#3572a5" },
      pyi: { icon: "🐍", color: "#3572a5" },
      rs: { icon: "🦀", color: "#dea584" },
      go: { icon: "🐹", color: "#00add8" },
      java: { icon: "☕", color: "#b07219" },
      kt: { icon: "🟣", color: "#a97bff" },
      kts: { icon: "🟣", color: "#a97bff" },
      swift: { icon: "🍎", color: "#f05138" },
      c: { icon: "🔷", color: "#555555" },
      cpp: { icon: "🔷", color: "#f34b7d" },
      cc: { icon: "🔷", color: "#f34b7d" },
      cxx: { icon: "🔷", color: "#f34b7d" },
      h: { icon: "📎", color: "#555555" },
      hpp: { icon: "📎", color: "#f34b7d" },
      hxx: { icon: "📎", color: "#f34b7d" },
      cs: { icon: "🟢", color: "#178600" },
      rb: { icon: "💎", color: "#701516" },
      php: { icon: "🐘", color: "#4f5d95" },
      lua: { icon: "🌙", color: "#000080" },
      r: { icon: "📊", color: "#198ce7" },
      scala: { icon: "🔴", color: "#c22d40" },
      clj: { icon: "🟢", color: "#db5855" },
      cljs: { icon: "🟢", color: "#db5855" },
      ex: { icon: "💧", color: "#6e4a7e" },
      exs: { icon: "💧", color: "#6e4a7e" },
      erl: { icon: "🔴", color: "#b83998" },
      hs: { icon: "🟣", color: "#5e5086" },
      ml: { icon: "🐫", color: "#dc6b19" },
      fs: { icon: "🔵", color: "#b845fc" },
      fsx: { icon: "🔵", color: "#b845fc" },
      nim: { icon: "👑", color: "#ffc200" },
      zig: { icon: "⚡", color: "#f7a41d" },
      v: { icon: "🔷", color: "#5d87bf" },
      d: { icon: "🔴", color: "#ba595e" },
      dart: { icon: "🎯", color: "#00b4ab" },
      // Shell/Scripts
      sh: { icon: "💻", color: "#89e051" },
      bash: { icon: "💻", color: "#89e051" },
      zsh: { icon: "💻", color: "#89e051" },
      fish: { icon: "🐟", color: "#89e051" },
      ps1: { icon: "💻", color: "#012456" },
      psm1: { icon: "💻", color: "#012456" },
      bat: { icon: "💻", color: "#c1f12e" },
      cmd: { icon: "💻", color: "#c1f12e" },
      // Documentation
      md: { icon: "📝", color: "#083fa1" },
      mdx: { icon: "📝", color: "#083fa1" },
      txt: { icon: "📄", color: "#d4d4d8" },
      rst: { icon: "📝", color: "#141414" },
      adoc: { icon: "📝", color: "#e40046" },
      org: { icon: "📝", color: "#77aa99" },
      // Documents
      pdf: { icon: "📕", color: "#ff0000" },
      doc: { icon: "📘", color: "#2b579a" },
      docx: { icon: "📘", color: "#2b579a" },
      xls: { icon: "📗", color: "#217346" },
      xlsx: { icon: "📗", color: "#217346" },
      ppt: { icon: "📙", color: "#d24726" },
      pptx: { icon: "📙", color: "#d24726" },
      odt: { icon: "📄", color: "#0066b3" },
      // Images
      svg: { icon: "🖼️", color: "#ffb13b" },
      png: { icon: "🖼️", color: "#a074c4" },
      jpg: { icon: "🖼️", color: "#a074c4" },
      jpeg: { icon: "🖼️", color: "#a074c4" },
      gif: { icon: "🖼️", color: "#a074c4" },
      ico: { icon: "🖼️", color: "#a074c4" },
      webp: { icon: "🖼️", color: "#a074c4" },
      bmp: { icon: "🖼️", color: "#a074c4" },
      tiff: { icon: "🖼️", color: "#a074c4" },
      psd: { icon: "🖼️", color: "#31a8ff" },
      ai: { icon: "🖼️", color: "#ff9a00" },
      sketch: { icon: "🖼️", color: "#f7b500" },
      figma: { icon: "🖼️", color: "#a259ff" },
      // Audio/Video
      mp3: { icon: "🎵", color: "#e91e63" },
      wav: { icon: "🎵", color: "#e91e63" },
      ogg: { icon: "🎵", color: "#e91e63" },
      flac: { icon: "🎵", color: "#e91e63" },
      mp4: { icon: "🎬", color: "#f44336" },
      mkv: { icon: "🎬", color: "#f44336" },
      avi: { icon: "🎬", color: "#f44336" },
      mov: { icon: "🎬", color: "#f44336" },
      webm: { icon: "🎬", color: "#f44336" },
      // Archives
      zip: { icon: "📦", color: "#6d8086" },
      tar: { icon: "📦", color: "#6d8086" },
      gz: { icon: "📦", color: "#6d8086" },
      rar: { icon: "📦", color: "#6d8086" },
      "7z": { icon: "📦", color: "#6d8086" },
      bz2: { icon: "📦", color: "#6d8086" },
      xz: { icon: "📦", color: "#6d8086" },
      // Database
      sql: { icon: "🗃️", color: "#e38c00" },
      db: { icon: "🗃️", color: "#ff5555" },
      sqlite: { icon: "🗃️", color: "#003b57" },
      mongodb: { icon: "🍃", color: "#13aa52" },
      // Fonts
      ttf: { icon: "🔤", color: "#ec5252" },
      otf: { icon: "🔤", color: "#ec5252" },
      woff: { icon: "🔤", color: "#ec5252" },
      woff2: { icon: "🔤", color: "#ec5252" },
      eot: { icon: "🔤", color: "#ec5252" },
      // Certificates/Keys
      pem: { icon: "🔑", color: "#a8b9cc" },
      crt: { icon: "🔑", color: "#a8b9cc" },
      key: { icon: "🔑", color: "#a8b9cc" },
      cer: { icon: "🔑", color: "#a8b9cc" },
      // Logs
      log: { icon: "📜", color: "#6d8086" },
      // Build outputs
      wasm: { icon: "🔲", color: "#654ff0" },
      dll: { icon: "⚙️", color: "#6d8086" },
      so: { icon: "⚙️", color: "#6d8086" },
      dylib: { icon: "⚙️", color: "#6d8086" },
      o: { icon: "⚙️", color: "#6d8086" },
      a: { icon: "⚙️", color: "#6d8086" },
      exe: { icon: "⚙️", color: "#6d8086" },
      // Lock files
      lock: { icon: "🔒", color: "#525252" },
      // GraphQL
      graphql: { icon: "💠", color: "#e535ab" },
      gql: { icon: "💠", color: "#e535ab" },
      // Prisma
      prisma: { icon: "🔺", color: "#1a202c" },
      // Terraform
      tf: { icon: "🏗️", color: "#844fba" },
      tfvars: { icon: "🏗️", color: "#844fba" },
      // Protobuf
      proto: { icon: "📡", color: "#4285f4" },
      // Makefile
      mk: { icon: "🔨", color: "#6d8086" },
    },
    fileNames: {
      // Package managers
      "package.json": { icon: "📦", color: "#e8274b" },
      "package-lock.json": { icon: "🔒", color: "#525252" },
      "yarn.lock": { icon: "🔒", color: "#2c8ebb" },
      "pnpm-lock.yaml": { icon: "🔒", color: "#f9ad00" },
      "bun.lockb": { icon: "🔒", color: "#fbf0df" },
      "deno.json": { icon: "🦕", color: "#16f3d0" },
      "deno.jsonc": { icon: "🦕", color: "#16f3d0" },
      "deno.lock": { icon: "🔒", color: "#16f3d0" },
      // Configuration
      "tsconfig.json": { icon: "📘", color: "#3178c6" },
      "jsconfig.json": { icon: "📒", color: "#f7df1e" },
      ".eslintrc": { icon: "📏", color: "#4b32c3" },
      ".eslintrc.js": { icon: "📏", color: "#4b32c3" },
      ".eslintrc.json": { icon: "📏", color: "#4b32c3" },
      ".eslintrc.cjs": { icon: "📏", color: "#4b32c3" },
      ".eslintrc.yml": { icon: "📏", color: "#4b32c3" },
      "eslint.config.js": { icon: "📏", color: "#4b32c3" },
      "eslint.config.mjs": { icon: "📏", color: "#4b32c3" },
      ".prettierrc": { icon: "🎀", color: "#56b3b4" },
      ".prettierrc.json": { icon: "🎀", color: "#56b3b4" },
      ".prettierrc.js": { icon: "🎀", color: "#56b3b4" },
      ".prettierrc.yml": { icon: "🎀", color: "#56b3b4" },
      "prettier.config.js": { icon: "🎀", color: "#56b3b4" },
      ".prettierignore": { icon: "🎀", color: "#56b3b4" },
      "tailwind.config.js": { icon: "🌊", color: "#38bdf8" },
      "tailwind.config.ts": { icon: "🌊", color: "#38bdf8" },
      "postcss.config.js": { icon: "📮", color: "#dd3a0a" },
      "postcss.config.cjs": { icon: "📮", color: "#dd3a0a" },
      "vite.config.js": { icon: "⚡", color: "#646cff" },
      "vite.config.ts": { icon: "⚡", color: "#646cff" },
      "webpack.config.js": { icon: "📦", color: "#8dd6f9" },
      "rollup.config.js": { icon: "📦", color: "#ef3335" },
      "rollup.config.mjs": { icon: "📦", color: "#ef3335" },
      "next.config.js": { icon: "▲", color: "#ffffff" },
      "next.config.mjs": { icon: "▲", color: "#ffffff" },
      "nuxt.config.js": { icon: "💚", color: "#00dc82" },
      "nuxt.config.ts": { icon: "💚", color: "#00dc82" },
      "svelte.config.js": { icon: "🔥", color: "#ff3e00" },
      "astro.config.mjs": { icon: "🚀", color: "#ff5d01" },
      // Git
      ".gitignore": { icon: "🚫", color: "#f05032" },
      ".gitattributes": { icon: "🔧", color: "#f05032" },
      ".gitmodules": { icon: "🔗", color: "#f05032" },
      ".gitkeep": { icon: "📌", color: "#f05032" },
      // Docker
      "Dockerfile": { icon: "🐳", color: "#2496ed" },
      "dockerfile": { icon: "🐳", color: "#2496ed" },
      "docker-compose.yml": { icon: "🐳", color: "#2496ed" },
      "docker-compose.yaml": { icon: "🐳", color: "#2496ed" },
      ".dockerignore": { icon: "🐳", color: "#2496ed" },
      // CI/CD
      ".travis.yml": { icon: "🔧", color: "#cc0000" },
      ".gitlab-ci.yml": { icon: "🦊", color: "#fc6d26" },
      "Jenkinsfile": { icon: "🔧", color: "#d33833" },
      "azure-pipelines.yml": { icon: "☁️", color: "#007acc" },
      // Documentation
      "README.md": { icon: "📖", color: "#083fa1" },
      "readme.md": { icon: "📖", color: "#083fa1" },
      "README": { icon: "📖", color: "#083fa1" },
      "CHANGELOG.md": { icon: "📋", color: "#083fa1" },
      "changelog.md": { icon: "📋", color: "#083fa1" },
      "CONTRIBUTING.md": { icon: "🤝", color: "#083fa1" },
      "LICENSE": { icon: "⚖️", color: "#d4d4d8" },
      "LICENSE.md": { icon: "⚖️", color: "#d4d4d8" },
      "LICENSE.txt": { icon: "⚖️", color: "#d4d4d8" },
      // Build/Make
      "Makefile": { icon: "🔨", color: "#6d8086" },
      "makefile": { icon: "🔨", color: "#6d8086" },
      "CMakeLists.txt": { icon: "🔨", color: "#064f8c" },
      "Cargo.toml": { icon: "🦀", color: "#dea584" },
      "Cargo.lock": { icon: "🔒", color: "#dea584" },
      "go.mod": { icon: "🐹", color: "#00add8" },
      "go.sum": { icon: "🔒", color: "#00add8" },
      "Gemfile": { icon: "💎", color: "#701516" },
      "Gemfile.lock": { icon: "🔒", color: "#701516" },
      "requirements.txt": { icon: "📜", color: "#3572a5" },
      "setup.py": { icon: "🐍", color: "#3572a5" },
      "pyproject.toml": { icon: "🐍", color: "#3572a5" },
      "poetry.lock": { icon: "🔒", color: "#3572a5" },
      "Pipfile": { icon: "🐍", color: "#3572a5" },
      "Pipfile.lock": { icon: "🔒", color: "#3572a5" },
      "composer.json": { icon: "🐘", color: "#4f5d95" },
      "composer.lock": { icon: "🔒", color: "#4f5d95" },
      "build.gradle": { icon: "🐘", color: "#02303a" },
      "build.gradle.kts": { icon: "🐘", color: "#02303a" },
      "settings.gradle": { icon: "🐘", color: "#02303a" },
      "pom.xml": { icon: "📦", color: "#c22d40" },
      // Environment
      ".env": { icon: "🔐", color: "#faf743" },
      ".env.local": { icon: "🔐", color: "#faf743" },
      ".env.development": { icon: "🔐", color: "#faf743" },
      ".env.production": { icon: "🔐", color: "#faf743" },
      ".env.test": { icon: "🔐", color: "#faf743" },
      ".env.example": { icon: "🔐", color: "#faf743" },
      // Editor
      ".editorconfig": { icon: "⚙️", color: "#f0d5a8" },
      ".nvmrc": { icon: "💚", color: "#339933" },
      ".node-version": { icon: "💚", color: "#339933" },
      // Testing
      "jest.config.js": { icon: "🃏", color: "#c21325" },
      "jest.config.ts": { icon: "🃏", color: "#c21325" },
      "vitest.config.ts": { icon: "⚡", color: "#729b1b" },
      "vitest.config.js": { icon: "⚡", color: "#729b1b" },
      "cypress.config.js": { icon: "🌲", color: "#17202c" },
      "cypress.config.ts": { icon: "🌲", color: "#17202c" },
      "playwright.config.ts": { icon: "🎭", color: "#2ead33" },
      // Misc
      ".babelrc": { icon: "🔧", color: "#f9dc3e" },
      "babel.config.js": { icon: "🔧", color: "#f9dc3e" },
      ".browserslistrc": { icon: "🌐", color: "#ffd539" },
      ".npmrc": { icon: "📦", color: "#cb3837" },
      ".yarnrc": { icon: "📦", color: "#2c8ebb" },
      ".yarnrc.yml": { icon: "📦", color: "#2c8ebb" },
      "turbo.json": { icon: "🔥", color: "#ef4444" },
      "nx.json": { icon: "🔷", color: "#143055" },
      "vercel.json": { icon: "▲", color: "#ffffff" },
      "netlify.toml": { icon: "🌐", color: "#00c7b7" },
      "renovate.json": { icon: "🔄", color: "#1a1f6c" },
      "dependabot.yml": { icon: "🤖", color: "#025e8c" },
    },
    folderNames: {
      src: { icon: "📁", color: "#e8ba36" },
      source: { icon: "📁", color: "#e8ba36" },
      dist: { icon: "📁", color: "#6d8086" },
      build: { icon: "📁", color: "#6d8086" },
      out: { icon: "📁", color: "#6d8086" },
      output: { icon: "📁", color: "#6d8086" },
      lib: { icon: "📁", color: "#a074c4" },
      node_modules: { icon: "📁", color: "#8bc34a" },
      vendor: { icon: "📁", color: "#8bc34a" },
      packages: { icon: "📁", color: "#8bc34a" },
      components: { icon: "📁", color: "#42a5f5" },
      hooks: { icon: "📁", color: "#7c4dff" },
      utils: { icon: "📁", color: "#ffb300" },
      helpers: { icon: "📁", color: "#ffb300" },
      services: { icon: "📁", color: "#00bcd4" },
      api: { icon: "📁", color: "#00bcd4" },
      routes: { icon: "📁", color: "#4caf50" },
      pages: { icon: "📁", color: "#4caf50" },
      views: { icon: "📁", color: "#4caf50" },
      layouts: { icon: "📁", color: "#9c27b0" },
      styles: { icon: "📁", color: "#e91e63" },
      css: { icon: "📁", color: "#e91e63" },
      scss: { icon: "📁", color: "#c6538c" },
      assets: { icon: "📁", color: "#ff9800" },
      images: { icon: "📁", color: "#ff9800" },
      img: { icon: "📁", color: "#ff9800" },
      icons: { icon: "📁", color: "#ff9800" },
      fonts: { icon: "📁", color: "#ec5252" },
      public: { icon: "📁", color: "#4fc3f7" },
      static: { icon: "📁", color: "#4fc3f7" },
      config: { icon: "📁", color: "#78909c" },
      configs: { icon: "📁", color: "#78909c" },
      configuration: { icon: "📁", color: "#78909c" },
      test: { icon: "📁", color: "#c21325" },
      tests: { icon: "📁", color: "#c21325" },
      __tests__: { icon: "📁", color: "#c21325" },
      spec: { icon: "📁", color: "#c21325" },
      specs: { icon: "📁", color: "#c21325" },
      e2e: { icon: "📁", color: "#c21325" },
      coverage: { icon: "📁", color: "#c21325" },
      docs: { icon: "📁", color: "#42a5f5" },
      doc: { icon: "📁", color: "#42a5f5" },
      documentation: { icon: "📁", color: "#42a5f5" },
      types: { icon: "📁", color: "#3178c6" },
      typings: { icon: "📁", color: "#3178c6" },
      "@types": { icon: "📁", color: "#3178c6" },
      models: { icon: "📁", color: "#673ab7" },
      entities: { icon: "📁", color: "#673ab7" },
      schemas: { icon: "📁", color: "#673ab7" },
      middleware: { icon: "📁", color: "#795548" },
      middlewares: { icon: "📁", color: "#795548" },
      controllers: { icon: "📁", color: "#009688" },
      resolvers: { icon: "📁", color: "#e535ab" },
      scripts: { icon: "📁", color: "#89e051" },
      bin: { icon: "📁", color: "#89e051" },
      tools: { icon: "📁", color: "#607d8b" },
      i18n: { icon: "📁", color: "#2196f3" },
      locales: { icon: "📁", color: "#2196f3" },
      translations: { icon: "📁", color: "#2196f3" },
      lang: { icon: "📁", color: "#2196f3" },
      store: { icon: "📁", color: "#764abc" },
      stores: { icon: "📁", color: "#764abc" },
      state: { icon: "📁", color: "#764abc" },
      context: { icon: "📁", color: "#764abc" },
      contexts: { icon: "📁", color: "#764abc" },
      reducers: { icon: "📁", color: "#764abc" },
      actions: { icon: "📁", color: "#764abc" },
      selectors: { icon: "📁", color: "#764abc" },
      database: { icon: "📁", color: "#e38c00" },
      db: { icon: "📁", color: "#e38c00" },
      migrations: { icon: "📁", color: "#e38c00" },
      seeds: { icon: "📁", color: "#e38c00" },
      fixtures: { icon: "📁", color: "#c21325" },
      mocks: { icon: "📁", color: "#c21325" },
      __mocks__: { icon: "📁", color: "#c21325" },
      stubs: { icon: "📁", color: "#c21325" },
      ".git": { icon: "📁", color: "#f05032" },
      ".github": { icon: "📁", color: "#ffffff" },
      ".vscode": { icon: "📁", color: "#007acc" },
      ".idea": { icon: "📁", color: "#fe315d" },
      android: { icon: "📁", color: "#a4c639" },
      ios: { icon: "📁", color: "#a2aaad" },
      macos: { icon: "📁", color: "#a2aaad" },
      windows: { icon: "📁", color: "#00a4ef" },
      linux: { icon: "📁", color: "#fcc624" },
      docker: { icon: "📁", color: "#2496ed" },
      kubernetes: { icon: "📁", color: "#326ce5" },
      k8s: { icon: "📁", color: "#326ce5" },
      terraform: { icon: "📁", color: "#844fba" },
      ansible: { icon: "📁", color: "#ee0000" },
      helm: { icon: "📁", color: "#0f1689" },
      charts: { icon: "📁", color: "#0f1689" },
      logs: { icon: "📁", color: "#6d8086" },
      tmp: { icon: "📁", color: "#6d8086" },
      temp: { icon: "📁", color: "#6d8086" },
      cache: { icon: "📁", color: "#6d8086" },
      ".cache": { icon: "📁", color: "#6d8086" },
      backup: { icon: "📁", color: "#6d8086" },
      backups: { icon: "📁", color: "#6d8086" },
      archive: { icon: "📁", color: "#6d8086" },
      archives: { icon: "📁", color: "#6d8086" },
    },
    folderNamesOpen: {},
  },
};

const materialTheme: IconTheme = {
  id: "material",
  name: "Material",
  description: "Material Design inspired icons with vibrant colors",
  icons: {
    file: { icon: "📄", color: "#90a4ae" },
    folder: { icon: "📁", color: "#90a4ae" },
    folderOpen: { icon: "📂", color: "#90a4ae" },
    fileExtensions: {
      ts: { icon: "🔷", color: "#1976d2" },
      tsx: { icon: "⚛️", color: "#1976d2" },
      js: { icon: "🟨", color: "#ffca28" },
      jsx: { icon: "⚛️", color: "#ffca28" },
      mjs: { icon: "🟨", color: "#ffca28" },
      cjs: { icon: "🟨", color: "#ffca28" },
      html: { icon: "🌐", color: "#e44d26" },
      htm: { icon: "🌐", color: "#e44d26" },
      css: { icon: "🎨", color: "#42a5f5" },
      scss: { icon: "🎨", color: "#ec407a" },
      sass: { icon: "🎨", color: "#ec407a" },
      less: { icon: "🎨", color: "#1d365d" },
      vue: { icon: "💚", color: "#41b883" },
      svelte: { icon: "🔥", color: "#ff3e00" },
      json: { icon: "📋", color: "#fbc02d" },
      yaml: { icon: "⚙️", color: "#f44336" },
      yml: { icon: "⚙️", color: "#f44336" },
      toml: { icon: "⚙️", color: "#9c4121" },
      xml: { icon: "📄", color: "#ff6f00" },
      py: { icon: "🐍", color: "#4caf50" },
      rs: { icon: "🦀", color: "#ff7043" },
      go: { icon: "🐹", color: "#29b6f6" },
      java: { icon: "☕", color: "#f44336" },
      kt: { icon: "🟪", color: "#7c4dff" },
      swift: { icon: "🍎", color: "#ff5722" },
      c: { icon: "🔵", color: "#5c6bc0" },
      cpp: { icon: "🔵", color: "#5c6bc0" },
      cs: { icon: "🟢", color: "#66bb6a" },
      rb: { icon: "💎", color: "#e53935" },
      php: { icon: "🐘", color: "#7986cb" },
      sh: { icon: "💻", color: "#66bb6a" },
      bash: { icon: "💻", color: "#66bb6a" },
      md: { icon: "📝", color: "#42a5f5" },
      txt: { icon: "📄", color: "#90a4ae" },
      pdf: { icon: "📕", color: "#e53935" },
      svg: { icon: "🖼️", color: "#ffb300" },
      png: { icon: "🖼️", color: "#ab47bc" },
      jpg: { icon: "🖼️", color: "#ab47bc" },
      jpeg: { icon: "🖼️", color: "#ab47bc" },
      gif: { icon: "🖼️", color: "#ab47bc" },
      mp3: { icon: "🎵", color: "#e91e63" },
      mp4: { icon: "🎬", color: "#e53935" },
      zip: { icon: "📦", color: "#78909c" },
      sql: { icon: "🗃️", color: "#ffa000" },
      graphql: { icon: "💠", color: "#e535ab" },
      gql: { icon: "💠", color: "#e535ab" },
      lock: { icon: "🔒", color: "#78909c" },
      env: { icon: "🔐", color: "#ffc107" },
      log: { icon: "📜", color: "#78909c" },
    },
    fileNames: {
      "package.json": { icon: "📦", color: "#e53935" },
      "package-lock.json": { icon: "🔒", color: "#78909c" },
      "yarn.lock": { icon: "🔒", color: "#2196f3" },
      "tsconfig.json": { icon: "🔷", color: "#1976d2" },
      "jsconfig.json": { icon: "🟨", color: "#ffca28" },
      ".eslintrc": { icon: "📏", color: "#7c4dff" },
      ".eslintrc.js": { icon: "📏", color: "#7c4dff" },
      ".eslintrc.json": { icon: "📏", color: "#7c4dff" },
      ".prettierrc": { icon: "🎀", color: "#26a69a" },
      ".prettierrc.json": { icon: "🎀", color: "#26a69a" },
      "tailwind.config.js": { icon: "🌊", color: "#26c6da" },
      "tailwind.config.ts": { icon: "🌊", color: "#26c6da" },
      "vite.config.js": { icon: "⚡", color: "#7c4dff" },
      "vite.config.ts": { icon: "⚡", color: "#7c4dff" },
      "webpack.config.js": { icon: "📦", color: "#42a5f5" },
      ".gitignore": { icon: "🚫", color: "#ff5722" },
      "Dockerfile": { icon: "🐳", color: "#29b6f6" },
      "docker-compose.yml": { icon: "🐳", color: "#29b6f6" },
      "README.md": { icon: "📖", color: "#42a5f5" },
      "LICENSE": { icon: "⚖️", color: "#90a4ae" },
      "Makefile": { icon: "🔨", color: "#78909c" },
      "Cargo.toml": { icon: "🦀", color: "#ff7043" },
      "go.mod": { icon: "🐹", color: "#29b6f6" },
      ".env": { icon: "🔐", color: "#ffc107" },
      ".env.local": { icon: "🔐", color: "#ffc107" },
      "jest.config.js": { icon: "🃏", color: "#e53935" },
      "vitest.config.ts": { icon: "⚡", color: "#66bb6a" },
    },
    folderNames: {
      src: { icon: "📁", color: "#ffc107" },
      source: { icon: "📁", color: "#ffc107" },
      dist: { icon: "📁", color: "#78909c" },
      build: { icon: "📁", color: "#78909c" },
      node_modules: { icon: "📁", color: "#66bb6a" },
      components: { icon: "📁", color: "#42a5f5" },
      hooks: { icon: "📁", color: "#7c4dff" },
      utils: { icon: "📁", color: "#ffa000" },
      services: { icon: "📁", color: "#26c6da" },
      api: { icon: "📁", color: "#26c6da" },
      pages: { icon: "📁", color: "#66bb6a" },
      styles: { icon: "📁", color: "#ec407a" },
      assets: { icon: "📁", color: "#ff9800" },
      public: { icon: "📁", color: "#29b6f6" },
      config: { icon: "📁", color: "#78909c" },
      test: { icon: "📁", color: "#e53935" },
      tests: { icon: "📁", color: "#e53935" },
      docs: { icon: "📁", color: "#42a5f5" },
      types: { icon: "📁", color: "#1976d2" },
      models: { icon: "📁", color: "#9c27b0" },
      store: { icon: "📁", color: "#7c4dff" },
      context: { icon: "📁", color: "#7c4dff" },
      database: { icon: "📁", color: "#ffa000" },
      ".git": { icon: "📁", color: "#ff5722" },
      ".github": { icon: "📁", color: "#90a4ae" },
      ".vscode": { icon: "📁", color: "#29b6f6" },
      docker: { icon: "📁", color: "#29b6f6" },
    },
    folderNamesOpen: {},
  },
};

const minimalTheme: IconTheme = {
  id: "minimal",
  name: "Minimal",
  description: "Clean, minimalist icons using simple shapes",
  icons: {
    file: { icon: "◻️", color: "#9ca3af" },
    folder: { icon: "▷", color: "#6b7280" },
    folderOpen: { icon: "▽", color: "#6b7280" },
    fileExtensions: {
      ts: { icon: "◆", color: "#3178c6" },
      tsx: { icon: "◆", color: "#3178c6" },
      js: { icon: "◆", color: "#f7df1e" },
      jsx: { icon: "◆", color: "#f7df1e" },
      mjs: { icon: "◆", color: "#f7df1e" },
      cjs: { icon: "◆", color: "#f7df1e" },
      html: { icon: "◆", color: "#e34c26" },
      css: { icon: "◆", color: "#563d7c" },
      scss: { icon: "◆", color: "#c6538c" },
      json: { icon: "◆", color: "#cbcb41" },
      yaml: { icon: "◆", color: "#cb171e" },
      yml: { icon: "◆", color: "#cb171e" },
      toml: { icon: "◆", color: "#9c4121" },
      py: { icon: "◆", color: "#3572a5" },
      rs: { icon: "◆", color: "#dea584" },
      go: { icon: "◆", color: "#00add8" },
      java: { icon: "◆", color: "#b07219" },
      kt: { icon: "◆", color: "#a97bff" },
      swift: { icon: "◆", color: "#f05138" },
      c: { icon: "◆", color: "#555555" },
      cpp: { icon: "◆", color: "#f34b7d" },
      cs: { icon: "◆", color: "#178600" },
      rb: { icon: "◆", color: "#701516" },
      php: { icon: "◆", color: "#4f5d95" },
      sh: { icon: "◆", color: "#89e051" },
      bash: { icon: "◆", color: "#89e051" },
      md: { icon: "◇", color: "#083fa1" },
      txt: { icon: "◻️", color: "#9ca3af" },
      pdf: { icon: "◇", color: "#ff0000" },
      svg: { icon: "◇", color: "#ffb13b" },
      png: { icon: "◇", color: "#a074c4" },
      jpg: { icon: "◇", color: "#a074c4" },
      jpeg: { icon: "◇", color: "#a074c4" },
      gif: { icon: "◇", color: "#a074c4" },
      mp3: { icon: "◇", color: "#e91e63" },
      mp4: { icon: "◇", color: "#f44336" },
      zip: { icon: "◇", color: "#6d8086" },
      sql: { icon: "◆", color: "#e38c00" },
      graphql: { icon: "◆", color: "#e535ab" },
      lock: { icon: "◈", color: "#525252" },
      env: { icon: "◈", color: "#faf743" },
      log: { icon: "◻️", color: "#6d8086" },
    },
    fileNames: {
      "package.json": { icon: "◈", color: "#e8274b" },
      "package-lock.json": { icon: "◈", color: "#525252" },
      "yarn.lock": { icon: "◈", color: "#2c8ebb" },
      "tsconfig.json": { icon: "◈", color: "#3178c6" },
      "jsconfig.json": { icon: "◈", color: "#f7df1e" },
      ".eslintrc": { icon: "◈", color: "#4b32c3" },
      ".eslintrc.js": { icon: "◈", color: "#4b32c3" },
      ".eslintrc.json": { icon: "◈", color: "#4b32c3" },
      ".prettierrc": { icon: "◈", color: "#56b3b4" },
      ".prettierrc.json": { icon: "◈", color: "#56b3b4" },
      "tailwind.config.js": { icon: "◈", color: "#38bdf8" },
      "tailwind.config.ts": { icon: "◈", color: "#38bdf8" },
      "vite.config.js": { icon: "◈", color: "#646cff" },
      "vite.config.ts": { icon: "◈", color: "#646cff" },
      ".gitignore": { icon: "◈", color: "#f05032" },
      "Dockerfile": { icon: "◈", color: "#2496ed" },
      "docker-compose.yml": { icon: "◈", color: "#2496ed" },
      "README.md": { icon: "◇", color: "#083fa1" },
      "LICENSE": { icon: "◇", color: "#9ca3af" },
      "Makefile": { icon: "◈", color: "#6d8086" },
      "Cargo.toml": { icon: "◈", color: "#dea584" },
      "go.mod": { icon: "◈", color: "#00add8" },
      ".env": { icon: "◈", color: "#faf743" },
      ".env.local": { icon: "◈", color: "#faf743" },
    },
    folderNames: {
      src: { icon: "▷", color: "#e8ba36" },
      dist: { icon: "▷", color: "#6d8086" },
      build: { icon: "▷", color: "#6d8086" },
      node_modules: { icon: "▷", color: "#8bc34a" },
      components: { icon: "▷", color: "#42a5f5" },
      hooks: { icon: "▷", color: "#7c4dff" },
      utils: { icon: "▷", color: "#ffb300" },
      services: { icon: "▷", color: "#00bcd4" },
      api: { icon: "▷", color: "#00bcd4" },
      pages: { icon: "▷", color: "#4caf50" },
      styles: { icon: "▷", color: "#e91e63" },
      assets: { icon: "▷", color: "#ff9800" },
      public: { icon: "▷", color: "#4fc3f7" },
      config: { icon: "▷", color: "#78909c" },
      test: { icon: "▷", color: "#c21325" },
      tests: { icon: "▷", color: "#c21325" },
      docs: { icon: "▷", color: "#42a5f5" },
      types: { icon: "▷", color: "#3178c6" },
      context: { icon: "▷", color: "#764abc" },
      ".git": { icon: "▷", color: "#f05032" },
      ".github": { icon: "▷", color: "#9ca3af" },
      ".vscode": { icon: "▷", color: "#007acc" },
    },
    folderNamesOpen: {
      src: { icon: "▽", color: "#e8ba36" },
      dist: { icon: "▽", color: "#6d8086" },
      build: { icon: "▽", color: "#6d8086" },
      node_modules: { icon: "▽", color: "#8bc34a" },
      components: { icon: "▽", color: "#42a5f5" },
      hooks: { icon: "▽", color: "#7c4dff" },
      utils: { icon: "▽", color: "#ffb300" },
      services: { icon: "▽", color: "#00bcd4" },
      api: { icon: "▽", color: "#00bcd4" },
      pages: { icon: "▽", color: "#4caf50" },
      styles: { icon: "▽", color: "#e91e63" },
      assets: { icon: "▽", color: "#ff9800" },
      public: { icon: "▽", color: "#4fc3f7" },
      config: { icon: "▽", color: "#78909c" },
      test: { icon: "▽", color: "#c21325" },
      tests: { icon: "▽", color: "#c21325" },
      docs: { icon: "▽", color: "#42a5f5" },
      types: { icon: "▽", color: "#3178c6" },
      context: { icon: "▽", color: "#764abc" },
      ".git": { icon: "▽", color: "#f05032" },
      ".github": { icon: "▽", color: "#9ca3af" },
      ".vscode": { icon: "▽", color: "#007acc" },
    },
  },
};

// ============================================================================
// Built-in themes registry
// ============================================================================

const BUILTIN_THEMES: IconTheme[] = [setiTheme, materialTheme, minimalTheme];

// ============================================================================
// Storage Helpers
// ============================================================================

function loadThemeFromStorage(): string {
  if (typeof localStorage === "undefined") {
    return DEFAULT_THEME_ID;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.activeThemeId && typeof parsed.activeThemeId === "string") {
        const themeExists = BUILTIN_THEMES.some((t) => t.id === parsed.activeThemeId);
        if (themeExists) {
          return parsed.activeThemeId;
        }
      }
    }
  } catch (e) {
    console.error("[IconTheme] Failed to load theme from storage:", e);
  }

  return DEFAULT_THEME_ID;
}

function saveThemeToStorage(themeId: string): void {
  if (typeof localStorage === "undefined") {
    return;
  }

  try {
    const state: IconThemeState = { activeThemeId: themeId };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error("[IconTheme] Failed to save theme to storage:", e);
  }
}

// ============================================================================
// Context
// ============================================================================

const IconThemeContext = createContext<IconThemeContextValue>();

// ============================================================================
// Provider
// ============================================================================

export function IconThemeProvider(props: ParentProps) {
  const [activeThemeId, setActiveThemeId] = createSignal<string>(loadThemeFromStorage());

  const themes = () => BUILTIN_THEMES;

  const activeTheme = createMemo(() => {
    const id = activeThemeId();
    const theme = BUILTIN_THEMES.find((t) => t.id === id);
    return theme ?? setiTheme;
  });

  const setIconTheme = (id: string) => {
    const themeExists = BUILTIN_THEMES.some((t) => t.id === id);
    if (!themeExists) {
      console.warn(`[IconTheme] Theme "${id}" not found, using default`);
      return;
    }

    setActiveThemeId(id);
    saveThemeToStorage(id);
    window.dispatchEvent(
      new CustomEvent("icon-theme:changed", {
        detail: { themeId: id },
      })
    );
  };

  const getFileIcon = (filename: string): IconDefinition => {
    const theme = activeTheme();
    const lowerFilename = filename.toLowerCase();

    // Check exact filename match first (case-insensitive lookup, but use original for some matches)
    if (theme.icons.fileNames[filename]) {
      return theme.icons.fileNames[filename];
    }
    if (theme.icons.fileNames[lowerFilename]) {
      return theme.icons.fileNames[lowerFilename];
    }

    // Check by extension
    const lastDotIndex = filename.lastIndexOf(".");
    if (lastDotIndex > 0 && lastDotIndex < filename.length - 1) {
      const extension = filename.slice(lastDotIndex + 1).toLowerCase();
      if (theme.icons.fileExtensions[extension]) {
        return theme.icons.fileExtensions[extension];
      }
    }

    // Check for files starting with dot (like .gitignore, .env)
    if (filename.startsWith(".") && !filename.includes(".", 1)) {
      const configName = filename.toLowerCase();
      if (theme.icons.fileNames[configName]) {
        return theme.icons.fileNames[configName];
      }
    }

    // Default file icon
    return theme.icons.file;
  };

  const getFolderIcon = (name: string, open: boolean): IconDefinition => {
    const theme = activeTheme();
    const lowerName = name.toLowerCase();

    if (open) {
      // Check open folder names first
      if (theme.icons.folderNamesOpen[name]) {
        return theme.icons.folderNamesOpen[name];
      }
      if (theme.icons.folderNamesOpen[lowerName]) {
        return theme.icons.folderNamesOpen[lowerName];
      }
      // Fall back to closed folder definition with open icon
      if (theme.icons.folderNames[name]) {
        return { ...theme.icons.folderNames[name], icon: theme.icons.folderOpen.icon };
      }
      if (theme.icons.folderNames[lowerName]) {
        return { ...theme.icons.folderNames[lowerName], icon: theme.icons.folderOpen.icon };
      }
      return theme.icons.folderOpen;
    }

    // Closed folder
    if (theme.icons.folderNames[name]) {
      return theme.icons.folderNames[name];
    }
    if (theme.icons.folderNames[lowerName]) {
      return theme.icons.folderNames[lowerName];
    }
    return theme.icons.folder;
  };

  const value: IconThemeContextValue = {
    activeTheme,
    themes,
    setIconTheme,
    getFileIcon,
    getFolderIcon,
  };

  return <IconThemeContext.Provider value={value}>{props.children}</IconThemeContext.Provider>;
}

// ============================================================================
// Hook
// ============================================================================

export function useIconTheme() {
  const ctx = useContext(IconThemeContext);
  if (!ctx) {
    throw new Error("useIconTheme must be used within IconThemeProvider");
  }
  return ctx;
}

// ============================================================================
// Exports
// ============================================================================

export { BUILTIN_THEMES };
