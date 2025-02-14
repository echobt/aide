/* eslint-disable react/no-unstable-nested-components */
import React, { useState } from 'react'
import { TextAlignJustifyIcon } from '@radix-ui/react-icons'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { Button, type ButtonProps } from '@webview/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from '@webview/components/ui/sheet'
import { useBreakpoint } from '@webview/hooks/use-breakpoint'
import { cn } from '@webview/utils/common'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronsLeft } from 'lucide-react'

import { SidebarHeader } from '../../sidebar-header'

interface SidebarLayoutProps {
  title: string
  leftSidebar: React.ReactNode
  rightSidebar?: React.ReactNode
  children: React.ReactNode
  className?: string
  headerLeft?: React.ReactNode
  headerRight?: React.ReactNode
  showBackButton?: boolean
}

export const SidebarLayout: React.FC<SidebarLayoutProps> = ({
  title,
  leftSidebar,
  rightSidebar,
  children,
  className,
  headerLeft,
  headerRight,
  showBackButton
}) => {
  const [openSidebar, setOpenSidebar] = useState(false)
  const [openRightSidebar, setOpenRightSidebar] = useState(false)
  const isMd = useBreakpoint('md')

  const renderLeftSidebar = () => (
    <div className="flex flex-col h-full">
      {Boolean(title) && (
        <h2 className="mb-4 text-2xl font-semibold tracking-tight">{title}</h2>
      )}
      {leftSidebar}
    </div>
  )

  const renderRightSidebar = () => (
    <div className="flex flex-col h-full">{rightSidebar}</div>
  )

  return (
    <div className={cn('flex h-full w-full flex-col md:flex-row', className)}>
      <div className="hidden md:block w-[250px] h-full p-4 border-r overflow-y-auto">
        {renderLeftSidebar()}
      </div>
      <div className="flex flex-col flex-1 h-full overflow-x-hidden">
        <div className="shrink-0">
          <SidebarHeader
            title={title}
            showBackButton={showBackButton}
            headerLeft={
              <>
                <LeftSidebarSheet
                  open={openSidebar}
                  setOpen={setOpenSidebar}
                  sidebar={renderLeftSidebar()}
                />
                {headerLeft}
              </>
            }
            headerRight={
              <>
                {headerRight}
                {rightSidebar && (
                  <RightSidebarSheet
                    open={openRightSidebar}
                    setOpen={setOpenRightSidebar}
                    sidebar={renderRightSidebar()}
                  />
                )}
              </>
            }
          />
        </div>
        <div className="relative flex flex-1 flex-row overflow-auto">
          <div className="flex-1 overflow-auto">{children}</div>
          <AnimatePresence initial={false}>
            {rightSidebar && isMd && openRightSidebar && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{
                  width: 450,
                  opacity: 1,
                  transition: {
                    width: { duration: 0.2 },
                    opacity: { duration: 0.3 }
                  }
                }}
                exit={{
                  width: 0,
                  opacity: 0,
                  transition: {
                    width: { duration: 0.2 },
                    opacity: { duration: 0.1 }
                  }
                }}
                className="h-full border-l overflow-y-auto"
              >
                {renderRightSidebar()}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

const LeftSidebarSheet = (
  props: ButtonProps & {
    open?: boolean
    setOpen?: (open: boolean) => void
    sidebar: React.ReactNode
  }
) => {
  const { open, setOpen, sidebar, ...otherProps } = props

  const isMd = useBreakpoint('md')

  if (isMd) {
    return null
  }

  return (
    <Sheet open={open} defaultOpen={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="iconXs"
          className="shrink-0 md:hidden"
          {...otherProps}
        >
          <TextAlignJustifyIcon className="size-3" />
        </Button>
      </SheetTrigger>

      <SheetContent side="left" className="w-[250px] sm:w-[300px] max-w-full">
        <VisuallyHidden>
          <SheetHeader>
            <SheetTitle />
            <SheetDescription />
          </SheetHeader>
        </VisuallyHidden>
        {sidebar}
      </SheetContent>
    </Sheet>
  )
}

const RightSidebarSheet = (
  props: ButtonProps & {
    open?: boolean
    setOpen?: (open: boolean) => void
    sidebar: React.ReactNode
  }
) => {
  const { open, setOpen, sidebar, ...otherProps } = props

  const isMd = useBreakpoint('md')

  if (isMd) {
    return (
      <Button
        variant="ghost"
        size="iconXs"
        className="shrink-0 ml-1"
        onClick={() => setOpen?.(!open)}
        {...otherProps}
      >
        <motion.div
          initial={false}
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronsLeft className="size-3" />
        </motion.div>
      </Button>
    )
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="iconXs"
          className="shrink-0 ml-1"
          {...otherProps}
        >
          <motion.div
            initial={false}
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronsLeft className="size-3" />
          </motion.div>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[250px] sm:w-[300px] max-w-full">
        <VisuallyHidden>
          <SheetHeader>
            <SheetTitle />
            <SheetDescription />
          </SheetHeader>
        </VisuallyHidden>
        {sidebar}
      </SheetContent>
    </Sheet>
  )
}
