import { logger } from '@extension/logger'
import { AIProviderType, type AideProvider } from '@shared/entities'

import { aideKeyUsageInfo } from '../aide-key-request'
import { type BaseModelUsageInfo } from './helpers/base'
import { OpenAIModelProvider } from './openai'

export class AideModelProvider extends OpenAIModelProvider {
  async getUsageInfo(): Promise<BaseModelUsageInfo | null> {
    try {
      // Ensure this is an Aide provider and has an API key
      if (this.aiProvider.type !== AIProviderType.Aide) {
        return null
      }
      const aideProvider = this.aiProvider as AideProvider
      const { apiKey } = aideProvider.extraFields

      if (!apiKey) return null

      const result = await aideKeyUsageInfo({ key: apiKey })

      if (!result.success) return null

      const { subscription } = result.data
      const totalUSD = subscription.hard_limit_usd
      const usedUSD =
        (subscription.used_quota / subscription.remain_quota) * totalUSD
      const remainUSD = totalUSD - usedUSD

      return {
        totalAmount: totalUSD,
        usedAmount: usedUSD,
        remainAmount: remainUSD,
        callTokenCount: result.data.count.count,
        validUntil: subscription.access_until,
        currency: 'USD'
      }
    } catch (error) {
      logger.error('Failed to fetch Aide usage info:', error)
      return null
    }
  }
}
