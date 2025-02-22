import { pkg } from '@shared/utils/pkg'
import { Badge } from '@webview/components/ui/badge'
import { Button } from '@webview/components/ui/button'
import { Separator } from '@webview/components/ui/separator'
import { Skeleton } from '@webview/components/ui/skeleton'
import { openLink } from '@webview/utils/api'
import { cn } from '@webview/utils/common'
import { AnimatePresence, motion } from 'framer-motion'
import { Download, GitBranch, Star, Users } from 'lucide-react'

import { ContributorCard } from './components/contributor-card'
import { StatsCard } from './components/stats-card'
import { isMainContributor } from './constants'
import { AideLogoIcon, GithubIcon } from './icons'
import { useProjectStats } from './use-project-stats'

const packageInfo = {
  name: pkg.displayName,
  version: pkg.version,
  author: pkg.author,
  homepage: pkg.homepage,
  website: pkg.website,
  issuesUrl: pkg.issuesUrl
}

export const About = () => {
  const { data: stats, isLoading } = useProjectStats()

  const mainContributor = stats?.contributors.find(c =>
    isMainContributor(c.login)
  )
  const otherContributors =
    stats?.contributors.filter(c => !isMainContributor(c.login)) || []

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="w-full max-w-5xl mx-auto p-4 md:p-8 space-y-8 md:space-y-12">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative text-center space-y-6"
        >
          <div className="absolute inset-0 -z-10">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-secondary/10 to-primary/10 blur-3xl opacity-30" />
          </div>

          {/* Logo & Title */}
          <div className="flex flex-col items-center gap-4">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', duration: 0.8 }}
            >
              <AideLogoIcon className="size-24 md:size-32" />
            </motion.div>

            <div className="space-y-2">
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="flex items-center justify-center gap-3"
              >
                <h1 className="text-2xl md:text-3xl font-bold">
                  {packageInfo.name}
                </h1>
                <Badge variant="secondary" className="text-sm">
                  v{packageInfo.version}
                </Badge>
              </motion.div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto mt-12">
            <AnimatePresence>
              {isLoading ? (
                Array(4)
                  .fill(0)
                  .map((_, i) => (
                    <Skeleton key={i} className="h-24 rounded-xl" />
                  ))
              ) : (
                <>
                  <StatsCard
                    icon={<Download className="size-5" />}
                    label="Installs"
                    value={stats?.installs || 0}
                    delay={0.1}
                  />
                  <StatsCard
                    icon={<Star className="size-5" />}
                    label="Stars"
                    value={stats?.stars || 0}
                    delay={0.2}
                  />
                  <StatsCard
                    icon={<GitBranch className="size-5" />}
                    label="Forks"
                    value={stats?.forks || 0}
                    delay={0.3}
                  />
                  <StatsCard
                    icon={<Users className="size-5" />}
                    label="Subscribers"
                    value={stats?.subscribers || 0}
                    delay={0.4}
                  />
                </>
              )}
            </AnimatePresence>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap justify-center gap-3 mt-8">
            <Button
              size="lg"
              onClick={() => openLink(packageInfo.website)}
              className={cn(
                'bg-gradient-to-r from-primary/90 to-primary text-primary-foreground',
                'hover:opacity-90 transition-all duration-300 group'
              )}
            >
              <motion.div
                className="mr-2 relative"
                animate={{
                  rotate: [0, -10, 10, 0],
                  scale: [1, 1.2, 1.2, 1]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut'
                }}
              >
                <AideLogoIcon className="size-5" />
              </motion.div>
              Visit Website
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => openLink(packageInfo.homepage)}
              className="border-2 hover:bg-primary/5 transition-all duration-300"
            >
              <GithubIcon className="mr-2 size-5" />
              Star on GitHub
            </Button>
          </div>
        </motion.div>

        <Separator className="my-6" />

        {/* Contributors Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="space-y-8"
        >
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold">Contributors</h2>
            <p className="text-muted-foreground">
              Thanks to all our contributors who make this project possible
            </p>
          </div>

          {isLoading ? (
            <div className="space-y-6">
              <Skeleton className="h-32 rounded-xl" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {Array(6)
                  .fill(0)
                  .map((_, i) => (
                    <Skeleton key={i} className="h-16 rounded-lg" />
                  ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Main Contributor */}
              {mainContributor && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <ContributorCard contributor={mainContributor} />
                </motion.div>
              )}

              {/* Other Contributors */}
              {otherContributors.length > 0 && (
                <div className="relative overflow-hidden rounded-xl border bg-card p-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {otherContributors.map((contributor, index) => (
                      <motion.div
                        key={contributor.login}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <ContributorCard contributor={contributor} />
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </motion.section>

        {/* Footer */}
        <footer className="text-center space-y-4">
          <p className="text-muted-foreground">
            Created with ❤️ by {packageInfo.author}
          </p>
          <div className="flex justify-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openLink(packageInfo.homepage)}
            >
              GitHub
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openLink(packageInfo.issuesUrl)}
            >
              Report Issue
            </Button>
          </div>
        </footer>
      </div>
    </div>
  )
}
