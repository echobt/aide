import React, { useRef } from 'react'
import { FileIcon } from '@webview/components/file-icon'
import {
  KeyboardShortcutsInfo,
  type ShortcutInfo
} from '@webview/components/keyboard-shortcuts-info'
import { TruncateStart } from '@webview/components/truncate-start'
import {
  Command,
  CommandEmpty,
  CommandItem,
  CommandList
} from '@webview/components/ui/command'
import { FileInfo } from '@webview/types/chat'
import { cn } from '@webview/utils/common'
import { getFileNameFromPath } from '@webview/utils/path'
import { useTranslation } from 'react-i18next'
import { useEvent } from 'react-use'

interface FileListViewProps {
  filteredFiles: FileInfo[]
  selectedFiles: FileInfo[]
  onSelect: (file: FileInfo) => void
}

export const FileListView: React.FC<FileListViewProps> = ({
  filteredFiles,
  selectedFiles,
  onSelect
}) => {
  const { t } = useTranslation()
  const commandRef = useRef<HTMLDivElement>(null)

  const keyboardShortcuts: ShortcutInfo[] = [
    {
      key: ['↑', '↓'],
      description: t('webview.fileSelector.navigate'),
      weight: 10
    },
    { key: '↵', description: t('webview.fileSelector.select'), weight: 9 }
  ]

  useEvent('keydown', e => {
    if (commandRef.current && !commandRef.current.contains(e.target as Node)) {
      const event = new KeyboardEvent('keydown', {
        key: e.key,
        code: e.code,
        which: e.which,
        keyCode: e.keyCode,
        bubbles: true,
        cancelable: true
      })
      commandRef.current.dispatchEvent(event)
    }
  })

  const renderItem = (file: FileInfo) => {
    const isSelected = selectedFiles.some(f => f.schemeUri === file.schemeUri)

    const fileName = getFileNameFromPath(file.schemeUri)

    return (
      <CommandItem
        key={file.schemeUri}
        defaultValue={file.schemeUri}
        value={file.schemeUri}
        onSelect={() => {
          onSelect(file)
        }}
        className={cn(
          'cursor-pointer text-sm mx-2 px-1 py-1 flex items-center data-[selected=true]:bg-secondary data-[selected=true]:text-foreground'
        )}
        style={{
          height: '28px',
          containIntrinsicSize: '28px'
        }}
      >
        <div className="flex shrink-0 items-center mr-2">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={e => e.stopPropagation()}
            className="mx-1 custom-checkbox"
          />

          <FileIcon className="size-4 mr-1" filePath={file.schemeUri} />
          <span>{fileName}</span>
        </div>
        <TruncateStart>{file.schemeUri}</TruncateStart>
      </CommandItem>
    )
  }

  return (
    <div className="flex flex-col h-full pt-1">
      <Command loop ref={commandRef} shouldFilter={false}>
        <CommandList
          className="py-2"
          style={{
            contentVisibility: 'auto'
          }}
        >
          {!filteredFiles.length ? (
            <CommandEmpty
              style={{
                containIntrinsicSize: '28px',
                height: '28px'
              }}
            >
              {t('webview.fileSelector.noFilesFound')}
            </CommandEmpty>
          ) : (
            filteredFiles.map(file => renderItem(file))
          )}
        </CommandList>
      </Command>
      <KeyboardShortcutsInfo shortcuts={keyboardShortcuts} />
    </div>
  )
}
