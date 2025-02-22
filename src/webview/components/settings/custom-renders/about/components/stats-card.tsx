import { useEffect, useRef } from 'react'
import { animate, motion } from 'framer-motion'

const formatNumber = (value: number): string => {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}m`
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`
  }
  return value.toString()
}

interface StatsCardProps {
  icon: React.ReactNode
  label: string
  value: number
  delay?: number
}

export const StatsCard = ({
  icon,
  label,
  value,
  delay = 0
}: StatsCardProps) => {
  const nodeRef = useRef<HTMLDivElement>(null)
  const countRef = useRef<number>(0)

  useEffect(() => {
    const node = nodeRef.current

    if (node) {
      const controls = animate(0, value, {
        duration: 1.5,
        delay,
        onUpdate(value) {
          countRef.current = value
          node.textContent = formatNumber(Math.floor(value))
        },
        ease: [0.43, 0.13, 0.23, 0.96]
      })

      return () => controls.stop()
    }

    return () => {}
  }, [value, delay])

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay }}
      className="bg-card rounded-xl p-4 text-center space-y-2 border shadow-sm hover:shadow-md transition-all duration-300 group"
    >
      <motion.div
        className="text-primary/80"
        whileHover={{ scale: 1.2 }}
        transition={{ type: 'spring', stiffness: 400, damping: 10 }}
      >
        {icon}
      </motion.div>
      <div className="text-2xl font-bold tabular-nums group-hover:bg-gradient-to-r group-hover:from-primary group-hover:to-primary-foreground group-hover:bg-clip-text group-hover:text-transparent transition-all duration-300">
        <span ref={nodeRef}>0</span>
      </div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </motion.div>
  )
}
