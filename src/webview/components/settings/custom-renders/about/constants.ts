import type { TFunction } from 'i18next'

export interface MainContributorInfo {
  /** GitHub login name */
  login: string
  /** Display name */
  displayName: string
  /** Role or title */
  role: string
  /** Brief description */
  description: string
}

export const getMainContributors = (t: TFunction): MainContributorInfo[] => [
  {
    login: 'Jinming Yang',
    displayName: 'Jinming Yang',
    role: t('webview.about.creatorRole'),
    description: t('webview.about.creatorDescription')
  }
]

export const isMainContributor = (t: TFunction, login: string) =>
  getMainContributors(t).some(
    contributor =>
      contributor.login === login || contributor.displayName === login
  )

export const getMainContributorInfo = (t: TFunction, login: string) =>
  getMainContributors(t).find(
    contributor =>
      contributor.login === login || contributor.displayName === login
  )
