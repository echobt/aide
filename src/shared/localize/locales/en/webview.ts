export default {
  globalSearch: {
    history: 'History',
    chatHistory: 'Chat History',
    settings: 'Settings',
    navigate: 'Navigate',
    select: 'Select',
    switchTab: 'Switch tab',
    close: 'Close',
    all: 'All',
    typeToSearch: 'Type to search...',
    noResults: 'No results found.'
  },
  theme: {
    followVSCode: 'Follow VS Code',
    darkSlate: 'Dark Slate',
    darkZinc: 'Dark Zinc',
    darkRose: 'Dark Rose',
    darkEmerald: 'Dark Emerald',
    darkViolet: 'Dark Violet',
    darkCrimson: 'Dark Crimson',
    lightGray: 'Light Gray',
    lightSky: 'Light Sky',
    lightTeal: 'Light Teal',
    lightAmber: 'Light Amber',
    lightRose: 'Light Rose',
    midnight: 'Midnight',
    sunset: 'Sunset',
    forest: 'Forest',
    ocean: 'Ocean',
    candy: 'Candy',
    selectTheme: 'Select a theme'
  },
  settings: {
    failedToUpdate: 'Failed to update setting',
    updateSuccess: 'Setting updated successfully',
    searchSettings: 'Search settings...',
    title: 'Settings',
    hideSecret: 'Hide secret',
    showSecret: 'Show secret'
  },
  actions: {
    failedToStartWebPreview: 'Failed to start web preview action',
    failedToStartEditFile: 'Failed to start edit file action',
    editFileByComposer: 'Edit the file by composer',
    collapseCode: 'Collapse code',
    expandCode: 'Expand code',
    actionsCount: 'Actions ({{count}})',
    rejectAll: 'Reject all',
    acceptAll: 'Accept all'
  },
  webPreview: {
    presetNameRequired: 'Preset name is required',
    failedToStartPreview: 'Failed to start preview VM files',
    failedToStopPreview: 'Failed to stop preview VM',
    noProjectFound: 'No project found'
  },
  code: {
    failedToApply: 'Failed to apply code',
    applicationCancelled: 'Code application cancelled'
  },
  chat: {
    aiRequestFailed: 'AI request failed',
    failedToSaveSession: 'Failed to save session',
    failedToRefreshSessions: 'Failed to refresh chat sessions',
    failedToCreateAndSwitchChat: 'Failed to create and switch to new chat',
    failedToDeleteChat: 'Failed to delete chat {{id}}',
    failedToDeleteChats: 'Failed to delete chats {{ids}}',
    contextNotFound: 'Chat context not found',
    failedToRefreshSession: 'Failed to refresh session {{id}}',
    typeMessageHere: 'Type your message here...',
    webExample: '@web which the diff between the react18 and react19?',
    fileReviewExample: '@main.ts please review the code',
    sendShortcut: 'You can use ⌘↩ to send message',
    send: 'Send'
  },
  chatType: {
    title: 'Chat Type',
    selectPlaceholder: 'Select a chat type',
    chatDescription: 'Standard chat with AI assistant',
    composerDescription: 'AI-assisted code editing and generation',
    v1Description: 'Preview and interact with web applications',
    noPromptDescription: 'Chat without system prompt'
  },
  aiModel: {
    title: 'AI Model',
    configureFirst: 'You need to configure an AI provider first',
    configureModel: 'Configure AI Model',
    providerAddedSuccess: 'AI provider added successfully',
    failedToAddProvider: 'Failed to add AI provider',
    chooseDefaultModel: 'Choose a default model for this chat type',
    chooseModelFor: 'Choose a model for {{contextType}} chat'
  },
  preset: {
    title: 'Web Preset',
    selectPlaceholder: 'Select a preset'
  },
  centerHints: {
    configure: 'Configure Your Chat'
  },
  common: {
    edit: 'Edit',
    delete: 'Delete',
    cancel: 'Cancel',
    update: 'Update',
    add: 'Add',
    global: 'Global',
    workspace: 'Workspace',
    copy: 'Copy',
    open: 'Open',
    back: 'Back',
    next: 'Next',
    connected: 'Connected',
    disconnected: 'Disconnected',
    error: 'Error',
    completed: 'Completed',
    processing: 'Processing',
    pending: 'Pending'
  },
  promptSnippet: {
    title: 'Prompt Snippet',
    snippet: 'Snippet',
    searchPlaceholder: 'Search prompt snippets...',
    untitled: 'Untitled',
    removedSuccessfully: 'Prompt snippet removed successfully',
    failedToRemove: 'Failed to remove prompt snippet',
    addedSuccessfully: 'New prompt snippet added successfully',
    failedToAdd: 'Failed to add prompt snippet',
    updatedSuccessfully: 'Prompt snippet updated successfully',
    failedToUpdate: 'Failed to update prompt snippet',
    editTitle: 'Edit Prompt Snippet',
    addNewTitle: 'Add New Prompt Snippet',
    enterTitle: 'Enter snippet title',
    selectSaveType: 'Select save type',
    deleteTitle: 'Delete Prompt Snippet',
    deleteConfirmation: 'Are you sure you want to delete "{{title}}"?',
    messagesInConversation: '{{count}} messages in conversation'
  },
  messages: {
    waitForCompletion: 'Please stop or wait for the current message to finish.',
    createNewSession: 'Create New Session From Here',
    freeze: 'Freeze',
    unfreeze: 'Unfreeze',
    freezeCurrentMessage: 'Freeze Current Message',
    freezeCurrentAndPrevious: 'Freeze Current & Previous Messages',
    unfreezeCurrentMessage: 'Unfreeze Current Message',
    unfreezeCurrentAndPrevious: 'Unfreeze Current & Previous Messages',
    deleteItems: 'Delete Items',
    deleteConfirmation: 'Are you sure?',
    restoreCheckpoint: 'Restore Checkpoint',
    restoreCheckpointConfirmation: 'Do you want to restore checkpoint?',
    restore: 'Restore',
    regenerate: 'Regenerate',
    regenerateWithCheckpointConfirmation:
      'Do you want to restore checkpoint before regenerate?',
    restoreBeforeSendConfirmation:
      'Do you want to restore the workspace checkpoint before sending the message?',
    sendWithoutRestore: 'No, Send Without Restore',
    restoreAndSend: 'Yes, Restore and Send'
  },
  codeBlock: {
    codeCopied: 'Code copied to clipboard',
    openFileInEditor: 'Open file in editor',
    copyCode: 'Copy code',
    stopping: 'Stopping...',
    reapply: 'Reapply',
    apply: 'Apply'
  },
  mermaid: {
    codeCopied: 'Mermaid code copied to clipboard',
    copyCode: 'Copy mermaid code'
  },
  timeline: {
    generating: 'Generating',
    open: 'Open'
  },
  v1project: {
    waitForConversationEnd: 'Please wait for the conversation end.',
    noFilePath: 'No file path found.',
    moved: 'Moved',
    deleted: 'Deleted',
    modified: 'Modified',
    generated: 'Generated',
    unknownProject: 'Unknown Project'
  },
  thinks: {
    thought: 'Thought',
    thinking: 'Thinking...'
  },
  fileSelector: {
    files: 'Files',
    addFiles: 'Add Files',
    clearFiles: 'Clear Files',
    navigate: 'Navigate',
    select: 'Select',
    expand: 'Expand',
    switchTab: 'Switch tab',
    close: 'Close',
    list: 'List',
    tree: 'Tree',
    searchFiles: 'Search files...',
    noFilesFound: 'No files found.'
  },
  mentionSelector: {
    noResults: 'No results found.'
  },
  contextSelector: {
    addMention: 'Add mention',
    addImage: 'Add image',
    exitEditMode: 'Exit edit mode'
  },
  chatSidebar: {
    delete: 'Delete',
    chat: 'chat',
    searchChats: 'Search chats...'
  },
  chatUI: {
    search: 'Search',
    newChat: 'New Chat',
    settings: 'Settings',
    cancel: 'Cancel',
    cancelTooltip: 'Cancel the message generation or pressing ⌘⌫'
  },
  jsonEditor: {
    basic: 'Basic',
    resetToDefault: 'Reset to Default',
    clearEditor: 'Clear Editor',
    format: 'Format',
    minifyJSON: 'Minify JSON',
    prettifyJSON: 'Prettify JSON',
    fixJSON: 'Fix JSON',
    file: 'File',
    downloadJSON: 'Download JSON',
    uploadJSON: 'Upload JSON',
    error: 'Error',
    failedToMinify: 'Failed to minify JSON',
    failedToPrettify: 'Failed to prettify JSON',
    failedToFix: 'Failed to fix JSON',
    unknownError: 'Unknown error',
    invalidJSON: 'Invalid JSON',
    failedToFormat: 'Failed to format JSON'
  },
  modelSelector: {
    default: 'Default',
    extendsDefault: 'extends default model',
    selectModel: 'Select Model',
    setting: 'Setting',
    noModelsAvailable: 'No AI models available',
    addNewProvider: 'Add new provider',
    manageProviders: 'Manage providers'
  },
  cardList: {
    noItemsYet: 'No items yet',
    createItem: 'Create Item',
    createNewItem: 'Create new item',
    new: 'New',
    deleteItems: 'Delete Items',
    deleteConfirmation:
      'Are you sure you want to delete {{count}} selected item(s)?',
    delete: 'Delete',
    deleteSelectedItems: 'Delete selected items',
    selectedItemsCount: 'You have selected {{count}} items'
  },
  sidebarList: {
    noItems: 'No {{itemName}}s',
    createNewItem: 'Create new {{itemName}}',
    new: 'New',
    deleteItems: 'Delete Items',
    deleteConfirmation:
      'Are you sure you want to delete {{count}} selected item(s)?',
    delete: 'Delete',
    deleteSelectedItems: 'Delete {{count}} selected {{itemName}}(s)',
    selectedItemsCount: 'You have selected {{count}} {{itemName}}(s)'
  },
  alertAction: {
    areYouSure: 'Are you sure?',
    cannotBeUndone: 'This action cannot be undone.',
    cancel: 'Cancel',
    continue: 'Continue'
  },
  collapsibleBlock: {
    loading: 'loading',
    waiting: 'waiting',
    success: 'success',
    error: 'error',
    collapseCode: 'Collapse code',
    expandCode: 'Expand code'
  },
  about: {
    contributors: 'Contributors',
    contributorsDescription:
      'Thanks to all our contributors who make this project possible',
    creatorRole: 'Creator',
    creatorDescription: 'Creator and maintainer of Aide',
    installs: 'Installs',
    stars: 'Stars',
    forks: 'Forks',
    subscribers: 'Subscribers',
    visitWebsite: 'Visit Website',
    starOnGitHub: 'Star on GitHub',
    contributions: 'contributions',
    createdWith: 'Created with',
    by: 'by',
    reportIssue: 'Report Issue'
  },
  language: {
    followVSCode: 'Follow VSCode',
    selectLanguage: 'Select Language'
  },
  aiProvider: {
    modelManagement: 'Model Management',
    manualModels: 'Manual Models',
    remoteModels: 'Remote Models',
    addModels: 'Add Models',
    enterModelNamesOneLine: 'Enter model names, one per line',
    modelNamesPlaceholder:
      'Enter model names (one per line), example:\ngpt-4o\nclaude-3-5-sonnet\nclaude-3-7-sonnet',
    testAllFeatures: 'Test All Features',
    addToManual: 'Add to manual',
    removeFromManual: 'Remove from manual',
    failedToUpdateRemoteModels: 'Failed to update provider remote models',
    failedToTestModelFeatures: 'Failed to test model features',
    features: {
      chat: 'Chat',
      imageInput: 'Image Input',
      imageOutput: 'Image Output',
      audioInput: 'Audio Input',
      audioOutput: 'Audio Output',
      toolsCall: 'Tools Call'
    },
    // Provider form related
    providerType: 'Provider Type',
    providerName: 'Provider Name',
    selectProviderType: 'Select provider type',
    enterProviderName: 'Enter provider name',
    providerSettings: 'Provider Settings',
    modelSettings: 'Model Settings',
    providerSetupSteps: 'Provider Setup Steps',
    saving: 'Saving...',
    complete: 'Complete',
    providerConfiguration: 'Provider Configuration',
    saveChanges: 'Save Changes',
    // Provider card related
    showValue: 'Show value',
    hideValue: 'Hide value',
    deleteProvider: 'Delete Provider',
    deleteProviderConfirmation:
      'Are you sure you want to delete provider "{{name}}"?',
    viewUsage: 'View Usage',
    // Provider form dialog related
    editModel: 'Edit Model',
    createModel: 'Create Model',
    failedToSaveProvider: 'Failed to save provider',
    // Provider management related
    providerAddedSuccess: 'Provider added successfully',
    providerUpdatedSuccess: 'Provider updated successfully',
    providersRemovedSuccess: 'Provider(s) removed successfully',
    failedToAddProvider: 'Failed to add provider',
    failedToUpdateProvider: 'Failed to update provider',
    failedToRemoveProviders: 'Failed to remove provider(s)',
    allModelSettings: 'ALL Model Settings',
    // Provider usage dialog related
    usageInformationUnavailable: 'Usage Information Unavailable',
    usageTrackingIssue:
      'This provider may not support usage tracking or there might be an issue with the connection.',
    usageOverview: 'Usage Overview',
    currentBillingPeriod: 'Current billing period',
    usedAmount: 'Used Amount',
    remaining: 'Remaining',
    totalTokensUsed: 'Total Tokens Used',
    subscriptionPeriod: 'Subscription Period',
    validUntil: 'Valid until',
    usageInformation: 'Usage Information',
    // Validation messages
    validation: {
      isRequired: 'is required',
      providerNameRequired: 'Provider name is required',
      providerTypeRequired: 'Provider type is required',
      typeAndNameRequired: 'Provider type and name are required',
      missingRequiredFields: 'Missing required fields: {{fields}}',
      providerNameExists: 'Provider name already exists',
      networkError: 'Network error, please try again'
    }
  },
  // Git Project Management
  gitProject: {
    searchPlaceholder: 'Search git projects...',
    addedSuccess: 'New git project added successfully',
    updatedSuccess: 'Git project updated successfully',
    removedSuccess: 'Git project removed successfully',
    refreshedSuccess: 'Git project refreshed successfully',
    failedToAdd: 'Failed to add git project',
    failedToUpdate: 'Failed to update git project',
    failedToRemove: 'Failed to remove git project',
    failedToRefresh: 'Failed to refresh git project',
    addProject: 'Add Git Project',
    editProject: 'Edit Git Project',
    updateProject: 'Update Git Project',
    deleteProject: 'Delete Git Project',
    deleteProjectConfirmation: 'Are you sure you want to delete "{{name}}"?',
    addProjectDescription:
      'Add a new git project by entering the details below',
    editProjectDescription: 'Edit your git project details below',
    repositoryUrl: 'Repository URL',
    enterRepositoryUrl: 'Enter repository URL',
    name: 'Name',
    enterProjectName: 'Enter project name',
    type: 'Type',
    selectRepositoryType: 'Select repository type',
    description: 'Description',
    enterProjectDescription: 'Enter project description',
    refreshRepository: 'Refresh Repository',
    validation: {
      nameRequired: 'Project name is required',
      repoUrlRequired: 'Repository URL is required',
      invalidUrl: 'Invalid URL'
    }
  },
  // Doc Site Management
  docSite: {
    searchPlaceholder: 'Search doc sites...',
    addedSuccess: 'New doc site added successfully',
    updatedSuccess: 'Doc site updated successfully',
    removedSuccess: 'Doc site removed successfully',
    failedToAdd: 'Failed to add doc site',
    failedToUpdate: 'Failed to update doc site',
    failedToRemove: 'Failed to remove doc site',
    addSite: 'Add Site',
    addNewSite: 'Add New Doc Site',
    editSite: 'Edit Doc Site',
    updateSite: 'Update Site',
    deleteSite: 'Delete Documentation Site',
    deleteSiteConfirmation:
      'Are you sure you want to delete "{{name}}"? This will remove all crawled and indexed data.',
    enterSiteName: 'Enter doc site name',
    enterSiteUrl: 'Enter doc site URL',
    crawl: 'Crawl',
    index: 'Index',
    actionPrefix: 'Re{{action}}',
    stop: 'Stop',
    lastUpdate: 'Last update'
  },
  // MCP Management
  mcp: {
    searchPlaceholder: 'Search Mcp endpoints...',
    addedSuccess: 'New Mcp endpoint added successfully',
    updatedSuccess: 'Mcp endpoint updated successfully',
    removedSuccess: 'Mcp endpoint removed successfully',
    reconnectedSuccess: 'Reconnected successfully',
    failedToAdd: 'Failed to add Mcp endpoint',
    failedToUpdate: 'Failed to update Mcp endpoint',
    failedToRemove: 'Failed to remove Mcp endpoint',
    failedToReconnect: 'Failed to reconnect',
    failedToUpdateConfig: 'Failed to update endpoint',
    failedToSave: 'Failed to save MCP endpoint',
    reconnect: 'Reconnect',
    enabled: 'Enabled',
    disabled: 'Disabled',
    deleteEndpoint: 'Delete MCP Endpoint',
    deleteConfirmation: 'Are you sure you want to delete "{{name}}"?',
    editConfiguration: 'Edit MCP Configuration',
    addConfiguration: 'Add MCP Configuration',
    updateConfiguration: 'Update Configuration',
    name: 'Name',
    enterName: 'Enter endpoint name',
    transportType: 'Transport Type',
    selectTransportType: 'Select transport type',
    enableNow: 'Enable Now',
    command: 'Command',
    enterCommand: 'Enter command',
    url: 'URL',
    enterUrl: 'Enter URL'
  },
  // Project Management
  project: {
    searchPlaceholder: 'Search projects...',
    addedSuccess: 'New project added successfully',
    updatedSuccess: 'Project updated successfully',
    removedSuccess: 'Project removed successfully',
    failedToAdd: 'Failed to add project',
    failedToUpdate: 'Failed to update project',
    failedToRemove: 'Failed to remove project',
    deleteProject: 'Delete Project',
    deleteConfirmation: 'Are you sure you want to delete "{{name}}"?',
    editProject: 'Edit Project',
    addProject: 'Add New Project',
    updateProject: 'Update Project',
    folderPath: 'Folder Path',
    enterFolderPath: 'Enter project folder path',
    name: 'Name',
    enterName: 'Enter project name',
    description: 'Description',
    enterDescription: 'Enter project description',
    validation: {
      nameRequired: 'Project name is required',
      pathRequired: 'Project path is required'
    }
  },
  // Codebase Indexing
  codebase: {
    indexingInProgress: 'Indexing in progress...',
    neverIndexed: 'Never indexed',
    lastIndexed: 'Last indexed: {{date}}',
    lastIndexingFailed: 'Last indexing failed: {{date}}',
    indexing: 'Indexing...',
    reindex: 'Reindex',
    startIndexing: 'Start Indexing',
    stop: 'Stop',
    percentCompleted: '{{percent}}% completed'
  },
  // WebVM related translations
  webvm: {
    tabs: {
      preview: 'Preview',
      code: 'Code',
      console: 'Console'
    },
    restartServer: 'Restart Server',
    preview: {
      back: 'Back',
      forward: 'Forward',
      refresh: 'Refresh',
      enterUrl: 'Enter URL',
      switchToMobile: 'Switch to mobile view',
      switchToTablet: 'Switch to tablet view',
      switchToDesktop: 'Switch to desktop view',
      openInBrowser: 'Open in browser',
      fullscreen: 'Fullscreen',
      exitFullscreen: 'Exit fullscreen'
    },
    console: {
      title: 'Console',
      enterJavaScript: 'Enter JavaScript code...'
    },
    code: {
      newFile: 'New File',
      newFolder: 'New Folder',
      rename: 'Rename',
      renameFile: 'Rename File',
      deleteFileConfirmation: 'This will delete the file "{{name}}".',
      deleteFolderConfirmation:
        'This will delete the folder "{{name}}" and all its contents.'
    }
  }
}
