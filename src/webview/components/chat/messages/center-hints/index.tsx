import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@webview/components/ui/card'
import { motion } from 'framer-motion'

import { ChatTypeSelector } from './chat-type-selector'
import { ModelSettingHint } from './model-setting-hint'
import { PresetSelector } from './preset-selector'

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2
    }
  }
}

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
}

export const CenterHints = () => (
  <motion.div
    variants={container}
    initial="hidden"
    animate="show"
    className="flex flex-col flex-1 h-full items-center justify-center gap-6 p-4"
  >
    <motion.div variants={item} className="w-full max-w-sm">
      <Card className="border-dashed bg-background">
        <CardHeader className="space-y-1">
          <CardTitle className="text-xl">Configure</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <ChatTypeSelector />
            <ModelSettingHint />
            <PresetSelector />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  </motion.div>
)
