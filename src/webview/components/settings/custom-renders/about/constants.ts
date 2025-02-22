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

export const MAIN_CONTRIBUTORS: MainContributorInfo[] = [
  {
    login: 'Jinming Yang',
    displayName: 'Jinming Yang',
    role: 'Creator',
    description: 'Creator and maintainer of Aide'
  }
]

export const isMainContributor = (login: string) =>
  MAIN_CONTRIBUTORS.some(
    contributor =>
      contributor.login === login || contributor.displayName === login
  )

export const getMainContributorInfo = (login: string) =>
  MAIN_CONTRIBUTORS.find(
    contributor =>
      contributor.login === login || contributor.displayName === login
  )
