import React, { useEffect, useRef, useState } from 'react'
import { AppErrorBoundary } from '@webview/components/error-boundary'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandHook,
  CommandInput,
  CommandItem,
  CommandList
} from '@webview/components/ui/command'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '@webview/components/ui/tabs'
import { useControllableState } from '@webview/hooks/use-controllable-state'
import { useKeyboardNavigation } from '@webview/hooks/use-keyboard-navigation'
import { cn } from '@webview/utils/common'
import { useTranslation } from 'react-i18next'

import {
  KeyboardShortcutsInfo,
  type ShortcutInfo
} from '../keyboard-shortcuts-info'
import {
  SearchResultItem,
  type SearchResultItemProps
} from './search-result-item'

export interface SearchCategory {
  id: string
  name: string
  items: SearchItem[]
}

export interface SearchItem extends Partial<SearchResultItemProps> {
  id: string
  keywords?: string[]
  onSelect: () => void
  renderPreview?: () => React.ReactNode
  renderItem?: () => React.ReactNode
}

interface GlobalSearchProps {
  categories: SearchCategory[]
  useInnerFilter?: boolean
  onOpenChange?: (open: boolean) => void
  open?: boolean
  activeCategory?: string
  onActiveCategoryChange?: (category: string) => void
  searchQuery?: string
  onSearchQueryChange?: (query: string) => void
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({
  categories,
  useInnerFilter = true,
  onOpenChange,
  open: openProp,
  activeCategory: activeCategoryProp,
  onActiveCategoryChange,
  searchQuery: searchQueryProp,
  onSearchQueryChange
}) => {
  const { t } = useTranslation()

  const keyboardShortcuts: ShortcutInfo[] = [
    {
      key: ['↑', '↓'],
      description: t('webview.globalSearch.navigate'),
      weight: 10
    },
    { key: '↵', description: t('webview.globalSearch.select'), weight: 9 },
    { key: '⇥', description: t('webview.globalSearch.switchTab'), weight: 8 },
    { key: 'esc', description: t('webview.globalSearch.close'), weight: 7 }
  ]

  const [isOpen, setIsOpen] = useControllableState({
    prop: openProp,
    defaultProp: false,
    onChange: onOpenChange
  })

  const [activeCategory, setActiveCategory] = useControllableState({
    prop: activeCategoryProp,
    defaultProp: 'all',
    onChange: onActiveCategoryChange
  })

  const [searchQuery, setSearchQuery] = useControllableState({
    prop: searchQueryProp,
    defaultProp: '',
    onChange: onSearchQueryChange
  })

  const [filteredItems, setFilteredItems] = useState<SearchItem[]>([])

  const [focusedItem, setFocusedItem] = useState<SearchItem | null>(null)

  useEffect(() => {
    if (!isOpen) return
    const items =
      activeCategory === 'all'
        ? categories.flatMap(c => c.items)
        : categories.find(c => c.id === activeCategory)?.items || []

    if (!useInnerFilter) {
      setFilteredItems(items)
    } else {
      setFilteredItems(
        items.filter(item => {
          const searchLower = searchQuery?.toLowerCase() || ''
          return (
            item.title?.toLowerCase().includes(searchLower) ||
            item.keywords?.some(keyword =>
              keyword.toLowerCase().includes(searchLower)
            )
          )
        })
      )
    }
  }, [activeCategory, searchQuery, categories, useInnerFilter, isOpen])

  useEffect(() => {
    if (!filteredItems.length) {
      setFocusedItem(null)
    }
  }, [filteredItems])

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (!open) {
      setSearchQuery('')
    }
  }

  const finalCategories = [
    {
      id: 'all',
      name: t('webview.globalSearch.all'),
      items: categories.flatMap(c => c.items)
    },
    ...categories
  ]

  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  const { handleKeyDown, setFocusedIndex } = useKeyboardNavigation({
    itemCount: finalCategories.length,
    itemRefs: tabRefs,
    mode: 'tab',
    defaultStartIndex: finalCategories.findIndex(t => t.id === activeCategory),
    onTab: (_, index) => setActiveCategory(finalCategories[index]?.id ?? 'all')
  })

  const showPreview = isOpen && focusedItem?.renderPreview

  return (
    <CommandDialog
      open={isOpen}
      onOpenChange={handleOpenChange}
      dialogContentClassName="border-none bg-transparent rounded-[0] sm:rounded-[0]"
      commandClassName="bg-transparent rounded-[0]"
    >
      <div className="flex flex-col" onKeyDown={handleKeyDown}>
        <Command
          loop
          shouldFilter={useInnerFilter}
          className="border rounded-2xl h-auto shrink-0 "
        >
          <CommandInput
            placeholder={t('webview.globalSearch.typeToSearch')}
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandHook
            onFocus={val => {
              const target = filteredItems.find(item => item.id === val)
              target && setFocusedItem(target)
            }}
          />
          <Tabs
            className="h-[300px] flex flex-col overflow-hidden"
            value={activeCategory}
            onValueChange={val => {
              setActiveCategory(val)
              setFocusedIndex(finalCategories.findIndex(t => t.id === val))
            }}
          >
            <TabsList mode="underlined" className="shrink-0">
              {finalCategories.map(category => (
                <TabsTrigger
                  mode="underlined"
                  key={category.id}
                  value={category.id}
                >
                  {category.name}
                </TabsTrigger>
              ))}
            </TabsList>

            {finalCategories.map(category => (
              <TabsContent
                className="flex-1 overflow-hidden"
                key={category.id}
                value={category.id}
              >
                <SearchResultList
                  filteredItems={filteredItems}
                  onSelect={() => setIsOpen(false)}
                />
              </TabsContent>
            ))}
          </Tabs>
          <KeyboardShortcutsInfo shortcuts={keyboardShortcuts} />
        </Command>

        <div
          className="w-full h-[250px] pt-4"
          onClick={() => {
            if (!showPreview) {
              setIsOpen(false)
            }
          }}
        >
          <AppErrorBoundary>
            {showPreview ? (
              <div className="border border-primary rounded-2xl p-2 bg-popover text-popover-foreground w-full max-h-full overflow-auto">
                {focusedItem?.renderPreview?.()}
              </div>
            ) : null}
          </AppErrorBoundary>
          <div
            className="w-full h-full"
            onClick={() => {
              setIsOpen(false)
            }}
          />
        </div>
      </div>
    </CommandDialog>
  )
}

const SearchResultList: React.FC<{
  filteredItems: SearchItem[]
  onSelect?: () => void
}> = ({ filteredItems, onSelect }) => {
  const { t } = useTranslation()

  return (
    <CommandList>
      {!filteredItems?.length ? (
        <CommandEmpty>{t('webview.globalSearch.noResults')}</CommandEmpty>
      ) : (
        filteredItems.map(item => (
          <CommandItem
            key={item.id}
            className={cn(
              'm-2 !px-2 !py-2 rounded-md cursor-pointer data-[selected=true]:bg-secondary data-[selected=true]:text-foreground'
            )}
            defaultValue={item.id}
            value={item.id}
            keywords={item.keywords}
            onSelect={() => {
              item.onSelect()
              onSelect?.()
            }}
          >
            {item.renderItem ? (
              item.renderItem()
            ) : (
              <SearchResultItem
                icon={item.icon}
                breadcrumbs={item.breadcrumbs || []}
                title={item.title || ''}
                description={item.description}
                className={item.className}
              />
            )}
          </CommandItem>
        ))
      )}
    </CommandList>
  )
}
