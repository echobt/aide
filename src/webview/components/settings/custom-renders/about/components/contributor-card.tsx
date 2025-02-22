import { Badge } from '@webview/components/ui/badge'
import { Button } from '@webview/components/ui/button'
import { openLink } from '@webview/utils/api'
import { cn } from '@webview/utils/common'
import { motion } from 'framer-motion'
import { Crown } from 'lucide-react'

import { getMainContributorInfo } from '../constants'
import type { Contributor } from '../use-project-stats'

interface ContributorCardProps {
  contributor: Contributor
}

export const ContributorCard = ({ contributor }: ContributorCardProps) => {
  const isMainContributor = contributor.login === 'Jinming Yang'

  if (isMainContributor) {
    return <MainContributorCard contributor={contributor} />
  }

  return <RegularContributorCard contributor={contributor} />
}

const MainContributorCard = ({ contributor }: ContributorCardProps) => {
  const mainInfo = getMainContributorInfo(contributor.login)

  return (
    <div className="col-span-full sm:col-span-2 lg:col-span-3">
      <motion.div
        className={cn(
          'relative overflow-hidden rounded-xl border bg-gradient-to-r from-primary/5 via-background to-primary/5',
          'hover:shadow-lg transition-all duration-500 group'
        )}
        whileHover={{ scale: 1.01 }}
      >
        {/* Background Effects */}
        <div className="absolute inset-0 bg-grid-white/5 [mask-image:linear-gradient(0deg,transparent,black)] dark:bg-grid-dark/5" />
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-r from-primary/10 via-transparent to-primary/10" />

        <Button
          variant="ghost"
          className="w-full p-6 h-auto flex items-center gap-6 hover:bg-transparent"
          onClick={() => openLink(contributor.html_url)}
        >
          {/* Avatar Section */}
          <div className="relative">
            <div className="size-16 md:size-20 rounded-xl ring-2 ring-primary/20 overflow-hidden">
              <img
                src={contributor.avatar_url}
                alt={contributor.login}
                className="object-cover"
              />
            </div>
            <motion.div
              className="absolute -top-2 -right-2 size-6 text-yellow-500"
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut'
              }}
            >
              <Crown />
            </motion.div>
          </div>

          {/* Info Section */}
          <div className="flex-1 text-left space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="text-lg md:text-xl font-bold">
                {mainInfo?.displayName || contributor.login}
              </h3>
              <Badge variant="secondary" className="bg-primary/10 text-primary">
                {mainInfo?.role}
              </Badge>
            </div>

            <p className="text-muted-foreground text-sm md:text-base">
              {mainInfo?.description}
            </p>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <motion.span
                  className="font-semibold tabular-nums text-primary"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {contributor.contributions}
                </motion.span>
                <span className="text-sm text-muted-foreground">
                  contributions
                </span>
              </div>
            </div>
          </div>

          {/* Arrow indicator */}
          <motion.div
            className="size-8 rounded-full bg-primary/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            initial={{ x: -10 }}
            animate={{ x: 0 }}
            whileHover={{ scale: 1.2 }}
          >
            <svg
              className="size-4 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </motion.div>
        </Button>
      </motion.div>
    </div>
  )
}

const RegularContributorCard = ({ contributor }: ContributorCardProps) => (
  <Button
    variant="ghost"
    className={cn(
      'w-full h-16 px-4 flex items-center gap-3 group relative overflow-hidden',
      'hover:bg-muted/50 transition-colors rounded-lg'
    )}
    onClick={() => openLink(contributor.html_url)}
  >
    <div className="size-10 rounded-full ring-1 ring-border/50 flex-shrink-0 overflow-hidden">
      <img src={contributor.avatar_url} alt={contributor.login} />
    </div>

    <div className="flex-1 min-w-0 text-left">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-medium text-sm">{contributor.login}</span>
      </div>

      <div className="flex items-center gap-1.5 mt-1">
        <motion.span
          className="text-xs font-medium text-primary tabular-nums"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {contributor.contributions}
        </motion.span>
        <span className="text-xs text-muted-foreground">
          {contributor.contributions > 1 ? 'contributions' : 'contribution'}
        </span>
      </div>
    </div>

    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-r from-transparent via-primary/5 to-transparent -z-10" />
  </Button>
)
